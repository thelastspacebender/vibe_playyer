import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

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

    console.log('--- Tree Scenes & Nodes ---');
    for (const scene of treeRoot.listScenes()) {
        console.log('Scene:', scene.getName());
        for (const child of scene.listChildren()) {
            printNode(child, 1);
        }
    }

    console.log('\n--- Tree Skins ---');
    for (const skin of treeRoot.listSkins()) {
        console.log('Skin:', skin.getName(), 'joints count:', skin.listJoints().length);
    }
}

function printNode(node, depth) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}Node: "${node.getName()}", mesh: ${node.getMesh() ? node.getMesh().getName() : 'none'}, skin: ${node.getSkin() ? node.getSkin().getName() : 'none'}, t: ${JSON.stringify(node.getTranslation())}, r: ${JSON.stringify(node.getRotation())}, s: ${JSON.stringify(node.getScale())}`);
    for (const child of node.listChildren()) {
        printNode(child, depth + 1);
    }
}

main().catch(console.error);
