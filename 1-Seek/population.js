// Règles de gestion de la population (sans dépendance à p5, donc testable).
const SeekPopulation = (() => {
  const MIN_COUNT = 1;
  const MAX_COUNT = 200;
  const INITIAL_COUNT = 20;
  const ARRIVAL_RADIUS = 16;   // le centre du véhicule dans le disque = arrivée
  const SAFE_DISTANCE = 20;    // une réapparition doit être > 20 px de la cible
  const MAX_TRIES = 32;
  const MARGIN = 16;

  function clampCount(value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return MIN_COUNT;
    return Math.min(MAX_COUNT, Math.max(MIN_COUNT, n));
  }

  function hasArrived(pos, targetPos) {
    const dx = pos.x - targetPos.x;
    const dy = pos.y - targetPos.y;
    return dx * dx + dy * dy <= ARRIVAL_RADIUS * ARRIVAL_RADIUS;
  }

  // Tirage borné : 32 essais aléatoires, puis repli sur le coin le plus éloigné.
  function pickPosition(w, h, targetPos, rng = Math.random) {
    const mx = w > 2 * MARGIN ? MARGIN : 0;
    const my = h > 2 * MARGIN ? MARGIN : 0;
    const isSafe = p => Math.hypot(p.x - targetPos.x, p.y - targetPos.y) > SAFE_DISTANCE;
    for (let i = 0; i < MAX_TRIES; i++) {
      const p = { x: mx + rng() * (w - 2 * mx), y: my + rng() * (h - 2 * my) };
      if (isSafe(p)) return { x: p.x, y: p.y, ok: true };
    }
    const corners = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: 0, y: h }, { x: w, y: h }];
    let best = corners[0];
    let bestDist = -1;
    for (const c of corners) {
      const d = Math.hypot(c.x - targetPos.x, c.y - targetPos.y);
      if (d > bestDist) { best = c; bestDist = d; }
    }
    return { x: best.x, y: best.y, ok: isSafe(best) };
  }

  // Réapparition de la MÊME instance, vitesse et accélération nulles.
  function respawn(vehicle, w, h, targetPos, rng = Math.random) {
    const p = pickPosition(w, h, targetPos, rng);
    if (!p.ok) return false;  // géométrie impossible : on diffère
    vehicle.pos.set(p.x, p.y);
    vehicle.vel.set(0, 0);
    vehicle.acc.set(0, 0);
    return true;
  }

  // Ajoute ou retire uniquement ce qui manque/dépasse (les premiers restent intacts).
  function resize(vehicles, count, factory, w, h, targetPos, rng = Math.random) {
    const n = clampCount(count);
    while (vehicles.length < n) {
      const p = pickPosition(w, h, targetPos, rng);
      vehicles.push(factory(p.x, p.y));
    }
    if (vehicles.length > n) vehicles.length = n;
    return vehicles.length;
  }

  // Une image pour un véhicule : seek -> update -> edges, avec test d'arrivée
  // avant et après le déplacement. Au plus une réapparition par image.
    function step(vehicle, targetPos, w, h, rng = Math.random) {
    if (hasArrived(vehicle.pos, targetPos)) {
      respawn(vehicle, w, h, targetPos, rng);
      return true;
    }
    vehicle.applyBehaviors(targetPos);
    vehicle.update();
    vehicle.edges();
    if (hasArrived(vehicle.pos, targetPos)) {
      respawn(vehicle, w, h, targetPos, rng);
      return true;
    }
    return false;
  }

  // Slider branché sur l'événement "input" (pas "change") : effet immédiat.
  function bindSlider(slider, output, vehicles, targetPos, getSize, factory, rng = Math.random) {
    const sync = () => {
      const { width, height } = getSize();
      const n = resize(vehicles, slider.value, factory, width, height, targetPos, rng);
      slider.value = n;
      output.textContent = `${n} / ${MAX_COUNT}`;
    };
    slider.addEventListener('input', sync);
    sync();
    return sync;
  }

  return {
    MIN_COUNT, MAX_COUNT, INITIAL_COUNT, ARRIVAL_RADIUS, SAFE_DISTANCE,
    clampCount, hasArrived, pickPosition, respawn, resize, step, bindSlider
  };
})();

if (typeof module !== 'undefined') module.exports = SeekPopulation;