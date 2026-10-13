import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const Music = createRequire(import.meta.url)('../music.js');

test('midiToFreq : La4 = 440 Hz, La3 = 220 Hz', () => {
  assert.equal(Music.midiToFreq(69), 440);
  assert.ok(Math.abs(Music.midiToFreq(57) - 220) < 1e-9);
});

test('buildPattern : longueur demandée et reproductible avec un rng fixé', () => {
  const rng = () => 0.5;
  const a = Music.buildPattern(57, 16, rng);
  const b = Music.buildPattern(57, 16, rng);
  assert.equal(a.length, 16);
  assert.deepEqual(a, b);
});

test('buildPattern : toutes les notes appartiennent à la gamme, sur deux octaves', () => {
  for (let i = 0; i < 200; i++) {
    for (const midi of Music.buildPattern(57, 16)) {
      if (midi === null) continue;
      assert.ok(midi >= 57 && midi <= 57 + 12 + 10);
      assert.ok(Music.SCALE.includes((midi - 57) % 12));
    }
  }
});

test('buildPattern : un rng bas donne des silences, un rng haut donne des notes', () => {
  assert.ok(Music.buildPattern(57, 8, () => 0).every(n => n === null));
  assert.ok(Music.buildPattern(57, 8, () => 0.99).every(n => n !== null));
});

test('gainFor : borné, croissant, jamais au-dessus de 0.6', () => {
  assert.equal(Music.gainFor(0), 0);
  assert.equal(Music.gainFor(5), 0.6);
  assert.equal(Music.gainFor('abc'), 0);
  assert.ok(Music.gainFor(0.7) > Music.gainFor(0.3));
});