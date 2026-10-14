// Pierre ronde posée SUR la piste. Les voitures et le serpent de circuit la contournent.
// Position stockée par rapport à la piste (u = avancement 0..1, v = décalage latéral -1..1
// en fraction de la demi-largeur) : elle suit donc la piste quand la fenêtre change de taille.
class Stone {
  constructor(u, v, rk) {
    this.u = u;
    this.v = v;
    this.rk = rk;                              // rayon = demi-largeur de piste * rk
    this.pos = createVector(0, 0);
    this.r = 10;
    this.cracks = [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2];
  }

  // (Re)calcule position et rayon depuis la piste
  place(track) {
    const p = track.pointAt(this.u * track.total);
    this.r = track.halfWidth * this.rk;
    this.pos.set(p.x + p.nx * this.v * track.halfWidth, p.y + p.ny * this.v * track.halfWidth);
  }

  // `count` pierres réparties sur le tour (une par portion, position aléatoire dedans),
  // assez petites pour qu'on puisse toujours passer à côté.
  static scatter(count, track) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const st = new Stone(
        (i + 0.15 + Math.random() * 0.7) / count,
        (Math.random() * 2 - 1) * 0.3,
        0.22 + Math.random() * 0.1
      );
      st.place(track);
      out.push(st);
    }
    return out;
  }

  show() {
    push();
    const { x, y } = this.pos;
    const r = this.r;
    noStroke();
    fill(0, 0, 0, 70);                                   // ombre
    ellipse(x + 3, y + 4, r * 2.2, r * 1.8);
    stroke(55, 55, 62);
    strokeWeight(2);
    fill(135, 135, 145);
    circle(x, y, r * 2);                                 // pierre
    noStroke();
    fill(165, 165, 176);
    circle(x - r * 0.2, y - r * 0.25, r * 1.1);
    fill(210, 210, 220, 200);
    circle(x - r * 0.35, y - r * 0.4, r * 0.4);          // reflet
    stroke(75, 75, 85);
    strokeWeight(1);
    for (const a of this.cracks) {                       // fissures
      line(x + Math.cos(a) * r * 0.15, y + Math.sin(a) * r * 0.15,
           x + Math.cos(a + 0.4) * r * 0.65, y + Math.sin(a + 0.4) * r * 0.65);
    }
    pop();
  }
}

if (typeof module !== 'undefined') module.exports = Stone;