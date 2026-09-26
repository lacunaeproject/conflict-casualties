/* =========================================================
   Conflict Casualties — interactive dashboard
   ========================================================= */

// --- Color tokens (mirror CSS) ---
const C = {
  pal: '#9b2f24',
  palSoft: '#c98276',
  palBg: 'rgba(155, 47, 36, 0.07)',
  isr: '#2f5577',
  isrSoft: '#7891a8',
  isrBg: 'rgba(47, 85, 119, 0.07)',
  children: '#9a6420',
  women: '#6e5a3c',
  press: '#3f6446',
  medical: '#5e4a70',
  ink: '#16181b',
  ink3: '#5c6168',
  rule: '#e2dfd8',
  paper: '#f4f3f0',
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
let tsChart = null, govChart = null, wbChart = null;

// Current filter state
const state = {
  startIdx: 0,
  endIdx: 0,
  side: 'both',
  view: 'cum',
  scale: 'linear',
};

async function loadData() {
  const res = await fetch('data.json');
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
  buildLegendChips();
  bindControls();

  document.getElementById('meta-date').textContent = fmtDate(DATA.meta.data_as_of);
  document.getElementById('meta-days').textContent = fmt(DATA.meta.days_of_data);
  updateAnnotations();
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
  startEl.addEventListener('input', () => update(false));
  endEl.addEventListener('input', () => update(true));
  update(false);
}

function updateReadouts() {
  const startDate = DATA.gaza_daily[state.startIdx].date;
  const endDate = DATA.gaza_daily[state.endIdx].date;
  document.getElementById('readout-start').textContent = fmtDate(startDate);
  document.getElementById('readout-end').textContent = fmtDate(endDate);
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
          backgroundColor: '#16181b',
          titleColor: '#f4f3f0',
          bodyColor: '#f4f3f0',
          padding: 12,
          borderColor: '#33373d',
          borderWidth: 1,
          titleFont: { family: 'Newsreader', weight: '600', size: 13 },
          bodyFont: { family: 'Inter', size: 12 },
          callbacks: {
            title: (items) => fmtDate(items[0].parsed.x),
            label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'month', tooltipFormat: 'PP' },
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { color: C.ink3, font: { size: 11 }, maxRotation: 0 },
        },
        y: {
          type: 'linear',
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: { color: C.ink3, font: { size: 11 }, callback: v => fmt(v) },
        },
      },
      animation: { duration: 600, easing: 'easeOutQuart' },
    },
  });
}

function applyScale() {
  if (!tsChart) return;
  const isLog = state.scale === 'log';
  tsChart.options.scales.y = {
    type: isLog ? 'logarithmic' : 'linear',
    beginAtZero: !isLog,
    min: isLog ? 1 : 0,
    grid: { color: 'rgba(0,0,0,0.06)' },
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
  const data = DATA.governorate_estimates;
  govChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => {
        const short = d.name.replace(/\s*\(Gaza City\)/, '');
        return `${short}  ·  ${d.share_pct}%`;
      }),
      datasets: [{
        data: data.map(d => d.estimated_killed),
        backgroundColor: data.map((_, i) => {
          // graduated shades of the palestinian accent
          const shades = ['#74221a', '#9b2f24', '#b0493c', '#c98276', '#dcb0a8'];
          return shades[i % shades.length];
        }),
        borderRadius: 3,
        barPercentage: 0.72,
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
          backgroundColor: '#16181b',
          titleColor: '#f4f3f0',
          bodyColor: '#f4f3f0',
          padding: 10,
          callbacks: {
            title: (items) => data[items[0].dataIndex].name,
            label: (ctx) => `~${fmt(ctx.parsed.x)} killed · ${data[ctx.dataIndex].share_pct}% of total`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { callback: v => fmt(v), color: C.ink3, font: { size: 11 } },
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

// --- West Bank chart ---
function buildWBChart() {
  const ctx = document.getElementById('wb-chart').getContext('2d');
  const wb = DATA.west_bank_daily;
  wbChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Palestinians killed (cum.)',
          data: wb.map(r => ({ x: r.date, y: r.killed_cum })),
          borderColor: C.pal,
          backgroundColor: C.palBg,
          fill: true,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: 2,
          yAxisID: 'y',
        },
        {
          label: 'Settler attacks (cum.)',
          data: wb.map(r => ({ x: r.date, y: r.settler_attacks_cum })),
          borderColor: C.women,
          borderDash: [5, 4],
          fill: false,
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 1.8,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: C.ink3, font: { size: 11 }, boxWidth: 16, usePointStyle: true, pointStyle: 'line' },
        },
        tooltip: {
          backgroundColor: '#16181b',
          titleColor: '#f4f3f0',
          bodyColor: '#f4f3f0',
          padding: 10,
          callbacks: {
            title: (items) => fmtDate(items[0].parsed.x),
            label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'month' },
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { color: C.ink3, font: { size: 11 }, maxRotation: 0 },
        },
        y: {
          beginAtZero: true,
          position: 'left',
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: { color: C.pal, font: { size: 11 }, callback: v => fmt(v) },
          title: { display: true, text: 'Killed', color: C.pal, font: { size: 11 } },
        },
        y1: {
          beginAtZero: true,
          position: 'right',
          grid: { display: false },
          ticks: { color: C.women, font: { size: 11 }, callback: v => fmt(v) },
          title: { display: true, text: 'Settler attacks', color: C.women, font: { size: 11 } },
        },
      },
    },
  });
}

// --- Annotations (key dates within current range) ---
function updateAnnotations() {
  const startD = toLocalDate(DATA.gaza_daily[state.startIdx].date);
  const endD = toLocalDate(DATA.gaza_daily[state.endIdx].date);
  const visible = EVENTS.filter(e => {
    const d = toLocalDate(e.date);
    return d >= startD && d <= endD;
  });
  const container = document.getElementById('annotations');
  if (visible.length === 0) {
    container.innerHTML = '<span style="color:var(--ink-4);font-style:italic">No marker events in selected range</span>';
    return;
  }
  container.innerHTML = visible.map(e => `
    <span><strong>${fmtDate(e.date)}</strong> · ${e.label}</span>
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

function bindControls() {
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
