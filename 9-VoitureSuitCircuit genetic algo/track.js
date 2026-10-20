// Génération procédurale de circuits : ligne centrale fermée (courbe polaire ou super-ellipse),
// largeur variable, frontières par décalage le long des normales, validation, repli sur un ovale sûr.
// Fichier indépendant de p5 : n'utilise que des objets {x, y}.
const TRACK_TYPES = {
  oval: 'Ovale simple',
  tight: 'Virages serrés',
  winding: 'Sinueux',
  straights: 'Longues lignes droites',
  complex: 'Complexe (largeur variable)'
};
const TRACK_N = 140; // nombre de checkpoints / points par frontière

// PRNG déterministe : un même (type, complexité, graine) redonne le même circuit
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function segsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// k in [0,1] = complexité normalisée
function buildCandidate(type, k, seed, W, H) {
  const R = mulberry(seed), TAU = Math.PI * 2, N = TRACK_N;
  const ph = Array.from({ length: 9 }, () => R() * TAU);
  const margin = 110, rx = W / 2 - margin, ry = H / 2 - margin;

  // 1) rayon r(a) selon le type
  let rs = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    let r = 1;
    if (type === 'oval') {
      r = 1 + 0.10 * k * Math.cos(2 * a + ph[0]) + 0.05 * k * Math.cos(3 * a + ph[1]);
    } else if (type === 'tight') {
      const h = 3 + Math.round(2 * k) + (seed % 2);
      r = 0.75 + (0.10 + 0.12 * k) * Math.cos(h * a + ph[0]) + (0.04 + 0.06 * k) * Math.cos((h + 3) * a + ph[1]);
    } else if (type === 'winding') {
      r = 0.75;
      const M = 3 + Math.round(3 * k);
      for (let m = 2; m <= M; m++) r += ((0.10 + 0.14 * k) / Math.pow(m, 0.7)) * Math.cos(m * a + ph[m]);
    } else if (type === 'complex') {
      r = 0.75;
      const M = 4 + Math.round(4 * k);
      for (let m = 2; m <= M; m++) r += ((0.09 + 0.13 * k) / Math.pow(m, 0.5)) * Math.cos(m * a + ph[m]);
    } else { // straights
      r = 1 + 0.07 * k * Math.cos(3 * a + ph[0]);
    }
    rs.push(r);
  }
  const hi = Math.max(...rs);
  rs = rs.map(r => Math.max(0.3, r / hi)); // max = 1 : reste dans le cadre

  // 2) ligne centrale
  const C = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU, c = Math.cos(a), s = Math.sin(a);
    let ux, uy;
    if (type === 'straights') { // super-ellipse n=4 : côtés quasi droits, coins arrondis
      ux = Math.sign(c) * Math.sqrt(Math.abs(c)) * rs[i];
      uy = Math.sign(s) * Math.sqrt(Math.abs(s)) * rs[i];
    } else { ux = rs[i] * c; uy = rs[i] * s; }
    C.push({ x: W / 2 + ux * rx, y: H / 2 + uy * ry });
  }

  // 3) demi-largeur (varie avec la complexité selon le type)
  const base = 46 - 14 * k;
  const wv = { oval: 0, tight: 0.1 + 0.1 * k, winding: 0.15 * k, straights: 0.1 * k, complex: 0.15 + 0.25 * k }[type];
  const wf = 2 + Math.floor(R() * 3);
  const hw = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    hw.push(Math.min(58, Math.max(26, base * (1 + wv * Math.sin(wf * a + ph[7])))));
  }

  // 4) frontières : décalage le long de la normale sortante (n = (ty, -tx), parcours anti-horaire)
  const I = [], O = [];
  for (let i = 0; i < N; i++) {
    const p = C[(i + N - 1) % N], q = C[(i + 1) % N];
    let tx = q.x - p.x, ty = q.y - p.y;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const nx = ty, ny = -tx;
    I.push({ x: C[i].x - nx * hw[i], y: C[i].y - ny * hw[i] });
    O.push({ x: C[i].x + nx * hw[i], y: C[i].y + ny * hw[i] });
  }
  return { inside: I, outside: O, center: C, hw };
}

// Renvoie '' si le circuit est valide, sinon la raison de l'échec
function trackProblem(t, W, H) {
  const I = t.inside, O = t.outside, C = t.center, hw = t.hw, N = I.length;
  const segs = [];
  for (let L = 0; L < 2; L++) {
    const P = L ? O : I;
    for (let i = 0; i < N; i++) {
      const p = P[i], q = P[(i + 1) % N];
      if (p.x < 8 || p.y < 8 || p.x > W - 8 || p.y > H - 8) return 'hors du cadre';
      if (Math.hypot(q.x - p.x, q.y - p.y) < 2) return 'segment dégénéré';
      segs.push([p.x, p.y, q.x, q.y, L, i]);
    }
  }
  for (let a = 0; a < segs.length; a++) {
    for (let b = a + 1; b < segs.length; b++) {
      const s = segs[a], u = segs[b];
      if (s[4] === u[4]) { const d = u[5] - s[5]; if (d <= 1 || d >= N - 1) continue; }
      if (segsCross(s[0], s[1], s[2], s[3], u[0], u[1], u[2], u[3])) return 'intersection';
    }
  }
  // deux portions éloignées de la piste ne doivent pas se frôler
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const gap = Math.min(j - i, N - (j - i));
      if (gap > N / 10 && Math.hypot(C[i].x - C[j].x, C[i].y - C[j].y) < hw[i] + hw[j] + 16) return 'sections trop proches';
    }
  }
  return '';
}

function generateTrack(type, complexity, seed, W, H) {
  const keys = Object.keys(TRACK_TYPES);
  if (!TRACK_TYPES[type]) type = keys[Math.floor(mulberry(seed)() * keys.length)];
  const k0 = (complexity - 1) / 9;
  for (let attempt = 0; attempt < 40; attempt++) {
    const k = Math.max(0, k0 - Math.floor(attempt / 10) * 0.15); // on simplifie si ça échoue
    const t = buildCandidate(type, k, seed + attempt * 7919, W, H);
    if (!trackProblem(t, W, H)) {
      return Object.assign(t, { type, requested: type, baseSeed: seed, complexity, attempts: attempt + 1, fallback: false });
    }
  }
  // repli : ovale sûr (jamais de piste cassée)
  const t = buildCandidate('oval', 0, seed, W, H);
  return Object.assign(t, { type: 'oval', requested: type, baseSeed: seed, complexity, attempts: 40, fallback: true });
}

if (typeof module !== 'undefined') module.exports = { generateTrack, trackProblem, TRACK_TYPES };