import fs from 'fs';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, draco, prune } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

async function bake() {
    console.log('================================================================');
    console.log('   PERMANENT BAKE: MINAS TIRITH (NO OLD TREE, SOLID FLOOR)      ');
    console.log('================================================================');

    const encoder = await draco3d.createEncoderModule();
    const decoder = await draco3d.createDecoderModule();
    const io = new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
            'draco3d.decoder': decoder,
            'draco3d.encoder': encoder,
        });

    let citySourcePath = 'assets/models/backup/minas_tirith.glb';
    if (!fs.existsSync(citySourcePath)) {
        citySourcePath = 'minas_tirith.glb';
    }

    console.log(`1. Reading original clean city (${citySourcePath})...`);
    const cityDoc = await io.read(citySourcePath);
    const cityRoot = cityDoc.getRoot();

    console.log('2. Removing old Minecraft block tree from courtyard...');
    let removedTreeVerts = 0;
    for (const mesh of cityRoot.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
            const pos = prim.getAttribute('POSITION');
            if (pos) {
                const arr = pos.getArray();
                for (let i = 0; i < arr.length; i += 3) {
                    const x = arr[i], y = arr[i+1], z = arr[i+2];
                    // Old Minecraft block tree is inside [420..442], Z[381..405] above floor level Y > 205.2:
                    if (x >= 420 && x <= 442 && z >= 381 && z <= 405 && y > 205.2 && y < 225.0) {
                        arr[i+1] = 205.0; // Collapse onto floor level so old block tree is completely gone
                        removedTreeVerts++;
                    }
                }
            }
        }
    }
    console.log(`   Removed ${removedTreeVerts} vertices of the old Minecraft tree.`);

    console.log('3. Fixing zero-alpha bug in Minecraft COLOR_0 attributes...');
    let fixedAlphaCount = 0;
    for (const mesh of cityRoot.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
            const col = prim.getAttribute('COLOR_0');
            if (col && col.getElementSize() === 4) {
                const arr = col.getArray();
                for (let i = 3; i < arr.length; i += 4) {
                    if (arr[i] < 0.9) {
                        arr[i] = 1.0;
                        fixedAlphaCount++;
                    }
                }
            }
            // Ensure city materials are not discarding floor pixels
            const mat = prim.getMaterial();
            if (mat && (mat.getAlphaMode() === 'MASK' || mat.getAlphaMode() === 'BLEND')) {
                mat.setAlphaMode('OPAQUE');
            }
        }
    }
    console.log(`   Fixed ${fixedAlphaCount} vertex alphas to 1.0 (no more transparent floor).`);

    console.log('4. Reading 3D White Tree model (dark_tree_-_dol_guldur.glb)...');
    let treeSourcePath = 'assets/models/dark_tree_-_dol_guldur.glb';
    if (!fs.existsSync(treeSourcePath)) {
        treeSourcePath = 'dark_tree_-_dol_guldur.glb';
    }
    const treeDoc = await io.read(treeSourcePath);
    const treeRoot = treeDoc.getRoot();

    // Dispose ground disc
    for (const node of treeRoot.listNodes()) {
        if (/zemin|plane/i.test(node.getName())) node.dispose();
    }
    for (const mesh of treeRoot.listMeshes()) {
        if (/zemin|plane/i.test(mesh.getName())) mesh.dispose();
    }

    const treeScene = treeRoot.listScenes()[0];
    const treeTop = treeScene.listChildren()[0];
    treeTop.setName('WhiteTreeOfGondor');
    treeScene.setName('TreeScene');

    console.log('5. Merging 3D White Tree into city document...');
    mergeDocuments(cityDoc, treeDoc);

    const mergedRoot = cityDoc.getRoot();
    const mainScene = mergedRoot.listScenes().find(s => s.getName() === 'Sketchfab_Scene');
    const mergedTreeScene = mergedRoot.listScenes().find(s => s.getName() === 'TreeScene');

    const treeNode = mergedRoot.listNodes().find(n => n.getName() === 'WhiteTreeOfGondor');
    if (!treeNode) throw new Error('WhiteTreeOfGondor node not found after merge!');

    // Place White Tree directly in Court of the Fountain center:
    treeNode.setTranslation([431.0, 205.0, 393.0]);
    treeNode.setRotation([-0.7071067811865475, 0, 0, 0.7071067811865476]);
    treeNode.setScale([0.28, 0.28, 0.28]);

    mergedTreeScene.removeChild(treeNode);
    mainScene.addChild(treeNode);
    mergedTreeScene.dispose();

    console.log('6. Consolidating binary buffers into single GLB buffer...');
    const buffers = mergedRoot.listBuffers();
    const primaryBuffer = buffers[0];
    for (let i = 1; i < buffers.length; i++) {
        const extraBuffer = buffers[i];
        for (const acc of mergedRoot.listAccessors()) {
            if (acc.getBuffer() === extraBuffer) {
                acc.setBuffer(primaryBuffer);
            }
        }
        extraBuffer.dispose();
    }

    console.log('7. Pruning and compressing with Draco (preserving Minecraft COLOR_0)...');
    await cityDoc.transform(
        prune(),
        draco({
            encoder: encoder,
            decoder: decoder,
            method: 'edgebreaker',
            quantizePosition: 14,
            quantizeNormal: 10,
            quantizeTexcoord: 12,
            quantizeColor: 8
        })
    );

    const outPath = path.resolve('assets/models/minas_tirith.glb');
    console.log(`8. Writing baked model to ${outPath}...`);
    await io.write(outPath, cityDoc);

    const stats = fs.statSync(outPath);
    console.log(`=== BAKE COMPLETE: ${(stats.size / (1024 * 1024)).toFixed(2)} MB ===`);
}

bake().catch(err => {
    console.error('Fatal bake error:', err);
    process.exit(1);
});
