import fs from 'fs';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

console.log('=== Minas Tirith Color-Preserving Draco Optimizer ===');

export async function optimizeMinasTirith(inputPath, outputPath) {
    if (!fs.existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        return false;
    }

    const inSize = fs.statSync(inputPath).size;
    console.log(`Processing: ${path.basename(inputPath)} (${(inSize / (1024 * 1024)).toFixed(2)} MB)`);

    const encoder = await draco3d.createEncoderModule();
    const decoder = await draco3d.createDecoderModule();

    const io = new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
            'draco3d.decoder': decoder,
            'draco3d.encoder': encoder,
        });

    const doc = await io.read(inputPath);

    // Безопасный пайплайн БЕЗ join() и flatten() для сохранения COLOR_0 (Vertex Colors) и нормалей
    await doc.transform(
        dedup(),
        prune(),
        textureCompress({
            encoder: sharp,
            targetFormat: 'webp',
            quality: 90
        }),
        draco({
            encoder: encoder,
            decoder: decoder,
            method: 'edgebreaker',
            quantizePosition: 14,
            quantizeNormal: 10,
            quantizeTexcoord: 12,
            quantizeColor: 8 // ОБЯЗАТЕЛЬНО для вертексных цветов Minecraft/Voxel
        })
    );

    await io.write(outputPath, doc);
    const outSize = fs.statSync(outputPath).size;
    console.log(`Saved: ${path.basename(outputPath)} (${(outSize / (1024 * 1024)).toFixed(2)} MB) - ${(100 - (outSize / inSize) * 100).toFixed(1)}% reduction.`);
    return true;
}

const sourceFile = 'C:/Users/windxin/Downloads/minas_tirith_-_minecraft.glb';
const targetFile = './minas_tirith.glb';
const assetTarget = './assets/models/minas_tirith.glb';

if (fs.existsSync(sourceFile)) {
    console.log(`Re-optimizing Minas Tirith from source: ${sourceFile}`);
    await optimizeMinasTirith(sourceFile, targetFile);
    if (fs.existsSync('./assets/models')) {
        fs.copyFileSync(targetFile, assetTarget);
        console.log(`Copied fresh model to ${assetTarget}`);
    }
} else {
    console.log(`Source ${sourceFile} not found, verifying local ${targetFile}...`);
}
