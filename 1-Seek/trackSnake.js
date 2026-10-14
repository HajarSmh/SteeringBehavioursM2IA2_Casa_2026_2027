// Serpent qui suit la piste et contourne les voitures sans les toucher.
// TrackSnake étend Snake (qui étend Vehicle) : on garde le corps en chaîne de points,
// la tête avec yeux/langue et le dessin, mais on remplace la cible "souris" par le
// suivi de piste + évitement des voitures.
const TRACK_SNAKE_SPEC = {
  name: 'Circuit', count: 22, width: 14,
  maxSpeed: 3.8, maxForce: 0.22, hue: 170,
  orbit: 0, orbitSpeed: 0                      // inutilisés ici
};

class TrackSnake extends Snake {
  constructor(track, s) {
    const p = track.pointAt(s);
    super(p.x, p.y, TRACK_SNAKE_SPEC, 3);
    this.lane = 0;                             // décalage latéral actuel (lissé)
    this.snapToTrack(track, s);
  }

  // Place le serpent sur la ligne centrale, corps aligné derrière la tête.
  // Sans s : au point de la piste le plus proche (utile après un redimensionnement).
  snapToTrack(track, s = null) {
    if (s === null) s = track.closest(this.head.pos.x, this.head.pos.y).s;
    const p = track.pointAt(s);
    this.head.pos.set(p.x, p.y);
    this.head.angle = Math.atan2(p.ty, p.tx);
    this.head.vel.set(p.tx, p.ty).setMag(this.head.maxSpeed * 0.5);
    this.head.prevVel.set(this.head.vel);
    this.head.acc.set(0, 0);
    this.lane = 0;
    for (let i = 0; i < this.segments.length; i++) {
      const q = track.pointAt(s - this.spacing * (i + 1));
      this.segments[i].set(q.x, q.y);
    }
  }

  // Points à éviter pour les voitures : la tête + tous les points du corps
  bodyPoints() {
    return [this.head.pos, ...this.segments];
  }

  // Repousse un point hors des voitures (garantie "sans toucher")
  keepOut(p, radius, cars) {
    for (const c of cars) {
      const dx = p.x - c.pos.x;
      const dy = p.y - c.pos.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const minD = radius + c.r * 1.2 + 1;
      if (d < minD) p.set(c.pos.x + (dx / d) * minD, c.pos.y + (dy / d) * minD);
    }
  }

  // Repousse un point hors des pierres
  keepOutStones(p, radius, stones) {
    for (const st of stones) {
      const dx = p.x - st.pos.x;
      const dy = p.y - st.pos.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const minD = st.r + radius + 1;
      if (d < minD) p.set(st.pos.x + (dx / d) * minD, st.pos.y + (dy / d) * minD);
    }
  }

  // Voitures, pierres et bordures sont toutes des contraintes strictes : on les applique
  // plusieurs fois de suite pour qu'aucune ne défasse le travail d'une autre.
  settle(p, radius, track, limit, cars, stones) {
    for (let k = 0; k < 3; k++) {
      this.keepOut(p, radius, cars);
      this.keepOutStones(p, radius, stones);
      this.keepIn(track, p, limit);
    }
  }

  // Garde un point dans la piste
  keepIn(track, p, limit) {
    const info = track.closest(p.x, p.y);
    if (info.dist > limit) {
      const k = limit / info.dist;
      p.set(info.x + (p.x - info.x) * k, info.y + (p.y - info.y) * k);
    }
  }

  // Une image : suivre la piste, contourner les voitures, entraîner le corps
  // stones : obstacles ronds { pos, r } (pierres + serpents de la souris)
  follow(track, cars, stones = []) {
    const head = this.head;
    const info = track.closest(head.pos.x, head.pos.y);
    const speed = head.vel.mag();
    const half = this.head.r;                  // la tête est plus large que le corps
    const limit = track.halfWidth - half - 2;
    const look = 36 + speed * 10;

    // virage à venir => on ralentit
    const further = track.pointAt(info.s + look * 2.5);
    const dot = Math.max(-1, Math.min(1, info.tx * further.tx + info.ty * further.ty));
    let wanted = head.maxSpeed * (1 - 0.55 * Math.min(1, Math.acos(dot) / 0.9));


    // seek vers le point d'anticipation décalé sur la voie choisie
    const pt = track.pointAt(info.s + look);
    const target = createVector(pt.x + pt.nx * this.lane, pt.y + pt.ny * this.lane);
    const desired = p5.Vector.sub(target, head.pos).setMag(wanted);
    head.applyForce(p5.Vector.sub(desired, head.vel).limit(head.maxForce));

    // évitement des pierres ET des voitures : algorithme ahead / ahead2 (voir avoid.js), force x3
    const obstacles = stones.concat(cars.map(c => ({ pos: c.pos, r: c.r * 1.2 })));
    head.applyForce(aheadAvoid(head, obstacles, { zone: half + 4, goal: desired }).mult(3));

    // séparation : repousse la tête des voitures trop proches
    const push = createVector(0, 0);
    for (const c of cars) {
      const away = p5.Vector.sub(head.pos, c.pos);
      const d = away.mag();
      const r = half + c.r * 1.2 + 14;
      if (d > 0 && d < r) push.add(away.setMag((r - d) / r));
    }
    head.applyForce(push.limit(head.maxForce * 2));

    head.update();
    this.settle(head.pos, half, track, limit, cars, stones);
    this.pull(track, cars, stones);
  }

  // Chaque point reste collé au précédent, mais ne traverse ni voiture ni bordure.
  pull(track, cars, stones = []) {
    let prev = this.head.pos;
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const w = this.widthAt(i);
      const d = p5.Vector.sub(seg, prev);
      if (d.magSq() < 1e-6) d.set(-1, 0);
      d.setMag(this.spacing);
      seg.set(prev.x + d.x, prev.y + d.y);
      this.settle(seg, w * 0.5, track, track.halfWidth - w * 0.5 - 1, cars, stones);
      prev = seg;
    }
  }
}

if (typeof module !== 'undefined') module.exports = TrackSnake;