let sceneCanvas;
let lifespan = TargetSwarm.DEFAULT_LIFESPAN;       // secondes avant division (curseur)
const vehicles = [];
const targets = [];                                 // les avions
const decoys = [];                                  // leurres jaunes
const effects = [];                                 // anneaux d'animation
const snakes = [];                                  // 3 serpents qui suivent la souris
const fruits = [];                                  // fruits immobiles, réveillés par un serpent proche
const poops = [];                                   // boules de feu éjectées par les serpents (les dragons qui en mangent rétrécissent)
const cars = [];                                    // voitures qui suivent la piste
const MAX_CARS = 100;
const stones = [];                                  // pierres rondes posées sur la piste
const STONE_COUNT = 20;                              // nombre de pierres
let track;                                          // la piste
const bushes = [];                                  // buissons ronds (désactivés : BUSH_COUNT = 0)
const BUSH_COUNT = 0;                              // 0 = aucun obstacle : les serpents parcourent tout l'écran
let trackSnake;                                     // serpent qui suit la piste
const dragons = [];                                 // dragons : mangent les oiseaux, mordent les serpents
const birdRespawns = [];                            // minuteurs avant le retour d'un oiseau mangé
let gameStartMs = 0;                                // début de la partie (temps de survie)
let gameOver = false;                               // true quand les 3 serpents sont morts
let victory = false;                                // true quand tous les dragons sont morts
let started = false;                                // false tant que le joueur n'a pas cliqué sur START GAME
let dragonCount = DRAGON_COUNT;                     // réglés sur l'écran de départ
let snakeCount = SNAKE_SPECS.length;
const MAX_DRAGONS = 6;
const MAX_SNAKES = 6;
const birds = [];                                   // oiseaux qui volent partout
const BIRD_COUNT = 25;                              // nombre d'oiseaux
// Passe à true pour réafficher les avions et les vaisseaux (leur code est conservé)
const SHOW_PLANES_AND_SHIPS = false;
let bgBrightness = 1;                               // 0..1 : luminosité du fond (curseur)
const mouseState = { x: 0.5, y: 0.5 };              // valeurs lissées 0..1
const NO_EXCLUSION = { x: -1e6, y: -1e6 };          // pas de cible unique à éviter pour les ajouts
const YELLOW_HUE = 52;

function sceneHeight() {
  return Math.max(1, windowHeight - document.getElementById('controls').offsetHeight);
}

function newTarget() {
  const p = TargetSwarm.safePosition(width, height, vehicles, 250);
  return new RandomTarget(p.x, p.y);
}

function newFruit() {
  // position aléatoire, loin des têtes de serpents
  let x, y, tries = 0;
  do {
    x = random(40, width - 40);
    y = random(40, height - 40);
    tries++;
  } while (tries < 20 && (snakes.some(s => dist(x, y, s.head.pos.x, s.head.pos.y) < 200) ||
                          bushes.some(b => dist(x, y, b.pos.x, b.pos.y) < b.r + 20)));
  return new Fruit(x, y);
}

function scatterBushes() {
  bushes.length = 0;
  bushes.push(...Bush.scatter(BUSH_COUNT, width, height, track));
}

function addCar() {
  if (cars.length >= MAX_CARS) return;
  cars.push(new Car(track, track.bestStart(cars.concat(stones))));
}

function setup() {
  sceneCanvas = createCanvas(windowWidth, sceneHeight());
  sceneCanvas.parent('scene');

  // Piste + voitures de départ
  track = new Track(width, height);
  stones.push(...Stone.scatter(STONE_COUNT, track));
  addCar(); addCar(); addCar();
  trackSnake = new TrackSnake(track, track.bestStart(cars.concat(stones)));
  scatterBushes();
  document.getElementById('car-add').addEventListener('click', addCar);
  document.getElementById('car-remove').addEventListener('click', () => cars.pop());

  // Oiseaux : placés au hasard sur tout l'écran
  for (let i = 0; i < BIRD_COUNT; i++) {
    birds.push(new Bird(random(width), random(height)));
  }

  // Dragons : placés au hasard
  for (let i = 0; i < dragonCount; i++) dragons.push(new Dragon(random(width), random(height)));

  for (let i = 0; i < TargetSwarm.INITIAL_TARGETS; i++) targets.push(newTarget());

  // Avions et vaisseaux masqués : on cache aussi leurs commandes
  if (!SHOW_PLANES_AND_SHIPS) {
    document.querySelectorAll(
      '#vehicle-count, #vehicle-count-value, label[for="vehicle-count"], ' +
      '#split-delay, #split-delay-value, label[for="split-delay"], #target-count'
    ).forEach(el => { el.style.display = 'none'; });
  }

  // Serpents : largeurs et longueurs différentes (voir SNAKE_SPECS dans snake.js)
  for (let i = 0; i < snakeCount; i++) {
    snakes.push(new Snake(random(width), random(height), snakeSpec(i), i));
  }

  // Fruits placés au hasard
  for (let i = 0; i < FRUIT_COUNT; i++) fruits.push(newFruit());

  // Curseurs des serpents : écart entre les points
  const spacingSlider = document.getElementById('snake-spacing');
  const spacingOut = document.getElementById('snake-spacing-value');
  spacingSlider.addEventListener('input', () => {
    const r = parseFloat(spacingSlider.value);
    spacingOut.textContent = r.toFixed(2);
    for (const s of snakes) s.setSpacingRatio(r);
  });

  const slider = document.getElementById('vehicle-count');
  slider.value = SeekPopulation.INITIAL_COUNT;
  SeekPopulation.bindSlider(
    slider,
    document.getElementById('vehicle-count-value'),
    vehicles,
    NO_EXCLUSION,
    () => ({ width, height }),
    (x, y) => new Vehicle(x, y)
  );

  // Durée de survie avant division : événement "input" = effet immédiat
  const delaySlider = document.getElementById('split-delay');
  const delayOutput = document.getElementById('split-delay-value');
  const syncDelay = () => {
    lifespan = TargetSwarm.clampLifespan(delaySlider.value);
    delaySlider.value = lifespan;
    delayOutput.textContent = `${lifespan} s`;
  };
  delaySlider.addEventListener('input', syncDelay);
  syncDelay();

  // Curseur de luminosité du fond
  const dimSlider = document.getElementById('bg-dim');
  const dimOut = document.getElementById('bg-dim-value');
  const syncDim = () => {
    bgBrightness = dimSlider.value / 100;
    dimOut.textContent = `${dimSlider.value} %`;
    dimSlider.style.setProperty('--pct', `${dimSlider.value}%`);
  };
  dimSlider.addEventListener('input', syncDim);
  syncDim();

  // Game over : bouton Restart (ou touche R)
  gameStartMs = millis();
  document.getElementById('restart').addEventListener('click', restartGame);
  document.getElementById('restart-victory').addEventListener('click', restartGame);

  // Écran de départ : réglage du nombre de dragons / serpents + START GAME
  const bindCounter = (name, get, set, min, max) => {
    const out = document.getElementById(`${name}-count-value`);
    const sync = () => { out.textContent = get(); };
    document.getElementById(`${name}-minus`).addEventListener('click', () => { set(Math.max(min, get() - 1)); sync(); });
    document.getElementById(`${name}-plus`).addEventListener('click', () => { set(Math.min(max, get() + 1)); sync(); });
    sync();
  };
  bindCounter('dragon', () => dragonCount, v => { dragonCount = v; }, 1, MAX_DRAGONS);
  bindCounter('snake', () => snakeCount, v => { snakeCount = v; }, 1, MAX_SNAKES);
  document.getElementById('start-game').addEventListener('click', startGame);
  document.getElementById('start-game').focus();

  // Bouton debug (ou touche D)
  document.getElementById('debug-toggle').addEventListener('click', () => DebugMode.toggle());

  const musicButton = document.getElementById('music-toggle');
  if (musicButton && typeof PsychedelicMusic !== 'undefined') {
    musicButton.addEventListener('click', async () => {
      const on = await PsychedelicMusic.toggle();
      musicButton.setAttribute('aria-pressed', String(on));
      musicButton.textContent = on ? '🔇 Couper la musique' : '🎵 Lancer la musique';
    });
    document.getElementById('music-volume').addEventListener('input', event => {
      PsychedelicMusic.setVolume(event.target.value / 100);
    });
  }
}

function draw() {
  const dt = Math.min(deltaTime, 100) / 1000;   // secondes réelles, plafonnées (onglet en pause)

  // --- Entrée souris (uniquement si le pointeur est dans le canvas) ---
  let mousePos = null;
  if (MouseInfluence.inside(mouseX, mouseY, width, height)) {
    mousePos = createVector(mouseX, mouseY);
    const goal = MouseInfluence.normalize(mouseX, mouseY, width, height);
    mouseState.x = MouseInfluence.smooth(mouseState.x, goal.x);
    mouseState.y = MouseInfluence.smooth(mouseState.y, goal.y);
  }

  // --- Fond psychédélique rétro ---
  RetroBackground.draw(drawingContext, width, height, millis() / 1000, mouseState.x, mouseState.y);

  // --- Atténuation du fond (voile noir, la piste et le reste restent intacts) ---
  if (bgBrightness < 1) {
    push();
    noStroke();
    fill(0, 0, 0, (1 - bgBrightness) * 255);
    rect(0, 0, width, height);
    pop();
  }

  // --- Piste (dessinée par-dessus le fond) ---
  track.show();

  // --- Musique ---
  if (typeof PsychedelicMusic !== 'undefined') {
    PsychedelicMusic.setMouse(mouseState.x, mouseState.y);
  }

  // --- Serpents : la tête suit la souris, le corps suit la tête ---
  const t = millis() / 1000;
  for (const s of snakes) s.follow(mousePos, t, width, height, bushes);

  // --- Voitures : suivent la piste et restent dans ses contours ---
  // obstacles des voitures et du serpent de circuit : pierres + les 3 serpents de la souris
  const trackObstacles = stones.concat(snakes.flatMap(s => s.circles()));
  for (const c of cars) c.follow(track, cars, trackSnake.bodyPoints(), trackObstacles);
  trackSnake.follow(track, cars, trackObstacles);

  // --- Fruits : ils foncent vers le serpent très proche, puis sont mangés ---
  for (let i = fruits.length - 1; i >= 0; i--) {
    const eater = fruits[i].chase(snakes);
    if (eater) {
      effects.push(new SplitRing(fruits[i].pos.x, fruits[i].pos.y, fruits[i].hue,
        { duration: 0.4, maxRadius: 40 }));
      eater.eat();
      fruits.splice(i, 1);
    }
  }
  while (fruits.length < FRUIT_COUNT) fruits.push(newFruit());

  // --- Crottes : éjectées du dernier point, glissent puis s'effacent (Sécurisé) ---
  for (const s of snakes) {
    if (typeof s.updateDigestion === 'function') {
      const newPoops = s.updateDigestion(dt);
      if (Array.isArray(newPoops)) {
        poops.push(...newPoops);
      } else if (newPoops) {
        poops.push(newPoops);
      }
    }
  }

  for (let i = poops.length - 1; i >= 0; i--) {
    const p = poops[i];
    p.advance(dt);
    p.update();
    p.pos.set(constrain(p.pos.x, 0, width), constrain(p.pos.y, 0, height));
    if (p.done) poops.splice(i, 1);
  }

  if (SHOW_PLANES_AND_SHIPS) {
  // --- Avions : fuient véhicules + souris ---
  for (const targetItem of targets) {
    targetItem.setStyle(mouseState.x, mouseState.y);
    targetItem.steer(width, height, vehicles, mousePos);
    targetItem.update();
    targetItem.pos.set(constrain(targetItem.pos.x, 0, width), constrain(targetItem.pos.y, 0, height));
  }

  // --- Leurres : dérivent puis s'éteignent ---
  for (const d of decoys) {
    d.advance(dt);
    d.update();
    d.pos.set(constrain(d.pos.x, 0, width), constrain(d.pos.y, 0, height));
  }

  // --- Survie : division des avions qui ont atteint la durée réglée ---
  for (const e of TargetSwarm.advance(targets, dt, lifespan, TargetSwarm.MAX_TARGETS)) {
    effects.push(new SplitRing(e.parent.pos.x, e.parent.pos.y, e.parent.displayHue(),
      { duration: 0.8, maxRadius: 110 }));
  }

  // --- Poursuite : chaque véhicule vise l'avion OU le leurre le plus proche ---
  const preyList = decoys.length ? targets.concat(decoys) : targets;
  const lost = new Set();       // avions sans leurre : détruits
  const releasing = new Set();  // avions qui lâchent des leurres
  const spent = new Set();      // leurres atteints
  for (const vehicle of vehicles) {
    const prey = TargetSwarm.nearest(vehicle.pos, preyList);
    if (prey && SeekPopulation.step(vehicle, prey.pos, width, height)) {
      if (prey instanceof Decoy) {
        spent.add(prey);
      } else if (!TargetSwarm.isImmune(prey) && prey.flareCooldown <= 0) {
        if (prey.flares > 0) releasing.add(prey);
        else lost.add(prey);
      }
      // le véhicule réapparaît loin de TOUS les avions
      const p = TargetSwarm.safePosition(width, height, targets, 150);
      vehicle.pos.set(p.x, p.y);
      vehicle.vel.set(0, 0);
      vehicle.acc.set(0, 0);
    }
    vehicle.show();
  }

  // --- Avions rattrapés : ils lâchent des leurres (anneau jaune) ---
  for (const plane of releasing) {
    decoys.push(...plane.releaseDecoys());
    effects.push(new SplitRing(plane.pos.x, plane.pos.y, YELLOW_HUE,
      { duration: 0.6, maxRadius: 70 }));
  }

  // --- Leurres atteints ou éteints : retirés ---
  for (let i = decoys.length - 1; i >= 0; i--) {
    if (spent.has(decoys[i])) {
      effects.push(new SplitRing(decoys[i].pos.x, decoys[i].pos.y, YELLOW_HUE,
        { duration: 0.35, maxRadius: 25 }));
    }
    if (spent.has(decoys[i]) || decoys[i].done) decoys.splice(i, 1);
  }

  // --- Avions sans leurre restant : détruits (anneau blanc) ---
  for (const targetItem of TargetSwarm.removeCaught(targets, lost)) {
    effects.push(new SplitRing(targetItem.pos.x, targetItem.pos.y, null, { duration: 0.5, maxRadius: 60 }));
  }
  for (const fresh of TargetSwarm.refill(targets, newTarget, TargetSwarm.INITIAL_TARGETS)) {
    effects.push(new SplitRing(fresh.pos.x, fresh.pos.y, fresh.displayHue(),
      { duration: 0.8, maxRadius: 90 }));
  }
  } // fin SHOW_PLANES_AND_SHIPS

  // --- Dessin de tous les éléments et des animations ---
  if (SHOW_PLANES_AND_SHIPS) {
    for (const d of decoys) d.show();
    for (const targetItem of targets) {
      targetItem.setLife(lifespan);
      targetItem.show();
    }
  }
  for (const b of bushes) b.show();
  for (const st of stones) st.show();
  for (const c of cars) c.show();
  trackSnake.show();
  for (const f of fruits) f.show();
  for (const p of poops) p.show();
  for (const s of snakes) s.show();

  // --- Couverture de verre 3D du circuit : protège voitures et serpent bleu des dragons ---
  track.showCover();

  // --- Oiseaux : ils volent au-dessus de tout, donc dessinés en dernier ---
  for (const b of birds) {
    b.fly(birds);   // flocking + déplacement + réapparition de l'autre côté
    b.show();       // ombre + oiseau avec battement d'ailes
  }

  // --- Dragons : chasse, repas, morsures ---
  for (let i = dragons.length - 1; i >= 0; i--) {
    const dr = dragons[i];
    // avant START GAME, les dragons se promènent seulement (ni oiseaux, ni serpents, ni boules de feu)
    const ev = started ? dr.step(birds, snakes, dt, track, poops) : dr.step([], [], dt, track, []);
    if (dr.shieldHit) {                              // le dragon cogne le verre : onde cyan
      effects.push(new SplitRing(dr.shieldHit.x, dr.shieldHit.y, 190, { duration: 0.35, maxRadius: 40 }));
    }
    if (ev) handleDragonEvent(ev);
    if (dr.dead) {                                   // trop rétréci par les boules de feu : il meurt
      effects.push(new SplitRing(dr.pos.x, dr.pos.y, dr.hue, { duration: 0.9, maxRadius: 130 }));
      dragons.splice(i, 1);
      continue;
    }
    dr.show();
  }
  if (started && dragons.length === 0 && !victory && !gameOver) triggerVictory();   // plus aucun dragon

  // --- Retour des oiseaux mangés ---
  for (let i = birdRespawns.length - 1; i >= 0; i--) {
    birdRespawns[i] -= dt;
    if (birdRespawns[i] <= 0) {
      birds.push(new Bird(random(width), random(height)));
      birdRespawns.splice(i, 1);
    }
  }

  // --- Debug : tout ce qui hérite de Vehicle (touche D / bouton) ---
  if (Vehicle.debug) {
    DebugMode.draw([
      SHOW_PLANES_AND_SHIPS ? vehicles.concat(targets, decoys) : [],
      cars, [trackSnake], fruits, snakes, dragons
    ]);
  }

  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].advance(dt);
    effects[i].show();
    if (effects[i].done) effects.splice(i, 1);
  }


  const label = `Cibles : ${targets.length}`;
  const countOutput = document.getElementById('target-count');
  if (countOutput.textContent !== label) countOutput.textContent = label;

  const carLabel = `Voitures : ${cars.length}`;
  const carOutput = document.getElementById('car-count');
  if (carOutput.textContent !== carLabel) carOutput.textContent = carLabel;
}

// Évènement renvoyé par Dragon.step() : un oiseau mangé ou un serpent mordu
function handleDragonEvent(ev) {
  if (ev.kind === 'fireball') {                      // boule de feu mangée : le dragon rétrécit
    ev.ref.done = true;
    const i = poops.indexOf(ev.ref);
    if (i >= 0) poops.splice(i, 1);
    effects.push(new SplitRing(ev.x, ev.y, 20, { duration: 0.5, maxRadius: 55 }));
    return;
  }
  if (ev.kind === 'bird') {
    const i = birds.indexOf(ev.ref);
    if (i >= 0) birds.splice(i, 1);
    birdRespawns.push(BIRD_RESPAWN_SECONDS);
    effects.push(new SplitRing(ev.x, ev.y, 30, { duration: 0.4, maxRadius: 45 }));
    return;
  }
  const s = ev.ref;
  const tail = s.segments.length ? s.segments[s.segments.length - 1] : s.head.pos;
  effects.push(new SplitRing(tail.x, tail.y, s.hue, { duration: 0.4, maxRadius: 50 }));
  if (s.bite()) {                                    // plus que la tête : le serpent est mort
    effects.push(new SplitRing(s.head.pos.x, s.head.pos.y, null, { duration: 0.9, maxRadius: 130 }));
    snakes.splice(snakes.indexOf(s), 1);
    if (snakes.length === 0) triggerGameOver();      // les 3 serpents sont morts
  }
}

// Nouveau serpent (nouvelle partie), avec les réglages actuels des curseurs
function spawnSnake(i) {
  let x, y, tries = 0;                                // loin des dragons
  do {
    x = random(width);
    y = random(height);
    tries++;
  } while (tries < 20 && dragons.some(d => dist(x, y, d.pos.x, d.pos.y) < 250));
  const s = new Snake(x, y, snakeSpec(i), i);
  s.setSpacingRatio(parseFloat(document.getElementById('snake-spacing').value));
  snakes.push(s);
  effects.push(new SplitRing(s.head.pos.x, s.head.pos.y, s.hue, { duration: 0.6, maxRadius: 70 }));
}

// Écran GAME OVER (HTML, voir #game-over) : la scène continue de vivre derrière
function triggerGameOver() {
  if (victory) return;
  gameOver = true;
  const secs = Math.round((millis() - gameStartMs) / 1000);
  document.getElementById('game-over-time').textContent = `Survie : ${secs} s`;
  document.getElementById('game-over').hidden = false;
  document.getElementById('restart').focus();
}

// Spécification du serpent n° i : au-delà de 3 serpents, on réutilise les 3 modèles
// avec une autre teinte et une autre orbite (pour qu'ils ne se superposent pas).
function snakeSpec(i) {
  const base = SNAKE_SPECS[i % SNAKE_SPECS.length];
  const round = Math.floor(i / SNAKE_SPECS.length);
  if (round === 0) return base;
  return {
    ...base,
    hue: (base.hue + 70 * round) % 360,
    orbit: base.orbit + 45 * round,
    orbitSpeed: base.orbitSpeed * (round % 2 ? -1.3 : 1.3)
  };
}

// Bouton START GAME : cache l'écran de départ et lance une vraie partie
function startGame() {
  if (started) return;
  started = true;
  document.getElementById('start-screen').hidden = true;
  restartGame();
}

// Écran VICTORY (HTML, voir #victory) : tous les dragons sont morts
function triggerVictory() {
  victory = true;
  const secs = Math.round((millis() - gameStartMs) / 1000);
  document.getElementById('victory-time').textContent = `Temps : ${secs} s`;
  document.getElementById('victory').hidden = false;
  document.getElementById('restart-victory').focus();
}

// Nouvelle partie : 3 serpents neufs, oiseaux remis, dragons recréés
function restartGame() {
  snakes.length = 0;
  poops.length = 0;
  birds.length = 0;
  birdRespawns.length = 0;
  for (let i = 0; i < BIRD_COUNT; i++) birds.push(new Bird(random(width), random(height)));
  dragons.length = 0;                                 // les dragons morts reviennent
  for (let i = 0; i < dragonCount; i++) dragons.push(new Dragon(random(width), random(height)));
  for (let i = 0; i < snakeCount; i++) spawnSnake(i);
  gameOver = false;
  victory = false;
  document.getElementById('victory').hidden = true;
  document.getElementById('restart-victory').blur();
  gameStartMs = millis();
  document.getElementById('game-over').hidden = true;
  document.getElementById('restart').blur();
}

function keyPressed() {
  if (key === 'd' || key === 'D') DebugMode.toggle();
  if ((key === 'r' || key === 'R') && (gameOver || victory)) restartGame();
  if (keyCode === ENTER && !started) startGame();
}

function windowResized() {
  resizeCanvas(windowWidth, sceneHeight());
  track.rebuild(width, height);
  for (const st of stones) st.place(track);
  scatterBushes();
  for (const c of cars) c.snapToTrack(track);
  trackSnake.snapToTrack(track);
  for (const targetItem of targets) {
    targetItem.pos.set(constrain(targetItem.pos.x, 0, width), constrain(targetItem.pos.y, 0, height));
  }
  for (const vehicle of vehicles) vehicle.edges();
  for (const s of snakes) {
    s.head.pos.set(constrain(s.head.pos.x, 0, width), constrain(s.head.pos.y, 0, height));
  }
  for (const f of fruits) {
    f.pos.set(constrain(f.pos.x, 0, width), constrain(f.pos.y, 0, height));
  }
  for (const b of birds) {
    b.pos.set(constrain(b.pos.x, 0, width), constrain(b.pos.y, 0, height));
  }
  for (const dr of dragons) dr.edges();
}