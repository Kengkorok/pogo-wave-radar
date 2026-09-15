/* Verify the manual Hawlucha (Mexico) event renders like a normal event.
   Run: node scripts/verify-hawlucha.js                          (from repo root) */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const docs = path.join(__dirname, '..', 'docs');
const SLUG = 'celebrate-with-hawlucha-mexico-2026';
const dom = new JSDOM(fs.readFileSync(path.join(docs, 'index.html'), 'utf8'),
  { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.fetch = async (url) => {
  const f = path.join(docs, String(url).replace(/^\//, ''));
  return { json: async () => JSON.parse(fs.readFileSync(f, 'utf8')), ok: true };
};
const LANGV = process.env.VERIFY_LANG === 'ms' ? 'ms' : null;
window.localStorage = { getItem: (k) => (k === 'pwr-lang' ? LANGV : null), setItem: () => {}, removeItem: () => {} };
window.navigator.clipboard = { writeText: async () => {} };
window.eval(fs.readFileSync(path.join(docs, 'config.js'), 'utf8') + '\n' +
           fs.readFileSync(path.join(docs, 'app.js'), 'utf8'));
document.dispatchEvent(new window.Event('DOMContentLoaded'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const checks = [];
const ok = (name, pass, detail) => checks.push({ name, pass, detail });

setTimeout(async () => {
  // --- All Events tab: the manual event must be listed ---
  const allBtn = Array.from(document.querySelectorAll('.tabs button')).find((b) => b.dataset.tab === 'all');
  allBtn.click();
  await sleep(200);
  const rows = Array.from(document.querySelectorAll('#allList .allrow'));
  const row = rows.find((r) => r.textContent.includes('Hawlucha'));
  ok('listed in All Events', !!row, row ? row.textContent.trim().slice(0, 120) : 'NOT FOUND');

  // --- search finds it by name ---
  const input = document.getElementById('evSearch');
  input.value = 'hawlucha';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(150);
  const hits = Array.from(document.querySelectorAll('#allList .allrow')).filter((r) => r.textContent.includes('Hawlucha'));
  ok('searchable via #evSearch', hits.length === 1, hits.length + ' hit(s)');
  input.value = '';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(100);

  // --- Wave tab: exactly one city row, Mexico City, correct coords ---
  const waveBtn = Array.from(document.querySelectorAll('.tabs button')).find((b) => b.dataset.tab === 'wave');
  waveBtn.click();
  await sleep(200);
  const sel = document.getElementById('waveSel');
  sel.value = SLUG;
  sel.dispatchEvent(new window.Event('change'));
  await sleep(300);
  const wl = document.getElementById('waveList');
  const cityRows = wl.querySelectorAll('.wavetable .wrow');
  ok('wave: exactly 1 city row (city_only)', cityRows.length === 1, cityRows.length + ' row(s)');
  ok('wave: city is Mexico City', wl.textContent.includes('Mexico City'), '');
  const chip = wl.querySelector('.chip[data-coords]');
  ok('wave: coords chip = 19.4361, -99.1414', !!chip && chip.dataset.coords === '19.4361, -99.1414',
     chip ? chip.dataset.coords : 'no chip');
  ok('wave: mexico flag rendered', !!wl.querySelector('img.flag[src="img/flags/mx.svg"]'), '');
  // no other-country coords anywhere in this event's wave
  const otherCoords = Array.from(wl.querySelectorAll('.chip[data-coords]'))
    .map((c) => c.dataset.coords).filter((c) => c !== '19.4361, -99.1414');
  ok('wave: no other country coords', otherCoords.length === 0, otherCoords.join(' | ') || 'none');
  ok('wave: local-time template shown', wl.textContent.includes('waktu tempatan') || wl.textContent.includes('local time'),
     '');
  const detail = wl.querySelector('details.fulldetail');
  ok('wave: "Read full details" block present', !!detail, '');
  const img = wl.querySelector('.fulldetail-body img');
  ok('detail: infographic image present', !!img && img.getAttribute('src') === 'img/hawlucha-mexico-2026.webp',
     img ? img.getAttribute('src') : 'no img');
  ok('detail: bonuses rendered', wl.textContent.includes('Incense'), '');
  ok('detail: source link to event source', !!wl.querySelector('a.src-link'), '');

  // --- Live Now / next bar must not crash with the new city in CITIES ---
  const live = document.getElementById('live');
  ok('Live Now rendered', live && live.innerHTML.length > 0, '');
  const tzOpts = Array.from(document.querySelectorAll('#tz option')).map((o) => o.value);
  ok('tz dropdown includes America/Mexico_City', tzOpts.includes('America/Mexico_City'), tzOpts.length + ' zones');

  // --- asset exists on disk (relative src must resolve on Pages) ---
  ok('asset docs/img/hawlucha-mexico-2026.webp exists',
     fs.existsSync(path.join(docs, 'img', 'hawlucha-mexico-2026.webp')), '');
  ok('asset docs/img/flags/mx.svg exists', fs.existsSync(path.join(docs, 'img', 'flags', 'mx.svg')), '');

  console.log('\n=== VERIFY: Celebrate with Hawlucha (Mexico) ===');
  let fail = 0;
  for (const c of checks) {
    if (!c.pass) fail++;
    console.log((c.pass ? 'PASS  ' : 'FAIL  ') + c.name + (c.detail ? '   [' + c.detail + ']' : ''));
  }
  console.log('\n' + (checks.length - fail) + '/' + checks.length + ' passed');
  process.exit(fail ? 1 : 0);
}, 900);