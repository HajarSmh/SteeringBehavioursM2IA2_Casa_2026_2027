// Raycasting : voir la vidéo de Daniel Shiffman https://www.youtube.com/watch?v=TOEi6T2mtHo

// Distance au premier mur touché par un rayon (px,py) -> (dx,dy) normalisé.
// Version numérique (sans allocation), utilisée pour les capteurs et les feux.
function rayDist(px, py, dx, dy, walls, maxd) {
  let record = maxd;
  for (let k = 0; k < walls.length; k++) {
    const w = walls[k];
    const x1 = w.a.x, y1 = w.a.y, x2 = w.b.x, y2 = w.b.y;
    const den = -(x1 - x2) * dy + (y1 - y2) * dx;
    if (den === 0) continue;
    const t = (-(x1 - px) * dy + (y1 - py) * dx) / den;
    const u = -((x1 - x2) * (y1 - py) - (y1 - y2) * (x1 - px)) / den;
    if (t > 0 && t < 1 && u > 0 && u < record) record = u;
  }
  return record;
}

class Ray {
  constructor(pos, angle) {
    this.pos = pos;
    this.angle = angle;
    this.dir = p5.Vector.fromAngle(angle);
  }

  rotate(offset) {
    this.dir = p5.Vector.fromAngle(this.angle + offset);
  }

  show(len) {
    stroke(0, 255, 0, 120);
    push();
    strokeWeight(2);
    translate(this.pos.x, this.pos.y);
    line(0, 0, this.dir.x * len, this.dir.y * len);
    pop();
  }

  // Point d'intersection avec un mur (ou undefined)
  cast(wall) {
    const x1 = wall.a.x, y1 = wall.a.y, x2 = wall.b.x, y2 = wall.b.y;
    const x3 = this.pos.x, y3 = this.pos.y;
    const x4 = x3 + this.dir.x, y4 = y3 + this.dir.y;
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (den == 0) return;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
    if (t > 0 && t < 1 && u > 0) {
      return createVector(x1 + t * (x2 - x1), y1 + t * (y2 - y1));
    }
  }
}