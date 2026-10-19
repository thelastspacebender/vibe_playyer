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

    const doc = await io.read('assets/models/minas_tirith.glb');
    const root = doc.getRoot();

    for (const node of root.listNodes()) {
        if (/tree|gondor/i.test(node.getName())) {
            printNode(node, 0);
        }
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
