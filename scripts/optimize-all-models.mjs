import fs from 'fs';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

console.log('=== Universal Color-Preserving 3D Model Optimizer ===');

export async function optimizeModel(inputPath, outputPath, options = {}) {
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

    await doc.transform(
        dedup(),
        prune(),
        textureCompress({
            encoder: sharp,
            targetFormat: 'webp',
            quality: options.textureQuality || 90
        }),
        draco({
            encoder: encoder,
            decoder: decoder,
            method: 'edgebreaker',
            quantizePosition: 14,
            quantizeNormal: 10,
            quantizeTexcoord: 12,
            quantizeColor: 8 // Essential for vertex colors in Minecraft/Voxel exports!
        })
    );

    await io.write(outputPath, doc);
    const outSize = fs.statSync(outputPath).size;
    console.log(`Saved: ${path.basename(outputPath)} (${(outSize / (1024 * 1024)).toFixed(2)} MB) - ${(100 - (outSize / inSize) * 100).toFixed(1)}% reduction.`);
    return true;
}

// Auto-run when called directly
const args = process.argv.slice(2);
if (args.length >= 2) {
    optimizeModel(args[0], args[1]);
}
