/* =========================================================
   Conflict Casualties — interactive dashboard
   ========================================================= */

// --- Color tokens (mirror CSS) ---
// Dark palette follows the system setting on pages that use the product theme
// (html.rd). Charts read it once at load.
const DARK = typeof document !== 'undefined' && document.documentElement.classList.contains('rd') &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;
const T = (light, dark) => (DARK ? dark : light);

const C = {
  pal: T('#4a5831', '#aebd86'),
  palSoft: T('#9aa67c', '#6b7650'),
  palBg: T('rgba(16, 19, 23, 0.035)', 'rgba(174, 189, 134, 0.08)'),
  isr: T('#2f5577', '#93b3d3'),
  isrSoft: T('#7891a8', '#5a7690'),
  isrBg: 'rgba(47, 85, 119, 0.07)',
  children: '#9a6420',
  women: '#6e5a3c',
  press: '#3f6446',
  medical: '#5e4a70',
  ink: T('#16181b', '#eef0f3'),
  ink3: T('#5c6168', '#a3a9b2'),
  ink4: T('#767b82', '#8a9099'),
  rule: T('#e2e5e9', 'rgba(255,255,255,0.08)'),
  paper: T('#f3f4f6', '#16181c'),
};

Chart.defaults.font.family = '"Source Sans 3", sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = C.ink3;
Chart.defaults.borderColor = C.rule;

const fmt = n => new Intl.NumberFormat('en-US').format(Math.round(n));
// Parse YYYY-MM-DD as a LOCAL date (not UTC midnight), so US viewers don't see
// the previous day when we render the data-as-of stamp, annotations, etc.
// Pass-through anything that's already a Date or a timestamp number.
const toLocalDate = d => {
  if (d instanceof Date) return d;
  if (typeof d === 'number') return new Date(d);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
};
const fmtDate = d => toLocalDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const shortDate = d => toLocalDate(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
const pct = (n, total) => `${Math.round((n / total) * 100)}%`;

// Shared chart chrome: dark tooltip, mono ticks, hairline grid.
const TOOLTIP = {
  backgroundColor: T('#16181b', '#2a2d33'),
  titleColor: '#f3f4f6',
  bodyColor: '#f3f4f6',
  padding: 12,
  borderColor: 'rgba(255,255,255,0.12)',
  borderWidth: 1,
  cornerRadius: 12,
  caretSize: 5,
  titleMarginBottom: 6,
  boxPadding: 6,
  usePointStyle: true,
  titleFont: { family: '"Source Serif 4", serif', weight: '600', size: 13 },
  bodyFont: { family: '"Source Sans 3", sans-serif', size: 12 },
};
const MONO_TICKS = { color: T('#6b7078', '#8a9099'), font: { family: '"Source Sans 3", sans-serif', size: 12 } };
const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (REDUCED_MOTION) Chart.defaults.animation = false;
const GRID = { color: T('rgba(16,19,23,0.06)', 'rgba(255,255,255,0.07)') };

// --- Key events for annotations ---
const EVENTS = [
  { date: '2023-10-07', label: 'Hamas-led attacks on Israel', side: 'isr' },
  { date: '2023-10-27', label: 'IDF ground invasion begins', side: 'isr' },
  { date: '2024-05-06', label: 'Rafah offensive begins', side: 'pal' },
  { date: '2025-01-19', label: 'First ceasefire', side: 'neutral' },
  { date: '2025-03-18', label: 'War resumes', side: 'pal' },
  { date: '2025-10-10', label: 'Second ceasefire', side: 'neutral' },
];

let DATA = null;
let tsChart = null, govChart = null, wbChart = null, wbAttacksChart = null, paceChart = null;

// Phases of the war, used to color the monthly pace chart.
const TRUCES = [
  ['2025-01-19', '2025-03-18'],
  ['2025-10-10', '9999-12-31'],
];

// Current filter state
const state = {
  startIdx: 0,
  endIdx: 0,
  side: 'both',
  view: 'cum',
  scale: 'linear',
};

async function loadData() {
  const res = await fetch('data.json', { cache: 'no-cache' });
  DATA = await res.json();
  state.endIdx = DATA.gaza_daily.length - 1;
  init();
}

function init() {
  populateKPIs();
  populateOct7();
  populateWhoGrid();
  populateTrackers();
  buildRangeSlider();
  buildTimeSeriesChart();
  buildGovChart();
  buildWBChart();
  buildPaceChart();
  buildPyramid();
  bindStoryNumbers();
  buildDots();
  buildCenturyChart();
  buildNames();
  setupScrolly();
  setupCentury();
  buildLegendChips();
  bindControls();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => Object.values(Chart.instances || {}).forEach(c => c.update('none')));
  }
  document.getElementById('meta-date').textContent = fmtDate(DATA.meta.data_as_of);
  document.getElementById('meta-days').textContent = fmt(DATA.meta.days_of_data);
  updateAnnotations();
}

// --- Article prose: any element with data-bind="path.in.data" shows that
// number, so the story text updates whenever data.json is rebuilt.
// "calc.*" keys are derived values that don't live in data.json directly.
function bindStoryNumbers() {
  const named = DATA.summary.known_killed_in_gaza;
  const namedTotal = ['male', 'female'].reduce((s, k) => s + named[k].adult + named[k].senior + named[k].child, 0);
  const calc = {
    namedChildShare: pct(named.male.child + named.female.child, namedTotal),
    idfGaza: fmt(DATA.israeli_daily[DATA.israeli_daily.length - 1].idf_gaza_cum),
  };
  document.querySelectorAll('[data-bind]').forEach(el => {
    const path = el.dataset.bind.split('.');
    if (path[0] === 'calc') { if (calc[path[1]] != null) el.textContent = calc[path[1]]; return; }
    const v = path.reduce((o, k) => (o == null ? o : o[k]), DATA);
    if (typeof v === 'number') el.textContent = fmt(v);
    else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      el.textContent = fmtDate(v);
      if (el.tagName === 'TIME') el.setAttribute('datetime', v.slice(0, 10));
    }
  });
}

// --- KPIs ---
function populateKPIs() {
  const g = DATA.summary.gaza;
  const w = DATA.summary.west_bank;
  const il = DATA.israeli_daily[DATA.israeli_daily.length - 1];
  document.getElementById('kpi-gaza').textContent = fmt(g.killed.total);
  document.getElementById('kpi-gaza-children').textContent = fmt(g.killed.children);
  document.getElementById('kpi-gaza-women').textContent = fmt(g.killed.women);
  document.getElementById('kpi-wb').textContent = fmt(w.killed.total);
  document.getElementById('kpi-wb-children').textContent = fmt(w.killed.children);
  document.getElementById('kpi-wb-settler').textContent = fmt(w.settler_attacks);
  document.getElementById('kpi-oct7').textContent = fmt(DATA.oct7.total);
  document.getElementById('kpi-idf').textContent = fmt(il.idf_gaza_cum);
}

function populateOct7() { /* static in HTML */ }

function populateWhoGrid() {
  const g = DATA.summary.gaza;
  document.getElementById('who-children').textContent = fmt(g.killed.children);
  document.getElementById('who-women').textContent = fmt(g.killed.women);
  document.getElementById('who-press').textContent = fmt(g.killed.press);
  document.getElementById('who-medical').textContent = fmt(g.killed.medical);
  document.getElementById('who-civdef').textContent = fmt(g.killed.civil_defence);
  document.getElementById('who-famine').textContent = fmt(g.famine.total);
  document.getElementById('who-aid').textContent = fmt(g.aid_seeker.killed);
  document.getElementById('who-injured').textContent = fmt(g.injured.total);
}

function populateTrackers() {
  const body = document.getElementById('tracker-body');
  body.innerHTML = DATA.trackers.map(t => `
    <tr>
      <td class="tracker-name" data-label="Source"><a href="${t.url}" target="_blank" rel="noopener">${t.name}</a></td>
      <td class="num" data-label="Killed">${t.palestinian_killed != null ? fmt(t.palestinian_killed) : '—'}</td>
      <td class="num" data-label="Injured">${t.palestinian_injured != null ? fmt(t.palestinian_injured) : '—'}</td>
      <td data-label="Scope">${t.scope}</td>
      <td class="date" data-label="As of">${fmtDate(t.as_of)}</td>
    </tr>
  `).join('');
}

// --- Range slider ---
function buildRangeSlider() {
  const startEl = document.getElementById('range-start');
  const endEl = document.getElementById('range-end');
  const max = DATA.gaza_daily.length - 1;
  startEl.max = max; endEl.max = max;
  startEl.value = 0; endEl.value = max;

  const fill = document.querySelector('.range-fill');
  const MIN_GAP = 7;
  // `movingEnd` tells us which handle the user is currently dragging, so we know
  // which side to clamp. Without this, dragging the end handle past the start
  // left the chart with an empty (or inverted) slice.
  const update = (movingEnd) => {
    let s = +startEl.value, e = +endEl.value;
    if (e - s < MIN_GAP) {
      if (movingEnd) {
        e = Math.min(max, s + MIN_GAP);
        endEl.value = e;
      } else {
        s = Math.max(0, e - MIN_GAP);
        startEl.value = s;
      }
    }
    state.startIdx = s; state.endIdx = e;
    if (fill) {
      const pctA = (s / max) * 100;
      const pctB = (e / max) * 100;
      fill.style.left = pctA + '%';
      fill.style.width = (pctB - pctA) + '%';
    }
    updateReadouts();
    updateTimeSeries();
    updateAnnotations();
    // clear preset highlight if user dragged
    document.querySelectorAll('.preset').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-checked', 'false');
    });
  };
  // Year ticks under the track, so the handles have landmarks.
  const ticks = document.getElementById('range-ticks');
  if (ticks) {
    const days = DATA.gaza_daily.map(r => r.date);
    ticks.innerHTML = days
      .map((d, i) => (d.endsWith('-01-01') ? `<span style="left:${(i / max) * 100}%">${d.slice(0, 4)}</span>` : ''))
      .join('');
  }
  startEl.addEventListener('input', () => update(false));
  endEl.addEventListener('input', () => update(true));
  update(false);
}

function updateReadouts() {
  const startDate = DATA.gaza_daily[state.startIdx].date;
  const endDate = DATA.gaza_daily[state.endIdx].date;
  document.getElementById('readout-start').textContent = fmtDate(startDate);
  document.getElementById('readout-end').textContent = fmtDate(endDate);
  document.getElementById('pop-start').textContent = fmtDate(startDate);
  document.getElementById('pop-end').textContent = fmtDate(endDate);
  // Screen-reader-only announcement so users dragging the slider with
  // assistive tech hear the actual range, not just the raw index.
  const live = document.getElementById('range-announce');
  if (live) {
    live.textContent = `Showing ${fmtDate(startDate)} to ${fmtDate(endDate)}`;
  }
  // Mirror the same info into the inputs' aria-valuetext so each handle
  // announces as a real date rather than a number from 0 to 922.
  const startEl = document.getElementById('range-start');
  const endEl   = document.getElementById('range-end');
  if (startEl) startEl.setAttribute('aria-valuetext', fmtDate(startDate));
  if (endEl)   endEl.setAttribute('aria-valuetext', fmtDate(endDate));
}

function setRange(startDate, endDate) {
  const findIdx = d => {
    const target = toLocalDate(d).getTime();
    let best = 0, bestDiff = Infinity;
    DATA.gaza_daily.forEach((r, i) => {
      const diff = Math.abs(toLocalDate(r.date).getTime() - target);
      if (diff < bestDiff) { best = i; bestDiff = diff; }
    });
    return best;
  };
  state.startIdx = findIdx(startDate);
  state.endIdx = findIdx(endDate);
  document.getElementById('range-start').value = state.startIdx;
  document.getElementById('range-end').value = state.endIdx;
  const fill = document.querySelector('.range-fill');
  const max = DATA.gaza_daily.length - 1;
  if (fill) {
    const pctA = (state.startIdx / max) * 100;
    const pctB = (state.endIdx / max) * 100;
    fill.style.left = pctA + '%';
    fill.style.width = (pctB - pctA) + '%';
  }
  updateReadouts();
  updateTimeSeries();
  updateAnnotations();
}

// --- Time series chart ---
function buildTimeSeriesChart() {
  const ctx = document.getElementById('ts-chart').getContext('2d');
  const narrow = ctx.canvas.parentElement.clientWidth < 640;
  tsChart = new Chart(ctx, {
    type: 'line',
    data: { datasets: getTimeSeriesDatasets() },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP,
          callbacks: {
            title: (items) => fmtDate(items[0].parsed.x),
            label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
          },
        },
      },
      layout: { padding: { top: 26, right: narrow ? 8 : 210 } },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'month', tooltipFormat: 'PP' },
          grid: { display: false },
          border: { color: T('rgba(16,19,23,0.25)', 'rgba(255,255,255,0.22)') },
          ticks: { ...MONO_TICKS, maxRotation: 0, autoSkip: true, maxTicksLimit: narrow ? 4 : 7 },
        },
        y: yScaleOptions(false),
      },
      animation: { duration: 600, easing: 'easeOutQuart' },
      // Fewer x labels and no end labels on narrow screens.
      onResize: (c, size) => {
        c.options.scales.x.ticks.maxTicksLimit = size.width < 520 ? 4 : 7;
        c.options.layout.padding.right = size.width < 640 ? 8 : 210;
      },
    },
    plugins: [truceBands, eventMarkers, endLabels],
  });
}

// y axis for the main chart, shared by first build and the scale toggle so
// the ticks keep the same type after any control change.
function yScaleOptions(isLog) {
  return {
    type: isLog ? 'logarithmic' : 'linear',
    beginAtZero: !isLog,
    min: isLog ? 1 : 0,
    grid: GRID,
    border: { display: false },
    ticks: {
      ...MONO_TICKS,
      maxTicksLimit: isLog ? undefined : 5,
      callback: v => (!isLog || [1, 10, 100, 1e3, 1e4, 1e5].includes(v) ? fmt(v) : ''),
    },
  };
}

// Truce and ceasefire periods, shaded behind the lines.
const truceBands = {
  id: 'truceBands',
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea: area, scales: { x } } = chart;
    ctx.save();
    TRUCES.forEach(([a, b]) => {
      const x0 = Math.max(area.left, x.getPixelForValue(toLocalDate(a).getTime()));
      const end = b.startsWith('9999') ? x.max : toLocalDate(b).getTime();
      const x1 = Math.min(area.right, x.getPixelForValue(end));
      if (x1 <= x0) return;
      ctx.fillStyle = T('rgba(16, 19, 23, 0.045)', 'rgba(255, 255, 255, 0.05)');
      ctx.fillRect(x0, area.top, x1 - x0, area.bottom - area.top);
      if (x1 - x0 > 30) {
        ctx.fillStyle = T('#6b7078', '#8a9099');
        ctx.font = `600 ${x1 - x0 > 44 ? 11 : 10}px "Source Sans 3", sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(b.startsWith('9999') ? 'Ceasefire' : 'Truce', x0 + 6, area.top + 6);
      }
    });
    ctx.restore();
  },
};

// Direct labels at the right end of each visible line, nudged apart so
// the compressed Israeli and West Bank lines stay identifiable.
const endLabels = {
  id: 'endLabels',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea: area } = chart;
    if (chart.width < 640) return;
    const items = [];
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden || ds.hidden || !meta.data.length) return;
      const pt = meta.data[meta.data.length - 1];
      const last = ds.data[ds.data.length - 1];
      const text = i === 0 && state.view === 'cum' ? `${ds.label} · ${fmt(last.y)}` : ds.label;
      items.push({ y: pt.y, text, color: ds.borderColor });
    });
    // Stack upward from the baseline so labels of lines near zero don't collide.
    items.sort((a, b) => b.y - a.y);
    items.forEach((it, i) => {
      it.y = Math.min(it.y, area.bottom - 4);
      if (i > 0 && items[i - 1].y - it.y < 14) it.y = items[i - 1].y - 14;
    });
    ctx.save();
    ctx.font = '600 11px "Source Sans 3", sans-serif';
    ctx.textBaseline = 'middle';
    // Soft series colors are too light for 11px text; darken them for labels.
    const labelColor = c => (c === C.palSoft ? T('#5f6a44', '#8f9c6c') : c === C.isrSoft ? T('#4f6a84', '#7d98b3') : c);
    items.forEach(it => {
      ctx.fillStyle = labelColor(it.color);
      ctx.fillText(it.text, area.right + 8, it.y);
    });
    ctx.restore();
  },
};

// Numbered hairlines at key dates. Numbers match the list under the chart,
// so labels never collide on the plot itself.
const eventMarkers = {
  id: 'eventMarkers',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea: area, scales: { x } } = chart;
    const visible = visibleEvents();
    ctx.save();
    let lastBadge = -Infinity;
    visible.forEach((e, i) => {
      const px = x.getPixelForValue(toLocalDate(e.date).getTime());
      if (px < area.left - 1 || px > area.right + 1) return;
      // Nudge a badge sideways when two events sit close together (Oct 7 / Oct 27).
      const bx = Math.max(px, lastBadge + 21);
      lastBadge = bx;
      ctx.strokeStyle = T('rgba(22,24,27,0.2)', 'rgba(255,255,255,0.2)');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, area.top);
      ctx.lineTo(px, area.bottom);
      ctx.stroke();
      if (bx !== px) {
        ctx.beginPath();
        ctx.moveTo(px, area.top);
        ctx.lineTo(bx, area.top - 4);
        ctx.stroke();
      }
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(bx, area.top - 12, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = T('#ffffff', '#16181b');
      ctx.font = '600 10px "Source Sans 3", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), bx, area.top - 11.5);
    });
    ctx.restore();
  },
};

function applyScale() {
  if (!tsChart) return;
  tsChart.options.scales.y = yScaleOptions(state.scale === 'log');
}

function getTimeSeriesDatasets() {
  // Cumulative view: just slice and plot.
  const toCum = (arr, key) =>
    arr.slice(state.startIdx, state.endIdx + 1).map(r => ({ x: r.date, y: r[key] }));

  // Daily view: compute deltas against the PREVIOUS day in the full series, then slice.
  // This avoids showing 0 on the first visible day when the user applies a date range
  // (the old code sliced first, so the first visible day had no predecessor).
  const toDaily = (arr, key) =>
    arr.map((r, i) => ({
      x: r.date,
      y: i === 0 ? 0 : Math.max(0, r[key] - arr[i - 1][key]),
    })).slice(state.startIdx, state.endIdx + 1);

  const isDaily = state.view === 'daily';
  const pick = (arr, key) => (isDaily ? toDaily(arr, key) : toCum(arr, key));

  const mkPal = (label, arr, key, color, bg) => ({
    label,
    data: pick(arr, key),
    borderColor: color,
    backgroundColor: bg,
    fill: false,
    tension: 0.25,
    pointRadius: 0,
    pointHoverRadius: 5,
    pointHoverBackgroundColor: color,
    pointHoverBorderColor: '#fff',
    pointHoverBorderWidth: 2,
    borderWidth: 2,
    hidden: false,
    _side: label.includes('Israeli') ? 'isr' : 'pal',
  });

  const sets = [
    mkPal('Palestinians — Gaza', DATA.gaza_daily, 'killed_cum', C.pal, C.palBg),
    mkPal('Palestinians — West Bank', DATA.west_bank_daily, 'killed_cum', C.palSoft, 'transparent'),
    mkPal('Israelis — total (Oct 7 + IDF)', DATA.israeli_daily, 'total_cum', C.isr, 'transparent'),
    mkPal('Israeli soldiers — Gaza', DATA.israeli_daily, 'idf_gaza_cum', C.isrSoft, 'transparent'),
  ];
  sets.slice(1).forEach(ds => { ds.fill = false; });

  return sets.map(s => {
    if (state.side === 'pal' && s._side !== 'pal') s.hidden = true;
    if (state.side === 'isr' && s._side !== 'isr') s.hidden = true;
    return s;
  });
}

function updateTimeSeries() {
  if (!tsChart) return;
  tsChart.data.datasets = getTimeSeriesDatasets();
  applyScale();
  tsChart.update();
  buildLegendChips();
}

// --- Legend chips ---
function buildLegendChips() {
  const container = document.getElementById('legend-chips');
  container.innerHTML = '';
  // The legend is a toolbar of toggle buttons — each one shows / hides a
  // series on the chart. aria-pressed tells assistive tech whether the
  // series is currently visible.
  container.setAttribute('role', 'toolbar');
  container.setAttribute('aria-label', 'Chart series visibility');
  tsChart.data.datasets.forEach((ds, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'legend-chip' + (ds.hidden ? ' muted' : '');
    chip.setAttribute('aria-pressed', ds.hidden ? 'false' : 'true');
    chip.innerHTML = `<span class="swatch" style="background:${ds.borderColor}" aria-hidden="true"></span>${ds.label}`;
    chip.addEventListener('click', () => {
      const meta = tsChart.getDatasetMeta(i);
      meta.hidden = !meta.hidden;
      tsChart.update();
      chip.classList.toggle('muted');
      chip.setAttribute('aria-pressed', meta.hidden ? 'false' : 'true');
    });
    container.appendChild(chip);
  });
}

// --- Governorate chart (horizontal bar) ---
function buildGovChart() {
  const ctx = document.getElementById('gov-chart').getContext('2d');
  const data = [...DATA.governorate_estimates].sort((a, b) => b.estimated_killed - a.estimated_killed);
  govChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => {
        const short = d.name.replace(/\s*\(Gaza City\)/, '');
        return `${short}  ·  ${d.share_pct}%`;
      }),
      datasets: [{
        data: data.map(d => d.estimated_killed),
        backgroundColor: C.pal,
        borderRadius: 3,
        barPercentage: 0.72,
        categoryPercentage: 0.85,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { left: 8, right: 64, top: 4, bottom: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP,
          displayColors: false,
          callbacks: {
            title: (items) => data[items[0].dataIndex].name,
            label: (ctx) => `~${fmt(ctx.parsed.x)} killed · ${data[ctx.dataIndex].share_pct}% of total`,
          },
        },
      },
      scales: {
        x: { display: false, beginAtZero: true },
        y: {
          grid: { display: false },
          ticks: {
            color: C.ink,
            font: { size: 12, weight: '500' },
            padding: 6,
            autoSkip: false,
          },
          afterFit: (axis) => { axis.width = Math.max(axis.width, 140); },
        },
      },
    },
    plugins: [{
      id: 'barValues',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        ctx.save();
        ctx.font = '500 11px "IBM Plex Mono", monospace';
        ctx.fillStyle = C.ink3;
        ctx.textBaseline = 'middle';
        chart.getDatasetMeta(0).data.forEach((bar, i) => {
          ctx.fillText(`~${fmt(data[i].estimated_killed)}`, bar.x + 8, bar.y);
        });
        ctx.restore();
      },
    }],
  });
}

// --- West Bank: two small multiples, one scale each ---
function buildWBChart() {
  const wb = DATA.west_bank_daily;
  const last = wb[wb.length - 1];
  document.getElementById('wb-killed-total').textContent = fmt(last.killed_cum);
  document.getElementById('wb-attacks-total').textContent = fmt(last.settler_attacks_cum);
  wbChart = smallLine('wb-chart', wb.map(r => ({ x: r.date, y: r.killed_cum })), 'Palestinians killed', C.pal, C.palBg);
  wbAttacksChart = smallLine('wb-attacks-chart', wb.map(r => ({ x: r.date, y: r.settler_attacks_cum })), 'Settler attacks', C.ink3, T('rgba(16, 19, 23, 0.035)', 'rgba(255, 255, 255, 0.04)'));
}

function smallLine(id, points, label, color, bg) {
  return new Chart(document.getElementById(id).getContext('2d'), {
    type: 'line',
    data: {
      datasets: [{
        label, data: points,
        borderColor: color, backgroundColor: bg, fill: true,
        tension: 0.25, pointRadius: 0, pointHoverRadius: 4,
        pointHoverBackgroundColor: color, pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP,
          displayColors: false,
          callbacks: {
            title: (items) => fmtDate(items[0].parsed.x),
            label: (ctx) => `${label}: ${fmt(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { type: 'time', time: { unit: 'year' }, grid: { display: false }, ticks: { ...MONO_TICKS, maxRotation: 0 } },
        y: { beginAtZero: true, grid: GRID, border: { display: false }, ticks: { ...MONO_TICKS, maxTicksLimit: 4, callback: v => fmt(v) } },
      },
    },
  });
}

// --- Pace: deaths reported per month in Gaza ---
function monthlyDeaths() {
  const out = [];
  const g = DATA.gaza_daily;
  g.forEach((r, i) => {
    const key = r.date.slice(0, 7);
    const delta = i === 0 ? r.killed_cum : Math.max(0, r.killed_cum - g[i - 1].killed_cum);
    const lastBucket = out[out.length - 1];
    if (lastBucket && lastBucket.key === key) { lastBucket.total += delta; lastBucket.days += 1; }
    else out.push({ key, total: delta, days: 1 });
  });
  return out;
}

// A month counts as truce when most of its days fall inside a truce window.
function isTruceMonth(key) {
  const [y, m] = key.split('-').map(Number);
  const daysIn = new Date(y, m, 0).getDate();
  let inTruce = 0;
  for (let d = 1; d <= daysIn; d++) {
    const iso = `${key}-${String(d).padStart(2, '0')}`;
    if (TRUCES.some(([a, b]) => iso >= a && iso < b)) inTruce++;
  }
  return inTruce > daysIn / 2;
}

// Months currently spotlighted by the scrolly story (null = all).
let paceRange = null;
const inPaceRange = key => !paceRange || (key >= paceRange[0] && key <= paceRange[1]);
const monthLabel = key => toLocalDate(`${key}-01`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

function paceColors(months) {
  return months.map(m => {
    if (!inPaceRange(m.key)) return T('#dde1e5', '#2c3036');
    return isTruceMonth(m.key) ? C.palSoft : C.pal;
  });
}

function buildPaceChart() {
  const months = monthlyDeaths();

  // Label the tallest bar inside the spotlighted range, and when a story
  // step is active, bracket its months with their total.
  const peakLabel = {
    id: 'peakLabel',
    afterDatasetsDraw(chart) {
      const inRange = months.filter(m => inPaceRange(m.key));
      if (!inRange.length) return;
      if (paceRange) {
        const meta = chart.getDatasetMeta(0).data;
        const first = meta[months.indexOf(inRange[0])], lastBar = meta[months.indexOf(inRange[inRange.length - 1])];
        if (first && lastBar) {
          const { ctx: c, chartArea: area } = chart;
          const x0 = first.x - first.width / 2, x1 = lastBar.x + lastBar.width / 2;
          const y = area.top + 4;
          const total = inRange.reduce((a, m) => a + m.total, 0);
          c.save();
          c.strokeStyle = C.ink; c.lineWidth = 1;
          c.beginPath(); c.moveTo(x0, y + 6); c.lineTo(x0, y); c.lineTo(x1, y); c.lineTo(x1, y + 6); c.stroke();
          c.fillStyle = C.ink;
          c.font = '600 12px "Source Sans 3", sans-serif';
          c.textBaseline = 'bottom';
          const label = `${fmt(total)} deaths reported`;
          const w = c.measureText(label).width;
          c.fillText(label, Math.min(Math.max(area.left, (x0 + x1) / 2 - w / 2), area.right - w), y - 4);
          c.restore();
          return;
        }
      }
      const peak = inRange.reduce((a, b) => (b.total > a.total ? b : a));
      const bar = chart.getDatasetMeta(0).data[months.indexOf(peak)];
      if (!bar) return;
      const { ctx, chartArea } = chart;
      const text = `${fmt(peak.total)} in ${monthLabel(peak.key)}`;
      ctx.save();
      ctx.fillStyle = C.ink;
      ctx.font = '600 12px "Source Sans 3", sans-serif';
      ctx.textBaseline = 'bottom';
      const w = ctx.measureText(text).width;
      const x = Math.min(bar.x - bar.width / 2, chartArea.right - w);
      ctx.fillText(text, x, bar.y - 6);
      ctx.restore();
    },
  };

  paceChart = new Chart(document.getElementById('pace-chart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: months.map(m => toLocalDate(`${m.key}-01`)),
      datasets: [{
        data: months.map(m => m.total),
        backgroundColor: paceColors(months),
        borderRadius: { topLeft: 4, topRight: 4 },
        borderSkipped: 'bottom',
        barPercentage: 0.78,
        categoryPercentage: 0.92,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 34 } },
      animation: REDUCED_MOTION ? false : { duration: 450 },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP,
          displayColors: false,
          callbacks: {
            title: (items) => monthLabel(months[items[0].dataIndex].key),
            label: (ctx) => {
              const m = months[ctx.dataIndex];
              return `${fmt(m.total)} reported · ~${fmt(m.total / m.days)} a day`;
            },
            afterLabel: (ctx) => (isTruceMonth(months[ctx.dataIndex].key) ? 'Truce: includes recovered and newly confirmed deaths' : ''),
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'month' },
          offset: true,
          grid: { display: false },
          ticks: {
            ...MONO_TICKS,
            maxRotation: 0,
            autoSkip: false,
            source: 'labels',
            callback(v, i, ticks) {
              const d = new Date(ticks[i].value);
              // "Oct 2023" sits three months before "2024"; drop it when those
              // months are too narrow to hold both labels (phones, tablets).
              const roomForStart = (this.width / ticks.length) * 3 >= 64;
              if (i === 0) return roomForStart ? 'Oct 2023' : '';
              return d.getMonth() === 0 ? String(d.getFullYear()) : '';
            },
          },
        },
        y: {
          beginAtZero: true,
          grid: GRID,
          border: { display: false },
          ticks: { ...MONO_TICKS, maxTicksLimit: 5, callback: v => fmt(v) },
        },
      },
    },
    plugins: [peakLabel],
  });
  paceChart.$months = months;
}

// --- A century on one scale: bar widths from each row's value ---
function buildCenturyChart() {
  const rows = Array.from(document.querySelectorAll('.cc-rows li'));
  if (!rows.length) return;
  const now = rows.find(r => r.classList.contains('is-now'));
  if (now) now.dataset.value = DATA.summary.gaza.killed.total;
  const max = Math.max(...rows.map(r => +r.dataset.value));
  rows.forEach(r => r.style.setProperty('--w', `${(+r.dataset.value / max) * 100}%`));
}

// --- In memory: names of infants, English or Arabic ---
async function buildNames() {
  const wall = document.getElementById('names-wall');
  if (!wall) return;
  let data;
  try {
    data = await (await fetch('data/names-infants.json', { cache: 'no-cache' })).json();
  } catch (e) { return; }
  document.getElementById('names-count').textContent = fmt(data.count);
  const render = lang => {
    const idx = lang === 'ar' ? 1 : 0;
    wall.lang = lang;
    wall.dir = lang === 'ar' ? 'rtl' : 'ltr';
    wall.innerHTML = data.names.map(n => `<span>${n[idx]}</span>`).join(' ');
  };
  render('en');
  document.querySelectorAll('#names-lang button').forEach(btn => {
    btn.addEventListener('click', () => {
      setRadioActive('#names-lang button', btn);
      render(btn.dataset.lang);
    });
  });
  const more = document.getElementById('names-more');
  more.textContent = `Show all ${fmt(data.count)} names`;
  more.addEventListener('click', () => {
    const open = wall.classList.toggle('is-open');
    more.setAttribute('aria-expanded', String(open));
    more.textContent = open ? 'Show fewer' : `Show all ${fmt(data.count)} names`;
    if (!open) wall.scrollIntoView({ block: 'nearest' });
  });
}

// Calls onChange(el) whenever the element crossing the middle of the
// viewport changes (null when none does). One rAF-throttled scroll listener.
function trackMiddle(elements, onChange, line = () => 0.5) {
  let current, queued = false;
  const check = () => {
    queued = false;
    const mid = window.innerHeight * line();
    const hit = elements.find(el => {
      const r = el.getBoundingClientRect();
      return r.top <= mid && r.bottom >= mid;
    }) || null;
    if (hit !== current) { current = hit; onChange(hit); }
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(check); } };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  check();
}

// --- Scrolly: each step spotlights its months on the pace chart ---
function setupScrolly() {
  const steps = Array.from(document.querySelectorAll('.scrolly .step'));
  if (!steps.length || !paceChart) return;
  const months = paceChart.$months;

  // Fill each step's numbers from the same monthly series.
  steps.forEach(step => {
    const from = step.dataset.from, to = step.dataset.to;
    const sel = months.filter(m => m.key >= from && m.key <= to);
    const total = sel.reduce((a, m) => a + m.total, 0);
    const days = sel.reduce((a, m) => a + m.days, 0);
    const vals = { total: fmt(total), perday: fmt(total / Math.max(days, 1)), permonth: fmt(total / Math.max(sel.length, 1)) };
    step.querySelectorAll('[data-step]').forEach(el => { el.textContent = vals[el.dataset.step]; });
  });

  const activate = step => {
    steps.forEach(s => s.classList.toggle('is-active', s === step));
    paceRange = step ? [step.dataset.from, step.dataset.to] : null;
    paceChart.data.datasets[0].backgroundColor = paceColors(months);
    paceChart.update('none');
  };
  // Outside the story (above or below) every month shows again.
  trackMiddle(steps, activate, () => (window.innerWidth <= 900 ? 0.74 : 0.5));
}

// --- Scale: one dot per ten people, highlight a group ---
function buildDots() {
  const canvas = document.getElementById('dots');
  if (!canvas) return;
  const g = DATA.summary.gaza.killed;
  const groups = [
    { key: 'children', n: Math.round(g.children / 10), label: 'children' },
    { key: 'women', n: Math.round(g.women / 10), label: 'women' },
    { key: 'men', n: Math.round((g.total - g.children - g.women) / 10), label: 'men' },
  ];
  const counts = { children: g.children, women: g.women, men: g.total - g.children - g.women };
  const dots = groups.flatMap(gr => Array(gr.n).fill(gr.key));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let active = 'all';
  let drawn = reduce ? dots.length : 0;

  const draw = () => {
    const w = canvas.parentElement.clientWidth;
    // Size dots to a target height rather than a fixed 6px, so phones and
    // tablets get a compact block instead of a very tall column.
    const targetH = Math.min(560, Math.max(320, w * 0.5));
    const step = Math.max(4, Math.sqrt((w * targetH) / dots.length));
    const size = step * 0.7, gap = step - size;
    const cols = Math.floor((w + gap) / step);
    const rows = Math.ceil(dots.length / cols);
    const h = rows * step;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const r = size / 2;
    // Landmarks: a rule and label every 10,000 people (1,000 dots).
    const marks = canvas.parentElement.querySelector('.dots-marks');
    if (marks) {
      let html = '';
      for (let d = 1000; d < dots.length; d += 1000) {
        const row = Math.floor(d / cols);
        html += `<div class="dots-mark" style="top:${row * step - gap / 2}px;--x:${((d % cols) / cols) * 100}%;--step:${step}px"><span>${fmt(d * 10)}</span></div>`;
      }
      marks.innerHTML = html;
    }
    for (let i = 0; i < drawn; i++) {
      const on = active === 'all' || dots[i] === active;
      ctx.fillStyle = on ? T(C.pal, '#8e9b68') : T('#e3e6e9', '#2a2e34');
      ctx.beginPath();
      ctx.arc((i % cols) * step + r, Math.floor(i / cols) * step + r, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const readout = document.getElementById('dots-readout');
  const setReadout = () => {
    readout.innerHTML = active === 'all'
      ? `<strong>${fmt(g.total)}</strong> people killed in Gaza`
      : `<strong>${fmt(counts[active])}</strong> ${active} · ${pct(counts[active], g.total)} of the dead`;
  };

  document.querySelectorAll('#dots-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      setRadioActive('#dots-toggle button', btn);
      active = btn.dataset.group;
      setReadout();
      draw();
    });
  });

  // Dots fill in, row by row, the first time the grid scrolls into view.
  const grow = () => {
    const t0 = performance.now(), dur = 2200;
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur);
      drawn = Math.round(dots.length * (1 - Math.pow(1 - p, 2)));
      draw();
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); grow(); } }, { threshold: 0.15 });
    io.observe(canvas);
  } else {
    drawn = dots.length;
  }
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(draw, 120); });
  setReadout();
  draw();
}

// --- History: the timeline pins to the top and tracks the era in view ---
function setupCentury() {
  const eras = Array.from(document.querySelectorAll('.history .era'));
  const marks = Array.from(document.querySelectorAll('#century .century-mark'));
  const fill = document.querySelector('#century .century-fill');
  const bar = document.querySelector('.century-wrap');
  if (!eras.length || !bar) return;
  const kicker = document.getElementById('century-kicker');
  const title = document.getElementById('century-title');
  const count = document.getElementById('century-count');
  const feature = document.querySelector('.era--feature');
  const last = eras.length - 1;
  let active = -1;

  const setActive = i => {
    if (i === active) return;
    active = i;
    const era = eras[i];
    marks.forEach((m, j) => {
      m.classList.toggle('is-active', j === i);
      m.classList.toggle('is-past', j < i);
      if (j === i) m.setAttribute('aria-current', 'step'); else m.removeAttribute('aria-current');
    });
    if (kicker) kicker.textContent = era.dataset.era || '';
    const h = era.querySelector('h3');
    if (title) title.textContent = h ? h.textContent : '';
    if (count) count.textContent = `${i + 1} of ${eras.length}`;
    document.getElementById('century-prev').disabled = i === 0;
    document.getElementById('century-next').disabled = i === last;
  };

  // The fill follows reading position continuously: the active era's index
  // plus how far through that era the middle of the screen has travelled.
  let queued = false;
  const update = () => {
    queued = false;
    const mid = window.innerHeight / 2;
    let i = 0;
    eras.forEach((e, j) => { if (e.getBoundingClientRect().top <= mid) i = j; });
    const r = eras[i].getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (mid - r.top) / Math.max(r.height, 1)));
    setActive(i);
    if (fill) fill.style.width = `${Math.min(100, ((i + (i < last ? frac : 0)) / last) * 100)}%`;
    // Dark only while the dark 1948 photograph fills the screen behind it.
    if (feature) {
      const f = feature.getBoundingClientRect();
      bar.classList.toggle('is-dark', f.top <= bar.getBoundingClientRect().bottom && f.bottom > mid);
    }
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  update();

  const go = i => {
    const target = eras[Math.max(0, Math.min(last, i))];
    target.scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'start' });
  };
  document.getElementById('century-prev').addEventListener('click', () => go(active - 1));
  document.getElementById('century-next').addEventListener('click', () => go(active + 1));
}

// --- Age & sex of identified dead (butterfly chart, plain HTML) ---
function buildPyramid() {
  const k = DATA.summary.known_killed_in_gaza;
  const rows = [
    { lbl: 'Children', m: k.male.child, f: k.female.child, focus: true },
    { lbl: 'Adults', m: k.male.adult, f: k.female.adult },
    { lbl: 'Seniors', m: k.male.senior, f: k.female.senior },
  ];
  const total = rows.reduce((s, r) => s + r.m + r.f, 0);
  const children = rows[0].m + rows[0].f;
  const max = Math.max(...rows.flatMap(r => [r.m, r.f]));
  const w = n => `${(n / max) * 100}%`;

  document.getElementById('named-total').textContent = fmt(total);
  document.getElementById('named-child-share').textContent = `${fmt(children)} (${pct(children, total)})`;

  const el = document.getElementById('pyramid');
  el.setAttribute('aria-label', rows.map(r => `${r.lbl}: ${fmt(r.m)} male, ${fmt(r.f)} female`).join('; '));
  el.innerHTML = `
    <div class="pyr-head"><span>Male</span><span></span><span>Female</span></div>
    ${rows.map(r => `
      <div class="pyr-row${r.focus ? ' is-focus' : ''}">
        <div class="pyr-side pyr-side--m">
          <span class="pyr-num">${fmt(r.m)}</span>
          <div class="pyr-bar" style="--w:${w(r.m)}"></div>
        </div>
        <div class="pyr-lbl">${r.lbl}<span>${pct(r.m + r.f, total)}</span></div>
        <div class="pyr-side pyr-side--f">
          <div class="pyr-bar" style="--w:${w(r.f)}"></div>
          <span class="pyr-num">${fmt(r.f)}</span>
        </div>
      </div>`).join('')}
  `;
  document.getElementById('pyramid-foot').textContent =
    `Children are under 18; seniors 60 and over. Names released through ${fmtDate(k.includes_until)}.`;
}

// --- Annotations (key dates within current range) ---
function visibleEvents() {
  const startD = toLocalDate(DATA.gaza_daily[state.startIdx].date);
  const endD = toLocalDate(DATA.gaza_daily[state.endIdx].date);
  return EVENTS.filter(e => {
    const d = toLocalDate(e.date);
    return d >= startD && d <= endD;
  });
}

function updateAnnotations() {
  const visible = visibleEvents();
  const container = document.getElementById('annotations');
  if (visible.length === 0) {
    container.innerHTML = '<li class="ann-empty">No marker events in selected range</li>';
    return;
  }
  container.innerHTML = visible.map((e, i) => `
    <li><span class="ann-num" aria-hidden="true">${i + 1}</span><span><strong>${fmtDate(e.date)}</strong>${e.label}</span></li>
  `).join('');
}

// --- Controls ---

// Small helper: inside a radiogroup, only one button is "active" / "checked"
// at a time. Mirror the visual class onto aria-checked for assistive tech.
function setRadioActive(groupSelector, clickedBtn) {
  document.querySelectorAll(groupSelector).forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-checked', 'false');
  });
  clickedBtn.classList.add('active');
  clickedBtn.setAttribute('aria-checked', 'true');
}

// Date range lives in a popover: trigger shows the current range,
// the panel holds quick ranges and the dual-handle slider.
function bindRangeDropdown() {
  const trigger = document.getElementById('range-trigger');
  const pop = document.getElementById('range-pop');
  if (!trigger || !pop) return;
  const setOpen = (open, { focusTrigger = false, focusInside = false } = {}) => {
    pop.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open && focusInside) (pop.querySelector('.preset.active') || pop.querySelector('.preset')).focus();
    else if (focusTrigger) trigger.focus();
  };
  // event.detail is 0 for keyboard-activated clicks: only then move focus inside.
  trigger.addEventListener('click', e => setOpen(pop.hidden, { focusInside: e.detail === 0 }));
  document.getElementById('range-done').addEventListener('click', () => setOpen(false, { focusTrigger: true }));
  pop.querySelectorAll('.preset').forEach(b => b.addEventListener('click', () => setOpen(false, { focusTrigger: true })));
  document.addEventListener('pointerdown', e => {
    if (!pop.hidden && !pop.contains(e.target) && !trigger.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !pop.hidden) setOpen(false, { focusTrigger: true });
  });
}

function bindControls() {
  bindRangeDropdown();
  // Presets
  document.querySelectorAll('.preset').forEach(btn => {
    btn.addEventListener('click', () => {
      setRadioActive('.preset', btn);
      const last = DATA.gaza_daily[DATA.gaza_daily.length - 1].date;
      const first = DATA.gaza_daily[0].date;
      const lastD = new Date(last);
      const p = btn.dataset.preset;
      if (p === 'all') setRange(first, last);
      else if (p === '6m') setRange(new Date(lastD.getFullYear(), lastD.getMonth() - 6, lastD.getDate()), last);
      else if (p === '12m') setRange(new Date(lastD.getFullYear() - 1, lastD.getMonth(), lastD.getDate()), last);
      else if (p === 'phase1') setRange('2023-10-07', '2025-01-19');
      else if (p === 'phase2') setRange('2025-03-18', '2025-10-10');
      else if (p === 'ceasefire') setRange('2025-10-10', last);
    });
  });

  // Side toggle
  document.querySelectorAll('#side-toggle .toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      setRadioActive('#side-toggle .toggle', btn);
      state.side = btn.dataset.side;
      updateTimeSeries();
    });
  });

  // View toggle
  document.querySelectorAll('#view-toggle .toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      setRadioActive('#view-toggle .toggle', btn);
      state.view = btn.dataset.view;
      updateTimeSeries();
    });
  });

  // Scale toggle
  document.querySelectorAll('#scale-toggle .toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      setRadioActive('#scale-toggle .toggle', btn);
      state.scale = btn.dataset.scale;
      updateTimeSeries();
    });
  });

  // Default preset
  const defaultPreset = document.querySelector('.preset[data-preset="all"]');
  if (defaultPreset) {
    defaultPreset.classList.add('active');
    defaultPreset.setAttribute('aria-checked', 'true');
  }
}

// --- Entry point ---
// In the browser we kick things off automatically. Under Node (for tests) we
// skip this and just expose the pure helpers so they can be exercised without
// a DOM.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  loadData();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { toLocalDate, fmtDate, fmt };
}
