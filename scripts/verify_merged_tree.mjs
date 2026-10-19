import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments } from '@gltf-transform/functions';
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

    const cityDoc = await io.read('minas_tirith.glb');
    const treeDoc = await io.read('dark_tree_-_dol_guldur.glb');

    const treeRoot = treeDoc.getRoot();
    for (const node of treeRoot.listNodes()) {
        if (/zemin|plane/i.test(node.getName())) node.dispose();
    }
    for (const mesh of treeRoot.listMeshes()) {
        if (/zemin|plane/i.test(mesh.getName())) mesh.dispose();
    }

    mergeDocuments(cityDoc, treeDoc);

    const mergedRoot = cityDoc.getRoot();
    const scenes = mergedRoot.listScenes();
    const cityScene = scenes[0];
    if (scenes.length > 1) {
        for (let i = 1; i < scenes.length; i++) {
            scenes[i].dispose();
        }
    }

    let treeContainer = null;
    for (const node of mergedRoot.listNodes()) {
        if (node.getName() === 'Sketchfab_model') {
            treeContainer = node;
            break;
        }
    }

    treeContainer.setName('WhiteTreeOfGondor');
    treeContainer.setTranslation([431.5, 205.0, 392.5]);
    treeContainer.setScale([0.28, 0.28, 0.28]);
    cityScene.addChild(treeContainer);

    // Compute world transform of tree meshes
    function getNodeWorldMatrix(node) {
        let cur = node;
        const stack = [];
        while (cur) {
            stack.unshift(cur);
            // find parent
            let parent = null;
            for (const n of mergedRoot.listNodes()) {
                if (n.listChildren().includes(cur)) {
                    parent = n;
                    break;
                }
            }
            cur = parent;
        }

        const mat = new THREE.Matrix4();
        for (const n of stack) {
            const t = n.getTranslation() || [0,0,0];
            const r = n.getRotation() || [0,0,0,1];
            const s = n.getScale() || [1,1,1];
            const localMat = new THREE.Matrix4().compose(
                new THREE.Vector3(...t),
                new THREE.Quaternion(...r),
                new THREE.Vector3(...s)
            );
            mat.multiply(localMat);
        }
        return mat;
    }

    let minY = Infinity, maxY = -Infinity;
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const mesh of mergedRoot.listMeshes()) {
        if (/tree/i.test(mesh.getName())) {
            // Find nodes referencing this mesh
            for (const node of mergedRoot.listNodes()) {
                if (node.getMesh() === mesh) {
                    const worldMat = getNodeWorldMatrix(node);
                    for (const prim of mesh.listPrimitives()) {
                        const pos = prim.getAttribute('POSITION');
                        const arr = pos.getArray();
                        for (let i = 0; i < arr.length; i += 3) {
                            const v = new THREE.Vector3(arr[i], arr[i+1], arr[i+2]);
                            v.applyMatrix4(worldMat);
                            if (v.y < minY) minY = v.y;
                            if (v.y > maxY) maxY = v.y;
                            if (v.x < minX) minX = v.x;
                            if (v.x > maxX) maxX = v.x;
                            if (v.z < minZ) minZ = v.z;
                            if (v.z > maxZ) maxZ = v.z;
                        }
                    }
                }
            }
        }
    }

    console.log(`World Bounding Box of Tree in City:`);
    console.log(`  X: [${minX.toFixed(2)} .. ${maxX.toFixed(2)}] (center: ${((minX+maxX)/2).toFixed(2)})`);
    console.log(`  Y: [${minY.toFixed(2)} .. ${maxY.toFixed(2)}] (height: ${(maxY - minY).toFixed(2)})`);
    console.log(`  Z: [${minZ.toFixed(2)} .. ${maxZ.toFixed(2)}] (center: ${((minZ+maxZ)/2).toFixed(2)})`);
}

main().catch(console.error);
