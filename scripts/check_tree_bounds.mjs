import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import * as THREE from 'three';

async function main() {
    const encoder = await draco3d.createEncoderModule();
    const decoder = await draco3d.createDecoderModule();
    const io = new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
            'draco3d.decoder': decoder,
            'draco3d.encoder': encoder,
        });

    const treeDoc = await io.read('dark_tree_-_dol_guldur.glb');
    const treeRoot = treeDoc.getRoot();

    // Check meshes in treeDoc:
    // In dark_tree_-_dol_guldur.glb, what are the mesh names?
    for (const mesh of treeRoot.listMeshes()) {
        console.log('Mesh:', mesh.getName());
    }

    // Let's test the rotation quaternion: [-0.7071067811865475, 0, 0, 0.7071067811865476]
    const quat = new THREE.Quaternion(-0.7071067811865475, 0, 0, 0.7071067811865476);
    const scale = 0.28;

    let rotMinY = Infinity, rotMaxY = -Infinity;
    let rotMinX = Infinity, rotMaxX = -Infinity;
    let rotMinZ = Infinity, rotMaxZ = -Infinity;

    for (const mesh of treeRoot.listMeshes()) {
        if (/zemin|plane/i.test(mesh.getName())) {
            console.log('Skipping zemin plane:', mesh.getName());
            continue;
        }
        for (const prim of mesh.listPrimitives()) {
            const pos = prim.getAttribute('POSITION');
            if (!pos) continue;
            const arr = pos.getArray();
            for (let i = 0; i < arr.length; i += 3) {
                const v = new THREE.Vector3(arr[i], arr[i+1], arr[i+2]);
                v.applyQuaternion(quat);
                v.multiplyScalar(scale);

                if (v.y < rotMinY) rotMinY = v.y;
                if (v.y > rotMaxY) rotMaxY = v.y;
                if (v.x < rotMinX) rotMinX = v.x;
                if (v.x > rotMaxX) rotMaxX = v.x;
                if (v.z < rotMinZ) rotMinZ = v.z;
                if (v.z > rotMaxZ) rotMaxZ = v.z;
            }
        }
    }

    console.log('Transformed Tree (excluding zemin):');
    console.log(`  Y range: [${rotMinY.toFixed(3)} .. ${rotMaxY.toFixed(3)}]`);
    console.log(`  X range: [${rotMinX.toFixed(3)} .. ${rotMaxX.toFixed(3)}]`);
    console.log(`  Z range: [${rotMinZ.toFixed(3)} .. ${rotMaxZ.toFixed(3)}]`);
    console.log(`  Height: ${(rotMaxY - rotMinY).toFixed(3)}`);
    console.log(`  If bottom of roots is at Y=205.0:`);
    console.log(`  Translation Y must be: ${(205.0 - rotMinY).toFixed(3)}`);

    // Let's also check the courtyard floor around X=431.6, Z=392.7 in city model
    const cityDoc = await io.read('minas_tirith.glb');
    const cityRoot = cityDoc.getRoot();
    let floorY = [];
    for (const mesh of cityRoot.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
            const pos = prim.getAttribute('POSITION');
            if (!pos) continue;
            const arr = pos.getArray();
            for (let i = 0; i < arr.length; i += 3) {
                const x = arr[i], y = arr[i+1], z = arr[i+2];
                if (Math.abs(x - 431.6) < 5.0 && Math.abs(z - 392.7) < 5.0 && y > 190 && y < 220) {
                    floorY.push(y);
                }
            }
        }
    }
    floorY.sort((a,b) => a - b);
    console.log(`Courtyard Y points near [431.6, 392.7]: count=${floorY.length}, min=${floorY[0]}, max=${floorY[floorY.length-1]}, median=${floorY[Math.floor(floorY.length/2)]}`);
}

main().catch(console.error);
