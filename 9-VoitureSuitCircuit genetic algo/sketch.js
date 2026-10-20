const TOTAL = 100;          // voitures en mode Évolution
const MUTATION_RATE = 0.1;
const LIFESPAN = 60;        // frames max sans checkpoint
const FOV = 100;            // angle de vision / des feux (degrés)
let LAPS = 3;             // tours pour finir la course

let generationCount = 0;
let walls = [], checkpoints = [], inside = [], outside = [];
let start;
const WW = 2800, WH = 1800; // taille du monde : le circuit occupe tout le cadre
let trackType = 'random';
let population = [], savedVehicles = [];

// Réglages globaux
let complexity = 4, simSpeed = 1;
let showLights = false, showRays = false, showCps = false;
let mode = 'evo';
const evoTeam = { name: 'Évolution', color: '#ffe9a8', rays: 7, layers: 1, neurons: 12,
                  sight: 90, speed: 5, count: TOTAL, best: 0 };
const raceTeams = [];
let teams = [evoTeam];
let SIGHT = 90;

// Pause / ralenti / résultat de course
let paused = false, slowFactor = 1, simAcc = 0, autoPause = true;
let raceTick = 0, finishLog = [], lastResult = null;

// Architectures aléatoires (mode Évolution) : SPECIES espèces qui évoluent séparément
const SPECIES = 5;
let randomArch = false;

// Mode Course : config -> train (entraînement) -> ready (au départ) -> run (course) -> ready
// Mode Évolution / Champions : 'run'
let racePhase = 'run';
let trainTarget = 20;      // générations d'entraînement
const raceRacers = [];     // voitures entraînées qui vont courir
let debug = false;         // touche D

function randomTeam(i) {
  const layers = floor(random(1, 4)), neurons = floor(random(4, 17));
  const t = { color: PALETTE[i % PALETTE.length], rays: floor(random(3, 14)), layers, neurons,
              count: TOTAL / SPECIES, best: 0, done: false, age: 0, species: i };
  t.name = t.rays + '×[' + Array(layers).fill(neurons).join(',') + ']';
  // portée et vitesse restent pilotées en direct par les curseurs
  Object.defineProperty(t, 'sight', { get: () => evoTeam.sight });
  Object.defineProperty(t, 'speed', { get: () => evoTeam.speed });
  return t;
}

function evoTeams() {
  return randomArch ? Array.from({ length: SPECIES }, (_, i) => randomTeam(i)) : [evoTeam];
}

function setPaused(p) {
  paused = p;
  const b = document.getElementById('btnPause');
  if (b) { b.textContent = p ? '▶ Reprendre' : '⏸ Pause'; b.className = p ? 'on' : ''; }
  if (!p && lastResult && lastResult.until === Infinity) lastResult = null;
}

// Construit un nouveau circuit (grand, occupe tout le monde WW x WH) via track.js
function buildTrack() {
  const t = generateTrack(trackType, complexity, floor(random(1e9)), WW, WH);
  const V = p => createVector(p.x, p.y);
  inside = t.inside.map(V); outside = t.outside.map(V);
  checkpoints = inside.map((p, i) => new Boundary(p.x, p.y, outside[i].x, outside[i].y));
  walls = [];
  const n = inside.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    walls.push(new Boundary(inside[i].x, inside[i].y, inside[j].x, inside[j].y));
    walls.push(new Boundary(outside[i].x, outside[i].y, outside[j].x, outside[j].y));
  }
  start = checkpoints[0].midpoint();
}

// Nouvelle population (nouveaux cerveaux aléatoires)
function resetPopulation() {
  lastResult = null; raceTick = 0; finishLog = []; setPaused(false);
  [...population, ...savedVehicles].forEach(v => v.dispose());
  population = []; savedVehicles = []; generationCount = 0;
  for (const t of teams) {
    t.best = 0; t.done = false;
    for (let i = 0; i < t.count; i++) {
      if (t.champion) { // champion sauvegardé : on repart de ses poids
        const b = championBrain(t.champion);
        population.push(new Vehicle(b, t));
        b.dispose();
      } else population.push(new Vehicle(null, t));
    }
  }
}

// Nouveau circuit : les voitures gardent leur cerveau et repartent du départ
function newTrack() {
  lastResult = null; raceTick = 0; finishLog = [];
  buildTrack();
  const old = [...population, ...savedVehicles];
  population = []; savedVehicles = [];
  old.forEach(v => { population.push(new Vehicle(v.brain, v.team)); v.dispose(); });
  teams.forEach(t => { t.best = 0; t.done = false; });
}

function setup() {
  createCanvas(1200, 800).parent('canvas-holder');
  tf.setBackend('cpu');
  buildTrack();
  loadHall();
  initUI();
  resetPopulation();
}

function draw() {
  SIGHT = evoTeam.sight;
  if (!paused && racePhase !== 'ready') {
    simAcc += simSpeed / slowFactor; // ralenti : < 1 pas de simulation par image
    const steps = Math.floor(simAcc);
    simAcc -= steps;
    for (let n = 0; n < steps && !paused && racePhase !== 'ready'; n++) stepSim();
  }
  const best = View3D.frame(drawingContext, width, height, millis() / 1000); // rendu 3D + HUD + classement
  if (debug && best) drawDebug(best);
  drawOverlay();
  if (frameCount % 10 === 0) updateBoard();
}

function mouseWheel(e) {
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
  View3D.zoomBy(e.delta);
  return false;
}

// Un pas de simulation
function stepSim() {
  for (const v of population) {
    v.applyBehaviors(walls);
    v.check(checkpoints);
    v.update();
  }
  raceTick++;
  for (let i = population.length - 1; i >= 0; i--) {
    const v = population[i];
    if (v.dead || v.finished) {
      savedVehicles.push(population.splice(i, 1)[0]);
      v.dead ? View3D.crash(v) : View3D.confetti(v);
    }
  }
  if (population.length === 0 && teams.length) {
    endRace();
    nextGeneration();
    generationCount++;
    teams.forEach(t => (t.done = false));
    raceTick = 0; finishLog = [];
    if (racePhase === 'train' && generationCount >= trainTarget) finishTraining();
  }
}

// Fin de course (modes Course / Champions) : classement + gagnant
function endRace() {
  if (mode === 'evo' || racePhase !== 'run') return; // pas de gagnant pendant l'entraînement
  const rows = teams.map(t => {
    const fin = finishLog.find(f => f.team === t);
    const score = savedVehicles.filter(v => v.team === t).reduce((m, v) => Math.max(m, v.score), 0);
    return { team: t, score, tick: fin ? fin.tick : null };
  }).sort((a, b) => {
    const fa = a.tick !== null, fb = b.tick !== null;
    if (fa && fb) return a.tick - b.tick;
    if (fa !== fb) return fa ? -1 : 1;
    return b.score - a.score;
  });
  lastResult = { rows, finished: rows[0].tick !== null, until: autoPause ? Infinity : millis() + 5000 };
  racePhase = 'ready'; // les voitures attendent au départ
  if (autoPause) setPaused(true);
}

function drawOverlay() {
  push();
  textAlign(CENTER);
  noStroke();
  const r = lastResult;
  if (r && millis() < r.until) {
    const w = 440, h = 110 + r.rows.length * 26, x = (width - w) / 2, y = (height - h) / 2;
    rectMode(CORNER);
    fill(8, 10, 20, 235); stroke(255, 255, 255, 70); strokeWeight(1);
    rect(x, y, w, h, 14);
    noStroke(); fill(255); textSize(20);
    text(r.finished ? '🏁 Gagnant de la course' : 'Meilleure progression', width / 2, y + 34);
    fill(r.rows[0].team.color); textSize(28);
    text(r.rows[0].team.name, width / 2, y + 70);
    textSize(14);
    r.rows.forEach((row, i) => {
      const yy = y + 100 + i * 26;
      fill(row.team.color); ellipse(x + 28, yy - 5, 10, 10);
      fill(235); textAlign(LEFT); text((i + 1) + '. ' + row.team.name, x + 44, yy);
      textAlign(RIGHT);
      text(row.tick !== null ? (row.tick / 60).toFixed(1) + ' s' : (row.score / checkpoints.length).toFixed(2) + ' tours', x + w - 22, yy);
    });
    if (r.until === Infinity) { textAlign(CENTER); fill(150); textSize(12); text('Espace / ▶ pour fermer · « Lancer la course » pour rejouer', width / 2, y + h - 8); }
  } else if (paused) {
    fill(255); textSize(22); text('⏸ PAUSE', width / 2, 34);
  } else if (racePhase === 'train') {
    fill(255); textSize(20); text('Entraînement : génération ' + generationCount + ' / ' + trainTarget, width / 2, 34);
  } else if (racePhase === 'ready') {
    fill(255); textSize(20); text('Prêt : clique sur « Lancer la course »', width / 2, 34);
  } else if (mode === 'race' && racePhase === 'config') {
    fill(255); textSize(22);
    text(raceRacers.length ? 'Voitures entraînées prêtes : « Lancer la course » (ou ré-entraîne)'
                           : 'Configure les équipes puis clique sur « Entraîner »', width / 2, height / 2);
  }
  pop();
}


// ---------- Entraînement puis course (onglet Course) ----------
// À chaque génération d'entraînement on garde le meilleur cerveau de chaque équipe
function captureTrainBest() {
  for (const t of teams) {
    const vs = savedVehicles.filter(v => v.team === t);
    if (!vs.length) continue;
    const v = vs.reduce((a, b) => (b.score > a.score ? b : a));
    if (!t.trainBrain || v.score > t.trainScore) {
      const b = v.brain;
      t.trainScore = v.score;
      t.trainBrain = { inputs: b.input_nodes, hidden: b.hidden.slice(), outputs: b.output_nodes, weights: b.serialize() };
    }
  }
}

function startTraining() {
  if (!raceTeams.length) return;
  raceRacers.length = 0;
  raceTeams.forEach(t => { t.trainBrain = null; t.trainScore = -1; });
  teams = raceTeams;
  racePhase = 'train';
  resetPopulation();
}

function finishTraining() {
  raceRacers.length = 0;
  raceTeams.forEach(t => {
    if (!t.trainBrain) return;
    raceRacers.push({ // une voiture par équipe, cerveau figé ; nom / couleur / portée / vitesse restent liés à la carte
      get name() { return t.name; }, get color() { return t.color; },
      get sight() { return t.sight; }, get speed() { return t.speed; },
      rays: t.trainBrain.inputs, layers: t.trainBrain.hidden.length, neurons: t.trainBrain.hidden[0],
      count: 1, best: 0, done: false, champion: t.trainBrain
    });
  });
  teams = raceRacers;
  resetPopulation();
  racePhase = 'ready';
}

function startRace() {
  if (racePhase === 'train' || !raceRacers.length) return;
  teams = raceRacers;
  racePhase = 'run';
  resetPopulation();
}

// ---------- Debug (touche D) ----------
function drawDebug(b) {
  if (!b.inputs) return;
  const x = 262, w = 290, h = 160, y = height - h - 14;
  push();
  rectMode(CORNER); noStroke(); textAlign(LEFT);
  fill(8, 10, 20, 225); rect(x, y, w, h, 10);
  fill(255); textSize(13); text('DEBUG (D) · meilleure voiture', x + 12, y + 20);
  const deg = (b.out[0] - 0.5) * 360;
  const dir = Math.abs(deg) < 3 ? 'tout droit' : deg > 0 ? 'droite' : 'gauche';
  textSize(12); fill(220);
  text('Volant : ' + dir + ' (' + Math.abs(deg).toFixed(0) + '°)', x + 12, y + 40);
  text('Vitesse voulue : ' + b.wantSpeed.toFixed(1) + ' / ' + b.maxspeed, x + 12, y + 56);
  text('Vitesse réelle : ' + b.vel.mag().toFixed(1), x + 12, y + 72);
  text('Sans checkpoint : ' + b.counter + ' / ' + LIFESPAN, x + 12, y + 88);
  const n = b.inputs.length, bw = Math.max(3, Math.min(14, (w - 24) / n - 2));
  for (let i = 0; i < n; i++) {
    const v = b.inputs[i], bx = x + 12 + i * (bw + 2);
    fill(55); rect(bx, y + 96, bw, 40);
    fill(lerp(60, 255, v), lerp(220, 60, v), 80); rect(bx, y + 136 - 40 * v, bw, 40 * v);
  }
  fill(150); textSize(10);
  text('capteurs (gauche → droite) : barre haute = mur proche', x + 12, y + 152);
  pop();
}