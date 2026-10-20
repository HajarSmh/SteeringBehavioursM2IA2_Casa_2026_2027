// Génération suivante : chaque équipe évolue séparément
// (en mode Évolution il n'y a qu'une seule équipe)
function nextGeneration() {
  if (mode === 'evo') recordChampion(savedVehicles); // sauvegarde du meilleur cerveau
  if (racePhase === 'train') captureTrainBest();      // meilleur cerveau de chaque équipe
  if (mode === 'evo' && randomArch) rotateSpecies();  // l'architecture évolue aussi
  calculateFitnessForAllCars();
  population = [];
  for (const t of teams) {
    if (t.fresh) { // nouvelle espèce : cerveaux aléatoires
      t.fresh = false;
      for (let i = 0; i < t.count; i++) population.push(new Vehicle(null, t));
      continue;
    }
    const pool = savedVehicles.filter(v => v.team === t);
    if (!pool.length) continue;
    for (let i = 0; i < t.count; i++) {
      // le premier enfant est le meilleur parent, sans mutation (élitisme)
      population.push(pickOne(pool, i === 0));
    }
  }
  savedVehicles.forEach(v => v.dispose());
  savedVehicles = [];
}

// Mode "architectures aléatoires" : la moins bonne espèce (âgée d'au moins 3 générations)
// est remplacée par une espèce à architecture tirée au hasard.
function rotateSpecies() {
  teams.forEach(t => (t.age = (t.age || 0) + 1));
  const scores = teams.map(t => savedVehicles.filter(v => v.team === t).reduce((m, v) => Math.max(m, v.score), 0));
  let worst = -1;
  teams.forEach((t, i) => { if (t.age >= 3 && (worst < 0 || scores[i] < scores[worst])) worst = i; });
  if (worst < 0) return;
  const nt = randomTeam(teams[worst].species);
  nt.fresh = true;
  teams[worst] = nt;
}

// Roulette : probabilité proportionnelle à la fitness
function pickOne(pool, elite) {
  let parent;
  if (elite) {
    parent = pool.reduce((a, b) => (b.fitness > a.fitness ? b : a));
  } else {
    let r = random(1), i = 0;
    while (r > 0 && i < pool.length) {
      r -= pool[i].fitness;
      i++;
    }
    parent = pool[Math.max(0, i - 1)];
  }
  const child = new Vehicle(parent.brain, parent.team);
  if (!elite) child.mutate();
  return child;
}

// Fitness exponentielle puis normalisée par équipe
function calculateFitnessForAllCars() {
  for (const v of savedVehicles) v.calculateFitness();
  for (const t of teams) {
    const pool = savedVehicles.filter(v => v.team === t);
    const sum = pool.reduce((s, v) => s + v.fitness, 0) || 1;
    pool.forEach(v => (v.fitness /= sum));
  }
}