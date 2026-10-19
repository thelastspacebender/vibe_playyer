// js/world3d/yennefer.js - Kaer Morhen: Yennefer Chamber & Magical Bathtub
// Uses authentic baked skeletal animations from room.glb for realistic fireplace flames & bath bubbles

import * as THREE from 'three';
import { occluderMeshes, updateOcclusion, loadOptimizedGLB, disposeObject3D, currentTarget } from './core3d.js';
import { t } from '../i18n.js';

let roomGroup = null;
let currentModel = null;
let mixer = null;
let candleLight, magicLight, moonLight;

const yenHeadPos = new THREE.Vector3(-1.19, -1.16, 1.64);
const firePos = new THREE.Vector3(-3.58, -1.37, 1.92);
const unicornPos = new THREE.Vector3(-2.72, -0.91, 1.35);

let magicBurst = 0;
let camCurve = null, targetCurve = null;
export let cameraSpeed = 0.015;

// Slow down camera 3.5x when in Yennefer tub zone (progress 0.28 - 0.82)
export function getCameraSpeed(progress) {
    if (progress >= 0.28 && progress <= 0.82) {
        return 0.0042; // Drifts gently around Yennefer
    }
    return 0.016; // Normal traveling speed for fireplace and room overview
}

export function mount({ scene, camera, renderer, showLoading, hideLoading, updateLoadingProgress, setSpline }) {
    camera.near = 0.1;
    camera.far = 100.0;
    camera.updateProjectionMatrix();

    if (renderer) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.95;
    }

    camera.position.set(-1.45, -0.45, 0.45);
    camera.up.set(0, 1, 0);
    currentTarget.set(-2.2, -1.05, 1.6);
    camera.lookAt(currentTarget);

    if (!roomGroup) {
        roomGroup = new THREE.Group();
        initLights();
    }
    scene.add(roomGroup);
    roomGroup.visible = true;

    if (!currentModel) {
        showLoading(t('loading_yennefer'));
        loadOptimizedGLB('assets/models/room.glb', (xhr) => {
            if (xhr.lengthComputable) updateLoadingProgress((xhr.loaded / xhr.total) * 100);
        }).then((gltf) => {
            const model = gltf.scene;
            normalizeRoom(model);
            setupOccluders(model);

            // Activate built-in model animations for fire flames and bath bubbles
            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(model);
                gltf.animations.forEach((clip) => {
                    const action = mixer.clipAction(clip);
                    action.setLoop(THREE.LoopRepeat);
                    action.play();
                });
                console.log(`Yennefer room built-in animations activated (${gltf.animations.length} clips): fire & bath bubbles`);
            }

            roomGroup.add(model);
            currentModel = model;
            buildSplines();
            setSpline(camCurve, targetCurve);
            hideLoading();
        }).catch(err => {
            console.error('Failed to load room.glb', err);
            hideLoading();
        });
    } else {
        buildSplines();
        setSpline(camCurve, targetCurve);
    }
}

export function unmount({ scene }) {
    if (mixer) {
        mixer.stopAllAction();
        mixer = null;
    }
    if (roomGroup) {
        roomGroup.visible = false;
        scene.remove(roomGroup);
        disposeObject3D(currentModel);
        currentModel = null;
        roomGroup = null;
    }
}

export function update(dt, t, audio) {
    if (!roomGroup || !roomGroup.visible) return;

    // Update built-in fire & bath animations
    if (mixer) {
        mixer.update(dt);
    }

    // Atmospheric fireplace flickering & audio reactivity
    if (candleLight) {
        const flicker = Math.sin(t * 11) * 0.1 + Math.sin(t * 23.3) * 0.05;
        candleLight.intensity = Math.min(1.8, 1.4 + flicker + (audio.bass || 0) * 0.3);
    }

    if (magicLight) {
        if (magicBurst > 0) {
            magicLight.intensity = 1.6 + magicBurst;
            magicBurst = Math.max(0, magicBurst - dt * 10.0);
        } else {
            magicLight.intensity = Math.min(1.6, 1.2 + (audio.highs || 0) * 0.35);
        }
    }

    updateOcclusion(dt);
}

// Balanced candlelight, moonlight, and magic glow
function initLights() {
    const amb = new THREE.AmbientLight(0xffffff, 0.45);
    roomGroup.add(amb);

    candleLight = new THREE.PointLight(0xff9944, 1.5, 12, 1.2);
    candleLight.position.set(-3.58, -0.9, 1.92);
    candleLight.castShadow = true;
    roomGroup.add(candleLight);

    magicLight = new THREE.PointLight(0xb866ff, 1.2, 10, 1.2);
    magicLight.position.set(-1.19, -0.6, 1.63);
    roomGroup.add(magicLight);

    moonLight = new THREE.DirectionalLight(0x88aaee, 0.7);
    moonLight.position.set(4.5, 5.0, 3.5);
    moonLight.castShadow = true;
    roomGroup.add(moonLight);
}

function normalizeRoom(model) {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3();
    model.traverse(c => {
        if (c.isMesh && c.name !== 'Object_7') {
            const b = new THREE.Box3().setFromObject(c);
            const s = b.getSize(new THREE.Vector3());
            if (s.x < 55 && s.y < 55 && s.z < 55) box.union(b);
        }
    });
    const size = box.getSize(new THREE.Vector3());
    const scale = 10.0 / (Math.max(size.x, size.y, size.z) || 1);
    model.scale.setScalar(scale);

    model.updateMatrixWorld(true);
    const sBox = new THREE.Box3();
    model.traverse(c => {
        if (c.isMesh && c.name !== 'Object_7') {
            const b = new THREE.Box3().setFromObject(c);
            const s = b.getSize(new THREE.Vector3());
            if (s.x < 55 && s.y < 55 && s.z < 55) sBox.union(b);
        }
    });
    const center = sBox.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -center.y, -center.z);
    model.updateMatrixWorld(true);
}

function setupOccluders(model) {
    occluderMeshes.length = 0;
    model.traverse(obj => {
        if (!obj.isMesh) return;
        obj.receiveShadow = true;
        obj.castShadow = !/ceiling|roof/i.test(obj.name || '');
        const fullName = `${obj.name || ''} ${obj.parent ? obj.parent.name : ''} ${obj.material ? obj.material.name : ''}`.toLowerCase();
        const isProtected = /yennefer|augen|haare|hair|bath|tub|bubble|fire|feuer|object_7\b/i.test(fullName);

        if (obj.material && !isProtected) {
            occluderMeshes.push(obj);
        }
    });
}

// 65% of camera traveling cycle devoted to Yennefer in tub
function buildSplines() {
    const camPoints = [
        new THREE.Vector3(-1.45, -0.45, 0.45), // 0: Room Overview (fast)
        new THREE.Vector3(-3.25, -1.05, 0.85), // 1: Fireplace close-up
        new THREE.Vector3(-2.05, -0.70, 0.75), // 2: Unicorn portrait
        new THREE.Vector3(-0.65, -0.90, 0.85), // 3: YENNEFER PORTRAIT (Clean front angle - SLOW)
        new THREE.Vector3(-0.85, -0.95, 1.15), // 4: YENNEFER PROFILE (Close across water - SLOW)
        new THREE.Vector3(-1.45, -0.75, 1.35), // 5: YENNEFER SOFT HIGH-ANGLE (Looking into tub - SLOW)
        new THREE.Vector3(-1.15, -0.85, 0.95), // 6: YENNEFER INTIMATE FRONT (Gazing at face - SLOW)
        new THREE.Vector3(-0.95, -0.65, 0.65)  // 7: Return via chamber center
    ];

    const targetPoints = [
        new THREE.Vector3(-2.2, -1.05, 1.6),
        firePos.clone(),
        unicornPos.clone(),
        yenHeadPos.clone(),
        yenHeadPos.clone(),
        yenHeadPos.clone(),
        yenHeadPos.clone(),
        new THREE.Vector3(-1.8, -1.15, 1.5)
    ];

    camCurve = new THREE.CatmullRomCurve3(camPoints, true, 'centripetal');
    targetCurve = new THREE.CatmullRomCurve3(targetPoints, true, 'centripetal');
}

