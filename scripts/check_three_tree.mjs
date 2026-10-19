import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import fs from 'fs';

// Read file into ArrayBuffer and load via GLTFLoader in node
const buffer = fs.readFileSync('dark_tree_-_dol_guldur.glb');
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);

    console.log('--- Direct Three.js Loader Bounding Box ---');
    const box = new THREE.Box3();
    
    // Check individual meshes
    scene.traverse((child) => {
        if (child.isMesh) {
            const b = new THREE.Box3().setFromObject(child);
            console.log(`Mesh "${child.name}":`);
            console.log(`   min: (${b.min.x.toFixed(2)}, ${b.min.y.toFixed(2)}, ${b.min.z.toFixed(2)})`);
            console.log(`   max: (${b.max.x.toFixed(2)}, ${b.max.y.toFixed(2)}, ${b.max.z.toFixed(2)})`);
            console.log(`   size: (${(b.max.x - b.min.x).toFixed(2)}, ${(b.max.y - b.min.y).toFixed(2)}, ${(b.max.z - b.min.z).toFixed(2)})`);
        }
    });

    // Remove Plane001_zemin_0
    const zemin = scene.getObjectByName('Plane001_zemin_0');
    if (zemin) {
        zemin.parent.remove(zemin);
    }
    const plane = scene.getObjectByName('Plane001');
    if (plane) {
        plane.parent.remove(plane);
    }

    scene.updateMatrixWorld(true);
    const treeBox = new THREE.Box3().setFromObject(scene);
    console.log('\nTree (without ground disc) in world space:');
    console.log(`   min: (${treeBox.min.x.toFixed(2)}, ${treeBox.min.y.toFixed(2)}, ${treeBox.min.z.toFixed(2)})`);
    console.log(`   max: (${treeBox.max.x.toFixed(2)}, ${treeBox.max.y.toFixed(2)}, ${treeBox.max.z.toFixed(2)})`);
    console.log(`   size: (${(treeBox.max.x - treeBox.min.x).toFixed(2)}, ${(treeBox.max.y - treeBox.min.y).toFixed(2)}, ${(treeBox.max.z - treeBox.min.z).toFixed(2)})`);
    console.log(`   Height (Y): ${(treeBox.max.y - treeBox.min.y).toFixed(2)}`);
}, (err) => console.error(err));
