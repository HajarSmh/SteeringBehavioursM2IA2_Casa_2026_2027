// Oiseau : un Boid (boids.js, flocking de Shiffman) dessiné vu de dessus,
// avec battement d'ailes et ombre au sol. Il vole au-dessus de tout (pas d'obstacles)
// et traverse tout l'écran : en sortant d'un bord il réapparaît de l'autre (edges()).
//
// Comportements repris de Boid : align + cohesion + separation, plus un peu de wander
// pour que le vol reste naturel. L'évitement d'obstacles de Boid est désactivé
// (les oiseaux passent au-dessus des buissons, pierres, serpents et voitures).
class Bird extends Boid {
  constructor(x, y) {
    super(x, y);
    this.r = 14;                               // taille d'affichage
    this.maxSpeed = random(2.6, 3.8);
    this.maxForce = 0.08;
    this.perceptionRadius = 60;                // voisins pris en compte
    this.alignWeight = 1.2;
    this.cohesionWeight = 0.8;
    this.separationWeight = 1.8;
    this.wanderWeight = 0.6;
    // wander plus serré que celui de Boid par défaut
    this.distanceCercle = 40;
    this.wanderRadius = 20;
    this.displaceRange = 0.25;

    this.hue = random(360);
    this.phase = random(Math.PI * 2);          // chaque oiseau bat des ailes à son rythme
    this.flapSpeed = random(0.28, 0.42);
  }

  // flock() de Boid sans l'évitement d'obstacles ni le confinement
  flock(boids) {
    this.applyForce(this.align(boids).mult(this.alignWeight));
    this.applyForce(this.cohesion(boids).mult(this.cohesionWeight));
    this.applyForce(this.separation(boids).mult(this.separationWeight));
    this.applyForce(this.wander().mult(this.wanderWeight));
  }

  // Une image : forces -> déplacement -> réapparition de l'autre côté si on sort
  fly(boids) {
    this.flock(boids);
    this.update();
    this.edges();
  }

  // Forme vue de dessus. flap : -1..1 (position des ailes). shadow : dessin de l'ombre.
  drawShape(flap, shadow) {
    const r = this.r;
    const wing = r * (0.95 + 0.45 * flap);     // envergure apparente : varie quand l'aile bat
    if (shadow) {
      noStroke();
      fill(0, 0, 0, 0.22);
    } else {
      stroke(0, 0, 10);
      strokeWeight(1.2);
      fill(this.hue, 55, 100);
    }
    triangle(r * 0.25, 0, -r * 0.5, -wing, -r * 0.95, -wing * 0.2);   // aile gauche
    triangle(r * 0.25, 0, -r * 0.5, wing, -r * 0.95, wing * 0.2);     // aile droite
    triangle(-r * 0.6, 0, -r * 1.25, -r * 0.28, -r * 1.25, r * 0.28); // queue
    ellipse(0, 0, r * 1.6, r * 0.7);                                  // corps
    if (shadow) return;
    fill(this.hue, 70, 85);
    circle(r * 0.7, 0, r * 0.55);                                     // tête
    noStroke();
    fill(42, 90, 100);
    triangle(r * 0.95, -r * 0.12, r * 0.95, r * 0.12, r * 1.28, 0);   // bec
    fill(0, 0, 5);
    circle(r * 0.82, -r * 0.14, r * 0.1);                             // yeux
    circle(r * 0.82, r * 0.14, r * 0.1);
  }

  show() {
    const flap = Math.sin(frameCount * this.flapSpeed + this.phase);
    const a = this.vel.heading();
    push();
    colorMode(HSB, 360, 100, 100, 1);
    push();                                    // ombre décalée, comme si l'oiseau volait haut
    translate(this.pos.x + 12, this.pos.y + 18);
    rotate(a);
    this.drawShape(flap, true);
    pop();
    translate(this.pos.x, this.pos.y);
    rotate(a);
    this.drawShape(flap, false);
    pop();
  }
}

if (typeof module !== 'undefined') module.exports = Bird;