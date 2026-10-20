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
    this.laneSign = 1;                         // côté choisi au prochain changement de voie
    this.stuck = 0;                            // images consécutives "quasi immobile"
    this.avgMove = this.head.vel.mag();        // déplacement moyen par image (lissé)
    this.prevPos = null;
    this.ghost = 0;                            // images restantes en mode fantôme
    this.snapToTrack(track, s);
  }

  // Le serpent du circuit garde sa vitesse de base : pas de départ rapide ni de ralentissement
  // lié à la taille (ça, c'est pour les serpents de la souris). Surcharge Snake.applySpeed().
  applySpeed() {}

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
    this.stuck = 0;
    this.ghost = 0;
    this.prevPos = null;
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

  // Détection de blocage : si la tête avance à peine pendant ~0,7 s, on change de voie ;
  // si ça ne suffit pas (~1,7 s), mode FANTÔME : pendant 1,5 s il traverse voitures et pierres
  // (transparent) en suivant la piste, puis redevient normal. Il ne reste donc jamais coincé.
  updateStuck(limit) {
    const p = this.head.pos;
    if (this.prevPos) {
      this.avgMove += (p5.Vector.dist(p, this.prevPos) - this.avgMove) * 0.05;
      this.prevPos.set(p);
    } else {
      this.prevPos = p.copy();
      this.avgMove = this.head.vel.mag();
    }
    this.lane *= 0.995;                        // la voie décalée revient doucement au centre
    if (this.ghost > 0) { this.stuck = 0; return; }
    if (this.avgMove < 0.7) this.stuck++;
    else this.stuck = Math.max(0, this.stuck - 2);
    if (this.stuck === 40) {                   // 1er essai : on tente l'autre côté
      this.laneSign = -this.laneSign;
      this.lane = this.laneSign * Math.max(0, limit) * 0.6;
    }
    if (this.stuck >= 100) {                   // 2e essai : fantôme
      this.ghost = 90;
      this.stuck = 0;
      this.lane = 0;
      this.avgMove = this.head.maxSpeed;
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

    this.updateStuck(limit);
    const ghost = this.ghost > 0;
    if (ghost) this.ghost--;
    const hardCars = ghost ? [] : cars;        // en mode fantôme, plus aucun obstacle
    const hardStones = ghost ? [] : stones;

    // virage à venir => on ralentit
    const further = track.pointAt(info.s + look * 2.5);
    const dot = Math.max(-1, Math.min(1, info.tx * further.tx + info.ty * further.ty));
    let wanted = head.maxSpeed * (1 - 0.55 * Math.min(1, Math.acos(dot) / 0.9));

    // seek vers le point d'anticipation décalé sur la voie choisie
    const pt = track.pointAt(info.s + look);
    const target = createVector(pt.x + pt.nx * this.lane, pt.y + pt.ny * this.lane);
    const desired = p5.Vector.sub(target, head.pos).setMag(wanted);
    head.applyForce(p5.Vector.sub(desired, head.vel).limit(head.maxForce));

    if (!ghost) {
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
    }

    head.update();
    const moved = head.pos.copy();             // position avant correction
    this.settle(head.pos, half, track, limit, hardCars, hardStones);
    // La correction est un déplacement imposé : on annule la vitesse qui pousse contre elle
    // (sinon elle s'accumule, la tête reste plaquée contre l'obstacle et "s'arrête").
    const fix = p5.Vector.sub(head.pos, moved);
    if (fix.magSq() > 1e-6) {
      const n = fix.normalize();
      const vn = head.vel.dot(n);
      if (vn < 0) head.vel.sub(p5.Vector.mult(n, vn));
    }
    this.pull(track, hardCars, hardStones);
  }

  // Semi-transparent en mode fantôme
  show() {
    if (this.ghost > 0) {
      drawingContext.save();
      drawingContext.globalAlpha = 0.45;
      super.show();
      drawingContext.restore();
    } else {
      super.show();
    }
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