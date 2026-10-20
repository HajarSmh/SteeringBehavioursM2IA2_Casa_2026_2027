// Distance d'un point (x,y) à un segment [a,b]
function segDist(a, b, x, y) {
  const dx = b.x - a.x, dy = b.y - a.y;
  let t = ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy);
  t = constrain(t, 0, 1);
  return dist(x, y, a.x + t * dx, a.y + t * dy);
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// Flèche (x,y) -> angle a, longueur len
function drawArrow(x, y, a, len, r, g, b, w, alpha) {
  const x2 = x + cos(a) * len, y2 = y + sin(a) * len, h = 3 + w * 1.5;
  stroke(r, g, b, alpha); strokeWeight(w);
  line(x, y, x2, y2);
  line(x2, y2, x2 - cos(a - 0.5) * h, y2 - sin(a - 0.5) * h);
  line(x2, y2, x2 - cos(a + 0.5) * h, y2 - sin(a + 0.5) * h);
}

class Vehicle {
  // team = configuration de la voiture (rays, layers, neurons, sight, speed, color)
  constructor(brain, team) {
    this.team = team;
    this.id = (Vehicle.seq = (Vehicle.seq || 0) + 1);
    this.score = 0; // checkpoints passés
    this.fitness = 0;
    this.dead = false;
    this.finished = false;
    this.pos = createVector(start.x, start.y);
    // on démarre dans le sens de la route
    this.vel = p5.Vector.sub(checkpoints[1].midpoint(), start).setMag(1);
    this.acc = createVector();
    this.maxforce = 0.2;
    this.index = 1;
    this.counter = 0;
    this.dists = [];

    // rayons répartis sur l'angle de vision FOV
    this.rays = [];
    const n = team.rays;
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? 0 : map(i, 0, n - 1, -FOV / 2, FOV / 2);
      this.rays.push(new Ray(this.pos, radians(a)));
    }
    this.rays.forEach(r => r.rotate(this.vel.heading()));

    this.brain = brain
      ? brain.copy()
      : new NeuralNetwork(n, Array(team.layers).fill(team.neurons), 2);
  }

  get maxspeed() { return this.team.speed; }
  get sight() { return this.team.sight; }

  dispose() { this.brain.dispose(); }
  mutate() { this.brain.mutate(MUTATION_RATE); }
  applyForce(f) { this.acc.add(f); }
  applyBehaviors(walls) { this.applyForce(this.look(walls)); }

  update() {
    if (this.dead || this.finished) return;
    this.pos.add(this.vel);
    this.vel.add(this.acc);
    this.vel.limit(this.maxspeed);
    this.acc.set(0, 0);
    if (++this.counter > LIFESPAN) this.dead = true;
    const h = this.vel.heading();
    this.rays.forEach(r => r.rotate(h));
  }

  check(checkpoints) {
    if (this.finished) return;
    this.goal = checkpoints[this.index];
    if (segDist(this.goal.a, this.goal.b, this.pos.x, this.pos.y) < 8) {
      this.index = (this.index + 1) % checkpoints.length;
      this.score++;
      this.counter = 0;
      if (this.score > this.team.best) this.team.best = this.score;
      if (this.score >= LAPS * checkpoints.length) {
        this.finished = true;
        this.team.done = true;
        this.finishTick = raceTick;
        finishLog.push({ team: this.team, tick: raceTick }); // ordre d'arrivée
      }
    }
  }

  calculateFitness() {
    this.fitness = pow(1.25, this.score);
  }

  // Capteurs (raycasting) -> réseau de neurones -> force
  look(walls) {
    const s = this.sight;
    const inputs = [];
    for (let i = 0; i < this.rays.length; i++) {
      const r = this.rays[i];
      const d = rayDist(this.pos.x, this.pos.y, r.dir.x, r.dir.y, walls, s);
      this.dists[i] = d;
      if (d < 5) this.dead = true;
      inputs[i] = map(d, 0, s, 1, 0);
    }
    const out = this.brain.predict(inputs);
    let angle = map(out[0], 0, 1, -PI, PI) + this.vel.heading();
    const speed = map(out[1], 0, 1, 0, this.maxspeed);
    // mémorisé pour le mode debug
    this.inputs = inputs; this.out = out; this.wantAngle = angle; this.wantSpeed = speed;
    const wanted = p5.Vector.fromAngle(angle).setMag(speed);
    return p5.Vector.sub(wanted, this.vel).limit(this.maxforce);
  }

  // Feux : cône de lumière limité par les murs (raycasting)
  light(walls) {
    const ctx = drawingContext;
    const N = 24, s = this.sight, x = this.pos.x, y = this.pos.y;
    const h = this.vel.heading(), half = radians(FOV) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i <= N; i++) {
      const a = h - half + (i * 2 * half) / N;
      const d = rayDist(x, y, cos(a), sin(a), walls, s);
      ctx.lineTo(x + cos(a) * d, y + sin(a) * d);
    }
    ctx.closePath();
    ctx.clip();
    const g = ctx.createRadialGradient(x, y, 0, x, y, s);
    g.addColorStop(0, hexA(this.team.color, 0.6));
    g.addColorStop(1, hexA(this.team.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - s, y - s, 2 * s, 2 * s);
    ctx.restore();
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());
    noStroke();
    fill(this.team.color);
    rectMode(CENTER);
    rect(0, 0, 10, 5);
    fill(255);
    rect(4, -1.5, 2, 1.5);
    rect(4, 1.5, 2, 1.5);
    pop();
  }

  // Debug : cap actuel (blanc) + flèche de décision du réseau (rouge = lent, vert = rapide)
  debugShow(big) {
    if (this.wantAngle === undefined) return;
    const x = this.pos.x, y = this.pos.y, h = this.vel.heading();
    const k = constrain(this.wantSpeed / this.maxspeed, 0, 1);
    push();
    drawArrow(x, y, h, big ? 26 : 14, 255, 255, 255, big ? 1.5 : 1, 110);
    drawArrow(x, y, this.wantAngle, (big ? 18 : 10) + k * (big ? 34 : 18),
              lerp(255, 60, k), lerp(70, 255, k), 90, big ? 3 : 1.5, 255);
    pop();
  }

  highlight(showRays) {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());
    stroke(0, 255, 0);
    fill(this.team.color);
    rectMode(CENTER);
    rect(0, 0, 16, 8);
    pop();
    if (showRays) {
      this.rays.forEach((r, i) => r.show(this.dists[i] || this.sight));
    }
  }
}