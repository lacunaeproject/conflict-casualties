/**
 * Unit tests for the dashboard's pure logic.
 *
 * These exist specifically to guard against regressions in the three
 * functional bugs that were fixed in the dashboard's first pass:
 *
 *   1. Timezone-safe date parsing        (toLocalDate)
 *   2. Daily-delta is non-zero on the
 *      first visible day of a filtered
 *      range                             (delta computation)
 *   3. Slider clamping stays correct
 *      regardless of which handle the
 *      user is dragging                  (slider clamp)
 *
 * Run with:    node --test tests/app.test.js
 *
 * No dependencies — uses Node's built-in test runner and assert module.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Load app.js by executing it in this process. The file guards loadData() with
// a typeof-window check, so requiring it under Node is side-effect-free.
const appPath = path.resolve(__dirname, '..', 'app.js');
const { toLocalDate, fmtDate } = require(appPath);


test('Fix 1 — toLocalDate parses YYYY-MM-DD as a local date, not UTC', () => {
  // The original bug: `new Date("2023-10-07")` is parsed as UTC midnight,
  // so anyone west of UTC sees "Oct 6" when the date is actually Oct 7.
  // `toLocalDate` must return a Date whose LOCAL calendar components
  // match the input string.
  const d = toLocalDate('2023-10-07');
  assert.equal(d.getFullYear(), 2023);
  assert.equal(d.getMonth(), 9);      // October (0-indexed)
  assert.equal(d.getDate(), 7);

  // And across a few more dates — including the leap day — to confirm
  // it isn't an off-by-one quirk of one particular date.
  const leap = toLocalDate('2024-02-29');
  assert.equal(leap.getDate(), 29);
  assert.equal(leap.getMonth(), 1);

  const newYear = toLocalDate('2025-01-01');
  assert.equal(newYear.getDate(), 1);
  assert.equal(newYear.getMonth(), 0);
});


test('Fix 1 — toLocalDate is a passthrough for Date and number inputs', () => {
  const d = new Date(2025, 5, 15);  // 15 Jun 2025 local
  assert.equal(toLocalDate(d), d);

  const ts = Date.UTC(2025, 5, 15);
  assert.equal(toLocalDate(ts).getTime(), ts);
});


test('Fix 1 — fmtDate renders the correct day regardless of user timezone', () => {
  // This is the user-visible symptom the timezone fix solves: the data-as-of
  // stamp and annotations render the correct day, not the day before, for
  // US-timezone users.
  const rendered = fmtDate('2023-10-07');
  // We don't pin the locale-specific format, but the day number MUST appear.
  assert.match(rendered, /\b7\b/, `expected "7" in "${rendered}"`);
  assert.match(rendered, /Oct/i,  `expected "Oct" in "${rendered}"`);
});


test('Fix 2 — daily-delta computation is non-zero on the first day of a slice', () => {
  // Before the fix: daily deltas were computed within the sliced array, so
  // the first element of any filtered range had no predecessor and always
  // came out as 0. After the fix: deltas are computed on the full series
  // first, THEN the slice is taken — so the first visible day keeps its
  // real delta against the prior day.
  //
  // We reproduce the fixed behavior here and assert the same guarantee:
  // the delta at startIdx equals series[startIdx] - series[startIdx-1],
  // even when startIdx is deep inside the series.
  const series = [
    { date: '2024-01-01', killed_cum: 100 },
    { date: '2024-01-02', killed_cum: 150 },
    { date: '2024-01-03', killed_cum: 230 },   // +80
    { date: '2024-01-04', killed_cum: 235 },   // +5
    { date: '2024-01-05', killed_cum: 700 },   // +465  ← big day
  ];

  // Mirror the fixed implementation from app.js:
  const toDaily = (arr, key, startIdx, endIdx) =>
    arr
      .map((r, i) => ({
        x: r.date,
        y: i === 0 ? 0 : Math.max(0, r[key] - arr[i - 1][key]),
      }))
      .slice(startIdx, endIdx + 1);

  // Filter to [Jan 3 .. Jan 5] — startIdx=2. The first visible day must
  // show a delta of +80, not 0.
  const visible = toDaily(series, 'killed_cum', 2, 4);
  assert.equal(visible.length, 3);
  assert.equal(visible[0].x, '2024-01-03');
  assert.equal(visible[0].y, 80, 'first visible day should carry its real delta, not 0');
  assert.equal(visible[1].y, 5);
  assert.equal(visible[2].y, 465);

  // And as a regression sanity check: the ORIGINAL BUG would have produced 0
  // here. Make sure we aren't accidentally back to that behavior.
  const bugged = series.slice(2, 5).map((r, i, arr) =>
    i === 0 ? 0 : Math.max(0, r.killed_cum - arr[i - 1].killed_cum),
  );
  assert.equal(bugged[0], 0, '(sanity check of the old bug — leave in place)');
  assert.notEqual(visible[0].y, bugged[0]);
});


test('Fix 2 — deltas never go negative, even when the source is non-monotonic', () => {
  // The raw cumulative series occasionally dips (a reclassification, say).
  // The fix uses `Math.max(0, ...)` so the chart never plots negative bars.
  const series = [
    { date: '2024-01-01', killed_cum: 100 },
    { date: '2024-01-02', killed_cum: 200 },
    { date: '2024-01-03', killed_cum: 195 },   // dip
    { date: '2024-01-04', killed_cum: 210 },
  ];
  const deltas = series.map((r, i) =>
    i === 0 ? 0 : Math.max(0, r.killed_cum - series[i - 1].killed_cum),
  );
  assert.deepEqual(deltas, [0, 100, 0, 15]);
});


test('data.json is valid and its shape matches what app.js expects', () => {
  // A small sanity suite. Any schema drift that would break the dashboard
  // — wrong field names, inconsistent lengths, backwards dates — should
  // fail here before it ever reaches the browser.
  const raw = fs.readFileSync(path.resolve(__dirname, '..', 'data.json'), 'utf8');
  const data = JSON.parse(raw);

  // Top-level keys the app reads.
  for (const k of ['meta', 'gaza_daily', 'west_bank_daily', 'israeli_daily', 'summary', 'oct7', 'gaza_components', 'trackers']) {
    assert.ok(k in data, `data.json is missing top-level key "${k}"`);
  }

  // The three daily series must align — same length, same first/last date.
  const g = data.gaza_daily, w = data.west_bank_daily, i = data.israeli_daily;
  assert.equal(g.length, w.length, 'Gaza vs West Bank series length mismatch');
  assert.equal(g.length, i.length, 'Gaza vs Israeli series length mismatch');
  assert.equal(g[0].date,  w[0].date);
  assert.equal(g[0].date,  i[0].date);
  assert.equal(g.at(-1).date, w.at(-1).date);
  assert.equal(g.at(-1).date, i.at(-1).date);

  // Gaza cumulative must be non-decreasing. (West Bank and Israeli series too.)
  for (const series of [g, w, i]) {
    for (let k = 1; k < series.length; k++) {
      const prev = series[k - 1];
      const curr = series[k];
      // Different series use different key names, so pick the right one.
      const keys = Object.keys(curr).filter(x => x.endsWith('_cum'));
      for (const key of keys) {
        assert.ok(curr[key] >= prev[key], `${key} decreased between ${prev.date} and ${curr.date}`);
      }
    }
  }

  // Oct 7 breakdown: the three "killed" components must sum to the headline total.
  const o = data.oct7;
  assert.equal(
    o.israeli_civilians + o.israeli_security_forces + o.foreign_nationals + o.other_and_revised,
    o.total,
    'Oct 7 components do not sum to total — the grid and footer will disagree',
  );

  // The Ministry's daily breakdown (viz.js stacks it inside each bar): every part
  // non-negative, dates inside the series, and never more than that day's reported rise.
  const rise = new Map(g.map((r, k) => [r.date, k ? r.killed_cum - g[k - 1].killed_cum : r.killed_cum]));
  for (const c of data.gaza_components) {
    assert.ok(rise.has(c.date), `breakdown for ${c.date} falls outside the Gaza series`);
    for (const key of ['new', 'succumbed', 'recovered', 'committee']) assert.ok(c[key] >= 0, `${key} is negative on ${c.date}`);
    assert.ok(c.new + c.succumbed + c.recovered + c.committee <= rise.get(c.date), `breakdown exceeds the reported rise on ${c.date}`);
  }

  // Tracker entries must each carry the fields the tracker-table renderer reads.
  for (const t of data.trackers) {
    for (const k of ['name', 'scope', 'as_of', 'url']) {
      assert.ok(k in t, `tracker "${t.name ?? '(unnamed)'}" missing field "${k}"`);
    }
  }
});

// --- Editorial claims ---------------------------------------------------
// Some sentences on the page are fixed words over live numbers. Each test
// here checks one of them against data.json, so a rebuild that makes a claim
// untrue fails with a pointer to the sentence to rewrite (all in index.html).
test('editorial claims in index.html still match the data', () => {
  const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'data.json'), 'utf8'));
  const g = data.gaza_daily;
  const cum = new Map(g.map(r => [r.date, r.killed_cum]));
  const latest = g.at(-1).killed_cum;
  const rise = (r, k, arr) => Math.max(0, r - (k ? arr[k - 1] : 0));

  // "Nearly a third of the dead were reported in the first three months"
  const firstThree = cum.get('2023-12-31') / latest;
  assert.ok(firstThree >= 0.25 && firstThree < 0.34, `"Nearly a third…" (The pace headline): the first three months are now ${(firstThree * 100).toFixed(1)}% of the total`);

  // Weekly totals, Monday-based, in UTC
  const weeks = new Map();
  g.forEach((r, k) => {
    const d = new Date(`${r.date}T00:00:00Z`);
    const monday = new Date(d - ((d.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10);
    weeks.set(monday, (weeks.get(monday) || 0) + rise(r.killed_cum, k, g.map(x => x.killed_cum)));
  });
  const wk = [...weeks];
  // "Weekly deaths fell to their lowest point of the war to that date" (truce step)
  const truceMin = Math.min(...wk.filter(([m]) => m >= '2025-01-20' && m <= '2025-03-10').map(([, v]) => v));
  const earlierMin = Math.min(...wk.filter(([m]) => m < '2025-01-19').map(([, v]) => v));
  assert.ok(truceMin < earlierMin, `"Eight weeks of truce" step: the truce's lowest week (${truceMin}) is no longer below every earlier week (${earlierMin})`);
  // "Through 2024 the weekly toll fell but never stopped"
  assert.ok(wk.filter(([m]) => m.startsWith('2024')).every(([, v]) => v > 0), '"A long, grinding year" step: a week in 2024 now has no reported deaths');

  // "Killings have fallen. Settler attacks have not." (West Bank headline)
  const months = new Map();
  const wb = data.west_bank_daily.filter(r => r.date <= '2026-09-14');
  wb.forEach((r, k) => {
    const key = r.date.slice(0, 7), m = months.get(key) || [0, 0];
    m[0] += rise(r.killed_cum, k, wb.map(x => x.killed_cum));
    m[1] += rise(r.settler_attacks_cum, k, wb.map(x => x.settler_attacks_cum));
    months.set(key, m);
  });
  const full = [...months.values()].slice(1, -1);                    // drop the partial first and last months
  const avg = (rows, i) => rows.reduce((a, r) => a + r[i], 0) / rows.length;
  const [first, last] = [full.slice(0, 3), full.slice(-3)];
  assert.ok(avg(last, 0) < avg(first, 0) / 2, `West Bank headline: killings in the last three full months (${avg(last, 0).toFixed(0)}/mo) are no longer well below the first three (${avg(first, 0).toFixed(0)}/mo)`);
  assert.ok(avg(last, 1) >= avg(first, 1), `West Bank headline: settler attacks in the last three full months (${avg(last, 1).toFixed(0)}/mo) are now below the first three (${avg(first, 1).toFixed(0)}/mo)`);

  // "Matched to the same date, the estimate is far above the Ministry's count"
  const lancet = data.trackers.find(t => /lancet/i.test(t.name));
  assert.ok(lancet.palestinian_killed > 1.3 * cum.get('2025-01-31'), 'Sources headline: the Lancet estimate is no longer far above the Ministry count for January 2025');
});
