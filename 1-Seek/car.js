// Voiture : étend Vehicle (seek / applyForce / update).
// Elle vise un point devant elle sur la piste (path following), ralentit dans les
// virages, évite les autres voitures, et est repoussée si elle touche une bordure.
class Car extends Vehicle {
  constructor(track, s, hue = Math.random() * 360) {
    const p = track.pointAt(s);
    super(p.x, p.y);
    this.r = 9;
    this.maxSpeed = 2.4 + Math.random() * 1.2;
    this.maxForce = 0.14;
    this.hue = hue;
    this.limit = track.halfWidth - this.r * 0.8;           // distance max à la ligne centrale
    this.baseLane = (Math.random() * 2 - 1) * this.limit * 0.6;  // voie préférée de la voiture
    this.lane = this.baseLane;                                   // voie actuelle (lissée)
    this.vel.set(p.tx, p.ty).setMag(this.maxSpeed * 0.5);
  }

  // Une image : suivre la piste -> éviter les autres -> update -> rester dans la piste
  // hazards : points à éviter en plus des voitures (ex : le corps du serpent)
  // stones : obstacles ronds { pos, r } (pierres + serpents de la souris), évités avec aheadAvoid
  follow(track, cars, hazards = [], stones = []) {
    const info = track.closest(this.pos.x, this.pos.y);
    this.lane = Math.max(-this.limit, Math.min(this.limit, this.baseLane));
    const look = 30 + this.vel.mag() * 10;                    // distance d'anticipation
    const ahead = track.pointAt(info.s + look);
    const further = track.pointAt(info.s + look * 2.5);

    // virage à venir ? => on ralentit
    const dot = Math.max(-1, Math.min(1, info.tx * further.tx + info.ty * further.ty));
    const turn = Math.acos(dot);
    // obstacle devant (pierre, serpent) ? algorithme ahead / ahead2 (voir avoid.js)
    const avoidF = aheadAvoid(this, stones, { zone: this.r * 0.75 + 4 });
    const threatened = avoidF.magSq() > 0;
    // on ralentit dans les virages et face à un obstacle (pour avoir le temps de le contourner)
    const wanted = this.maxSpeed * (1 - 0.55 * Math.min(1, turn / 0.9)) * (threatened ? 0.5 : 1);

    // seek vers le point d'anticipation (décalé sur la voie de la voiture)
    const target = createVector(ahead.x + ahead.nx * this.lane, ahead.y + ahead.ny * this.lane);
    const desired = p5.Vector.sub(target, this.pos).setMag(wanted);
    this.applyForce(p5.Vector.sub(desired, this.vel).limit(this.maxForce));

    this.applyForce(this.separation(cars));
    this.applyForce(this.avoidPoints(hazards));
    this.applyForce(avoidF.mult(3));                            // force d'évitement x3
    this.update();
    // obstacles et bordures sont des contraintes strictes : on les applique plusieurs fois
    // pour qu'aucune ne défasse l'autre
    for (let k = 0; k < 3; k++) {
      this.keepOutStones(stones);
      this.contain(track);
    }
  }

  // Garantit qu'on ne roule jamais sur une pierre
  keepOutStones(stones) {
    for (const st of stones) {
      const dx = this.pos.x - st.pos.x;
      const dy = this.pos.y - st.pos.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const minD = st.r + this.r * 0.8;
      if (d >= minD) continue;
      const nx = dx / d, ny = dy / d;
      this.pos.set(st.pos.x + nx * minD, st.pos.y + ny * minD);
      const vn = this.vel.x * nx + this.vel.y * ny;
      if (vn < 0) this.vel.sub(nx * vn, ny * vn);
    }
  }

  // Évite les voitures trop proches
  separation(cars) {
    const sum = createVector(0, 0);
    const radius = this.r * 3;
    for (const c of cars) {
      if (c === this) continue;
      const away = p5.Vector.sub(this.pos, c.pos);
      const d = away.mag();
      if (d > 0 && d < radius) sum.add(away.setMag((radius - d) / radius));
    }
    return sum.limit(this.maxForce * 0.8);
  }

  // Évite une liste de points (corps du serpent)
  avoidPoints(points) {
    const sum = createVector(0, 0);
    const radius = this.r * 3.2;
    for (const p of points) {
      const away = p5.Vector.sub(this.pos, p);
      const d = away.mag();
      if (d > 0 && d < radius) sum.add(away.setMag((radius - d) / radius));
    }
    return sum.limit(this.maxForce * 1.5);
  }

  // Garantit que la voiture ne sort JAMAIS de la piste :
  // si elle dépasse la limite, on la replace sur le bord et on annule la vitesse vers l'extérieur.
  contain(track) {
    const info = track.closest(this.pos.x, this.pos.y);
    if (info.dist <= this.limit) return;
    const nx = (this.pos.x - info.x) / info.dist;
    const ny = (this.pos.y - info.y) / info.dist;
    this.pos.set(info.x + nx * this.limit, info.y + ny * this.limit);
    const vn = this.vel.x * nx + this.vel.y * ny;
    if (vn > 0) this.vel.sub(nx * vn, ny * vn);
  }

  // Replace la voiture sur la ligne centrale (après un redimensionnement de la fenêtre)
  snapToTrack(track) {
    const info = track.closest(this.pos.x, this.pos.y);
    this.limit = track.halfWidth - this.r * 0.8;
    this.pos.set(info.x, info.y);
    this.vel.set(info.tx, info.ty).setMag(this.maxSpeed * 0.5);
    this.acc.set(0, 0);
  }

  show() {
    push();
    colorMode(HSB, 360, 100, 100, 1);
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());
    rectMode(CENTER);
    stroke(0, 0, 10);
    strokeWeight(1.5);
    fill(this.hue, 80, 95);
    rect(0, 0, this.r * 2.4, this.r * 1.4, 4);             // carrosserie
    noStroke();
    fill(200, 30, 20);
    rect(this.r * 0.25, 0, this.r * 0.8, this.r * 1.0, 2);  // pare-brise / toit
    fill(55, 40, 100);
    circle(this.r * 1.05, -this.r * 0.42, this.r * 0.3);     // phares
    circle(this.r * 1.05, this.r * 0.42, this.r * 0.3);
    pop();
  }
}

if (typeof module !== 'undefined') module.exports = Car;