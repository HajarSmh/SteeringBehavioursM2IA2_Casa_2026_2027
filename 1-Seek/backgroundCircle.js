// Cercle décoratif du fond. Il étend Vehicle : il dérive doucement grâce à
// une force de wander, puis réapparaît de l'autre côté avec edges().
class BackgroundCircle extends Vehicle {
  constructor(x, y, radius, hueOffset) {
    super(x, y);
    this.r = radius;
    this.hueOffset = hueOffset;   // décalage dans le cycle arc-en-ciel (0-360)
    this.maxSpeed = 0.8;
    this.maxForce = 0.02;
    this.wanderAngle = random(TWO_PI);
    this.phase = random(TWO_PI);  // phase de pulsation
    this.vel = p5.Vector.fromAngle(this.wanderAngle).setMag(this.maxSpeed);
  }

  drift() {
    this.wanderAngle += random(-0.2, 0.2);
    const desired = p5.Vector.fromAngle(this.wanderAngle).setMag(this.maxSpeed);
    this.applyForce(p5.Vector.sub(desired, this.vel).limit(this.maxForce));
  }

  show() {
    const hue = (this.hueOffset + frameCount * 0.4) % 360;
    const radius = this.r * (1 + 0.12 * Math.sin(frameCount * 0.02 + this.phase));
    push();
    colorMode(HSB, 360, 100, 100, 1);
    noStroke();
    fill(hue, 80, 100, 0.22);
    circle(this.pos.x, this.pos.y, radius * 2);
    fill(hue, 60, 100, 0.12);
    circle(this.pos.x, this.pos.y, radius * 1.2);
    pop();
  }
}