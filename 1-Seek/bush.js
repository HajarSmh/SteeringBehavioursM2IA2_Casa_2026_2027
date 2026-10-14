// Buisson rond : obstacle circulaire (pos + r) que les serpents de la souris contournent.
class Bush {
  constructor(x, y, r) {
    this.pos = createVector(x, y);
    this.r = r;
    // touffes de feuillage fixes (restent à l'intérieur du cercle de collision)
    this.lumps = [];
    const n = 8 + Math.floor(r / 6);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = r * (0.2 + Math.random() * 0.4);
      this.lumps.push({
        x: Math.cos(a) * d,
        y: Math.sin(a) * d,
        size: r * (0.5 + Math.random() * 0.3),
        hue: 105 + Math.random() * 35,
        bright: 38 + Math.random() * 25
      });
    }
  }

  // Tire `count` buissons au hasard : loin des bords, loin de la piste (pour ne pas
  // gêner les voitures) et espacés entre eux (les gros serpents doivent pouvoir passer).
  // Peut en placer moins que demandé s'il manque de la place.
  static scatter(count, w, h, track = null) {
    const out = [];
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 200; tries++) {
        const r = 28 + Math.random() * 28;
        const m = r + 60;
        if (w <= 2 * m || h <= 2 * m) continue;
        const x = m + Math.random() * (w - 2 * m);
        const y = m + Math.random() * (h - 2 * m);
        if (track && track.closest(x, y).dist < track.halfWidth + 18 + r + 10) continue;
        if (out.some(b => Math.hypot(b.pos.x - x, b.pos.y - y) < b.r + r + 70)) continue;
        out.push(new Bush(x, y, r));
        break;
      }
    }
    return out;
  }

  show() {
    push();
    colorMode(HSB, 360, 100, 100, 1);
    translate(this.pos.x, this.pos.y);
    stroke(120, 70, 14);
    strokeWeight(3);
    fill(125, 65, 30);
    circle(0, 0, this.r * 2);                       // masse du buisson
    noStroke();
    for (const l of this.lumps) {
      fill(l.hue, 60, l.bright);
      circle(l.x, l.y, l.size);
      fill(l.hue, 35, Math.min(100, l.bright + 25), 0.5);
      circle(l.x - l.size * 0.15, l.y - l.size * 0.18, l.size * 0.35);   // reflet
    }
    pop();
  }
}

if (typeof module !== 'undefined') module.exports = Bush;