/* Iraq page: the year chart's readout follows the pointer or the arrow keys.
   Everything else on the page is static HTML. (Screen readers read each
   year from its own hidden sentence, so the readout stays aria-hidden.) */
(function () {
  const bars = document.querySelector('.yr-bars');
  const out = document.getElementById('yr-readout');
  if (!bars || !out) return;
  const fmt = n => Number(n).toLocaleString('en-US');
  const items = Array.from(bars.children);
  const peak = items.reduce((a, b) => (+b.dataset.value > +a.dataset.value ? b : a));
  const show = li => {
    items.forEach(x => x.classList.toggle('is-on', x === li));
    bars.classList.toggle('has-on', !!li);
    const el = li || peak;
    const y = el.dataset.year;
    const note = !li ? ', the deadliest year' : y === '2026' ? ', January to March' : '';
    out.innerHTML = `<strong>${fmt(el.dataset.value)}</strong> in <b>${y}</b>${note}`;
  };
  // Hit target is the whole column, not just the bar.
  bars.addEventListener('pointerover', e => { const li = e.target.closest('li'); if (li) show(li); });
  bars.addEventListener('pointerleave', () => show(null));
  // Keyboard: the figure takes focus; arrows, Home and End step through the years.
  const fig = bars.closest('figure');
  let at = -1;
  fig.tabIndex = 0;
  fig.addEventListener('keydown', e => {
    const last = items.length - 1;
    const next = { ArrowRight: Math.min(last, at + 1), ArrowLeft: Math.max(0, at < 0 ? last : at - 1), Home: 0, End: last }[e.key];
    if (next !== undefined) { e.preventDefault(); at = next; show(items[at]); }
    else if (e.key === 'Escape') { at = -1; show(null); }
  });
  fig.addEventListener('blur', () => { at = -1; show(null); });
})();
