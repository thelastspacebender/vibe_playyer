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

    const doc = await io.read('minas_tirith.glb');
    const root = doc.getRoot();

    // Look at meshes near [431.6, 392.7] at Y in [200..210]
    let points = [];
    for (const mesh of root.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
            const pos = prim.getAttribute('POSITION');
            const col = prim.getAttribute('COLOR_0');
            if (!pos) continue;
            const pArr = pos.getArray();
            const cArr = col ? col.getArray() : null;

            for (let i = 0; i < pArr.length; i += 3) {
                const x = pArr[i], y = pArr[i+1], z = pArr[i+2];
                if (Math.abs(x - 431.6) < 15.0 && Math.abs(z - 392.7) < 15.0 && y >= 203 && y <= 208) {
                    points.push({
                        x: x.toFixed(2),
                        y: y.toFixed(2),
                        z: z.toFixed(2),
                        color: cArr ? [cArr[i].toFixed(2), cArr[i+1].toFixed(2), cArr[i+2].toFixed(2)] : 'none'
                    });
                }
            }
        }
    }

    console.log(`Found ${points.length} vertices in courtyard area [431.6 +- 15, 392.7 +- 15, Y=203..208]`);
    
    // Sample a few points
    const yValues = {};
    for (const p of points) {
        yValues[p.y] = (yValues[p.y] || 0) + 1;
    }
    console.log('Y distribution:', yValues);

    // Let's find min/max X and Z of the level 205 floor around this area
    let minX=Infinity, maxX=-Infinity, minZ=Infinity, maxZ=-Infinity;
    for (const p of points) {
        if (Math.abs(p.y - 205.0) < 0.2) {
            const x = parseFloat(p.x), z = parseFloat(p.z);
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }
    }
    console.log(`Courtyard level Y=205.0 bounds: X[${minX}..${maxX}], Z[${minZ}..${maxZ}]`);
    console.log(`Courtyard center: X=${((minX+maxX)/2).toFixed(2)}, Z=${((minZ+maxZ)/2).toFixed(2)}`);
}

main().catch(console.error);
