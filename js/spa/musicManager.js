const STORAGE_KEY_ENABLED = 'spa_music_enabled';
const STORAGE_KEY_TRACK_INDEX = 'spa_music_track_index';
const STORAGE_KEY_TRACK_TIME = 'spa_music_track_time';
const STORAGE_KEY_INTERACTIONS = 'spa_music_interaction_count';
const STORAGE_KEY_VOLUME = 'spa_music_user_volume';

const TRACKS = [
  { src: '/music/Gar.mp3',      gain: 0.85 },
  { src: '/music/crush.mp3',    gain: 0.90 },
  { src: '/music/intarsia.mp3', gain: 0.85 },
  { src: '/music/sauce.mp3',    gain: 0.80 },
  { src: '/music/transeo.mp3',  gain: 0.90 },
  { src: '/music/wok.mp3',      gain: 0.85 },
];

class MusicManagerImpl {
  constructor() {
    this.musicEnabled = this.readStorage(STORAGE_KEY_ENABLED, '1') !== '0';
    this.interactionCount = Number(this.readStorage(STORAGE_KEY_INTERACTIONS, '0') || 0);
    this.trackIndex = Number(this.readStorage(STORAGE_KEY_TRACK_INDEX, '0') || 0) % TRACKS.length;
    this.userVolume = Math.max(0, Math.min(1, Number(this.readStorage(STORAGE_KEY_VOLUME, '1') || 1)));
    this.listeners = new Set();
    this.lastTrackIndex = -1;

    this.audio = new Audio(TRACKS[this.trackIndex].src);
    this.audio.preload = 'auto';
    this.audio.loop = false;

    this.audioContext = null;
    this.gainNode = null;
    this.analyser = null;
    this.source = null;
    this.freqData = null;
    this.unlocked = false;

    const savedTime = Number(this.readStorage(STORAGE_KEY_TRACK_TIME, '0') || 0);
    if (Number.isFinite(savedTime) && savedTime > 0) this.audio.currentTime = savedTime;

    this.audio.addEventListener('ended', () => this.nextTrack());
    this.audio.addEventListener('timeupdate', () => {
      this.writeStorage(STORAGE_KEY_TRACK_TIME, String(this.audio.currentTime || 0));
    });
  }

  ensureAudioGraph() {
    if (this.audioContext) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.audioContext = new Ctx();
    this.source = this.audioContext.createMediaElementSource(this.audio);
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this._calculateGain(TRACKS[this.trackIndex]?.gain ?? 1);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.source.connect(this.gainNode);
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.waveData = new Uint8Array(this.analyser.fftSize);
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach((fn) => { try { fn(this.getState()); } catch (_) {} }); }
  getState() {
    return {
      musicEnabled: this.musicEnabled,
      interactionCount: this.interactionCount,
      trackIndex: this.trackIndex,
      paused: this.audio.paused
    };
  }

  persistBasics() {
    this.writeStorage(STORAGE_KEY_ENABLED, this.musicEnabled ? '1' : '0');
    this.writeStorage(STORAGE_KEY_INTERACTIONS, String(this.interactionCount));
    this.writeStorage(STORAGE_KEY_TRACK_INDEX, String(this.trackIndex));
  }

  readStorage(key, fallback) {
    try { return localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; }
  }

  writeStorage(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  unlock() {
    this.ensureAudioGraph();
    if (this.audioContext && this.audioContext.state === 'suspended') this.audioContext.resume().catch(() => {});
    this.unlocked = true;
  }

  play() {
    if (!this.musicEnabled) return;
    this.unlock();
    this.audio.play().catch(() => {});
    this.emit();
  }

  pause() {
    this.audio.pause();
    this.emit();
  }

  toggleEnabled() {
    this.musicEnabled = !this.musicEnabled;
    this.persistBasics();
    if (!this.musicEnabled) this.pause();
    else this.play();
    this.emit();
  }

  setTrack(index, keepTime = 0) {
    this.trackIndex = ((index % TRACKS.length) + TRACKS.length) % TRACKS.length;
    const track = TRACKS[this.trackIndex];
    this.audio.src = track.src;
    this.audio.currentTime = Math.max(0, keepTime || 0);
    if (this.gainNode) {
      this.gainNode.gain.value = this._calculateGain(track.gain);
    } else {
      this.audio.volume = this._calculateGain(track.gain);
    }
    this.persistBasics();
    this.play();
  }

  getUserVolume() { return this.userVolume; }

  _calculateGain(trackGain) { return (trackGain ?? 1) * this.userVolume; }

  setUserVolume(v) {
    this.ensureAudioGraph();
    this.userVolume = Math.max(0, Math.min(1, v));
    this.writeStorage(STORAGE_KEY_VOLUME, String(this.userVolume));
    const trackGain = TRACKS[this.trackIndex]?.gain ?? 1;
    if (this.gainNode) {
      this.gainNode.gain.value = this._calculateGain(trackGain);
    } else {
      this.audio.volume = this._calculateGain(trackGain);
    }
  }

  nextTrack() {
    let idx = this.trackIndex;
    if (TRACKS.length > 1) {
      do { idx = Math.floor(Math.random() * TRACKS.length); } while (idx === this.trackIndex || idx === this.lastTrackIndex);
    }
    this.lastTrackIndex = this.trackIndex;
    this.setTrack(idx, 0);
  }

  prevTrack() {
    this.setTrack(this.trackIndex - 1, 0);
  }

  scrubToPosition(nextTimeSec) {
    this.audio.currentTime = Math.max(0, Math.min(this.audio.duration || 0, nextTimeSec));
  }

  getAnalyserData() {
    if (!this.analyser || !this.freqData) return null;
    this.analyser.getByteFrequencyData(this.freqData);
    return this.freqData;
  }

  getWaveformData() {
    if (!this.analyser || !this.waveData) return null;
    this.analyser.getByteTimeDomainData(this.waveData);
    return this.waveData;
  }

  getTrackName() {
    const src = this.audio.src || '';
    const file = src.split('/').pop() || '';
    return file.replace(/\.[^.]+$/, '') || `track ${this.trackIndex + 1}`;
  }

  onAnyUserInteraction() {
    this.interactionCount += 1;
    this.persistBasics();
    if (this.musicEnabled) this.play();
    this.emit();
  }
}

const manager = new MusicManagerImpl();
window.MusicManager = manager;
window.onAnyUserInteraction = () => manager.onAnyUserInteraction();

export default manager;
