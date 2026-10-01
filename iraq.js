/* Iraq page: the year chart's readout follows the pointer.
   Everything else on the page is static HTML. */
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
})();
