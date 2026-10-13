import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const M = createRequire(import.meta.url)('../mouseInfluence.js');
const Music = createRequire(import.meta.url)('../music.js');

test('inside : bornes incluses, dehors refusé', () => {
  assert.equal(M.inside(0, 0, 800, 600), true);
  assert.equal(M.inside(800, 600, 800, 600), true);
  assert.equal(M.inside(-1, 10, 800, 600), false);
  assert.equal(M.inside(10, 601, 800, 600), false);
});

test('normalize : valeurs dans [0, 1], tailles nulles sans NaN', () => {
  assert.deepEqual(M.normalize(400, 300, 800, 600), { x: 0.5, y: 0.5 });
  assert.deepEqual(M.normalize(-50, 9999, 800, 600), { x: 0, y: 1 });
  assert.deepEqual(M.normalize(10, 10, 0, 0), { x: 0.5, y: 0.5 });
});

test('smooth : se rapproche sans dépasser, converge', () => {
  const a = M.smooth(0, 1, 0.1);
  assert.ok(a > 0 && a < 1);
  let v = 0;
  for (let i = 0; i < 200; i++) v = M.smooth(v, 1, 0.1);
  assert.ok(Math.abs(v - 1) < 1e-6);
  assert.equal(M.smooth(0.3, 0.3), 0.3);
});

test('musique : transposeFor, tempoFor, cutoffFor bornés et monotones', () => {
  assert.equal(Music.transposeFor(0), 0);
  assert.equal(Music.transposeFor(1), 7);
  assert.equal(Music.transposeFor(5), 7);
  assert.ok(Math.abs(Music.tempoFor(0) - 0.15) < 1e-9);
  assert.ok(Math.abs(Music.tempoFor(1) - 0.35) < 1e-9);
  assert.ok(Music.tempoFor(0.2) < Music.tempoFor(0.8));
  assert.equal(Music.cutoffFor(0), 300);
  assert.equal(Music.cutoffFor(1), 1800);
  assert.equal(Music.cutoffFor('abc'), 300);
});

test('setStyle : teinte de 0 à 360 et halo de 1 à 2, valeurs hors bornes écrêtées', () => {
  const t = make();
  t.setStyle(0.5, 0);
  assert.equal(t.hue, 180);
  assert.equal(t.haloScale, 1);
  t.setStyle(2, 5);
  assert.equal(t.hue, 360);
  assert.equal(t.haloScale, 2);
});

test('steer : la souris proche à gauche pousse la cible vers la droite', () => {
  const t = make();
  t.steer(2000, 2000, [], new Vec(470, 500));
  assert.ok(t.acc.x > 0);
});

test('steer : sans souris (null), comportement inchangé', () => {
  const t = make();
  t.steer(2000, 2000, [], null);
  assert.ok(t.acc.magSq() > 0);
});