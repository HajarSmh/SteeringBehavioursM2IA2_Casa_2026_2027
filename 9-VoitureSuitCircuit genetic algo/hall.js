// Panthéon des champions : le meilleur cerveau de chaque génération (mode Évolution)
// Sauvegardé en mémoire + localStorage, rejouable dans l'onglet "Champions".
const HALL_KEY = 'voiture-hall-v1';
const HALL_MAX = 100;
let hall = [];
let hallSel = new Set();
let hallSeq = 0;

function loadHall() {
  try {
    hall = JSON.parse(localStorage.getItem(HALL_KEY)) || [];
    hallSeq = hall.reduce((m, e) => Math.max(m, e.id), 0);
  } catch (e) { hall = []; }
}

function saveHall() {
  try { localStorage.setItem(HALL_KEY, JSON.stringify(hall)); } catch (e) {}
}

// Appelé avant la destruction des voitures de la génération
function recordChampion(vehicles) {
  if (!vehicles.length) return;
  const v = vehicles.reduce((a, b) => (b.score > a.score ? b : a));
  if (v.score < 1) return;
  const b = v.brain;
  hall.push({
    id: ++hallSeq, gen: generationCount, score: v.score,
    laps: v.score / checkpoints.length, complexity,
    sight: v.team.sight, speed: v.team.speed,
    inputs: b.input_nodes, hidden: b.hidden.slice(), outputs: b.output_nodes,
    weights: b.serialize()
  });
  if (hall.length > HALL_MAX) { // on retire le moins bon non sélectionné
    let w = -1;
    hall.forEach((e, i) => {
      if (!hallSel.has(e.id) && (w < 0 || e.score < hall[w].score)) w = i;
    });
    if (w >= 0) hall.splice(w, 1);
  }
  saveHall();
}

function championBrain(e) {
  return NeuralNetwork.deserialize(e.inputs, e.hidden, e.outputs, e.weights);
}