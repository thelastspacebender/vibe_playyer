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

    console.log('Loading minas_tirith.glb (unmerged city)...');
    const doc = await io.read('minas_tirith.glb');
    const root = doc.getRoot();

    // Also inspect tree
    console.log('Loading dark_tree_-_dol_guldur.glb...');
    const treeDoc = await io.read('dark_tree_-_dol_guldur.glb');
    const treeRoot = treeDoc.getRoot();
    
    console.log('Tree animations:');
    for (const anim of treeRoot.listAnimations()) {
        console.log(' - Anim:', anim.getName(), 'channels:', anim.listChannels().length);
    }

    // Inspect tree bounding box
    let tMinY = Infinity, tMaxY = -Infinity, tMinX = Infinity, tMaxX = -Infinity, tMinZ = Infinity, tMaxZ = -Infinity;
    for (const mesh of treeRoot.listMeshes()) {
        console.log(' Tree Mesh:', mesh.getName());
        for (const prim of mesh.listPrimitives()) {
            const pos = prim.getAttribute('POSITION');
            if (!pos) continue;
            const arr = pos.getArray();
            for (let i = 0; i < arr.length; i += 3) {
                const x = arr[i], y = arr[i+1], z = arr[i+2];
                if (x < tMinX) tMinX = x; if (x > tMaxX) tMaxX = x;
                if (y < tMinY) tMinY = y; if (y > tMaxY) tMaxY = y;
                if (z < tMinZ) tMinZ = z; if (z > tMaxZ) tMaxZ = z;
            }
        }
    }
    console.log('Tree Bounds:', { tMinX, tMaxX, tMinY, tMaxY, tMinZ, tMaxZ });

    // Look at city vertical slices near Y > 150
    // Group vertices by Y rounded to integer
    const yHist = {};
    for (const mesh of root.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
            const pos = prim.getAttribute('POSITION');
            if (!pos) continue;
            const arr = pos.getArray();
            for (let i = 0; i < arr.length; i += 3) {
                const y = Math.round(arr[i+1]);
                if (y >= 150) {
                    yHist[y] = (yHist[y] || 0) + 1;
                }
            }
        }
    }

    const sortedY = Object.entries(yHist).sort((a,b) => b[1] - a[1]);
    console.log('Top Y levels above 150 (vertex count):', sortedY.slice(0, 15));

    // Specifically inspect level Y around 205 and Y around 167
    for (const targetY of [161, 167, 169, 204, 205, 206]) {
        let count = 0, sumX = 0, sumZ = 0;
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const mesh of root.listMeshes()) {
            for (const prim of mesh.listPrimitives()) {
                const pos = prim.getAttribute('POSITION');
                if (!pos) continue;
                const arr = pos.getArray();
                for (let i = 0; i < arr.length; i += 3) {
                    const x = arr[i], y = arr[i+1], z = arr[i+2];
                    if (Math.abs(y - targetY) < 0.5) {
                        count++;
                        sumX += x;
                        sumZ += z;
                        if (x < minX) minX = x; if (x > maxX) maxX = x;
                        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
                    }
                }
            }
        }
        if (count > 0) {
            console.log(`Level Y=${targetY}: count=${count}, center=(${(sumX/count).toFixed(2)}, ${(sumZ/count).toFixed(2)}), bounds=[${minX.toFixed(1)}..${maxX.toFixed(1)}, ${minZ.toFixed(1)}..${maxZ.toFixed(1)}]`);
        }
    }
}

main().catch(console.error);
