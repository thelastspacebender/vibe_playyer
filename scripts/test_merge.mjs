import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments } from '@gltf-transform/functions';
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

    console.log('Reading city...');
    const cityDoc = await io.read('minas_tirith.glb');
    console.log('Reading tree...');
    const treeDoc = await io.read('dark_tree_-_dol_guldur.glb');

    // In treeDoc, remove Plane001 and Plane001_zemin_0
    const treeRoot = treeDoc.getRoot();
    for (const node of treeRoot.listNodes()) {
        if (/zemin|plane/i.test(node.getName())) {
            console.log('Disposing node:', node.getName());
            node.dispose();
        }
    }
    for (const mesh of treeRoot.listMeshes()) {
        if (/zemin|plane/i.test(mesh.getName())) {
            console.log('Disposing mesh:', mesh.getName());
            mesh.dispose();
        }
    }

    // Merge documents
    mergeDocuments(cityDoc, treeDoc);

    const mergedRoot = cityDoc.getRoot();
    const cityScene = mergedRoot.listScenes()[0];

    console.log('Merged scenes count:', mergedRoot.listScenes().length);
    console.log('Merged animations count:', mergedRoot.listAnimations().length);
    for (const a of mergedRoot.listAnimations()) {
        console.log('  Animation:', a.getName(), 'channels:', a.listChannels().length);
    }
    console.log('Merged skins count:', mergedRoot.listSkins().length);
    for (const s of mergedRoot.listSkins()) {
        console.log('  Skin:', s.getName(), 'joints:', s.listJoints().length);
    }

    // Find the merged tree node and attach it to cityScene
    let treeContainer = null;
    for (const node of mergedRoot.listNodes()) {
        if (node.getName() === 'Sketchfab_model') {
            treeContainer = node;
            break;
        }
    }

    if (treeContainer) {
        console.log('Found treeContainer:', treeContainer.getName());
        treeContainer.setName('WhiteTreeOfGondor');
        // Set exact position at Court of the Fountain level Y=205.0!
        treeContainer.setTranslation([431.5, 205.0, 392.5]);
        console.log('Current treeContainer local rot:', treeContainer.getRotation());
        treeContainer.setScale([0.28, 0.28, 0.28]);

        // Attach to cityScene if not attached
        cityScene.addChild(treeContainer);
        console.log('Tree successfully attached to city scene at Y=205.0!');
    }
}

main().catch(console.error);
