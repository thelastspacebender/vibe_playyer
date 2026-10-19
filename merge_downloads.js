const fs = require('fs');

let html = fs.readFileSync('C:/Users/windxin/Downloads/index.html', 'utf8');

// 1. Ensure importmap in <head>
const importMap = `
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>
`;
if (!html.includes('"three":')) {
    html = html.replace('</head>', importMap + '\n</head>');
}

// 2. Ensure #three-container
if (!html.includes('id="three-container"')) {
    html = html.replace('<canvas id="scene"', '<div id="three-container" style="position:fixed;inset:0;width:100%;height:100%;display:none;z-index:0;"></div>\n<canvas id="scene"');
}

// 3. Set option to strictly "Yennefer" in English without Russian
// Remove old russian option if present
html = html.replace(/<option value="yennefer">.*?<\/option>/g, '');
// Add clean English option
const cleanOption = '<option value="yennefer">Yennefer</option>';
html = html.replace('<option value="medieval">כפר ימי-ביניים</option>', '<option value="medieval">כפר ימי-ביניים</option>\n      ' + cleanOption);

// 4. Hook worldEl change and initial setup
if (!html.includes('window.Yennefer3D.show()')) {
    const worldHook = `
  if (scene === 'yennefer') {
    cv.style.display = 'none';
    const tc = document.getElementById('three-container');
    if (tc) tc.style.display = 'block';
    if (window.Yennefer3D) window.Yennefer3D.show();
  } else {
    cv.style.display = 'block';
    const tc = document.getElementById('three-container');
    if (tc) tc.style.display = 'none';
    if (window.Yennefer3D) window.Yennefer3D.hide();
  }
`;
    html = html.replace("scene = worldEl.value; fx = [];", "scene = worldEl.value; fx = []; " + worldHook);
    html = html.replace("scene = worldEl.value || 'city';", "scene = worldEl.value || 'city'; " + worldHook);
    html = html.replace("draw(t, dt);", "draw(t, dt); if (scene === 'yennefer' && window.Yennefer3D) window.Yennefer3D.render(dt, t, bass, highs, energy);");
}

// 5. Update or replace Yennefer module script with continuous traveling cinematic camera & X-Ray occlusion
// Remove any previous yennefer script
const moduleStartIdx = html.indexOf('<!-- YENNEFER 3D ENGINE START -->');
const moduleEndIdx = html.indexOf('<!-- YENNEFER 3D ENGINE END -->');
if (moduleStartIdx !== -1 && moduleEndIdx !== -1) {
    html = html.substring(0, moduleStartIdx) + html.substring(moduleEndIdx + '<!-- YENNEFER 3D ENGINE END -->'.length);
} else {
    // If old module without comment tags, strip out any previous <script type="module"> before </body>
    const scriptModIdx = html.lastIndexOf('<script type="module">');
    if (scriptModIdx !== -1) {
        const scriptCloseIdx = html.indexOf('</script>', scriptModIdx);
        if (scriptCloseIdx !== -1) {
            html = html.substring(0, scriptModIdx) + html.substring(scriptCloseIdx + 9);
        }
    }
}

const cinematicModule = `
<!-- YENNEFER 3D ENGINE START -->
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

let container, scene, camera, renderer, composer, controls;
let roomGroup, currentModel, mixer, candleLight, magicLight, moonLight;
let isUserDragging = false;
let userInactiveTimer = 0;
let isInitialized = false;
let isVisible = false;

// Continuous cinematic traveling camera
let camCurve = null;
let targetCurve = null;
let cinematicProgress = 0;
let isAutoMoving = true;

// X-Ray Occlusion
const occlusionRaycaster = new THREE.Raycaster();
const occludingMeshesSet = new Set();

function init3D() {
    if (isInitialized) return;
    container = document.getElementById('three-container');
    if (!container) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(-2.2, -0.6, 3.1);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.5, 0.75);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-3.5, -1.1, 1.9);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.08;
    controls.minPolarAngle = 0.12;
    controls.minDistance = 1.0;
    controls.maxDistance = 15.0;

    controls.addEventListener('start', () => { 
        isUserDragging = true; 
        isAutoMoving = false;
        userInactiveTimer = 0;
    });
    controls.addEventListener('end', () => { 
        isUserDragging = false; 
    });

    scene.add(new THREE.HemisphereLight(0x404d6b, 0x18141f, 0.95));

    // Fireplace warm point light
    candleLight = new THREE.PointLight(0xff9944, 4.5, 12, 1.2);
    candleLight.position.set(-3.5, -0.9, 1.8);
    candleLight.castShadow = true;
    scene.add(candleLight);

    // Yennefer magic lilac light
    magicLight = new THREE.PointLight(0xb866ff, 3.6, 12, 1.2);
    magicLight.position.set(-1.0, -0.6, 1.8);
    scene.add(magicLight);

    // Moonlight
    moonLight = new THREE.DirectionalLight(0x9bb7e0, 2.2);
    moonLight.position.set(4.5, 5.0, 3.5);
    moonLight.castShadow = true;
    scene.add(moonLight);

    roomGroup = new THREE.Group();
    scene.add(roomGroup);

    loadRoomModel();

    window.addEventListener('resize', () => {
        if (!camera || !renderer || !composer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });

    isInitialized = true;
}

function loadRoomModel() {
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    loader.load('./room.glb', (gltf) => {
        const model = gltf.scene;
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
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 10.0 / (maxDim || 1);
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
        model.position.x = -center.x;
        model.position.y = -center.y;
        model.position.z = -center.z;
        model.updateMatrixWorld(true);

        model.traverse(obj => {
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
                if (obj.material) {
                    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                    mats.forEach(mat => {
                        mat.envMapIntensity = 1.4;
                        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
                        if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
                        if (mat.emissive && (mat.emissive.r > 0.05 || mat.emissive.g > 0.05 || mat.emissive.b > 0.05)) {
                            mat.emissiveIntensity = 2.4;
                        }
                        mat.userData.baseOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
                        mat.userData.baseTransparent = mat.transparent;
                    });
                }
            }
        });

        roomGroup.add(model);
        currentModel = model;

        buildCinematicPaths();

        if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(model);
            gltf.animations.forEach(c => mixer.clipAction(c).play());
        }
    });
}

function getTargets() {
    let yenPos = new THREE.Vector3(-1.22, -1.15, 1.59);
    let firePos = new THREE.Vector3(-3.57, -1.25, 1.92);
    let unicornPos = new THREE.Vector3(-2.76, -0.95, 1.39);
    if (currentModel) {
        currentModel.traverse(c => {
            const n = ((c.name || '') + ' ' + (c.parent ? c.parent.name : '')).toLowerCase();
            if (/yennefer|bathtub/i.test(n) && c.isMesh) {
                c.updateMatrixWorld(true);
                yenPos.copy(new THREE.Box3().setFromObject(c).getCenter(new THREE.Vector3()));
            }
            if (/feuer|fire/i.test(n) && c.isMesh && c.name !== 'Object_7') {
                c.updateMatrixWorld(true);
                firePos.copy(new THREE.Box3().setFromObject(c).getCenter(new THREE.Vector3()));
            }
            if (/horse|unicorn/i.test(n) && c.isMesh) {
                c.updateMatrixWorld(true);
                unicornPos.copy(new THREE.Box3().setFromObject(c).getCenter(new THREE.Vector3()));
            }
        });
    }
    return { yenPos, firePos, unicornPos };
}

function buildCinematicPaths() {
    const { yenPos, firePos, unicornPos } = getTargets();

    // Smooth continuous curved spline passing between fireplace and Yennefer
    const camPoints = [
        // 1. Cozy angle at fireplace
        new THREE.Vector3(firePos.x + 1.25, firePos.y + 0.65, firePos.z + 1.25),
        // 2. Slow glide across the room
        new THREE.Vector3((firePos.x + yenPos.x) * 0.5 + 0.3, -0.65, 3.1),
        // 3. Facing Yennefer in the bathtub (front-right)
        new THREE.Vector3(yenPos.x + 0.65, yenPos.y + 0.55, yenPos.z + 1.3),
        // 4. Smooth arc around Yennefer (front-left close-up)
        new THREE.Vector3(yenPos.x - 0.55, yenPos.y + 0.55, yenPos.z + 1.4),
        // 5. Passing unicorn
        new THREE.Vector3(unicornPos.x + 0.95, unicornPos.y + 0.55, unicornPos.z + 1.5),
        // 6. High chamber overview drifting back towards fireplace
        new THREE.Vector3(-0.6, 0.2, 4.6)
    ];

    const targetPoints = [
        // 1. Looking at flickering fire
        new THREE.Vector3(firePos.x, firePos.y + 0.15, firePos.z),
        // 2. Look panning towards Yennefer
        new THREE.Vector3((firePos.x + yenPos.x) * 0.5, -0.9, 1.7),
        // 3. Looking directly at Yennefer in the tub
        new THREE.Vector3(yenPos.x, yenPos.y + 0.15, yenPos.z),
        // 4. Looking at Yennefer from side
        new THREE.Vector3(yenPos.x, yenPos.y + 0.15, yenPos.z),
        // 5. Looking at unicorn
        new THREE.Vector3(unicornPos.x, unicornPos.y + 0.1, unicornPos.z),
        // 6. Looking at whole room
        new THREE.Vector3(-0.8, -0.5, 0.6)
    ];

    camCurve = new THREE.CatmullRomCurve3(camPoints, true, 'centripetal');
    targetCurve = new THREE.CatmullRomCurve3(targetPoints, true, 'centripetal');
}

// X-Ray Occlusion: make any wall/object between camera and focus target transparent
function updateOcclusion(dt) {
    if (!currentModel) return;
    const targetPos = controls.target.clone();
    const camPos = camera.position.clone();
    const dir = targetPos.clone().sub(camPos);
    const dist = dir.length();
    dir.normalize();

    occlusionRaycaster.set(camPos, dir);
    occlusionRaycaster.near = 0.15;
    occlusionRaycaster.far = Math.max(0.2, dist - 0.35);

    const intersects = occlusionRaycaster.intersectObjects(roomGroup.children, true);
    occludingMeshesSet.clear();

    for (let i = 0; i < intersects.length; i++) {
        const obj = intersects[i].object;
        if (!obj.isMesh) continue;
        const n = ((obj.name || '') + ' ' + (obj.parent ? obj.parent.name : '')).toLowerCase();
        if (/yennefer|bath|tub|bubble|fire/i.test(n)) continue;
        occludingMeshesSet.add(obj);
    }

    roomGroup.traverse(obj => {
        if (obj.isMesh && obj.material) {
            const isOccluding = occludingMeshesSet.has(obj);
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach(mat => {
                const baseOpacity = mat.userData.baseOpacity !== undefined ? mat.userData.baseOpacity : 1.0;
                const targetOpacity = isOccluding ? 0.15 : baseOpacity;
                if (isOccluding) {
                    mat.transparent = true;
                    mat.depthWrite = false;
                }
                mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, dt * 7.5);
                if (!isOccluding && Math.abs(mat.opacity - baseOpacity) < 0.03) {
                    mat.opacity = baseOpacity;
                    mat.transparent = mat.userData.baseTransparent;
                    mat.depthWrite = true;
                }
            });
        }
    });
}

window.Yennefer3D = {
    show() {
        init3D();
        isVisible = true;
    },
    hide() {
        isVisible = false;
    },
    render(dt, t, bass, highs, energy) {
        if (!isVisible || !isInitialized) return;

        if (mixer) mixer.update(dt);

        // Resume auto traveling camera after 6 seconds of no user dragging
        if (!isUserDragging) {
            userInactiveTimer += dt;
            if (userInactiveTimer > 6.0) {
                isAutoMoving = true;
            }
        }

        // Butter-smooth continuous camera travel between fire and Yennefer
        if (isAutoMoving && camCurve && targetCurve && !isUserDragging) {
            // Speed adjusted for a majestic ~45 second full cinematic tour
            cinematicProgress = (cinematicProgress + dt * 0.022) % 1.0;
            const targetCamPos = camCurve.getPointAt(cinematicProgress);
            const targetLookAt = targetCurve.getPointAt(cinematicProgress);

            camera.position.lerp(targetCamPos, dt * 1.5);
            controls.target.lerp(targetLookAt, dt * 1.5);
        }

        controls.update();
        updateOcclusion(dt);

        const flicker = Math.sin(t * 11) * 0.15 + Math.sin(t * 23.3) * 0.1;
        candleLight.intensity = Math.max(0.4, 3.8 + flicker + bass * 4.5);
        magicLight.intensity = Math.max(0.2, 2.8 + Math.sin(t * 2.4) * 0.35 + highs * 4.5);

        composer.render();
    }
};

// Auto start if Yennefer is already selected in dropdown
if (document.getElementById('world')?.value === 'yennefer') {
    window.Yennefer3D.show();
}
</script>
<!-- YENNEFER 3D ENGINE END -->
`;

html = html.replace('</body>', cinematicModule + '\n</body>');

fs.writeFileSync('C:/Users/windxin/Downloads/index.html', html, 'utf8');
fs.writeFileSync('downloads_index.html', html, 'utf8');
console.log('SUCCESS: Updated C:/Users/windxin/Downloads/index.html with Yennefer English option and smooth traveling camera!');
