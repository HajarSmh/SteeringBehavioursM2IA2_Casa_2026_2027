// Règles de gestion des cibles (sans p5, testable sous Node).
const TargetSwarm = (() => {
  const MIN_LIFESPAN = 5;
  const MAX_LIFESPAN = 60;
  const DEFAULT_LIFESPAN = 30;
  const MAX_TARGETS = 150;
  const INITIAL_TARGETS = 5;
  const IMMUNITY_SECONDS = 1.5; 

  function clampLifespan(value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return DEFAULT_LIFESPAN;
    return Math.min(MAX_LIFESPAN, Math.max(MIN_LIFESPAN, n));
  }

  // Cible la plus proche d'une position (null s'il n'y en a aucune).
  function nearest(pos, targets) {
    let best = null;
    let bestD = Infinity;
    for (const t of targets) {
      const dx = t.pos.x - pos.x;
      const dy = t.pos.y - pos.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  // Fait vieillir les cibles ; une cible qui a atteint la durée de survie est
  // remplacée par ses deux enfants, tant que le plafond n'est pas dépassé.
  // Au plafond, la cible reste en attente et se divise dès qu'une place se libère.
  function advance(targets, dt, lifespan, maxTargets = MAX_TARGETS) {
    const events = [];
    for (const t of [...targets]) {        // copie : les enfants ne sont pas vieillis cette image
      t.tick(dt);
      if (t.age < lifespan) continue;
      if (targets.length + 1 > maxTargets) continue;
      const kids = t.split();
      targets.splice(targets.indexOf(t), 1, ...kids);
      events.push({ type: 'split', parent: t, children: kids });
    }
    return events;
  }

  // Retire les cibles capturées (Set) et renvoie celles qui ont été retirées.
  function removeCaught(targets, caught) {
    const removed = [];
    for (let i = targets.length - 1; i >= 0; i--) {
      if (caught.has(targets[i])) removed.unshift(...targets.splice(i, 1));
    }
    return removed;
  }

  // Garantit qu'il reste au moins une cible.
  function ensureOne(targets, factory) {
    if (targets.length > 0) return null;
    const t = factory();
    targets.push(t);
    return t;
  }

    // Position loin de tous les objets (ayant .pos) : 32 essais, puis le meilleur essai.
  function safePosition(w, h, others, minDist, rng = Math.random, tries = 32) {
    let best = { x: rng() * w, y: rng() * h };
    if (others.length === 0) return best;
    const clearance = p => {
      let m = Infinity;
      for (const o of others) m = Math.min(m, Math.hypot(o.pos.x - p.x, o.pos.y - p.y));
      return m;
    };
    let bestClear = clearance(best);
    for (let i = 0; i < tries && bestClear <= minDist; i++) {
      const p = { x: rng() * w, y: rng() * h };
      const c = clearance(p);
      if (c > bestClear) { best = p; bestClear = c; }
    }
    return best;
  }

  // Si plus aucune cible n'existe, en recrée `count`.
  function refill(targets, factory, count = INITIAL_TARGETS) {
    if (targets.length > 0) return [];
    const made = [];
    for (let i = 0; i < count; i++) made.push(factory());
    targets.push(...made);
    return made;
  }

  function isImmune(target) {
    return target.age < IMMUNITY_SECONDS;
  }

    return {
    MIN_LIFESPAN, MAX_LIFESPAN, DEFAULT_LIFESPAN, MAX_TARGETS, INITIAL_TARGETS, IMMUNITY_SECONDS,
    clampLifespan, nearest, advance, removeCaught, ensureOne, safePosition, refill, isImmune
  };
})();

if (typeof module !== 'undefined') module.exports = TargetSwarm;