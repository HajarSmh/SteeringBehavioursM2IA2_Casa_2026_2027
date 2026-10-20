const el = id => document.getElementById(id);
const PALETTE = ['#4fc3f7', '#ff8a65', '#a5d6a7', '#ce93d8', '#fff176', '#f48fb1'];

// Curseur : live=true -> callback en direct, sinon au relâchement
function slider(parent, label, min, max, value, cb, live = true) {
  const w = document.createElement('label');
  w.className = 'row';
  w.innerHTML = `<span>${label}</span><output>${value}</output><input type="range" min="${min}" max="${max}" value="${value}">`;
  const i = w.querySelector('input'), o = w.querySelector('output');
  i.addEventListener('input', () => { o.textContent = i.value; if (live) cb(+i.value); });
  if (!live) i.addEventListener('change', () => cb(+i.value));
  parent.appendChild(w);
}

function initUI() {
  // Réglages du mode Évolution
  const evo = el('evo');
  // Architectures aléatoires : 5 espèces, la moins bonne est remplacée à chaque génération
  const ra = document.createElement('label');
  ra.className = 'chk';
  ra.innerHTML = '<input type="checkbox"> Architectures aléatoires (5 espèces)';
  evo.appendChild(ra);
  const archBox = document.createElement('div'); // curseurs d'architecture (inutiles en mode aléatoire)
  evo.appendChild(archBox);
  ra.querySelector('input').onchange = e => {
    randomArch = e.target.checked;
    archBox.style.display = randomArch ? 'none' : '';
    setMode('evo');
  };
  [['Rayons (capteurs)', 3, 21, 'rays', false],
   ['Couches cachées', 1, 4, 'layers', false],
   ['Neurones par couche', 2, 24, 'neurons', false],
   ['Longueur des rayons', 30, 200, 'sight', true],
   ['Vitesse des voitures', 1, 10, 'speed', true]].forEach(([l, mi, ma, k, live]) =>
    slider(['rays', 'layers', 'neurons'].includes(k) ? archBox : evo, l, mi, ma, evoTeam[k], v => { evoTeam[k] = v; if (!live) resetPopulation(); }, live));
  // Simulation : pause, vitesse, ralenti (disponibles dans tous les modes)
  slider(el('simctl'), 'Vitesse de simulation', 1, 10, simSpeed, v => (simSpeed = v));
  slider(el('simctl'), 'Ralenti (÷)', 1, 20, slowFactor, v => (slowFactor = v));
  el('btnPause').onclick = () => setPaused(!paused);
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && (e.target === document.body || e.target.type === 'range')) {
      e.preventDefault(); setPaused(!paused);
    }
    if (!['text', 'color'].includes(e.target.type)) {
      const m = { Digit1: 'driver', Digit2: 'chase', Digit3: 'aerial', Digit4: 'top' }[e.code];
      if (m) View3D.setCam(m);
      if (e.code === 'KeyC') View3D.cycle();
    }
    // D : mode debug (sauf quand on tape dans un champ de texte)
    if (e.code === 'KeyD' && !e.ctrlKey && !e.metaKey && !e.altKey && !['text', 'color'].includes(e.target.type)) {
      debug = !debug; el('cDebug').checked = debug;
    }
  });
  document.addEventListener('click', e => { if (e.target.tagName === 'BUTTON') e.target.blur(); });

  // Circuit
  slider(el('track'), 'Complexité du circuit', 1, 10, complexity, v => { complexity = v; newTrack(); }, false);
  slider(el('track'), 'Nombre de tours', 1, 10, LAPS, v => (LAPS = v));
  slider(el('trainBox'), "Générations d'entraînement", 1, 200, trainTarget, v => (trainTarget = v));
  el('newTrack').onclick = newTrack;
  const sel = document.createElement('select');
  sel.innerHTML = '<option value="random">Type : aléatoire</option>' + Object.entries(TRACK_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  sel.onchange = () => { trackType = sel.value; newTrack(); };
  el('track').appendChild(sel);
  // Caméras
  [['driver', '🎥', 'Conducteur'], ['chase', '🚘', 'Poursuite'], ['aerial', '🛰', 'Aérien'], ['top', '🗺', 'Circuit']].forEach(([k, e, l], n) => {
    const b = document.createElement('button'); b.innerHTML = `<span>${e}</span><small>${l}</small>`; b.title = l + ' (touche ' + (n + 1) + ')'; b.dataset.cam = k; b.onclick = () => View3D.setCam(k); el('camBtns').appendChild(b);
  });
  View3D.setCam('top');
  // Son : démarre au premier clic / touche (règle des navigateurs)
  const snd = el('sndBox'), sb = document.createElement('button');
  const upd = () => { sb.textContent = Sound.isMuted() ? '🔇 Son coupé' : '🔊 Musique & effets'; sb.className = Sound.isMuted() ? '' : 'on'; };
  sb.onclick = () => { Sound.start(); Sound.toggle(); upd(); };
  snd.appendChild(sb); upd();
  slider(snd, 'Volume', 0, 100, 50, v => Sound.setVolume(v / 100));
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => Sound.start(), { once: true }));
  document.addEventListener('keydown', e => { if (e.code === 'KeyM' && !['text', 'color'].includes(e.target.type)) sb.click(); });

  // Affichage
  el('cLights').onchange = e => (showLights = e.target.checked);
  el('cRays').onchange = e => (showRays = e.target.checked);
  el('cCps').onchange = e => (showCps = e.target.checked);
  el('cAutoPause').onchange = e => (autoPause = e.target.checked);
  el('cDebug').onchange = e => (debug = e.target.checked);

  // Modes
  el('btnEvo').onclick = () => setMode('evo');
  el('btnRace').onclick = () => setMode('race');
  el('addCar').onclick = () => { addCard(); raceRacers.length = 0; if (mode === 'race') setMode('race'); };
  el('train').onclick = startTraining;
  el('start').onclick = startRace;
  el('btnChamp').onclick = () => setMode('champ');
  el('hallTop').onclick = () => { hallSel = new Set([...hall].sort((a, b) => b.score - a.score).slice(0, 6).map(e => e.id)); renderHall(); };
  el('hallNone').onclick = () => { hallSel.clear(); renderHall(); };
  el('hallClear').onclick = () => { if (confirm('Vider le panthéon ?')) { hall = []; hallSel.clear(); saveHall(); renderHall(); } };
  el('hallStart').onclick = startChampRace;

  addCard({ name: 'Éclaireur', rays: 5, layers: 1, neurons: 8, sight: 70, speed: 5 });
  addCard({ name: 'Équilibré', rays: 9, layers: 2, neurons: 12, sight: 100, speed: 5 });
  addCard({ name: 'Rapide', rays: 7, layers: 1, neurons: 12, sight: 90, speed: 8 });
}

function setMode(m) {
  mode = m;
  teams = m === 'evo' ? evoTeams() : m === 'race' ? [] : champTeams; // Course : rien ne roule avant « Entraîner »
  racePhase = m === 'race' ? 'config' : 'run';
  el('evo').style.display = m === 'evo' ? '' : 'none';
  el('race').style.display = m === 'race' ? 'block' : 'none';
  el('champ').style.display = m === 'champ' ? 'block' : 'none';
  el('btnEvo').className = m === 'evo' ? 'on' : '';
  el('btnRace').className = m === 'race' ? 'on' : '';
  el('btnChamp').className = m === 'champ' ? 'on' : '';
  if (m === 'champ') renderHall();
  resetPopulation();
}

// Carte de configuration d'une voiture de course
function addCard(cfg) {
  if (raceTeams.length >= 6) return;
  const k = raceTeams.length;
  cfg = Object.assign({ name: 'Voiture ' + (k + 1), rays: 7, layers: 1, neurons: 12,
                        sight: 90, speed: 5 }, cfg);
  cfg.color = PALETTE[k % PALETTE.length];
  cfg.count = 20; cfg.best = 0; cfg.done = false;
  raceTeams.push(cfg);

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `<header><input type="color" value="${cfg.color}">
    <input type="text" value="${cfg.name}"><button>✕</button></header>`;
  const [color, name] = card.querySelectorAll('input');
  color.oninput = () => (cfg.color = color.value);
  name.oninput = () => (cfg.name = name.value);
  card.querySelector('button').onclick = () => {
    if (raceTeams.length < 2) return;
    raceTeams.splice(raceTeams.indexOf(cfg), 1);
    card.remove();
    raceRacers.length = 0;
    if (mode === 'race') setMode('race');
  };
  // rayons / couches / neurones : pris en compte au lancement ; portée / vitesse : en direct
  [['Rayons', 3, 21, 'rays'], ['Couches', 1, 4, 'layers'], ['Neurones', 2, 24, 'neurons'],
   ['Longueur rayons', 30, 200, 'sight'], ['Vitesse', 1, 10, 'speed']]
    .forEach(([l, mi, ma, key]) => slider(card, l, mi, ma, cfg[key], v => (cfg[key] = v)));
  el('cards').appendChild(card);
}

// Classement (tours parcourus par la meilleure voiture de chaque équipe)
function updateBoard() {
  if (mode === 'race') el('raceStatus').textContent = raceStatusText();
  el('hallInfo').textContent = mode === 'evo' ? '🏆 ' + hall.length + ' champion(s) sauvegardé(s)' : '';
  const rows = [...teams].sort((a, b) => b.best - a.best).map(t => {
    const alive = population.filter(v => v.team === t).length;
    const laps = (t.best / checkpoints.length).toFixed(2);
    return `<div><i style="background:${t.color}"></i>${t.name} — ${laps} tours · ${alive} en vie${t.done ? ' 🏁' : ''}</div>`;
  });
  el('board').innerHTML = rows.join('');
}
// ---------- Panthéon des champions ----------
const champTeams = [];

function renderHall() {
  const box = el('hallList');
  box.innerHTML = '';
  [...hall].sort((a, b) => b.score - a.score || b.id - a.id).forEach(e => {
    const row = document.createElement('div');
    row.className = 'hrow';
    row.innerHTML = `<input type="checkbox" ${hallSel.has(e.id) ? 'checked' : ''}>
      <span>#${e.id} · gén ${e.gen} · ${e.laps.toFixed(2)} tours · ${e.inputs}×[${e.hidden.join(',')}] · v${e.speed}</span><button>✕</button>`;
    const chk = row.querySelector('input');
    chk.onchange = () => {
      if (chk.checked && hallSel.size >= 6) { chk.checked = false; return; }
      chk.checked ? hallSel.add(e.id) : hallSel.delete(e.id);
    };
    row.querySelector('button').onclick = () => {
      hall = hall.filter(x => x.id !== e.id);
      hallSel.delete(e.id);
      saveHall(); renderHall();
    };
    box.appendChild(row);
  });
  if (!hall.length) box.textContent = 'Aucun champion : lance le mode Évolution.';
}

function startChampRace() {
  champTeams.length = 0;
  [...hallSel].forEach(id => {
    const e = hall.find(x => x.id === id);
    if (!e) return;
    champTeams.push({
      name: `#${e.id} (gén ${e.gen})`, color: PALETTE[champTeams.length % PALETTE.length],
      rays: e.inputs, layers: e.hidden.length, neurons: e.hidden[0],
      sight: e.sight, speed: e.speed, count: 1, best: 0, done: false, champion: e
    });
  });
  racePhase = 'run';
  resetPopulation();
}

function raceStatusText() {
  if (racePhase === 'train') return 'Entraînement : génération ' + generationCount + ' / ' + trainTarget;
  if (racePhase === 'run') return 'Course en cours…';
  if (racePhase === 'ready') return 'Voitures entraînées prêtes : clique sur 🏁 Lancer la course.';
  return raceRacers.length ? 'Voitures déjà entraînées disponibles (🏁), ou ré-entraîne-les.'
                           : "Configure les équipes puis clique sur 🏋 Entraîner.";
}