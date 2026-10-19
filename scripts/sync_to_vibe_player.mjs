import fs from 'fs';
import path from 'path';

const srcDir = 'C:/Users/windxin/Desktop/main';
const dstDir = 'C:/Users/windxin/Desktop/main/vibe_playyer';

function copyFolderRecursive(src, dst) {
    if (!fs.existsSync(dst)) {
        fs.mkdirSync(dst, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const dstPath = path.join(dst, entry.name);
        if (entry.isDirectory()) {
            copyFolderRecursive(srcPath, dstPath);
        } else {
            fs.copyFileSync(srcPath, dstPath);
        }
    }
}

console.log('Copying project directories from main to vibe_playyer...');
for (const folder of ['js', 'css', 'libs', 'assets', 'scripts']) {
    const s = path.join(srcDir, folder);
    const d = path.join(dstDir, folder);
    if (fs.existsSync(s)) {
        console.log(`Copying ${folder}...`);
        copyFolderRecursive(s, d);
    }
}

for (const file of ['index.html', 'server.js', 'package.json', 'package-lock.json', 'StandaloneServer.cs', 'app.ico', 'viewer.html']) {
    const s = path.join(srcDir, file);
    const d = path.join(dstDir, file);
    if (fs.existsSync(s)) {
        console.log(`Copying ${file}...`);
        fs.copyFileSync(s, d);
    }
}

console.log('All files synchronized to vibe_playyer successfully!');
