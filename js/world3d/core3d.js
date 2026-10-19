// js/world3d/core3d.js - Universal Three.js Core, Memory Management & X-Ray Occlusion

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { t } from '../i18n.js';

export let container, scene, camera, renderer, composer, controls, bloomPass;
export let isInitialized = false;
export let isVisible = false;
export let isAutoTraveling = true;
export let userInactiveTimer = 0;
export const INACTIVITY_THRESHOLD = 15.0; // 15s inactivity resume

export const currentTarget = new THREE.Vector3(0, 0, 0);
export let activeCamCurve = null;
export let activeTargetCurve = null;
export let travelingProgress = 0;

export const worldsMap = new Map();
export let currentWorldModule = null;
export let activeWorldName = '';

// 100% Offline Local Draco GLTF Loader
THREE.Cache.enabled = false;
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('./libs/draco/');
export const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

// UI & Memory HUD Elements
let mafiaBadgeEl, mafiaBtnEl, mafiaDotEl, mafiaTextEl;
let fadeOverlayEl, loadingScreenEl, loadingTitleEl, loadingBarEl, loadingPctEl;
let memoryHudEl = null;
let coreEventsBound = false;

// TASK 3: Lazy X-Ray Occlusion
export const occluderMeshes = [];
const occlusionRaycaster = new THREE.Raycaster();
const occludingHitSet = new Set();
let occlusionTimer = 0;
const _coneOffsets = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.25, 0, 0),
    new THREE.Vector3(-0.25, 0, 0),
    new THREE.Vector3(0, 0.25, 0),
    new THREE.Vector3(0, -0.25, 0)
];

const TEXTURE_KEYS = [
    'map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap',
    'envMap', 'alphaMap', 'aoMap', 'displacementMap',
    'emissiveMap', 'metalnessMap', 'roughnessMap'
];

export function initCore3D(containerEl) {
    if (isInitialized) return;
    container = containerEl;
    if (!container) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(-1.45, -0.45, 0.45);

    // TASK 5: APU / iGPU WebGLRenderer optimization (1.25 pixel ratio)
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.08).texture;
    pmrem.dispose();

    // Balanced global ambient base lighting to ensure natural shadows and contrast
    const globalAmbient = new THREE.AmbientLight(0xffffff, 0.28);
    scene.add(globalAmbient);

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    // Refined Bloom Pass: threshold = 1.15 prevents diffuse blowout, only emissives & bright highlights glow
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2)),
        0.18, 0.35, 1.15
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(currentTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.08;
    controls.minPolarAngle = 0.05;
    controls.minDistance = 0.4;
    controls.maxDistance = 350.0;
    controls.enabled = false;

    // Pointer Interactivity
    renderer.domElement.addEventListener('pointerdown', handleUserInteraction);
    renderer.domElement.addEventListener('wheel', handleUserInteraction, { passive: true });
    renderer.domElement.addEventListener('touchstart', handleUserInteraction, { passive: true });
    controls.addEventListener('start', handleUserInteraction);

    // Cache Overlays
    fadeOverlayEl = document.getElementById('scene-fade-overlay');
    loadingScreenEl = document.getElementById('loading-screen');
    loadingTitleEl = document.getElementById('loading-title');
    loadingBarEl = document.getElementById('loading-bar');
    loadingPctEl = document.getElementById('loading-pct');
    mafiaBadgeEl = document.getElementById('mafia-badge');
    mafiaBtnEl = document.getElementById('mafiaBtn');
    mafiaDotEl = document.getElementById('mafiaDot');
    mafiaTextEl = document.getElementById('mafiaText');

    if (!coreEventsBound) {
        coreEventsBound = true;
        if (mafiaBtnEl) {
            mafiaBtnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                isAutoTraveling = !isAutoTraveling;
                if (isAutoTraveling) {
                    if (controls) controls.enabled = false;
                    userInactiveTimer = INACTIVITY_THRESHOLD;
                } else {
                    if (controls) {
                        controls.target.copy(currentTarget);
                        controls.enabled = true;
                    }
                    userInactiveTimer = 0;
                }
                updateMafiaUI();
            });
        }

        window.addEventListener('resize', () => {
            if (!camera || !renderer || !composer) return;
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            composer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    // TASK 6: Init Memory Monitor HUD
    initMemoryHUD();

    isInitialized = true;
}

// TASK 6: Memory HUD
function initMemoryHUD() {
    if (document.getElementById('memory-hud')) return;
    memoryHudEl = document.createElement('div');
    memoryHudEl.id = 'memory-hud';
    memoryHudEl.style.cssText = `
        position: fixed;
        bottom: 8px;
        left: 8px;
        background: rgba(8, 12, 22, 0.78);
        color: #9ab4d0;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        pointer-events: none;
        z-index: 1000;
        display: none;
        letter-spacing: 0.03em;
    `;
    document.body.appendChild(memoryHudEl);
}

function updateMemoryHUD() {
    if (!memoryHudEl || !renderer) return;
    if (!isVisible) {
        memoryHudEl.style.display = 'none';
        return;
    }
    memoryHudEl.style.display = 'block';
    const heapStr = performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / (1024 * 1024))} MB` : 'N/A';
    const texCount = renderer.info.memory.textures;
    const geoCount = renderer.info.memory.geometries;
    memoryHudEl.innerHTML = `RAM Heap: <span style="color:#00ffcc;">${heapStr}</span> | Tex: <span style="color:#ffb86b;">${texCount}</span> | Geo: <span style="color:#b866ff;">${geoCount}</span>`;
}

export function handleUserInteraction() {
    userInactiveTimer = 0;
    if (isAutoTraveling) {
        isAutoTraveling = false;
        controls.target.copy(currentTarget);
        controls.enabled = true;
        controls.update();
        updateMafiaUI();
    }
}

export function updateMafiaUI() {
    if (!mafiaBadgeEl || !mafiaTextEl || !mafiaDotEl) return;
    if (isAutoTraveling) {
        mafiaTextEl.textContent = t('mafia_active');
        mafiaDotEl.style.background = '#00ffcc';
        mafiaDotEl.style.boxShadow = '0 0 10px #00ffcc';
    } else {
        const remain = Math.max(0, Math.ceil(INACTIVITY_THRESHOLD - userInactiveTimer));
        mafiaTextEl.textContent = t('mafia_timer', { s: remain });
        mafiaDotEl.style.background = '#ffb86b';
        mafiaDotEl.style.boxShadow = '0 0 6px #ffb86b';
    }
}

export function showLoading(title) {
    if (loadingTitleEl) loadingTitleEl.textContent = title || t('loading_world');
    if (loadingBarEl) loadingBarEl.style.width = '0%';
    if (loadingPctEl) loadingPctEl.textContent = '0%';
    if (loadingScreenEl) {
        loadingScreenEl.style.opacity = '1';
        loadingScreenEl.style.display = 'flex';
    }
}

export function updateLoadingProgress(pct) {
    const val = Math.min(100, Math.max(0, Math.round(pct)));
    if (loadingBarEl) loadingBarEl.style.width = val + '%';
    if (loadingPctEl) loadingPctEl.textContent = val + '%';
}

export function hideLoading() {
    if (loadingScreenEl) {
        loadingScreenEl.style.transition = 'opacity 0.4s ease';
        loadingScreenEl.style.opacity = '0';
        setTimeout(() => {
            loadingScreenEl.style.display = 'none';
            loadingScreenEl.style.opacity = '1';
        }, 400);
    }
}

// TASK 6.2 & TASK 4: Strict Memory Disposal
export function disposeObject3D(root) {
    if (!root) return;

    // Clean any occluder references first
    for (let i = occluderMeshes.length - 1; i >= 0; i--) {
        const m = occluderMeshes[i];
        if (m.userData && m.userData.origMat) {
            m.material.dispose();
            m.material = m.userData.origMat;
            m.userData.origMat = null;
        }
    }
    occluderMeshes.length = 0;
    occludingHitSet.clear();

    root.traverse((child) => {
        if (child.isMesh || child.isPoints || child.isLine) {
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach((mat) => {
                    for (const key of TEXTURE_KEYS) {
                        const val = mat[key];
                        if (val && typeof val === 'object' && val.isTexture) {
                            val.dispose();
                            if (val.source && val.source.data && typeof val.source.data.close === 'function') {
                                try { val.source.data.close(); } catch (e) {}
                            }
                        }
                    }
                    mat.dispose();
                });
            }
            if (child.skeleton) {
                child.skeleton.dispose();
            }
        }
        if (child.isLight && child.shadow && child.shadow.map) {
            child.shadow.map.dispose();
        }
    });

    if (root.parent) {
        root.parent.remove(root);
    }

    THREE.Cache.clear();
    if (renderer && renderer.renderLists) {
        renderer.renderLists.dispose();
    }
}

// TASK 2: Universal Loader with CPU RAM ImageBitmap release
export function loadOptimizedGLB(url, onProgress) {
    return new Promise((resolve, reject) => {
        gltfLoader.load(url, (gltf) => {
            const maxAniso = renderer ? Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 4;

            gltf.scene.traverse((child) => {
                if (child.isMesh) {
                    child.frustumCulled = true;
                    if (child.material) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        mats.forEach((mat) => {
                            for (const key of TEXTURE_KEYS) {
                                const tex = mat[key];
                                if (tex && tex.isTexture) {
                                    tex.anisotropy = maxAniso;
                                    // Upload to GPU
                                    if (renderer) {
                                        renderer.initTexture(tex);
                                    }
                                }
                            }
                        });
                    }
                }
            });

            resolve(gltf);
        }, onProgress, reject);
    });
}

export function registerWorld(name, module) {
    worldsMap.set(name, module);
}

export function setSpline(camC, targetC) {
    activeCamCurve = camC;
    activeTargetCurve = targetC;
    travelingProgress = 0;
}

// TASK 6.2: Switch world with strict cache clearing & disposal of previous world
export function setWorld(worldName) {
    initCore3D(document.getElementById('three-container'));
    activeWorldName = worldName;
    isVisible = true;

    if (mafiaBadgeEl) mafiaBadgeEl.style.display = 'flex';

    // Unmount and strictly dispose previous world
    if (currentWorldModule && currentWorldModule.unmount) {
        try {
            currentWorldModule.unmount({ scene, camera, renderer, composer });
        } catch (e) {
            console.error('Error during world unmount:', e);
        }
        currentWorldModule = null;
    }

    // Clean any orphaned meshes in scene
    if (scene) {
        for (let i = scene.children.length - 1; i >= 0; i--) {
            const child = scene.children[i];
            if (child !== camera && !child.isAmbientLight) {
                disposeObject3D(child);
            }
        }
    }

    // TASK 6.2: Clear THREE Cache and dispose render lists
    THREE.Cache.clear();
    if (renderer && renderer.renderLists) {
        renderer.renderLists.dispose();
    }

    // Enforce balanced bloom and exposure limits on every switch
    if (bloomPass) {
        bloomPass.threshold = 1.05;
        bloomPass.strength = 0.22;
        bloomPass.radius = 0.35;
    }
    if (renderer) {
        renderer.toneMappingExposure = 0.95;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    // Reset camera position and target to clean safe vectors to eliminate any NaN/Infinity
    camera.position.set(0, 5, 20);
    camera.up.set(0, 1, 0);
    currentTarget.set(0, 2, 0);
    camera.lookAt(currentTarget);
    if (controls) controls.target.copy(currentTarget);

    const nextModule = worldsMap.get(worldName);
    if (nextModule) {
        currentWorldModule = nextModule;
        nextModule.mount({
            scene,
            camera,
            renderer,
            composer,
            controls,
            currentTarget,
            showLoading,
            hideLoading,
            updateLoadingProgress,
            setSpline
        });
    }

    isAutoTraveling = true;
    controls.enabled = false;
    updateMafiaUI();
}

export function hideCore3D() {
    isVisible = false;
    if (mafiaBadgeEl) mafiaBadgeEl.style.display = 'none';
    if (memoryHudEl) memoryHudEl.style.display = 'none';
    if (currentWorldModule && currentWorldModule.unmount) {
        try {
            currentWorldModule.unmount({ scene, camera, renderer, composer });
        } catch (e) {
            console.error('Error during world unmount:', e);
        }
        currentWorldModule = null;
    }
    // Deep-clean all remaining objects in scene
    if (scene) {
        for (let i = scene.children.length - 1; i >= 0; i--) {
            const child = scene.children[i];
            if (child !== camera && !child.isAmbientLight) {
                disposeObject3D(child);
            }
        }
        if (scene.environment) {
            if (typeof scene.environment.dispose === 'function') {
                scene.environment.dispose();
            }
            scene.environment = null;
        }
    }
    if (composer) {
        if (composer.renderTarget1) composer.renderTarget1.dispose();
        if (composer.renderTarget2) composer.renderTarget2.dispose();
        composer = null;
    }
    if (bloomPass) {
        bloomPass.dispose();
        bloomPass = null;
    }
    if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
        if (renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        renderer = null;
    }
    controls = null;
    scene = null;
    camera = null;
    isInitialized = false;
    THREE.Cache.clear();
    hideLoading();
}

// TASK 3: Lazy X-Ray Occlusion (Strictly NO blanket clone!)
export function updateOcclusion(dt) {
    if (occluderMeshes.length === 0 || !isFinite(camera.position.x)) return;

    occlusionTimer += dt;
    if (occlusionTimer >= 0.05) {
        occlusionTimer = 0;
        occludingHitSet.clear();

        const camPos = camera.position;
        const fwd = new THREE.Vector3().subVectors(currentTarget, camPos).normalize();
        const worldUp = new THREE.Vector3(0, 1, 0);
        let right = new THREE.Vector3().crossVectors(fwd, worldUp).normalize();
        if (right.lengthSq() < 0.001) right.set(1, 0, 0);
        const up = new THREE.Vector3().crossVectors(right, fwd).normalize();

        for (let r = 0; r < 5; r++) {
            const off = _coneOffsets[r];
            const rayTarget = new THREE.Vector3().copy(currentTarget).addScaledVector(right, off.x).addScaledVector(up, off.y);
            const rayDir = new THREE.Vector3().subVectors(rayTarget, camPos);
            const dist = rayDir.length();
            rayDir.normalize();

            occlusionRaycaster.set(camPos, rayDir);
            occlusionRaycaster.near = 0.1;
            occlusionRaycaster.far = Math.max(0.1, dist - 0.2);

            const hits = occlusionRaycaster.intersectObjects(occluderMeshes, false);
            for (let i = 0; i < hits.length; i++) occludingHitSet.add(hits[i].object);
        }

        // Apply Lazy Cloning only to hit objects
        for (let i = 0; i < occluderMeshes.length; i++) {
            const m = occluderMeshes[i];
            const isHit = occludingHitSet.has(m);

            if (isHit) {
                if (!m.userData.origMat) {
                    m.userData.origMat = m.material;
                    m.material = m.material.clone();
                    m.material.transparent = true;
                    m.material.depthWrite = false;
                }
                m.userData.targetOpacity = 0.08;
            } else {
                m.userData.targetOpacity = 1.0;
            }
        }
    }

    // Lerp opacity & dispose cloned material when restored
    for (let i = 0; i < occluderMeshes.length; i++) {
        const m = occluderMeshes[i];
        if (!m.userData.origMat) continue;

        const cur = m.material.opacity;
        const tgt = m.userData.targetOpacity;

        if (Math.abs(cur - tgt) > 0.01) {
            m.material.opacity = THREE.MathUtils.lerp(cur, tgt, dt * 9.0);
        } else {
            m.material.opacity = tgt;
            // When fully returned to 1.0, release cloned material and restore shared original!
            if (tgt >= 0.99) {
                m.material.dispose();
                m.material = m.userData.origMat;
                m.userData.origMat = null;
            }
        }
    }
}

export function renderCore3D(dt, t, audio) {
    if (!isVisible || !isInitialized) return;

    // Mouse Inactivity Resume
    if (!isAutoTraveling) {
        userInactiveTimer += dt;
        if (userInactiveTimer >= INACTIVITY_THRESHOLD && activeCamCurve && activeTargetCurve) {
            isAutoTraveling = true;
            controls.enabled = false;
            updateMafiaUI();
        }
    }

    // World Update
    if (currentWorldModule && currentWorldModule.update) {
        currentWorldModule.update(dt, t, audio, { scene, camera, renderer, composer, controls, currentTarget });
    }

    // TASK 1.1: Audio-reactive bloom strictly clamped (0.28 to max 0.35 on peak bass)
    if (bloomPass && audio) {
        bloomPass.strength = Math.min(0.35, 0.28 + (audio.bass || 0) * 0.07);
    }

    // Camera traveling
    if (isAutoTraveling && !currentWorldModule?.customCamera && activeCamCurve && activeTargetCurve) {
        const speed = (typeof currentWorldModule?.getCameraSpeed === 'function') ?
            currentWorldModule.getCameraSpeed(travelingProgress) :
            ((currentWorldModule && currentWorldModule.cameraSpeed) ? currentWorldModule.cameraSpeed : 0.015);
        travelingProgress = (travelingProgress + dt * speed) % 1.0;

        const targetCamPos = activeCamCurve.getPointAt(travelingProgress);
        const targetLookAt = activeTargetCurve.getPointAt(travelingProgress);

        if (!isFinite(camera.position.x) || !isFinite(camera.position.y) || !isFinite(camera.position.z)) {
            camera.position.set(0, 5, 20);
        }
        if (!isFinite(currentTarget.x) || !isFinite(currentTarget.y) || !isFinite(currentTarget.z)) {
            currentTarget.set(0, 2, 0);
        }

        if (isFinite(targetCamPos.x) && isFinite(targetCamPos.y) && isFinite(targetCamPos.z) &&
            isFinite(targetLookAt.x) && isFinite(targetLookAt.y) && isFinite(targetLookAt.z)) {
            camera.position.lerp(targetCamPos, Math.min(1.0, dt * 1.6));
            currentTarget.lerp(targetLookAt, Math.min(1.0, dt * 1.6));
            camera.lookAt(currentTarget);
            controls.target.copy(currentTarget);
        }
    } else if (controls.enabled) {
        controls.update();
        currentTarget.copy(controls.target);
    }

    updateMafiaUI();
    composer.render();
    updateMemoryHUD();
}
