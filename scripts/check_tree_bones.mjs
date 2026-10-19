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

    // Let's inspect Plane001_zemin_0
    // "zemin" means "ground/floor" in Turkish!
    // A plane representing the ground is flat on the ground plane!
    // Let's see what the normal of Plane001_zemin is!
    for (const mesh of treeRoot.listMeshes()) {
        if (/zemin|plane/i.test(mesh.getName())) {
            for (const prim of mesh.listPrimitives()) {
                const pos = prim.getAttribute('POSITION');
                const norm = prim.getAttribute('NORMAL');
                console.log('Ground plane (zemin) attributes:');
                console.log('  Position count:', pos.getCount());
                const pArr = pos.getArray();
                let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity, minZ=Infinity, maxZ=-Infinity;
                for (let i = 0; i < pArr.length; i += 3) {
                    const x = pArr[i], y = pArr[i+1], z = pArr[i+2];
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
                }
                console.log(`  zemin local bounds: X[${minX.toFixed(2)}..${maxX.toFixed(2)}], Y[${minY.toFixed(2)}..${maxY.toFixed(2)}], Z[${minZ.toFixed(2)}..${maxZ.toFixed(2)}]`);
            }
        }
    }

    // Also let's check the skeleton bone positions in world space
    // Let's trace Bone001 to Bone006
    // In gltf, what is the world position of each bone?
    // Let's calculate the cumulative transform for Bone001..Bone006
    const scene = treeRoot.listScenes()[0];
    const worldMatrices = new Map();

    function computeWorldMatrix(node, parentMat) {
        const t = node.getTranslation() || [0,0,0];
        const r = node.getRotation() || [0,0,0,1];
        const s = node.getScale() || [1,1,1];

        const localMat = new THREE.Matrix4().compose(
            new THREE.Vector3(...t),
            new THREE.Quaternion(...r),
            new THREE.Vector3(...s)
        );
        const worldMat = parentMat.clone().multiply(localMat);
        worldMatrices.set(node.getName(), worldMat);

        for (const child of node.listChildren()) {
            computeWorldMatrix(child, worldMat);
        }
    }

    computeWorldMatrix(scene.listChildren()[0], new THREE.Matrix4());

    console.log('\n--- Bone World Positions ---');
    for (let i = 1; i <= 6; i++) {
        const name = `Bone00${i}_0${i-1}`;
        const mat = worldMatrices.get(name);
        if (mat) {
            const pos = new THREE.Vector3();
            mat.decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
            console.log(`  ${name}: pos = (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
        }
    }

    // Check zemin node world matrix and bounds
    const zeminMat = worldMatrices.get('Plane001_zemin_0');
    if (zeminMat) {
        const pos = new THREE.Vector3();
        zeminMat.decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
        console.log(`  zemin node world pos = (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
    }
}

main().catch(console.error);
