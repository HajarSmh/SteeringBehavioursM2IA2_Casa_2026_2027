// Boule de feu éjectée du dernier point du serpent quand il a digéré un fruit.
// Elle glisse en ralentissant, vacille, puis s'éteint. Si un dragon la mange,
// il rétrécit (voir Dragon.step / handleDragonEvent).
class Fireball {
  constructor(x, y, dir, { size = 10, life = 9 } = {}) {
    this.pos = createVector(x, y);
    this.vel = dir.copy();
    this.r = Math.max(8, size * 0.7);   // rayon (utilisé par le dragon pour la manger)
    this.life = life;
    this.age = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.done = false;
  }

  advance(dt) {
    this.age += dt;
    if (this.age >= this.life) this.done = true;
  }

  update() {
    this.pos.add(this.vel);
    this.vel.mult(0.94);                // frottement : elle ralentit
  }

  show() {
    const fade = Math.min(1, Math.max(0, (this.life - this.age) / 1.5));
    const appear = Math.min(1, this.age / 0.2);
    const flick = 1 + 0.12 * Math.sin(frameCount * 0.4 + this.phase);
    const r = this.r * appear * flick;
    const a = this.vel.heading();

    push();
    colorMode(HSB, 360, 100, 100, 1);
    translate(this.pos.x, this.pos.y);
    noStroke();

    // petite traînée de flamme derrière (opposée au mouvement)
    if (this.vel.magSq() > 0.05) {
      push();
      rotate(a);
      fill(20, 90, 100, 0.45 * fade);
      triangle(-r * 0.6, -r * 0.7, -r * 2.4, 0, -r * 0.6, r * 0.7);
      fill(40, 90, 100, 0.55 * fade);
      triangle(-r * 0.6, -r * 0.4, -r * 1.7, 0, -r * 0.6, r * 0.4);
      pop();
    }

    // halo, puis boule rouge -> orange -> jaune -> cœur blanc
    fill(15, 90, 100, 0.25 * fade);
    circle(0, 0, r * 3);
    fill(8, 90, 100, fade);
    circle(0, 0, r * 2);
    fill(28, 90, 100, fade);
    circle(0, 0, r * 1.4);
    fill(52, 70, 100, fade);
    circle(0, 0, r * 0.8);
    fill(60, 10, 100, fade);
    circle(0, 0, r * 0.35);
    pop();
  }
}

if (typeof module !== 'undefined') module.exports = Fireball;