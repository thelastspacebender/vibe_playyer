// js/youtube.js - YouTube Streamer & MP3 Downloader UI Controller

import { getCurrentLanguage, TRANSLATIONS } from './i18n.js';

function t(key) {
    const lang = getCurrentLanguage() || 'en';
    const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    return dict[key] || key;
}

export function initYouTubeModal(callbacks = {}) {
    const { onPlayTrack } = callbacks;

    const modal = document.getElementById('yt-modal');
    if (!modal) return;

    const introBtn = document.getElementById('introYtBtn');
    const uiBtn = document.getElementById('uiYtBtn');
    const closeBtn = document.getElementById('ytCloseBtn');
    const backdrop = document.getElementById('ytModalBackdrop');
    const urlInput = document.getElementById('ytUrlInput');
    const fetchBtn = document.getElementById('ytFetchBtn');
    const errorEl = document.getElementById('ytErrorMsg');
    const loadingEl = document.getElementById('ytLoading');
    const loadingText = document.getElementById('ytLoadingText');
    const previewCard = document.getElementById('ytPreviewCard');
    const cardThumb = document.getElementById('ytCardThumb');
    const cardDuration = document.getElementById('ytCardDuration');
    const cardTitle = document.getElementById('ytCardTitle');
    const cardChannel = document.getElementById('ytCardChannel');
    const streamBtn = document.getElementById('ytStreamBtn');
    const downloadBtn = document.getElementById('ytDownloadBtn');
    const progressWrap = document.getElementById('ytProgressWrap');
    const progressStatus = document.getElementById('ytProgressStatus');
    const progressPct = document.getElementById('ytProgressPct');
    const progressBar = document.getElementById('ytProgressBar');
    const progressSpeed = document.getElementById('ytProgressSpeed');
    const progressEta = document.getElementById('ytProgressEta');
    const libList = document.getElementById('ytLibraryList');
    const refreshLibBtn = document.getElementById('ytRefreshLibBtn');

    let currentVideo = null;
    let pollInterval = null;

    function openModal() {
        modal.hidden = false;
        errorEl.hidden = true;
        if (urlInput) {
            urlInput.focus();
            if (urlInput.value.trim() && !currentVideo) {
                handleFetch();
            }
        }
        loadLibrary();
    }

    function closeModal() {
        modal.hidden = true;
        errorEl.hidden = true;
    }

    function showError(msg) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
        loadingEl.hidden = true;
    }

    function clearError() {
        errorEl.hidden = true;
        errorEl.textContent = '';
    }

    function isValidYoutubeUrl(url) {
        return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i.test(url.trim());
    }

    async function handleFetch() {
        const rawUrl = urlInput.value.trim();
        if (!rawUrl) {
            showError(t('yt_invalid_url'));
            return;
        }
        if (!isValidYoutubeUrl(rawUrl)) {
            showError(t('yt_invalid_url'));
            return;
        }

        clearError();
        previewCard.hidden = true;
        loadingEl.hidden = false;
        loadingText.textContent = t('yt_loading_info');

        try {
            const res = await fetch(`/api/yt/info?url=${encodeURIComponent(rawUrl)}`);
            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.error || t('yt_error_fetching'));
            }

            currentVideo = data;
            loadingEl.hidden = true;

            cardTitle.textContent = data.title;
            cardChannel.textContent = data.uploader;
            cardDuration.textContent = data.duration;
            cardThumb.src = data.thumbnail || '';
            previewCard.hidden = false;
        } catch (err) {
            showError(err.message || t('yt_error_fetching'));
        }
    }

    function handleStream() {
        if (!currentVideo) return;
        const streamUrl = `/api/yt/stream?url=${encodeURIComponent(currentVideo.url)}`;
        if (onPlayTrack) {
            onPlayTrack(streamUrl, currentVideo.title);
        }
        closeModal();
    }

    async function handleDownload() {
        if (!currentVideo) return;
        clearError();
        progressWrap.hidden = false;
        progressBar.style.width = '0%';
        progressPct.textContent = '0%';
        progressStatus.textContent = 'Starting download...';
        progressSpeed.textContent = '';
        progressEta.textContent = '';

        downloadBtn.disabled = true;
        downloadBtn.style.opacity = '0.5';

        try {
            const res = await fetch('/api/yt/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: currentVideo.url })
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.error || 'Failed to start download');
            }

            const jobId = data.jobId;
            if (pollInterval) clearInterval(pollInterval);

            pollInterval = setInterval(async () => {
                try {
                    const pollRes = await fetch(`/api/yt/progress?jobId=${jobId}`);
                    const job = await pollRes.json();

                    if (job.status === 'downloading') {
                        progressBar.style.width = `${job.progress}%`;
                        progressPct.textContent = `${job.progress.toFixed(0)}%`;
                        progressStatus.textContent = `Downloading (${job.speed || ''})`;
                        progressSpeed.textContent = job.speed || '';
                        progressEta.textContent = job.eta ? `ETA: ${job.eta}` : '';
                    } else if (job.status === 'converting') {
                        progressBar.style.width = '95%';
                        progressPct.textContent = '95%';
                        progressStatus.textContent = 'Converting to MP3 (320 kbps)...';
                        progressSpeed.textContent = 'ffmpeg';
                        progressEta.textContent = '';
                    } else if (job.status === 'completed') {
                        clearInterval(pollInterval);
                        progressBar.style.width = '100%';
                        progressPct.textContent = '100%';
                        progressStatus.textContent = 'Complete! Saved to library.';
                        downloadBtn.disabled = false;
                        downloadBtn.style.opacity = '1';

                        await loadLibrary();

                        if (onPlayTrack && job.relPath) {
                            setTimeout(() => {
                                onPlayTrack(`/${job.relPath}`, job.title || currentVideo.title);
                                closeModal();
                            }, 800);
                        }
                    } else if (job.status === 'error') {
                        clearInterval(pollInterval);
                        downloadBtn.disabled = false;
                        downloadBtn.style.opacity = '1';
                        showError(job.error || 'Download failed');
                    }
                } catch (e) {
                    clearInterval(pollInterval);
                    downloadBtn.disabled = false;
                    downloadBtn.style.opacity = '1';
                }
            }, 600);

        } catch (err) {
            downloadBtn.disabled = false;
            downloadBtn.style.opacity = '1';
            showError(err.message || 'Download error');
        }
    }

    async function loadLibrary() {
        if (!libList) return;
        try {
            const res = await fetch('/api/tracks');
            const data = await res.json();
            libList.innerHTML = '';

            if (!data.tracks || data.tracks.length === 0) {
                libList.innerHTML = `<div style="font-size:12px;color:#7e8ab5;padding:8px 4px;">${t('yt_library_empty')}</div>`;
                return;
            }

            data.tracks.forEach(track => {
                const item = document.createElement('div');
                item.className = 'yt-lib-item';
                item.innerHTML = `
                    <div class="yt-lib-item-info">
                        <span class="yt-lib-item-name" title="${track.name}">${track.name}</span>
                        <span class="yt-lib-item-size">${track.sizeMB} MB · MP3</span>
                    </div>
                    <span class="yt-lib-item-play">▶</span>
                `;
                item.addEventListener('click', () => {
                    if (onPlayTrack) {
                        onPlayTrack(`/${track.relPath}`, track.name);
                    }
                    closeModal();
                });
                libList.appendChild(item);
            });
        } catch (e) {
            console.warn('Could not load track library:', e);
        }
    }

    // Attach Event Listeners
    if (introBtn) introBtn.addEventListener('click', openModal);
    if (uiBtn) uiBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);

    if (fetchBtn) fetchBtn.addEventListener('click', handleFetch);
    if (urlInput) {
        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleFetch();
        });
        urlInput.addEventListener('paste', () => {
            setTimeout(handleFetch, 50);
        });
    }

    if (streamBtn) streamBtn.addEventListener('click', handleStream);
    if (downloadBtn) downloadBtn.addEventListener('click', handleDownload);
    if (refreshLibBtn) refreshLibBtn.addEventListener('click', loadLibrary);

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) {
            closeModal();
        }
    });

    return {
        openModal,
        closeModal,
        loadLibrary
    };
}
