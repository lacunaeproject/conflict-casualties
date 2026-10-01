/* Type lab panel: swaps the face of every big number on the real page.
   Injected by tools/typelab/serve.py only; never shipped. The choice is
   remembered across pages so Home and Iraq can be compared. */
(function () {
  const FONTS = window.TYPELAB_FONTS;
  const KEY = 'typelab';
  const TARGETS = '.kpi-value, .rm-num, .era-stats strong, .cell .val, .yr-facts strong, .us-grid .val, .yr-readout strong';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = window.TYPELAB_FONT_URL;
  document.head.append(link);

  const override = document.createElement('style');
  document.head.append(override);

  let st = Object.assign({ i: 0, open: true, uniform: false }, load());
  // Resolve the saved face by name, so adding fonts never shifts a choice.
  if (st.name) { const k = FONTS.findIndex(f => f.name === st.name); if (k >= 0) st.i = k; }
  if (st.wght == null) st.wght = FONTS[st.i].wght;
  if (st.track == null) st.track = FONTS[st.i].track;

  const apply = () => {
    const f = FONTS[st.i];
    document.documentElement.style.setProperty('--font-num', f.stack);
    override.textContent = st.uniform
      ? `.rd :is(${TARGETS}) { font-weight: ${st.wght} !important; letter-spacing: ${st.track}em !important; font-variation-settings: normal !important; }`
      : '';
    st.name = f.name;
    render();
    save(st);
    // Charts measure text once; nudge layout-sensitive bits.
    window.dispatchEvent(new Event('resize'));
  };
  const pick = i => {
    st.i = (i + FONTS.length) % FONTS.length;
    st.wght = FONTS[st.i].wght;
    st.track = FONTS[st.i].track;
    st.uniform = true;
    apply();
  };

  // Panel lives in a shadow root so the site's CSS can't touch it.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147483000';
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
  <style>
    :host { all: initial; }
    * { box-sizing: border-box; }
    .p { width: 340px; max-height: min(78vh, 720px); display: flex; flex-direction: column; background: #fff; color: #111317;
         border-radius: 18px; box-shadow: 0 0 0 1px rgba(16,19,23,.08), 0 24px 60px -20px rgba(16,19,23,.45);
         font: 13px/1.35 "Source Sans 3", system-ui, sans-serif; overflow: hidden; }
    .p.closed { width: auto; }
    .p.closed .body { display: none; }
    header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid rgba(16,19,23,.07); }
    header b { font-weight: 700; }
    header span { color: #8b9098; }
    header .sp { flex: 1; }
    button { font: inherit; cursor: pointer; border: 0; border-radius: 999px; background: rgba(118,122,132,.12); color: inherit; padding: 6px 11px; }
    button:hover { background: rgba(118,122,132,.2); }
    button.dark { background: #16181b; color: #fff; }
    a { color: inherit; text-decoration: none; }
    a button { color: inherit; }
    .body { display: flex; flex-direction: column; min-height: 0; }
    .list { overflow: auto; padding: 6px; flex: 1; min-height: 120px; }
    .row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 2px 10px; width: 100%; text-align: left;
           padding: 8px 10px; border-radius: 12px; background: none; }
    .row:hover { background: rgba(118,122,132,.1); }
    .row.on { background: #16181b; color: #fff; }
    .row .nm { font-weight: 600; }
    .row .kd { grid-column: 1; font-size: 11px; color: #8b9098; }
    .row.on .kd { color: #b9bec6; }
    .row .smp { grid-row: 1 / span 2; grid-column: 2; font-size: 26px; line-height: 1; font-variant-numeric: lining-nums tabular-nums; }
    .ctl { padding: 10px 14px 12px; border-top: 1px solid rgba(16,19,23,.07); display: grid; gap: 8px; }
    label { display: grid; grid-template-columns: 70px 1fr 52px; align-items: center; gap: 8px; color: #3b3f46; }
    label output { text-align: right; font-variant-numeric: tabular-nums; color: #666b73; }
    input[type=range] { width: 100%; accent-color: #16181b; }
    .chk { display: flex; gap: 6px; align-items: center; grid-template-columns: none; }
    .btns { display: flex; flex-wrap: wrap; gap: 6px; }
    .hint { color: #8b9098; font-size: 11px; }
    @media (prefers-color-scheme: dark) {
      .p { background: #141619; color: #f1f3f5; box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 24px 60px -20px rgba(0,0,0,.8); }
      header, .ctl { border-color: rgba(255,255,255,.07); }
      .row.on, button.dark { background: #f1f3f5; color: #0a0b0d; }
      .row.on .kd { color: #4b5058; }
      label { color: #cfd3d9; }
      input[type=range] { accent-color: #f1f3f5; }
    }
  </style>
  <div class="p">
    <header><b>Number type</b><span class="cur"></span><span class="sp"></span>
      <button class="prev" title="Previous face ( [ )">‹</button><button class="next" title="Next face ( ] )">›</button>
      <button class="tog" title="Collapse (\\)">–</button></header>
    <div class="body">
      <div class="list"></div>
      <div class="ctl">
        <label class="chk"><input type="checkbox" class="uni"> One weight and tracking for every number</label>
        <label>Weight <input type="range" class="w" min="200" max="900" step="10"><output class="wo"></output></label>
        <label>Tracking <input type="range" class="t" min="-0.08" max="0.04" step="0.005"><output class="to"></output></label>
        <div class="btns">
          <button class="jump">Next number on page ↓</button>
          <a href="/tools/typelab/specimen.html"><button>Specimen</button></a>
          <a href="/index.html"><button>Home</button></a>
          <a href="/iraq.html"><button>Iraq</button></a>
          <button class="copy dark">Copy CSS</button>
        </div>
        <div class="hint">Keys: [ and ] change face · \\ hides panel</div>
      </div>
    </div>
  </div>`;
  const $ = s => root.querySelector(s);
  const list = $('.list');
  list.innerHTML = FONTS.map((f, i) =>
    `<button class="row" data-i="${i}"><span class="nm">${f.name}</span><span class="smp" style="font-family:${f.stack.replace(/"/g, '&quot;')};font-weight:${f.wght};letter-spacing:${f.track}em">73,928</span><span class="kd">${f.kind}${f.note ? ' · ' + f.note : ''}</span></button>`).join('');
  list.addEventListener('click', e => { const r = e.target.closest('.row'); if (r) pick(+r.dataset.i); });
  $('.prev').onclick = () => pick(st.i - 1);
  $('.next').onclick = () => pick(st.i + 1);
  $('.tog').onclick = () => { st.open = !st.open; apply(); };
  $('.uni').onchange = e => { st.uniform = e.target.checked; apply(); };
  $('.w').oninput = e => { st.wght = +e.target.value; st.uniform = true; apply(); };
  $('.t').oninput = e => { st.track = +e.target.value; st.uniform = true; apply(); };
  let jumpAt = -1;
  $('.jump').onclick = () => {
    const els = Array.from(document.querySelectorAll(TARGETS)).filter(el => el.offsetParent);
    jumpAt = (jumpAt + 1) % els.length;
    els[jumpAt].scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  $('.copy').onclick = async () => {
    const f = FONTS[st.i];
    const css = `/* ${f.name}${f.css ? `\n   Google Fonts: family=${f.css}` : ''} */\n.rd { --font-num: ${f.stack}; }` +
      (st.uniform ? `\n.rd :is(${TARGETS}) { font-weight: ${st.wght}; letter-spacing: ${st.track}em; }` : '');
    try { await navigator.clipboard.writeText(css); $('.copy').textContent = 'Copied'; } catch (e) { prompt('Copy this CSS', css); }
    setTimeout(() => { $('.copy').textContent = 'Copy CSS'; }, 1500);
  };
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key === ']') pick(st.i + 1);
    else if (e.key === '[') pick(st.i - 1);
    else if (e.key === '\\') { st.open = !st.open; apply(); }
  });

  function render() {
    const f = FONTS[st.i];
    $('.p').classList.toggle('closed', !st.open);
    $('.tog').textContent = st.open ? '–' : '+';
    $('.cur').textContent = '· ' + f.name;
    list.querySelectorAll('.row').forEach((r, i) => r.classList.toggle('on', i === st.i));
    $('.uni').checked = st.uniform;
    $('.w').value = st.wght; $('.wo').textContent = st.wght;
    $('.t').value = st.track; $('.to').textContent = st.track.toFixed(3);
  }
  apply();
  list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
})();
