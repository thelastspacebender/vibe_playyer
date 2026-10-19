const fs = require('fs');

// --- 1. UPDATE C:/Users/windxin/Downloads/index.html ---
let dHtml = fs.readFileSync('C:/Users/windxin/Downloads/index.html', 'utf8');

// Ensure clean English option
dHtml = dHtml.replace(/<option value="yennefer">.*?<\/option>/g, '');
dHtml = dHtml.replace('<option value="medieval">כפר ימי-ביניים</option>', '<option value="medieval">כפר ימי-ביניים</option>\n      <option value="yennefer">Yennefer</option>');

// Replace module in Downloads index.html
const startTag = '<!-- YENNEFER 3D ENGINE START -->';
const endTag = '<!-- YENNEFER 3D ENGINE END -->';
let beforeMod = dHtml;
let afterMod = '';

const sIdx = dHtml.indexOf(startTag);
const eIdx = dHtml.indexOf(endTag);
if (sIdx !== -1 && eIdx !== -1) {
    beforeMod = dHtml.substring(0, sIdx);
    afterMod = dHtml.substring(eIdx + endTag.length);
} else {
    const lastScriptIdx = dHtml.lastIndexOf('<script type="module">');
    if (lastScriptIdx !== -1) {
        beforeMod = dHtml.substring(0, lastScriptIdx);
        afterMod = dHtml.substring(dHtml.indexOf('</script>', lastScriptIdx) + 9);
    }
}

const updatedModule = `
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
let isInitialized = false;
let isVisible = false;

// 30-second user inactivity timer
let isAutoTraveling = false;
let userInactiveTimer = 0;
const INACTIVITY_THRESHOLD = 30.0; // 30 seconds of no user input to start traveling

// Pre-calculated traveling path looking into Yennefer's face from the FRONT
let camCurve = null;
let targetCurve = null;
let travelingProgress = 0;

// X-Ray Occlusion
const occlusionRaycaster = new THREE.Raycaster();
const occludingMeshesSet = new Set();

function init3D() {
    if (isInitialized) return;
    container = document.getElementById('three-container');
    if (!container) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);

    // Initial comfortable view of the room from the front
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(-1.15, -0.90, 0.55);

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
    controls.target.set(-1.19, -1.15, 1.63);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.08;
    controls.minPolarAngle = 0.10;
    controls.minDistance = 0.8;
    controls.maxDistance = 15.0;

    // Reset inactivity timer on ANY user interaction
    function resetInactive() {
        userInactiveTimer = 0;
        isAutoTraveling = false;
    }
    controls.addEventListener('start', resetInactive);
    controls.addEventListener('change', () => {
        if (!isAutoTraveling) userInactiveTimer = 0;
    });
    window.addEventListener('pointerdown', resetInactive, { passive: true });
    window.addEventListener('wheel', resetInactive, { passive: true });
    window.addEventListener('touchstart', resetInactive, { passive: true });

    scene.add(new THREE.HemisphereLight(0x404d6b, 0x18141f, 0.95));

    candleLight = new THREE.PointLight(0xff9944, 4.5, 12, 1.2);
    candleLight.position.set(-3.57, -0.9, 1.92);
    candleLight.castShadow = true;
    scene.add(candleLight);

    magicLight = new THREE.PointLight(0xb866ff, 3.6, 12, 1.2);
    magicLight.position.set(-1.19, -0.6, 1.63);
    scene.add(magicLight);

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

        buildCalculatedSpline();

        if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(model);
            gltf.animations.forEach(c => mixer.clipAction(c).play());
        }
    });
}

// Pre-calculated traveling path: camera always stays at Z < 1.3 looking forward (+Z) directly into Yennefer's face & chest
function buildCalculatedSpline() {
    const camPoints = [
        // Pt 0: In front of fireplace, looking at fire
        new THREE.Vector3(-2.35, -0.95, 1.25),
        // Pt 1: Gliding across the floor towards Yennefer
        new THREE.Vector3(-1.80, -0.85, 0.75),
        // Pt 2: Directly in front of the tub, looking at Yennefer's face and eyes (FRONT VIEW)
        new THREE.Vector3(-1.15, -0.90, 0.55),
        // Pt 3: Side-front profile angle of Yennefer
        new THREE.Vector3(-0.55, -0.85, 0.95),
        // Pt 4: In front of the stuffed unicorn
        new THREE.Vector3(-1.65, -0.70, 0.45),
        // Pt 5: Elevated chamber overview drifting back to hearth
        new THREE.Vector3(-2.20, -0.30, 0.35)
    ];

    const targetPoints = [
        // Look 0: Fireplace flame
        new THREE.Vector3(-3.57, -1.25, 1.92),
        // Look 1: Midpoint drift
        new THREE.Vector3(-2.30, -1.15, 1.75),
        // Look 2: Yennefer's Face & Eyes (FACE IS AT Z = +1.63, CAMERA IS AT Z = +0.55 -> DIRECT FRONT SIGHT)
        new THREE.Vector3(-1.19, -1.15, 1.63),
        // Look 3: Yennefer in the tub
        new THREE.Vector3(-1.19, -1.15, 1.63),
        // Look 4: Unicorn head
        new THREE.Vector3(-2.65, -0.85, 1.35),
        // Look 5: Hearth area
        new THREE.Vector3(-2.40, -1.10, 1.60)
    ];

    camCurve = new THREE.CatmullRomCurve3(camPoints, true, 'centripetal');
    targetCurve = new THREE.CatmullRomCurve3(targetPoints, true, 'centripetal');
}

// X-Ray Occlusion: any obstacle between camera and lookAt target fades to 15% opacity
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

        // Track inactivity: if user hasn't moved camera for 30s, start traveling tour
        userInactiveTimer += dt;
        if (userInactiveTimer >= INACTIVITY_THRESHOLD) {
            isAutoTraveling = true;
        }

        // Smooth continuous traveling camera (only if 30s inactive)
        if (isAutoTraveling && camCurve && targetCurve) {
            travelingProgress = (travelingProgress + dt * 0.016) % 1.0; // ~60s majestic full loop
            const targetCamPos = camCurve.getPointAt(travelingProgress);
            const targetLookAt = targetCurve.getPointAt(travelingProgress);

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

if (document.getElementById('world')?.value === 'yennefer') {
    window.Yennefer3D.show();
}
</script>
<!-- YENNEFER 3D ENGINE END -->
`;

dHtml = beforeMod + updatedModule + afterMod;
fs.writeFileSync('C:/Users/windxin/Downloads/index.html', dHtml, 'utf8');
fs.writeFileSync('downloads_index.html', dHtml, 'utf8');
console.log('SUCCESS: C:/Users/windxin/Downloads/index.html updated with 30s idle timer and FRONT face camera path!');
