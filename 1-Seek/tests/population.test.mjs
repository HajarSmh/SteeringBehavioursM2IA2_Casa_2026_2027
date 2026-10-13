import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const SeekPopulation = createRequire(import.meta.url)('../population.js');

// Faux véhicule minimal (pas besoin de p5 pour tester les règles de gestion)
function fakeVehicle(x, y) {
  const vec = (a, b) => ({ x: a, y: b, set(nx, ny) { this.x = nx; this.y = ny; } });
  return {
    pos: vec(x, y), vel: vec(1, 1), acc: vec(1, 1), calls: [],
    applyBehaviors() { this.calls.push('seek'); },
    update() { this.calls.push('update'); },
    edges() { this.calls.push('edges'); }
  };
}

const seq = values => { let i = 0; return () => values[i++ % values.length]; };
const far = { x: 0, y: 0 };

test('clampCount borne entre 1 et 200 et rejette les valeurs invalides', () => {
  assert.equal(SeekPopulation.clampCount(0), 1);
  assert.equal(SeekPopulation.clampCount(500), 200);
  assert.equal(SeekPopulation.clampCount('abc'), 1);
  assert.equal(SeekPopulation.clampCount(35), 35);
});

test('resize conserve les premières instances en augmentant et en diminuant', () => {
  const list = [];
  SeekPopulation.resize(list, 20, fakeVehicle, 800, 600, far, Math.random);
  const first20 = [...list];
  SeekPopulation.resize(list, 35, fakeVehicle, 800, 600, far, Math.random);
  assert.equal(list.length, 35);
  first20.forEach((v, i) => assert.equal(list[i], v));
  SeekPopulation.resize(list, 8, fakeVehicle, 800, 600, far, Math.random);
  assert.equal(list.length, 8);
  first20.slice(0, 8).forEach((v, i) => assert.equal(list[i], v));
});

test('hasArrived : juste dehors, égalité, intérieur', () => {
  const t = { x: 100, y: 100 };
  assert.equal(SeekPopulation.hasArrived({ x: 116.01, y: 100 }, t), false);
  assert.equal(SeekPopulation.hasArrived({ x: 116, y: 100 }, t), true);
  assert.equal(SeekPopulation.hasArrived({ x: 100, y: 100 }, t), true);
});

test('pickPosition reste dans le canvas et hors de la zone d\'exclusion', () => {
  const t = { x: 400, y: 300 };
  for (let i = 0; i < 100; i++) {
    const p = SeekPopulation.pickPosition(800, 600, t);
    assert.ok(p.ok);
    assert.ok(p.x >= 0 && p.x <= 800 && p.y >= 0 && p.y <= 600);
    assert.ok(Math.hypot(p.x - 400, p.y - 300) > 20);
  }
});

test('pickPosition : repli déterministe sur le coin le plus éloigné après 32 essais', () => {
  const t = { x: 5, y: 5 };
  // rng qui renvoie toujours un point dans la zone d'exclusion
  const p = SeekPopulation.pickPosition(800, 600, t, () => 0);
  assert.deepEqual([p.x, p.y, p.ok], [800, 600, true]);
});

test('pickPosition : géométrie impossible => ok=false sans boucle infinie', () => {
  const p = SeekPopulation.pickPosition(10, 10, { x: 5, y: 5 }, Math.random);
  assert.equal(p.ok, false);
});

test('respawn : même instance, vitesse et accélération nulles', () => {
  const v = fakeVehicle(100, 100);
  const ok = SeekPopulation.respawn(v, 800, 600, { x: 100, y: 100 }, Math.random);
  assert.equal(ok, true);
  assert.deepEqual([v.vel.x, v.vel.y, v.acc.x, v.acc.y], [0, 0, 0, 0]);
  assert.ok(Math.hypot(v.pos.x - 100, v.pos.y - 100) > 20);
});

test('step : véhicule loin de la cible => seek, update, edges dans l\'ordre', () => {
  const v = fakeVehicle(500, 500);
  SeekPopulation.step(v, { x: 0, y: 0 }, 800, 600);
  assert.deepEqual(v.calls, ['seek', 'update', 'edges']);
});

test('step : arrivée avant déplacement => réapparition sans seek ni update', () => {
  const v = fakeVehicle(100, 100);
  SeekPopulation.step(v, { x: 105, y: 100 }, 800, 600);
  assert.deepEqual(v.calls, []);
  assert.deepEqual([v.vel.x, v.vel.y], [0, 0]);
});

test('step : arrivée après déplacement => une seule réapparition', () => {
  const v = fakeVehicle(500, 500);
  v.update = function () { this.pos.set(100, 100); this.calls.push('update'); };
  SeekPopulation.step(v, { x: 100, y: 100 }, 800, 600, seq([0.9, 0.9]));
  assert.deepEqual(v.calls, ['seek', 'update', 'edges']);
  assert.ok(Math.hypot(v.pos.x - 100, v.pos.y - 100) > 20);
});

test('step : renvoie true en cas d\'arrivée (avant ou après déplacement), false sinon', () => {
  assert.equal(SeekPopulation.step(fakeVehicle(500, 500), { x: 0, y: 0 }, 800, 600), false);
  assert.equal(SeekPopulation.step(fakeVehicle(100, 100), { x: 105, y: 100 }, 800, 600), true);
  const v = fakeVehicle(500, 500);
  v.update = function () { this.pos.set(100, 100); };
  assert.equal(SeekPopulation.step(v, { x: 100, y: 100 }, 800, 600, seq([0.9, 0.9])), true);
});