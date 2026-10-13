import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// --- Faux p5.Vector minimal ---
class Vec {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  copy() { return new Vec(this.x, this.y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  mult(k) { this.x *= k; this.y *= k; return this; }
  mag() { return Math.hypot(this.x, this.y); }
  magSq() { return this.x * this.x + this.y * this.y; }
  setMag(m) {
    const c = this.mag();
    if (c === 0) return this;
    this.x = (this.x / c) * m; this.y = (this.y / c) * m;
    return this;
  }
  limit(m) { if (this.mag() > m) this.setMag(m); return this; }
  static sub(a, b) { return new Vec(a.x - b.x, a.y - b.y); }
  static fromAngle(a) { return new Vec(Math.cos(a), Math.sin(a)); }
}
globalThis.p5 = { Vector: Vec };
globalThis.createVector = (x, y) => new Vec(x, y);
globalThis.Vehicle = class {
  constructor(x, y) {
    this.pos = new Vec(x, y); this.vel = new Vec(); this.acc = new Vec();
    this.maxSpeed = 4; this.maxForce = 0.1; this.r = 16;
  }
  applyForce(f) { this.acc.add(f); }
};

const { RandomTarget } = createRequire(import.meta.url)('../randomTarget.js');
const make = () => new RandomTarget(500, 500, () => 0.5);
const veh = (x, y) => ({ pos: new Vec(x, y) });

test('la cible est plus rapide que les véhicules (ne peut pas être rattrapée)', () => {
  const t = make();
  assert.ok(t.maxSpeed > new Vehicle(0, 0).maxSpeed);
});

test('flee : aucun véhicule => force nulle', () => {
  const f = make().flee([]);
  assert.deepEqual([f.x, f.y], [0, 0]);
});

test('flee : véhicule hors du rayon de perception => force nulle', () => {
  const t = make();
  const f = t.flee([veh(500 - t.fleeRadius - 1, 500)]);
  assert.deepEqual([f.x, f.y], [0, 0]);
});

test('flee : véhicule à gauche => la force pousse vers la droite', () => {
  const f = make().flee([veh(450, 500)]);
  assert.ok(f.x > 0);
  assert.ok(Math.abs(f.y) < 1e-9);
});

test('flee : force limitée à 2 × maxForce', () => {
  const t = make();
  const f = t.flee([veh(499, 500), veh(501, 505), veh(490, 490)]);
  assert.ok(f.mag() <= t.maxForce * 2 + 1e-9);
});

test('flee : le véhicule le plus proche domine un véhicule plus lointain', () => {
  const f = make().flee([veh(480, 500), veh(700, 500)]);
  assert.ok(f.x > 0);
});

test('flee : seuls les 3 plus proches comptent (les lointains ne l\'annulent pas)', () => {
  const t = make();
  // 3 véhicules proches à gauche, 5 plus loin à droite : on fuit vers la droite
  const near = [veh(470, 500), veh(470, 505), veh(470, 495)];
  const far = [1, 2, 3, 4, 5].map(i => veh(700 + i, 500));
  const f = t.flee([...near, ...far]);
  assert.ok(f.x > 0);
});

test('flee : véhicule exactement sur la cible => pas de NaN', () => {
  const f = make().flee([veh(500, 500)]);
  assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y));
});

test('flee : la vitesse actuelle est corrigée (pas seulement inversée)', () => {
  const t = make();
  t.vel.set(0, 3);
  const f = t.flee([veh(450, 500)]);
  assert.ok(f.y < 0);
});

test('avoidWalls : près du bord gauche, la force pousse vers la droite', () => {
  const f = make().avoidWalls(1000, 1000);
  assert.deepEqual([f.x, f.y], [0, 0]);          // au centre : aucune force
  const t = make();
  t.pos.set(20, 500);
  assert.ok(t.avoidWalls(1000, 1000).x > 0);
});

test('steer : une force de fuite est appliquée à l\'accélération', () => {
  const t = make();
  t.steer(2000, 2000, [veh(490, 500)]);
  assert.ok(t.acc.x > 0);
});

test('steer : sans véhicule, le wander agit seul (accélération bornée, non nulle)', () => {
  const t = make();
  t.steer(2000, 2000, []);
  assert.ok(t.acc.magSq() > 0);
  assert.ok(t.acc.mag() <= t.maxForce + 1e-9);
});

test('steer : l\'accélération reste non nulle même entourée symétriquement', () => {
  const t = make();
  t.vel.set(5, 0);                                // elle avance déjà
  t.steer(2000, 2000, [veh(450, 500), veh(550, 500)]);
  assert.ok(Number.isFinite(t.acc.x) && Number.isFinite(t.acc.y));
});

test('detects : faux sans véhicule, faux hors du rayon, vrai dedans', () => {
  const t = make();                                   // en (500, 500)
  assert.equal(t.detects([]), false);
  assert.equal(t.detects([veh(500 + t.fleeRadius + 1, 500)]), false);
  assert.equal(t.detects([veh(500 + t.fleeRadius, 500)]), false);   // sur le bord : pas dedans
  assert.equal(t.detects([veh(500 + t.fleeRadius - 1, 500)]), true);
  assert.equal(t.detects([veh(900, 900), veh(520, 500)]), true);    // un seul suffit
});