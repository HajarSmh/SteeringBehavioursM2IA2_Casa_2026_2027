let sceneCanvas;
let lifespan = TargetSwarm.DEFAULT_LIFESPAN;       // secondes avant division (curseur)
const vehicles = [];
const targets = [];                                 // les avions
const decoys = [];                                  // leurres jaunes
const effects = [];                                 // anneaux d'animation
const snakes = [];                                  // 3 serpents qui suivent la souris
const fruits = [];                                  // fruits immobiles, réveillés par un serpent proche
const poops = [];                                   // crottes éjectées par les serpents
const cars = [];                                    // voitures qui suivent la piste
const MAX_CARS = 100;
const stones = [];                                  // pierres rondes posées sur la piste
const STONE_COUNT = 20;                              // nombre de pierres
let track;                                          // la piste
const bushes = [];                                  // buissons ronds (obstacles pour les 3 serpents)
const BUSH_COUNT = 6;                              // nombre de buissons demandé
let trackSnake;                                     // serpent qui suit la piste
// Passe à true pour réafficher les avions et les vaisseaux (leur code est conservé)
const SHOW_PLANES_AND_SHIPS = false;
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

  for (let i = 0; i < TargetSwarm.INITIAL_TARGETS; i++) targets.push(newTarget());

  // Avions et vaisseaux masqués : on cache aussi leurs commandes
  if (!SHOW_PLANES_AND_SHIPS) {
    document.querySelectorAll(
      '#vehicle-count, #vehicle-count-value, label[for="vehicle-count"], ' +
      '#split-delay, #split-delay-value, label[for="split-delay"], #target-count'
    ).forEach(el => { el.style.display = 'none'; });
  }

  // Serpents : largeurs et longueurs différentes (voir SNAKE_SPECS dans snake.js)
  SNAKE_SPECS.forEach((spec, i) => {
    snakes.push(new Snake(random(width), random(height), spec, i));
  });

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

  // Curseurs des serpents : longueur (nombre de points)
  const lengthSlider = document.getElementById('snake-length');
  const lengthOut = document.getElementById('snake-length-value');
  lengthSlider.addEventListener('input', () => {
    const k = parseFloat(lengthSlider.value);
    lengthOut.textContent = `×${k.toFixed(1)}`;
    for (const s of snakes) s.setLengthScale(k);
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
}