// Dragons : ils étendent Vehicle (seek / applyForce / update / edges).
//  - ils chassent l'oiseau ou le serpent le plus proche (seek vers sa position prédite) ;
//  - un oiseau attrapé est mangé (il réapparaîtra plus tard) ;
//  - un serpent mordu perd des points à la queue ; s'il ne reste que la tête, il meurt
//    (quand les 3 serpents sont morts : GAME OVER, voir sketch.js) ;
//  - sans proie (ou juste après un repas), ils se promènent (wander).
// Ils volent : pas d'obstacles, et ils réapparaissent de l'autre côté en sortant de l'écran.
const DRAGON_COUNT = 2;
const BIRD_RESPAWN_SECONDS = 6;       // délai avant qu'un oiseau mangé soit remplacé

// Croissance : chaque serpent mordu agrandit le dragon
const DRAGON_GROWTH_PER_BITE = 0.1;   // +10 % de taille par morsure
const DRAGON_MAX_SCALE = 2;           // taille maximale (x2)

// Rétrécissement : chaque boule de feu mangée réduit le dragon ; trop rétréci, il MEURT
const DRAGON_SHRINK_PER_FIREBALL = 0.15;   // -15 % de taille par boule de feu
const DRAGON_DEATH_SCALE = 0.45;           // sous x0.45 le dragon meurt (~4 boules de feu depuis la taille normale)

// Attirance : les boules de feu intriguent les dragons plus que toute autre proie
const FIREBALL_ATTRACTION = 3;             // une boule de feu "compte" comme si elle était 3x plus proche
const FIREBALL_PERCEPTION = 1.8;           // le dragon la repère de 1.8x plus loin (450 -> 810 px)

class Dragon extends Vehicle {
  constructor(x, y) {
    super(x, y);
    this.baseR = 20;
    this.r = this.baseR;
    this.sizeScale = 1;                       // taille actuelle (animée)
    this.sizeGoal = 1;                        // taille visée (augmente à chaque morsure)
    this.maxSpeed = random(4.4, 5);
    this.maxForce = 0.16;
    this.perception = 450;                    // distance à laquelle il repère une proie
    this.hue = random([355, 130, 270]);       // rouge, vert ou violet
    this.phase = random(Math.PI * 2);
    this.cooldown = 0;                        // digestion : pas de chasse pendant ce temps (s)
    this.dead = false;                        // true quand il a trop rétréci (retiré par sketch.js)
    this.prey = null;                         // proie courante { kind, ref, pos, vel, gap }
    this.shieldPing = 0;                      // délai entre deux impacts sur la couverture (s)
    this.shieldHit = null;                    // { x, y } si le dragon vient de cogner la couverture
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.vel = p5.Vector.fromAngle(this.wanderAngle).setMag(this.maxSpeed * 0.6);
  }

  // Nouvelle partie : retour à la taille de départ
  reset() {
    this.dead = false;
    this.cooldown = 0;
    this.sizeScale = this.sizeGoal = 1;
    this.r = this.baseR;
  }

  // Proie la plus proche (oiseau ou n'importe quel point d'un serpent). gap = distance
  // entre le centre du dragon et le bord de la proie.
  findPrey(birds, snakes, track = null, fireballs = []) {
    let best = null;
    let bestScore = Infinity;                 // gap / attirance : le plus petit gagne
    const consider = (kind, ref, pos, vel, gap, attraction = 1, perception = this.perception, shielded = true) => {
      if (gap >= perception || (shielded && this.inShield(track, pos))) return;
      const score = gap / attraction;
      if (score < bestScore) { bestScore = score; best = { kind, ref, pos, vel, gap }; }
    };
    // les boules de feu ressemblent à de la nourriture : le dragon les mange... et rétrécit.
    // Elles sont repérées de plus loin et passent avant les oiseaux et les serpents.
    for (const f of fireballs) {
      consider('fireball', f, f.pos, f.vel, p5.Vector.dist(this.pos, f.pos) - f.r * 0.5,
        FIREBALL_ATTRACTION, this.perception * FIREBALL_PERCEPTION, false);   // même sous le verre
    }
    for (const b of birds) {
      consider('bird', b, b.pos, b.vel, p5.Vector.dist(this.pos, b.pos) - b.r * 0.5);
    }
    for (const s of snakes) {
      for (const c of s.circles()) {
        consider('snake', s, c.pos, null, p5.Vector.dist(this.pos, c.pos) - c.r);
      }
    }
    return best;
  }

  // Sous la couverture de verre du circuit ? Alors la proie est protégée : le dragon l'ignore.
  inShield(track, pos) {
    return !!track && track.closest(pos.x, pos.y).dist < track.coverRadius;
  }

  // Force qui écarte le dragon de la couverture (douce, dans les 70 px avant le verre)
  avoidShield(track) {
    const info = track.closest(this.pos.x, this.pos.y);
    const gap = info.dist - (track.coverRadius + this.r * 0.7);
    if (gap > 70 || info.dist < 1e-6) return createVector(0, 0);
    const away = createVector(this.pos.x - info.x, this.pos.y - info.y);
    return away.setMag(this.maxForce * 2 * Math.min(1, 1 - gap / 70));
  }

  // Le verre est infranchissable : on replace le dragon sur le bord et on annule la
  // vitesse qui pousse contre lui. Un impact est signalé (shieldHit) pour l'effet visuel.
  keepOutOfShield(track) {
    const info = track.closest(this.pos.x, this.pos.y);
    const minD = track.coverRadius + this.r * 0.7;
    if (info.dist >= minD) return;
    const d = info.dist || 1e-6;
    const nx = (this.pos.x - info.x) / d;
    const ny = (this.pos.y - info.y) / d;
    this.pos.set(info.x + nx * minD, info.y + ny * minD);
    const vn = this.vel.x * nx + this.vel.y * ny;
    if (vn < 0) {
      this.vel.sub(nx * vn, ny * vn);
      if (this.shieldPing <= 0 && -vn > 0.5) {
        this.shieldPing = 0.4;
        this.shieldHit = { x: info.x + nx * track.coverRadius, y: info.y + ny * track.coverRadius };
      }
    }
  }

  wander() {
    this.wanderAngle += (Math.random() - 0.5) * 0.5;
    const center = this.vel.copy().setMag(60);
    const offset = p5.Vector.fromAngle(this.wanderAngle).setMag(30);
    const desired = center.add(offset).setMag(this.maxSpeed * 0.6);
    return p5.Vector.sub(desired, this.vel).limit(this.maxForce);
  }

  // Une image. Renvoie un évènement { kind: 'bird'|'snake', ref, x, y } si le dragon
  // vient de manger un oiseau / mordre un serpent, sinon null.
  step(birds, snakes, dt, track = null, fireballs = []) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.shieldPing = Math.max(0, this.shieldPing - dt);
    this.shieldHit = null;
    this.sizeScale += (this.sizeGoal - this.sizeScale) * 0.06;   // grossit en douceur
    this.r = this.baseR * this.sizeScale;
    this.prey = this.cooldown > 0 ? null : this.findPrey(birds, snakes, track, fireballs);
    let event = null;
    const p = this.prey;
    if (p) {
      if (p.gap <= this.r * 0.8) {
        event = { kind: p.kind, ref: p.ref, x: p.pos.x, y: p.pos.y };
        this.cooldown = p.kind === 'snake' ? 1.2 : 0.5;
        if (p.kind === 'snake') this.sizeGoal = Math.min(DRAGON_MAX_SCALE, this.sizeGoal + DRAGON_GROWTH_PER_BITE);
        if (p.kind === 'fireball') {
          this.sizeGoal -= DRAGON_SHRINK_PER_FIREBALL;
          if (this.sizeGoal < DRAGON_DEATH_SCALE) this.dead = true;   // trop rétréci : il meurt
        }
        this.prey = null;
      } else {
        const lead = p.vel ? p5.Vector.mult(p.vel, 8) : createVector(0, 0);   // vise devant l'oiseau
        this.applyForce(this.seek(p5.Vector.add(p.pos, lead)));
      }
    }
    if (!this.prey) this.applyForce(this.wander());
    this.update();
    this.edges();
    return event;
  }

  // Forme vue de dessus (nez vers +x). flap : -1..1.
  drawShape(flap, shadow) {
    const r = this.r;
    const w = r * (1.7 + 0.5 * flap);               // envergure : varie quand l'aile bat
    if (shadow) {
      noStroke();
      fill(0, 0, 0, 0.22);
    } else {
      stroke(this.hue, 60, 20);
      strokeWeight(1.5);
      fill(this.hue, 55, 70);
    }
    for (const sg of [-1, 1]) {                      // ailes de chauve-souris
      beginShape();
      vertex(r * 0.4, sg * r * 0.3);
      vertex(r * 0.2, sg * w);
      vertex(-r * 0.3, sg * w * 0.8);
      vertex(-r * 0.5, sg * w * 0.5);
      vertex(-r * 0.9, sg * w * 0.4);
      vertex(-r * 0.8, sg * r * 0.3);
      endShape(CLOSE);
    }
    triangle(-r * 0.7, -r * 0.35, -r * 2.8, 0, -r * 0.7, r * 0.35);          // queue
    triangle(-r * 2.7, 0, -r * 3.1, -r * 0.35, -r * 3.1, r * 0.35);          // pointe de queue
    ellipse(0, 0, r * 2.2, r * 0.95);                                       // corps
    ellipse(r * 1.25, 0, r * 0.95, r * 0.7);                                // tête
    if (shadow) return;
    fill(this.hue, 70, 90);
    triangle(r * 1.6, -r * 0.2, r * 1.6, r * 0.2, r * 1.95, 0);             // museau
    fill(this.hue, 40, 95);
    triangle(r * 1.0, -r * 0.3, r * 0.55, -r * 0.7, r * 0.75, -r * 0.2);    // cornes
    triangle(r * 1.0, r * 0.3, r * 0.55, r * 0.7, r * 0.75, r * 0.2);
    noStroke();
    fill(this.hue, 80, 40);
    for (let i = 0; i < 6; i++) circle(r * 0.7 - i * r * 0.32, 0, r * 0.22);   // crête dorsale
    fill(52, 90, 100);
    circle(r * 1.35, -r * 0.2, r * 0.2);                                    // yeux
    circle(r * 1.35, r * 0.2, r * 0.2);
    fill(0, 0, 5);
    circle(r * 1.4, -r * 0.2, r * 0.08);
    circle(r * 1.4, r * 0.2, r * 0.08);
  }

  // Souffle de feu quand une proie est proche
  drawFire() {
    const r = this.r;
    const f = 0.8 + 0.2 * Math.sin(frameCount * 0.9 + this.phase);
    noStroke();
    fill(20, 90, 100, 0.65);
    triangle(r * 1.9, 0, r * (2.9 * f + 0.4), -r * 0.55, r * (2.9 * f + 0.4), r * 0.55);
    fill(50, 90, 100, 0.8);
    triangle(r * 1.9, 0, r * (2.3 * f + 0.4), -r * 0.28, r * (2.3 * f + 0.4), r * 0.28);
  }

  show() {
    const flap = Math.sin(frameCount * 0.2 + this.phase);
    const a = this.vel.heading();
    push();
    colorMode(HSB, 360, 100, 100, 1);
    push();                                          // ombre décalée : il vole haut
    translate(this.pos.x + 14, this.pos.y + 22);
    rotate(a);
    this.drawShape(flap, true);
    pop();
    translate(this.pos.x, this.pos.y);
    rotate(a);
    if (this.prey && this.prey.gap < 160) this.drawFire();
    this.drawShape(flap, false);
    pop();
  }
}

if (typeof module !== 'undefined') module.exports = { Dragon, DRAGON_COUNT };