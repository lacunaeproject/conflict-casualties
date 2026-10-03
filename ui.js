/* Conflict Casualties — product theme interactions (html.rd pages).
   Presentation only: every control keeps its original element and
   listeners from app.js; this file changes how they're shown.
   - Header hairline once content scrolls under the glass
   - --rd-head tracks the real header height for sticky elements
   - Phone: chart filters open in a bottom sheet
   - Conflict switcher in the header, built from CONFLICTS below
   - "In this article" contents, built from [data-chapter] */

// Every conflict the site covers. To add one: give it a page, add an entry
// here, and add it to the footer's Conflicts column. Order = menu order.
const CONFLICTS = [
  {
    id: 'israel-palestine',
    name: 'Israel · Palestine',
    period: 'Since October 7, 2023',
    href: 'index.html',
    toll: '73,928',
    tollNote: 'Palestinians killed in Gaza',
    badge: 'Featured',
  },
  {
    id: 'iraq',
    name: 'Iraq',
    period: '2003 – 2026',
    href: 'iraq.html',
    toll: '280,771 – 315,190',
    tollNote: 'killed by direct violence',
    badge: 'New',
  },
];

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

  // Conflict switcher: the button is static HTML; the menu is built here.
  const sw = document.querySelector('.conflict-switch');
  if (sw) {
    const swBtn = sw.querySelector('.cs-btn');
    const menu = sw.querySelector('.cs-menu');
    const current = sw.dataset.current;
    menu.innerHTML =
      '<div class="cs-head">Conflicts we track</div>' +
      CONFLICTS.map(c => {
        const here = c.id === current;
        return `<a class="cs-item${here ? ' is-current' : ''}" href="${c.href}"${here ? ' aria-current="page"' : ''}>` +
          `<span class="cs-row"><span class="cs-item-name">${c.name}</span>` +
          (c.badge ? `<span class="cs-badge cs-badge--${c.badge.toLowerCase()}">${c.badge}</span>` : '') +
          `</span><span class="cs-period">${c.period}</span>` +
          `<span class="cs-toll"><strong>${c.toll}</strong> ${c.tollNote}</span>` +
          (here ? '<span class="cs-here" aria-hidden="true">Viewing</span>' : '') +
          '</a>';
      }).join('') +
      '<p class="cs-foot">More conflicts will be added as we verify their data.</p>';

    const items = () => Array.from(menu.querySelectorAll('.cs-item'));
    const setOpen = (open, focusFirst) => {
      menu.hidden = !open;
      swBtn.setAttribute('aria-expanded', String(open));
      if (open && focusFirst) (menu.querySelector('.is-current') || items()[0]).focus();
    };
    // event.detail is 0 for keyboard clicks: only then move focus into the menu.
    swBtn.addEventListener('click', e => setOpen(menu.hidden, e.detail === 0));
    document.addEventListener('pointerdown', e => { if (!sw.contains(e.target)) setOpen(false); });
    sw.addEventListener('keydown', e => {
      if (menu.hidden) return;
      if (e.key === 'Escape') { setOpen(false); swBtn.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const list = items();
      const i = list.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
      list[next].focus();
    });
    sw.addEventListener('focusout', e => { if (!sw.contains(e.relatedTarget)) setOpen(false); });
  }

  // Chapters: every [data-chapter] section, grouped by part.
  // A section's part is its data-part, else the nearest .part-head above it.
  const chapters = Array.from(document.querySelectorAll('[data-chapter]'));
  if (!chapters.length) return;
  const partHeads = Array.from(document.querySelectorAll('.part-head'));
  const partOf = el => {
    if (el.dataset.part) return el.dataset.part;
    const above = partHeads.filter(h => h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).pop();
    return above ? above.querySelector('.part-num').textContent : '';
  };
  chapters.forEach((el, i) => { if (!el.id) el.id = `chapter-${i + 1}`; });
  const groups = [];
  chapters.forEach((el, i) => {
    const part = partOf(el);
    let g = groups.find(x => x.part === part);
    if (!g) { g = { part, items: [] }; groups.push(g); }
    g.items.push({ el, n: String(i + 1).padStart(2, '0') });
  });

  // "In this article" list under the lede.
  const contents = document.getElementById('contents-groups');
  if (contents) {
    contents.innerHTML = groups.map(g =>
      `<div class="contents-group"><div class="contents-part">${g.part}</div><ol>` +
      g.items.map(({ el, n }) => `<li><a href="#${el.id}"><b>${n}</b><span>${el.dataset.chapter}</span></a></li>`).join('') +
      '</ol></div>').join('');
  }
})();

/* Key figures: Escape closes an open detail layer and returns focus to its control */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const open = document.activeElement && document.activeElement.closest('.stats-details[open]');
  if (!open) return;
  open.open = false;
  open.querySelector('summary').focus();
});
