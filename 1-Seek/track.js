// Piste fermée, irrégulière, avec des virages.
// La ligne centrale est une spline Catmull-Rom passant par des points de contrôle
// (coordonnées normalisées 0..1, donc la piste s'adapte à la taille du canvas).
class Track {
  // Sens horaire : virages serrés, épingle intérieure, bosse vers le centre...
  static CONTROL = [
    [0.15, 0.55], [0.12, 0.25], [0.30, 0.10], [0.50, 0.25],
    [0.65, 0.08], [0.88, 0.20], [0.92, 0.50], [0.72, 0.58],
    [0.85, 0.82], [0.55, 0.92], [0.45, 0.70], [0.25, 0.88]
  ];
  static STEPS = 14;   // points échantillonnés par portion de spline

  constructor(w, h) {
    this.rebuild(w, h);
  }

  // À rappeler quand le canvas change de taille.
  rebuild(w, h) {
    this.halfWidth = Math.min(55, Math.max(20, Math.min(w, h) * 0.07));
    const P = Track.CONTROL.map(([x, y]) => ({
      x: w * (0.08 + 0.84 * x),
      y: h * (0.10 + 0.80 * y)
    }));
    const n = P.length;
    this.pts = [];
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      for (let k = 0; k < Track.STEPS; k++) {
        const t = k / Track.STEPS, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) =>
          0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        this.pts.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
      }
    }
    // longueurs cumulées (abscisse curviligne)
    const m = this.pts.length;
    this.segLen = [];
    this.cum = [0];
    for (let i = 0; i < m; i++) {
      const a = this.pts[i], b = this.pts[(i + 1) % m];
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      this.segLen.push(l);
      this.cum.push(this.cum[i] + l);
    }
    this.total = this.cum[m];
  }

  // Point de la ligne centrale le plus proche de (x, y).
  // Renvoie : point (x,y), distance, abscisse s, tangente (tx,ty), normale (nx,ny).
  closest(x, y) {
    const m = this.pts.length;
    let best = null;
    let bestD2 = Infinity;
    for (let i = 0; i < m; i++) {
      const a = this.pts[i], b = this.pts[(i + 1) % m];
      const abx = b.x - a.x, aby = b.y - a.y;
      const len2 = abx * abx + aby * aby || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / len2));
      const px = a.x + abx * t, py = a.y + aby * t;
      const d2 = (x - px) * (x - px) + (y - py) * (y - py);
      if (d2 < bestD2) {
        bestD2 = d2;
        const l = this.segLen[i] || 1;
        best = { x: px, y: py, s: this.cum[i] + t * this.segLen[i], tx: abx / l, ty: aby / l };
      }
    }
    best.nx = -best.ty;
    best.ny = best.tx;
    best.dist = Math.sqrt(bestD2);
    return best;
  }

  // Point de la ligne centrale à l'abscisse s (la piste est un circuit : s boucle).
  pointAt(s) {
    s = ((s % this.total) + this.total) % this.total;
    let lo = 0, hi = this.pts.length - 1;
    while (lo < hi) {                       // dichotomie
      const mid = (lo + hi + 1) >> 1;
      if (this.cum[mid] <= s) lo = mid; else hi = mid - 1;
    }
    const a = this.pts[lo], b = this.pts[(lo + 1) % this.pts.length];
    const l = this.segLen[lo] || 1;
    const t = (s - this.cum[lo]) / l;
    const tx = (b.x - a.x) / l, ty = (b.y - a.y) / l;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, tx, ty, nx: -ty, ny: tx, s };
  }

  // Meilleure abscisse de départ : la plus éloignée des voitures déjà présentes.
  bestStart(cars, tries = 24) {
    let bestS = Math.random() * this.total;
    let bestClear = -1;
    for (let i = 0; i < tries; i++) {
      const s = Math.random() * this.total;
      const p = this.pointAt(s);
      let clear = Infinity;
      for (const c of cars) clear = Math.min(clear, Math.hypot(c.pos.x - p.x, c.pos.y - p.y));
      if (clear > bestClear) { bestClear = clear; bestS = s; }
    }
    return bestS;
  }

  show() {
    push();
    noFill();
    strokeJoin(ROUND);
    strokeCap(ROUND);
    const trace = () => {
      beginShape();
      for (const p of this.pts) vertex(p.x, p.y);
      endShape(CLOSE);
    };
    stroke(255, 255, 255);                       // bordures (vibreurs)
    strokeWeight(this.halfWidth * 2 + 12);
    trace();
    stroke(235, 40, 70);
    strokeWeight(this.halfWidth * 2 + 6);
    drawingContext.setLineDash([16, 16]);
    trace();
    drawingContext.setLineDash([]);
    stroke(45, 45, 58);                          // asphalte
    strokeWeight(this.halfWidth * 2);
    trace();
    stroke(255, 255, 255, 190);                  // ligne centrale pointillée
    strokeWeight(2);
    drawingContext.setLineDash([14, 18]);
    trace();
    drawingContext.setLineDash([]);
    pop();
  }
}

if (typeof module !== 'undefined') module.exports = Track;