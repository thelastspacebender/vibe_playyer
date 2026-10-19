const fs = require('fs');

let mHtml = fs.readFileSync('index.html', 'utf8');

// Replace the traveling camera and initial positions in script
const scriptTag = '<script type="module">';
const sIdx = mHtml.indexOf(scriptTag);
if (sIdx !== -1) {
    let before = mHtml.substring(0, sIdx);
    
    const newScript = `<script type="module">
        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
        import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
        import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
        import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
        import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
        import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
        import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

        const container = document.getElementById('canvas-container');
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x06080e);

        // Initial view: directly facing Yennefer from the front of the tub
        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(-1.15, -0.90, 0.55);

        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;
        container.appendChild(renderer.domElement);

        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        const roomEnv = new RoomEnvironment();
        scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;

        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.5, 0.75);
        composer.addPass(bloomPass);

        const outputPass = new OutputPass();
        composer.addPass(outputPass);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(-1.19, -1.15, 1.63);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2 + 0.08;
        controls.minPolarAngle = 0.10;
        controls.minDistance = 0.8;
        controls.maxDistance = 15.0;

        // 30-second user inactivity timer
        let isAutoTraveling = false;
        let userInactiveTimer = 0;
        const INACTIVITY_THRESHOLD = 30.0;

        function resetInactive() {
            userInactiveTimer = 0;
            isAutoTraveling = false;
            document.getElementById('toggle-autocam').textContent = '🎬 Auto Tour: Inactive in 30s';
            document.getElementById('toggle-autocam').classList.remove('active');
        }

        controls.addEventListener('start', resetInactive);
        controls.addEventListener('change', () => {
            if (!isAutoTraveling) userInactiveTimer = 0;
        });
        window.addEventListener('pointerdown', resetInactive, { passive: true });
        window.addEventListener('wheel', resetInactive, { passive: true });
        window.addEventListener('touchstart', resetInactive, { passive: true });

        const toggleAutoCamBtn = document.getElementById('toggle-autocam');
        toggleAutoCamBtn.addEventListener('click', () => {
            isAutoTraveling = !isAutoTraveling;
            userInactiveTimer = isAutoTraveling ? 35.0 : 0;
            toggleAutoCamBtn.classList.toggle('active', isAutoTraveling);
            toggleAutoCamBtn.textContent = isAutoTraveling ? '🎬 Auto Tour: ON' : '🎬 Auto Tour: OFF';
            showToast(isAutoTraveling ? '🎬 Auto Tour Started' : '⏸️ Auto Tour Paused');
        });

        // Pre-calculated traveling path looking into Yennefer's face from the FRONT
        let camCurve = null;
        let targetCurve = null;
        let travelingProgress = 0;

        let manualTransition = null;
        function transitionCameraTo(targetPos, targetLookAt, duration = 1.1) {
            resetInactive();
            manualTransition = {
                startPos: camera.position.clone(),
                endPos: targetPos.clone(),
                startTarget: controls.target.clone(),
                endTarget: targetLookAt.clone(),
                time: 0,
                duration: duration
            };
        }

        const hemiLight = new THREE.HemisphereLight(0x404d6b, 0x18141f, 0.95);
        scene.add(hemiLight);

        const candleLight = new THREE.PointLight(0xff9944, 4.5, 12, 1.2);
        candleLight.position.set(-3.57, -0.9, 1.92);
        candleLight.castShadow = true;
        scene.add(candleLight);

        const magicLight = new THREE.PointLight(0xb866ff, 3.6, 12, 1.2);
        magicLight.position.set(-1.19, -0.6, 1.63);
        scene.add(magicLight);

        const moonLight = new THREE.DirectionalLight(0x9bb7e0, 2.2);
        moonLight.position.set(4.5, 5.0, 3.5);
        moonLight.castShadow = true;
        scene.add(moonLight);

        const roomGroup = new THREE.Group();
        scene.add(roomGroup);

        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

        const gltfLoader = new GLTFLoader();
        gltfLoader.setDRACOLoader(dracoLoader);

        let currentModel = null;
        let mixer = null;
        let headBone = null;
        let neckBone = null;
        let placeholderGroup = null;

        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const loaderOverlay = document.getElementById('loader-overlay');
        const modelStatusEl = document.getElementById('model-status');

        function updateProgress(loaded, total) {
            let percent = total > 0 ? (loaded / total) * 100 : 60;
            percent = Math.min(Math.max(percent, 5), 100);
            progressBar.style.width = percent.toFixed(0) + '%';
            const mbLoaded = (loaded / (1024 * 1024)).toFixed(1);
            const mbTotal = total > 0 ? (total / (1024 * 1024)).toFixed(1) : '?';
            progressText.textContent = \`Loading 3D scene... \${percent.toFixed(0)}% (\${mbLoaded} / \${mbTotal} MB)\`;
        }

        function hideLoader() {
            progressBar.style.width = '100%';
            progressText.textContent = 'Welcome to Yennefer\\'s Chamber...';
            setTimeout(() => {
                loaderOverlay.classList.add('hidden');
            }, 450);
        }

        function createPlaceholderScene() {
            if (placeholderGroup) scene.remove(placeholderGroup);
            placeholderGroup = new THREE.Group();

            const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x1b1d28, roughness: 0.65, metalness: 0.2 });
            const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.4, 32), pedestalMat);
            pedestal.position.y = -0.2;
            pedestal.receiveShadow = true;
            placeholderGroup.add(pedestal);

            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 4.5, 16), pedestalMat);
                col.position.set(Math.cos(angle) * 3.8, 2.0, Math.sin(angle) * 3.8);
                col.castShadow = true;
                placeholderGroup.add(col);
            }

            const crystal = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.65, 0),
                new THREE.MeshPhysicalMaterial({ color: 0xb866ff, emissive: 0x5a189a, emissiveIntensity: 1.2, roughness: 0.1, transmission: 0.85, thickness: 1.2, transparent: true, opacity: 0.95 })
            );
            crystal.position.set(0, 1.4, 0);
            crystal.castShadow = true;
            crystal.name = 'YenneferCrystal';
            placeholderGroup.add(crystal);

            scene.add(placeholderGroup);
            modelStatusEl.textContent = '3D Placeholder (Load .GLB)';
        }

        function applyModelToScene(gltf, name = 'Yennefer\\'s Chamber') {
            if (placeholderGroup) { scene.remove(placeholderGroup); placeholderGroup = null; }
            if (currentModel) { roomGroup.remove(currentModel); currentModel = null; }
            headBone = null; neckBone = null; mixer = null;

            const model = gltf.scene;
            model.updateMatrixWorld(true);

            const box = new THREE.Box3();
            model.traverse((child) => {
                if (child.isMesh && child.name !== 'Object_7') {
                    const childBox = new THREE.Box3().setFromObject(child);
                    const childSize = childBox.getSize(new THREE.Vector3());
                    if (childSize.x < 55 && childSize.y < 55 && childSize.z < 55) box.union(childBox);
                }
            });

            if (box.isEmpty()) box.setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 10.0 / (maxDim || 1);
            model.scale.setScalar(scale);

            model.updateMatrixWorld(true);
            const scaledBox = new THREE.Box3();
            model.traverse((child) => {
                if (child.isMesh && child.name !== 'Object_7') {
                    const childBox = new THREE.Box3().setFromObject(child);
                    const childSize = childBox.getSize(new THREE.Vector3());
                    if (childSize.x < 55 && childSize.y < 55 && childSize.z < 55) scaledBox.union(childBox);
                }
            });
            const center = scaledBox.getCenter(new THREE.Vector3());
            model.position.x = -center.x;
            model.position.y = -center.y;
            model.position.z = -center.z;
            model.updateMatrixWorld(true);

            model.traverse((obj) => {
                if (obj.isMesh) {
                    obj.castShadow = true;
                    obj.receiveShadow = true;
                    if (obj.material) {
                        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                        mats.forEach((mat) => {
                            mat.envMapIntensity = 1.4;
                            if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
                            if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
                            if (mat.emissive && (mat.emissive.r > 0.05 || mat.emissive.g > 0.05 || mat.emissive.b > 0.05)) {
                                mat.emissiveIntensity = 2.4;
                            }
                            mat.userData.baseOpacity = (mat.opacity !== undefined) ? mat.opacity : 1.0;
                            mat.userData.baseTransparent = mat.transparent;
                        });
                    }
                }
                if (obj.isBone) {
                    const boneName = obj.name.toLowerCase();
                    if (!headBone && (/head|bip01_head|mixamorighead/i.test(boneName) || boneName.includes('head'))) headBone = obj;
                    if (!neckBone && (/neck|bip01_neck/i.test(boneName) || boneName.includes('neck'))) neckBone = obj;
                }
            });

            roomGroup.add(model);
            currentModel = model;
            modelStatusEl.textContent = name;

            candleLight.position.set(-3.57, -0.9, 1.92);
            magicLight.position.set(-1.19, -0.6, 1.63);

            buildCalculatedSpline();

            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(model);
                gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
            }

            hideLoader();
            showToast('✨ Yennefer\\'s Chamber loaded!');
        }

        function loadGLBFromPath(path, name = 'Yennefer\\'s Chamber') {
            loaderOverlay.classList.remove('hidden');
            progressBar.style.width = '10%';
            progressText.textContent = \`Connecting to 3D scene...\`;

            gltfLoader.load(
                path,
                (gltf) => applyModelToScene(gltf, name),
                (xhr) => {
                    if (xhr.lengthComputable) updateProgress(xhr.loaded, xhr.total);
                    else updateProgress(xhr.loaded, 62217480);
                },
                (error) => {
                    console.warn(error);
                    createPlaceholderScene();
                    hideLoader();
                    showToast('ℹ️ Drop .GLB file or choose with button');
                }
            );
        }

        loadGLBFromPath('./room.glb', 'Yennefer\\'s Chamber');

        const dropOverlay = document.getElementById('drop-overlay');
        window.addEventListener('dragover', (e) => { e.preventDefault(); dropOverlay.classList.add('active'); });
        window.addEventListener('dragleave', (e) => { if (e.relatedTarget === null) dropOverlay.classList.remove('active'); });
        window.addEventListener('drop', (e) => {
            e.preventDefault();
            dropOverlay.classList.remove('active');
            const file = e.dataTransfer.files[0];
            if (file) {
                if (file.name.toLowerCase().endsWith('.glb') || file.name.toLowerCase().endsWith('.gltf')) {
                    loadGLBFromPath(URL.createObjectURL(file), file.name);
                } else if (file.type.startsWith('audio/')) {
                    loadCustomAudioFile(file);
                }
            }
        });

        const glbInput = document.getElementById('glb-input');
        document.getElementById('load-model-btn').addEventListener('click', () => glbInput.click());
        glbInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) loadGLBFromPath(URL.createObjectURL(file), file.name);
        });

        const mouse = new THREE.Vector2();
        window.addEventListener('pointermove', (e) => {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        const raycaster = new THREE.Raycaster();
        const activeSpringMeshes = [];
        const magicParticlesList = [];

        const sparkGeo = new THREE.BufferGeometry();
        const sparkCount = 600;
        const sparkPositions = new Float32Array(sparkCount * 3);
        const sparkColors = new Float32Array(sparkCount * 3);
        const sparkSizes = new Float32Array(sparkCount);
        sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
        sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));
        sparkGeo.setAttribute('size', new THREE.BufferAttribute(sparkSizes, 1));

        const sparkMat = new THREE.PointsMaterial({
            size: 0.12, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false
        });
        scene.add(new THREE.Points(sparkGeo, sparkMat));

        const clickFlashLight = new THREE.PointLight(0xb866ff, 0, 8, 1.5);
        scene.add(clickFlashLight);

        function triggerMagicBurst(point) {
            clickFlashLight.position.copy(point);
            clickFlashLight.intensity = 10.0;
            for (let i = 0; i < 65; i++) {
                const isGold = Math.random() > 0.45;
                const color = isGold ? new THREE.Color(0xf5b942) : new THREE.Color(0xd888ff);
                const angle = Math.random() * Math.PI * 2;
                const elevation = (Math.random() - 0.5) * Math.PI;
                const speed = 1.5 + Math.random() * 3.5;
                magicParticlesList.push({
                    pos: point.clone(),
                    vel: new THREE.Vector3(Math.cos(elevation) * Math.cos(angle) * speed, Math.sin(elevation) * speed + 1.2, Math.cos(elevation) * Math.sin(angle) * speed),
                    color: color, life: 1.0, decay: 1.4 + Math.random() * 1.6, size: 0.08 + Math.random() * 0.12
                });
            }
            playMagicChimeSound();
        }

        window.addEventListener('click', (e) => {
            if (e.target.closest('.card') || e.target.closest('.player-bar') || e.target.closest('.loader-overlay')) return;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(roomGroup.children, true);
            if (intersects.length > 0) {
                const hit = intersects[0];
                triggerMagicBurst(hit.point);
                if (hit.object && hit.object.isMesh) {
                    let springObj = activeSpringMeshes.find(s => s.mesh === hit.object);
                    if (!springObj) {
                        activeSpringMeshes.push({ mesh: hit.object, baseScale: hit.object.scale.clone(), time: 0, duration: 0.5 });
                    } else springObj.time = 0;
                }
                showToast('✨ Yennefer\\'s magical touch');
            }
        });

        // Audio-reactive dust motes
        const dustCount = 400;
        const dustGeo = new THREE.BufferGeometry();
        const dustPositions = new Float32Array(dustCount * 3);
        const dustColors = new Float32Array(dustCount * 3);
        const dustVelocities = [];

        for (let i = 0; i < dustCount; i++) {
            dustPositions[i * 3] = (Math.random() - 0.5) * 8.5;
            dustPositions[i * 3 + 1] = Math.random() * 3.2 - 1.6;
            dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 7.5;
            const isGold = Math.random() > 0.5;
            const c = isGold ? new THREE.Color(0xf5b942) : new THREE.Color(0xb866ff);
            dustColors[i * 3] = c.r; dustColors[i * 3 + 1] = c.g; dustColors[i * 3 + 2] = c.b;
            dustVelocities.push({ yBase: 0.15 + Math.random() * 0.25, swirlOffset: Math.random() * Math.PI * 2 });
        }
        dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
        dustGeo.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));
        const dustMat = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
        scene.add(new THREE.Points(dustGeo, dustMat));

        // Audio synthesizer
        let audioCtx, analyser, masterGain, customAudio, customSource, isPlaying = false, synthInterval, bassEnergy = 0, midHighEnergy = 0;
        const playBtn = document.getElementById('play-btn');
        const trackTitle = document.getElementById('track-title');
        const volSlider = document.getElementById('vol-slider');
        const reactSlider = document.getElementById('react-slider');
        const eqBars = document.querySelectorAll('.eq-bar');

        function initAudioContext() {
            if (!audioCtx) {
                const AudioClass = window.AudioContext || window.webkitAudioContext;
                audioCtx = new AudioClass();
                analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.82;
                masterGain = audioCtx.createGain();
                masterGain.gain.value = parseFloat(volSlider.value);
                analyser.connect(masterGain);
                masterGain.connect(audioCtx.destination);
            }
            if (audioCtx.state === 'suspended') audioCtx.resume();
        }

        function playMagicChimeSound() {
            if (!audioCtx) return;
            try {
                const t = audioCtx.currentTime;
                [659.25, 783.99, 1046.5, 1318.5].forEach((freq, idx) => {
                    const osc = audioCtx.createOscillator();
                    const noteGain = audioCtx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, t + idx * 0.035);
                    noteGain.gain.setValueAtTime(0.08, t + idx * 0.035);
                    noteGain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.035 + 0.55);
                    osc.connect(noteGain); noteGain.connect(analyser);
                    osc.start(t + idx * 0.035); osc.stop(t + idx * 0.035 + 0.6);
                });
            } catch (e) {}
        }

        const dMinorScale = [146.83, 174.61, 220.0, 261.63, 293.66, 329.63, 349.23, 440.0];
        let noteStep = 0;
        function playSynthStep() {
            if (!audioCtx || !isPlaying) return;
            const t = audioCtx.currentTime;
            if (noteStep % 4 === 0) {
                const bassOsc = audioCtx.createOscillator();
                const bassGain = audioCtx.createGain();
                bassOsc.type = 'triangle';
                const baseFrequencies = [55.0, 65.41, 73.42, 49.0];
                const freq = baseFrequencies[Math.floor(noteStep / 4) % baseFrequencies.length];
                bassOsc.frequency.setValueAtTime(freq, t);
                bassOsc.frequency.exponentialRampToValueAtTime(freq * 0.8, t + 0.45);
                bassGain.gain.setValueAtTime(0.35, t);
                bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
                bassOsc.connect(bassGain); bassGain.connect(analyser);
                bassOsc.start(t); bassOsc.stop(t + 0.7);
            }
            const luteOsc = audioCtx.createOscillator();
            const luteGain = audioCtx.createGain();
            luteOsc.type = 'sawtooth';
            const luteFilter = audioCtx.createBiquadFilter();
            luteFilter.type = 'lowpass';
            luteFilter.frequency.setValueAtTime(1400, t);
            luteFilter.frequency.exponentialRampToValueAtTime(280, t + 0.35);
            const pitch = dMinorScale[[0, 2, 4, 3, 5, 4, 2, 1][noteStep % 8]] * 1.5;
            luteOsc.frequency.setValueAtTime(pitch, t);
            luteGain.gain.setValueAtTime(0.18, t);
            luteGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
            luteOsc.connect(luteFilter); luteFilter.connect(luteGain); luteGain.connect(analyser);
            luteOsc.start(t); luteOsc.stop(t + 0.4);
            noteStep++;
        }

        playBtn.addEventListener('click', () => {
            initAudioContext();
            if (customAudio) {
                if (customAudio.paused) { customAudio.play(); isPlaying = true; playBtn.textContent = '⏸'; }
                else { customAudio.pause(); isPlaying = false; playBtn.textContent = '▶'; }
            } else {
                if (isPlaying) { clearInterval(synthInterval); isPlaying = false; playBtn.textContent = '▶'; }
                else { synthInterval = setInterval(playSynthStep, 230); isPlaying = true; playBtn.textContent = '⏸'; trackTitle.textContent = 'Lilac & Gooseberries (Dark Fantasy Lute)'; }
            }
        });

        function loadCustomAudioFile(file) {
            initAudioContext();
            if (synthInterval) clearInterval(synthInterval);
            if (customAudio) { customAudio.pause(); customAudio.src = ''; }
            customAudio = new Audio();
            customAudio.src = URL.createObjectURL(file);
            customAudio.crossOrigin = 'anonymous';
            if (!customSource) { customSource = audioCtx.createMediaElementSource(customAudio); customSource.connect(analyser); }
            trackTitle.textContent = file.name.replace(/\\.[^/.]+$/, '');
            customAudio.play().then(() => { isPlaying = true; playBtn.textContent = '⏸'; showToast(\`🎵 Now Playing: \${file.name}\`); }).catch(console.warn);
        }

        document.getElementById('file-input').addEventListener('change', (e) => {
            if (e.target.files[0]) loadCustomAudioFile(e.target.files[0]);
        });
        volSlider.addEventListener('input', (e) => {
            if (masterGain) masterGain.gain.value = parseFloat(e.target.value);
        });

        // Traveling Spline Path: always in front of Yennefer (Z < 1.3) looking towards +Z into her face
        function buildCalculatedSpline() {
            const camPoints = [
                new THREE.Vector3(-2.35, -0.95, 1.25),
                new THREE.Vector3(-1.80, -0.85, 0.75),
                new THREE.Vector3(-1.15, -0.90, 0.55), // Front face view
                new THREE.Vector3(-0.55, -0.85, 0.95), // Front side profile
                new THREE.Vector3(-1.65, -0.70, 0.45), // Unicorn view
                new THREE.Vector3(-2.20, -0.30, 0.35)  // Hearth overview
            ];
            const targetPoints = [
                new THREE.Vector3(-3.57, -1.25, 1.92), // Fireplace
                new THREE.Vector3(-2.30, -1.15, 1.75),
                new THREE.Vector3(-1.19, -1.15, 1.63), // Yennefer Face & Eyes
                new THREE.Vector3(-1.19, -1.15, 1.63),
                new THREE.Vector3(-2.65, -0.85, 1.35), // Unicorn
                new THREE.Vector3(-2.40, -1.10, 1.60)
            ];
            camCurve = new THREE.CatmullRomCurve3(camPoints, true, 'centripetal');
            targetCurve = new THREE.CatmullRomCurve3(targetPoints, true, 'centripetal');
        }

        document.getElementById('cam-overview').addEventListener('click', () => transitionCameraTo(new THREE.Vector3(-1.80, -0.40, 0.30), new THREE.Vector3(-2.20, -1.0, 1.60)));
        document.getElementById('cam-yen').addEventListener('click', () => transitionCameraTo(new THREE.Vector3(-1.15, -0.90, 0.55), new THREE.Vector3(-1.19, -1.15, 1.63)));
        document.getElementById('cam-fire').addEventListener('click', () => transitionCameraTo(new THREE.Vector3(-2.35, -0.95, 1.25), new THREE.Vector3(-3.57, -1.25, 1.92)));
        document.getElementById('cam-unicorn').addEventListener('click', () => transitionCameraTo(new THREE.Vector3(-1.65, -0.70, 0.45), new THREE.Vector3(-2.65, -0.85, 1.35)));

        // X-Ray Occlusion
        const occlusionRaycaster = new THREE.Raycaster();
        const occludingMeshesSet = new Set();
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
                if (/yennefer|bath|tub|bubble|fire|feuer/i.test(n)) continue;
                occludingMeshesSet.add(obj);
            }

            roomGroup.traverse((obj) => {
                if (obj.isMesh && obj.material) {
                    const isOccluding = occludingMeshesSet.has(obj);
                    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                    mats.forEach((mat) => {
                        const baseOpacity = mat.userData.baseOpacity !== undefined ? mat.userData.baseOpacity : 1.0;
                        const targetOpacity = isOccluding ? 0.15 : baseOpacity;
                        if (isOccluding) { mat.transparent = true; mat.depthWrite = false; }
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

        document.getElementById('theme-lilac').addEventListener('click', (e) => {
            setActiveThemeBtn(e.target);
            magicLight.color.setHex(0xb866ff); candleLight.color.setHex(0xff9944); moonLight.color.setHex(0x9bb7e0);
            showToast('🌸 Theme: Lilac & Gooseberries');
        });
        document.getElementById('theme-fire').addEventListener('click', (e) => {
            setActiveThemeBtn(e.target);
            candleLight.color.setHex(0xff7722); magicLight.color.setHex(0xffaa44); moonLight.color.setHex(0x556688);
            showToast('🔥 Theme: Cozy Fireside');
        });
        document.getElementById('theme-moon').addEventListener('click', (e) => {
            setActiveThemeBtn(e.target);
            candleLight.color.setHex(0xd48833); magicLight.color.setHex(0x6a5acd); moonLight.color.setHex(0x88ccff); moonLight.intensity = 3.2;
            showToast('🌑 Theme: Skellige Moonlight');
        });

        function setActiveThemeBtn(btn) {
            btn.parentElement.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }

        function showToast(text) {
            const toast = document.getElementById('toast');
            toast.textContent = text; toast.classList.add('show');
            clearTimeout(toast._timer);
            toast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
        }

        const clock = new THREE.Clock();
        const audioData = new Uint8Array(128);
        const fpsCounter = document.getElementById('fps-counter');
        let frameCount = 0, lastFpsUpdate = 0;

        function animate() {
            requestAnimationFrame(animate);
            const dt = Math.min(clock.getDelta(), 0.1);
            const t = clock.getElapsedTime();

            frameCount++;
            if (t - lastFpsUpdate > 0.5) {
                fpsCounter.textContent = Math.round(frameCount / (t - lastFpsUpdate));
                frameCount = 0; lastFpsUpdate = t;
            }

            bassEnergy = 0; midHighEnergy = 0;
            if (analyser && isPlaying) {
                analyser.getByteFrequencyData(audioData);
                let bassSum = 0; for (let i = 0; i < 8; i++) bassSum += audioData[i];
                bassEnergy = (bassSum / (8 * 255));
                let midSum = 0; for (let i = 9; i < 48; i++) midSum += audioData[i];
                midHighEnergy = (midSum / (39 * 255));
                eqBars.forEach((bar, idx) => bar.style.height = (4 + (audioData[idx * 8] / 255) * 18).toFixed(1) + 'px');
            } else {
                eqBars.forEach(bar => bar.style.height = '4px');
            }
            const sensitivity = parseFloat(reactSlider.value);

            if (mixer) mixer.update(dt);
            if (headBone || neckBone) {
                const bone = headBone || neckBone;
                bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, mouse.x * 0.45, dt * 5.0);
                bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, -mouse.y * 0.28, dt * 5.0);
            }

            // Inactivity check: if user doesn't touch camera for 30s, start traveling tour
            userInactiveTimer += dt;
            if (userInactiveTimer >= INACTIVITY_THRESHOLD) {
                isAutoTraveling = true;
                toggleAutoCamBtn.textContent = '🎬 Auto Tour: ACTIVE';
                toggleAutoCamBtn.classList.add('active');
            }

            if (manualTransition) {
                manualTransition.time += dt;
                const progress = Math.min(1.0, manualTransition.time / manualTransition.duration);
                const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                camera.position.lerpVectors(manualTransition.startPos, manualTransition.endPos, ease);
                controls.target.lerpVectors(manualTransition.startTarget, manualTransition.endTarget, ease);
                if (progress >= 1.0) manualTransition = null;
            } else if (isAutoTraveling && camCurve && targetCurve) {
                travelingProgress = (travelingProgress + dt * 0.016) % 1.0;
                const targetCamPos = camCurve.getPointAt(travelingProgress);
                const targetLookAt = targetCurve.getPointAt(travelingProgress);
                camera.position.lerp(targetCamPos, dt * 1.5);
                controls.target.lerp(targetLookAt, dt * 1.5);
            }

            controls.update();
            updateOcclusion(dt);

            const candleFlicker = Math.sin(t * 11) * 0.15 + Math.sin(t * 23.3) * 0.1;
            candleLight.intensity = Math.max(0.4, 3.8 + candleFlicker + bassEnergy * sensitivity * 4.2);
            magicLight.intensity = Math.max(0.2, 2.8 + Math.sin(t * 2.4) * 0.35 + midHighEnergy * sensitivity * 4.5);
            if (clickFlashLight.intensity > 0.05) clickFlashLight.intensity = Math.max(0, clickFlashLight.intensity - dt * 22.0);

            // Particles
            for (let i = magicParticlesList.length - 1; i >= 0; i--) {
                const p = magicParticlesList[i];
                p.pos.addScaledVector(p.vel, dt);
                p.vel.y -= dt * 4.0; p.vel.multiplyScalar(0.96); p.life -= dt * p.decay;
                if (p.life <= 0) magicParticlesList.splice(i, 1);
            }
            const sparkPosAttr = sparkGeo.attributes.position;
            const sparkColAttr = sparkGeo.attributes.color;
            const sparkSizeAttr = sparkGeo.attributes.size;
            for (let i = 0; i < sparkCount; i++) {
                if (i < magicParticlesList.length) {
                    const p = magicParticlesList[i];
                    sparkPosAttr.setXYZ(i, p.pos.x, p.pos.y, p.pos.z);
                    sparkColAttr.setXYZ(i, p.color.r * p.life, p.color.g * p.life, p.color.b * p.life);
                    sparkSizeAttr.setX(i, p.size * p.life);
                } else {
                    sparkPosAttr.setXYZ(i, 0, -999, 0);
                    sparkSizeAttr.setX(i, 0);
                }
            }
            sparkPosAttr.needsUpdate = true; sparkColAttr.needsUpdate = true; sparkSizeAttr.needsUpdate = true;

            // Spring mesh bounce
            for (let i = activeSpringMeshes.length - 1; i >= 0; i--) {
                const s = activeSpringMeshes[i];
                s.time += dt;
                const progress = s.time / s.duration;
                if (progress >= 1.0) { s.mesh.scale.copy(s.baseScale); activeSpringMeshes.splice(i, 1); }
                else {
                    const factor = 1.0 + 0.08 * Math.sin(progress * Math.PI * 4) * Math.exp(-progress * 4.5);
                    s.mesh.scale.set(s.baseScale.x * factor, s.baseScale.y * factor, s.baseScale.z * factor);
                }
            }

            // Floating dust
            const dustPosAttr = dustGeo.attributes.position;
            const bassLift = bassEnergy * sensitivity * 2.8;
            for (let i = 0; i < dustCount; i++) {
                let py = dustPosAttr.getY(i) + (dustVelocities[i].yBase + bassLift) * dt;
                if (py > 1.6) py = -1.5;
                dustPosAttr.setY(i, py);
                dustPosAttr.setX(i, dustPosAttr.getX(i) + Math.sin(t * 0.8 + dustVelocities[i].swirlOffset) * 0.003);
            }
            dustPosAttr.needsUpdate = true;
            dustMat.size = 0.05 + bassEnergy * sensitivity * 0.035;

            composer.render();
        }
        animate();

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            composer.setSize(window.innerWidth, window.innerHeight);
        });
    </script>
</body>
</html>`;

    fs.writeFileSync('index.html', before + newScript, 'utf8');
    console.log('SUCCESS: Desktop index.html updated!');
}
