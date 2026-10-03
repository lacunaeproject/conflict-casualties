/* =========================================================
   Conflict Casualties — charts, hand-built in SVG.
   Called once from app.js with the loaded data.json (buildViz).

   Rules every chart follows:
   - Bars start at zero; values are never interpolated or smoothed.
   - "Reported" means reported: deaths are counted on the date the
     Ministry of Health reported them, not when they happened.
   - Colour means the same thing everywhere (see viz.css).
   - Each chart re-renders at its own width, phones get their own
     layout (months instead of weeks), and values are readable by
     pointer, keyboard and screen reader.
   ========================================================= */

/* exported buildViz */
// eslint-disable-next-line no-unused-vars
function buildViz(D) {
  const NS = 'http://www.w3.org/2000/svg';
  const DAY = 864e5;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const num = n => new Intl.NumberFormat('en-US').format(Math.round(n));

  // ---------- Dates as UTC days, so no reader's timezone shifts a bar ----------
  const t = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const iso = ms => new Date(ms).toISOString().slice(0, 10);
  const monday = ms => ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY;
  const monthStart = ms => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
  const nextMonth = ms => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); };
  const dayLabel = ms => { const d = new Date(ms); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
  const monthLabel = (ms, long) => { const d = new Date(ms); return `${(long ? MONTHS_LONG : MONTHS)[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

  // ---------- SVG and scale helpers ----------
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const label = (parent, x, y, text, cls, attrs = {}) => { const e = el('text', { x, y, class: cls, ...attrs }, parent); e.textContent = text; return e; };
  const niceTicks = (max, count) => {
    const raw = max / count, p = 10 ** Math.floor(Math.log10(raw)), n = raw / p;
    const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
    const out = [];
    for (let v = 0; v < max + step; v += step) { out.push(v); if (v >= max) break; }
    return out;
  };
  // Y axis in the left gutter: numbers right-aligned to the plot edge, the unit under the top one.
  const yAxis = (svg, ticks, ys, x0, x1, unit) => {
    const g = el('g', {}, svg);
    ticks.forEach((v, i) => {
      if (i) el('line', { x1: x0, x2: x1, y1: ys(v), y2: ys(v), class: 'grid' }, g);
      label(g, x0 - 6, ys(v) + 4, num(v), 't-unit', { 'text-anchor': 'end' });
    });
    label(g, x0 - 6, ys(ticks[ticks.length - 1]) + 22, unit, 't-unit', { 'text-anchor': 'end' });
    return g;
  };
  const svgFor = (plot, w, h, aria) => {
    plot.textContent = '';
    return el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: aria ? 'img' : null, 'aria-label': aria || null, 'aria-hidden': aria ? null : 'true', focusable: 'false' }, plot);
  };
  // Lay out labels left to right in a few lanes so none overlap; drop the least important if none fits.
  const placeInLanes = (items, lanes, minX, maxX) => {
    const placed = [];
    for (const it of [...items].sort((a, b) => a.priority - b.priority)) {
      const w = it.node.getComputedTextLength();
      let x = it.x + 4, anchor = 'start';
      if (x + w > maxX) { x = it.x - 4; anchor = 'end'; }
      const x0 = anchor === 'start' ? x : x - w, x1 = x0 + w;
      const lane = x0 < minX ? -1 : lanes.findIndex((_, i) => !placed.some(o => o.lane === i && o.x0 < x1 + 12 && o.x1 > x0 - 12));
      if (lane < 0) { it.node.remove(); if (it.leader) it.leader.remove(); continue; }
      placed.push({ lane, x0, x1 });
      it.node.setAttribute('x', x); it.node.setAttribute('y', lanes[lane]); it.node.setAttribute('text-anchor', anchor);
      if (it.leader) it.leader.setAttribute('y1', lanes[lane] + 4);
    }
  };
  // Re-render at the plot's own width; ignore height-only changes.
  const responsive = (fig, render) => {
    const plot = fig.querySelector('.viz-plot');
    let width = 0, queued = false;
    const go = () => { queued = false; const w = Math.round(plot.clientWidth); if (w && w !== width) { width = w; render(plot, w); } };
    new ResizeObserver(() => { if (!queued) { queued = true; requestAnimationFrame(go); } }).observe(plot);
    go();
  };
  // Pointer and keyboard pick a bar; the readout above the plot names its value.
  const pickable = (fig, count, onPick, idle) => {
    const readout = fig.querySelector('.viz-readout');
    let current = -1;
    const set = i => { current = i; readout.innerHTML = i < 0 ? idle : onPick(i); };
    fig.tabIndex = 0;
    fig.addEventListener('keydown', e => {
      const n = count();
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); set(Math.max(0, Math.min(n - 1, (current < 0 ? (e.key === 'ArrowRight' ? -1 : n) : current) + (e.key === 'ArrowRight' ? 1 : -1)))); }
      else if (e.key === 'Home') { e.preventDefault(); set(0); }
      else if (e.key === 'End') { e.preventDefault(); set(n - 1); }
      else if (e.key === 'Escape') set(-1);
    });
    fig.addEventListener('blur', () => set(-1));
    set(-1);
    return { set, get: () => current };
  };
  // One shared hatch pattern for "added but not broken down".
  if (!document.getElementById('viz-hatch')) {
    const defs = el('svg', { width: 0, height: 0, class: 'viz', 'aria-hidden': 'true', style: 'position:absolute' }, document.body);
    const pat = el('pattern', { id: 'viz-hatch', patternUnits: 'userSpaceOnUse', width: 4, height: 4, patternTransform: 'rotate(45)' }, el('defs', {}, defs));
    el('line', { x1: 0, y1: 0, x2: 0, y2: 4, class: 'hatch-line' }, pat);
  }

  // ---------- Data ----------
  const gaza = D.gaza_daily;
  const asOf = gaza[gaza.length - 1].date;
  const cum = new Map(gaza.map(r => [r.date, r.killed_cum]));
  const cumOn = s => { if (cum.has(s)) return cum.get(s); const first = gaza[0].date; return s < first ? 0 : cum.get(asOf); };
  const comp = new Map(D.gaza_components.map(c => [c.date, c]));
  const CEASEFIRE = '2025-10-10';

  // Deaths reported per week or month. Before January 2025 the Ministry gave one total;
  // after, it splits new killings from bodies recovered and deaths added after review.
  // Days in a split period without a breakdown stay visible as "not broken down".
  const series = unit => {
    const buckets = new Map();
    gaza.forEach((r, i) => {
      const v = i ? Math.max(0, r.killed_cum - gaza[i - 1].killed_cum) : r.killed_cum;
      const key = unit === 'week' ? monday(t(r.date)) : monthStart(t(r.date));
      let b = buckets.get(key);
      if (!b) buckets.set(key, b = { start: key, total: 0, nw: 0, rec: 0, rev: 0, splitDays: 0, days: 0 });
      b.total += v; b.days++;
      const c = comp.get(r.date);
      if (c) { b.splitDays++; b.nw += c.new + c.succumbed; b.rec += c.recovered; b.rev += c.committee; }
    });
    const out = [...buckets.values()];
    out.forEach(b => {
      b.end = (unit === 'week' ? b.start + 7 * DAY : nextMonth(b.start)) - DAY;
      if (b.splitDays) b.unsplit = Math.max(0, b.total - b.nw - b.rec - b.rev);
      else { b.nw = b.total; b.rec = b.rev = b.unsplit = 0; }
    });
    if (iso(out[out.length - 1].end) > asOf) out.pop();   // the current period appears once it ends
    return out;
  };
  const SERIES = { week: series('week'), month: series('month') };

  const periods = [
    { from: '2023-11-24', to: '2023-11-30', text: 'Truce', priority: 4 },
    { from: '2025-01-19', to: '2025-03-17', text: 'Ceasefire', priority: 1 },
    { from: CEASEFIRE, to: asOf, text: 'Ceasefire', priority: 0 },
  ];
  const events = [
    { date: '2024-05-06', text: 'Rafah offensive', priority: 3 },
    { date: '2025-03-18', text: 'War resumes', priority: 2 },
  ];

  // ======================================================================
  // 1. Deaths reported each week (months on phones), with the scroll steps
  // ======================================================================
  (() => {
    const fig = document.getElementById('weekly-chart');
    if (!fig) return;
    let view = null;   // { unit, data, xs, ys, svg, ... } for the current width
    let range = null;  // [from, to] of the step in view

    const render = (plot, w) => {
      const unit = w < 420 ? 'month' : 'week';
      const data = SERIES[unit];
      const H = unit === 'week' ? 400 : 320, m = { t: 64, r: 2, b: 28, l: 48 };
      const t0 = data[0].start, t1 = data[data.length - 1].end + DAY;
      const xs = ms => m.l + ((ms - t0) / (t1 - t0)) * (w - m.l - m.r);
      const peak = data.reduce((a, b) => (b.total > a.total ? b : a));
      const yt = niceTicks(peak.total, unit === 'week' ? 4 : 3), ymax = yt[yt.length - 1];
      const ys = v => H - m.b - (v / ymax) * (H - m.b - m.t);
      const per = unit === 'week' ? 'a week' : 'a month';
      const svg = svgFor(plot, w, H, `Deaths reported in Gaza ${per}, ${monthLabel(t0, true)} to ${monthLabel(t1 - DAY, true)}. Highest: ${num(peak.total)}, ${unit === 'week' ? 'week of ' + dayLabel(peak.start) : monthLabel(peak.start, true)}.`);

      // ceasefires and truces, behind everything
      const bandG = el('g', {}, svg);
      periods.forEach(p => {
        const a = Math.max(xs(t(p.from)), m.l), b = Math.min(xs(t(p.to) + DAY), w - m.r);
        if (b > a) el('rect', { x: a, y: m.t - 8, width: b - a, height: H - m.b - m.t + 8, class: 'band' }, bandG);
      });
      yAxis(svg, yt, ys, m.l, w - m.r, per);
      // event rules from the label lanes to the baseline
      const notes = el('g', { class: 'notes' }, svg);
      // bars, stacked from the baseline: new killings, recovered, after review, not broken down
      const barsG = el('g', { class: 'bars' }, svg);
      const bars = data.map((b, i) => {
        const x = xs(b.start), bw = xs(b.end + DAY) - x, gap = bw > 5 ? 1 : 0.5;
        const g = el('g', {}, barsG);
        let y = ys(0);
        [['nw', 'm-new'], ['rec', 'm-recovered'], ['rev', 'm-review'], ['unsplit', 'm-unsplit']].forEach(([k, cls]) => {
          if (!b[k]) return;
          const h = ys(0) - ys(b[k]);
          el('rect', { x: x + gap / 2, y: y - h, width: Math.max(bw - gap, 0.5), height: h, class: cls, style: `--i:${i}` }, g);
          y -= h;
        });
        return { b, g, x, bw };
      });
      el('line', { x1: m.l, x2: w - m.r, y1: ys(0), y2: ys(0), class: 'baseline' }, svg);
      // time axis: the start, then each new year
      const axisG = el('g', {}, svg);
      const startText = label(axisG, xs(t0), H - 8, monthLabel(t0), 't-unit');   // the start; dropped if it would touch 2024
      const firstYearX = xs(Date.UTC(2024, 0, 1));
      if (xs(t0) + startText.getComputedTextLength() + 12 > firstYearX) startText.remove();
      for (let y = 2024; Date.UTC(y, 0, 1) < t1; y++) label(axisG, xs(Date.UTC(y, 0, 1)), H - 8, String(y), 't-unit');

      // annotations in two lanes above the plot, with leaders down to their dates
      const lanes = [14, 30], items = [];
      periods.forEach(p => {
        const x = Math.max(xs(t(p.from)), m.l);
        items.push({ x, priority: p.priority, node: label(notes, x, lanes[0], p.text, 't-label'), leader: el('line', { x1: x + 0.5, x2: x + 0.5, y1: lanes[0] + 4, y2: m.t - 8, class: 'leader' }, notes) });
      });
      events.forEach(e => {
        const x = xs(t(e.date));
        items.push({ x, priority: e.priority, node: label(notes, x, lanes[0], e.text, 't-label'), leader: el('line', { x1: x + 0.5, x2: x + 0.5, y1: lanes[0] + 4, y2: ys(0), class: 'leader' }, notes) });
      });
      placeInLanes(items, lanes, m.l, w - m.r);
      // the peak, labelled beside its bar
      const pk = bars.find(r => r.b === peak);
      const pkText = label(notes, pk.x + pk.bw + 6, ys(peak.total) + 4, `${num(peak.total)} in ${unit === 'week' ? 'the week of ' + dayLabel(peak.start).replace(/, \d{4}$/, '') : monthLabel(peak.start)}`, 't-value t-halo');
      if (pk.x + pk.bw + 6 + pkText.getComputedTextLength() > w - m.r) { pkText.setAttribute('x', pk.x - 6); pkText.setAttribute('text-anchor', 'end'); }

      // the step bracket and the hover outline sit on top
      const bracket = el('g', { class: 'step-bracket' }, svg);
      const focus = el('rect', { class: 'focus-bar', visibility: 'hidden' }, svg);
      const hit = el('rect', { x: m.l, y: m.t - 8, width: w - m.l - m.r, height: H - m.t - m.b + 8, fill: 'transparent' }, svg);
      hit.addEventListener('pointermove', e => {
        const r = svg.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * w;
        const i = bars.findIndex(b => px >= b.x && px < b.x + b.bw);
        if (i >= 0) picker.set(i);
      });
      hit.addEventListener('pointerleave', () => picker.set(-1));

      view = { unit, data, bars, xs, ys, m, w, H, bracket, focus };
      applyRange();
    };

    const describe = b => {
      const when = view.unit === 'week' ? `Week of ${dayLabel(b.start)}` : monthLabel(b.start, true);
      let s = `${when}: <b>${num(b.total)}</b> deaths reported`;
      if (b.splitDays) {
        const parts = [[b.nw, 'new killings'], [b.rec, 'bodies recovered'], [b.rev, 'added after review'], [b.unsplit, 'not broken down']].filter(p => p[0]);
        s += ' · ' + parts.map(p => `${num(p[0])} ${p[1]}`).join(', ');
      }
      return s;
    };
    const picker = pickable(fig, () => view.data.length, i => {
      const r = view.bars[i];
      Object.entries({ x: r.x, y: view.ys(r.b.total) - 1, width: r.bw, height: view.ys(0) - view.ys(r.b.total) + 1 }).forEach(([k, v]) => view.focus.setAttribute(k, v));
      view.focus.setAttribute('visibility', 'visible');
      return describe(r.b);
    }, 'Point to a bar, or use the arrow keys, to read its count.');
    fig.addEventListener('pointerleave', () => view && view.focus.setAttribute('visibility', 'hidden'));
    const hideFocus = () => { if (picker.get() < 0 && view) view.focus.setAttribute('visibility', 'hidden'); };
    fig.addEventListener('keydown', hideFocus); fig.addEventListener('blur', hideFocus);

    // Steps: dim everything outside the step's dates and bracket its total
    const totalBetween = (from, to) => cumOn(to > asOf ? asOf : to) - cumOn(iso(t(from) - DAY));
    function applyRange() {
      if (!view) return;
      const [from, to] = range || [];
      fig.classList.toggle('is-stepping', !!range);
      view.bars.forEach(({ b, g }) => {
        const out = range && (iso(b.end) < from || iso(b.start) > to);
        g.querySelectorAll('rect').forEach(r => r.classList.toggle('is-dim', !!out));
      });
      view.bracket.textContent = '';
      if (!range) return;
      const x0 = Math.max(view.xs(t(from)), view.m.l), x1 = Math.min(view.xs(t(to > asOf ? asOf : to) + DAY), view.w - view.m.r);
      const y = 36;
      el('path', { d: `M${x0 + 0.5},${y + 8}V${y}H${x1 - 0.5}V${y + 8}`, class: 'bracket' }, view.bracket);
      const lab = label(view.bracket, (x0 + x1) / 2, y - 8, `${num(totalBetween(from, to))} reported`, 't-value', { 'text-anchor': 'middle' });
      const lw = lab.getComputedTextLength();
      const cx = Math.min(Math.max((x0 + x1) / 2, view.m.l + lw / 2), view.w - view.m.r - lw / 2);
      lab.setAttribute('x', cx);
    }

    const steps = [...document.querySelectorAll('.panel--scrolly .step')];
    steps.forEach(step => {
      const from = step.dataset.from, to = step.dataset.to > asOf ? asOf : step.dataset.to;
      const total = totalBetween(from, to), days = (t(to) - t(from)) / DAY + 1;
      const vals = { total: num(total), perday: num(total / days), permonth: num(total / (days / 30.44)) };
      step.querySelectorAll('[data-step]').forEach(n => { n.textContent = vals[n.dataset.step]; });
    });
    if (steps.length && typeof trackMiddle === 'function') {
      trackMiddle(steps, step => {
        steps.forEach(s => s.classList.toggle('is-active', s === step));
        range = step ? [step.dataset.from, step.dataset.to] : null;
        applyRange();
      }, () => (window.innerWidth <= 900 ? 0.74 : 0.5));
    }

    responsive(fig, render);

    // the same numbers as a table, by month
    const tbody = document.querySelector('#weekly-table tbody');
    if (tbody) {
      const months = new Map();
      gaza.forEach((r, i) => { const k = r.date.slice(0, 7); months.set(k, (months.get(k) || 0) + (i ? Math.max(0, r.killed_cum - gaza[i - 1].killed_cum) : r.killed_cum)); });
      tbody.innerHTML = [...months].map(([k, v]) => {
        const partial = k === asOf.slice(0, 7) ? ` (to ${dayLabel(t(asOf)).replace(/, \d{4}$/, '')})` : k === gaza[0].date.slice(0, 7) ? ' (from the 7th)' : '';
        return `<tr><td>${monthLabel(t(k + '-01'), true)}${partial}</td><td class="num">${num(v)}</td></tr>`;
      }).join('');
    }
  })();

  // ======================================================================
  // 2. Since the ceasefire: what the additions are, month by month
  // ======================================================================
  (() => {
    const fig = document.getElementById('ceasefire-chart');
    const after = D.gaza_components.filter(c => c.date > CEASEFIRE);
    const days = (t(asOf) - t(CEASEFIRE)) / DAY;
    const sum = (rows, f) => rows.reduce((a, r) => a + f(r), 0);
    const total = cumOn(asOf) - cumOn(CEASEFIRE);
    const nw = sum(after, c => c.new + c.succumbed), succumbed = sum(after, c => c.succumbed);
    const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
    set('cf-total', num(total)); set('cf-total-2', num(total)); set('cf-succumbed', num(succumbed));
    const oneIn = Math.round(total / nw);
    set('cf-new-share', 'one'); set('cf-new-share-of', ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][oneIn] || String(oneIn));

    // like-for-like daily rates: new killings in attacks, before and after the ceasefire
    const war = D.gaza_components.filter(c => c.date >= '2025-03-18' && c.date <= '2025-10-09');
    const warDays = (t('2025-10-09') - t('2025-03-18')) / DAY + 1;
    const rateWar = sum(war, c => c.new) / warDays, rateNow = sum(after, c => c.new) / days;
    set('rate-war', `~${num(rateWar)}`); set('rate-now', `~${num(rateNow)}`);
    const rm = document.getElementById('rate-moment');
    if (rm) rm.setAttribute('aria-label', `About ${num(rateWar)} people killed a day in new attacks in Gaza during the resumed war, March 18 to October 9, 2025; about ${num(rateNow)} a day since the October 10 ceasefire`);
    if (!fig) return;

    const months = new Map();
    D.gaza_daily.forEach((r, i, a) => {
      if (r.date <= CEASEFIRE) return;
      const k = monthStart(t(r.date));
      let b = months.get(k);
      if (!b) months.set(k, b = { start: k, total: 0, nw: 0, rec: 0, rev: 0 });
      b.total += Math.max(0, r.killed_cum - a[i - 1].killed_cum);
      const c = comp.get(r.date);
      if (c) { b.nw += c.new + c.succumbed; b.rec += c.recovered; b.rev += c.committee; }
    });
    const data = [...months.values()];
    data.forEach(b => { b.unsplit = Math.max(0, b.total - b.nw - b.rec - b.rev); });

    const render = (plot, w) => {
      const narrowAxis = (w - 50) / data.length < 44;
      const H = 280, m = { t: 28, r: 2, b: narrowAxis ? 44 : 30, l: 48 };
      const peak = Math.max(...data.map(b => b.total));
      const yt = niceTicks(peak, 3), ymax = yt[yt.length - 1];
      const ys = v => H - m.b - (v / ymax) * (H - m.b - m.t);
      const step = (w - m.l - m.r) / data.length, bw = Math.min(step * 0.72, 56);
      const svg = svgFor(plot, w, H, `Deaths added to the Gaza toll each month since the ceasefire: ${data.map(b => `${monthLabel(b.start)} ${num(b.total)}`).join('; ')}.`);
      yAxis(svg, yt, ys, m.l, w - m.r, 'a month');
      const barsG = el('g', { class: 'bars' }, svg);
      const bars = data.map((b, i) => {
        const x = m.l + i * step + (step - bw) / 2;
        let y = ys(0);
        [['nw', 'm-new'], ['rec', 'm-recovered'], ['rev', 'm-review'], ['unsplit', 'm-unsplit']].forEach(([k, cls]) => {
          if (!b[k]) return;
          const h = ys(0) - ys(b[k]);
          el('rect', { x, y: y - h, width: bw, height: h, class: cls, style: `--i:${i * 6}` }, barsG);
          y -= h;
        });
        // Narrow screens: totals only on the highest and latest months (the readout has the rest),
        // months as initials with the year under its first month
        const narrow = step < 44, highest = b.total === peak;
        if (!narrow || highest || i === data.length - 1) label(svg, x + bw / 2, ys(b.total) - 6, num(b.total), 't-value', { 'text-anchor': 'middle' });
        const d = new Date(b.start), mo = MONTHS[d.getUTCMonth()];
        const yearMark = d.getUTCMonth() === 0 || i === 0;
        label(svg, x + bw / 2, narrow ? H - 24 : H - 10, narrow ? mo[0] : yearMark ? `${mo} ’${String(d.getUTCFullYear()).slice(2)}` : mo, 't-unit', { 'text-anchor': 'middle' });
        if (narrow && yearMark) label(svg, x + bw / 2, H - 4, String(d.getUTCFullYear()), 't-unit', { 'text-anchor': 'middle' });
        return { b, x };
      });
      el('line', { x1: m.l, x2: w - m.r, y1: ys(0), y2: ys(0), class: 'baseline' }, svg);
      const focus = el('rect', { class: 'focus-bar', visibility: 'hidden' }, svg);
      const hit = el('rect', { x: m.l, y: m.t, width: w - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, svg);
      hit.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(); const i = Math.floor((((e.clientX - r.left) / r.width) * w - m.l) / step); if (i >= 0 && i < data.length) picker.set(i); });
      hit.addEventListener('pointerleave', () => picker.set(-1));
      view = { bars, ys, bw, focus };
    };
    let view = null;
    const picker = pickable(fig, () => data.length, i => {
      const { b, x } = view.bars[i];
      Object.entries({ x, y: view.ys(b.total) - 1, width: view.bw, height: view.ys(0) - view.ys(b.total) + 1 }).forEach(([k, v]) => view.focus.setAttribute(k, v));
      view.focus.setAttribute('visibility', 'visible');
      const parts = [[b.nw, 'new killings'], [b.rec, 'bodies recovered'], [b.rev, 'added after review'], [b.unsplit, 'not broken down']].filter(p => p[0]);
      return `${monthLabel(b.start, true)}: <b>${num(b.total)}</b> added · ${parts.map(p => `${num(p[0])} ${p[1]}`).join(', ')}`;
    }, 'Point to a month, or use the arrow keys, to read its breakdown.');
    const hide = () => { if (picker.get() < 0 && view) view.focus.setAttribute('visibility', 'hidden'); };
    fig.addEventListener('keydown', hide); fig.addEventListener('blur', hide); fig.addEventListener('pointerleave', hide);
    responsive(fig, render);
  })();

  // ======================================================================
  // 3. Who was killed: one square for every 100 people identified by name
  // ======================================================================
  (() => {
    const fig = document.getElementById('who-waffle');
    const k = D.summary.known_killed_in_gaza;
    const groups = [
      { name: 'Children', note: 'under 18', a: k.male.child, b: k.female.child, an: 'boys', bn: 'girls' },
      { name: 'Adults', note: '18 to 59', a: k.male.adult, b: k.female.adult, an: 'men', bn: 'women' },
      { name: 'Older people', note: '60 and over', a: k.male.senior, b: k.female.senior, an: 'men', bn: 'women' },
    ];
    const named = groups.reduce((s, g) => s + g.a + g.b, 0);
    const children = groups[0].a + groups[0].b;
    const share = n => `${Math.round((n / named) * 100)}%`;
    const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
    set('named-total', num(named));
    set('named-child-share', `${num(children)} (${share(children)})`);
    set('who-foot', `One square is 100 people, rounded to the nearest square. From the Ministry of Health’s list of dead identified by name, released through ${dayLabel(t(k.includes_until))}; the list trails the overall total.`);
    if (!fig) return;

    const render = (plot, w) => {
      plot.textContent = '';
      const wrap = document.createElement('div');
      wrap.className = 'waffle';
      const gap = 2, cols = Math.max(20, Math.min(50, Math.floor((w + gap) / 16))), size = (w - (cols - 1) * gap) / cols;
      groups.forEach(g => {
        const n = g.a + g.b, sa = Math.round(g.a / 100), sb = Math.round(g.b / 100), squares = sa + sb;
        const rows = Math.ceil(squares / cols), h = rows * size + (rows - 1) * gap;
        const block = document.createElement('div');
        block.innerHTML = `<div class="waffle-head"><span class="waffle-name">${g.name} <b>${num(n)}</b></span><span class="waffle-share">${g.note} · ${share(n)} of the named dead</span></div>`;
        const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true', focusable: 'false' }, block);
        for (let i = 0; i < squares; i++) {
          const c = i % cols, r = Math.floor(i / cols);
          el('rect', { x: c * (size + gap), y: r * (size + gap), width: size, height: size, rx: Math.min(2, size / 5), class: i < sa ? 'm-a' : 'm-b' }, svg);
        }
        const split = document.createElement('p');
        split.className = 'waffle-split';
        split.innerHTML = `<span class="k k--a"><b>${num(g.a)}</b> ${g.an}</span> · <span class="k k--b"><b>${num(g.b)}</b> ${g.bn}</span>`;
        block.append(split);
        wrap.append(block);
      });
      plot.append(wrap);
    };
    responsive(fig, render);
  })();

  // ======================================================================
  // 4. West Bank: killings and settler attacks per month, on their own scales
  // ======================================================================
  (() => {
    const fig = document.getElementById('wb-chart');
    if (!fig) return;
    const wb = D.west_bank_daily;
    const lastReport = '2026-09-14';
    const months = new Map();
    wb.forEach((r, i) => {
      if (r.date > lastReport) return;   // later days repeat the last report
      const k = monthStart(t(r.date));
      let b = months.get(k);
      if (!b) months.set(k, b = { start: k, killed: 0, attacks: 0 });
      b.killed += i ? Math.max(0, r.killed_cum - wb[i - 1].killed_cum) : r.killed_cum;
      b.attacks += i ? Math.max(0, r.settler_attacks_cum - wb[i - 1].settler_attacks_cum) : r.settler_attacks_cum;
    });
    const data = [...months.values()];
    const partial = b => iso(nextMonth(b.start) - DAY) > lastReport;
    const panels = [
      { key: 'killed', title: 'Palestinians killed per month', cls: 'm-new', unit: 'killed' },
      { key: 'attacks', title: 'Settler attacks per month (incidents, not deaths)', cls: 'm-incident', unit: 'settler attacks' },
    ];
    let view = null;
    const render = (plot, w) => {
      const phone = w < 640, PH = phone ? 130 : 150, gapY = 44, m = { t: 28, r: 2, b: 28, l: 2 };
      const H = m.t + PH * 2 + gapY + m.b;
      const step = (w - m.l - m.r) / data.length, bw = Math.max(step - (step > 8 ? 2 : 1), 1);
      const svg = svgFor(plot, w, H, `West Bank, per month since October 2023. Palestinians killed: highest ${num(Math.max(...data.map(b => b.killed)))}, most recent full month ${num(data[data.length - 2].killed)}. Settler attacks: highest ${num(Math.max(...data.map(b => b.attacks)))}, most recent full month ${num(data[data.length - 2].attacks)}.`);
      const barsG = el('g', { class: 'bars' }, svg);
      const scales = panels.map((p, pi) => {
        const top = m.t + pi * (PH + gapY), base = top + PH;
        const peak = data.reduce((a, b) => (b[p.key] > a[p.key] ? b : a));
        const yt = niceTicks(peak[p.key], 2), ymax = yt[yt.length - 1];
        const ys = v => base - (v / ymax) * PH;
        label(svg, m.l, top - 14, p.title, 't-label');
        yt.slice(1).forEach(v => { el('line', { x1: m.l, x2: w - m.r, y1: ys(v), y2: ys(v), class: 'grid' }, svg); label(svg, w - m.r, ys(v) - 6, num(v), 't-unit t-halo', { 'text-anchor': 'end' }); });
        data.forEach((b, i) => {
          const h = base - ys(b[p.key]);
          el('rect', { x: m.l + i * step, y: base - h, width: bw, height: h, class: p.cls, style: `--i:${i * 3}`, opacity: partial(b) ? 0.45 : null }, barsG);
        });
        el('line', { x1: m.l, x2: w - m.r, y1: base, y2: base, class: 'baseline' }, svg);
        // label the highest month directly
        const i = data.indexOf(peak), x = m.l + i * step;
        const t1 = label(svg, x + bw + 4, ys(peak[p.key]) + 4, `${num(peak[p.key])} in ${monthLabel(peak.start)}`, 't-value t-halo');
        if (x + bw + 4 + t1.getComputedTextLength() > w - m.r - 40) { t1.setAttribute('x', x - 4); t1.setAttribute('text-anchor', 'end'); }
        return { ys, base };
      });
      for (let y = 2024; Date.UTC(y, 0, 1) <= data[data.length - 1].start; y++) {
        const i = data.findIndex(b => b.start === Date.UTC(y, 0, 1));
        label(svg, m.l + i * step, H - 8, String(y), 't-unit');
      }
      label(svg, m.l, H - 8, phone ? '' : 'Oct 2023', 't-unit');
      const focus = el('rect', { class: 'focus-bar', visibility: 'hidden' }, svg);
      const hit = el('rect', { x: m.l, y: m.t - 8, width: w - m.l - m.r, height: H - m.t - m.b + 8, fill: 'transparent' }, svg);
      hit.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(); const i = Math.floor((((e.clientX - r.left) / r.width) * w - m.l) / step); if (i >= 0 && i < data.length) picker.set(i); });
      hit.addEventListener('pointerleave', () => picker.set(-1));
      view = { step, bw, m, H, focus };
    };
    const picker = pickable(fig, () => data.length, i => {
      const b = data[i];
      Object.entries({ x: view.m.l + i * view.step - 1, y: view.m.t - 8, width: view.bw + 2, height: view.H - view.m.t - view.m.b + 8 }).forEach(([k, v]) => view.focus.setAttribute(k, v));
      view.focus.setAttribute('visibility', 'visible');
      return `${monthLabel(b.start, true)}${partial(b) ? ' (to the 14th)' : ''}: <b>${num(b.killed)}</b> Palestinians killed · <b>${num(b.attacks)}</b> settler attacks`;
    }, 'Point to a month, or use the arrow keys, to read both counts.');
    const hide = () => { if (picker.get() < 0 && view) view.focus.setAttribute('visibility', 'hidden'); };
    fig.addEventListener('keydown', hide); fig.addEventListener('blur', hide); fig.addEventListener('pointerleave', hide);
    responsive(fig, render);
  })();

  // ======================================================================
  // 5. Sources: the estimate beside the count for the same period
  // ======================================================================
  (() => {
    const fig = document.getElementById('sources-chart');
    if (!fig) return;
    const lancet = D.trackers.find(r => /lancet/i.test(r.name));
    const rows = [
      { text: 'Ministry of Health count', sub: 'to January 31, 2025', v: cumOn('2025-01-31'), kind: 'count' },
      lancet && { text: 'Lancet estimate, violent deaths', sub: 'to January 2025 · window and interval to confirm', v: lancet.palestinian_killed, kind: 'estimate' },
      { text: 'Ministry of Health count', sub: `to ${dayLabel(t(asOf))}`, v: cumOn(asOf), kind: 'count' },
    ].filter(Boolean);
    const render = (plot, w) => {
      const phone = w < 900, labelW = phone ? 0 : Math.min(300, w * 0.36), rowH = phone ? 72 : 52, m = { t: 8, r: 64, b: 28 };
      const H = m.t + rows.length * rowH + m.b;
      const max = Math.max(...rows.map(r => r.v)), xt = niceTicks(max * 1.05, phone ? 3 : 4), xmax = xt[xt.length - 1];
      const xs = v => labelW + (v / xmax) * (w - labelW - m.r);
      const svg = svgFor(plot, w, H, rows.map(r => `${r.text} ${r.sub}: ${num(r.v)}`).join('; '));
      xt.forEach(v => { el('line', { x1: xs(v), x2: xs(v), y1: m.t, y2: H - m.b, class: 'grid' }, svg); label(svg, xs(v), H - 8, v === 0 ? '0' : `${num(v / 1000)}k`, 't-unit', { 'text-anchor': v === 0 ? 'start' : 'middle' }); });
      rows.forEach((r, i) => {
        const y = m.t + i * rowH + (phone ? 48 : rowH / 2);
        const tx = phone ? 0 : labelW - 16, anchor = phone ? 'start' : 'end';
        label(svg, tx, phone ? y - 30 : y - 2, r.text, 't-label', { 'text-anchor': anchor });
        label(svg, tx, phone ? y - 14 : y + 14, r.sub, 't-unit', { 'text-anchor': anchor });
        el('line', { x1: xs(0), x2: xs(r.v), y1: y, y2: y, class: 'stem' }, svg);
        el('circle', { cx: xs(r.v), cy: y, r: 6, class: r.kind === 'count' ? 'dot-count' : 'dot-estimate' }, svg);
        label(svg, xs(r.v) + 12, y + 4, num(r.v), 't-value');
      });
    };
    responsive(fig, render);
  })();
}
