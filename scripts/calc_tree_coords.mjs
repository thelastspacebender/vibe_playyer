import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

async function main() {
    const encoder = await draco3d.createEncoderModule();
    const decoder = await draco3d.createDecoderModule();
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
        'draco3d.decoder': decoder,
        'draco3d.encoder': encoder,
    });

    const doc = await io.read('assets/models/minas_tirith.glb');
    const root = doc.getRoot();

    // Calculate raw bounds of model
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity, minZ=Infinity, maxZ=-Infinity;
    for (const mesh of root.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
            const pos = prim.getAttribute('POSITION');
            if (!pos) continue;
            const arr = pos.getArray();
            for (let i = 0; i < arr.length; i += 3) {
                const x = arr[i], y = arr[i+1], z = arr[i+2];
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
                if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
            }
        }
    }

    const rawCenter = new THREE.Vector3((minX + maxX)/2, (minY + maxY)/2, (minZ + maxZ)/2);
    const rawMinY = minY;
    const rawSize = new THREE.Vector3(maxX - minX, maxY - minY, maxZ - minZ);
    const maxDim = Math.max(rawSize.x, rawSize.z);
    const scaleFactor = 100.0 / maxDim;

    console.log('City Raw Bounds:', { minX, maxX, minY, maxY, minZ, maxZ });
    console.log('Raw Center:', rawCenter);
    console.log('Scale factor:', scaleFactor);

    // Tree in raw coordinates: [431.6, 205.0, 392.7]
    const rawTree = new THREE.Vector3(431.6, 205.0, 392.7);
    // Transformed: (rawTree - (rawCenter.x, rawMinY, rawCenter.z)) * scaleFactor
    const transformedTree = new THREE.Vector3(
        (rawTree.x - rawCenter.x) * scaleFactor,
        (rawTree.y - rawMinY) * scaleFactor,
        (rawTree.z - rawCenter.z) * scaleFactor
    );

    console.log('Transformed treePos at Y=205:');
    console.log(`  treePos = Vector3(${transformedTree.x.toFixed(2)}, ${transformedTree.y.toFixed(2)}, ${transformedTree.z.toFixed(2)})`);

    // Let's also check where the tree top branch would be (~220 raw Y)
    const rawTreeTop = new THREE.Vector3(431.6, 220.0, 392.7);
    const transformedTreeTop = new THREE.Vector3(
        (rawTreeTop.x - rawCenter.x) * scaleFactor,
        (rawTreeTop.y - rawMinY) * scaleFactor,
        (rawTreeTop.z - rawCenter.z) * scaleFactor
    );
    console.log(`  treeTop = Vector3(${transformedTreeTop.x.toFixed(2)}, ${transformedTreeTop.y.toFixed(2)}, ${transformedTreeTop.z.toFixed(2)})`);

    // Normalized city total height
    const normalizedH = rawSize.y * scaleFactor;
    console.log(`  City normalized H_MAX: ${normalizedH.toFixed(2)}`);
}

main().catch(console.error);
