// js/world3d/hogwarts.js - Harry Potter: Gryffindor Common Room & Dumbledore's Office
// Features: 7x3x7 6-ray interior space detection, 60% safe radius camera paths, and balanced cinematic lighting

import * as THREE from 'three';
import { loadOptimizedGLB, disposeObject3D, setSpline, currentTarget } from './core3d.js';
import { t } from '../i18n.js';

let hpGroup = null;
let activeRoomModel = null;
let currentRoom = 'gryffindor'; // 'gryffindor' | 'dumbledore'
let isAutoSwitch = true;
let switchTimer = 0;
const SWITCH_INTERVAL = 45.0; // 45s auto-switch
let isFading = false;

// Lights
let gryffLight1, gryffLight2, dumbLight1, dumbLight2;

// Dynamic Splines
let activeCamCurve = null, activeTargetCurve = null;

// UI
let panelEl, gryffBtn, dumbBtn, autoBtn, progressBar;
let fadeOverlayEl;
let setCoreSpline = null;

export let cameraSpeed = 0.015;

export function mount({ scene, camera, renderer, showLoading, hideLoading, updateLoadingProgress, setSpline: splineSetter }) {
    setCoreSpline = splineSetter;
    camera.near = 0.1;
    camera.far = 120.0;
    camera.updateProjectionMatrix();

    if (renderer) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.95; // TASK 1.2
    }

    camera.position.set(0, 1.5, 3.5);
    camera.up.set(0, 1, 0);
    currentTarget.set(0, 1.0, 0);
    camera.lookAt(currentTarget);

    scene.background = new THREE.Color(0x060810);
    scene.fog = new THREE.FogExp2(0x060810, 0.008);

    if (!hpGroup) {
        hpGroup = new THREE.Group();
        initLights();
    }
    scene.add(hpGroup);
    hpGroup.visible = true;

    wireUI();
    fadeOverlayEl = document.getElementById('scene-fade-overlay');

    // TASK 6.2: Load ONLY ONE active room into RAM at a time!
    loadRoom(currentRoom, showLoading, hideLoading, updateLoadingProgress);
}

function loadRoom(roomKey, showLoading, hideLoading, updateLoadingProgress) {
    if (activeRoomModel) {
        disposeObject3D(activeRoomModel);
        activeRoomModel = null;
    }

    const isGryff = (roomKey === 'gryffindor');
    const file = isGryff ? 'assets/models/gryffindor_common_room.glb' : 'assets/models/dumbledores_office.glb';
    const title = isGryff ? t('loading_hp_gryff') : t('loading_hp_dumb');

    if (showLoading) showLoading(title);

    loadOptimizedGLB(file, (xhr) => {
        if (xhr.lengthComputable && updateLoadingProgress) {
            updateLoadingProgress((xhr.loaded / xhr.total) * 100);
        }
    }).then((gltf) => {
        activeRoomModel = gltf.scene;

        // TASK 3.1: Scale room to 12.0 units
        normalizeModel(activeRoomModel, 12.0);
        hpGroup.add(activeRoomModel);

        // TASK 3.1 & 3.2: Find true open interior space using 7x3x7 6-ray test
        const openSpace = findOpenInteriorSpace(activeRoomModel);
        const { camCurve, targetCurve } = buildRoomSpline(openSpace);
        activeCamCurve = camCurve;
        activeTargetCurve = targetCurve;

        applyRoomState(roomKey);
        if (hideLoading) hideLoading();
    }).catch(err => {
        console.error('Failed to load Hogwarts room:', file, err);
        if (hideLoading) hideLoading();
    });
}

// TASK 3.1: 7x3x7 Raycast scan to locate true interior free space
function findOpenInteriorSpace(roomModel) {
    roomModel.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(roomModel);
    const size = box.getSize(new THREE.Vector3());
    const min = box.min;

    const roomMeshes = [];
    roomModel.traverse((child) => {
        if (child.isMesh) {
            roomMeshes.push(child);
            child.receiveShadow = true;
            child.castShadow = false; // Prevent ceiling from blacking out room
            // TASK 1.4: Prevent blown-out emissive glow across walls, desks, robes
            if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    if (/godray|pk_hagridhut_godrays/i.test(`${child.name} ${mat.name}`)) {
                        child.visible = false;
                    }
                    if (!/candle|flame|lamp|fire|lantern/i.test(`${child.name} ${mat.name}`)) {
                        mat.emissiveIntensity = 0;
                        if (mat.emissive) mat.emissive.setRGB(0, 0, 0);
                    } else {
                        mat.emissiveIntensity = 0.3;
                    }
                    mat.roughness = Math.max(0.72, mat.roughness ?? 0.72);
                });
            }
        }
    });

    const raycaster = new THREE.Raycaster();
    const dirs = [
        new THREE.Vector3(1, 0, 0),  // +X
        new THREE.Vector3(-1, 0, 0), // -X
        new THREE.Vector3(0, 0, 1),  // +Z
        new THREE.Vector3(0, 0, -1), // -Z
        new THREE.Vector3(0, 1, 0),  // +Y (ceiling)
        new THREE.Vector3(0, -1, 0)  // -Y (floor)
    ];

    let bestPoint = null;
    let bestScore = -Infinity;
    let bestMinWallDist = 0;

    const GRID_X = 7;
    const GRID_Y = 3;
    const GRID_Z = 7;

    for (let ix = 1; ix < GRID_X; ix++) {
        const px = min.x + (size.x * ix) / GRID_X;
        for (let iy = 1; iy <= GRID_Y; iy++) {
            const py = min.y + (size.y * iy) / (GRID_Y + 1);
            for (let iz = 1; iz < GRID_Z; iz++) {
                const pz = min.z + (size.z * iz) / GRID_Z;
                const probe = new THREE.Vector3(px, py, pz);

                // a) Ray downwards to floor
                raycaster.set(probe, dirs[5]);
                const floorHits = raycaster.intersectObjects(roomMeshes, false);
                if (floorHits.length === 0) continue;
                const floorDist = floorHits[0].distance;
                if (floorDist < 0.6 || floorDist > 2.8) continue;

                // b) Ray upwards to ceiling (proves probe is inside the room)
                raycaster.set(probe, dirs[4]);
                const ceilHits = raycaster.intersectObjects(roomMeshes, false);
                if (ceilHits.length === 0) continue;

                // c) Horizontal clearance (+X, -X, +Z, -Z)
                let wallDistSum = 0;
                let minWallDist = Infinity;
                let hitAllWalls = true;

                for (let d = 0; d < 4; d++) {
                    raycaster.set(probe, dirs[d]);
                    const wallHits = raycaster.intersectObjects(roomMeshes, false);
                    if (wallHits.length === 0) {
                        hitAllWalls = false;
                        break;
                    }
                    const dist = wallHits[0].distance;
                    if (dist < 0.6) {
                        hitAllWalls = false;
                        break;
                    }
                    wallDistSum += dist;
                    if (dist < minWallDist) minWallDist = dist;
                }

                if (!hitAllWalls) continue;

                const score = wallDistSum + minWallDist * 2.5;
                if (score > bestScore) {
                    bestScore = score;
                    bestPoint = probe.clone();
                    bestMinWallDist = minWallDist;
                }
            }
        }
    }

    if (!bestPoint) {
        const center = box.getCenter(new THREE.Vector3());
        bestPoint = new THREE.Vector3(center.x, box.min.y + 1.4, center.z);
        bestMinWallDist = 2.0;
    }

    const safeRadius = Math.max(0.9, Math.min(3.2, bestMinWallDist * 0.6));
    console.log(`Hogwarts open interior found: center=(${bestPoint.x.toFixed(2)}, ${bestPoint.y.toFixed(2)}, ${bestPoint.z.toFixed(2)}), safeRadius=${safeRadius.toFixed(2)}`);
    return { center: bestPoint, safeRadius };
}

// TASK 3.2: Orbit inside safe 60% clear radius
function buildRoomSpline(openSpace) {
    const { center, safeRadius } = openSpace;
    const camPoints = [];
    const targetPoints = [];
    const steps = 6;

    for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const cx = center.x + Math.sin(angle) * safeRadius;
        const cz = center.z + Math.cos(angle) * safeRadius;
        const cy = center.y + 0.15 + Math.sin(angle * 2.0) * 0.15;
        camPoints.push(new THREE.Vector3(cx, cy, cz));

        const tx = center.x - Math.sin(angle) * (safeRadius * 0.3);
        const tz = center.z - Math.cos(angle) * (safeRadius * 0.3);
        const ty = center.y - 0.1;
        targetPoints.push(new THREE.Vector3(tx, ty, tz));
    }

    const cCurve = new THREE.CatmullRomCurve3(camPoints, true, 'centripetal');
    const tCurve = new THREE.CatmullRomCurve3(targetPoints, true, 'centripetal');
    return { camCurve: cCurve, targetCurve: tCurve };
}

function applyRoomState(targetRoom) {
    currentRoom = targetRoom;
    if (gryffBtn && dumbBtn) {
        gryffBtn.classList.toggle('active', targetRoom === 'gryffindor');
        dumbBtn.classList.toggle('active', targetRoom === 'dumbledore');
    }

    const isGryff = (targetRoom === 'gryffindor');
    if (gryffLight1) gryffLight1.visible = isGryff;
    if (gryffLight2) gryffLight2.visible = isGryff;
    if (dumbLight1) dumbLight1.visible = !isGryff;
    if (dumbLight2) dumbLight2.visible = !isGryff;

    if (setCoreSpline && activeCamCurve && activeTargetCurve) {
        setCoreSpline(activeCamCurve, activeTargetCurve);
    } else if (activeCamCurve && activeTargetCurve) {
        setSpline(activeCamCurve, activeTargetCurve);
    }
}

export function unmount({ scene }) {
    if (hpGroup) {
        hpGroup.visible = false;
        scene.remove(hpGroup);
    }
    if (activeRoomModel) {
        disposeObject3D(activeRoomModel);
        activeRoomModel = null;
    }
    hpGroup = null;
    if (panelEl) panelEl.style.display = 'none';
}

export function update(dt, t, audio) {
    if (!hpGroup || !hpGroup.visible) return;

    // 45s Auto-Switch Timer
    if (isAutoSwitch && !isFading && activeRoomModel) {
        switchTimer += dt;
        if (progressBar) {
            const pct = (switchTimer / SWITCH_INTERVAL) * 100;
            progressBar.style.width = Math.min(100, pct) + '%';
        }
        if (switchTimer >= SWITCH_INTERVAL) {
            switchRoom(currentRoom === 'gryffindor' ? 'dumbledore' : 'gryffindor', true);
        }
    }

    // TASK 1.3: Dynamic Atmospheric Audio Lighting clamped to 1.8 max
    if (currentRoom === 'gryffindor') {
        if (gryffLight1 && gryffLight2) {
            const flicker = Math.sin(t * 10.0) * 0.1 + (audio.bass || 0) * 0.25;
            gryffLight1.intensity = Math.min(1.4, 1.1 + flicker);
            gryffLight2.intensity = Math.min(0.7, 0.5 + (audio.highs || 0) * 0.2);
        }
    } else {
        if (dumbLight1 && dumbLight2) {
            dumbLight1.intensity = Math.min(0.55, 0.4 + (audio.highs || 0) * 0.15);
            dumbLight2.intensity = Math.min(0.45, 0.35 + (audio.bass || 0) * 0.1);
        }
    }
}

// TASK 1.3: Balanced non-blinding light sources
function initLights() {
    const amb = new THREE.AmbientLight(0xffeedd, 0.18);
    hpGroup.add(amb);

    gryffLight1 = new THREE.PointLight(0xff7722, 1.1, 16, 1.2);
    gryffLight1.position.set(-2.0, 0.5, -1.0);
    hpGroup.add(gryffLight1);

    gryffLight2 = new THREE.PointLight(0xffaa44, 0.5, 12, 1.2);
    gryffLight2.position.set(1.5, 1.0, 0.5);
    hpGroup.add(gryffLight2);

    dumbLight1 = new THREE.PointLight(0x88ccff, 0.4, 16, 1.2);
    dumbLight1.position.set(0, 2.5, 0);
    dumbLight1.visible = false;
    hpGroup.add(dumbLight1);

    dumbLight2 = new THREE.PointLight(0xffcc88, 0.35, 12, 1.2);
    dumbLight2.position.set(-1.8, 0.8, 1.5);
    dumbLight2.visible = false;
    hpGroup.add(dumbLight2);
}

function wireUI() {
    panelEl = document.getElementById('hp-panel');
    if (panelEl) panelEl.style.display = 'block';

    gryffBtn = document.getElementById('hpGryffBtn');
    dumbBtn = document.getElementById('hpDumbBtn');
    autoBtn = document.getElementById('hpAutoBtn');
    progressBar = document.getElementById('hpProgressBar');

    if (gryffBtn) gryffBtn.onclick = () => switchRoom('gryffindor', false);
    if (dumbBtn) dumbBtn.onclick = () => switchRoom('dumbledore', false);
    if (autoBtn) {
        autoBtn.onclick = () => {
            isAutoSwitch = !isAutoSwitch;
            autoBtn.classList.toggle('active', isAutoSwitch);
            if (!isAutoSwitch && progressBar) progressBar.style.width = '0%';
        };
    }
}

export function switchRoom(targetRoom, withFade = true) {
    if (targetRoom === currentRoom && activeRoomModel) return;
    switchTimer = 0;
    if (progressBar) progressBar.style.width = '0%';

    if (withFade && fadeOverlayEl) {
        isFading = true;
        fadeOverlayEl.style.opacity = '1';
        setTimeout(() => {
            loadRoom(targetRoom, null, null, null);
            setTimeout(() => {
                fadeOverlayEl.style.opacity = '0';
                isFading = false;
            }, 300);
        }, 500);
    } else {
        loadRoom(targetRoom, null, null, null);
    }
}

function normalizeModel(model, targetMaxDim = 12.0) {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.z) || 1;
    model.scale.setScalar(targetMaxDim / maxDim);
    model.updateMatrixWorld(true);

    const sBox = new THREE.Box3().setFromObject(model);
    const center = sBox.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -sBox.min.y, -center.z);
    model.updateMatrixWorld(true);
}
