// js/main.js - Unified Multi-Universe Application Orchestrator

import {
    init2D,
    resize2D,
    generate2D,
    render2D
} from './engine2d.js';

import {
    ensureAudio,
    startAudio,
    pauseAudio,
    toggleAudio,
    setVolume,
    setTracks,
    updateAudioLevels,
    getAudioState
} from './audio.js';

import {
    initCore3D,
    setWorld,
    hideCore3D,
    renderCore3D,
    registerWorld
} from './world3d/core3d.js';

import * as yenneferModule from './world3d/yennefer.js';
import * as hogwartsModule from './world3d/hogwarts.js';
import * as lotrModule from './world3d/lotr.js';
import * as starwarsModule from './world3d/starwars.js';

import {
    initI18n,
    setLanguage,
    getCurrentLanguage
} from './i18n.js';

import { initYouTubeModal } from './youtube.js';

// DOM References
const sceneCanvas = document.getElementById('scene');
const threeContainer = document.getElementById('three-container');
const introEl = document.getElementById('intro');
const uiEl = document.getElementById('ui');
const playBtn = document.getElementById('playBtn');
const pickBtn = document.getElementById('pickBtn');
const volInput = document.getElementById('vol');
const reactInput = document.getElementById('react');
const worldSelect = document.getElementById('world');
const cycleSelect = document.getElementById('cycle');
const stopAfterSelect = document.getElementById('stopAfter');
const trackNameEl = document.getElementById('trackName');
const clockEl = document.getElementById('clock');
const fsBtn = document.getElementById('fsBtn');
const fileInput = document.getElementById('file');
const dropEl = document.getElementById('drop');
const playIcon = document.getElementById('playIcon');
const langSelect = document.getElementById('langSelect');

// Application State
let currentScene = 'city';
let lastTime = performance.now();
let appTime = 0;
let uiHideTimer = 0;
let autoStopHours = 4;
let playStartTime = 0;

// Register 3D Worlds
registerWorld('yennefer', yenneferModule);
registerWorld('harry_potter', hogwartsModule);
registerWorld('lotr', lotrModule);
registerWorld('star_wars', starwarsModule);

const IS_3D = (w) => ['yennefer', 'harry_potter', 'lotr', 'star_wars'].includes(w);

function initApp() {
    // 0. Initialize Internationalization (Default: English)
    initI18n();

    // 1. Initialize 2D Canvas Engine
    if (sceneCanvas) {
        init2D(sceneCanvas);
        resize2D(window.innerWidth, window.innerHeight);
        generate2D(currentScene);
    }

    // 2. Setup Events
    setupEventListeners();

    // 3. Set Initial Volume
    if (volInput) {
        setVolume(parseFloat(volInput.value) / 100);
    }

    // 4. Start Render Loop
    requestAnimationFrame(renderLoop);
}

function switchWorld(newWorld) {
    currentScene = newWorld;
    if (worldSelect) worldSelect.value = newWorld;

    if (IS_3D(newWorld)) {
        if (sceneCanvas) sceneCanvas.style.display = 'none';
        if (threeContainer) threeContainer.style.display = 'block';
        setWorld(newWorld);
    } else {
        hideCore3D();
        const hpPanel = document.getElementById('hp-panel');
        if (hpPanel) hpPanel.style.display = 'none';
        const lotrPanel = document.getElementById('lotr-panel');
        if (lotrPanel) lotrPanel.style.display = 'none';
        const swPanel = document.getElementById('sw-panel');
        if (swPanel) swPanel.style.display = 'none';
        if (threeContainer) threeContainer.style.display = 'none';
        if (sceneCanvas) sceneCanvas.style.display = 'block';
        generate2D(newWorld);
    }
}

function setupEventListeners() {
    // Window Resize
    window.addEventListener('resize', () => {
        resize2D(window.innerWidth, window.innerHeight);
        if (!IS_3D(currentScene)) {
            generate2D(currentScene);
        }
    });

    // Play/Pause
    const handlePlayClick = () => {
        ensureAudio();
        toggleAudio();
        if (introEl) {
            introEl.classList.add('hide');
            introEl.hidden = true;
            introEl.style.display = 'none';
        }
        if (playStartTime === 0) playStartTime = performance.now();
    };

    if (playBtn) playBtn.addEventListener('click', handlePlayClick);
    if (pickBtn) pickBtn.addEventListener('click', handlePlayClick);

    // Volume Slider
    if (volInput) {
        volInput.addEventListener('input', (e) => {
            setVolume(parseFloat(e.target.value) / 100);
        });
    }

    // World Selector
    if (worldSelect) {
        worldSelect.addEventListener('change', (e) => {
            switchWorld(e.target.value);
        });
    }

    // Language Selector (Dropdown in Menu)
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
    }

    // Language Pills (Intro Screen & anywhere else)
    document.querySelectorAll('.lang-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            if (lang) setLanguage(lang);
        });
    });

    // Auto Stop Duration
    if (stopAfterSelect) {
        stopAfterSelect.addEventListener('change', (e) => {
            autoStopHours = parseFloat(e.target.value);
        });
    }

    // Fullscreen Toggle
    if (fsBtn) {
        fsBtn.addEventListener('click', toggleFullscreen);
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        if (e.code === 'Space') {
            e.preventDefault();
            handlePlayClick();
        } else if (e.code === 'KeyF') {
            e.preventDefault();
            toggleFullscreen();
        }
    });

    // Mouse Movement UI Auto-Hide
    window.addEventListener('pointermove', resetUITimer);
    window.addEventListener('pointerdown', resetUITimer);

    // File Input
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) loadUserTrack(file);
        });
    }

    // Drag and Drop
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (dropEl) dropEl.hidden = false;
    });

    window.addEventListener('dragleave', (e) => {
        if (e.relatedTarget === null && dropEl) dropEl.hidden = true;
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        if (dropEl) dropEl.hidden = true;
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            loadUserTrack(e.dataTransfer.files[0]);
        }
    });

    // YouTube Integration
    initYouTubeModal({
        onPlayTrack: (url, title) => {
            setTracks([url], title);
            startAudio();
            if (introEl) {
                introEl.classList.add('hide');
                introEl.hidden = true;
                introEl.style.display = 'none';
            }
            if (trackNameEl) trackNameEl.textContent = title;
            if (playStartTime === 0) playStartTime = performance.now();
        }
    });
}

function loadUserTrack(file) {
    const url = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    setTracks([url], cleanName);
    startAudio();
    if (introEl) introEl.classList.add('hide');
    if (trackNameEl) trackNameEl.textContent = cleanName;
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
}

function resetUITimer() {
    uiHideTimer = 0;
    if (uiEl) uiEl.classList.remove('fade-out');
}

function updateClock(elapsedSeconds) {
    if (!clockEl) return;
    const h = Math.floor(elapsedSeconds / 3600);
    const m = Math.floor((elapsedSeconds % 3600) / 60);
    const s = Math.floor(elapsedSeconds % 60);
    const pad = (n) => (n < 10 ? '0' + n : n);
    clockEl.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function renderLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;
    appTime += dt;

    // 1. Audio Analysis Update
    const reactVal = reactInput ? parseFloat(reactInput.value) : 65;
    updateAudioLevels(dt, appTime, reactVal);
    const audio = getAudioState();

    // 2. Play/Pause UI Sync
    if (playIcon) {
        if (audio.playing) {
            playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        } else {
            playIcon.innerHTML = '<path d="M7 4.5v15l13-7.5z"/>';
        }
    }

    // 3. Auto-Stop Check
    if (audio.playing && autoStopHours > 0 && playStartTime > 0) {
        const playedSec = (timestamp - playStartTime) / 1000;
        if (playedSec >= autoStopHours * 3600) {
            pauseAudio();
            playStartTime = 0;
        }
    }

    // 4. Update Time Clock
    if (audio.playing) {
        updateClock(audio.currentTime);
    }

    // 5. Auto-Hide UI after 3.5s inactivity
    uiHideTimer += dt;
    if (uiHideTimer > 3.5 && uiEl && audio.playing) {
        uiEl.classList.add('fade-out');
    }

    // 6. World Rendering
    if (IS_3D(currentScene)) {
        renderCore3D(dt, appTime, audio);
    } else {
        const cycleMode = cycleSelect ? cycleSelect.value : '1800';
        render2D(dt, appTime, audio, currentScene, cycleMode, reactVal);
    }

    requestAnimationFrame(renderLoop);
}

// Start keep-alive heartbeat for Standalone Server (server automatically shuts down 5 minutes after browser window is closed)
function startServerHeartbeat() {
    const ping = () => {
        fetch('/api/heartbeat', { method: 'POST', keepalive: true }).catch(() => {});
    };
    ping();
    setInterval(ping, 15000);
}

// Start on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initApp();
        startServerHeartbeat();
    });
} else {
    initApp();
    startServerHeartbeat();
}
