// Leurre lâché par un avion rattrapé : petit point jaune qui dérive en
// ralentissant (force de frottement via applyForce) puis s'éteint.
// Les véhicules le poursuivent s'il est plus proche qu'un avion.
class Decoy extends Vehicle {
  constructor(x, y, vel, { life = 6 } = {}) {
    super(x, y);
    this.r = 5;
    this.maxSpeed = 7;
    this.vel = vel.copy();
    this.life = life;
    this.age = 0;
  }

  advance(dt) {
    this.age += dt;
  }

  get done() {
    return this.age >= this.life;
  }

  update() {
    this.applyForce(this.vel.copy().mult(-0.04));   // frottement : le leurre ralentit
    super.update();
  }

  show() {
    const remaining = this.life - this.age;
    const fade = Math.min(1, Math.max(0, remaining / 1.5));      // s'éteint sur la fin
    const flicker = 0.75 + 0.25 * Math.sin(frameCount * 0.6 + this.pos.x);
    push();
    colorMode(HSB, 360, 100, 100, 1);
    noStroke();
    fill(52, 70, 100, 0.3 * fade);
    circle(this.pos.x, this.pos.y, this.r * 4.5 * flicker);
    fill(55, 95, 100, fade);
    circle(this.pos.x, this.pos.y, this.r * 2);
    pop();
  }
}

if (typeof module !== 'undefined') module.exports = { Decoy };