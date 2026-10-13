
const RetroBackground = (() => {
  const PALETTE = [
    "#ff2bd6",
    "#8b2cff",
    "#00eaff",
    "#39ff88",
    "#fff000",
    "#ff7a00",
    "#ff3158",
    "#7c4dff"
  ];

  const OUTLINE = "rgba(24, 5, 42, 0.95)";
  const SEGMENTS = 180;
  const SCALE = 0.65;
  const REFRESH = 1 / 30;
  const CENTER_RADIUS = 42;
  const BAND = 25;

  let cache = null;
  let cacheCtx = null;
  let lastT = -Infinity;

  const angles = new Float32Array(SEGMENTS + 1);
  const cosA = new Float32Array(SEGMENTS + 1);
  const sinA = new Float32Array(SEGMENTS + 1);
  const radii = new Float32Array(SEGMENTS + 1);

  for (let i = 0; i <= SEGMENTS; i++) {
    angles[i] = (i / SEGMENTS) * Math.PI * 2;
    cosA[i] = Math.cos(angles[i]);
    sinA[i] = Math.sin(angles[i]);
  }

  function computeRadii(base, k, t, amp, spin, mx, my) {
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = angles[i] + spin;

      const wave =
        0.46 * Math.sin(3 * a + t * 0.75 - k * 0.31) +
        0.27 * Math.sin(6 * a - t * 0.91 + k * 0.52) +
        0.17 * Math.sin(11 * a + t * 0.53 - k * 0.19) +
        0.10 * Math.sin(17 * a - t * 0.37 + k * 0.14);

      const mouseWave =
        1 + 0.12 * Math.sin(a * 2 + mx * 8) * (my - 0.5);

      radii[i] = base + amp * wave * 2.05 * mouseWave;
    }
  }

  function tracePath(ctx, cx, cy, offset = 0) {
    ctx.beginPath();

    for (let i = 0; i <= SEGMENTS; i++) {
      const r = Math.max(1, radii[i] - offset);
      const x = cx + cosA[i] * r;
      const y = cy + sinA[i] * r;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
  }

  function draw(ctx, w, h, t, mx = 0.5, my = 0.5) {
    if (!w || !h) return;

    mx = Math.max(0, Math.min(1, mx));
    my = Math.max(0, Math.min(1, my));

    const ow = Math.max(1, Math.ceil(w * SCALE));
    const oh = Math.max(1, Math.ceil(h * SCALE));

    if (!cache) {
      cache = document.createElement("canvas");
      cacheCtx = cache.getContext("2d");
    }

    if (cache.width !== ow || cache.height !== oh) {
      cache.width = ow;
      cache.height = oh;
      lastT = -Infinity;
    }

    if (t - lastT >= REFRESH || t < lastT) {
      cacheCtx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      render(cacheCtx, w, h, t, mx, my);
      lastT = t;
    }

    ctx.drawImage(cache, 0, 0, w, h);
  }

  function render(ctx, w, h, t, mx, my) {
    const cx =
      w * (0.5 + (mx - 0.5) * 0.10) +
      Math.sin(t * 0.23) * w * 0.025;

    const cy =
      h * (0.5 + (my - 0.5) * 0.10) +
      Math.cos(t * 0.19) * h * 0.025;

    const spin = t * 0.16 + (mx - 0.5) * 0.7;
    const ampScale = 0.9 + my * 0.95;
    const maxR = Math.hypot(w, h) * 0.62;
    const rings =
      Math.ceil((maxR - CENTER_RADIUS) / BAND) + 2;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Fond sombre
    ctx.fillStyle = "#160022";
    ctx.fillRect(0, 0, w, h);

    // Halo lumineux
    const halo = ctx.createRadialGradient(
      cx, cy, 0,
      cx, cy, maxR * 0.9
    );

    halo.addColorStop(0, "rgba(255, 30, 210, 0.25)");
    halo.addColorStop(0.35, "rgba(72, 0, 255, 0.16)");
    halo.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    // Anneaux psychédéliques
    for (let k = rings; k >= 1; k--) {
      const amp = Math.min(48, 9 + k * 1.35) * ampScale;

      computeRadii(
        CENTER_RADIUS + k * BAND,
        k, t, amp,
        spin + k * 0.018,
        mx, my
      );

      tracePath(ctx, cx, cy);

      const colorIndex =
        ((k + Math.floor(t * 1.6)) % PALETTE.length
          + PALETTE.length) % PALETTE.length;

      ctx.fillStyle = PALETTE[colorIndex];
      ctx.fill();

      // Contours sombres contrastés
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3.2;
      ctx.stroke();

      // Filet lumineux
      tracePath(ctx, cx, cy, BAND * 0.24);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
      ctx.lineWidth = 1.25;
      ctx.stroke();

      // Filet intérieur sombre
      tracePath(ctx, cx, cy, BAND * 0.68);
      ctx.strokeStyle = "rgba(24, 5, 42, 0.58)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // Vortex central multicolore
    for (let j = 3; j >= 1; j--) {
      computeRadii(
        CENTER_RADIUS * j * 0.28,
        j,
        t * 1.35,
        7 * ampScale,
        -spin * (j + 0.6),
        mx, my
      );

      tracePath(ctx, cx, cy);

      ctx.fillStyle =
        PALETTE[(Math.floor(t * 2) + j + 4) % PALETTE.length];

      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Soleil central
    ctx.beginPath();
    ctx.arc(
      cx, cy,
      10 + Math.sin(t * 2.3) * 2,
      0, Math.PI * 2
    );

    ctx.fillStyle = "#fff36b";
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Petites étoiles colorées
    for (let i = 0; i < 26; i++) {
      const a = i * 2.399 + t * (i % 2 ? 0.08 : -0.06);
      const r = maxR * (0.32 + 0.62 * ((i * 37 % 29) / 29));

      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const size = 1.2 + (i % 4) * 0.55;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE[i % PALETTE.length];
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  return { draw, PALETTE };
})();

if (typeof module !== "undefined") {
  module.exports = RetroBackground;
}
