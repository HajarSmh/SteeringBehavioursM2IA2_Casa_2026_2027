import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const Swarm = createRequire(import.meta.url)('../targetSwarm.js');

const fake = (age = 0, x = 0, y = 0) => ({
  age, pos: { x, y },
  tick(dt) { this.age += dt; },
  split() { return [fake(), fake()]; }
});

test('clampLifespan : bornes 5..60, valeur invalide => 30', () => {
  assert.equal(Swarm.clampLifespan(0), 5);
  assert.equal(Swarm.clampLifespan(100), 60);
  assert.equal(Swarm.clampLifespan('abc'), 30);
  assert.equal(Swarm.clampLifespan(30), 30);
});

test('nearest : liste vide => null, sinon la plus proche', () => {
  assert.equal(Swarm.nearest({ x: 0, y: 0 }, []), null);
  const a = fake(0, 100, 0);
  const b = fake(0, 10, 0);
  assert.equal(Swarm.nearest({ x: 0, y: 0 }, [a, b]), b);
});

test('advance : cible trop jeune => vieillit sans se diviser', () => {
  const t = fake(0);
  const list = [t];
  const events = Swarm.advance(list, 1, 30);
  assert.equal(events.length, 0);
  assert.equal(list.length, 1);
  assert.equal(t.age, 1);
});

test('advance : durée atteinte => remplacée par deux enfants (+1 cible)', () => {
  const t = fake(29.5);
  const list = [t];
  const events = Swarm.advance(list, 1, 30);
  assert.equal(list.length, 2);
  assert.ok(!list.includes(t));
  assert.equal(events.length, 1);
  assert.equal(events[0].parent, t);
});

test('advance : les enfants ne sont pas vieillis dans l\'image de leur naissance', () => {
  const list = [fake(40)];
  Swarm.advance(list, 1, 30);
  assert.deepEqual(list.map(c => c.age), [0, 0]);
});

test('advance : au plafond, la cible attend sans se diviser', () => {
  const list = [fake(40), fake(0)];
  const events = Swarm.advance(list, 1, 30, 2);
  assert.equal(list.length, 2);
  assert.equal(events.length, 0);
});

test('advance : le plafond est vérifié à chaque division', () => {
  const list = [fake(40), fake(40)];
  Swarm.advance(list, 1, 30, 3);
  assert.equal(list.length, 3);
});

test('advance : raccourcir la durée déclenche la division immédiatement', () => {
  const list = [fake(10)];
  assert.equal(Swarm.advance(list, 0.1, 30).length, 0);
  assert.equal(Swarm.advance(list, 0.1, 5).length, 1);
});

test('removeCaught : retire uniquement les cibles capturées', () => {
  const a = fake(); const b = fake(); const c = fake();
  const list = [a, b, c];
  const removed = Swarm.removeCaught(list, new Set([a, c]));
  assert.deepEqual(list, [b]);
  assert.deepEqual(removed, [a, c]);
});

test('ensureOne : crée une cible seulement si la liste est vide', () => {
  const list = [];
  const made = Swarm.ensureOne(list, () => fake());
  assert.equal(list.length, 1);
  assert.equal(list[0], made);
  assert.equal(Swarm.ensureOne(list, () => fake()), null);
  assert.equal(list.length, 1);
});

test('INITIAL_TARGETS vaut 5', () => {
  assert.equal(Swarm.INITIAL_TARGETS, 5);
});

test('safePosition : sans objet => position dans le canvas', () => {
  const p = Swarm.safePosition(800, 600, [], 150);
  assert.ok(p.x >= 0 && p.x <= 800 && p.y >= 0 && p.y <= 600);
});

test('safePosition : s\'éloigne des objets quand la place existe', () => {
  const others = [{ pos: { x: 400, y: 300 } }];
  for (let i = 0; i < 50; i++) {
    const p = Swarm.safePosition(800, 600, others, 150);
    assert.ok(Math.hypot(p.x - 400, p.y - 300) > 150);
  }
});

test('safePosition : borné, même si aucune place n\'existe', () => {
  const others = [{ pos: { x: 5, y: 5 } }];
  const p = Swarm.safePosition(10, 10, others, 1000);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});

test('refill : crée 5 cibles seulement si la liste est vide', () => {
  const list = [];
  assert.equal(Swarm.refill(list, () => fake(), 5).length, 5);
  assert.equal(list.length, 5);
  assert.equal(Swarm.refill(list, () => fake(), 5).length, 0);
  assert.equal(list.length, 5);
});

test('isImmune : vrai juste après la naissance, faux après 1,5 s', () => {
  assert.equal(Swarm.isImmune(fake(0)), true);
  assert.equal(Swarm.isImmune(fake(1.5)), false);
});

test('MAX_TARGETS : aucune limite par défaut, 30 cibles prêtes se divisent toutes', () => {
  assert.equal(Swarm.MAX_TARGETS, Infinity);
  const list = Array.from({ length: 30 }, () => fake(40));
  Swarm.advance(list, 1, 30);
  assert.equal(list.length, 60);
});