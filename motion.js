/* =========================================================
   Conflict Casualties — motion layer
   - Reading-progress rule in the masthead
   - Headings set word by word as the reader reaches them
   - The pull quote lights up word by word across the reader's scroll
   Photographs developing and figures coming into focus are pure CSS
   (scroll-driven). Figures never count. Skipped under reduced motion,
   and nothing is hidden unless this script has run (html.motion).
   ========================================================= */
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

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

  // --- Photographs develop once they have loaded --------------------------
  document.querySelectorAll('.era-fig img, .photo img').forEach(img => {
    const done = () => img.classList.add('is-loaded');
    if (img.complete && img.naturalWidth) done();
    else img.addEventListener('load', done, { once: true });
  });

  // --- Headings set word by word -----------------------------------------
  // Each word rises inside its own clip box, in reading order. Inline
  // elements (bound figures, links) move as one word, so their text and ids
  // stay intact for app.js.
  const split = el => {
    let i = 0;
    const word = node => {
      const w = document.createElement('span');
      w.className = 'set-w';
      const inner = document.createElement('span');
      inner.className = 'set-wi';
      inner.style.setProperty('--wi', i++);
      inner.append(node);
      w.append(inner);
      return w;
    };
    Array.from(el.childNodes).forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (part) frag.append(/^\s+$/.test(part) ? document.createTextNode(part) : word(document.createTextNode(part)));
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') {
        const mark = document.createComment('');
        n.replaceWith(mark);
        mark.replaceWith(word(n));
      }
    });
    return el;
  };

  // Checked on scroll rather than with an IntersectionObserver: a fast flick
  // or an anchor jump can carry a heading past the trigger line between
  // frames, and it must never be left unset.
  const line = () => window.innerHeight * 0.82;
  let pending = [];
  document.querySelectorAll('main h2:not(.visually-hidden), .opening--page .opening-title').forEach(h => {
    if (h.closest('.stats-details, .cw-gate')) return;
    // Already on screen at load: leave it alone, so nothing blinks.
    if (h.getBoundingClientRect().top < line()) return;
    split(h).dataset.set = 'words';
    pending.push(h);
  });
  let setQueued = false;
  const setHeadings = () => {
    setQueued = false;
    const y = line();
    pending = pending.filter(h => {
      if (h.getBoundingClientRect().top >= y) return true;
      h.classList.add('is-set');
      return false;
    });
    if (!pending.length) window.removeEventListener('scroll', queueSet);
  };
  const queueSet = () => { if (!setQueued) { setQueued = true; requestAnimationFrame(setHeadings); } };
  if (pending.length) {
    window.addEventListener('scroll', queueSet, { passive: true });
    window.addEventListener('resize', queueSet);
  }

  // --- The pull quote lights up as it is read ----------------------------
  const quote = document.querySelector('.pullquote p');
  if (quote) {
    split(quote).dataset.set = 'read';
    const words = Array.from(quote.querySelectorAll('.set-w'));
    let queued = false;
    const light = () => {
      queued = false;
      const r = quote.getBoundingClientRect();
      // From the quote's top at 80% of the screen to 40%
      const p = Math.min(1, Math.max(0, (window.innerHeight * 0.8 - r.top) / (window.innerHeight * 0.4)));
      const lit = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle('is-lit', i < lit));
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(light); } };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    light();
  }
})();
