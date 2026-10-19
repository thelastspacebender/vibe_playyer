// optimize-all-models.mjs - Universal Color-Preserving 3D Model & RAM Optimizer
// Runs with: node --max-old-space-size=8192 optimize-all-models.mjs

import fs from 'fs';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

console.log('===============================================================');
console.log('   BATCH 3D MODEL & TEXTURE MEMORY OPTIMIZER (APU UMA RAM)     ');
console.log('===============================================================');

const MODELS_CONFIG = [
    { file: 'room.glb', maxRes: 2048, isStatic: true, quality: 88 },
    { file: 'gryffindor_common_room.glb', maxRes: 2048, isStatic: true, quality: 88 },
    { file: 'dumbledores_office.glb', maxRes: 2048, isStatic: true, quality: 88 },
    { file: 'minas_tirith.glb', maxRes: 2048, isStatic: false, preserveColors: true, quality: 90 }, // No weld/join to protect voxel COLOR_0
    { file: 'dark_tree_-_dol_guldur.glb', maxRes: 1024, isStatic: true, quality: 85 },
    { file: 'jedi_council_baked.glb', maxRes: 2048, isStatic: true, quality: 88 },
    { file: 'r2d2_-_star_wars.glb', maxRes: 1024, isStatic: false, quality: 85 },
    { file: 'stormtrooper_captain_by_oscar_creativo.glb', maxRes: 2048, isStatic: false, quality: 85 }, // SkinnedMesh
    { file: 'yoda.glb', maxRes: 1024, isStatic: false, quality: 85 }, // SkinnedMesh
    { file: 'star_wars_trooper_dancing.glb', maxRes: 1024, isStatic: false, quality: 85 } // SkinnedMesh with animation
];

async function runOptimization() {
    const encoder = await draco3d.createEncoderModule();
    const decoder = await draco3d.createDecoderModule();

    const io = new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
            'draco3d.decoder': decoder,
            'draco3d.encoder': encoder,
        });

    const backupDir = path.resolve('assets/models/backup');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    let totalSavedBytes = 0;

    for (const cfg of MODELS_CONFIG) {
        let inputPath = path.resolve('assets/models', cfg.file);
        if (!fs.existsSync(inputPath)) {
            inputPath = path.resolve('.', cfg.file);
        }
        if (!fs.existsSync(inputPath)) {
            console.warn(`[SKIP] Model not found: ${cfg.file}`);
            continue;
        }

        const initialSize = fs.statSync(inputPath).size;
        console.log(`\n-------------------------------------------------------------`);
        console.log(`Processing: ${cfg.file} (${(initialSize / (1024 * 1024)).toFixed(2)} MB)`);

        // 1. Create safety backup if not already present
        const backupPath = path.join(backupDir, cfg.file);
        if (!fs.existsSync(backupPath)) {
            fs.copyFileSync(inputPath, backupPath);
            console.log(`  [Backup created] -> ${backupPath}`);
        }

        const doc = await io.read(inputPath);
        const root = doc.getRoot();

        // 2. Texture Optimization (4K -> 2K/1K WebP)
        const textures = root.listTextures();
        let resizedCount = 0;
        for (const tex of textures) {
            const imgBuf = tex.getImage();
            if (!imgBuf || imgBuf.length === 0) continue;

            try {
                const meta = await sharp(imgBuf).metadata();
                const maxDim = Math.max(meta.width || 0, meta.height || 0);

                if (maxDim > cfg.maxRes || tex.getMimeType() !== 'image/webp') {
                    const newBuf = await sharp(imgBuf)
                        .resize(cfg.maxRes, cfg.maxRes, { fit: 'inside', withoutEnlargement: true })
                        .webp({ quality: cfg.quality || 88 })
                        .toBuffer();

                    tex.setImage(newBuf);
                    tex.setMimeType('image/webp');
                    resizedCount++;
                }
            } catch (err) {
                // Keep original image if sharp cannot parse
                console.warn(`  [Texture warn] ${err.message}`);
            }
        }
        if (resizedCount > 0) {
            console.log(`  Resized & converted ${resizedCount} textures to WebP (max ${cfg.maxRes}px).`);
        }

        // 3. Geometry transforms
        const transforms = [dedup(), prune()];
        if (cfg.isStatic) {
            transforms.push(weld({ tolerance: 0.0001 }));
        }

        transforms.push(
            draco({
                encoder: encoder,
                decoder: decoder,
                method: 'edgebreaker',
                quantizePosition: 14,
                quantizeNormal: 10,
                quantizeTexcoord: 12,
                quantizeColor: 8 // Crucial for Minecraft COLOR_0
            })
        );

        await doc.transform(...transforms);

        // 4. Save to assets/models and root
        const outputPath = path.resolve('assets/models', cfg.file);
        await io.write(outputPath, doc);

        // Also update root file if present
        const rootPath = path.resolve('.', cfg.file);
        if (fs.existsSync(rootPath)) {
            fs.copyFileSync(outputPath, rootPath);
        }

        const finalSize = fs.statSync(outputPath).size;
        const diff = initialSize - finalSize;
        if (diff > 0) totalSavedBytes += diff;
        const pct = ((1 - (finalSize / initialSize)) * 100).toFixed(1);
        console.log(`  [Done] Saved: ${(finalSize / (1024 * 1024)).toFixed(2)} MB (${pct}% reduction)`);
    }

    console.log('\n===============================================================');
    console.log(`ALL MODELS OPTIMIZED. Total Disk/VRAM saved: ${(totalSavedBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log('===============================================================');
}

runOptimization().catch((err) => {
    console.error('Fatal error during optimization:', err);
    process.exit(1);
});
