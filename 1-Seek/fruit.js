// Fruits : ils étendent Vehicle mais restent immobiles. Dès qu'un serpent passe
// très près, le fruit fonce vers lui (seek hérité de Vehicle) puis disparaît :
// le serpent l'a mangé.
const FRUIT_COUNT = 8;
const FRUIT_KINDS = ['apple', 'orange', 'lemon', 'grape'];
const FRUIT_HUES = { apple: 355, orange: 28, lemon: 55, grape: 285 };

class Fruit extends Vehicle {
  constructor(x, y, kind = FRUIT_KINDS[Math.floor(Math.random() * FRUIT_KINDS.length)]) {
    super(x, y);
    this.kind = kind;
    this.hue = FRUIT_HUES[kind];
    this.r = 14;
    this.maxSpeed = 3.2;
    this.maxForce = 0.3;
    this.trigger = 110;               // distance "très proche" qui le réveille (px)
    this.age = 0;                     // pour l'animation d'apparition
    this.alarm = 0;                   // 0..1 : un serpent est proche
    this.look = createVector(0, 0);   // direction du regard (vers le serpent)
  }

  // Renvoie le serpent qui vient de le manger, sinon null.
  chase(snakes) {
    this.age += Math.min(deltaTime, 100) / 1000;
    let near = null;
    let best = this.trigger;
    for (const s of snakes) {
      const d = p5.Vector.dist(this.pos, s.head.pos);
      if (d < best) { best = d; near = s; }
    }
    this.alarm += ((near ? 1 : 0) - this.alarm) * 0.15;

    if (!near) {                      // aucun serpent proche : il ne bouge pas
      this.vel.set(0, 0);
      this.acc.set(0, 0);
      return null;
    }
    this.look = p5.Vector.sub(near.head.pos, this.pos).setMag(1);
    const reach = this.r + near.head.r * 0.8;
    if (best <= reach) return near;

    this.applyForce(this.seek(near.head.pos));
    this.update();
    return p5.Vector.dist(this.pos, near.head.pos) <= reach ? near : null;
  }

  drawEyes() {
    const r = this.r;
    for (const sign of [-1, 1]) {
      stroke(0, 0, 20);
      strokeWeight(1);
      fill(0, 0, 100);
      circle(sign * r * 0.38, -r * 0.1, r * 0.55);
      noStroke();
      fill(0, 0, 5);
      circle(sign * r * 0.38 + this.look.x * r * 0.1, -r * 0.1 + this.look.y * r * 0.1, r * 0.25);
    }
  }

  drawLeaf(x, y) {
    fill(110, 70, 75);
    ellipse(x, y, this.r * 0.7, this.r * 0.35);
  }

  show() {
    // apparition : easeOutBack
    const t = Math.min(1, this.age / 0.4);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const s = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    const shake = Math.sin(frameCount * 1.2) * 2 * this.alarm;   // il tremble quand un serpent approche
    const r = this.r;

    push();
    colorMode(HSB, 360, 100, 100, 1);
    translate(this.pos.x + shake, this.pos.y);
    scale(s * (1 + 0.12 * this.alarm));
    stroke(this.hue, 80, 30);
    strokeWeight(2);

    if (this.kind === 'apple') {
      fill(this.hue, 85, 90);
      circle(0, 0, r * 2);
      stroke(25, 70, 35);
      line(0, -r, 2, -r * 1.4);
      this.drawLeaf(r * 0.5, -r * 1.2);
      noStroke();
      fill(0, 0, 100, 0.5);
      circle(-r * 0.35, -r * 0.45, r * 0.5);
    } else if (this.kind === 'orange') {
      fill(this.hue, 90, 100);
      circle(0, 0, r * 2);
      this.drawLeaf(r * 0.4, -r * 1.0);
      noStroke();
      fill(this.hue, 90, 60);
      circle(0, -r * 0.85, r * 0.25);
      fill(0, 0, 100, 0.45);
      circle(-r * 0.4, -r * 0.4, r * 0.5);
    } else if (this.kind === 'lemon') {
      fill(this.hue, 85, 100);
      ellipse(0, 0, r * 2.5, r * 1.7);
      circle(-r * 1.2, 0, r * 0.3);
      circle(r * 1.2, 0, r * 0.3);
      this.drawLeaf(r * 0.3, -r * 1.0);
      noStroke();
      fill(0, 0, 100, 0.5);
      ellipse(-r * 0.4, -r * 0.35, r * 0.7, r * 0.3);
    } else {                                   // raisin
      fill(this.hue, 65, 70);
      const grapes = [[-0.55, -0.5], [0.55, -0.5], [-0.9, 0.2], [0, 0.2], [0.9, 0.2], [-0.45, 0.9], [0.45, 0.9]];
      for (const [gx, gy] of grapes) circle(gx * r, gy * r, r * 0.95);
      stroke(25, 70, 35);
      line(0, -r * 0.9, 0, -r * 1.4);
      this.drawLeaf(r * 0.45, -r * 1.3);
    }

    if (this.alarm > 0.3) this.drawEyes();     // yeux écarquillés vers le serpent
    pop();
  }
}

if (typeof module !== 'undefined') module.exports = { Fruit, FRUIT_COUNT };