import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const baseDir = 'C:/Users/windxin/Desktop/main/vibe_playyer';

console.log('--- VIBEPLAYER FULL STANDALONE EXE BUILDER ---');

// 1. Terminate running VibePlayer processes so executable is not locked
try {
    execSync('taskkill /F /IM VibePlayer.exe', { stdio: 'ignore' });
    console.log('Closed existing VibePlayer processes.');
} catch (e) {
    // Process not running, ignore
}

// 2. Collect all files to embed
const filesToEmbed = [];

function scanDir(dir, relPath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const rel = relPath ? `${relPath}/${entry.name}` : entry.name;

        // Skip ignored directories and files
        if (entry.isDirectory()) {
            if (['backup', 'node_modules', '.git', 'python', 'mingw64', 'scripts'].includes(entry.name)) {
                continue;
            }
            scanDir(fullPath, rel);
        } else {
            // Check size and extension
            const ext = path.extname(entry.name).toLowerCase();
            const stat = fs.statSync(fullPath);

            // Skip raw backups or files > 90MB (which are unoptimized source models)
            if (stat.size > 90 * 1024 * 1024) continue;
            if (['.exe', '.zip', '.doc', '.xla', '.ps1', '.log', '.tmp', '.bak'].includes(ext)) continue;
            if (entry.name === 'step_943.txt' || entry.name === 'build_args.rsp') continue;

            // Include only website assets, code, libs, html, css, js, models
            filesToEmbed.push({
                fullPath,
                relPath: rel,
                size: stat.size
            });
        }
    }
}

// Scan directories
scanDir(path.join(baseDir, 'css'), 'css');
scanDir(path.join(baseDir, 'js'), 'js');
scanDir(path.join(baseDir, 'libs'), 'libs');
scanDir(path.join(baseDir, 'assets'), 'assets');

// Add root index.html
if (fs.existsSync(path.join(baseDir, 'index.html'))) {
    filesToEmbed.push({
        fullPath: path.join(baseDir, 'index.html'),
        relPath: 'index.html',
        size: fs.statSync(path.join(baseDir, 'index.html')).size
    });
}

// Add app.ico
if (fs.existsSync(path.join(baseDir, 'app.ico'))) {
    filesToEmbed.push({
        fullPath: path.join(baseDir, 'app.ico'),
        relPath: 'app.ico',
        size: fs.statSync(path.join(baseDir, 'app.ico')).size
    });
}

console.log(`Collected ${filesToEmbed.length} files to embed.`);
const totalBytes = filesToEmbed.reduce((sum, f) => sum + f.size, 0);
console.log(`Total payload size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);

// 3. Generate response file for csc.exe
const rspPath = path.join(baseDir, 'build_args.rsp');
const rspLines = [
    '/target:winexe',
    `/win32icon:"${path.join(baseDir, 'app.ico').replace(/\\/g, '/')}"`,
    `/out:"${path.join(baseDir, 'VibePlayer.exe').replace(/\\/g, '/')}"`
];

for (const f of filesToEmbed) {
    const full = f.fullPath.replace(/\\/g, '/');
    const id = f.relPath.replace(/\\/g, '/');
    rspLines.push(`/resource:"${full}","${id}"`);
}

rspLines.push(`"${path.join(baseDir, 'StandaloneServer.cs').replace(/\\/g, '/')}"`);

fs.writeFileSync(rspPath, rspLines.join('\r\n'), 'utf8');
console.log(`Response file written to: ${rspPath}`);

// 4. Run csc.exe compiler
const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
console.log(`Compiling with ${cscPath}...`);

try {
    const out = execSync(`"${cscPath}" @"${rspPath}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    console.log(out);
    const exeStat = fs.statSync(path.join(baseDir, 'VibePlayer.exe'));
    console.log(`[SUCCESS] VibePlayer.exe compiled successfully!`);
    console.log(`Final EXE size: ${(exeStat.size / (1024 * 1024)).toFixed(2)} MB`);
} catch (err) {
    console.error('Compilation failed:');
    if (err.stdout) console.error(err.stdout);
    if (err.stderr) console.error(err.stderr);
    process.exit(1);
}
