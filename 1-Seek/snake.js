// Trois serpents qui suivent la souris.
// SnakeHead (le leader) étend Vehicle : forces (arrive + ondulation) -> update().
// Snake étend Vehicle aussi : sa position EST celle de la tête, et son corps est
// une chaîne de points collés (distance fixe) qui suivent chacun le précédent.

// Largeur (diamètre du cou) et longueur (nombre de points) différentes pour chacun.
const SNAKE_SPECS = [
  { name: 'Fil',    count: 40, width: 12, maxSpeed: 6.5, maxForce: 0.32, hue: 135, orbit: 50,  orbitSpeed: 1.1 },
  { name: 'Moyen',  count: 26, width: 22, maxSpeed: 5,   maxForce: 0.22, hue: 305, orbit: 110, orbitSpeed: -0.7 },
  { name: 'Gros',   count: 14, width: 34, maxSpeed: 3.6, maxForce: 0.15, hue: 38,  orbit: 170, orbitSpeed: 0.5 }
];

// Vitesse : le serpent est TRÈS RAPIDE au début (x2.2 de la vitesse de base) puis ralentit
// à mesure qu'il grossit : facteur = BOOST / taille^EXPOSANT (2.2 à taille 1, ~1.5 à x1.5, ~0.6 à x3).
const START_SPEED_BOOST = 2.2;
const SPEED_EXPONENT = 1.2;

// Croissance : chaque fruit mangé agrandit le serpent (et le ralentit).
const GROWTH_PER_FRUIT = 0.2;    // +20 % de taille par fruit
const MAX_GROWTH_SCALE = 3;      // taille maximale (x3)
const BITE_FRACTION = 0.2;       // une morsure de dragon retire 20 % des points de base (min. 2)

class SnakeHead extends Vehicle {
  constructor(x, y, { radius, maxSpeed, maxForce, hue }) {
    super(x, y);
    this.r = radius;
    this.maxSpeed = maxSpeed;
    this.maxForce = maxForce;
    this.hue = hue;
    this.angle = Math.random() * Math.PI * 2;            // cap affiché (lissé)
    this.vel = p5.Vector.fromAngle(this.angle).setMag(maxSpeed * 0.5);
    this.prevVel = this.vel.copy();
    this.slowRadius = radius * 7;                        // zone de ralentissement (arrive)
    this.phase = Math.random() * Math.PI * 2;            // déphasage propre à chaque serpent
    this.look = createVector(1, 0);                      // direction du regard (repère de la tête)
    this.excite = 0;                                     // 0..1 : souris proche => yeux écarquillés
    this.blink = 0;
    this.nextBlink = 90;
    this.pupil = [createVector(0, 0), createVector(0, 0)];
    this.pupilVel = [createVector(0, 0), createVector(0, 0)];
  }

  // Arrive : comme seek, mais on ralentit près de la cible (pas de tremblement).
  arrive(target) {
    const desired = p5.Vector.sub(target, this.pos);
    const d = desired.mag();
    let speed = this.maxSpeed;
    if (d < this.slowRadius) speed = (d / this.slowRadius) * this.maxSpeed;
    desired.setMag(speed);
    return p5.Vector.sub(desired, this.vel).limit(this.maxForce);
  }

  // Forces + regard. lookAt = position réelle de la souris (ou null).
  steer(target, lookAt, t, bushes = []) {
    this.applyForce(this.arrive(target));
    // évitement des buissons : algorithme ahead / ahead2 (voir avoid.js), force x3
    if (bushes.length) {
      this.applyForce(aheadAvoid(this, bushes,
        { zone: this.r * 1.3, goal: p5.Vector.sub(target, this.pos) }).mult(3));
    }

    // ondulation : petite force perpendiculaire sinusoïdale => il serpente
    const speed = this.vel.mag();
    if (speed > 0.01) {
      const perp = createVector(-this.vel.y, this.vel.x).setMag(1);
      const k = Math.sin(t * 7 + this.phase) * this.maxForce * 0.9 * Math.min(1, speed / this.maxSpeed);
      this.applyForce(perp.mult(k));
    }

    const toLook = lookAt ? p5.Vector.sub(lookAt, this.pos) : this.vel.copy();
    const dist = lookAt ? toLook.mag() : Infinity;
    if (toLook.magSq() > 0.0001) this.look = toLook.rotate(-this.angle).setMag(1);
    this.excite += ((dist < 180 ? 1 : 0) - this.excite) * 0.1;
  }

  update() {
    this.prevVel.set(this.vel);
    super.update();
    if (this.vel.magSq() > 0.04) {                    // cap lissé, évite les sursauts
      const diff = Math.atan2(Math.sin(this.vel.heading() - this.angle),
                            Math.cos(this.vel.heading() - this.angle));
      this.angle += diff * 0.25;
    }
    this.updateEyes();
  }

  eyeRadius() {
    return this.r * 0.42 * (1 + 0.45 * this.excite);
  }

  // Yeux "googly" : les pupilles sont des ressorts qui ballottent quand la tête accélère.
  updateEyes() {
    const accel = p5.Vector.sub(this.vel, this.prevVel).rotate(-this.angle);
    const er = this.eyeRadius();
    const room = er - er * 0.5;
    for (let i = 0; i < 2; i++) {
      const p = this.pupil[i];
      const v = this.pupilVel[i];
      const goal = this.look.copy().mult(room);
      v.add(p5.Vector.sub(goal, p).mult(i === 0 ? 0.09 : 0.14));   // chaque oeil a son caractère
      v.add(-accel.x * 2, -accel.y * 2);                          // inertie rigolote
      v.add((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15);
      v.mult(0.82);
      p.add(v);
      if (p.mag() > room) { p.setMag(room); v.mult(-0.5); }        // rebond contre le bord de l'oeil
    }
    this.nextBlink -= 1;
    if (this.nextBlink <= 0) {
      this.blink = 1;
      this.nextBlink = 90 + Math.floor(Math.random() * 150);
    }
    this.blink = Math.max(0, this.blink - 0.12);
  }

  // Langue fourchue : elle sort par à-coups, remue, et sort plus quand la souris est proche.
  drawTongue() {
    const f = frameCount * 0.1 + this.phase;
    const flick = Math.pow(Math.max(0, Math.sin(f)), 2);
    const len = this.r * (0.6 + 1.6 * flick + 0.8 * this.excite);
    const sway = Math.sin(frameCount * 0.9 + this.phase) * this.r * 0.25 * (0.4 + flick);
    const x0 = this.r * 1.0;
    const xe = x0 + len * 0.7;
    const ye = sway * 0.6;
    const fork = this.r * 0.28;
    noFill();
    stroke(350, 85, 95);
    strokeWeight(Math.max(2, this.r * 0.16));
    strokeCap(ROUND);
    line(x0, 0, xe, ye);
    line(xe, ye, x0 + len, sway + fork);
    line(xe, ye, x0 + len, sway - fork);
  }

  show() {
    push();
    colorMode(HSB, 360, 100, 100, 1);
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);

    this.drawTongue();

    // tête
    stroke(this.hue, 70, 25);
    strokeWeight(2);
    fill(this.hue, 70, 88);
    ellipse(0, 0, this.r * 2.3, this.r * 1.9);

    // narines
    noStroke();
    fill(this.hue, 70, 25);
    circle(this.r * 0.85, -this.r * 0.25, this.r * 0.14);
    circle(this.r * 0.85, this.r * 0.25, this.r * 0.14);

    // yeux + pupilles
    const er = this.eyeRadius();
    for (let i = 0; i < 2; i++) {
      const ex = this.r * 0.3;
      const ey = (i === 0 ? -1 : 1) * this.r * 0.5;
      const squash = 1 - 0.9 * this.blink;
      stroke(this.hue, 70, 25);
      strokeWeight(1.5);
      fill(0, 0, 100);
      ellipse(ex, ey, er * 2, er * 2 * squash);
      if (squash > 0.25) {
        noStroke();
        fill(0, 0, 5);
        circle(ex + this.pupil[i].x, ey + this.pupil[i].y * squash, er);
      }
    }
    pop();
  }
}

class Snake extends Vehicle {
  constructor(x, y, spec, index = 0) {
    super(x, y);
    this.spec = spec;
    this.index = index;
    this.width = spec.width;
    this.hue = spec.hue;
    this.spacingRatio = 0.55;                           // écart = largeur * ratio
    this.spacing = this.width * this.spacingRatio;     // distance fixe entre deux points
    this.lengthScale = 1;                              // multiplicateur du nombre de points
    this.sizeScale = 1;                                // taille actuelle (animée)
    this.sizeGoal = 1;                                 // taille visée (augmente à chaque fruit)
    this.lost = 0;                                     // points perdus à cause des morsures de dragon
    this.digesting = [];                               // minuteurs avant d'éjecter une crotte
    this.head = new SnakeHead(x, y, {
      radius: spec.width * 0.65,
      maxSpeed: spec.maxSpeed,
      maxForce: spec.maxForce,
      hue: spec.hue
    });
    // le serpent EST sa tête (mêmes vecteurs)
    this.pos = this.head.pos;
    this.vel = this.head.vel;
    this.acc = this.head.acc;
    this.applySpeed();                                 // départ rapide

    const back = p5.Vector.fromAngle(this.head.angle + Math.PI);
    this.segments = [];
    for (let i = 0; i < spec.count; i++) {
      this.segments.push(back.copy().mult(this.spacing * (i + 1)).add(this.head.pos));
    }
  }

  // Curseur "écart" : distance entre deux points
  setSpacingRatio(r) {
    this.spacingRatio = r;
    this.spacing = this.width * r;
  }

  // Curseur "longueur" : multiplie le nombre de points de base (spec.count)
  setLengthScale(k) {
    this.lengthScale = k;
    this.applyLength();
  }

  // Nombre de points = base * curseur * bonus de croissance (un gros serpent est aussi plus long)
  applyLength() {
    const growth = 1 + (this.sizeScale - 1) * 0.5;
    const base = Math.max(3, Math.round(this.spec.count * this.lengthScale * growth));
    const n = Math.max(0, base - this.lost);
    while (this.segments.length < n) {
      this.segments.push((this.segments[this.segments.length - 1] || this.head.pos).copy());
    }
    while (this.segments.length > n) this.segments.pop();
  }

  // Morsure de dragon : la queue raccourcit. Renvoie true si le serpent est mort
  // (il ne reste que la tête).
  bite() {
    this.lost += Math.max(2, Math.round(this.spec.count * BITE_FRACTION));
    this.applyLength();
    return this.segments.length === 0;
  }

  // Appelé quand un fruit est mangé : la crotte sortira après la digestion
  eat() {
    this.digesting.push(0.9);                           // secondes
    this.sizeGoal = Math.min(MAX_GROWTH_SCALE, this.sizeGoal + GROWTH_PER_FRUIT);
  }

  // Vitesse et agilité selon la taille : rapide quand il est petit, lent quand il a beaucoup mangé
  applySpeed() {
    const f = START_SPEED_BOOST / Math.pow(this.sizeScale, SPEED_EXPONENT);
    this.head.maxSpeed = this.spec.maxSpeed * f;
    this.head.maxForce = this.spec.maxForce * f;
  }

  // Grossit en douceur vers sizeGoal : plus gros => tête et corps plus larges,
  // vitesse max et force max divisées par la taille => plus lent et moins agile.
  updateGrowth() {
    if (Math.abs(this.sizeGoal - this.sizeScale) < 0.001) return;
    this.sizeScale += (this.sizeGoal - this.sizeScale) * 0.06;
    const k = this.sizeScale;
    this.width = this.spec.width * k;
    this.spacing = this.width * this.spacingRatio;
    const h = this.head;
    h.r = this.spec.width * 0.65 * k;
    h.slowRadius = h.r * 7;
    this.applySpeed();
    this.applyLength();
  }

  // Renvoie les crottes à éjecter ce frame (depuis le DERNIER point)
  updateDigestion(dt) {
    const out = [];
    for (let i = this.digesting.length - 1; i >= 0; i--) {
      this.digesting[i] -= dt;
      if (this.digesting[i] <= 0) {
        this.digesting.splice(i, 1);
        const last = this.segments.length ? this.segments[this.segments.length - 1] : this.head.pos;
        const prev = this.segments.length > 1
          ? this.segments[this.segments.length - 2]
          : this.head.pos;
        const dir = p5.Vector.sub(last, prev);         // direction de la queue, vers l'arrière
        if (dir.magSq() < 1e-6) dir.set(-1, 0);
        dir.setMag(4);
        out.push(new Fireball(last.x, last.y, dir, { size: Math.max(6, this.width * 0.45) }));
      }
    }
    return out;
  }

  // Diamètre du corps au point i : épais au cou, fin à la queue.
  widthAt(i) {
    const t = this.segments.length > 1 ? i / (this.segments.length - 1) : 0;
    return this.width * (1 - 0.85 * Math.pow(t, 1.3));
  }

  // Cible : autour de la souris (chaque serpent sur sa propre orbite) ou, sans souris,
  // une balade en courbe de Lissajous.
  follow(mousePos, t, w, h, bushes = []) {
    this.updateGrowth();
    let target;
    let lookAt = null;
    if (mousePos) {
      const a = t * this.spec.orbitSpeed + (this.index * Math.PI * 2) / 3;
      target = createVector(
        mousePos.x + Math.cos(a) * this.spec.orbit,
        mousePos.y + Math.sin(a) * this.spec.orbit
      );
      lookAt = mousePos;
    } else {
      target = createVector(
        w / 2 + Math.cos(t * 0.35 + this.index * 2.1) * w * 0.38,
        h / 2 + Math.sin(t * 0.47 + this.index * 1.3) * h * 0.36
      );
    }
    this.head.steer(target, lookAt, t, bushes);
    this.head.update();
    this.pushOutOfBushes(this.head.pos, this.head.r * 1.15, bushes, this.head.vel);
    this.head.pos.set(constrain(this.head.pos.x, 0, w), constrain(this.head.pos.y, 0, h));
    this.pull(bushes);
  }

  // Interdit de passer sur un buisson : si le point (de rayon `radius`) entre dans un
  // buisson, il est replacé sur son bord ; la vitesse vers l'intérieur est annulée.
  pushOutOfBushes(p, radius, bushes, vel = null) {
    for (const b of bushes) {
      const dx = p.x - b.pos.x;
      const dy = p.y - b.pos.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const minD = b.r + radius;
      if (d >= minD) continue;
      const nx = dx / d, ny = dy / d;
      p.set(b.pos.x + nx * minD, b.pos.y + ny * minD);
      if (vel) {
        const vn = vel.x * nx + vel.y * ny;
        if (vn < 0) vel.sub(nx * vn, ny * vn);
      }
    }
  }

  // Cercles de collision (tête + corps) : les autres véhicules s'en servent comme obstacles
  // `pad` : le serpent bouge vite, les autres le voient plus gros pour avoir le temps de s'écarter
  circles() {
    const pad = Math.min(25, this.head.vel.mag() * 4);
    const out = [{ pos: this.head.pos, r: this.head.r * 1.15, pad }];
    for (let i = 0; i < this.segments.length; i++) {
      out.push({ pos: this.segments[i], r: this.widthAt(i) * 0.5 + 1, pad });
    }
    return out;
  }

  // Chaque point reste collé au précédent à distance exacte.
  pull(bushes = []) {
    let prev = this.head.pos;
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const d = p5.Vector.sub(seg, prev);
      if (d.magSq() < 1e-6) d.set(-1, 0);
      d.setMag(this.spacing);
      seg.set(prev.x + d.x, prev.y + d.y);
      this.pushOutOfBushes(seg, this.widthAt(i) * 0.5 + 1, bushes);   // le corps non plus
      prev = seg;
    }
  }

  show() {
    push();
    colorMode(HSB, 360, 100, 100, 1);
    for (let i = this.segments.length - 1; i >= 0; i--) {   // de la queue vers la tête
      const s = this.segments[i];
      const w = this.widthAt(i);
      const bright = Math.floor(i / 3) % 2 ? 78 : 95;       // bandes alternées
      stroke(this.hue, 80, 25);
      strokeWeight(2);
      fill((this.hue + Math.sin(i * 0.4) * 15 + 360) % 360, 75, bright);
      circle(s.x, s.y, w);
      noStroke();
      fill(this.hue, 25, 100, 0.45);                        // reflet
      circle(s.x - w * 0.1, s.y - w * 0.15, w * 0.3);
    }
    pop();
    this.head.show();
  }
}

if (typeof module !== 'undefined') module.exports = { Snake, SnakeHead, SNAKE_SPECS };