import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

const server = http.createServer((req, res) => {
    // Enable CORS for modern WebGL assets
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);
    let pathname = decodeURI(parsedUrl.pathname);

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

