// Évitement d'obstacles "ahead / ahead2" : même logique que Vehicle.avoid() du cours,
// mais en fonction autonome (pas besoin de la variable globale `vehicules`, pas de dessin).
//
//  - ahead  = vitesse * 30 (point loin devant), ahead2 = vitesse * 15 (point à mi-chemin)
//  - on mesure la distance entre le centre de l'obstacle et : ahead, ahead2, et la position
//  - si la plus petite est < obstacle.r + zone  => collision possible
//  - force = vecteur (centre de l'obstacle -> point le plus proche), de norme maxForce / 2
//    (l'appelant la multiplie ensuite, comme `avoidForce.mult(3)` dans applyBehaviors)
//
// Différences avec la version du cours :
//  1. on teste TOUS les obstacles et on garde le plus menaçant (le plus proche n'est pas
//     toujours celui qui gêne : un petit obstacle proche vs un gros un peu plus loin) ;
//  2. `side` ajoute une composante latérale à la répulsion, sinon un véhicule qui arrive
//     pile en face reste bloqué (force alignée avec sa vitesse). side = 0 => version du cours.
//
// v         : objet avec pos, vel, maxForce (un Vehicle)
// obstacles : tableau d'objets { pos, r, pad? } (pad : marge en plus, pour un obstacle mobile)
function aheadAvoid(v, obstacles, { zone = 10, lookahead = 30, side = 0.6, goal = null } = {}) {
  if (!obstacles || obstacles.length === 0) return createVector(0, 0);

  const ahead1 = p5.Vector.add(v.pos, p5.Vector.mult(v.vel, lookahead));
  const ahead2 = p5.Vector.add(v.pos, p5.Vector.mult(v.vel, lookahead / 2));

  let threat = null;
  let threatPoint = null;
  let threatMargin = Infinity;
  for (const o of obstacles) {
    let d = o.pos.dist(ahead1);
    let pt = ahead1;
    const d2 = o.pos.dist(ahead2);
    if (d2 < d) { d = d2; pt = ahead2; }
    const d3 = o.pos.dist(v.pos);
    if (d3 < d) { d = d3; pt = v.pos; }
    const margin = d - (o.r + (o.pad || 0) + zone);   // < 0 => collision possible (pad = marge d'anticipation d'un obstacle qui bouge)
    if (margin < threatMargin) { threatMargin = margin; threat = o; threatPoint = pt; }
  }
  if (threatMargin >= 0) return createVector(0, 0);

  const force = p5.Vector.sub(threatPoint, threat.pos);
  if (force.magSq() < 1e-6) force.set(-v.vel.y, v.vel.x);   // pile au centre : on part de côté
  if (side > 0) {
    force.normalize();
    const perp = createVector(-force.y, force.x);
    const ref = goal || v.vel;                   // on contourne du côté où l'on veut aller
    const dot = perp.dot(ref);
    perp.mult(Math.abs(dot) < 1e-3 ? 1 : Math.sign(dot));
    force.add(perp.mult(side));
  }
  force.setMag(v.maxForce / 2);
  return force;
}

if (typeof module !== 'undefined') module.exports = aheadAvoid;