// MusicManager.js
// Singleton: manages tracks, audio node, analyser, toggle, etc.
// See handoff for full requirements.


class MusicManager {
  constructor() {
    // Track list (filenames in /music/)
    this.trackList = [
      "DR660 Bassdrum Floppy_35.mp3",
      "Gar.mp3",
      "Polygonal Fingertips.mp3",
      "crush.mp3",
      "intarsia.mp3",
      "sauce.mp3",
      "transeo.mp3",
      "tuesday loop.mp3",
      "wok.mp3"
      // Add more as needed
    ];
    this.musicPath = "/music/";
    this.audioElem = new Audio();
    this.audioElem.preload = "auto";
    this.audioElem.crossOrigin = "anonymous";
    this.audioCtx = null;
    this.analyser = null;
    this.sourceNode = null;
    this.musicEnabled = true;
    this.interactionCount = 0;
    this.idleTimeoutMs = 1700;
    this.idleTimer = null;
    this.currentTrackIdx = Math.floor(Math.random() * this.trackList.length);
    this.lastTrackIdx = null;
    this.isPlaying = false;
    this.hasUnlockedAutoplay = false;
    this._loadPersistentState();
    this._setupAudio();
    this._setupAudioElemEvents();
  }

  _setupAudio() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64; // ~32 bins
      this.sourceNode = this.audioCtx.createMediaElementSource(this.audioElem);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    } catch (e) {
      console.warn("Web Audio API not available", e);
    }
  }

  _setupAudioElemEvents() {
    this.audioElem.addEventListener("ended", () => {
      this.nextRandomTrack();
    });
  }

  _loadPersistentState() {
    try {
      const enabled = localStorage.getItem("musicEnabled");
      if (enabled !== null) this.musicEnabled = enabled === "true";
    } catch (e) {}
  }

  _persistState() {
    try {
      localStorage.setItem("musicEnabled", this.musicEnabled);
    } catch (e) {}
  }

  play() {
    if (!this.musicEnabled) return;
    if (!this.audioCtx) this._setupAudio();
    if (this.audioCtx.state === "suspended") this.audioCtx.resume();
    if (!this.audioElem.src) this._loadCurrentTrack();
    this.audioElem.play();
    this.isPlaying = true;
  }

  pause() {
    this.audioElem.pause();
    this.isPlaying = false;
  }

  _loadCurrentTrack() {
    const file = this.trackList[this.currentTrackIdx];
    this.audioElem.src = this.musicPath + "/" + encodeURIComponent(file);
    this.audioElem.load();
  }

  nextRandomTrack() {
    let idx;
    do {
      idx = Math.floor(Math.random() * this.trackList.length);
    } while (idx === this.currentTrackIdx && this.trackList.length > 1);
    this.lastTrackIdx = this.currentTrackIdx;
    this.currentTrackIdx = idx;
    this._loadCurrentTrack();
    if (this.musicEnabled) this.play();
  }

  scrubToPosition(newTime) {
    this.audioElem.currentTime = Math.max(0, Math.min(newTime, this.audioElem.duration || 0));
  }

  onAnyUserInteraction() {
    this.interactionCount++;
    if (this.interactionCount === 3) {
      if (window.showMusicButton) window.showMusicButton();
    }
    if (!this.hasUnlockedAutoplay) {
      this.hasUnlockedAutoplay = true;
      if (this.audioCtx && this.audioCtx.state === "suspended") this.audioCtx.resume();
    }
    if (this.musicEnabled) this.play();
    this.resetIdleTimer();
  }

  resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.pause();
    }, this.idleTimeoutMs);
  }

  setMusicEnabled(on) {
    this.musicEnabled = !!on;
    this._persistState();
    if (!this.musicEnabled) {
      this.pause();
    } else {
      this.play();
    }
    // Optionally update UI
  }

  getAnalyserNode() {
    return this.analyser;
  }

  getCurrentTrack() {
    return this.trackList[this.currentTrackIdx];
  }

  getCurrentTime() {
    return this.audioElem.currentTime;
  }

  getDuration() {
    return this.audioElem.duration;
  }
}

window.MusicManager = new MusicManager();
