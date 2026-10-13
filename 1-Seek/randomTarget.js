const TARGET_BIRTH_SECONDS = 0.6;   // durée de l'animation d'apparition
const FLARE_CHARGES = 3;            // nombre de fois où l'avion peut lâcher des leurres
const DECOYS_PER_RELEASE = 6;       // leurres par lâcher
const FLARE_COOLDOWN = 2;           // secondes de protection après un lâcher

// Avion autonome : il étend Vehicle, tout passe par des forces
// (flee hérité de Vehicle + murs + wander), applyForce() puis update().
class RandomTarget extends Vehicle {
  constructor(x, y, rng = Math.random) {
    super(x, y);
    this.rng = rng;
    this.r = 16;              // disque de 32 px = seuil d'arrivée
    this.maxSpeed = 8;        // 2x plus rapide que les véhicules (4)
    this.maxForce = 0.8;      // forte accélération : démarrages et virages vifs
    this.fleeRadius = 320;    // perçoit les menaces de plus loin
    this.fleeCount = 3;       // elle ne fuit que les 3 menaces les plus proches
    this.hue = 0;             // 0-360, piloté par la souris
    this.hueOffset = 0;       // décalage propre à chaque cible
    this.haloScale = 1;       // 1 à 2, piloté par la souris
    this.age = 0;             // secondes de survie
    this.birth = 0;           // progression de l'animation d'apparition (s)
    this.warn = 0;            // 0..1 : approche de la division
    this.lifeFraction = 0;    // 0..1 : âge / durée de survie
    this.flares = FLARE_CHARGES;  // charges de leurres restantes
    this.flareCooldown = 0;       // protection après un lâcher (s)
    this.wanderAngle = rng() * Math.PI * 2;
    this.vel = p5.Vector.fromAngle(this.wanderAngle).setMag(this.maxSpeed);
  }

  // Temps écoulé (en secondes, indépendant de la cadence d'images).
  tick(dt) {
    this.age += dt;
    this.birth = Math.min(TARGET_BIRTH_SECONDS, this.birth + dt);
    this.flareCooldown = Math.max(0, this.flareCooldown - dt);
  }

  // Met à jour la progression vers la division ; lead = secondes d'avertissement.
  setLife(lifespan, lead = 3) {
    const clamp01 = v => Math.min(1, Math.max(0, v));
    this.lifeFraction = lifespan > 0 ? clamp01(this.age / lifespan) : 0;
    this.warn = clamp01((this.age - (lifespan - lead)) / lead);
  }

  // Échelle d'apparition : 0 -> 1 avec un petit dépassement (easeOutBack).
  birthScale() {
    const t = Math.min(1, Math.max(0, this.birth / TARGET_BIRTH_SECONDS));
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  displayHue() {
    return (((this.hue + this.hueOffset) % 360) + 360) % 360;
  }

  // Lâche des leurres vers l'arrière, en éventail. Consomme une charge.
  releaseDecoys(count = DECOYS_PER_RELEASE) {
    this.flares -= 1;
    this.flareCooldown = FLARE_COOLDOWN;
    const back = this.vel.magSq() > 0 ? this.vel.heading() + Math.PI : Math.PI;
    const decoys = [];
    for (let i = 0; i < count; i++) {
      const angle = back + (this.rng() - 0.5) * 2.4;
      const speed = 2 + this.rng() * 3;
      decoys.push(new Decoy(this.pos.x, this.pos.y, p5.Vector.fromAngle(angle).setMag(speed)));
    }
    return decoys;
  }

  // Division : deux enfants de part et d'autre, perpendiculaires à la vitesse.
  split() {
    const dir = this.vel.magSq() > 0 ? this.vel.copy().setMag(1) : createVector(1, 0);
    const perp = createVector(-dir.y, dir.x);
    return [1, -1].map(sign => {
      const kid = new RandomTarget(
        this.pos.x + perp.x * sign * this.r,
        this.pos.y + perp.y * sign * this.r,
        this.rng
      );
      kid.vel = perp.copy().mult(sign * this.maxSpeed);
      kid.hue = this.hue;
      kid.hueOffset = this.hueOffset + sign * 25;
      kid.haloScale = this.haloScale;
      return kid;
    });
  }

  // Wander : l'angle varie peu à chaque image => trajectoire continue.
  wander() {
    this.wanderAngle += (this.rng() - 0.5) * 0.6;
    const center = this.vel.copy().setMag(50);
    const offset = p5.Vector.fromAngle(this.wanderAngle).setMag(25);
    const desired = center.add(offset).setMag(this.maxSpeed);
    return p5.Vector.sub(desired, this.vel).limit(this.maxForce * 0.4);
  }

  // Fuite multi-menaces : seules les menaces proches comptent (véhicules + souris
  // éventuelle). Chaque menace est évitée avec le flee() hérité de Vehicle ;
  // les forces sont composées par une somme pondérée : plus une menace est
  // proche, plus son poids est grand. Seules les `fleeCount` plus proches
  // comptent, et la somme est limitée à 2 * maxForce.
  fleeThreats(vehicles, extra = []) {
    const near = [];
    const consider = v => {
      const d = p5.Vector.dist(this.pos, v.pos);
      if (d < this.fleeRadius) near.push({ pos: v.pos, d });
    };
    for (const v of vehicles) consider(v);
    for (const v of extra) consider(v);
    if (near.length === 0) return createVector(0, 0);
    near.sort((a, b) => a.d - b.d);

    const total = createVector(0, 0);
    for (const { pos, d } of near.slice(0, this.fleeCount)) {
      // menace exactement sur la cible : on la décale pour avoir une direction
      const from = d === 0 ? p5.Vector.add(this.pos, createVector(-1, 0)) : pos;
      const w = Math.pow(1 - d / this.fleeRadius, 1.5);
      total.add(this.flee(from).mult(w * 2));   // flee() = méthode de Vehicle
    }
    return total.limit(this.maxForce * 2);
  }

  avoidWalls(w, h, margin = 120) {
    const desired = createVector(0, 0);
    if (this.pos.x < margin) desired.x = this.maxSpeed;
    else if (this.pos.x > w - margin) desired.x = -this.maxSpeed;
    if (this.pos.y < margin) desired.y = this.maxSpeed;
    else if (this.pos.y > h - margin) desired.y = -this.maxSpeed;
    if (desired.x === 0 && desired.y === 0) return createVector(0, 0);
    return p5.Vector.sub(desired, this.vel).limit(this.maxForce * 2);
  }

  // Style piloté par la souris : nx, ny dans [0, 1].
  setStyle(nx, ny) {
    this.hue = Math.min(1, Math.max(0, nx)) * 360;
    this.haloScale = 1 + Math.min(1, Math.max(0, ny));
  }

  // Composition : fuite (flee) + murs + wander (réduit pendant la fuite, jamais coupé).
  steer(w, h, vehicles = [], mousePos = null) {
    const extra = mousePos ? [{ pos: mousePos }] : [];
    const fleeForce = this.fleeThreats(vehicles, extra);
    this.applyForce(fleeForce);
    this.applyForce(this.avoidWalls(w, h));
    const wanderWeight = fleeForce.magSq() > 0 ? 0.3 : 1;
    this.applyForce(this.wander().mult(wanderWeight));
  }

  // Dessin d'un avion vu de dessus, nez dans la direction de la vitesse.
  show() {
    const s = this.birthScale();
    const hue = this.displayHue();
    const pulse = 1 + this.warn * 0.25 * Math.sin(frameCount * 0.5);
    const k = (this.r / 16) * 1.3 * s;
    push();
    colorMode(HSB, 360, 100, 100, 1);
    noStroke();
    fill(hue, 60, 100, 0.25);
    circle(this.pos.x, this.pos.y, this.r * 2 * (1 + this.haloScale) * s * pulse);

    if (this.flareCooldown > 0) {                      // bouclier jaune après un lâcher
      noFill();
      stroke(52, 80, 100, 0.4 + 0.4 * Math.sin(frameCount * 0.4));
      strokeWeight(2);
      circle(this.pos.x, this.pos.y, this.r * 4.4);
    }
    if (this.lifeFraction > 0.01) {                    // arc de progression vers la division
      noFill();
      stroke(0, 0, 100, 0.9);
      strokeWeight(3);
      const d = this.r * 4 + 16;
      arc(this.pos.x, this.pos.y, d, d, -HALF_PI, -HALF_PI + TWO_PI * this.lifeFraction);
    }

    if (k > 0.01) {
      push();
      translate(this.pos.x, this.pos.y);
      rotate(this.vel.heading());
      scale(k * pulse);
      stroke(280, 70, 20);
      strokeWeight(1.5 / (k * pulse));
      fill(hue, 90, 100, 1);
      // ailes
      beginShape();
      vertex(5, -3); vertex(-8, -21); vertex(-13, -21); vertex(-8, -3);
      endShape(CLOSE);
      beginShape();
      vertex(5, 3); vertex(-8, 21); vertex(-13, 21); vertex(-8, 3);
      endShape(CLOSE);
      // empennage
      beginShape();
      vertex(-16, -2); vertex(-22, -9); vertex(-25, -9); vertex(-21, -1);
      endShape(CLOSE);
      beginShape();
      vertex(-16, 2); vertex(-22, 9); vertex(-25, 9); vertex(-21, 1);
      endShape(CLOSE);
      // fuselage
      beginShape();
      vertex(24, 0); vertex(16, -3.5); vertex(-20, -2.5);
      vertex(-25, 0); vertex(-20, 2.5); vertex(16, 3.5);
      endShape(CLOSE);
      // cockpit
      noStroke();
      fill(0, 0, 100, 0.85);
      ellipse(12, 0, 7, 3);
      pop();
    }
    pop();
  }
}

if (typeof module !== 'undefined') module.exports = { RandomTarget };