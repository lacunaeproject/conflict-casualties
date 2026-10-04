/* =========================================================
   Story charts (index.html). Each .scene[data-viz] gets a chart drawn
   at the size of the screen. Every mark is present from the start;
   the beats only change which marks are lit (data-state on the scene).
   Nothing accumulates and no number counts.
   The aggregations are the same as viz.js, so every figure matches
   the record: weekly totals from cumulative counts in UTC days, the
   Ministry's daily breakdowns since January 2025, OCHA monthly sums.
   ========================================================= */
window.StoryViz = (function () {
  const NS = 'http://www.w3.org/2000/svg', DAY = 864e5;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const t = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const iso = ms => new Date(ms).toISOString().slice(0, 10);
  const monday = ms => ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY;
  const monthStart = ms => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
  const nextMonth = ms => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); };
  const dayLabel = ms => { const d = new Date(ms); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
  const num = n => new Intl.NumberFormat('en-US').format(Math.round(n));
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const text = (p, x, y, s, cls, anchor = 'start') => { const e = el('text', { x, y, class: cls, 'text-anchor': anchor }, p); e.textContent = s; return e; };
  const niceMax = v => { const p = 10 ** Math.floor(Math.log10(v)), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };
  const svgIn = box => {
    box.textContent = '';
    const w = Math.round(box.clientWidth), h = Math.round(box.clientHeight);
    return { s: el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true', focusable: 'false' }, box), w, h };
  };
  // Fill a box with n squares in a grid, largest cell that fits
  const fitGrid = (n, w, h) => { let c = Math.sqrt((w * h) / n); while (Math.floor(w / c) * Math.floor(h / c) < n) c *= 0.98; return { c, cols: Math.floor(w / c) }; };

  let D, gaza, asOf, cumOn, comp;
  const CEASEFIRE = '2025-10-10';
  const values = {};

  // ---------- Builders: draw(box) and state(box, value) ----------
  const B = {};

  B.oct7 = {
    draw(box) {
      const o = D.oct7, groups = [['civ', o.israeli_civilians], ['sec', o.israeli_security_forces], ['for', o.foreign_nationals + o.other_and_revised]];
      const n = groups.reduce((a, g) => a + g[1], 0);
      const { s, w, h } = svgIn(box);
      const { c, cols } = fitGrid(n, w, h);
      const x0 = (w - cols * c) / 2, size = c * 0.78;
      let i = 0;
      groups.forEach(([key, count]) => {
        for (let k = 0; k < count; k++, i++) el('rect', { x: x0 + (i % cols) * c, y: Math.floor(i / cols) * c, width: size, height: size, rx: Math.min(1.5, size / 5), class: `sv-sq sv-isr g-${key}` }, s);
      });
    },
  };

  // Deaths reported per week (months on phones), as viz.js
  const series = unit => {
    const buckets = new Map();
    gaza.forEach((r, i) => {
      const v = i ? Math.max(0, r.killed_cum - gaza[i - 1].killed_cum) : r.killed_cum;
      const key = unit === 'week' ? monday(t(r.date)) : monthStart(t(r.date));
      let b = buckets.get(key);
      if (!b) buckets.set(key, b = { start: key, total: 0 });
      b.total += v;
    });
    const out = [...buckets.values()];
    out.forEach(b => { b.end = (unit === 'week' ? b.start + 7 * DAY : nextMonth(b.start)) - DAY; });
    if (iso(out[out.length - 1].end) > asOf) out.pop();
    return out;
  };
  const totalBetween = (from, to) => cumOn(to > asOf ? asOf : to) - cumOn(iso(t(from) - DAY));

  B.pace = {
    draw(box) {
      const { s, w, h } = svgIn(box);
      const unit = w < 640 ? 'month' : 'week', data = series(unit);
      const m = { t: 40, r: 44, b: 28, l: 0 };
      const ymax = niceMax(Math.max(...data.map(b => b.total)));
      const ys = v => h - m.b - (v / ymax) * (h - m.b - m.t);
      const t0 = data[0].start, t1 = data[data.length - 1].end + DAY;
      const xs = ms => m.l + ((ms - t0) / (t1 - t0)) * (w - m.l - m.r);
      [ymax / 2, ymax].forEach(v => { el('line', { x1: m.l, x2: w - m.r, y1: ys(v), y2: ys(v), class: 'sv-grid' }, s); text(s, w, ys(v) + 4, num(v), 'sv-t', 'end'); });
      text(s, w, ys(ymax) + 20, unit === 'week' ? 'a week' : 'a month', 'sv-t', 'end');
      const bars = el('g', {}, s);
      data.forEach(b => {
        const x = xs(b.start), bw = Math.max(1, xs(b.end + DAY) - x - (unit === 'week' ? 1 : 3));
        el('rect', { x, y: ys(b.total), width: bw, height: ys(0) - ys(b.total), class: 'sv-bar', 'data-s': b.start, 'data-e': b.end }, bars);
      });
      el('line', { x1: m.l, x2: w - m.r, y1: ys(0), y2: ys(0), class: 'sv-base' }, s);
      for (let y = 2024; Date.UTC(y, 0, 1) < t1; y++) text(s, xs(Date.UTC(y, 0, 1)), h - 6, String(y), 'sv-t', 'middle');
      el('g', { class: 'sv-bracket' }, s);
      box._pace = { xs, ys, w, m, s };
    },
    state(box, v) {
      const p = box._pace; if (!p) return;
      const br = p.s.querySelector('.sv-bracket'); br.textContent = '';
      const rects = p.s.querySelectorAll('.sv-bar');
      if (v === 'all') { rects.forEach(r => r.classList.remove('is-dim', 'is-on')); return; }
      const [from, to0] = v.split('|'), to = to0 > asOf ? asOf : to0;
      const a = t(from), b = t(to);
      rects.forEach(r => { const out = +r.dataset.e < a || +r.dataset.s > b; r.classList.toggle('is-dim', out); r.classList.toggle('is-on', !out); });
      const x0 = Math.max(p.xs(a), p.m.l), x1 = Math.min(p.xs(b + DAY), p.w - p.m.r), y = 22;
      el('path', { d: `M${x0 + 0.5},${y + 8}V${y}H${x1 - 0.5}V${y + 8}`, class: 'sv-brk' }, br);
      const lab = text(br, (x0 + x1) / 2, y - 8, `${num(totalBetween(from, to))} reported`, 'sv-v', 'middle');
      const lw = lab.getComputedTextLength();
      lab.setAttribute('x', Math.min(Math.max((x0 + x1) / 2, lw / 2), p.w - p.m.r - lw / 2));
    },
  };

  B.ceasefire = {
    draw(box) {
      const months = new Map();
      gaza.forEach((r, i, a) => {
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
      const { s, w, h } = svgIn(box);
      const m = { t: 28, r: 44, b: 28, l: 0 };
      const peak = Math.max(...data.map(b => b.total)), ymax = niceMax(peak);
      const ys = v => h - m.b - (v / ymax) * (h - m.b - m.t);
      const step = (w - m.l - m.r) / data.length, bw = Math.min(step * 0.7, 64), narrow = step < 44;
      [ymax / 2, ymax].forEach(v => { el('line', { x1: m.l, x2: w - m.r, y1: ys(v), y2: ys(v), class: 'sv-grid' }, s); text(s, w, ys(v) + 4, num(v), 'sv-t', 'end'); });
      text(s, w, ys(ymax) + 20, 'a month', 'sv-t', 'end');
      data.forEach((b, i) => {
        const x = m.l + i * step + (step - bw) / 2;
        let y = ys(0);
        [['nw', 'sv-new'], ['rec', 'sv-rec'], ['rev', 'sv-rev'], ['unsplit', 'sv-uns']].forEach(([k, cls]) => {
          if (!b[k]) return;
          const hh = ys(0) - ys(b[k]);
          el('rect', { x, y: y - hh, width: bw, height: hh, class: `sv-stack ${cls}` }, s);
          y -= hh;
        });
        if (!narrow || b.total === peak || i === data.length - 1) text(s, x + bw / 2, ys(b.total) - 8, num(b.total), 'sv-v', 'middle');
        const d = new Date(b.start), mo = MONTHS[d.getUTCMonth()];
        text(s, x + bw / 2, h - 6, narrow ? mo[0] : d.getUTCMonth() === 0 || i === 0 ? `${mo} ’${String(d.getUTCFullYear()).slice(2)}` : mo, 'sv-t', 'middle');
      });
      el('line', { x1: m.l, x2: w - m.r, y1: ys(0), y2: ys(0), class: 'sv-base' }, s);
    },
  };

  B.named = {
    draw(box) {
      const k = D.summary.known_killed_in_gaza;
      const groups = [
        ['child', 'Children', 'under 18', k.male.child, k.female.child, 'boys', 'girls'],
        ['adult', 'Adults', '18 to 59', k.male.adult, k.female.adult, 'men', 'women'],
        ['senior', 'Older people', '60 and over', k.male.senior, k.female.senior, 'men', 'women'],
      ].map(g => ({ key: g[0], name: g[1], note: g[2], a: g[3], b: g[4], an: g[5], bn: g[6], sa: Math.round(g[3] / 100), sb: Math.round(g[4] / 100) }));
      const { s, w, h } = svgIn(box);
      const head = 30, gapG = 18;
      let c = 40, cols, rowsOf;
      for (; c > 3; c *= 0.97) {
        cols = Math.floor(w / c);
        rowsOf = g => Math.ceil((g.sa + g.sb) / cols);
        if (groups.reduce((a, g) => a + head + rowsOf(g) * c + gapG, 0) <= h) break;
      }
      let y = 0;
      const size = c * 0.8;
      groups.forEach(g => {
        const gEl = el('g', { class: `sv-group g-${g.key}` }, s);
        text(gEl, 0, y + 16, `${g.name} ${num(g.a + g.b)}`, 'sv-l');
        text(gEl, w, y + 16, g.note, 'sv-t', 'end');
        y += head;
        for (let i = 0; i < g.sa + g.sb; i++) el('rect', { x: (i % cols) * c, y: y + Math.floor(i / cols) * c, width: size, height: size, rx: Math.min(2, size / 5), class: `sv-sq ${i < g.sa ? 'sv-a' : 'sv-b'}` }, gEl);
        y += rowsOf(g) * c + gapG;
      });
    },
  };

  B.westbank = {
    draw(box) {
      const wb = D.west_bank_daily, lastReport = '2026-09-14';
      const months = new Map();
      wb.forEach((r, i) => {
        if (r.date > lastReport) return;
        const k = monthStart(t(r.date));
        let b = months.get(k);
        if (!b) months.set(k, b = { start: k, killed: 0, attacks: 0 });
        b.killed += i ? Math.max(0, r.killed_cum - wb[i - 1].killed_cum) : r.killed_cum;
        b.attacks += i ? Math.max(0, r.settler_attacks_cum - wb[i - 1].settler_attacks_cum) : r.settler_attacks_cum;
      });
      const data = [...months.values()];
      const partial = b => iso(nextMonth(b.start) - DAY) > lastReport;
      const { s, w, h } = svgIn(box);
      const gapY = 56, top = 26, PH = (h - top - gapY - 26) / 2;
      const step = w / data.length, bw = Math.max(step - (step > 8 ? 3 : 1), 1);
      [['killed', 'Palestinians killed per month', 'sv-wbk'], ['attacks', 'Settler attacks per month', 'sv-wba']].forEach(([key, title, cls], pi) => {
        const g = el('g', { class: `sv-panel p-${key}` }, s);
        const y0 = top + pi * (PH + gapY), base = y0 + PH;
        const peak = data.reduce((a, b) => (b[key] > a[key] ? b : a)), ymax = niceMax(peak[key]);
        const ys = v => base - (v / ymax) * PH;
        text(g, 0, y0 - 10, title, 'sv-l');
        el('line', { x1: 0, x2: w, y1: ys(ymax), y2: ys(ymax), class: 'sv-grid' }, g);
        text(g, w, ys(ymax) - 6, num(ymax), 'sv-t', 'end');
        data.forEach((b, i) => {
          el('rect', { x: i * step, y: ys(b[key]), width: bw, height: base - ys(b[key]), class: `sv-bar ${cls}${partial(b) ? ' sv-partial' : ''}` }, g);
        });
        el('line', { x1: 0, x2: w, y1: base, y2: base, class: 'sv-base' }, g);
        const i = data.indexOf(peak), x = i * step;
        const d = new Date(peak.start);
        const lab = text(g, x + bw + 6, ys(peak[key]) + 10, `${num(peak[key])} in ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`, 'sv-v');
        if (x + bw + 6 + lab.getComputedTextLength() > w - 40) { lab.setAttribute('x', x - 6); lab.setAttribute('text-anchor', 'end'); }
      });
      for (let y = 2024; Date.UTC(y, 0, 1) <= data[data.length - 1].start; y++) {
        const i = data.findIndex(b => b.start === Date.UTC(y, 0, 1));
        text(s, i * step, h - 6, String(y), 'sv-t');
      }
    },
  };

  B.century = {
    draw(box) {
      const rows = [
        ['1936–39', 'Revolt against British rule', '~5,000', 5000],
        ['1947–49', 'Partition and al-Nakba', '15,000', 15000],
        ['1982', 'Invasion of Lebanon (all killed)', '~18,000', 18000],
        ['1987–93', 'First intifada', '1,100+', 1100],
        ['2000–05', 'Second intifada', '~3,000', 3000],
        ['2014', 'War on Gaza, 51 days', '2,251', 2251],
        ['2023–', 'War on Gaza', num(D.summary.gaza.killed.total), D.summary.gaza.killed.total],
      ];
      const { s, w, h } = svgIn(box);
      const phone = w < 640, labelW = phone ? 64 : Math.min(300, w * 0.3), valW = phone ? 64 : 84;
      const rowH = Math.min(64, h / rows.length), barH = Math.max(6, rowH * (phone ? 0.42 : 0.36));
      const max = rows[rows.length - 1][3];
      const xs = v => labelW + (v / max) * (w - labelW - valW);
      rows.forEach((r, i) => {
        const last = i === rows.length - 1, y = i * rowH + rowH / 2;
        const g = el('g', { class: `sv-row${last ? ' sv-now' : ''}` }, s);
        if (phone) { text(g, labelW - 10, y + 4, r[0], 'sv-l', 'end'); }
        else { text(g, labelW - 16, y - 2, r[0], 'sv-l', 'end'); text(g, labelW - 16, y + 14, r[1], 'sv-t', 'end'); }
        el('rect', { x: labelW, y: y - barH / 2, width: Math.max(2, xs(r[3]) - labelW), height: barH, rx: 2, class: 'sv-hbar' }, g);
        text(g, xs(r[3]) + 10, y + 5, r[2], 'sv-v');
      });
    },
  };

  B.sources = {
    draw(box) {
      const lancet = (D.trackers || []).find(r => /lancet/i.test(r.name));
      const rows = [
        { a: 'Ministry of Health count', b: 'to January 31, 2025', v: cumOn('2025-01-31'), kind: 'count', key: 'moh1' },
        lancet && { a: 'Lancet estimate, violent deaths', b: 'to January 2025', v: lancet.palestinian_killed, kind: 'estimate', key: 'lancet' },
        { a: 'Ministry of Health count', b: `to ${dayLabel(t(asOf))}`, v: cumOn(asOf), kind: 'count', key: 'moh2' },
      ].filter(Boolean);
      const { s, w, h } = svgIn(box);
      const phone = w < 640, labelW = phone ? 0 : Math.min(300, w * 0.32), m = { r: 80, b: 26 };
      const rowH = Math.min(90, (h - m.b) / rows.length);
      const xmax = niceMax(Math.max(...rows.map(r => r.v)) * 1.05);
      const xs = v => labelW + (v / xmax) * (w - labelW - m.r);
      [0, xmax / 4, xmax / 2, (xmax * 3) / 4, xmax].forEach(v => {
        el('line', { x1: xs(v), x2: xs(v), y1: 0, y2: rows.length * rowH, class: 'sv-grid' }, s);
        text(s, xs(v), rows.length * rowH + 18, v ? `${num(v / 1000)}k` : '0', 'sv-t', v ? 'middle' : 'start');
      });
      rows.forEach((r, i) => {
        const y = i * rowH + (phone ? rowH * 0.7 : rowH / 2), g = el('g', { class: `sv-src s-${r.key}` }, s);
        if (phone) { text(g, 0, y - 22, `${r.a}, ${r.b}`, 'sv-l'); }
        else { text(g, labelW - 16, y - 2, r.a, 'sv-l', 'end'); text(g, labelW - 16, y + 14, r.b, 'sv-t', 'end'); }
        el('line', { x1: xs(0), x2: xs(r.v), y1: y, y2: y, class: 'sv-stem' }, g);
        el('circle', { cx: xs(r.v), cy: y, r: 7, class: r.kind === 'count' ? 'sv-dot' : 'sv-dot sv-dot--est' }, g);
        text(g, xs(r.v) + 14, y + 5, num(r.v), 'sv-v');
      });
    },
  };

  // ---------- Public ----------
  const boxes = [];
  function init(data) {
    D = data; gaza = D.gaza_daily; asOf = gaza[gaza.length - 1].date;
    const cum = new Map(gaza.map(r => [r.date, r.killed_cum]));
    cumOn = s => (cum.has(s) ? cum.get(s) : s < gaza[0].date ? 0 : cum.get(asOf));
    comp = new Map(D.gaza_components.map(c => [c.date, c]));

    // Words the beats use
    const o = D.oct7, k = D.summary.known_killed_in_gaza, g = D.summary.gaza;
    const after = D.gaza_components.filter(c => c.date > CEASEFIRE);
    const sum = (rows, f) => rows.reduce((a, r) => a + f(r), 0);
    const war = D.gaza_components.filter(c => c.date >= '2025-03-18' && c.date <= '2025-10-09');
    const warDays = (t('2025-10-09') - t('2025-03-18')) / DAY + 1, days = (t(asOf) - t(CEASEFIRE)) / DAY;
    const cfTotal = cumOn(asOf) - cumOn(CEASEFIRE), cfNew = sum(after, c => c.new + c.succumbed);
    const oneIn = Math.round(cfTotal / cfNew);
    const lancet = (D.trackers || []).find(r => /lancet/i.test(r.name));
    const wb = D.west_bank_daily.at(-1);
    Object.assign(values, {
      oct7civ: num(o.israeli_civilians), oct7sec: num(o.israeli_security_forces), oct7for: num(o.foreign_nationals + o.other_and_revised),
      oct7kids: num(o.children_killed), oct7nova: num(o.nova_festival_killed), oct7inj: num(o.injured),
      aid: num(g.aid_seeker.killed),
      rateWar: `~${num(sum(war, c => c.new) / warDays)}`, rateNow: `~${num(sum(after, c => c.new) / days)}`,
      cfTotal: num(cfTotal), cfSuccumbed: num(sum(after, c => c.succumbed)),
      cfOneIn: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][oneIn] || String(oneIn),
      named: num(['male', 'female'].reduce((a, s) => a + k[s].adult + k[s].senior + k[s].child, 0)),
      namedKids: num(k.male.child + k.female.child), boys: num(k.male.child), girls: num(k.female.child),
      namedAdults: num(k.male.adult + k.female.adult), men: num(k.male.adult), womenAdult: num(k.female.adult),
      namedOld: num(k.male.senior + k.female.senior), namedUntil: dayLabel(t(k.includes_until)),
      wbKilled: num(wb.killed_cum), wbAttacks: num(wb.settler_attacks_cum),
      mohJan25: num(cumOn('2025-01-31')), lancet: lancet ? num(lancet.palestinian_killed) : '',
    });
    // The pace beats' figures, by the same formula as the record's scroll steps
    const steps = [['2023-10-07', '2023-12-31'], ['2024-01-01', '2024-12-31'], ['2025-01-19', '2025-03-17'], ['2025-03-18', '2025-10-09'], ['2025-10-10', '9999-12-31']];
    document.querySelectorAll('[data-p]').forEach(n => {
      const [i, key] = n.dataset.p.split(':'), [from, to0] = steps[+i], to = to0 > asOf ? asOf : to0;
      const total = totalBetween(from, to), d = (t(to) - t(from)) / DAY + 1;
      n.textContent = num({ total, perday: total / d, permonth: total / (d / 30.44) }[key]);
    });

    document.querySelectorAll('.scene[data-viz]').forEach(sc => {
      const b = B[sc.dataset.viz], box = sc.querySelector('.st-viz');
      if (!b || !box) return;
      const render = () => { b.draw(box); if (b.state && sc.dataset.state) b.state(box, sc.dataset.state); };
      let wPrev = 0, hPrev = 0;
      new ResizeObserver(() => { const w = box.clientWidth, h = box.clientHeight; if (w && h && (w !== wPrev || Math.abs(h - hPrev) > 40)) { wPrev = w; hPrev = h; render(); } }).observe(box);
      boxes.push({ sc, b, box });
    });
    return values;
  }
  function state(sc, v) {
    const it = boxes.find(x => x.sc === sc);
    if (it && it.b.state) it.b.state(it.box, v);
  }
  return { init, state };
})();
