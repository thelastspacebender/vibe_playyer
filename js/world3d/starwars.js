// js/world3d/starwars.js - Star Wars: Jedi Council Chamber (Coruscant), R2-D2 & Hero Characters
// Features: Coruscant skybox preservation, 16.0m room scaling, Y=0 floor snap, R2-D2 orbit, holo-ring, and custom folder GLB import

import * as THREE from 'three';
import { loadOptimizedGLB, setSpline, currentTarget, disposeObject3D, gltfLoader, occluderMeshes, updateOcclusion, isAutoTraveling } from './core3d.js';
import { t } from '../i18n.js';

let swGroup = null;
let councilModel = null;
let heroModel = null;
let holoRingMesh = null;
let mixer = null;
let activeAction = null;

let holoLight, coruscantSun, dirLight, ambLight;
let currentHeroIndex = 0;
let coreSplineSetter = null;
let heroAutoSwitchTimer = 0;
const HERO_AUTO_SWITCH_INTERVAL = 30.0; // Auto-switch every 30s of inactivity

// Character configs with custom eye-level camera heights & orbit radii
const DEFAULT_HEROES = [
    { name: '🎖️ Captain Stormtrooper', file: 'assets/models/stormtrooper_captain_by_oscar_creativo.glb', targetHeight: 1.8, camHeight: 1.55, targetY: 1.05, camRadius: 3.5 },
    { name: '🧙 Master Yoda', file: 'assets/models/yoda.glb', targetHeight: 0.85, camHeight: 0.80, targetY: 0.45, camRadius: 2.4 },
    { name: '🤖 R2-D2', file: 'assets/models/r2d2_-_star_wars.glb', targetHeight: 0.95, camHeight: 0.85, targetY: 0.50, camRadius: 2.5 },
    { name: '🦾 K-2SO Droid', file: 'assets/models/free_droide_de_seguridad_k-2so_by_oscar_creativo.glb', targetHeight: 2.16, camHeight: 1.95, targetY: 1.30, camRadius: 3.8 },
    { name: '💃 Dancing Trooper', file: 'assets/models/star_wars_trooper_dancing.glb', targetHeight: 1.8, camHeight: 1.55, targetY: 1.05, camRadius: 3.5 }
];

let customHeroes = [];

let camCurve = null, targetCurve = null;
export let cameraSpeed = 0.015;

export function mount({ scene, camera, renderer, showLoading, hideLoading, updateLoadingProgress, setSpline: setCoreSpline }) {
    coreSplineSetter = setCoreSpline;
    camera.near = 0.1;
    camera.far = 2500.0;
    camera.updateProjectionMatrix();

    if (renderer) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.95;
    }

    camera.position.set(0, 1.55, 3.5);
    camera.up.set(0, 1, 0);
    currentTarget.set(0, 1.05, 0);
    camera.lookAt(currentTarget);

    scene.background = new THREE.Color(0x060914);
    scene.fog = new THREE.FogExp2(0x060914, 0.0006);

    if (!swGroup) {
        swGroup = new THREE.Group();
        initStarWarsLights(swGroup);
        initHoloRing(swGroup);
    }
    scene.add(swGroup);
    swGroup.visible = true;

    wireUI();

    if (!councilModel) {
        showLoading(t('loading_sw'));
        loadOptimizedGLB('assets/models/jedi_council_baked.glb', (xhr) => {
            if (xhr.lengthComputable) updateLoadingProgress((xhr.loaded / xhr.total) * 60);
        }).then((gltf) => {
            councilModel = gltf.scene;
            normalizeCouncilRoom(councilModel);
            setupCouncilOccluders(councilModel);
            swGroup.add(councilModel);

            // Load Initial Hero at (0, 0, 0)
            loadHero(0);
            hideLoading();
        }).catch((err) => {
            console.error('Failed to load jedi_council_baked.glb', err);
            hideLoading();
        });
    } else {
        const cfg = DEFAULT_HEROES[currentHeroIndex] || DEFAULT_HEROES[0];
        buildCouncilCameraPath(cfg, setCoreSpline);
    }
}

function initStarWarsLights(group) {
    ambLight = new THREE.AmbientLight(0xffeedd, 0.25);
    group.add(ambLight);

    dirLight = new THREE.DirectionalLight(0xffeedd, 0.65);
    dirLight.position.set(6, 12, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 40;
    const d = 8;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    group.add(dirLight);

    // Warm golden sunset sunlight streaming through Council panorama windows
    coruscantSun = new THREE.DirectionalLight(0xff9944, 0.4);
    coruscantSun.position.set(30, 25, 20);
    group.add(coruscantSun);

    // Central Holo-projector blue glow (subtle, non-blinding)
    holoLight = new THREE.PointLight(0x00d4ff, 0.35, 4.0);
    holoLight.position.set(0, 0.4, 0);
    group.add(holoLight);
}

// Step 1.2: Holographic ring under hero feet using MeshBasicMaterial (no ShaderMaterial or uniforms crash)
function initHoloRing(group) {
    const ringGeo = new THREE.RingGeometry(0.7, 1.3, 36);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ccff,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
    });
    holoRingMesh = new THREE.Mesh(ringGeo, ringMat);
    holoRingMesh.position.set(0, 0.02, 0);
    group.add(holoRingMesh);
}

// Step 1.3: Center room floor at (0, 0, 0), scale inner room to 16.0m without corrupting materials
function normalizeCouncilRoom(model) {
    model.updateMatrixWorld(true);

    const innerBox = new THREE.Box3();
    let foundInner = false;

    model.traverse((child) => {
        if (child.isMesh && child.geometry) {
            const name = (child.name || '').toLowerCase();
            const parentName = (child.parent ? child.parent.name : '').toLowerCase();
            const fullName = `${name} ${parentName}`;

            // Exclude exterior panorama/skybox
            const isSky = /sky|bg|background|coruscant|sphere|cylinder|env|outside|window_bg|body_5|object_15/i.test(fullName);

            child.geometry.computeBoundingBox();
            const gBox = child.geometry.boundingBox;
            const gSize = gBox.getSize(new THREE.Vector3());
            const maxDim = Math.max(gSize.x, gSize.y, gSize.z);

            // Council room meshes are < 100 units
            if (!isSky && maxDim < 100.0) {
                const meshWorldBox = new THREE.Box3().setFromObject(child);
                innerBox.union(meshWorldBox);
                foundInner = true;
            }

            // Safe material handling: Strip emissive from MeshBasicMaterial to prevent refreshUniformsCommon crash
            if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    if (mat.isMeshBasicMaterial) {
                        delete mat.emissive;
                        delete mat.emissiveMap;
                        delete mat.emissiveIntensity;
                    } else if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial || mat.isMeshPhongMaterial) {
                        if (mat.emissiveMap || (mat.emissive && (mat.emissive.r > 0.05 || mat.emissive.g > 0.05 || mat.emissive.b > 0.05))) {
                            mat.emissiveIntensity = 0.35;
                        }
                    }
                });
            }

            child.receiveShadow = true;
            child.castShadow = false; // Room receives shadows, but only hero casts shadow (saves ~1 GB VRAM)
        }
    });

    if (!foundInner) {
        innerBox.setFromObject(model);
    }

    const roomSize = innerBox.getSize(new THREE.Vector3());
    const horizontalSize = Math.max(roomSize.x, roomSize.z) || 16.0;

    // Target inner chamber ring: 16.0 units diameter
    const TARGET_ROOM_DIAMETER = 16.0;
    const scale = TARGET_ROOM_DIAMETER / horizontalSize;
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);

    // Find scaled inner box and floor level
    const scaledInnerBox = new THREE.Box3();
    let floorY = null;

    model.traverse((child) => {
        if (child.isMesh) {
            const name = (child.name || '').toLowerCase();
            const parentName = (child.parent ? child.parent.name : '').toLowerCase();
            const isSky = /sky|bg|background|coruscant|body_5|object_15/i.test(`${name} ${parentName}`);

            if (!isSky) {
                const b = new THREE.Box3().setFromObject(child);
                scaledInnerBox.union(b);
                if (/floor/i.test(`${name} ${parentName}`)) {
                    floorY = b.max.y; // Surface of council chamber floor
                }
            }
        }
    });

    const scaledCenter = scaledInnerBox.getCenter(new THREE.Vector3());
    model.position.x = -scaledCenter.x;
    model.position.z = -scaledCenter.z;

    // Align floor surface strictly to Y = 0
    if (floorY !== null && isFinite(floorY)) {
        model.position.y = -floorY;
    } else {
        model.position.y = -scaledInnerBox.min.y;
    }

    console.log(`Council Chamber scaled: inner diameter=16.0, floor surface snapped to Y=0.0`);
}

// X-Ray Occlusion: chairs, columns, and walls fade transparent when between camera and hero
function setupCouncilOccluders(model) {
    occluderMeshes.length = 0;
    model.traverse((child) => {
        if (child.isMesh) {
            const matName = child.material ? (child.material.name || '') : '';
            const nodeName = child.name || '';
            const fullName = `${nodeName} ${matName}`.toLowerCase();
            const isFloorOrSky = /floor|skybox|sky|coruscant/i.test(fullName);
            if (!isFloorOrSky) {
                occluderMeshes.push(child);
            }
        }
    });
    console.log(`Council occluders registered: ${occluderMeshes.length} meshes (Chairs, Columns, Doors, Dome)`);
}

// Load Central Hero at (0, 0, 0)
export function loadHero(idx, customUrl = null) {
    if (heroModel) {
        if (mixer) {
            mixer.stopAllAction();
            if (heroModel) mixer.uncacheRoot(heroModel);
            mixer = null;
        }
        disposeObject3D(heroModel);
        heroModel = null;
    }

    let fileUrl = '';
    let targetH = 1.8;
    let cfg = null;

    if (customUrl) {
        fileUrl = customUrl;
        targetH = 1.8;
        cfg = { targetHeight: 1.8, camHeight: 1.55, targetY: 1.05, camRadius: 3.5 };
    } else {
        currentHeroIndex = idx % DEFAULT_HEROES.length;
        cfg = DEFAULT_HEROES[currentHeroIndex];
        fileUrl = cfg.file;
        targetH = cfg.targetHeight;
    }

    const loaderPromise = customUrl ?
        new Promise((resolve, reject) => gltfLoader.load(fileUrl, resolve, undefined, reject)) :
        loadOptimizedGLB(fileUrl, null);

    loaderPromise.then((gltf) => {
        heroModel = gltf.scene;

        heroModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach(mat => {
                        // Prevent blown-out white glare on white armor / R2 body
                        mat.emissiveIntensity = 0;
                        if (mat.emissive) mat.emissive.setRGB(0, 0, 0);
                        if (mat.isMeshBasicMaterial) {
                            delete mat.emissive;
                            delete mat.emissiveMap;
                            delete mat.emissiveIntensity;
                        } else {
                            mat.roughness = Math.max(0.65, mat.roughness ?? 0.65);
                            mat.metalness = Math.min(0.35, mat.metalness ?? 0.1);
                        }
                    });
                }
            }
        });

        // Scale to exact target height
        const box = new THREE.Box3().setFromObject(heroModel);
        const currentH = box.getSize(new THREE.Vector3()).y;
        const scale = targetH / Math.max(0.1, currentH);
        heroModel.scale.setScalar(scale);

        // Center hero model at (0, 0, 0) strictly and snap feet to floor
        box.setFromObject(heroModel);
        const heroCenter = box.getCenter(new THREE.Vector3());
        heroModel.position.x = -heroCenter.x;
        heroModel.position.z = -heroCenter.z;
        heroModel.position.y = -box.min.y;

        // Animation playback
        if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(heroModel);
            const clip = gltf.animations[0];
            activeAction = mixer.clipAction(clip);
            activeAction.play();
            console.log(`Hero animation started: ${clip.name || 'default'}`);
        }

        swGroup.add(heroModel);

        // Adjust Camera Orbit height and target specifically for this character's eye-level!
        buildCouncilCameraPath(cfg, coreSplineSetter);

        heroAutoSwitchTimer = 0;
        updateUI();
    }).catch(err => {
        console.error('Failed to load hero model:', fileUrl, err);
    });
}

function buildCouncilCameraPath(cfg, setCoreSpline) {
    const camPoints = [];
    const targetPoints = [];
    const R = cfg?.camRadius || 3.2;
    const camH = cfg?.camHeight || 1.45;
    const tgtY = cfg?.targetY || 0.95;
    const steps = 8;
    for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const cx = Math.sin(angle) * R;
        const cz = Math.cos(angle) * R;
        const cy = camH + Math.sin(angle * 2.0) * 0.08;
        camPoints.push(new THREE.Vector3(cx, cy, cz));
        targetPoints.push(new THREE.Vector3(0, tgtY, 0));
    }

    camCurve = new THREE.CatmullRomCurve3(camPoints, true, 'centripetal');
    targetCurve = new THREE.CatmullRomCurve3(targetPoints, true, 'centripetal');

    const setter = setCoreSpline || coreSplineSetter;
    if (setter) {
        setter(camCurve, targetCurve);
    } else {
        setSpline(camCurve, targetCurve);
    }
}

function wireUI() {
    const swPanel = document.getElementById('sw-panel');
    if (swPanel) swPanel.style.display = 'block';

    const captainBtn = document.getElementById('swHeroCaptainBtn');
    const yodaBtn = document.getElementById('swHeroYodaBtn');
    const r2d2Btn = document.getElementById('swHeroR2D2Btn');
    const k2soBtn = document.getElementById('swHeroK2SOBtn');
    const dancingBtn = document.getElementById('swHeroDancingBtn');
    const folderInput = document.getElementById('swFolderInput');

    if (captainBtn) captainBtn.onclick = () => loadHero(0);
    if (yodaBtn) yodaBtn.onclick = () => loadHero(1);
    if (r2d2Btn) r2d2Btn.onclick = () => loadHero(2);
    if (k2soBtn) k2soBtn.onclick = () => loadHero(3);
    if (dancingBtn) dancingBtn.onclick = () => loadHero(4);

    if (folderInput) {
        folderInput.onchange = (e) => {
            const files = Array.from(e.target.files || []);
            const glbFiles = files.filter(f => f.name.toLowerCase().endsWith('.glb') || f.name.toLowerCase().endsWith('.gltf'));

            if (glbFiles.length === 0) {
                alert(t('sw_no_models_found'));
                return;
            }

            const buttonWrap = document.getElementById('swHeroButtons');
            const folderLabel = document.getElementById('swFolderLabel');

            glbFiles.forEach((file) => {
                const cleanName = file.name.replace(/\.[^/.]+$/, '');
                const url = URL.createObjectURL(file);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'panel-pill';
                btn.textContent = `📦 ${cleanName}`;
                btn.onclick = () => {
                    loadHero(-1, url);
                    buttonWrap.querySelectorAll('.panel-pill').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                };

                if (folderLabel) {
                    buttonWrap.insertBefore(btn, folderLabel);
                } else {
                    buttonWrap.appendChild(btn);
                }
            });

            const firstUrl = URL.createObjectURL(glbFiles[0]);
            loadHero(-1, firstUrl);
        };
    }

    updateUI();
}

function updateUI() {
    const captainBtn = document.getElementById('swHeroCaptainBtn');
    const yodaBtn = document.getElementById('swHeroYodaBtn');
    const r2d2Btn = document.getElementById('swHeroR2D2Btn');
    const k2soBtn = document.getElementById('swHeroK2SOBtn');
    const dancingBtn = document.getElementById('swHeroDancingBtn');

    if (captainBtn?.classList) captainBtn.classList.toggle('active', currentHeroIndex === 0);
    if (yodaBtn?.classList) yodaBtn.classList.toggle('active', currentHeroIndex === 1);
    if (r2d2Btn?.classList) r2d2Btn.classList.toggle('active', currentHeroIndex === 2);
    if (k2soBtn?.classList) k2soBtn.classList.toggle('active', currentHeroIndex === 3);
    if (dancingBtn?.classList) dancingBtn.classList.toggle('active', currentHeroIndex === 4);
}

export function unmount({ scene }) {
    if (swGroup) {
        swGroup.visible = false;
        scene.remove(swGroup);
    }
    if (councilModel) {
        disposeObject3D(councilModel);
        councilModel = null;
    }
    if (heroModel) {
        if (mixer) {
            mixer.stopAllAction();
            mixer.uncacheRoot(heroModel);
            mixer = null;
        }
        disposeObject3D(heroModel);
        heroModel = null;
    }
    for (let i = occluderMeshes.length - 1; i >= 0; i--) {
        const m = occluderMeshes[i];
        if (m.userData && m.userData.origMat) {
            m.material.dispose();
            m.material = m.userData.origMat;
            m.userData.origMat = null;
        }
    }
    occluderMeshes.length = 0;

    swGroup = null;
    const swPanel = document.getElementById('sw-panel');
    if (swPanel) swPanel.style.display = 'none';
}

export function update(dt, t, audio) {
    if (!swGroup || !swGroup.visible) return;

    if (mixer) {
        mixer.update(dt);
    }

    // Dynamic X-Ray transparency for objects occluding central hero
    updateOcclusion(dt);

    // Auto-switch characters every 30 seconds if user is inactive / auto-traveling
    if (isAutoTraveling) {
        heroAutoSwitchTimer += dt;
        if (heroAutoSwitchTimer >= HERO_AUTO_SWITCH_INTERVAL) {
            heroAutoSwitchTimer = 0;
            const nextIdx = (currentHeroIndex + 1) % DEFAULT_HEROES.length;
            loadHero(nextIdx);
        }
    } else {
        heroAutoSwitchTimer = 0;
    }

    if (holoLight) {
        holoLight.intensity = 0.35 + (audio.highs || 0) * 0.35;
    }
}
