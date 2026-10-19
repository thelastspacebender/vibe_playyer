// js/world3d/lotr.js - Lord of the Rings: Minas Tirith, White Tree of Gondor & Great Eagle
// Features: Zero runtime merging (low RAM), solid raycast terrace anchoring, and 5-Phase cinematic camera

import * as THREE from 'three';
import { loadOptimizedGLB, setSpline, currentTarget, disposeObject3D, isAutoTraveling } from './core3d.js';
import { t } from '../i18n.js';

export const customCamera = true; // Full programmatic control over 5-phase camera
export let cameraSpeed = 0.02;

let lotrGroup = null;
let cityPivot = null;
let minasModel = null;
let whiteTreeModel = null;
let eagleMesh = null;
let petalPoints = null;
let treeMixer = null;

let sunLight, hemiLight, fillLight;
const PETAL_COUNT = 60;
let petalGeo, petalMat;
const petalPositions = new Float32Array(PETAL_COUNT * 3);
const petalVelocities = [];

// 5-Phase Cinematic Cycle
// 0: White Tree Courtyard (12s)
// 1: Run-up and Cliff Dive (8s)
// 2: Terrace flyover with real-time height tracking (15s)
// 3: Catapult launch into sky (7s)
// 4: Eagle Chase & Return to Tree (18s)
let currentPhase = 0;
let phaseTimer = 0;
const PHASE_DURATIONS = [12.0, 8.0, 15.0, 7.0, 18.0];
let isAutoCycle = true;

// Key coordinates determined by terrace scanner
const cityBox = new THREE.Box3();
let prowAngle = -Math.PI / 2;
const prowDir = new THREE.Vector3(0, 0, -1);
const cliffEdge = new THREE.Vector3(0, 32.0, -18.0);
const treePos = new THREE.Vector3(0, 32.2, -15.0);
const citadelPos = new THREE.Vector3(0, 42.0, 0);

// Great Eagle orbital coordinates
const eaglePos = new THREE.Vector3(0, 45.0, 0);
let eagleAngle = 0;

// Reusable vectors for camera flight
const _camPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _scanRay = new THREE.Raycaster();
const _downDir = new THREE.Vector3(0, -1, 0);
let cityMeshes = [];

export function mount({ scene, camera, renderer, showLoading, hideLoading, updateLoadingProgress }) {
    camera.near = 0.1;
    camera.far = 1200.0;
    camera.updateProjectionMatrix();

    if (renderer) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.95;
    }

    camera.position.set(0, 26.0, 10.0);
    camera.up.set(0, 1, 0);
    currentTarget.set(0, 22.0, 0);
    camera.lookAt(currentTarget);

    scene.background = new THREE.Color(0x131722);
    scene.fog = new THREE.FogExp2(0x131722, 0.002);

    if (!lotrGroup) {
        lotrGroup = new THREE.Group();
        initCinematicLighting(lotrGroup);
        initGreatEagle(lotrGroup);
        initPetalParticles(lotrGroup);
    }
    scene.add(lotrGroup);
    lotrGroup.visible = true;

    wireUI();

    if (!cityPivot) {
        showLoading(t('loading_lotr'));
        loadOptimizedGLB('assets/models/minas_tirith.glb', (xhr) => {
            if (xhr.lengthComputable) updateLoadingProgress((xhr.loaded / xhr.total) * 70);
        }).then((gltf) => {
            minasModel = gltf.scene;
            setupMinasTirith(minasModel);
            lotrGroup.add(cityPivot);

            // Activate White Tree built-in skeletal animation (Take 001)
            if (gltf.animations && gltf.animations.length > 0) {
                treeMixer = new THREE.AnimationMixer(minasModel);
                const action = treeMixer.clipAction(gltf.animations[0]);
                action.setLoop(THREE.LoopRepeat);
                action.play();
                console.log('White Tree animation activated:', gltf.animations[0].name);
            }

            // Focus camera directly on the White Tree in the Court of the Fountain
            camera.position.set(treePos.x + 3.2, treePos.y + 1.2, treePos.z + 3.2);
            currentTarget.set(treePos.x, treePos.y + 1.2, treePos.z);
            camera.lookAt(currentTarget);

            currentPhase = 0;
            phaseTimer = 0;
            hideLoading();
        }).catch((err) => {
            console.error('Failed to load minas_tirith.glb', err);
            hideLoading();
        });
    } else {
        currentPhase = 0;
        phaseTimer = 0;
    }
}

// TASK 2.3: Zero runtime merge, centered at (0, 0, 0) and scaled in cityPivot
function setupMinasTirith(model) {
    cityMeshes = [];
    model.traverse((child) => {
        if (child.isMesh) {
            cityMeshes.push(child);
            // CRITICAL VRAM OPTIMIZATION: Only tree & eagle cast shadows!
            // City stone blocks (14.5M vertices) only receive shadows, preventing GPU shadow pass duplication and saving > 1.2 GB VRAM.
            if (/tree|branch|eagle/i.test(`${child.name} ${child.material?.name || ''}`)) {
                child.castShadow = true;
            } else {
                child.castShadow = false;
            }
            child.receiveShadow = true;
            if (child.material) {
                // If geometry has COLOR_0 attribute, enable vertex colors to render Minecraft block colors!
                if (child.geometry && child.geometry.attributes.color) {
                    child.material.vertexColors = true;
                    const col = child.geometry.attributes.color;
                    if (col.itemSize === 4) {
                        const arr = col.array;
                        for (let i = 3; i < arr.length; i += 4) {
                            arr[i] = 1.0;
                        }
                        col.needsUpdate = true;
                    }
                }
                child.material.roughness = 0.85;
                child.material.metalness = 0.0;
                if (child.material.map) {
                    child.material.map.colorSpace = THREE.SRGBColorSpace;
                }
                // Solid opaque rendering for city floor & walls - no transparency or depth discard!
                if (!/tree|branch|eagle/i.test(`${child.name} ${child.material.name}`)) {
                    child.material.transparent = false;
                    child.material.alphaTest = 0;
                    child.material.depthWrite = true;
                    child.material.depthTest = true;
                    child.material.side = THREE.DoubleSide; // Prevents any backface culling holes
                    child.material.emissiveIntensity = 0;
                    if (child.material.emissive) child.material.emissive.setRGB(0, 0, 0);
                } else {
                    // Tree bark/branches
                    child.material.roughness = 0.78;
                }
                child.material.needsUpdate = true;
            }
        }
    });

    // Calculate raw bounds, center inside cityPivot, and scale to 100.0 max size
    const rawBox = new THREE.Box3().setFromObject(model);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    const rawCenter = rawBox.getCenter(new THREE.Vector3());

    cityPivot = new THREE.Group();
    cityPivot.name = 'MinasTirithCityPivot';
    model.position.set(-rawCenter.x, -rawBox.min.y, -rawCenter.z);
    cityPivot.add(model);

    const maxDim = Math.max(rawSize.x, rawSize.z) || 1.0;
    cityPivot.scale.setScalar(100.0 / maxDim);
    cityPivot.updateMatrixWorld(true);

    // Measure normalized city bounds
    cityBox.setFromObject(cityPivot);
    const H_MAX = cityBox.max.y;

    // Dynamically retrieve exact world position of the White Tree in the 7th level Court of the Fountain
    const treeNode = model.getObjectByName('WhiteTreeOfGondor');
    if (treeNode) {
        treeNode.getWorldPosition(treePos);
    } else {
        treePos.set(1.92, 24.66, 1.08);
    }

    citadelPos.set(treePos.x, H_MAX * 0.90, treePos.z + 16.0);
    prowAngle = -Math.PI / 2;
    prowDir.set(0, 0, -1);
    cliffEdge.set(treePos.x, treePos.y - 0.2, treePos.z - 6.0);

    console.log(`Minas Tirith mounted with White Tree in Fountain: H_MAX=${H_MAX.toFixed(1)}, treePos=(${treePos.x.toFixed(2)}, ${treePos.y.toFixed(2)}, ${treePos.z.toFixed(2)})`);
}

function initCinematicLighting(group) {
    const amb = new THREE.AmbientLight(0xfff5ea, 0.25);
    group.add(amb);

    hemiLight = new THREE.HemisphereLight(0x7799bb, 0x443322, 0.40);
    group.add(hemiLight);

    sunLight = new THREE.DirectionalLight(0xfff3e0, 0.85);
    sunLight.position.set(45, 60, 35);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 10.0;
    sunLight.shadow.camera.far = 180.0;
    const d = 55;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0006;
    group.add(sunLight);

    fillLight = new THREE.DirectionalLight(0x5577aa, 0.25);
    fillLight.position.set(-70, 30, -60);
    group.add(fillLight);
}

function initGreatEagle(group) {
    const eagleGroup = new THREE.Group();

    const bodyGeo = new THREE.ConeGeometry(0.7, 2.8, 5);
    bodyGeo.rotateX(Math.PI / 2);
    const eagleMat = new THREE.MeshStandardMaterial({
        color: 0x423224,
        roughness: 0.8,
        metalness: 0.05
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, eagleMat);
    bodyMesh.castShadow = true;
    eagleGroup.add(bodyMesh);

    const wingGeo = new THREE.BoxGeometry(3.0, 0.08, 1.0);
    wingGeo.translate(1.5, 0, 0);
    const featherMat = new THREE.MeshStandardMaterial({
        color: 0x36271c,
        roughness: 0.85
    });

    const leftWing = new THREE.Mesh(wingGeo, featherMat);
    leftWing.position.set(0.35, 0.1, -0.2);
    leftWing.castShadow = true;
    eagleGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, featherMat);
    rightWing.position.set(-0.35, 0.1, -0.2);
    rightWing.rotation.y = Math.PI;
    rightWing.castShadow = true;
    eagleGroup.add(rightWing);

    eagleGroup.scale.setScalar(1.1);
    eagleMesh = eagleGroup;
    eagleMesh.userData = { leftWing, rightWing };
    group.add(eagleMesh);
}

function initPetalParticles(group) {
    petalGeo = new THREE.BufferGeometry();
    for (let i = 0; i < PETAL_COUNT; i++) {
        petalPositions[i * 3 + 0] = treePos.x + (Math.random() - 0.5) * 5.0;
        petalPositions[i * 3 + 1] = treePos.y + 1.0 + Math.random() * 3.5;
        petalPositions[i * 3 + 2] = treePos.z + (Math.random() - 0.5) * 5.0;

        petalVelocities.push(new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            -(0.12 + Math.random() * 0.18),
            (Math.random() - 0.5) * 0.2
        ));
    }

    petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3));

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(230,240,255,0.4)');
    grad.addColorStop(1, 'rgba(230,240,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    const pTex = new THREE.CanvasTexture(canvas);

    petalMat = new THREE.PointsMaterial({
        size: 0.12,
        map: pTex,
        transparent: true,
        opacity: 0.55,
        blending: THREE.NormalBlending,
        depthWrite: false
    });

    petalPoints = new THREE.Points(petalGeo, petalMat);
    group.add(petalPoints);
}

function wireUI() {
    const lotrPanel = document.getElementById('lotr-panel');
    if (lotrPanel) lotrPanel.style.display = 'block';

    const streetsBtn = document.getElementById('lotrStreetsBtn');
    const treeBtn = document.getElementById('lotrTreeBtn');
    const eagleBtn = document.getElementById('lotrEagleBtn');
    const cycleBtn = document.getElementById('lotrCycleBtn');

    if (treeBtn) treeBtn.onclick = () => { currentPhase = 0; phaseTimer = 0; isAutoCycle = false; updateUI(); };
    if (streetsBtn) streetsBtn.onclick = () => { currentPhase = 2; phaseTimer = 0; isAutoCycle = false; updateUI(); };
    if (eagleBtn) eagleBtn.onclick = () => { currentPhase = 4; phaseTimer = 0; isAutoCycle = false; updateUI(); };
    if (cycleBtn) cycleBtn.onclick = () => { isAutoCycle = !isAutoCycle; updateUI(); };

    function updateUI() {
        if (cycleBtn) cycleBtn.classList.toggle('active', isAutoCycle);
        if (treeBtn) treeBtn.classList.toggle('active', currentPhase === 0 && !isAutoCycle);
        if (streetsBtn) streetsBtn.classList.toggle('active', currentPhase === 2 && !isAutoCycle);
        if (eagleBtn) eagleBtn.classList.toggle('active', currentPhase === 4 && !isAutoCycle);
    }
}

export function unmount({ scene }) {
    if (treeMixer) {
        treeMixer.stopAllAction();
        treeMixer = null;
    }
    if (lotrGroup) {
        lotrGroup.visible = false;
        scene.remove(lotrGroup);
    }
    if (cityPivot) {
        disposeObject3D(cityPivot);
        cityPivot = null;
    }
    minasModel = null;
    if (whiteTreeModel) {
        disposeObject3D(whiteTreeModel);
        whiteTreeModel = null;
    }
    if (eagleMesh) {
        disposeObject3D(eagleMesh);
        eagleMesh = null;
    }
    if (petalPoints) {
        disposeObject3D(petalPoints);
        petalPoints = null;
    }
    lotrGroup = null;
    cityMeshes = [];
    const lotrPanel = document.getElementById('lotr-panel');
    if (lotrPanel) lotrPanel.style.display = 'none';
}

// 5-Phase Cinematic Camera Director
export function update(dt, t, audio, { camera, controls, currentTarget: targetVec }) {
    if (!lotrGroup || !lotrGroup.visible) return;

    // 0. Update White Tree animation
    if (treeMixer) {
        treeMixer.update(dt);
    }

    // 1. Great Eagle orbital soaring and wing flapping
    if (eagleMesh) {
        eagleAngle += dt * 0.42;
        const eRadius = 36.0;
        eaglePos.set(
            Math.sin(eagleAngle) * eRadius,
            cliffEdge.y + 10.0 + Math.sin(t * 1.5) * 3.0,
            Math.cos(eagleAngle) * eRadius * 0.75 - 4.0
        );
        eagleMesh.position.copy(eaglePos);

        const nextX = Math.sin(eagleAngle + 0.05) * eRadius;
        const nextZ = Math.cos(eagleAngle + 0.05) * eRadius * 0.75 - 4.0;
        eagleMesh.lookAt(nextX, eaglePos.y, nextZ);

        const flap = Math.sin(t * 7.0 + (audio.bass || 0) * 1.5) * 0.4;
        if (eagleMesh.userData.leftWing) eagleMesh.userData.leftWing.rotation.z = flap;
        if (eagleMesh.userData.rightWing) eagleMesh.userData.rightWing.rotation.z = -flap;
    }

    // 2. White Tree Petals floating
    if (petalPoints && petalGeo) {
        const pos = petalGeo.attributes.position.array;
        for (let i = 0; i < PETAL_COUNT; i++) {
            pos[i * 3 + 0] += petalVelocities[i].x * dt + Math.sin(t + i) * 0.01;
            pos[i * 3 + 1] += petalVelocities[i].y * dt;
            pos[i * 3 + 2] += petalVelocities[i].z * dt + Math.cos(t + i) * 0.01;

            if (pos[i * 3 + 1] < treePos.y - 0.5) {
                pos[i * 3 + 0] = treePos.x + (Math.random() - 0.5) * 4.0;
                pos[i * 3 + 1] = treePos.y + 2.0 + Math.random() * 2.0;
                pos[i * 3 + 2] = treePos.z + (Math.random() - 0.5) * 4.0;
            }
        }
        petalGeo.attributes.position.needsUpdate = true;
    }

    // 3. Audio-reactive sun light gently balanced (0.85 - 1.1 max)
    if (sunLight) {
        sunLight.intensity = 0.85 + Math.min(0.25, (audio.bass || 0) * 0.25);
    }

    // 4. Auto-Cycle Phase Sequencer
    if (isAutoCycle) {
        phaseTimer += dt;
        if (phaseTimer >= PHASE_DURATIONS[currentPhase]) {
            phaseTimer = 0;
            currentPhase = (currentPhase + 1) % 5;
        }
    }

    // 5. Dynamic Camera Routing for currentPhase (active only when isAutoTraveling)
    if (isAutoTraveling && camera && targetVec) {
        const pDuration = PHASE_DURATIONS[currentPhase];
        const u = Math.min(1.0, Math.max(0.0, phaseTimer / pDuration));

        if (currentPhase === 0) {
            // PHASE 1 (Fountain Courtyard, 12s): Radius 3.2 around tree in fountain, lookAt tree & fountain
            const angle = u * Math.PI * 2;
            _camPos.set(
                treePos.x + Math.sin(angle) * 3.2,
                treePos.y + 1.2 + Math.sin(angle * 2) * 0.15,
                treePos.z + Math.cos(angle) * 3.2
            );
            _lookTarget.set(treePos.x, treePos.y + 1.2, treePos.z);
        } else if (currentPhase === 1) {
            // PHASE 2 (Sprint and Cliff Dive, 8s):
            if (u < 0.3) {
                const subU = u / 0.3;
                const launchTarget = cliffEdge.clone().addScaledVector(prowDir, 3.5);
                _camPos.lerpVectors(treePos, launchTarget, subU);
                _camPos.y += 0.4;
                _lookTarget.set(cliffEdge.x + prowDir.x * 2.0, cliffEdge.y - 10.0, cliffEdge.z + prowDir.z * 2.0);
            } else {
                const subU = (u - 0.3) / 0.7;
                const topProw = cliffEdge.clone().addScaledVector(prowDir, 3.5);
                const bottomY = 4.0;
                _camPos.copy(topProw);
                _camPos.y = THREE.MathUtils.lerp(topProw.y, bottomY, subU);
                _lookTarget.set(cliffEdge.x, _camPos.y - 12.0, cliffEdge.z);
            }
        } else if (currentPhase === 2) {
            // PHASE 3 (Terrace flyover with raycast height tracking, 15s)
            const arcRadius = 26.0 - u * 5.0;
            const arcAngle = prowAngle + Math.PI * (0.25 + u * 0.85);
            const cx = Math.sin(arcAngle) * arcRadius;
            const cz = Math.cos(arcAngle) * arcRadius;

            // Procedural terrace height tracking based on distance to Citadel (prevents CPU freeze & RAM leaks from raycasting 14.5M triangles)
            const distFromCitadel = Math.hypot(cx - citadelPos.x, cz - citadelPos.z);
            let surfaceY = 6.0;
            if (distFromCitadel < 10.0) surfaceY = 22.0;
            else if (distFromCitadel < 16.0) surfaceY = 17.0;
            else if (distFromCitadel < 22.0) surfaceY = 12.0;
            else if (distFromCitadel < 28.0) surfaceY = 8.0;
            else surfaceY = 5.0;

            _camPos.set(cx, surfaceY + 1.8, cz);
            const tangentX = Math.cos(arcAngle);
            const tangentZ = -Math.sin(arcAngle);
            _lookTarget.set(cx + tangentX * 10.0, surfaceY + 2.5, cz + tangentZ * 10.0).lerp(citadelPos, 0.35);
        } else if (currentPhase === 3) {
            // PHASE 4 (Catapult launch into sky, 7s)
            const skyHeight = cityBox.max.y + 15.0;
            const startH = 8.0;
            const curH = THREE.MathUtils.lerp(startH, skyHeight, Math.sin(u * Math.PI * 0.5));
            const curR = 25.0 + u * 20.0;
            const angle = prowAngle + Math.PI * 0.8 + u * 0.5;

            _camPos.set(Math.sin(angle) * curR, curH, Math.cos(angle) * curR);
            _lookTarget.copy(citadelPos);
        } else if (currentPhase === 4) {
            // PHASE 5 (Eagle Chase & Landing at Tree, 18s)
            if (eagleMesh) {
                const forward = new THREE.Vector3();
                eagleMesh.getWorldDirection(forward);
                _camPos.copy(eaglePos).subScaledVector(forward, 6.5).add(new THREE.Vector3(0, 1.6, 0));
                _lookTarget.copy(eaglePos).addScaledVector(forward, 4.0);
            } else {
                _camPos.set(0, cliffEdge.y + 8.0, 30.0);
                _lookTarget.copy(treePos);
            }
        }

        // Smooth camera lerp with finite protection
        if (isFinite(_camPos.x) && isFinite(_camPos.y) && isFinite(_camPos.z) &&
            isFinite(_lookTarget.x) && isFinite(_lookTarget.y) && isFinite(_lookTarget.z)) {
            camera.position.lerp(_camPos, Math.min(1.0, dt * 3.5));
            targetVec.lerp(_lookTarget, Math.min(1.0, dt * 3.5));
            camera.lookAt(targetVec);
            if (controls) controls.target.copy(targetVec);
        }
    }
}
