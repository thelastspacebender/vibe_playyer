// js/audio.js - Web Audio API, Analyser, IndexedDB and Track Management

const NB = 24;
export const lvl = new Float32Array(NB);
export let bass = 0, highs = 0, energy = 0;

let actx = null, analyser = null, gainNode = null, fbuf = null;
const BUILTIN = [];
const els = [new Audio(), new Audio()];
els.forEach(a => {
    a.preload = 'auto';
    a.setAttribute('playsinline', '');
    a.crossOrigin = 'anonymous';
});
let active = els[0], tracks = [], cur = 0;
let fileLoaded = false, playing = false, fading = false, objURL = null;
let acc = 0, playStart = 0, finishedNote = '';
let baseName = 'Cities Skylines 2';

export function getAudioState() {
    return {
        playing,
        bass,
        highs,
        energy,
        lvl,
        baseName,
        finishedNote,
        currentTime: active && fileLoaded ? active.currentTime : 0,
        duration: active && fileLoaded ? active.duration : 0,
        activeElement: active,
        curTrackIndex: cur,
        tracks
    };
}

export function ensureAudio() {
    if (actx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = new AC();
    analyser = actx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.82;
    fbuf = new Uint8Array(analyser.frequencyBinCount);
    gainNode = actx.createGain();

    els.forEach(el => {
        try {
            const src = actx.createMediaElementSource(el);
            src.connect(gainNode);
        } catch (e) {}
    });
    gainNode.connect(analyser);
    analyser.connect(actx.destination);
}

export function setVolume(vol) {
    if (gainNode) {
        gainNode.gain.value = Math.max(0, Math.min(1, vol));
    }
}

export function updateAudioLevels(dt, t, react) {
    const kd = 1 - Math.exp(-dt * 14);
    if (analyser && playing && fileLoaded) {
        analyser.getByteFrequencyData(fbuf);
        const nBins = fbuf.length;
        const b = () => {
            let s = 0, c = 0;
            for (let i = 1; i < 7; i++) { s += fbuf[i]; c++; }
            return (s / c) / 255;
        };
        const h = () => {
            let s = 0, c = 0;
            for (let i = Math.round(nBins * .35); i < Math.round(nBins * .8); i++) { s += fbuf[i]; c++; }
            return (s / c) / 255;
        };
        bass += (b() - bass) * kd;
        highs += (h() - highs) * kd;
        energy = bass * .65 + highs * .35;

        for (let i = 0; i < NB; i++) {
            const f0 = 28 * Math.pow(11000 / 28, i / NB);
            const f1 = 28 * Math.pow(11000 / 28, (i + 1) / NB);
            const i0 = Math.max(1, Math.min(nBins - 2, Math.round(f0 / (actx.sampleRate / 2) * nBins)));
            const i1 = Math.max(i0 + 1, Math.min(nBins - 1, Math.round(f1 / (actx.sampleRate / 2) * nBins)));
            let sum = 0;
            for (let j = i0; j < i1; j++) sum += fbuf[j];
            const raw = (sum / (i1 - i0)) / 255;
            lvl[i] += (raw - lvl[i]) * kd;
        }
    } else if (playing) {
        const amp = 0.28;
        for (let i = 0; i < NB; i++) {
            const n = 0.45 + amp * Math.sin(t * 1.8 + i * 1.1) * Math.cos(t * 0.9 + i * 0.6);
            lvl[i] += (n - lvl[i]) * kd;
        }
        bass += (0.45 + 0.15 * Math.sin(t * 2.5) - bass) * kd;
        highs += (0.35 + 0.12 * Math.cos(t * 3.2) - highs) * kd;
        energy = bass * 0.65 + highs * 0.35;
    } else {
        bass += (0 - bass) * kd;
        highs += (0 - highs) * kd;
        energy += (0 - energy) * kd;
        for (let i = 0; i < NB; i++) {
            lvl[i] += (0 - lvl[i]) * kd;
        }
    }
}

// Track Management
function other() { return active === els[0] ? els[1] : els[0]; }

export function setTracks(list, name) {
    if (!list || list.length === 0) return;
    tracks = list;
    baseName = name || 'Audio Track';
    cur = 0;
    active.src = tracks[0];
    active.load();
    const o = other();
    if (tracks.length > 1) { o.loop = false; o.src = tracks[1]; o.load(); }
    else { o.removeAttribute('src'); }
    fileLoaded = true;
    acc = 0;
    finishedNote = '';
}

export function startAudio() {
    ensureAudio();
    if (actx && actx.state === 'suspended') actx.resume();
    if (!fileLoaded || tracks.length === 0) {
        playing = true;
        return Promise.resolve();
    }
    return active.play().then(() => {
        playing = true;
    }).catch(err => {
        console.warn('Audio playback deferred, visualizer active:', err);
        playing = true;
    });
}

export function pauseAudio() {
    active.pause();
    playing = false;
}

export function toggleAudio() {
    if (playing) {
        pauseAudio();
    } else {
        startAudio();
    }
}

// IndexedDB Storage
let dbP = null;
function idb() {
    if (!dbP) {
        dbP = new Promise((res, rej) => {
            const r = indexedDB.open('skyline_music', 1);
            r.onupgradeneeded = () => r.result.createObjectStore('tracks');
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
        });
    }
    return dbP;
}

export async function saveTrack(world, file) {
    try {
        const db = await idb();
        await new Promise((res, rej) => {
            const tx = db.transaction('tracks', 'readwrite');
            tx.objectStore('tracks').put({ name: file.name, blob: file }, world);
            tx.oncomplete = res;
            tx.onerror = () => rej(tx.error);
        });
    } catch (e) {}
}

export async function getTrack(world) {
    try {
        const db = await idb();
        return await new Promise(res => {
            const rq = db.transaction('tracks').objectStore('tracks').get(world);
            rq.onsuccess = () => res(rq.result || null);
            rq.onerror = () => res(null);
        });
    } catch (e) {
        return null;
    }
}

export async function applyWorldMusic(scene, autoplay) {
    const world = scene;
    if (world === 'city') {
        if (tracks !== BUILTIN) {
            setTracks(BUILTIN, 'Cities Skylines 2');
            if (autoplay) startAudio();
        }
        return;
    }

    const rec = await getTrack(world);
    if (rec && rec.blob) {
        if (objURL) URL.revokeObjectURL(objURL);
        objURL = URL.createObjectURL(rec.blob);
        setTracks([objURL], rec.name.replace(/\.[^.]+$/, ''));
        if (autoplay) startAudio();
    }
}

export function loadAudioFile(file, scene) {
    if (!file) return;
    if (objURL) URL.revokeObjectURL(objURL);
    objURL = URL.createObjectURL(file);
    setTracks([objURL], file.name.replace(/\.[^.]+$/, ''));
    if (scene !== 'city') saveTrack(scene, file);
    startAudio();
}

// Seamless gapless track chaining
els.forEach(el => {
    el.addEventListener('playing', () => { if (el === active) { playing = true; if (!playStart) playStart = performance.now(); } });
    el.addEventListener('pause', () => { if (el === active && !fading) playing = false; });
    el.addEventListener('ended', () => {
        if (el !== active) return;
        acc += el.duration || 0;
        if (tracks.length === 1) { el.currentTime = 0; el.play(); return; }
        const nextIdx = (cur + 1) % tracks.length;
        const nxt = other();
        active = nxt;
        cur = nextIdx;
        active.play();
        const prep = (nextIdx + 1) % tracks.length;
        el.loop = false;
        el.src = tracks[prep];
        el.load();
    });
});
