/* =========================================================
   Conflict Casualties — quiet motion layer
   - Sections fade up as they enter the viewport
   - Thin reading-progress rule in the masthead
   - Charts replay their draw-in when first scrolled into view
   Everything is skipped for prefers-reduced-motion, and content is
   never hidden unless this script has run (html.motion gate).
   Casualty figures are deliberately NOT animated (no count-ups).
   ========================================================= */
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;

  const root = document.documentElement;
  root.classList.add('motion');

  // --- Reading-progress rule -------------------------------------------
  const head = document.querySelector('.site-head');
  if (head) {
    const bar = document.createElement('div');
    bar.className = 'read-progress';
    bar.setAttribute('aria-hidden', 'true');
    head.appendChild(bar);
    let ticking = false;
    const setProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(setProgress); }
    }, { passive: true });
    setProgress();
  }

  // --- Reveal on scroll --------------------------------------------------
  // Only content below the fold at load: anything already on screen stays
  // put, so nothing blinks out and back in on first paint.
  const fold = window.innerHeight;
  const targets = Array.from(document.querySelectorAll([
    '.kpi', '.panel .card', '.split .card',
    '.tracker .card', '.context-card .card', '.data-stamp .card', '.foot-meta .card',
    '.pullquote', '.gallery-head', '.photo', '.note-panel',
    '.section-head', '.book', '.donate-card', '.jump-nav',
    '.story', '.part-head', '.century', '.era-fig', '.era-body',
  ].join(','))).filter(el => el.getBoundingClientRect().top > fold * 0.9);

  // Stagger siblings that share a row (KPI cards, book grid, photo pairs)
  targets.forEach(el => {
    el.classList.add('reveal');
    const sibs = Array.from(el.parentElement ? el.parentElement.children : []).filter(n => n.classList.contains('reveal'));
    const i = sibs.indexOf(el);
    if (i > 0) el.style.transitionDelay = `${(i % 4) * 80}ms`;
  });

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  targets.forEach(el => io.observe(el));

  // --- Charts draw in when first seen ------------------------------------
  const canvases = document.querySelectorAll('#ts-chart, #gov-chart, #wb-chart, #wb-attacks-chart, #pace-chart');
  if (canvases.length && window.Chart) {
    const replay = (canvas, tries = 0) => {
      const chart = window.Chart.getChart(canvas);
      if (!chart) {
        if (tries < 40) setTimeout(() => replay(canvas, tries + 1), 150);
        return;
      }
      chart.reset();
      chart.update();
    };
    const cio = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        replay(e.target);
      });
    }, { threshold: 0.35 });
    canvases.forEach(c => cio.observe(c));
  }
})();
