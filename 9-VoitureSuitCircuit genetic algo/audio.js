// Ambiance sonore 100 % synthétisée (Web Audio, aucun fichier) : space / hypnotique / futuriste.
// Sub-basse profonde avec effet "pompe", nappe de supersaws désaccordées, arpège syncopé résonant,
// balayages spectraux (risers / downers de bruit), échos ping-pong synthétiques + réverbération spatiale.
// Effets : crash (bruit + "boing" qui chute) et victoire (fanfare + étincelles).
const Sound = (() => {
  let ac = null, master, fx, duck, echoIn, revIn, noise, wnoise, pf, vol = 0.5, muted = false;
  let next = 0, step = 0, lastCrash = 0, lastWin = 0;
  const pad = [], bass = [], ST = 0.27;                   // ST : durée d'un pas (~111 bpm en croches)
  const MIN = [0, 2, 3, 5, 7, 8, 10], ROOTS = [0, -4, -2, -7], D4 = 293.66; // ré mineur : Dm · Sib · Do · Lam
  const MASK = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1];            // rythme syncopé de l'arpège
  const pat = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 6, 5, 4, 2, 4];
  const hz = s => D4 * Math.pow(2, s / 12);
  const pan = v => { if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = v; return p; } return ac.createGain(); };

  // envoie un nœud vers la sortie + écho + réverbération
  function send(node, echo, rev) {
    node.connect(master);
    if (echo) { const g = ac.createGain(); g.gain.value = echo; node.connect(g); g.connect(echoIn); }
    if (rev) { const g = ac.createGain(); g.gain.value = rev; node.connect(g); g.connect(revIn); }
  }

  function init() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = muted ? 0 : vol;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ac.destination);

    // réverbération "spatiale" : réponse impulsionnelle de bruit à longue décroissance (3,5 s)
    const len = ac.sampleRate * 3.5, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5); }
    revIn = ac.createConvolver(); revIn.buffer = ir;
    const rg = ac.createGain(); rg.gain.value = 0.55; revIn.connect(rg); rg.connect(master);

    // écho ping-pong filtré, avec léger vibrato de bande (chorus) => échos synthétiques
    echoIn = ac.createGain();
    const dl = ac.createDelay(2), dr = ac.createDelay(2), lp = ac.createBiquadFilter(), fb = ac.createGain();
    dl.delayTime.value = ST * 1.5; dr.delayTime.value = ST * 1.5; lp.frequency.value = 2400; fb.gain.value = 0.58;
    echoIn.connect(dl); dl.connect(pan(-0.8)).connect(master);
    dl.connect(lp); lp.connect(dr); dr.connect(pan(0.8)).connect(master); dr.connect(fb); fb.connect(dl);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.31; lg.gain.value = 0.004;
    lfo.connect(lg); lg.connect(dl.delayTime); lg.connect(dr.delayTime); lfo.start();

    // bus des basses/nappe : "pompe" (sidechain) déclenchée par la grosse caisse
    duck = ac.createGain(); send(duck, 0, 0.35);
    // nappe : 6 triangles désaccordés, filtre résonant balayé en continu
    pf = ac.createBiquadFilter(); pf.type = 'lowpass'; pf.Q.value = 5; pf.frequency.value = 400;
    const pg = ac.createGain(); pg.gain.value = 0.12; pf.connect(pg); pg.connect(duck);
    const l2 = ac.createOscillator(), l2g = ac.createGain(); l2.frequency.value = 0.045; l2g.gain.value = 500;
    l2.connect(l2g); l2g.connect(pf.frequency); l2.start();
    [[-12, -14], [-12, 14], [-5, -9], [-5, 10], [0, -4], [7, 6]].forEach(([semi, det]) => {
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(semi); o.detune.value = det;
      o.connect(pf); o.start(); pad.push({ o, semi });
    });
    // sub-basse profonde : sinus + dent de scie filtrée
    const bl = ac.createBiquadFilter(); bl.type = 'lowpass'; bl.frequency.value = 140; bl.connect(duck);
    [['sine', -36, 0.34, duck], ['sawtooth', -24, 0.1, bl]].forEach(([type, semi, a, out]) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = hz(semi); g.gain.value = a;
      o.connect(g); g.connect(out); o.start(); bass.push({ o, semi });
    });

    fx = ac.createGain(); fx.gain.value = 0.9; send(fx, 0, 0.3);
    noise = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    wnoise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const w = wnoise.getChannelData(0); for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;
    next = ac.currentTime + 0.1;
    setInterval(tick, 100);
  }

  function arp(f, t) { // pluck de synthé : 2 saws désaccordées, filtre résonant qui se ferme
    const g = ac.createGain(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 8;
    lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.28);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    [-8, 8].forEach(d => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + 0.45); });
    lp.connect(g); send(g, 0.4, 0.4);
  }

  function sweep(t, up) { // balayage spectral : bruit passe-bande résonant qui monte ou descend
    const n = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain(), dur = ST * 16;
    n.buffer = wnoise; n.loop = true; bp.type = 'bandpass'; bp.Q.value = 2;
    bp.frequency.setValueAtTime(up ? 200 : 2000, t); bp.frequency.exponentialRampToValueAtTime(up ? 2000 : 200, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.02, t + dur * (up ? 0.9 : 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp); bp.connect(g); send(g, 0.2, 0.6); n.start(t); n.stop(t + dur + 0.1);
  }

  function laser(f, t) { // petit "bip" futuriste qui glisse vers le grave
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.4, t + 0.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.02, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g); send(g, 0.9, 0.5); o.start(t); o.stop(t + 0.4);
  }

  function note(s, t) {
    const root = ROOTS[(s >> 4) & 3], bRoot = root < -3 ? root + 12 : root, i = s % 16;
    if (i === 0) {
      pad.forEach(p => p.o.frequency.setTargetAtTime(hz(p.semi + root), t, 0.5));
      bass.forEach(b => b.o.frequency.setTargetAtTime(hz(b.semi + bRoot), t, 0.05));
    }
    if (s % 32 === 0) { // phrase de 32 pas : le filtre de la nappe s'ouvre puis se referme, riser spectral
      pf.frequency.cancelScheduledValues(t); pf.frequency.setValueAtTime(300, t);
      pf.frequency.exponentialRampToValueAtTime(2600, t + ST * 16); pf.frequency.exponentialRampToValueAtTime(300, t + ST * 32);
      sweep(t, true); pat[Math.random() * 16 | 0] = Math.random() * 7 | 0;
    }
    if (s % 32 === 16) sweep(t, false);
    if (s % 2 === 0) { // grosse caisse profonde + pompe sur la nappe
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
      g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.4);
      duck.gain.setValueAtTime(0.25, t); duck.gain.linearRampToValueAtTime(1, t + ST * 1.6);
    } else { // charleston discret sur les contretemps
      const n = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain();
      n.buffer = wnoise; hp.type = 'highpass'; hp.frequency.value = 7000; g.gain.value = 0.025;
      n.connect(hp); hp.connect(g); send(g, 0.3, 0.1); n.start(t); n.stop(t + 0.04);
    }
    if (MASK[i]) arp(hz(root + MIN[pat[i]] + 12), t);
    if (s % 8 === 6 && Math.random() < 0.25) laser(hz(root + MIN[Math.random() * 7 | 0] + 36), t);
  }

  function tick() {
    if (!ac || ac.state !== 'running') { if (ac) next = ac.currentTime + 0.1; return; }
    while (next < ac.currentTime + 0.35) { note(step++, next); next += ST; }
  }

  function ping(f, t, a, type) {
    const o = ac.createOscillator(), g = ac.createGain(), p = pan(Math.random() * 1.6 - 0.8);
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(p); p.connect(fx); o.start(t); o.stop(t + 1);
  }

  // Crash : explosion de bruit filtré + "boing" qui chute (power : 1 = leader, moins pour les autres)
  function crash(power = 1) {
    if (!ac || muted || ac.state !== 'running') return;
    const t = ac.currentTime; if (t - lastCrash < 0.18) return; lastCrash = t;
    const n = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = noise; bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1100, t); bp.frequency.exponentialRampToValueAtTime(200, t + 0.5);
    g.gain.value = 0.1 * power; n.connect(bp); bp.connect(g); g.connect(fx); n.start(t);
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.4);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.08 * power, t + 0.03); og.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(og); og.connect(fx); o.start(t); o.stop(t + 0.45);
  }

  // Victoire : fanfare ascendante + pluie d'étincelles
  function win() {
    if (!ac || muted || ac.state !== 'running') return;
    const t = ac.currentTime; if (t - lastWin < 1.5) return; lastWin = t;
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => ping(hz(12 + s), t + i * 0.09, 0.25, 'square'));
    for (let i = 0; i < 14; i++) ping(hz(36 + MIN[Math.random() * 5 | 0] + 12 * (Math.random() * 2 | 0)), t + 0.7 + Math.random() * 1.2, 0.08, 'sine');
  }

  function start() { if (!ac) init(); if (ac.state === 'suspended') ac.resume(); }
  function toggle() { muted = !muted; if (ac) master.gain.setTargetAtTime(muted ? 0 : vol, ac.currentTime, 0.05); }
  function setVolume(v) { vol = v; if (ac && !muted) master.gain.setTargetAtTime(vol, ac.currentTime, 0.05); }
  return { start, toggle, setVolume, crash, win, isMuted: () => muted };
})();