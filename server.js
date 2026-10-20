import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile, spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5173;
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.bin': 'application/octet-stream',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.wasm': 'application/wasm'
};

function getToolPaths() {
    const userProfile = process.env.USERPROFILE || '';
    const wingetYt = path.join(userProfile, 'AppData/Local/Microsoft/WinGet/Packages/yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe/yt-dlp.exe');
    const wingetFfmpeg = path.join(userProfile, 'AppData/Local/Microsoft/WinGet/Packages/yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-N-126374-g089a48eb36-win64-gpl/bin');
    const localYt = path.join(__dirname, 'bin', 'yt-dlp.exe');
    const localFfmpeg = path.join(__dirname, 'bin');

    let ytPath = 'yt-dlp';
    if (fs.existsSync(localYt)) ytPath = localYt;
    else if (fs.existsSync(wingetYt)) ytPath = wingetYt;

    let ffmpegDir = '';
    if (fs.existsSync(path.join(localFfmpeg, 'ffmpeg.exe'))) ffmpegDir = localFfmpeg;
    else if (fs.existsSync(path.join(wingetFfmpeg, 'ffmpeg.exe'))) ffmpegDir = wingetFfmpeg;

    return { ytPath, ffmpegDir, nodePath: process.execPath };
}

const downloadJobs = new Map();
const streamUrlCache = new Map();

const server = http.createServer((req, res) => {
    // Enable CORS for modern WebGL assets and AudioContext
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);
    let pathname = decodeURI(parsedUrl.pathname);

    // API: GET /api/tracks (List downloaded & saved audio tracks)
    if (pathname === '/api/tracks' && req.method === 'GET') {
        const audioDir = path.join(__dirname, 'assets', 'audio');
        try {
            if (!fs.existsSync(audioDir)) {
                fs.mkdirSync(audioDir, { recursive: true });
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ tracks: [] }));
                return;
            }
            const entries = fs.readdirSync(audioDir, { withFileTypes: true });
            const tracks = [];
            for (const entry of entries) {
                if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (['.mp3', '.m4a', '.wav', '.ogg', '.webm'].includes(ext)) {
                        const full = path.join(audioDir, entry.name);
                        const stat = fs.statSync(full);
                        tracks.push({
                            name: entry.name.replace(/\.[^/.]+$/, ''),
                            fileName: entry.name,
                            relPath: `assets/audio/${entry.name}`,
                            sizeMB: (stat.size / (1024 * 1024)).toFixed(2),
                            mtime: stat.mtimeMs
                        });
                    }
                }
            }
            tracks.sort((a, b) => b.mtime - a.mtime);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ count: tracks.length, tracks }));
            return;
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err.message }));
            return;
        }
    }

    // API: GET /api/yt/info?url=...
    if (pathname === '/api/yt/info' && req.method === 'GET') {
        const ytUrl = parsedUrl.searchParams.get('url');
        if (!ytUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Missing url parameter' }));
            return;
        }
        const { ytPath, nodePath } = getToolPaths();
        const args = [
            '--no-playlist',
            '--js-runtimes', `node:${nodePath}`,
            '--print', '%(title)s|||%(uploader)s|||%(duration_string)s|||%(thumbnail)s',
            ytUrl
        ];
        execFile(ytPath, args, (err, stdout, stderr) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: err.message, details: stderr }));
                return;
            }
            const parts = stdout.trim().split('|||');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                ok: true,
                title: parts[0] || 'Unknown Title',
                uploader: parts[1] || 'YouTube',
                duration: parts[2] || '00:00',
                thumbnail: parts[3] || '',
                url: ytUrl
            }));
        });
        return;
    }

    // API: GET /api/yt/stream?url=... (Instant audio streaming proxy)
    if (pathname === '/api/yt/stream' && req.method === 'GET') {
        const ytUrl = parsedUrl.searchParams.get('url');
        if (!ytUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Missing url parameter' }));
            return;
        }

        const handleStreamWithUrl = (directUrl) => {
            const headers = { 'User-Agent': 'Mozilla/5.0' };
            if (req.headers.range) {
                headers.range = req.headers.range;
            }

            const proxyReq = https.request(directUrl, { headers }, (proxyRes) => {
                const resHeaders = {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                    'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
                    'Accept-Ranges': 'bytes',
                    'Content-Type': proxyRes.headers['content-type'] || 'audio/webm',
                    'Cache-Control': 'no-cache'
                };
                if (proxyRes.headers['content-length']) resHeaders['Content-Length'] = proxyRes.headers['content-length'];
                if (proxyRes.headers['content-range']) resHeaders['Content-Range'] = proxyRes.headers['content-range'];

                res.writeHead(proxyRes.statusCode || 200, resHeaders);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (e) => {
                if (!res.headersSent) {
                    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Failed to proxy audio stream', details: e.message }));
                }
            });

            req.on('close', () => {
                proxyReq.destroy();
            });

            proxyReq.end();
        };

        const cached = streamUrlCache.get(ytUrl);
        if (cached && (Date.now() - cached.time < 3600000)) {
            handleStreamWithUrl(cached.url);
            return;
        }

        const { ytPath, nodePath } = getToolPaths();
        const args = [
            '--no-playlist',
            '--js-runtimes', `node:${nodePath}`,
            '-g', '-f', 'ba/b',
            ytUrl
        ];

        execFile(ytPath, args, (err, stdout, stderr) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Could not resolve stream URL', details: stderr }));
                return;
            }
            const directUrl = stdout.trim().split('\n')[0].trim();
            streamUrlCache.set(ytUrl, { url: directUrl, time: Date.now() });
            handleStreamWithUrl(directUrl);
        });
        return;
    }

    // API: POST /api/yt/download (Background download to MP3)
    if (pathname === '/api/yt/download' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                const ytUrl = data.url;
                if (!ytUrl) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Missing url in request body' }));
                    return;
                }

                const jobId = 'yt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
                const audioDir = path.join(__dirname, 'assets', 'audio');
                if (!fs.existsSync(audioDir)) {
                    fs.mkdirSync(audioDir, { recursive: true });
                }

                const job = {
                    id: jobId,
                    url: ytUrl,
                    status: 'starting',
                    progress: 0,
                    speed: '',
                    eta: '',
                    title: '',
                    fileName: '',
                    relPath: '',
                    error: null
                };
                downloadJobs.set(jobId, job);

                const { ytPath, ffmpegDir, nodePath } = getToolPaths();
                const outputTemplate = path.join(audioDir, '%(title)s.%(ext)s');
                const args = [
                    '--no-playlist',
                    '--js-runtimes', `node:${nodePath}`,
                    '-x',
                    '--audio-format', 'mp3',
                    '--audio-quality', '320k',
                    '--embed-metadata',
                    '-o', outputTemplate
                ];
                if (ffmpegDir) {
                    args.push('--ffmpeg-location', ffmpegDir);
                }
                args.push(ytUrl);

                const child = spawn(ytPath, args);

                child.stdout.on('data', (d) => {
                    const str = d.toString('utf8');
                    const m = str.match(/\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/);
                    if (m) {
                        job.status = 'downloading';
                        job.progress = parseFloat(m[1]);
                        job.speed = m[3];
                        job.eta = m[4];
                    }
                    if (str.includes('[ExtractAudio]')) {
                        job.status = 'converting';
                        job.progress = 98;
                        job.speed = 'Converting MP3...';
                    }
                    const titleMatch = str.match(/Destination:\s*(.+?\.(?:webm|m4a|mp3))/i);
                    if (titleMatch) {
                        const rawName = path.basename(titleMatch[1]);
                        job.fileName = rawName.replace(/\.[^/.]+$/, '.mp3');
                        job.title = job.fileName.replace(/\.mp3$/i, '');
                        job.relPath = `assets/audio/${job.fileName}`;
                    }
                });

                child.stderr.on('data', (d) => {
                    const str = d.toString('utf8');
                    if (str.includes('ERROR:')) {
                        job.error = str;
                    }
                });

                child.on('close', (code) => {
                    if (code === 0) {
                        job.status = 'completed';
                        job.progress = 100;
                        job.speed = 'Done';
                        job.eta = '00:00';
                        if (!job.fileName) {
                            try {
                                const files = fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3'));
                                if (files.length > 0) {
                                    const sorted = files.map(f => ({ name: f, time: fs.statSync(path.join(audioDir, f)).mtimeMs }))
                                        .sort((a, b) => b.time - a.time);
                                    job.fileName = sorted[0].name;
                                    job.title = sorted[0].name.replace(/\.mp3$/i, '');
                                    job.relPath = `assets/audio/${job.fileName}`;
                                }
                            } catch (e) {}
                        }
                    } else {
                        job.status = 'error';
                        job.error = job.error || `Process exited with code ${code}`;
                    }
                });

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true, jobId }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // API: GET /api/yt/progress?jobId=...
    if (pathname === '/api/yt/progress' && req.method === 'GET') {
        const jobId = parsedUrl.searchParams.get('jobId');
        const job = downloadJobs.get(jobId);
        if (!job) {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Job not found' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(job));
        return;
    }

    // API: GET /api/models
    if (pathname === '/api/models' && req.method === 'GET') {
        const modelsDir = path.join(__dirname, 'assets', 'models');
        try {
            if (!fs.existsSync(modelsDir)) {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ models: [] }));
                return;
            }

            const scanDir = (dir, relPrefix = '') => {
                let results = [];
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    const relPath = path.join(relPrefix, entry.name).replace(/\\/g, '/');
                    if (entry.isDirectory()) {
                        results = results.concat(scanDir(fullPath, relPath));
                    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) {
                        const stat = fs.statSync(fullPath);
                        results.push({
                            name: entry.name,
                            relPath: `assets/models/${relPath}`,
                            sizeMB: (stat.size / (1024 * 1024)).toFixed(2),
                            category: relPrefix ? relPrefix : 'main'
                        });
                    }
                }
                return results;
            };

            const modelList = scanDir(modelsDir);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ count: modelList.length, models: modelList }, null, 2));
            return;
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err.message }));
            return;
        }
    }

    // Static files
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.join(__dirname, pathname);

    // Security check against directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end(`Not Found: ${pathname}`);
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        // HTTP Range Requests Support (Critical for Audio & GLB streaming)
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

            if (start >= stats.size || end >= stats.size) {
                res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` });
                res.end();
                return;
            }

            const chunksize = (end - start) + 1;
            const fileStream = fs.createReadStream(filePath, { start, end });

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stats.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType,
                'Cache-Control': 'no-cache'
            });
            fileStream.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': stats.size,
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'no-cache'
            });
            fs.createReadStream(filePath).pipe(res);
        }
    });
});

let currentPort = parseInt(process.env.PORT || 5173, 10);

function startServer(port) {
    server.listen(port, '127.0.0.1', () => {
        console.log(`VibePlayer Server running at http://127.0.0.1:${port}/`);
        console.log(`Models API available at http://127.0.0.1:${port}/api/models`);
    });
}

server.on('error', (err) => {
    if ((err.code === 'EACCES' || err.code === 'EADDRINUSE') && currentPort < 5200) {
        currentPort = (currentPort >= 5173 && currentPort <= 5179) ? 5180 : currentPort + 1;
        console.log(`Port ${err.port || 'reserved'} unavailable, trying port ${currentPort}...`);
        setTimeout(() => startServer(currentPort), 100);
    } else {
        console.error('Server error:', err);
    }
});

startServer(currentPort);

