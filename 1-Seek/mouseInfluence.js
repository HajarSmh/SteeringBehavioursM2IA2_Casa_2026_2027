// Position de la souris -> valeurs normalisées 0..1 (pur, testable sous Node).
const MouseInfluence = (() => {
  const clamp01 = v => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

  function inside(x, y, w, h) {
    return x >= 0 && x <= w && y >= 0 && y <= h;
  }

  function normalize(x, y, w, h) {
    return { x: w > 0 ? clamp01(x / w) : 0.5, y: h > 0 ? clamp01(y / h) : 0.5 };
  }

  // Lissage exponentiel : évite les sauts de couleur et de son.
  function smooth(current, goal, k = 0.08) {
    return current + (goal - current) * clamp01(k);
  }

  return { clamp01, inside, normalize, smooth };
})();

if (typeof module !== 'undefined') module.exports = MouseInfluence;