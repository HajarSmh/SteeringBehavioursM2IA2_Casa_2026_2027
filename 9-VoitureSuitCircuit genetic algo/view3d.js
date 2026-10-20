// Rendu 3D maison : projection perspective sur le canvas 2D de p5 (aucune dépendance WebGL).
// Caméras : conducteur / poursuite du leader / vue aérienne / circuit entier.
const View3D = (() => {
  const NEAR = 2, MODES = ['driver', 'chase', 'aerial', 'top'];
  const NAMES = { driver: '🎥 Conducteur', chase: '🚘 Poursuite', aerial: '🛰 Vue aérienne', top: '🗺 Circuit entier' };
  const FONT = 'Orbitron, system-ui, sans-serif';
  const WORDS = ['BOUM !', 'CRASH !', 'AÏE !', 'OUPS !', 'POUF !', '💥', '🤕', 'MAMAN !', 'TCHAC !'];
  const PAL = RetroBackground.PALETTE;
  let cmode = 'top', zoom = 1, ctx, W, H, geo = null, geoKey = null, shake = 0, trailId = -1, lead = null;
  let parts = [], texts = [], trail = [];
  const cam = { x: 0, y: 0, z: 900, yaw: Math.PI / 2, pitch: -1.2, fov: 55, init: false };
  const B = {}, rowY = new Map(), shades = {};

  // ---------- API ----------
  function setCam(m) {
    cmode = m; zoom = 1;
    document.querySelectorAll('[data-cam]').forEach(b => (b.className = b.dataset.cam === m ? 'on' : ''));
  }
  const cycle = () => setCam(MODES[(MODES.indexOf(cmode) + 1) % MODES.length]);
  const zoomBy = d => (zoom = Math.min(2.5, Math.max(0.3, zoom * (d > 0 ? 1.1 : 0.9))));

  // ---------- Caméra ----------
  // Repère de rendu : z vers le haut, y inversé par rapport à la carte 2D (p5 : y vers le bas)
  function aim(t) {
    let tx, ty, tz, yaw, pitch, fov, k = 0.08;
    if (lead && (cmode === 'driver' || cmode === 'chase')) {
      const h = lead.vel.heading(), drv = cmode === 'driver', d = drv ? 3 : -75;
      tx = lead.pos.x + Math.cos(h) * d; ty = -(lead.pos.y + Math.sin(h) * d);
      tz = drv ? 6 : 34; yaw = -h; pitch = drv ? -0.07 : -0.33; fov = drv ? 80 : 68; k = drv ? 0.3 : 0.14;
    } else if (cmode === 'top') {
      // cadrage automatique : toute la piste tient dans l'écran (hauteur ET largeur)
      fov = 50; const bb = geo.bb, th = Math.tan(fov * Math.PI / 360);
      tx = bb.cx; ty = -bb.cy; yaw = Math.PI / 2; pitch = -Math.PI / 2;
      tz = Math.max(bb.h / 2 * 1.12 / th, bb.w / 2 * 1.12 / (th * W / H)) * zoom;
    } else {
      fov = 55; pitch = -0.95; yaw = Math.PI / 2 + Math.sin(t * 0.1) * 0.9;
      const bb = geo.bb, D = bb.r * 1.15 / Math.sin(fov * Math.PI / 360) * zoom; // tout le circuit visible
      tx = bb.cx - Math.cos(yaw) * Math.cos(pitch) * D; ty = -bb.cy - Math.sin(yaw) * Math.cos(pitch) * D; tz = -Math.sin(pitch) * D;
    }
    if (!cam.init) { Object.assign(cam, { x: tx, y: ty, z: tz, yaw, pitch, fov, init: true }); return; }
    const dy = Math.atan2(Math.sin(yaw - cam.yaw), Math.cos(yaw - cam.yaw));
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.z += (tz - cam.z) * k;
    cam.yaw += dy * Math.min(1, k * 1.3); cam.pitch += (pitch - cam.pitch) * k; cam.fov += (fov - cam.fov) * k;
  }

  function basis() {
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    Object.assign(B, { x: cam.x, y: cam.y, z: cam.z, fx: cy * cp, fy: sy * cp, fz: sp, rx: sy, ry: -cy,
                       ux: -cy * sp, uy: -sy * sp, uz: cp, F: (H / 2) / Math.tan(cam.fov * Math.PI / 360) });
  }

  // ---------- Projection ----------
  const cc = (x, y, z) => {
    const dx = x - B.x, dy = -y - B.y, dz = z - B.z;
    return [dx * B.rx + dy * B.ry, dx * B.ux + dy * B.uy + dz * B.uz, dx * B.fx + dy * B.fy + dz * B.fz];
  };
  function pj(x, y, z) {
    const p = cc(x, y, z);
    return p[2] < NEAR ? null : [W / 2 + p[0] / p[2] * B.F, H / 2 - p[1] / p[2] * B.F, p[2]];
  }
  function clipNear(pc) {
    const out = [];
    for (let i = 0; i < pc.length; i++) {
      const a = pc[i], b = pc[(i + 1) % pc.length], ia = a[2] > NEAR, ib = b[2] > NEAR;
      if (ia) out.push(a);
      if (ia !== ib) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), NEAR]); }
    }
    return out;
  }
  function poly(pts, fill, stroke, lw) {
    const pc = clipNear(pts.map(p => cc(p[0], p[1], p[2])));
    if (pc.length < 2) return;
    ctx.beginPath();
    pc.forEach((p, i) => { const sx = W / 2 + p[0] / p[2] * B.F, sy = H / 2 - p[1] / p[2] * B.F; i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function tag(txt, x, y, z, size, color) {
    const p = pj(x, y, z); if (!p) return;
    ctx.font = `700 ${Math.max(11, Math.min(size * B.F / p[2], 46))}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(txt, p[0], p[1]);
    ctx.fillStyle = color; ctx.fillText(txt, p[0], p[1]);
    ctx.textBaseline = 'alphabetic';
  }
  function shade(hex, k) {
    const key = hex + k; if (shades[key]) return shades[key];
    const n = parseInt(hex.slice(1), 16);
    return (shades[key] = `rgb(${(n >> 16) * k | 0},${((n >> 8) & 255) * k | 0},${(n & 255) * k | 0})`);
  }

  // ---------- Géométrie statique du circuit (recalculée à chaque nouveau circuit) ----------
  function buildGeo() {
    const n = inside.length, g = { ground: [], walls: [] };
    const P = (p, z = 0.1) => [p.x, p.y, z];
    const lp = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a = inside[i], b = outside[i], a2 = inside[j], b2 = outside[j];
      const col = i % 6 < 3 ? '#232842' : '#2b3252';
      g.ground.push({ p: [P(a), P(b), P(b2), P(a2)], f: col, s: col });
      const k = i % 2 ? '#ff2d55' : '#f4f4f4';
      const ia = lp(a, b, 0.09), ia2 = lp(a2, b2, 0.09), ob = lp(a, b, 0.91), ob2 = lp(a2, b2, 0.91);
      g.ground.push({ p: [P(a, .2), P(ia, .2), P(ia2, .2), P(a2, .2)], f: k });
      g.ground.push({ p: [P(b, .2), P(ob, .2), P(ob2, .2), P(b2, .2)], f: k });
      if (i % 2 === 0) g.ground.push({ p: [P(lp(a, b, .5), .3), P(lp(a2, b2, .5), .3)], s: 'rgba(255,255,255,.55)', lw: 2 });
      g.walls.push({ a, b: a2, c: '#00f5ff', mx: (a.x + a2.x) / 2, my: (a.y + a2.y) / 2 });
      g.walls.push({ a: b, b: b2, c: '#ff00cc', mx: (b.x + b2.x) / 2, my: (b.y + b2.y) / 2 });
    }
    // ligne de départ en damier
    const a = inside[0], b = outside[0], a1 = inside[1], b1 = outside[1];
    const Q = (u, v) => { const s = lp(a, b, u), e = lp(a1, b1, u); return [s.x + (e.x - s.x) * v, s.y + (e.y - s.y) * v, .35]; };
    for (let c = 0; c < 8; c++) for (let r = 0; r < 2; r++) {
      const u0 = c / 8, u1 = (c + 1) / 8, v0 = r * .07, v1 = (r + 1) * .07;
      g.ground.push({ p: [Q(u0, v0), Q(u1, v0), Q(u1, v1), Q(u0, v1)], f: (c + r) % 2 ? '#fff' : '#111' });
    }
    const xs = inside.concat(outside).map(p => p.x), ys = inside.concat(outside).map(p => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    g.bb = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, r: Math.hypot(x1 - x0, y1 - y0) / 2 };
    return g;
  }

  function grid(t) {
    const a = 0.28 + 0.1 * Math.sin(t * 2);
    poly([[-9000, -9000, 0], [WW + 9000, -9000, 0], [WW + 9000, WH + 9000, 0], [-9000, WH + 9000, 0]], '#06030f');
    for (let x = -1800; x <= WW + 1800; x += 200)
      poly([[x, -1800, 0], [x, WH + 1800, 0]], null, x % 800 === 0 ? `rgba(0,245,255,${a + .15})` : `rgba(138,43,255,${a})`, 1.5);
    for (let y = -1800; y <= WH + 1800; y += 200)
      poly([[-1800, y, 0], [WW + 1800, y, 0]], null, y % 800 === 0 ? `rgba(0,245,255,${a + .15})` : `rgba(138,43,255,${a})`, 1.5);
  }

  function wall(w) {
    poly([[w.a.x, w.a.y, 0], [w.b.x, w.b.y, 0], [w.b.x, w.b.y, 9], [w.a.x, w.a.y, 9]], 'rgba(20,12,48,.93)');
    poly([[w.a.x, w.a.y, 9], [w.b.x, w.b.y, 9]], null, w.c, 2.5);
  }

  function gantry() {
    const a = inside[0], b = outside[0], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    const A = [a.x - dx / l * 10, a.y - dy / l * 10], E = [b.x + dx / l * 10, b.y + dy / l * 10];
    poly([[A[0], A[1], 0], [A[0], A[1], 42]], null, '#00f5ff', 5);
    poly([[E[0], E[1], 0], [E[0], E[1], 42]], null, '#00f5ff', 5);
    poly([[A[0], A[1], 34], [E[0], E[1], 34], [E[0], E[1], 44], [A[0], A[1], 44]], 'rgba(255,0,204,.88)', '#fff', 1.5);
    tag('DÉPART', (A[0] + E[0]) / 2, (A[1] + E[1]) / 2, 39, 7, '#fff');
  }

  // ---------- Voitures ----------
  function box(x, y, c, s, a0, a1, b0, b1, z0, z1, cols) {
    const P = (a, b, z) => [x + c * a - s * b, y + s * a + c * b, z];
    const cx = B.x, cy = -B.y, cz = B.z;
    const face = (n, pts, col) => {
      if (n[0] * (cx - pts[0][0]) + n[1] * (cy - pts[0][1]) + n[2] * (cz - pts[0][2]) > 0) poly(pts, col);
    };
    face([c, s, 0], [P(a1, b0, z0), P(a1, b1, z0), P(a1, b1, z1), P(a1, b0, z1)], cols[0]);
    face([-c, -s, 0], [P(a0, b1, z0), P(a0, b0, z0), P(a0, b0, z1), P(a0, b1, z1)], cols[1]);
    face([-s, c, 0], [P(a1, b1, z0), P(a0, b1, z0), P(a0, b1, z1), P(a1, b1, z1)], cols[2]);
    face([s, -c, 0], [P(a0, b0, z0), P(a1, b0, z0), P(a1, b0, z1), P(a0, b0, z1)], cols[3]);
    face([0, 0, 1], [P(a1, b0, z1), P(a1, b1, z1), P(a0, b1, z1), P(a0, b0, z1)], cols[4]);
  }

  function car(v) {
    const x = v.pos.x, y = v.pos.y, h = v.vel.heading(), c = Math.cos(h), s = Math.sin(h), col = v.team.color;
    const P = (a, b, z) => [x + c * a - s * b, y + s * a + c * b, z];
    poly([P(10, -6, .3), P(10, 6, .3), P(-10, 6, .3), P(-10, -6, .3)], 'rgba(0,0,0,.5)');
    box(x, y, c, s, -8, 8, -4.2, 4.2, 1, 4.5, [shade(col, .95), shade(col, .5), shade(col, .72), shade(col, .72), col]);
    box(x, y, c, s, -4.5, 3, -3, 3, 4.5, 7.5, ['#16224d', '#0b1233', '#101a3d', '#101a3d', shade(col, .85)]);
    const q = pj(x, y, 4);
    if (!q) return;
    const sc = B.F / q[2], front = (B.x - x) * c + (-B.y - y) * s > 0;
    if (sc * 16 < 7) { // loin : pastille lumineuse pour rester visible
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA(col, .55);
      ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, 6.283); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
      return;
    }
    if (front && sc * 1.6 > 2) { // yeux rigolos : les pupilles regardent dans le sens du virage
      const steer = v.out ? (v.out[0] - 0.5) * 2 : 0;
      for (const side of [-1.6, 1.6]) {
        const e = pj(...P(3.2, side, 6.3)), p = pj(...P(3.3, side - s * 0 + steer * 0.7, 6.3));
        if (!e || !p) continue;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e[0], e[1], 1.7 * sc, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(p[0], p[1], 0.8 * sc, 0, 6.283); ctx.fill();
      }
    }
    if (front) { // phares
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,200,.9)';
      for (const side of [-3, 3]) { const l = pj(...P(8, side, 3)); if (l) { ctx.beginPath(); ctx.arc(l[0], l[1], Math.max(1, sc * 1.1), 0, 6.283); ctx.fill(); } }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function cone(v) {
    const h = v.vel.heading(), half = radians(FOV) / 2, pts = [[v.pos.x, v.pos.y, .4]];
    for (let i = 0; i <= 10; i++) {
      const a = h - half + i * 2 * half / 10, d = rayDist(v.pos.x, v.pos.y, Math.cos(a), Math.sin(a), walls, v.sight);
      pts.push([v.pos.x + Math.cos(a) * d, v.pos.y + Math.sin(a) * d, .4]);
    }
    poly(pts, hexA(v.team.color, .2));
  }

  // ---------- Debug : preuve visuelle des steering behaviours ----------
  function arrow(x1, y1, x2, y2, c, lw) {
    const len = Math.hypot(x2 - x1, y2 - y1); if (len < 1) return;
    const a = Math.atan2(y2 - y1, x2 - x1), hl = Math.min(7, len * .45);
    poly([[x1, y1, 5], [x2, y2, 5]], null, c, lw);
    for (const s of [-.5, .5]) poly([[x2, y2, 5], [x2 - Math.cos(a + s) * hl, y2 - Math.sin(a + s) * hl, 5]], null, c, lw);
  }
  function dot(x, y, rad, c) { // petit disque (points au bout des vecteurs ahead)
    const pts = []; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832; pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad, 5]); }
    poly(pts, c, null, 0);
  }
  function perception(v, isLead) { // petit cercle blanc (corps) + grand cercle pointillé cyan (portée des capteurs)
    const pts = [];
    for (let i = 0; i < 20; i++) { const a = i / 20 * 6.2832; pts.push([v.pos.x + Math.cos(a) * 7, v.pos.y + Math.sin(a) * 7, .6]); }
    poly(pts, null, 'rgba(255,255,255,.9)', isLead ? 2 : 1);
    const big = [];
    for (let i = 0; i <= 40; i++) { const a = i / 40 * 6.2832; big.push([v.pos.x + Math.cos(a) * v.sight, v.pos.y + Math.sin(a) * v.sight, .6]); }
    ctx.save(); ctx.setLineDash([7, 6]);
    poly(big, null, isLead ? 'rgba(0,229,255,.95)' : 'rgba(0,229,255,.55)', isLead ? 2 : 1);
    ctx.restore();
  }
  function dot(x, y, rad, c) { // point au bout des vecteurs
    const pts = []; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832; pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad, 5]); }
    poly(pts, c, null, 0);
  }
  function behaviour(v, isLead) { // comme DebugMode des dragons : ligne jaune ahead, point bleu (milieu), point rouge (bout), nom + vitesse
    const x = v.pos.x, y = v.pos.y, vx = v.vel.x, vy = v.vel.y, k = isLead ? 1.4 : 1;
    if (Math.hypot(vx, vy) > 0.01) {
      const ax = x + vx * 30, ay = y + vy * 30, bx = x + vx * 15, by = y + vy * 15;
      arrow(x, y, ax, ay, 'yellow', 2.5 * k);
      dot(bx, by, 3.5 * k, '#9fe8ff');
      dot(ax, ay, 3.5 * k, 'red');
    }
    tag('Voiture ' + v.vel.mag().toFixed(1), x, y, 14, 6, isLead ? '#ffd54a' : '#fff');
  }
  function debugLegend() {
    ctx.save(); ctx.textAlign = 'left'; ctx.font = '600 15px system-ui'; ctx.fillStyle = '#ffd400';
    ctx.fillText('DEBUG — ' + population.length + ' véhicules (D pour quitter)', 14, 62);
    ctx.restore();
  }

  // ---------- Effets rigolos ----------
  function crash(v) {
    Sound.crash(v === lead ? 1 : 0.35);
    if (parts.length > 600) return;
    const cols = ['#ffb300', '#ff4d00', '#fff', '#ff00cc'];
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * 6.283, sp = 1 + Math.random() * 3;
      parts.push({ x: v.pos.x, y: v.pos.y, z: 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 1 + Math.random() * 3,
                   g: .25, life: 30 + Math.random() * 25, s: 1.2 + Math.random() * 1.6, c: cols[i % 4] });
    }
    if (v === lead) shake = 12;
    if (v === lead || (v.score > 2 && Math.random() < .3))
      texts.push({ x: v.pos.x, y: v.pos.y, z: 8, life: 60, t: WORDS[Math.floor(Math.random() * WORDS.length)] });
  }
  function confetti(v) {
    Sound.win();
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * 6.283, sp = Math.random() * 2.5;
      parts.push({ x: v.pos.x, y: v.pos.y, z: 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 3 + Math.random() * 5,
                   g: .15, life: 140, s: 1.5 + Math.random() * 1.5, c: PAL[i % PAL.length] });
    }
    texts.push({ x: v.pos.x, y: v.pos.y, z: 10, life: 120, t: '🏁 ARRIVÉE !' });
  }

  // ---------- HUD ----------
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function panel(x, y, w, h) {
    rr(x, y, w, h, 12); ctx.fillStyle = 'rgba(8,6,24,.74)';
    ctx.shadowColor = '#8a2bff'; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,245,255,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  const label = v => v.team.name + (mode === 'evo' ? ' #' + (v.id % 1000) : '');
  const laps = v => (v.score / checkpoints.length).toFixed(2);

  function board(rows) {
    const n = Math.min(rows.length, 8); if (!n) return;
    const w = 262, x = W - w - 14, y = 14;
    panel(x, y, w, 46 + n * 28);
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `700 13px ${FONT}`;
    ctx.fillText(mode === 'evo' ? '🏆 TOP 8 EN VIE' : '🏁 CLASSEMENT LIVE', x + 14, y + 26);
    const seen = new Map();
    rows.slice(0, 8).forEach((r, i) => {
      const v = r.v, ty = y + 40 + i * 28;
      const cy = (rowY.has(v) ? rowY.get(v) : ty); const ny = cy + (ty - cy) * .25; seen.set(v, ny);
      ctx.globalAlpha = v.dead ? .45 : 1;
      if (i === 0) { rr(x + 6, ny - 3, w - 12, 26, 8); ctx.fillStyle = 'rgba(255,200,0,.22)'; ctx.fill(); }
      ctx.font = `700 13px ${FONT}`; ctx.fillStyle = ['#ffd54a', '#d7dbe6', '#e0956b'][i] || '#8a93a6';
      ctx.fillText(i + 1, x + 14, ny + 15);
      ctx.fillStyle = v.team.color; ctx.beginPath(); ctx.arc(x + 44, ny + 10, 6, 0, 6.283); ctx.fill();
      ctx.font = '600 12px system-ui'; ctx.fillStyle = '#e8ecf7'; ctx.fillText(label(v).slice(0, 17), x + 58, ny + 14);
      ctx.textAlign = 'right'; ctx.fillStyle = '#9fb0ff';
      ctx.fillText(v.finished ? '🏁 ' + ((v.finishTick || 0) / 60).toFixed(1) + ' s' : (v.dead ? '💀 ' : '') + laps(v) + ' T', x + w - 14, ny + 14);
      ctx.textAlign = 'left';
    });
    ctx.globalAlpha = 1; rowY.clear(); seen.forEach((yy, v) => rowY.set(v, yy));
  }

  function mini(all) {
    const w = 230, h = w * WH / WW, x = 14, y = H - h - 14, s = w / WW;
    panel(x, y, w, h);
    const path = L => { ctx.beginPath(); L.forEach((p, i) => (i ? ctx.lineTo(x + p.x * s, y + p.y * s) : ctx.moveTo(x + p.x * s, y + p.y * s))); ctx.closePath(); };
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,245,255,.8)'; path(inside); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,0,204,.8)'; path(outside); ctx.stroke();
    for (const v of all) {
      if (v.dead) continue;
      ctx.fillStyle = v === lead ? '#ffd54a' : v.team.color;
      ctx.beginPath(); ctx.arc(x + v.pos.x * s, y + v.pos.y * s, v === lead ? 4.5 : 2.2, 0, 6.283); ctx.fill();
    }
  }

  function hud(rows) {
    panel(14, 14, 330, 34);
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `700 12px ${FONT}`;
    ctx.fillText(`GÉN ${generationCount} · ${population.length} EN VIE · ${NAMES[cmode]}`, 28, 36);
    board(rows); mini(rows.map(r => r.v));
    if (lead && (cmode === 'driver' || cmode === 'chase')) {
      const kmh = Math.round(lead.vel.mag() * 28), r = Math.min(1, lead.vel.mag() / (lead.maxspeed || 5));
      const w = 270, x = (W - w) / 2, y = H - 74;
      panel(x, y, w, 60);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffd54a'; ctx.font = `700 12px ${FONT}`;
      ctx.fillText('👑 ' + label(lead).slice(0, 22), W / 2, y + 20);
      ctx.fillStyle = '#fff'; ctx.font = `700 20px ${FONT}`; ctx.fillText(kmh + ' km/h', W / 2 - 40, y + 46);
      ctx.font = `600 12px ${FONT}`; ctx.fillText(laps(lead) + ' / ' + LAPS + ' T', W / 2 + 70, y + 44);
      rr(x + 14, y + 52, (w - 28) * r, 4, 2); ctx.fillStyle = `hsl(${120 - 120 * r},100%,55%)`; ctx.fill();
    }
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(200,210,255,.6)'; ctx.font = '11px system-ui';
    ctx.fillText('1 🎥  2 🚘  3 🛰  4 🗺  ·  C : caméra  ·  M : son  ·  molette : zoom  ·  Espace : pause', W - 14, H - 14);
  }

  function screenFx() {
    if ((cmode === 'driver' || cmode === 'chase') && lead) {
      const r = Math.min(1, lead.vel.mag() / (lead.maxspeed || 5));
      if (r > .5) { // lignes de vitesse
        ctx.strokeStyle = `rgba(255,255,255,${.2 * r})`; ctx.lineWidth = 1.5;
        for (let i = 0; i < 28; i++) {
          const a = Math.random() * 6.283, r0 = H * (.42 + Math.random() * .1), r1 = r0 + H * (.08 + .18 * r * Math.random());
          ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r0 * 1.3, H / 2 + Math.sin(a) * r0);
          ctx.lineTo(W / 2 + Math.cos(a) * r1 * 1.3, H / 2 + Math.sin(a) * r1); ctx.stroke();
        }
      }
    }
    const g = ctx.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * .95);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ---------- Image complète ----------
  function prog(v) {
    const n = checkpoints.length, g = checkpoints[v.index], p = checkpoints[(v.index + n - 1) % n];
    const gx = (g.a.x + g.b.x) / 2, gy = (g.a.y + g.b.y) / 2, px = (p.a.x + p.b.x) / 2, py = (p.a.y + p.b.y) / 2;
    return v.score + 1 - Math.min(1, Math.hypot(v.pos.x - gx, v.pos.y - gy) / (Math.hypot(gx - px, gy - py) || 1));
  }

  function frame(c, w, h, t) {
    ctx = c; W = w; H = h;
    if (geoKey !== inside) { geo = buildGeo(); geoKey = inside; trail = []; }
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const all = mode === 'evo' ? population : population.concat(savedVehicles);
    const rows = all.map(v => ({ v, k: v.finished ? 1e6 - (v.finishTick || 0) : prog(v) })).sort((a, b) => b.k - a.k);
    lead = null; let lk = -1;
    for (const v of population) { const p = prog(v); if (p > lk) { lk = p; lead = v; } }

    aim(t); basis();
    if (shake > .3) { B.x += (Math.random() - .5) * shake; B.y += (Math.random() - .5) * shake; B.z += (Math.random() - .5) * shake; }
    shake *= .88;

    RetroBackground.draw(ctx, W, H, t, mouseX / W, mouseY / H);
    for (const g of geo.ground) poly(g.p, g.f, g.s, g.lw || 1);
    if (showCps) checkpoints.forEach(k => poly([[k.a.x, k.a.y, .5], [k.b.x, k.b.y, .5]], null, 'rgba(60,120,255,.6)', 1));

    if (lead) { // traînée arc-en-ciel du leader
      if (lead.id !== trailId) { trail = []; trailId = lead.id; }
      const l = trail[trail.length - 1];
      if (!l || Math.hypot(l.x - lead.pos.x, l.y - lead.pos.y) > 1.5) trail.push({ x: lead.pos.x, y: lead.pos.y });
      if (trail.length > 45) trail.shift();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < trail.length; i++)
      poly([[trail[i - 1].x, trail[i - 1].y, 2], [trail[i].x, trail[i].y, 2]], null, `hsl(${(i * 9 + t * 160) % 360},100%,60%)`, 2 + i * .12);
    if (showLights) rows.filter(r => !r.v.dead && !r.v.finished).slice(0, 10).forEach(r => cone(r.v));
    if (lead && showRays) lead.rays.forEach((r, i) => {
      const d = lead.dists[i] || lead.sight;
      poly([[lead.pos.x, lead.pos.y, 3], [lead.pos.x + r.dir.x * d, lead.pos.y + r.dir.y * d, 3]], null, 'rgba(0,255,120,.75)', 1.5);
    });
    ctx.globalCompositeOperation = 'source-over';

    if (debug) for (const v of population) perception(v, v === lead);
    const items = [];
    for (const wl of geo.walls) { const d = cc(wl.mx, wl.my, 4)[2]; if (d > -30 && d < 9000) items.push({ d, wl }); }
    for (const v of population) { const d = cc(v.pos.x, v.pos.y, 3)[2]; if (d > 1 && !(v === lead && cmode === 'driver')) items.push({ d, v }); }
    items.push({ d: cc(inside[0].x, inside[0].y, 20)[2], g: 1 });
    items.sort((a, b) => b.d - a.d);
    for (const it of items) it.wl ? wall(it.wl) : it.v ? car(it.v) : gantry();

    if (debug) for (const v of population) behaviour(v, v === lead);

    // couronne et rangs au-dessus des 3 premiers
    rows.filter(r => !r.v.dead && !r.v.finished).slice(0, 3).forEach((r, i) => {
      if (r.v === lead && cmode === 'driver') return;
      const bob = Math.sin(t * 5 + i) * 1.5;
      tag(i === 0 ? '👑' : String(i + 1), r.v.pos.x, r.v.pos.y, 16 + bob, i === 0 ? 9 : 6, i === 0 ? '#ffd54a' : '#d7dbe6');
    });

    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      if (!paused) { p.x += p.vx; p.y += p.vy; p.z += p.vz; p.vz -= p.g; if (p.z < .5) { p.z = .5; p.vz *= -.5; p.vx *= .8; p.vy *= .8; } p.life--; }
      const q = pj(p.x, p.y, p.z); if (!q) continue;
      ctx.globalAlpha = Math.min(1, p.life / 20); ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(1.2, p.s * B.F / q[2]), 0, 6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    parts = parts.filter(p => p.life > 0);
    for (const tx of texts) {
      if (!paused) { tx.life--; tx.z += .5; }
      ctx.globalAlpha = Math.min(1, tx.life / 20); tag(tx.t, tx.x, tx.y, tx.z, 9, '#ffdd55');
    }
    ctx.globalAlpha = 1; texts = texts.filter(x => x.life > 0);

    screenFx(); hud(rows);
    if (debug) debugLegend();
    ctx.restore();
    return lead;
  }

  return { frame, setCam, cycle, zoomBy, crash, confetti };
})();