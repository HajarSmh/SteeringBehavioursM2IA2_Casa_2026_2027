// Crotte éjectée du dernier point du serpent : elle glisse en ralentissant
// (frottement via applyForce), gigote, puis s'efface.
class Poop extends Vehicle {
  constructor(x, y, vel, { size = 10, life = 9 } = {}) {
    super(x, y);
    this.r = size;
    this.maxSpeed = 6;
    this.vel = vel.copy();
    this.life = life;
    this.age = 0;
    this.phase = Math.random() * Math.PI * 2;
  }

  advance(dt) {
    this.age += dt;
  }

  get done() {
    return this.age >= this.life;
  }

  update() {
    this.applyForce(this.vel.copy().mult(-0.06));   // frottement : elle ralentit
    super.update();
  }

  show() {
    const fade = Math.min(1, Math.max(0, (this.life - this.age) / 1.5));
    const pop = Math.min(1, this.age / 0.2);
    const wob = Math.sin(frameCount * 0.15 + this.phase) * 0.04;
    const r = this.r;

    push();
    colorMode(HSB, 360, 100, 100, 1);
    translate(this.pos.x, this.pos.y);
    scale(pop * (1 + wob));

    // trois étages marron
    stroke(22, 70, 25, fade);
    strokeWeight(2);
    fill(25, 75, 45, fade);
    ellipse(0, 0, r * 2.4, r * 1.2);
    ellipse(0, -r * 0.65, r * 1.7, r * 0.95);
    ellipse(0, -r * 1.2, r * 1.0, r * 0.8);

    // reflet
    noStroke();
    fill(30, 40, 80, 0.5 * fade);
    ellipse(-r * 0.35, -r * 0.75, r * 0.45, r * 0.2);

    // petits yeux
    fill(0, 0, 100, fade);
    circle(-r * 0.3, -r * 0.65, r * 0.4);
    circle(r * 0.3, -r * 0.65, r * 0.4);
    fill(0, 0, 5, fade);
    circle(-r * 0.3, -r * 0.62, r * 0.18);
    circle(r * 0.3, -r * 0.62, r * 0.18);

    // odeur
    noFill();
    stroke(100, 60, 70, 0.7 * fade);
    strokeWeight(2);
    for (let k = -1; k <= 1; k++) {
      const x = k * r * 0.7;
      beginShape();
      for (let j = 0; j <= 4; j++) {
        vertex(x + Math.sin(frameCount * 0.2 + j + k) * 3, -r * 1.7 - j * 4);
      }
      endShape();
    }
    pop();
  }
}

if (typeof module !== 'undefined') module.exports = { Poop };