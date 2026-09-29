/* Conflict Casualties — product theme interactions (html.rd pages).
   Presentation only: every control keeps its original element and
   listeners from app.js; this file changes how they're shown.
   - Header hairline once content scrolls under the glass
   - --rd-head tracks the real header height for sticky elements
   - Phone: chart filters open in a bottom sheet */
(function () {
  const root = document.documentElement;

  // Header gains a hairline once content scrolls under the glass.
  const head = document.querySelector('.site-head');
  if (head) {
    const onScroll = () => head.classList.toggle('is-scrolled', window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    // Sticky elements tuck exactly under the header at every breakpoint.
    const setH = () => root.style.setProperty('--rd-head', head.offsetHeight + 'px');
    new ResizeObserver(setH).observe(head);
    setH();
  }

  // Phone: chart filters open in a bottom sheet.
  const controls = document.querySelector('.panel .controls');
  if (controls) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rd-filter-btn';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'rd-filter-sheet');
    btn.innerHTML =
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h14M6 10h8M8.5 14h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
      '<span>Filters</span><span class="rd-filter-sum"></span><span class="rd-edit">Edit</span>';
    controls.before(btn);
    controls.id = 'rd-filter-sheet';

    const headEl = document.createElement('div');
    headEl.className = 'rd-sheet-head';
    headEl.innerHTML = '<div class="rd-sheet-grip" aria-hidden="true"></div><h3 class="rd-sheet-title" id="rd-sheet-title">Chart filters</h3>';
    controls.prepend(headEl);
    const foot = document.createElement('div');
    foot.className = 'rd-sheet-foot';
    foot.innerHTML = '<button type="button" class="rd-sheet-done">Show results</button>';
    controls.append(foot);

    const scrim = document.createElement('div');
    scrim.className = 'rd-scrim';
    document.body.append(scrim);

    const summary = () => {
      const s = document.getElementById('readout-start')?.textContent || '';
      const e = document.getElementById('readout-end')?.textContent || '';
      const pick = id => controls.querySelector(`#${id} .active`)?.textContent.trim();
      btn.querySelector('.rd-filter-sum').textContent =
        [s && e ? `${s} – ${e}` : '', pick('side-toggle'), pick('view-toggle'), pick('scale-toggle')].filter(Boolean).join(' · ');
    };
    summary();
    new MutationObserver(summary).observe(controls, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true, characterData: true });

    const setOpen = open => {
      controls.classList.toggle('is-sheet-open', open);
      scrim.classList.toggle('is-on', open);
      btn.setAttribute('aria-expanded', String(open));
      if (open) {
        controls.setAttribute('role', 'dialog');
        controls.setAttribute('aria-modal', 'true');
        controls.setAttribute('aria-labelledby', 'rd-sheet-title');
        document.body.style.overflow = 'hidden';
        controls.querySelector('button')?.focus({ preventScroll: true });
      } else {
        controls.removeAttribute('role');
        controls.removeAttribute('aria-modal');
        document.body.style.overflow = '';
        btn.focus({ preventScroll: true });
      }
    };
    btn.addEventListener('click', () => setOpen(true));
    scrim.addEventListener('click', () => setOpen(false));
    foot.querySelector('button').addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && controls.classList.contains('is-sheet-open') && document.getElementById('range-pop')?.hidden !== false) setOpen(false);
    });
    matchMedia('(min-width: 641px)').addEventListener('change', e => { if (e.matches && controls.classList.contains('is-sheet-open')) setOpen(false); });
  }

})();
