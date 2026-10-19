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

    console.log('Inspecting current assets/models/minas_tirith.glb to find tree node...');
    const mergedDoc = await io.read('assets/models/minas_tirith.glb');
    const mergedRoot = mergedDoc.getRoot();
    
    for (const node of mergedRoot.listNodes()) {
        const name = node.getName();
        if (/tree|dol_guldur|white/i.test(name)) {
            console.log('Found Tree Node in merged model:', name);
            console.log('  Translation:', node.getTranslation());
            console.log('  Rotation:', node.getRotation());
            console.log('  Scale:', node.getScale());
        }
    }

    // Now inspect city unmerged model around Y=205
    const cityDoc = await io.read('minas_tirith.glb');
    const cityRoot = cityDoc.getRoot();

    // Find upward facing quads/triangles at Y=205 (normal ~ [0, 1, 0])
    // Or scan bounding box of vertices with Y between 204.9 and 205.1
    // Let's create a 2D density grid (X, Z) at Y=205 with 10x10 cell size
    const grid = {};
    for (const mesh of cityRoot.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
            const pos = prim.getAttribute('POSITION');
            if (!pos) continue;
            const arr = pos.getArray();
            for (let i = 0; i < arr.length; i += 3) {
                const x = arr[i], y = arr[i+1], z = arr[i+2];
                if (Math.abs(y - 205) < 0.2) {
                    const gx = Math.floor(x / 10) * 10;
                    const gz = Math.floor(z / 10) * 10;
                    const key = `${gx},${gz}`;
                    grid[key] = (grid[key] || 0) + 1;
                }
            }
        }
    }

    const sortedGrid = Object.entries(grid).sort((a,b) => b[1] - a[1]);
    console.log('\nTop dense 10x10 areas on floor Y=205:');
    for (const [cell, count] of sortedGrid.slice(0, 20)) {
        console.log(`  Cell [X, Z] = [${cell}]: ${count} vertices`);
    }

    // Also check the prow / ship-like outcropping (the famous keel of rock jutting out)
    // The prow usually points towards the front (Z or X direction).
    // Let's find min/max coordinates of the highest terrace
}

main().catch(console.error);
