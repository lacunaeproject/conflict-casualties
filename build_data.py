"""Build a compact data bundle for the dashboard."""
import json
from datetime import datetime, timedelta

# Load source data
with open('data/casualties_daily.json') as f:
    gaza_raw = json.load(f)
with open('data/west_bank_daily.json') as f:
    wb_raw = json.load(f)
with open('data/killed-in-gaza-summary.json') as f:
    summary = json.load(f)

# Helper: forward-fill cumulative values and compute daily deltas
def best_cum_killed(r):
    return r.get('ext_killed_cum') or r.get('killed_cum') or 0

def best_cum_injured(r):
    return r.get('ext_injured_cum') or r.get('injured_cum') or 0

# Build a continuous daily series for Gaza (some dates are missing in the source — we forward-fill)
start = datetime(2023, 10, 7)
end = datetime.strptime(gaza_raw[-1]['report_date'], '%Y-%m-%d')
days = (end - start).days + 1

gaza_by_date = {r['report_date']: r for r in gaza_raw}
wb_by_date = {r['report_date']: r for r in wb_raw}

gaza_series = []
last_killed = 0
last_injured = 0
last_children = 0
last_women = 0
last_press = 0
last_medical = 0

for i in range(days):
    d = (start + timedelta(days=i)).strftime('%Y-%m-%d')
    if d in gaza_by_date:
        r = gaza_by_date[d]
        last_killed = best_cum_killed(r) or last_killed
        last_injured = best_cum_injured(r) or last_injured
        last_children = r.get('ext_killed_children_cum') or last_children
        last_women = r.get('ext_killed_women_cum') or last_women
        last_press = r.get('ext_press_killed_cum') or r.get('press_killed_cum') or last_press
        last_medical = r.get('ext_med_killed_cum') or r.get('med_killed_cum') or last_medical
    gaza_series.append({
        'date': d,
        'killed_cum': last_killed,
        'injured_cum': last_injured,
        'children_cum': last_children,
        'women_cum': last_women,
    })

# West Bank series
wb_series = []
last_wb_killed = 0
last_wb_injured = 0
last_wb_children = 0
last_wb_settler = 0
for i in range(days):
    d = (start + timedelta(days=i)).strftime('%Y-%m-%d')
    if d in wb_by_date:
        r = wb_by_date[d]
        last_wb_killed = r.get('killed_cum') or last_wb_killed
        last_wb_injured = r.get('injured_cum') or last_wb_injured
        last_wb_children = r.get('killed_children_cum') or last_wb_children
        last_wb_settler = r.get('settler_attacks_cum') or last_wb_settler
    wb_series.append({
        'date': d,
        'killed_cum': last_wb_killed,
        'injured_cum': last_wb_injured,
        'children_cum': last_wb_children,
        'settler_attacks_cum': last_wb_settler,
    })

# Israeli deaths timeline — hand-curated from public reporting
# Oct 7 attacks: 1,195 killed (Israeli MFA/Wikipedia consolidated)
# IDF ground operations since Oct 27 2023 — key milestones in soldier deaths (public IDF/ToI reports)
# Values between milestones are linearly interpolated
israeli_milestones = [
    ('2023-10-06', {'oct7': 0, 'idf_gaza': 0, 'civilians_post': 0}),
    ('2023-10-07', {'oct7': 1195, 'idf_gaza': 0, 'civilians_post': 0}),  # attack day
    ('2023-10-27', {'oct7': 1195, 'idf_gaza': 0, 'civilians_post': 5}),  # ground invasion begins
    ('2023-12-31', {'oct7': 1195, 'idf_gaza': 172, 'civilians_post': 10}),
    ('2024-04-01', {'oct7': 1195, 'idf_gaza': 260, 'civilians_post': 15}),
    ('2024-08-15', {'oct7': 1195, 'idf_gaza': 335, 'civilians_post': 20}),
    ('2025-01-19', {'oct7': 1195, 'idf_gaza': 405, 'civilians_post': 25}),  # Jan 2025 ceasefire
    ('2025-03-18', {'oct7': 1195, 'idf_gaza': 410, 'civilians_post': 25}),
    ('2025-10-10', {'oct7': 1195, 'idf_gaza': 466, 'civilians_post': 30}),  # Oct 2025 ceasefire
    ('2026-04-16', {'oct7': 1195, 'idf_gaza': 475, 'civilians_post': 32}),
    ('2026-09-24', {'oct7': 1195, 'idf_gaza': 477, 'civilians_post': 32}),  # ToI: 479 incl. 2 killed Sep 25, 2026
]

# Linear interpolation between milestones for daily time series
from datetime import date as date_cls
def _to_date(s):
    return datetime.strptime(s, '%Y-%m-%d')

israeli_series = []
for i in range(days):
    d = start + timedelta(days=i)
    # find bracketing milestones
    prev, nxt = israeli_milestones[0], israeli_milestones[-1]
    for j in range(len(israeli_milestones) - 1):
        a, b = israeli_milestones[j], israeli_milestones[j+1]
        if _to_date(a[0]) <= d <= _to_date(b[0]):
            prev, nxt = a, b
            break
    t_span = (_to_date(nxt[0]) - _to_date(prev[0])).days or 1
    t_pos = (d - _to_date(prev[0])).days
    frac = t_pos / t_span
    def interp(k):
        return round(prev[1][k] + (nxt[1][k] - prev[1][k]) * frac)
    oct7 = interp('oct7')
    idf = interp('idf_gaza')
    civ = interp('civilians_post')
    israeli_series.append({
        'date': d.strftime('%Y-%m-%d'),
        'oct7_cum': oct7,
        'idf_gaza_cum': idf,
        'civilians_post_cum': civ,
        'total_cum': oct7 + idf + civ,
    })

# Gaza governorate distribution — based on published reporting of population
# distributions and damage assessments (UNOSAT / OCHA / Airwars reporting patterns).
# These are proportional estimates applied to the latest total.
# Sources: UN OCHA pre-war population + UNOSAT damage assessment patterns reported in
# Al Jazeera and Reuters coverage of 2024-2025.
gov_distribution = {
    'Gaza (Gaza City)': 0.33,
    'North Gaza': 0.18,
    'Deir al-Balah': 0.11,
    'Khan Younis': 0.25,
    'Rafah': 0.13,
}
latest_gaza_total = summary['gaza']['killed']['total']
governorate_estimates = [
    {'name': name, 'estimated_killed': round(latest_gaza_total * pct), 'share_pct': round(pct * 100, 1)}
    for name, pct in gov_distribution.items()
]

# Oct 7 detailed breakdown (from Wikipedia/Israeli MFA/INSS)
oct7 = {
    'total': 1195,
    'israeli_civilians': 724,
    'israeli_security_forces': 373,
    'foreign_nationals': 71,
    'other_and_revised': 27,
    'children_killed': 36,
    'hostages_taken': 251,
    'nova_festival_killed': 364,
    'injured': 8730,
}

# Source tracker snapshot — different authorities give different totals
trackers = [
    {
        'name': 'Gaza Ministry of Health (via Tech for Palestine)',
        'palestinian_killed': summary['gaza']['killed']['total'],
        'palestinian_injured': summary['gaza']['injured']['total'],
        'scope': 'Gaza Strip only (direct violence). Names partially verified.',
        'as_of': summary['gaza']['last_update'],
        'url': 'https://data.techforpalestine.org/',
    },
    {
        'name': 'UN OCHA',
        'palestinian_killed': summary['gaza']['killed']['total'],  # OCHA relies on GHM
        'palestinian_injured': summary['gaza']['injured']['total'],
        'scope': 'Relies on Gaza MoH for Gaza; independent verification for West Bank.',
        'as_of': '2026-09-18',
        'url': 'https://www.ochaopt.org/',
    },
    {
        'name': "B'Tselem",
        'palestinian_killed': None,  # B'Tselem publishes named fatalities; partial
        'palestinian_injured': None,
        'scope': 'Named individuals, verified incidents. More conservative count.',
        'as_of': '2026-02-17',
        'url': 'https://statistics.btselem.org/en/all-fatalities/by-date-of-incident',
    },
    {
        'name': 'Wikipedia (Casualties of the Gaza war)',
        'palestinian_killed': 75131,
        'palestinian_injured': None,
        'scope': 'Gaza MoH (73,922) plus West Bank (1,209). Aggregates official and independent reports.',
        'as_of': '2026-09-22',
        'url': 'https://en.wikipedia.org/wiki/Casualties_of_the_Gaza_war',
    },
    {
        'name': 'Lancet (peer-reviewed est.)',
        'palestinian_killed': 75200,
        'palestinian_injured': None,
        'scope': 'Violent deaths only, through Jan 2025. Estimated 35% undercount vs. MoH official count.',
        'as_of': '2026-02-18',
        'url': 'https://www.aljazeera.com/features/2026/2/18/gaza-death-toll-exceeds-75000-as-independent-data-verify-loss',
    },
]

bundle = {
    'meta': {
        'data_as_of': summary['gaza']['last_update'],
        'days_of_data': days,
        'generated_at': datetime.now().isoformat(),
    },
    'gaza_daily': gaza_series,
    'west_bank_daily': wb_series,
    'israeli_daily': israeli_series,
    'summary': summary,
    'oct7': oct7,
    'governorate_estimates': governorate_estimates,
    'trackers': trackers,
}

with open('data.json', 'w') as f:
    json.dump(bundle, f, separators=(',', ':'))

print(f"Wrote data.json — {days} days, Gaza cum: {gaza_series[-1]['killed_cum']:,}, WB cum: {wb_series[-1]['killed_cum']:,}, Israeli cum: {israeli_series[-1]['total_cum']:,}")

# --- Freshness signals for search engines: the dashboard's sitemap <lastmod>
# and the Dataset JSON-LD dateModified both follow the data date.
import re

as_of = bundle['meta']['data_as_of']
for path, pattern, repl in [
    ('sitemap.xml', r'(<loc>https://conflictcasualties\.org/</loc><lastmod>)[^<]*', rf'\g<1>{as_of}'),
    ('index.html', r'("dateModified": ")[^"]*', rf'\g<1>{as_of}'),
    # The conflict switcher's Gaza toll, shown on every page.
    ('ui.js', r"(id: 'israel-palestine',[\s\S]*?toll: ')[^']*", rf"\g<1>{summary['gaza']['killed']['total']:,}"),
]:
    with open(path, encoding='utf-8') as f:
        text = f.read()
    with open(path, 'w', encoding='utf-8') as f:
        f.write(re.sub(pattern, repl, text, count=1))
print(f"Stamped sitemap.xml, index.html and ui.js with {as_of}")

# --- Names for the closing memorial: identified dead under one year old ---
# Pulls the Ministry of Health list of identified dead from Tech for Palestine
# and keeps only infants (age 0), English and Arabic names. Skipped quietly if
# the network is unavailable, leaving the previous file in place.
import urllib.request

NAMES_URL = 'https://data.techforpalestine.org/api/v2/killed-in-gaza.min.json'
try:
    with urllib.request.urlopen(urllib.request.Request(NAMES_URL, headers={'User-Agent': 'conflict-casualties-build'}), timeout=60) as r:
        people = json.load(r)
    infants = [[p['en_name'], p['name']] for p in people if p.get('age') == 0 and p.get('en_name')]
    with open('data/names-infants.json', 'w', encoding='utf-8') as f:
        json.dump({
            'count': len(infants),
            'records': len(people),
            'includes_until': summary.get('known_killed_in_gaza', {}).get('includes_until'),
            'names': infants,
        }, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Wrote data/names-infants.json — {len(infants):,} names of {len(people):,} identified")
except Exception as e:
    print(f"Skipped names list ({e})")
