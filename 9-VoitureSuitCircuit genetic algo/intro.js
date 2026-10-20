// Page d'introduction : présente le jeu avant de commencer (même style néon que le reste).
// Le fond réutilise RetroBackground ; la simulation reste en pause tant qu'on n'a pas cliqué sur « Commencer ».
(() => {
  const css = `
  #intro{position:fixed;inset:0;z-index:1000;overflow:auto;color:var(--tx);font:clamp(11px,1.65vh,14px) 'Inter',system-ui,sans-serif;transition:opacity .6s,transform .6s}
  #intro.out{opacity:0;transform:scale(1.04);pointer-events:none}
  #introBg{position:fixed;inset:0;width:100%;height:100%;z-index:-1}
  /* tout tient dans la hauteur de la fenêtre : espacements et tailles pilotés par vh */
  #introWrap{max-width:1020px;min-height:100%;margin:0 auto;padding:2.2vh 20px;text-align:center;display:flex;flex-direction:column;justify-content:space-evenly;gap:1.4vh}
  #intro .kick{align-self:center;padding:.4em 1.2em;border-radius:20px;font-size:.85em;letter-spacing:.2em;text-transform:uppercase;color:var(--cy);background:rgba(0,245,255,.1);border:1px solid rgba(0,245,255,.3)}
  #intro h1{margin:0;font-size:clamp(34px,9vh,84px);line-height:1;letter-spacing:.06em;text-transform:uppercase;font-weight:900;
    background:linear-gradient(90deg,#00f5ff,#8a2bff 45%,#ff00cc,#ff8a30);-webkit-background-clip:text;background-clip:text;color:transparent;
    filter:drop-shadow(0 0 22px rgba(138,43,255,.55));animation:ititle 6s ease-in-out infinite}
  @keyframes ititle{50%{filter:drop-shadow(0 0 34px rgba(255,0,204,.7))}}
  #intro .lead{max-width:700px;margin:0 auto;font-size:1.15em;line-height:1.45;color:#dfe4fb}
  #intro .glass{background:rgba(12,10,30,.72);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
  #intro .flow{display:flex;gap:8px;align-items:stretch;justify-content:center;padding:1.2vh 12px}
  #intro .step{flex:1;min-width:0;padding:.8vh 12px;border-radius:12px;background:rgba(255,255,255,.05);text-align:left}
  #intro .step b{display:block;margin-bottom:.2em;color:#fff}
  #intro .step small{font-size:.92em;color:var(--mu);line-height:1.35}
  #intro .arrow{align-self:center;font-size:1.6em;color:var(--mg);text-shadow:0 0 12px var(--mg)}
  #intro .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  #intro .mode{cursor:pointer;padding:1.6vh 16px;text-align:left;transition:.2s}
  #intro .mode:hover,#intro .mode:focus{outline:0;transform:translateY(-3px);border-color:rgba(0,245,255,.5);box-shadow:0 0 30px rgba(0,245,255,.25)}
  #intro .mode .ic{font-size:2.2em;line-height:1}
  #intro .mode h3{margin:.5em 0 .35em;font-size:1em;text-transform:uppercase;letter-spacing:.1em;color:var(--cy)}
  #intro .mode p{margin:0;color:#cfd6f5;line-height:1.4}
  #intro .play{display:inline-block;margin-top:.6em;font-weight:700;color:var(--cy)}
  #intro .keys{padding:1.1vh 14px;display:flex;flex-wrap:wrap;gap:.5em 1.6em;justify-content:center;color:#cfd6f5}
  #intro kbd{display:inline-block;min-width:1.7em;padding:0 .5em;margin-right:.35em;border-radius:6px;font:inherit;font-weight:700;text-align:center;color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);box-shadow:0 2px 0 rgba(255,255,255,.15)}
  #introGo{align-self:center;font-size:1.5em;font-weight:800;letter-spacing:.08em;padding:.55em 2.2em;border:0;border-radius:40px;background:linear-gradient(135deg,#00c8ff,#7a2bff 55%,#ff00cc);
    box-shadow:0 0 30px rgba(0,200,255,.55),0 0 60px rgba(255,0,204,.3);animation:ipulse 2.2s ease-in-out infinite}
  #introGo:hover{transform:scale(1.06);background:linear-gradient(135deg,#20d8ff,#9a4bff 55%,#ff30dc)}
  @keyframes ipulse{50%{box-shadow:0 0 44px rgba(0,200,255,.8),0 0 90px rgba(255,0,204,.5)}}
  #intro .hint{font-size:.85em;color:var(--mu)}
  /* écrans bas : on retire le détail des étapes ; écrans étroits : cartes en colonne */
  @media (max-height:640px){#intro .step small,#intro .lead{display:none}}
  @media (max-width:760px){#intro .grid{grid-template-columns:1fr}#intro .flow{flex-wrap:wrap}#intro .arrow{display:none}#intro .step{min-width:44%}}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const root = document.createElement('div');
  root.id = 'intro';
  root.innerHTML = `
  <canvas id="introBg"></canvas>
  <div id="introWrap">
    <span class="kick">Intelligence artificielle · Algorithme génétique</span>
    <h1>NeuroRace</h1>
    <p class="lead">Des voitures qui n'ont jamais conduit apprennent <b>toutes seules</b> à boucler un circuit : elles essaient, se crashent, et les meilleures transmettent leur cerveau à la génération suivante.</p>

    <div class="glass flow">
      <div class="step"><b>👁 1 · Voir</b><small>Chaque voiture lance des rayons (capteurs) pour mesurer la distance aux murs.</small></div><div class="arrow">➜</div>
      <div class="step"><b>🧠 2 · Décider</b><small>Un réseau de neurones transforme ces distances en direction du volant et en vitesse.</small></div><div class="arrow">➜</div>
      <div class="step"><b>🏁 3 · Progresser</b><small>Chaque checkpoint franchi augmente le score ; un mur touché ou trop d'attente et c'est le crash.</small></div><div class="arrow">➜</div>
      <div class="step"><b>🧬 4 · Évoluer</b><small>Les meilleurs cerveaux se reproduisent avec de petites mutations : la génération suivante conduit mieux.</small></div>
    </div>

    <div class="grid">
      <div class="glass mode" data-mode="evo" role="button" tabindex="0"><div class="ic">🧬</div><h3>Évolution</h3><p>100 voitures apprennent en direct. Observe les générations s'améliorer, change le nombre de capteurs, de couches ou de neurones, ou laisse 5 espèces d'architectures se battre entre elles.</p><span class="play">Jouer →</span></div>
      <div class="glass mode" data-mode="race" role="button" tabindex="0"><div class="ic">🏁</div><h3>Course</h3><p>Compose jusqu'à 6 équipes, entraîne-les quelques générations puis lance une vraie course sur plusieurs tours : la meilleure intelligence gagne.</p><span class="play">Jouer →</span></div>
      <div class="glass mode" data-mode="champ" role="button" tabindex="0"><div class="ic">🏆</div><h3>Champions</h3><p>Le meilleur cerveau de chaque génération est sauvegardé dans le panthéon. Sélectionne tes favoris et fais-les s'affronter.</p><span class="play">Jouer →</span></div>
    </div>

    <div class="glass keys">
      <span><kbd>Espace</kbd>Pause</span><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd>Caméras</span><span><kbd>C</kbd>Changer de caméra</span>
      <span><kbd>Molette</kbd>Zoom</span><span><kbd>D</kbd>Debug</span><span><kbd>M</kbd>Son</span>
    </div>

    <button id="introGo">▶ COMMENCER</button>
    <div class="hint">ou appuie sur Entrée · le son s'active au démarrage</div>
  </div>`;
  document.body.appendChild(root);

  // fond animé (RetroBackground)
  const cv = root.querySelector('#introBg'), cx = cv.getContext('2d');
  let mx = .5, my = .5, raf = 0;
  const size = () => { cv.width = innerWidth; cv.height = innerHeight; };
  addEventListener('resize', size); size();
  root.addEventListener('pointermove', e => { mx = e.clientX / innerWidth; my = e.clientY / innerHeight; });
  (function loop(ms) { RetroBackground.draw(cx, cv.width, cv.height, ms / 1000, mx, my); raf = requestAnimationFrame(loop); })(0);

  // la simulation attend derrière la page d'intro
  let open = true;
  const hold = setInterval(() => {
    if (!open) return clearInterval(hold);
    try { if (walls.length) { setPaused(true); clearInterval(hold); } } catch (e) {}
  }, 40);

  function go(m) {
    if (!open) return;
    open = false; clearInterval(hold);
    try { Sound.start(); } catch (e) {}
    try { setPaused(false); if (m && m !== mode) setMode(m); } catch (e) {}
    root.classList.add('out');
    setTimeout(() => { cancelAnimationFrame(raf); root.remove(); }, 650);
  }
  root.querySelector('#introGo').onclick = () => go();
  root.querySelectorAll('.mode').forEach(c => {
    c.onclick = () => go(c.dataset.mode);
  });
  // tant que l'intro est ouverte, les raccourcis du jeu (Espace…) sont bloqués
  addEventListener('keydown', e => {
    if (!open) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.code === 'Enter' || e.code === 'Space') go(e.target.dataset && e.target.dataset.mode);
  }, true);
})();