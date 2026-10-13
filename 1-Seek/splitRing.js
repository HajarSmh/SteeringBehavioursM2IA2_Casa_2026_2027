// Anneau d'animation (division ou capture). Il étend Vehicle comme toute
// entité visible, mais ne bouge pas : il s'étend et s'efface.
class SplitRing extends Vehicle {
  constructor(x, y, hue, { duration = 0.7, maxRadius = 90 } = {}) {
    super(x, y);
    this.hue = hue;               // null = anneau blanc
    this.duration = duration;
    this.maxRadius = maxRadius;
    this.elapsed = 0;
  }

  advance(dt) {
    this.elapsed += dt;
  }

  get done() {
    return this.elapsed >= this.duration;
  }

  progress() {
    return Math.min(1, Math.max(0, this.elapsed / this.duration));
  }

  show() {
    const p = this.progress();
    const eased = 1 - Math.pow(1 - p, 3);
    push();
    colorMode(HSB, 360, 100, 100, 1);
    noFill();
    stroke(this.hue === null ? 0 : this.hue, this.hue === null ? 0 : 60, 100, 1 - p);
    strokeWeight(1 + 4 * (1 - p));
    circle(this.pos.x, this.pos.y, 2 * this.maxRadius * eased);
    pop();
  }
}

if (typeof module !== 'undefined') module.exports = { SplitRing };