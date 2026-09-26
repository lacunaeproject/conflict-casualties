/* =========================================================
   Conflict Casualties — interactive dashboard
   ========================================================= */

// --- Color tokens (mirror CSS) ---
const C = {
  pal: '#4a5831',
  palSoft: '#9aa67c',
  palBg: 'rgba(74, 88, 49, 0.07)',
  isr: '#2f5577',
  isrSoft: '#7891a8',
  isrBg: 'rgba(47, 85, 119, 0.07)',
  children: '#9a6420',
  women: '#6e5a3c',
  press: '#3f6446',
  medical: '#5e4a70',
  ink: '#16181b',
  ink3: '#5c6168',
  ink4: '#767b82',
  rule: '#e2e5e9',
  paper: '#f3f4f6',
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
  backgroundColor: '#101317',
  titleColor: '#f3f4f6',
  bodyColor: '#f3f4f6',
  padding: 12,
  borderColor: 'rgba(255,255,255,0.12)',
  borderWidth: 1,
  titleFont: { family: '"Source Serif 4", serif', weight: '600', size: 13 },
  bodyFont: { family: '"Source Sans 3", sans-serif', size: 12 },
};
const MONO_TICKS = { color: C.ink3, font: { family: '"IBM Plex Mono", monospace', size: 10.5 } };
const GRID = { color: 'rgba(16,19,23,0.06)' };

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
  buildLegendChips();
  bindControls();

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
      <td class="tracker-name"><a href="${t.url}" target="_blank" rel="noopener">${t.name}</a></td>
      <td class="num">${t.palestinian_killed != null ? fmt(t.palestinian_killed) : '—'}</td>
      <td class="num">${t.palestinian_injured != null ? fmt(t.palestinian_injured) : '—'}</td>
      <td>${t.scope}</td>
      <td>${fmtDate(t.as_of)}</td>
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
      layout: { padding: { top: 26 } },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'month', tooltipFormat: 'PP' },
          grid: { color: 'rgba(16,19,23,0.045)' },
          ticks: { color: C.ink3, font: { family: '\"IBM Plex Mono\", monospace', size: 10.5 }, maxRotation: 0 },
        },
        y: {
          type: 'linear',
          beginAtZero: true,
          grid: { color: 'rgba(16,19,23,0.07)' },
          ticks: { color: C.ink3, font: { family: '\"IBM Plex Mono\", monospace', size: 10.5 }, callback: v => fmt(v) },
        },
      },
      animation: { duration: 600, easing: 'easeOutQuart' },
    },
    plugins: [eventMarkers],
  });
}

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
      ctx.strokeStyle = 'rgba(22,24,27,0.28)';
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
      ctx.fillStyle = '#16181b';
      ctx.beginPath();
      ctx.arc(bx, area.top - 12, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
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
  const isLog = state.scale === 'log';
  tsChart.options.scales.y = {
    type: isLog ? 'logarithmic' : 'linear',
    beginAtZero: !isLog,
    min: isLog ? 1 : 0,
    grid: { color: 'rgba(16,19,23,0.07)' },
    ticks: {
      color: C.ink3,
      font: { size: 11 },
      callback: v => fmt(v),
    },
  };
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
    fill: !isDaily,
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
    mkPal('Palestinians — West Bank', DATA.west_bank_daily, 'killed_cum', C.palSoft, 'rgba(201, 130, 118, 0.06)'),
    mkPal('Israelis — total (Oct 7 + IDF)', DATA.israeli_daily, 'total_cum', C.isr, C.isrBg),
    mkPal('Israeli soldiers — Gaza', DATA.israeli_daily, 'idf_gaza_cum', C.isrSoft, 'rgba(120, 145, 168, 0.06)'),
  ];

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
        borderRadius: 4,
        barPercentage: 0.62,
        categoryPercentage: 0.85,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { left: 8, right: 12, top: 4, bottom: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP,
          callbacks: {
            title: (items) => data[items[0].dataIndex].name,
            label: (ctx) => `~${fmt(ctx.parsed.x)} killed · ${data[ctx.dataIndex].share_pct}% of total`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(16,19,23,0.06)' },
          ticks: { callback: v => fmt(v), color: C.ink3, font: { family: '\"IBM Plex Mono\", monospace', size: 10.5 } },
        },
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
  });
}

// --- West Bank: two small multiples, one scale each ---
function buildWBChart() {
  const wb = DATA.west_bank_daily;
  const last = wb[wb.length - 1];
  document.getElementById('wb-killed-total').textContent = fmt(last.killed_cum);
  document.getElementById('wb-attacks-total').textContent = fmt(last.settler_attacks_cum);
  wbChart = smallLine('wb-chart', wb.map(r => ({ x: r.date, y: r.killed_cum })), 'Palestinians killed', C.pal, C.palBg);
  wbAttacksChart = smallLine('wb-attacks-chart', wb.map(r => ({ x: r.date, y: r.settler_attacks_cum })), 'Settler attacks', C.women, 'rgba(110, 90, 60, 0.07)');
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

function buildPaceChart() {
  const months = monthlyDeaths();
  const peak = months.reduce((a, b) => (b.total > a.total ? b : a));
  const colors = months.map(m => (isTruceMonth(m.key) ? C.palSoft : C.pal));
  const monthLabel = key => toLocalDate(`${key}-01`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  // Label only the peak bar, directly above it.
  const peakLabel = {
    id: 'peakLabel',
    afterDatasetsDraw(chart) {
      const i = months.indexOf(peak);
      const bar = chart.getDatasetMeta(0).data[i];
      if (!bar) return;
      const { ctx } = chart;
      ctx.save();
      ctx.fillStyle = C.ink;
      ctx.font = '600 12px "Source Sans 3", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${fmt(peak.total)} in ${monthLabel(peak.key)}`, bar.x - bar.width / 2, bar.y - 6);
      ctx.restore();
    },
  };

  paceChart = new Chart(document.getElementById('pace-chart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: months.map(m => toLocalDate(`${m.key}-01`)),
      datasets: [{
        data: months.map(m => m.total),
        backgroundColor: colors,
        borderRadius: { topLeft: 4, topRight: 4 },
        borderSkipped: 'bottom',
        barPercentage: 0.78,
        categoryPercentage: 0.92,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 24 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP,
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
          ticks: { ...MONO_TICKS, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
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

  // Three plain-language takeaways computed from the same series.
  const first3 = months.slice(0, 3).reduce((s, m) => s + m.total, 0);
  const total = DATA.gaza_daily[DATA.gaza_daily.length - 1].killed_cum;
  const facts = [
    [pct(first3, total), 'of all reported deaths came in the first three months'],
    [fmt(peak.total / peak.days), `killed a day on average in ${monthLabel(peak.key)}, the deadliest month`],
    [fmt(months.length), 'months of reporting so far'],
  ];
  document.getElementById('pace-facts').innerHTML = facts
    .map(([v, l]) => `<div class="pace-fact"><div class="pf-val">${v}</div><div class="pf-lbl">${l}</div></div>`)
    .join('');
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
