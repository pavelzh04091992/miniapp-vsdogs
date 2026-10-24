import type Hls from 'hls.js';

type PlaybackMode = 'hls-js' | 'hls-native' | 'mp4';

type WebkitVideoElement = HTMLVideoElement & {
  disablePictureInPicture?: boolean;
  disableRemotePlayback?: boolean;
  webkitEnterFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

const HLS_MIME_TYPE = 'application/vnd.apple.mpegurl';

export function setupLessonVideoPlayer(): (() => void) | null {
  const player = document.querySelector<HTMLElement>('[data-video-player]');

  if (!player) {
    return null;
  }

  const video = player.querySelector<HTMLVideoElement>('[data-video-element]');
  const videoId = player.dataset.videoId;

  if (!video || !videoId) {
    return null;
  }

  const safeVideoId = encodeURIComponent(videoId);
  const preferredSource = player.dataset.videoSource === 'mp4' ? 'mp4' : 'hls';
  const hlsUrl = `/media/${safeVideoId}/master.m3u8`;
  const mp4Url = `/media/${safeVideoId}/video.mp4`;
  const abortController = new AbortController();
  const listenerOptions = { signal: abortController.signal };
  const playButtons = player.querySelectorAll<HTMLButtonElement>('[data-video-action="toggle"]');
  const muteButton = player.querySelector<HTMLButtonElement>('[data-video-action="mute"]');
  const fullscreenButton = player.querySelector<HTMLButtonElement>('[data-video-action="fullscreen"]');
  const seekInput = player.querySelector<HTMLInputElement>('[data-video-seek]');
  const volumeInput = player.querySelector<HTMLInputElement>('[data-video-volume]');
  const qualityControl = player.querySelector<HTMLElement>('[data-video-quality-control]');
  const qualitySelect = player.querySelector<HTMLSelectElement>('[data-video-quality]');
  const speedSelect = player.querySelector<HTMLSelectElement>('[data-video-speed]');
  const currentTime = player.querySelector<HTMLElement>('[data-video-current-time]');
  const duration = player.querySelector<HTMLElement>('[data-video-duration]');
  const status = player.querySelector<HTMLElement>('.lesson-player__status');
  const statusText = player.querySelector<HTMLElement>('[data-video-status-text]');
  let hls: Hls | null = null;
  let playbackMode: PlaybackMode = 'mp4';
  let triedMp4Fallback = false;
  let attemptedMediaRecovery = false;
  let usedCssFullscreen = false;
  let hlsStarted = false;
  let isPrimingFirstHlsSegment = false;
  const previousBodyOverflow = document.body.style.overflow;

  const posterUrl = `/media/${safeVideoId}/poster.webp`;
  video.poster = posterUrl;
  const restrictedVideo = video as WebkitVideoElement;
  video.controls = false;
  video.playsInline = true;
  restrictedVideo.disablePictureInPicture = true;
  restrictedVideo.disableRemotePlayback = true;
  video.volume = 0.85;

  const setLoading = (loading: boolean): void => {
    player.classList.toggle('lesson-player--loading', loading);
    if (status) {
      status.hidden = !loading;
    }
  };

  const showError = (): void => {
    setLoading(false);
    player.classList.add('lesson-player--error');

    if (status) {
      status.hidden = false;
    }

    if (statusText) {
      statusText.textContent = 'Видео пока недоступно';
    }
  };

  const loadMp4Fallback = (): void => {
    if (triedMp4Fallback) {
      showError();
      return;
    }

    triedMp4Fallback = true;
    playbackMode = 'mp4';
    hls?.destroy();
    hls = null;
    qualityControl?.setAttribute('hidden', '');
    video.preload = 'metadata';
    video.src = mp4Url;
    video.load();
  };

  const populateQualityOptions = (): void => {
    if (!hls || !qualitySelect || !qualityControl) {
      return;
    }

    const levels = hls.levels
      .map((level, index) => ({ index, height: level.height, bitrate: level.bitrate }))
      .filter((level, index, allLevels) => {
        return allLevels.findIndex((candidate) => candidate.height === level.height) === index;
      })
      .sort((left, right) => right.height - left.height);

    qualitySelect.replaceChildren(new Option('Авто', '-1'));

    levels.forEach((level) => {
      const label = level.height > 0 ? `${level.height}p` : `${Math.round(level.bitrate / 1000)} кбит/с`;
      qualitySelect.add(new Option(label, String(level.index)));
    });

    qualityControl.hidden = levels.length < 2;
  };

  const loadSource = async (): Promise<void> => {
    setLoading(true);
    player.classList.remove('lesson-player--error');

    if (preferredSource === 'mp4') {
      loadMp4Fallback();
      return;
    }

    if (video.canPlayType(HLS_MIME_TYPE)) {
      playbackMode = 'hls-native';
      video.preload = 'auto';
      video.src = hlsUrl;
      video.load();
      return;
    }

    try {
      const { default: HlsPlayer } = await import('hls.js');

      if (abortController.signal.aborted) {
        return;
      }

      if (!HlsPlayer.isSupported()) {
        loadMp4Fallback();
        return;
      }

      playbackMode = 'hls-js';
      hls = new HlsPlayer({
        autoStartLoad: false,
        capLevelToPlayerSize: true,
        capLevelOnFPSDrop: true,
        backBufferLength: 15,
        maxBufferLength: 15,
        maxMaxBufferLength: 30,
        maxBufferSize: 30 * 1024 * 1024,
        lowLatencyMode: false,
      });

      hls.on(HlsPlayer.Events.MANIFEST_PARSED, () => {
        populateQualityOptions();
        setLoading(false);
        isPrimingFirstHlsSegment = true;
        hls?.startLoad(0);
      });
      hls.on(HlsPlayer.Events.FRAG_BUFFERED, (_event, data) => {
        if (!isPrimingFirstHlsSegment || hlsStarted || data.frag.type !== 'main') {
          return;
        }

        isPrimingFirstHlsSegment = false;
        hls?.stopLoad();
      });
      hls.on(HlsPlayer.Events.ERROR, (_event, data) => {
        if (!data.fatal) {
          return;
        }

        if (data.type === HlsPlayer.ErrorTypes.MEDIA_ERROR && !attemptedMediaRecovery) {
          attemptedMediaRecovery = true;
          hls?.recoverMediaError();
          return;
        }

        loadMp4Fallback();
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
    } catch {
      if (!abortController.signal.aborted) {
        loadMp4Fallback();
      }
    }
  };

  const updatePlaybackState = (): void => {
    const isPlaying = !video.paused && !video.ended;
    player.classList.toggle('lesson-player--playing', isPlaying);
    playButtons.forEach((button) => {
      button.dataset.state = isPlaying ? 'pause' : 'play';
      button.setAttribute('aria-label', isPlaying ? 'Пауза' : 'Воспроизвести');
    });
  };

  const updateTimeline = (): void => {
    const videoDuration = Number.isFinite(video.duration) ? video.duration : 0;
    const progress = videoDuration > 0 ? video.currentTime / videoDuration : 0;

    if (seekInput) {
      seekInput.value = String(Math.round(progress * 1000));
      seekInput.style.setProperty('--video-progress', `${progress * 100}%`);

      if (video.buffered.length > 0 && videoDuration > 0) {
        const buffered = video.buffered.end(video.buffered.length - 1) / videoDuration;
        seekInput.style.setProperty('--video-buffered', `${Math.min(1, buffered) * 100}%`);
      }
    }

    if (currentTime) {
      currentTime.textContent = formatTime(video.currentTime);
    }

    if (duration) {
      duration.textContent = formatTime(videoDuration);
    }
  };

  const updateVolume = (): void => {
    const effectiveVolume = video.muted ? 0 : video.volume;

    if (volumeInput) {
      volumeInput.value = String(Math.round(effectiveVolume * 100));
      volumeInput.style.setProperty('--video-volume', `${effectiveVolume * 100}%`);
    }

    if (muteButton) {
      muteButton.dataset.state = effectiveVolume === 0 ? 'muted' : 'audible';
      muteButton.setAttribute('aria-label', effectiveVolume === 0 ? 'Включить звук' : 'Выключить звук');
    }
  };

  const togglePlayback = async (): Promise<void> => {
    if (video.paused || video.ended) {
      if (video.ended) {
        video.currentTime = 0;
      }

      if (playbackMode === 'hls-js' && hls && !hlsStarted) {
        hlsStarted = true;
        isPrimingFirstHlsSegment = false;
        hls.startLoad(video.currentTime || -1);
        setLoading(true);
      }

      try {
        await video.play();
      } catch {
        updatePlaybackState();
      }
      return;
    }

    video.pause();
  };

  const setCssFullscreen = (expanded: boolean): void => {
    usedCssFullscreen = expanded;
    player.classList.toggle('lesson-player--expanded', expanded);
    document.body.style.overflow = expanded ? 'hidden' : previousBodyOverflow;
    fullscreenButton?.setAttribute('aria-label', expanded ? 'Выйти из полноэкранного режима' : 'На весь экран');
  };

  const toggleFullscreen = async (): Promise<void> => {
    if (document.fullscreenElement === player) {
      await document.exitFullscreen();
      return;
    }

    if (usedCssFullscreen) {
      setCssFullscreen(false);
      return;
    }

    if (player.requestFullscreen) {
      try {
        await player.requestFullscreen();
        return;
      } catch {
        // Fall through to the platform or CSS fullscreen implementation.
      }
    }

    const webkitVideo = video as WebkitVideoElement;

    if (webkitVideo.webkitEnterFullscreen) {
      webkitVideo.webkitEnterFullscreen();
      return;
    }

    setCssFullscreen(true);
  };

  playButtons.forEach((button) => {
    button.addEventListener('click', () => void togglePlayback(), listenerOptions);
  });
  video.addEventListener('click', () => void togglePlayback(), listenerOptions);
  video.addEventListener('play', updatePlaybackState, listenerOptions);
  video.addEventListener('pause', updatePlaybackState, listenerOptions);
  video.addEventListener('ended', updatePlaybackState, listenerOptions);
  video.addEventListener('timeupdate', updateTimeline, listenerOptions);
  video.addEventListener('durationchange', updateTimeline, listenerOptions);
  video.addEventListener('progress', updateTimeline, listenerOptions);
  video.addEventListener('loadstart', () => setLoading(true), listenerOptions);
  video.addEventListener('waiting', () => setLoading(true), listenerOptions);
  video.addEventListener('playing', () => setLoading(false), listenerOptions);
  video.addEventListener('canplay', () => setLoading(false), listenerOptions);
  video.addEventListener(
    'error',
    () => {
      if (playbackMode === 'hls-native') {
        loadMp4Fallback();
        return;
      }

      if (playbackMode === 'mp4') {
        showError();
      }
    },
    listenerOptions,
  );
  video.addEventListener('volumechange', updateVolume, listenerOptions);
  video.addEventListener('contextmenu', (event) => event.preventDefault(), listenerOptions);

  seekInput?.addEventListener(
    'input',
    () => {
      if (Number.isFinite(video.duration)) {
        video.currentTime = (Number(seekInput.value) / 1000) * video.duration;
      }
    },
    listenerOptions,
  );
  volumeInput?.addEventListener(
    'input',
    () => {
      video.muted = false;
      video.volume = Number(volumeInput.value) / 100;
    },
    listenerOptions,
  );
  muteButton?.addEventListener(
    'click',
    () => {
      video.muted = !video.muted;
    },
    listenerOptions,
  );
  fullscreenButton?.addEventListener('click', () => void toggleFullscreen(), listenerOptions);
  qualitySelect?.addEventListener(
    'change',
    () => {
      if (hls) {
        hls.currentLevel = Number(qualitySelect.value);
      }
    },
    listenerOptions,
  );
  speedSelect?.addEventListener(
    'change',
    () => {
      video.playbackRate = Number(speedSelect.value);
    },
    listenerOptions,
  );
  document.addEventListener(
    'fullscreenchange',
    () => {
      const expanded = document.fullscreenElement === player;
      player.classList.toggle('lesson-player--native-fullscreen', expanded);
      fullscreenButton?.setAttribute('aria-label', expanded ? 'Выйти из полноэкранного режима' : 'На весь экран');
    },
    listenerOptions,
  );
  player.addEventListener(
    'keydown',
    (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        return;
      }

      if (event.key === ' ' || event.key.toLowerCase() === 'k') {
        event.preventDefault();
        void togglePlayback();
      } else if (event.key === 'ArrowLeft') {
        video.currentTime = Math.max(0, video.currentTime - 5);
      } else if (event.key === 'ArrowRight') {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
      } else if (event.key.toLowerCase() === 'm') {
        video.muted = !video.muted;
      } else if (event.key.toLowerCase() === 'f') {
        void toggleFullscreen();
      } else if (event.key === 'Escape' && usedCssFullscreen) {
        setCssFullscreen(false);
      }
    },
    listenerOptions,
  );

  updatePlaybackState();
  updateTimeline();
  updateVolume();
  void loadSource();

  return () => {
    abortController.abort();
    hls?.destroy();
    hls = null;
    video.pause();
    video.removeAttribute('src');
    video.load();

    if (document.fullscreenElement === player) {
      void document.exitFullscreen();
    }

    if (usedCssFullscreen) {
      setCssFullscreen(false);
    }
  };
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}
