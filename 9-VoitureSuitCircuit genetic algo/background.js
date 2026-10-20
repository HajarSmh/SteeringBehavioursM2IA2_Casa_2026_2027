
/**
 * RetroBackground — Psychedelic Neon Flow
 * Fond psychédélique fluide : bleu nuit, cyan, violet,
 * magenta et reflets arc-en-ciel.
 *
 * Compatible avec l'API existante :
 * RetroBackground.draw(ctx, w, h, t, mx, my)
 */

const RetroBackground = (() => {
  const PALETTE = [
    "#00F5FF",
    "#286BFF",
    "#7928FF",
    "#FF00C8",
    "#00FFC6",
    "#FF8A30"
  ];

  const RW = 320;
  const REFRESH = 1 / 24;
  const TAU = Math.PI * 2;

  let cache = null;
  let cctx = null;
  let img = null;
  let cw = 0;
  let ch = 0;
  let lastT = -Infinity;

  function build(w, h) {
    if (!cache) {
      cache = document.createElement("canvas");
      cctx = cache.getContext("2d", { alpha: false });
    }

    cw = RW;
    ch = Math.max(2, Math.round(RW * h / w));

    cache.width = cw;
    cache.height = ch;

    img = cctx.createImageData(cw, ch);
    lastT = -Infinity;
  }

  // Mélange progressif entre deux couleurs.
  function mix(a, b, amount) {
    return a + (b - a) * amount;
  }

  function render(t, mx, my) {
    const data = img.data;

    const lightX = (mx - 0.5) * 0.8;
    const lightY = (my - 0.5) * 0.8;

    for (let y = 0; y < ch; y++) {
      const v = (y / ch - 0.5) * 8;

      for (let x = 0; x < cw; x++) {
        const u = (x / cw - 0.5) * 12;

        // Déformation organique des rubans lumineux.
        const warp =
          Math.sin(u * 0.85 + t * 0.12) * 0.9 +
          Math.sin(u * 0.42 - v * 0.7 - t * 0.09) * 0.7 +
          Math.sin(v * 0.55 + t * 0.08) * 0.45;

        const phase =
          v * 1.55 +
          warp +
          Math.sin(u * 0.7 + v * 0.35 + t * 0.08) * 0.55;

        // Rubans principaux : cœur lumineux et halo diffus.
        const wave = Math.cos(phase);
        const core = Math.pow(Math.max(0, wave), 12);
        const glow = Math.pow(Math.max(0, wave), 2.2);

        // Deuxième couche, plus discrète, pour la profondeur.
        const phase2 =
          v * 1.15 -
          u * 0.65 +
          Math.sin(u * 0.8 + t * 0.1) * 1.2 +
          Math.sin(v * 0.6 - t * 0.07);

        const wave2 = Math.cos(phase2);
        const glow2 = Math.pow(Math.max(0, wave2), 4);

        // Couleurs animées : bleu, cyan, violet et magenta.
        const hue = Math.sin(phase * 0.38 + u * 0.22);
        const rainbow = Math.sin(phase * 0.32 + v * 0.2);

        let r = 2;
        let g = 5;
        let b = 19;

        // Halo bleu profond.
        b += glow * 28;
        g += glow * 9;

        // Rubans cyan.
        const cyan = Math.max(0, Math.sin(hue * 2.0 + 0.7));
        r += glow * cyan * 18;
        g += glow * cyan * 100;
        b += glow * cyan * 145;

        // Rubans violets et magenta.
        const purple = Math.max(0, Math.cos(hue * 2.0));
        r += glow * purple * 100;
        g += glow * purple * 12;
        b += glow * purple * 170;

        const magenta = Math.max(0, rainbow);
        r += glow * magenta * 90;
        g += glow * magenta * 5;
        b += glow * magenta * 55;

        // Profondeur : seconde famille de flux.
        r += glow2 * 24;
        g += glow2 * 17;
        b += glow2 * 75;

        // Liseré néon très fin.
        r += core * (90 + 90 * magenta);
        g += core * (100 + 110 * cyan);
        b += core * 130;

        // Influence subtile de la souris sur l'éclairage.
        const dx = (x / cw - 0.5) - lightX;
        const dy = (y / ch - 0.5) - lightY;
        const light = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 1.8);

        r += light * glow * 9;
        g += light * glow * 12;
        b += light * glow * 22;

        // Petites particules fixes, déterministes.
        const hash = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        const star = hash - Math.floor(hash);

        if (star > 0.9975) {
          r += 25;
          g += 45;
          b += 75;
        }

        // Vignettage léger intégré au rendu.
        const nx = (x / cw - 0.5) * 2;
        const ny = (y / ch - 0.5) * 2;
        const vignette = Math.max(
          0.48,
          1 - (nx * nx + ny * ny) * 0.17
        );

        const i = (y * cw + x) * 4;

        data[i] = Math.min(255, r * vignette);
        data[i + 1] = Math.min(255, g * vignette);
        data[i + 2] = Math.min(255, b * vignette);
        data[i + 3] = 255;
      }
    }

    cctx.putImageData(img, 0, 0);
  }

  function draw(ctx, w, h, t, mx = 0.5, my = 0.5) {
    if (!ctx || !w || !h) return;

    t = Number.isFinite(t) ? t : 0;
    mx = Math.max(0, Math.min(1, mx));
    my = Math.max(0, Math.min(1, my));

    if (
      !cache ||
      ch !== Math.max(2, Math.round(RW * h / w))
    ) {
      build(w, h);
    }

    if (t - lastT >= REFRESH || t < lastT) {
      render(t, mx, my);
      lastT = t;
    }

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(cache, 0, 0, w, h);
    ctx.restore();
  }

  return { draw, PALETTE };
})();

if (typeof module !== "undefined") {
  module.exports = RetroBackground;
}
