/* =========================================================
   Conflict Casualties — data loading, bound figures, the dot field,
   the history timeline and the names. The charts are in viz.js.
   ========================================================= */

// --- Colour for the dot field (canvas can't read CSS variables) ---
// Follows the system setting on pages that use the product theme (html.rd).
const DARK = typeof document !== 'undefined' && document.documentElement.classList.contains('rd') &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;
const T = (light, dark) => (DARK ? dark : light);
const C = { pal: T('#4a5831', '#aebd86') };

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
const pct = (n, total) => `${Math.round((n / total) * 100)}%`;

const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let DATA = null;

async function loadData() {
  const res = await fetch('data.json', { cache: 'no-cache' });
  DATA = await res.json();
  init();
}

function init() {
  populateKPIs();
  populateWhoGrid();
  populateTrackers();
  bindStoryNumbers();
  buildDots();
  buildCenturyChart();
  buildNames();
  setupCentury();
  buildViz(DATA);   // viz.js: the weekly, ceasefire, who, West Bank and sources charts
  document.getElementById('meta-date').textContent = fmtDate(DATA.meta.data_as_of);
  document.getElementById('meta-days').textContent = fmt(DATA.meta.days_of_data);
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
// Headline figures: the plain number for screen readers, and a display copy whose
// commas are optically narrowed (stats.css) so they don't open a gap in the numeral.
function setFigure(id, n) {
  const text = fmt(n);
  const hidden = document.createElement('span');
  hidden.className = 'visually-hidden';
  hidden.textContent = text;
  const display = document.createElement('span');
  display.setAttribute('aria-hidden', 'true');
  text.split(',').forEach((part, i) => {
    if (i) { const c = document.createElement('span'); c.className = 'stats-comma'; c.textContent = ','; display.append(c); }
    display.append(part);
  });
  document.getElementById(id).replaceChildren(hidden, display);
}

function populateKPIs() {
  const g = DATA.summary.gaza;
  const w = DATA.summary.west_bank;
  const il = DATA.israeli_daily[DATA.israeli_daily.length - 1];
  setFigure('kpi-gaza', g.killed.total);
  document.getElementById('kpi-gaza-children').textContent = fmt(g.killed.children);
  document.getElementById('kpi-gaza-women').textContent = fmt(g.killed.women);
  // The age-and-sex breakdown has its own date: the last day its counts changed
  const daily = DATA.gaza_daily;
  let last = daily[0];
  daily.forEach(r => { if (r.children_cum !== last.children_cum || r.women_cum !== last.women_cum) last = r; });
  document.querySelectorAll('.breakdown-date').forEach(el => { el.textContent = fmtDate(last.date); el.setAttribute('datetime', last.date); });
  setFigure('kpi-wb', w.killed.total);
  document.getElementById('kpi-wb-children').textContent = fmt(w.killed.children);
  document.getElementById('kpi-wb-settler').textContent = fmt(w.settler_attacks);
  setFigure('kpi-oct7', DATA.oct7.total);
  setFigure('kpi-idf', il.idf_gaza_cum);
}

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

// --- Scale: one dot per ten people, highlight a group ---
function buildDots() {
  const canvas = document.getElementById('dots');
  if (!canvas) return;
  const g = DATA.summary.gaza.killed;
  // The children and women counts were last updated on one date; split the total as of that
  // date, and keep everything reported since as its own group rather than counting it as men.
  const daily = DATA.gaza_daily;
  let asOf = daily[0];
  daily.forEach(r => { if (r.children_cum !== asOf.children_cum || r.women_cum !== asOf.women_cum) asOf = r; });
  const counts = {
    children: asOf.children_cum,
    women: asOf.women_cum,
    men: asOf.killed_cum - asOf.children_cum - asOf.women_cum,
    since: g.total - asOf.killed_cum,
  };
  const groups = ['children', 'women', 'men', 'since'].map(key => ({ key, n: Math.round(counts[key] / 10) }));
  const asOfLabel = fmtDate(asOf.date);
  const dots = groups.flatMap(gr => Array(gr.n).fill(gr.key));
  let active = 'all';
  const drawn = dots.length;  // the field is complete on arrival: these are people, never a counter

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
      const gapRow = Math.floor((dots.length - groups[3].n) / cols);
      for (let d = 1000; d < dots.length; d += 1000) {
        const row = Math.floor(d / cols);
        if (Math.abs(row - gapRow) < 3) continue;   // the breakdown boundary's label takes this spot
        html += `<div class="dots-mark" style="top:${row * step - gap / 2}px;--x:${((d % cols) / cols) * 100}%;--step:${step}px"><span>${fmt(d * 10)}</span></div>`;
      }
      // where the Ministry's breakdown ends: everything after it is not yet broken down
      const d = dots.length - groups[3].n;
      html += `<div class="dots-mark dots-mark--gap" style="top:${Math.floor(d / cols) * step - gap / 2}px;--x:${((d % cols) / cols) * 100}%;--step:${step}px"><span>${asOf.date.slice(5, 7) === '10' ? 'Oct' : asOfLabel.split(' ')[0]} ${+asOf.date.slice(8)}, ’${asOf.date.slice(2, 4)}</span></div>`;
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
      : `<strong>${fmt(counts[active])}</strong> ${active} to ${asOfLabel} · ${pct(counts[active], asOf.killed_cum)} of the dead then`;
  };

  document.querySelectorAll('#dots-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      setRadioActive('#dots-toggle button', btn);
      active = btn.dataset.group;
      setReadout();
      draw();
    });
  });

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
    if (fill) fill.style.transform = `scaleX(${Math.min(1, (i + (i < last ? frac : 0)) / last)})`;
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
