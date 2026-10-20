// Mode debug (touche D ou bouton) : dessine ce qui concerne TOUTES les instances de Vehicle
// (voitures, serpents, fruits, leurres, avions...). Les oiseaux étendent Boid, pas Vehicle :
// ils ne sont donc pas concernés.
//
// Pour chaque véhicule :
//   - cercle blanc            : rayon de collision (this.r)
//   - ligne jaune             : vecteur "ahead" (vitesse x 30), point rouge au bout ;
//                               point bleu clair = "ahead2" (vitesse x 15) — voir avoid.js
//   - traînée grise           : this.path
//   - étiquette               : classe + vitesse
//   - cercle pointillé        : zone propre à la classe (debugExtra) :
//        Fruit -> distance de réveil, Car -> rayon de séparation,
//        SnakeHead -> zone de ralentissement (arrive), RandomTarget -> rayon de fuite
// Un Snake dessine en plus tous les cercles de collision de son corps.

function dashedCircle(x, y, radius, col) {
  push();
  noFill();
  stroke(col);
  strokeWeight(1.5);
  drawingContext.setLineDash([6, 6]);
  circle(x, y, radius * 2);
  drawingContext.setLineDash([]);
  pop();
}

Vehicle.prototype.showDebug = function () {
  push();
  colorMode(RGB, 255);
  const p = this.pos;

  // traînée
  if (this.path && this.path.length > 1) {
    noFill();
    stroke(255, 255, 255, 70);
    strokeWeight(1);
    beginShape();
    for (const q of this.path) vertex(q.x, q.y);
    endShape();
  }

  // rayon de collision
  noFill();
  stroke(255, 255, 255, 200);
  strokeWeight(1);
  circle(p.x, p.y, this.r * 2);

  // ahead / ahead2
  const speed = this.vel.mag();
  if (speed > 0.05) {
    const a1 = p5.Vector.add(p, p5.Vector.mult(this.vel, 30));
    const a2 = p5.Vector.add(p, p5.Vector.mult(this.vel, 15));
    stroke(255, 230, 0);
    strokeWeight(2);
    line(p.x, p.y, a1.x, a1.y);
    noStroke();
    fill(255, 60, 60);
    circle(a1.x, a1.y, 7);
    fill(140, 220, 255);
    circle(a2.x, a2.y, 7);
  }

  // étiquette
  noStroke();
  fill(255);
  textSize(10);
  textAlign(CENTER, BOTTOM);
  text(`${this.constructor.name} ${speed.toFixed(1)}`, p.x, p.y - this.r - 4);
  pop();

  if (typeof this.debugExtra === 'function') this.debugExtra();
};

if (typeof Fruit !== 'undefined') {
  Fruit.prototype.debugExtra = function () {
    dashedCircle(this.pos.x, this.pos.y, this.trigger, color(255, 160, 0));
  };
}
if (typeof Car !== 'undefined') {
  Car.prototype.debugExtra = function () {
    dashedCircle(this.pos.x, this.pos.y, this.r * 3, color(0, 220, 255));
  };
}
if (typeof SnakeHead !== 'undefined') {
  SnakeHead.prototype.debugExtra = function () {
    dashedCircle(this.pos.x, this.pos.y, this.slowRadius, color(255, 60, 220));
  };
}
if (typeof RandomTarget !== 'undefined') {
  RandomTarget.prototype.debugExtra = function () {
    dashedCircle(this.pos.x, this.pos.y, this.fleeRadius, color(255, 60, 60));
  };
}

if (typeof Dragon !== 'undefined') {
  Dragon.prototype.debugExtra = function () {
    dashedCircle(this.pos.x, this.pos.y, this.perception, color(255, 120, 0));
    if (this.prey) {                              // trait vers la proie visée
      push();
      stroke(255, 120, 0);
      strokeWeight(2);
      line(this.pos.x, this.pos.y, this.prey.pos.x, this.prey.pos.y);
      pop();
    }
  };
}

// Un Snake = sa tête + un corps : on montre les cercles de collision de tout le corps
// (les autres véhicules les utilisent comme obstacles) puis la tête.
if (typeof Snake !== 'undefined') {
  Snake.prototype.showDebug = function () {
    push();
    colorMode(RGB, 255);
    noFill();
    stroke(0, 255, 120, 170);
    strokeWeight(1);
    for (const c of this.circles()) circle(c.pos.x, c.pos.y, c.r * 2);
    pop();
    this.head.showDebug();
  };
}

const DebugMode = {
  toggle() {
    Vehicle.debug = !Vehicle.debug;
    const btn = document.getElementById('debug-toggle');
    if (btn) btn.setAttribute('aria-pressed', String(Vehicle.debug));
    return Vehicle.debug;
  },

  // groups : tableaux d'objets ; seuls ceux qui héritent de Vehicle sont dessinés
  draw(groups) {
    let n = 0;
    for (const list of groups) {
      for (const v of list) {
        if (v instanceof Vehicle) { v.showDebug(); n++; }
      }
    }
    push();
    noStroke();
    fill(255, 230, 0);
    textSize(12);
    textAlign(LEFT, TOP);
    text(`DEBUG — ${n} véhicules (D pour quitter)`, 10, 10);
    pop();
  }
};