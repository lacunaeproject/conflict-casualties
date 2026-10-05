/* =========================================================
   Story mode engine (story.html, story-iraq.html).
   - Each .scene gets --p, its progress 0→1 while its stage is pinned,
     and --in, its dissolve over the scene before it. The scene below
     gets --out, so its words clear before the images cross.
   - Each .beat with data-beat="from,to" gets --o (visibility) and
     --t (progress through its range). A range ending past 1 holds.
   - Scenes and the closing section with data-chapter form the
     navigation: a rail on wide screens, a bar on phones, ← → keys.
   - Gaza: figures are read from data.json. The dot field draws one
     dot per ten people, all at once; beats recolour a group.
   - Iraq: the yearly bars are all drawn at once; beats light an era.
   Nothing accumulates and no number counts.
   Reduced motion: no engine; CSS stacks the scenes as still frames.
   ========================================================= */
(function () {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const story = document.body.dataset.story;
  const fmt = n => Number(n).toLocaleString('en-US');
  const fmtDate = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  if (!reduce) root.classList.add('st-js');

  // ---------- Gaza data ----------
  let counts = { killed: 73928, children: 20179, women: 12500 };
  if (story === 'gaza') {
    fetch('data.json', { cache: 'no-cache' }).then(r => r.json()).then(D => {
      const g = D.summary.gaza, named = D.summary.known_killed_in_gaza;
      const namedTotal = ['male', 'female'].reduce((s, k) => s + named[k].adult + named[k].senior + named[k].child, 0);
      const values = {
        killed: fmt(g.killed.total), children: fmt(g.killed.children), women: fmt(g.killed.women),
        injured: fmt(g.injured.total), days: fmt(D.meta.days_of_data), asof: fmtDate(D.meta.data_as_of),
        asofLong: new Date(D.meta.data_as_of + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
        oct7: fmt(D.oct7.total), hostages: fmt(D.oct7.hostages_taken),
        idfGaza: fmt(D.israeli_daily[D.israeli_daily.length - 1].idf_gaza_cum),
        childShare: `${Math.round(((named.male.child + named.female.child) / namedTotal) * 100)}%`,
      };
      if (window.StoryViz) Object.assign(values, window.StoryViz.init(D));
      document.querySelectorAll('[data-k]').forEach(el => { const v = values[el.dataset.k]; if (v != null) el.textContent = v; });
      counts = { killed: g.killed.total, children: g.killed.children, women: g.killed.women };
      if (canvas) canvas.setAttribute('aria-label', `${fmt(Math.round(g.killed.total / 10))} dots, one for every ten of the ${fmt(g.killed.total)} Palestinians killed in Gaza recorded by the Gaza Ministry of Health`);
      drawDots();
      dispatchEvent(new Event('story:data'));
    }).catch(() => {});
    fetch('data/names-infants.json', { cache: 'no-cache' }).then(r => r.json()).then(d => {
      document.getElementById('st-infants').textContent = fmt(d.count);
      // Every name is in the page; the list opens to show all of them
      const wall = document.getElementById('st-names'), more = document.getElementById('st-names-more');
      const html = list => list.map(n => `<span>${n[0]}</span>`).join(' ');
      wall.innerHTML = html(d.names.slice(0, 160));
      document.getElementById('st-infants-2').textContent = fmt(d.count);
      more.hidden = false;
      more.addEventListener('click', () => {
        const open = wall.classList.toggle('is-open');
        if (open) wall.insertAdjacentHTML('beforeend', ' ' + html(d.names.slice(160)));
        else { wall.innerHTML = html(d.names.slice(0, 160)); more.scrollIntoView({ block: 'center', behavior: 'instant' }); }
        more.setAttribute('aria-expanded', String(open));
        more.textContent = open ? 'Show fewer names' : `Show all ${fmt(d.count)} names`;
        dispatchEvent(new Event('story:data'));
      });
    }).catch(() => {});
  }

  // The title letters reuse whichever plate file the prologue picked (no second download)
  const plateImg = document.querySelector('.scene--prologue .st-plate img'), titleEl = document.querySelector('.st-title');
  if (plateImg && titleEl) {
    const use = () => { if (plateImg.currentSrc) titleEl.style.setProperty('--title-img', `url("${plateImg.currentSrc}")`); };
    if (plateImg.complete) use(); else plateImg.addEventListener('load', use, { once: true });
  }

  // ---------- Dot field (Gaza) ----------
  const canvas = document.querySelector('.st-dots');
  let group = 'all';
  if (canvas && 'ResizeObserver' in window) { let cw = 0, ch = 0; new ResizeObserver(() => { if (canvas.clientWidth !== cw || canvas.clientHeight !== ch) { cw = canvas.clientWidth; ch = canvas.clientHeight; drawDots(); } }).observe(canvas); }
  function drawDots() {
    if (!canvas) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const n = Math.round(counts.killed / 10);
    const kids = Math.round(counts.children / 10), women = Math.round(counts.women / 10);
    const foot = innerWidth <= 900 && innerHeight > 500 ? 150 : 0;   // phones: the field ends above the credit and the chapter bar
    const land = innerHeight <= 500 && innerWidth > innerHeight;
    const pad = land ? 8 : Math.max(16, w * 0.04), aw = w - pad * 2, ah = h - pad * 2 - (land ? 0 : 40) - foot;
    const step = Math.sqrt((aw * ah) / n);
    const cols = Math.floor(aw / step), rows = Math.ceil(n / cols);
    const s = Math.min(step, ah / rows), r = Math.max(0.6, s * 0.3);
    const x0 = (w - cols * s) / 2 + s / 2, y0 = pad + (land ? 0 : 40) + (ah - rows * s) / 2 + s / 2;
    const on = '#c9d3ae', dim = 'rgba(238, 240, 242, 0.16)', base = 'rgba(238, 240, 242, 0.62)';
    for (let i = 0; i < n; i++) {
      let c = base;
      if (group === 'children') c = i < kids ? on : dim;
      else if (group === 'women') c = i >= kids && i < kids + women ? on : dim;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x0 + (i % cols) * s, y0 + Math.floor(i / cols) * s, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------- Yearly bars (Iraq) ----------
  const bars = document.querySelector('.st-bars');
  let era = 'all';
  if (bars) {
    const years = JSON.parse(bars.dataset.years);
    const max = Math.max(...Object.values(years));
    bars.innerHTML = Object.entries(years).map(([y, v]) =>
      `<div class="st-bar" data-year="${y}" style="--v:${(v / max).toFixed(4)}"><i></i><span>’${y.slice(2)}</span><b>${fmt(v)}</b></div>`).join('');
  }
  const setEra = (e, peak) => {
    if (!bars || e === era) return;
    era = e;
    bars.querySelectorAll('.st-bar').forEach(el => el.classList.toggle('is-peak', el.dataset.year === peak));
    const [a, b] = e === 'all' ? [0, 9999] : e.split('-').map(Number);
    bars.querySelectorAll('.st-bar').forEach(el => {
      const y = +el.dataset.year;
      el.classList.toggle('is-dim', y < a || y > b);
      el.classList.toggle('is-on', e !== 'all' && y >= a && y <= b);
    });
  };

  // ---------- Scroll engine ----------
  const scenes = Array.from(document.querySelectorAll('.scene'));
  const beats = scenes.map(sc => Array.from(sc.querySelectorAll('.beat[data-beat]')).map(el => {
    const [a, b] = el.dataset.beat.split(',').map(Number);
    return { el, a, b };
  }));
  scenes.forEach((sc, i) => { sc.style.zIndex = i + 1; });
  scenes.forEach(sc => { const first = sc.querySelector('.beat[data-state]'); if (first) sc.dataset.state = first.dataset.state; });
  const bar = document.querySelector('.st-progress');
  // The dissolve length matches the CSS (70svh), read from a probe so mobile toolbars agree
  const probe = Object.assign(document.createElement('div'), { ariaHidden: 'true' });
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:70svh;visibility:hidden;pointer-events:none';
  document.body.append(probe);
  let dissolve = probe.offsetHeight || innerHeight * 0.7;
  let queued = false;

  function frame() {
    queued = false;
    const vh = innerHeight;
    // Read every rect first, then write, so the browser lays out once per frame
    const rects = scenes.map(sc => sc.getBoundingClientRect());
    const writes = [];
    scenes.forEach((sc, i) => {
      const r = rects[i];
      if (r.bottom < -vh || r.top > 2 * vh) return;
      const p = clamp(-r.top / Math.max(1, r.height - vh));
      writes.push([sc, '--p', p.toFixed(4)]);
      if (i > 0) {
        const inn = clamp(-r.top / dissolve);
        writes.push([sc, '--in', inn.toFixed(4)], [scenes[i - 1], '--out', inn.toFixed(4)]);
      }
      beats[i].forEach(({ el, a, b }) => {
        const t = clamp((p - a) / (b - a));
        const edge = 0.12;
        const o = p < a || p > b ? 0 : Math.min(1, t / edge, (1 - t) / edge);
        const held = b > 1 && p >= a ? Math.min(1, t / edge) : o;
        writes.push([el, '--o', held.toFixed(3)], [el, '--t', (b > 1 ? Math.min(t, 0.5) : t).toFixed(3)]);
        if (held > 0.5) {
          if (el.dataset.group && group !== el.dataset.group) { group = el.dataset.group; drawDots(); }
          if (el.dataset.era) setEra(el.dataset.era, el.dataset.peak);
          if (el.dataset.state && sc.dataset.state !== el.dataset.state) {
            sc.dataset.state = el.dataset.state;
            if (window.StoryViz) window.StoryViz.state(sc, el.dataset.state);
          }
          if (el.dataset.show) sc.dataset.show = el.dataset.show;
        }
      });
    });
    writes.forEach(([el, k, v]) => el.style.setProperty(k, v));
    const max = document.documentElement.scrollHeight - vh;
    if (bar) bar.style.setProperty('--read', (max > 0 ? scrollY / max : 0).toFixed(4));
    updateNav();
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };

  // ---------- Navigation ----------
  const chapters = Array.from(document.querySelectorAll('[data-chapter]')).map(el => ({ el, name: el.dataset.chapter }));
  chapters.forEach(c => { if (!c.el.hasAttribute('tabindex')) c.el.setAttribute('tabindex', '-1'); if (!c.el.hasAttribute('aria-labelledby')) c.el.setAttribute('aria-label', c.name); });
  // Where each chapter is fully on screen (past its dissolve). Cached; refreshed on resize and data load.
  let starts = [];
  const measure = () => {
    starts = chapters.map(({ el }) => {
      const top = el.getBoundingClientRect().top + scrollY;
      return el.classList.contains('scene') && el !== scenes[0] && !reduce ? top + dissolve + 2 : top;
    });
  };
  measure();
  let current = -1;
  const rail = document.createElement('nav');
  rail.className = 'st-nav';
  rail.setAttribute('aria-label', 'Chapters');
  rail.innerHTML = `<ol>${chapters.map((c, i) => `<li><a href="#" data-i="${i}"><span class="st-nav-tick" aria-hidden="true"></span><span class="st-nav-name">${c.name}</span></a></li>`).join('')}</ol>`;
  const pager = document.createElement('nav');
  pager.className = 'st-pager';
  pager.setAttribute('aria-label', 'Chapters');
  pager.innerHTML = `<button type="button" class="st-pager-btn" data-step="-1" aria-label="Previous chapter"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <button type="button" class="st-pager-name" aria-expanded="false" aria-controls="st-sheet"><span class="st-pager-label"></span><span class="st-pager-count"></span></button>
    <div class="st-sheet" id="st-sheet" hidden><ol>${chapters.map((c, i) => `<li><a href="#" data-i="${i}">${c.name}</a></li>`).join('')}</ol></div>
    <button type="button" class="st-pager-btn" data-step="1" aria-label="Next chapter"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
  const live = Object.assign(document.createElement('p'), { className: 'visually-hidden' });
  live.setAttribute('aria-live', 'polite');
  // Chapter navigation comes right after the header in tab order
  (document.querySelector('.st-head') || document.body.firstElementChild).after(rail, pager, live);
  const sheet = pager.querySelector('.st-sheet'), sheetBtn = pager.querySelector('.st-pager-name');
  const sheetLinks = () => Array.from(sheet.querySelectorAll('a'));

  let pendingFocus = null;
  const go = (i, { keyboard = false } = {}) => {
    i = clamp(i, 0, chapters.length - 1);
    measure();
    const el = chapters[i].el;
    const still = Math.abs(scrollY - starts[i]) < 2;
    scrollTo({ top: starts[i], behavior: reduce ? 'instant' : 'smooth' });
    if (!keyboard) { live.textContent = `${chapters[i].name}, chapter ${i + 1} of ${chapters.length}`; return; }
    if (reduce || still || !('onscrollend' in window)) { el.focus({ preventScroll: true }); pendingFocus = null; return; }
    pendingFocus = el;
    setTimeout(() => { if (pendingFocus === el) { el.focus({ preventScroll: true }); pendingFocus = null; } }, 1500);
  };
  ['wheel', 'touchstart', 'pointerdown'].forEach(t => addEventListener(t, () => { pendingFocus = null; }, { passive: true }));
  addEventListener('scrollend', () => { if (pendingFocus) { pendingFocus.focus({ preventScroll: true }); pendingFocus = null; } });
  const setSheet = open => {
    sheet.hidden = !open;
    sheetBtn.setAttribute('aria-expanded', String(open));
    if (open) (sheet.querySelector('[aria-current]') || sheetLinks()[0]).focus();
  };
  document.addEventListener('click', e => {
    const kb = e.detail === 0;
    const a = e.target.closest('.st-nav a, .st-sheet a');
    if (a) {
      e.preventDefault();
      const fromSheet = !!a.closest('.st-sheet');
      setSheet(false);
      go(+a.dataset.i, { keyboard: kb });
      if (fromSheet && !kb) sheetBtn.focus();
      return;
    }
    // In-page links to a chapter (e.g. "How we count") land past its dissolve
    const hashLink = e.target.closest('a[href^="#"]');
    if (hashLink && hashLink.getAttribute('href').length > 1) {
      const target = document.getElementById(decodeURIComponent(hashLink.hash.slice(1)));
      const j = chapters.findIndex(c => c.el === target);
      if (j >= 0) { e.preventDefault(); history.pushState(null, '', hashLink.hash); go(j, { keyboard: true }); return; }
    }
    const step = e.target.closest('[data-step]');
    if (step) { go(current + +step.dataset.step, { keyboard: kb }); return; }
    if (e.target.closest('.st-pager-name')) { setSheet(sheet.hidden); return; }
    if (!e.target.closest('.st-sheet')) setSheet(false);
  });
  pager.addEventListener('focusout', e => { if (!sheet.hidden && !pager.contains(e.relatedTarget)) setSheet(false); });
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!sheet.hidden) {
      if (e.key === 'Escape') { setSheet(false); sheetBtn.focus(); return; }
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); const ls = sheetLinks(); ls[e.key === 'Home' ? 0 : ls.length - 1].focus(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const ls = sheetLinks(), k = ls.indexOf(document.activeElement);
        ls[clamp(k + (e.key === 'ArrowDown' ? 1 : -1), 0, ls.length - 1)].focus();
      }
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); go(current + (e.key === 'ArrowRight' ? 1 : -1), { keyboard: true }); }
  });

  function updateNav() {
    // A chapter is current from the middle of its dissolve (reduced motion: once its top passes the upper third)
    const y = scrollY;
    let i = 0;
    starts.forEach((s, j) => { if (reduce ? s <= y + innerHeight * 0.33 : s - dissolve * 0.5 <= y + 1) i = j; });
    if (i === current) return;
    current = i;
    rail.querySelectorAll('a').forEach((a, j) => {
      a.classList.toggle('is-current', j === i);
      a.classList.toggle('is-past', j < i);
      if (j === i) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
    sheetLinks().forEach((a, j) => { if (j === i) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    pager.querySelector('.st-pager-label').textContent = chapters[i].name;
    pager.querySelector('.st-pager-count').textContent = `${i + 1} of ${chapters.length}`;
    sheetBtn.setAttribute('aria-label', `${chapters[i].name}, chapter ${i + 1} of ${chapters.length}. Show all chapters`);
    const prevB = pager.querySelector('[data-step="-1"]'), nextB = pager.querySelector('[data-step="1"]');
    if (i === chapters.length - 1 && document.activeElement === nextB) prevB.focus();
    if (i === 0 && document.activeElement === prevB) nextB.focus();
    prevB.disabled = i === 0;
    nextB.disabled = i === chapters.length - 1;
  }

  const fromHash = () => {
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    const i = target ? chapters.findIndex(c => c.el === target) : -1;
    measure();
    if (i > 0) scrollTo({ top: starts[i], behavior: 'instant' });
  };
  addEventListener('hashchange', fromHash);
  addEventListener('load', () => requestAnimationFrame(fromHash));
  window.addEventListener('story:data', () => { measure(); queue(); });

  const onResize = () => { dissolve = probe.offsetHeight || innerHeight * 0.7; measure(); drawDots(); };
  if (!reduce) {
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', () => { onResize(); queue(); });
    frame();
  } else {
    let t = false;
    addEventListener('scroll', () => { if (!t) { t = true; requestAnimationFrame(() => { t = false; updateNav(); }); } }, { passive: true });
    addEventListener('resize', () => { onResize(); updateNav(); });
    updateNav();
  }
  drawDots();
})();
