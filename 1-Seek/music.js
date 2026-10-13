// Musique psychédélique générative (Web Audio API, sans fichier audio).
// Les fonctions pures (midiToFreq, buildPattern) sont testables sous Node ;
// le moteur audio n'est créé qu'au premier clic, dans le navigateur.
const PsychedelicMusic = (() => {
  const SCALE = [0, 2, 3, 5, 7, 9, 10];   // mode dorien
  const MAX_DEGREE = 13;                  // deux octaves
  const REST_PROBABILITY = 0.2;
  const ROOT_MIDI = 57;                   // La3
  const DRONE_MIDI = 45;                  // La2
  const PATTERN_LENGTH = 16;
  const STEP_SECONDS = 0.25;

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // Marche aléatoire sur les degrés de la gamme ; null = silence.
  function buildPattern(rootMidi, length, rng = Math.random) {
    const notes = [];
    let degree = 4;
    for (let i = 0; i < length; i++) {
      const rest = rng() < REST_PROBABILITY;
      const move = Math.floor(rng() * 5) - 2;
      degree = Math.min(MAX_DEGREE, Math.max(0, degree + move));
      if (rest) {
        notes.push(null);
      } else {
        const octave = Math.floor(degree / 7);
        notes.push(rootMidi + 12 * octave + SCALE[degree % 7]);
      }
    }
    return notes;
  }

    const clamp01 = v => Math.min(1, Math.max(0, Number(v) || 0));
  // Souris X : transposition de 0 à 7 demi-tons
  function transposeFor(nx) { return Math.round(clamp01(nx) * 7); }
  // Souris Y : en haut = rapide (0.15 s/pas), en bas = lent (0.35 s/pas)
  function tempoFor(ny) { return 0.15 + clamp01(ny) * 0.2; }
  // Souris X : ouverture du filtre du drone, de 300 à 1800 Hz
  function cutoffFor(nx) { return 300 + clamp01(nx) * 1500; }
  function gainFor(volume) {
    const v = Math.min(1, Math.max(0, Number(volume) || 0));
    return v * v * 0.6;
  }

  // ---------- Effets sonores (style jeu vidéo) ----------
  // Contexte audio séparé de la musique : les effets marchent même musique coupée.
  const MUSIC_LEVEL = 0.5;   // la musique reste en fond, sous les effets
  const SFX_MIN_GAP = { hit: 0.06, destroy: 0.12, pop: 0.08 };   // anti-spam (s)
  const sfxGain = v => Math.min(1, gainFor(v) * 2);
  let sfx = null;
  const lastSfx = {};

  function getSfx() {
    if (typeof window === 'undefined') return null;
    if (!sfx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = sfxGain(volume);
      gain.connect(ctx.destination);
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.8), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      sfx = { ctx, gain, buffer };
    }
    if (sfx.ctx.state === 'suspended') sfx.ctx.resume();
    return sfx;
  }

  // Bip dont la fréquence glisse de f0 à f1 (son "laser" 8 bits).
  function sweep(s, f0, f1, dur, type, vol, delay = 0) {
    const t = s.ctx.currentTime + delay;
    const osc = s.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const env = s.ctx.createGain();
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env);
    env.connect(s.gain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Souffle de bruit filtré (explosion, impact).
  function noiseBurst(s, dur, vol, filterType, f0, f1, delay = 0) {
    const t = s.ctx.currentTime + delay;
    const src = s.ctx.createBufferSource();
    src.buffer = s.buffer;
    const filter = s.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const env = s.ctx.createGain();
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(env);
    env.connect(s.gain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // name : 'hit' (avion touché), 'destroy' (avion détruit), 'pop' (leurre avalé)
  function playSfx(name) {
    const s = getSfx();
    if (!s) return;
    const now = s.ctx.currentTime;
    if (lastSfx[name] !== undefined && now - lastSfx[name] < (SFX_MIN_GAP[name] || 0.05)) return;
    lastSfx[name] = now;
    if (name === 'hit') {
      sweep(s, 900, 120, 0.2, 'square', 0.28);
      sweep(s, 1400, 300, 0.12, 'square', 0.12, 0.03);
      noiseBurst(s, 0.08, 0.2, 'highpass', 3000, 1500);
    } else if (name === 'destroy') {
      noiseBurst(s, 0.6, 0.45, 'lowpass', 2500, 150);
      sweep(s, 220, 40, 0.5, 'sawtooth', 0.3);
      [523, 392, 262, 196].forEach((f, i) => sweep(s, f, f * 0.9, 0.08, 'square', 0.15, i * 0.07));
    } else if (name === 'pop') {
      sweep(s, 1500, 2300, 0.06, 'square', 0.12);
    }
  }

  // ---------- Partie navigateur ----------
  let engine = null;
  let playing = false;
  let volume = 0.5;
  let timer = null;
  let nextTime = 0;
  let step = 0;
  let pattern = [];
    let transpose = 0;
  let stepSeconds = STEP_SECONDS;

  function createEngine() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // Écho avec retour
    const delay = ctx.createDelay(1);
    delay.delayTime.value = STEP_SECONDS * 1.5;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.45;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(master);

    const bus = ctx.createGain();
    bus.connect(master);
    bus.connect(delay);

    // Drone : deux dents de scie désaccordées + une quinte, filtre balayé par un LFO
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 6;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.12;
    filter.connect(droneGain);
    droneGain.connect(master);

    const drone = [
      { type: 'sawtooth', freq: midiToFreq(DRONE_MIDI), detune: -7 },
      { type: 'sawtooth', freq: midiToFreq(DRONE_MIDI), detune: 7 },
      { type: 'sine', freq: midiToFreq(DRONE_MIDI + 7), detune: 0 }
    ];
    for (const d of drone) {
      const osc = ctx.createOscillator();
      osc.type = d.type;
      osc.frequency.value = d.freq;
      osc.detune.value = d.detune;
      osc.connect(filter);
      osc.start();
    }

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 350;
    lfo.connect(lfoDepth);
    lfoDepth.connect(filter.frequency);
    lfo.start();

    return { ctx, master, bus, filter, delay };
  }

  function playNote(midi, when) {
    if (midi === null) return;
    const { ctx, bus } = engine;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = midiToFreq(midi);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(0.14, when + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.5);
    osc.connect(env);
    env.connect(bus);
    osc.frequency.value = midiToFreq(midi + transpose);
    osc.start(when);
    osc.stop(when + 0.6);
  }

  // Planification légèrement en avance, pour un rythme stable
  function tick() {
    const { ctx } = engine;
    while (nextTime < ctx.currentTime + 0.12) {
      playNote(pattern[step % pattern.length], nextTime);
      step++;
      if (step % pattern.length === 0) pattern = buildPattern(ROOT_MIDI, PATTERN_LENGTH);
      nextTime += stepSeconds;    }
  }

  async function start() {
    if (!engine) engine = createEngine();
    await engine.ctx.resume();
    playing = true;
    pattern = buildPattern(ROOT_MIDI, PATTERN_LENGTH);
    step = 0;
    nextTime = engine.ctx.currentTime + 0.1;
    engine.master.gain.setTargetAtTime(gainFor(volume) * MUSIC_LEVEL, engine.ctx.currentTime, 0.3);
    timer = setInterval(tick, 25);
  }

  function stop() {
    playing = false;
    clearInterval(timer);
    engine.master.gain.setTargetAtTime(0, engine.ctx.currentTime, 0.2);
    setTimeout(() => { if (!playing) engine.ctx.suspend(); }, 1200);
  }

  async function toggle() {
    if (playing) stop(); else await start();
    return playing;
  }

  function setVolume(v) {
    volume = Math.min(1, Math.max(0, Number(v) || 0));
    if (playing) engine.master.gain.setTargetAtTime(gainFor(volume) * MUSIC_LEVEL, engine.ctx.currentTime, 0.1);
    if (sfx) sfx.gain.gain.setTargetAtTime(sfxGain(volume), sfx.ctx.currentTime, 0.1);
  }
    // nx, ny dans [0, 1] : tonalité, filtre et tempo suivent la souris.
  function setMouse(nx, ny) {
    transpose = transposeFor(nx);
    stepSeconds = tempoFor(ny);
    if (!playing || !engine) return;
    const t = engine.ctx.currentTime;
    engine.filter.frequency.setTargetAtTime(cutoffFor(nx), t, 0.1);
    engine.delay.delayTime.setTargetAtTime(stepSeconds * 1.5, t, 0.3);
  }

  return { SCALE, midiToFreq, buildPattern, gainFor, transposeFor, tempoFor, cutoffFor,
           toggle, setVolume, setMouse, playSfx };
})();

if (typeof module !== 'undefined') module.exports = PsychedelicMusic;