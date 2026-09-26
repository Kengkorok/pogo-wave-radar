/* jsdom test harness for pogo-wave-radar (and similar static GitHub Pages apps).
   Loads the real index.html + config.js + app.js, stubs fetch to read docs/ from disk,
   dispatches DOMContentLoaded, then lets you assert on the rendered DOM.

   Run from repo root:
     npm install jsdom --no-save
     node scripts/test-harness.js

   Covers: next-event banner, Nests tab, All-Events search, City Safari tab
   (6 cards / compare table / hotspot chips / countdowns / timezone switch /
   expired-edition auto-hide), and the Moonlight tab (7 country rows in wave order,
   burst countdowns, LIVE row + live bar, tz switch, auto-hide after the edition).

   REALM GOTCHA: app.js is evaluated with window.eval(), so its `let`/`const`
   (SAFARI, EVENTS, USER_TZ…) are NOT reachable from a later window.eval — a later
   `SAFARI = [...]` silently creates window.SAFARI while the app keeps its own
   binding. Test the app's *functions* (they are global object properties) instead:
   stub window.safariStatus, window.renderSafari, etc.
*/
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const docs = path.join(__dirname, '..', 'docs');
const html = fs.readFileSync(path.join(docs, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

// stub fetch: serve any docs/ file from disk
window.fetch = async (url) => {
  const file = path.join(docs, String(url).replace(/^\//, ''));
  const data = fs.readFileSync(file, 'utf8');
  return { json: async () => JSON.parse(data), ok: true };
};
window.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
window.navigator.clipboard = { writeText: async () => {} };

// eval config + app in the window context
const configSrc = fs.readFileSync(path.join(docs, 'config.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(docs, 'app.js'), 'utf8');
window.eval(configSrc + '\n' + appSrc);
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

setTimeout(async () => {
  const bar = document.getElementById('nextbar');
  console.log('=== NEXTBAR ===');
  console.log('hidden:', bar && bar.hidden, '| className:', bar && bar.className);
  console.log('html:', bar && bar.innerHTML);

  const live = document.getElementById('live');
  console.log('\n=== LIVE (first 200 chars) ===');
  console.log(live.innerHTML.slice(0, 200));

  const cd = document.querySelector('.nextcd');
  console.log('\n=== countdown ===');
  console.log('data-cd:', cd && cd.dataset.cd, '| text:', cd && cd.textContent);

  // ---- NESTS TAB ----
  const nestsBtn = Array.from(document.querySelectorAll('.tabs button')).find((b) => b.dataset.tab === 'nests');
  if (nestsBtn) nestsBtn.click();
  await sleep(200);
  const nests = document.getElementById('nests');
  const mig = document.getElementById('nestMigrate');
  console.log('\n=== NESTS TAB ===');
  console.log('nests section hidden:', nests && nests.hidden);
  console.log('migration banner hidden:', mig && mig.hidden);
  console.log('migration banner:', mig && mig.innerHTML);
  console.log('nest cards:', document.querySelectorAll('#nestList .nestcard').length);
  console.log('combee cards:', Array.from(document.querySelectorAll('#nestList .nestcard')).filter((c) => c.textContent.includes('Combee')).length);
  console.log('stardust badges:', document.querySelectorAll('#nestList .badge.sd').length);
  console.log('coords chips:', document.querySelectorAll('#nestList .chip[data-coords]').length);
  console.log('nest cd text:', mig && mig.querySelector('[data-cd]') && mig.querySelector('[data-cd]').textContent);

  // ---- EVENT SEARCH (All Events tab) ----
  const allBtn = Array.from(document.querySelectorAll('.tabs button')).find((b) => b.dataset.tab === 'all');
  if (allBtn) allBtn.click();
  await sleep(150);
  const total = document.querySelectorAll('#allList .allrow').length;
  const input = document.getElementById('evSearch');
  console.log('\n=== EVENT SEARCH ===');
  console.log('all tab rows (no query):', total);
  console.log('placeholder:', input && input.placeholder);
  if (input) {
    input.value = 'mewtwo';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    await sleep(100);
    console.log('rows after "mewtwo":', document.querySelectorAll('#allList .allrow').length);
    console.log('sample:', Array.from(document.querySelectorAll('#allList .allrow')).slice(0, 3).map((r) => r.textContent.trim().replace(/\s+/g, ' ').slice(0, 60)));
    input.value = 'zzz-no-such-event';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    await sleep(100);
    const empty = document.querySelector('#allList .empty');
    console.log('empty state:', empty && empty.textContent);
    input.value = '';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    await sleep(100);
    console.log('rows after clearing:', document.querySelectorAll('#allList .allrow').length);
  }

  // ---- CITY SAFARI TAB (in-person events) ----
  const sfBtn = document.querySelector('.tabs button[data-tab="safari"]');
  if (sfBtn) sfBtn.click();
  await sleep(250);
  console.log('\n=== CITY SAFARI TAB ===');
  console.log('section hidden:', document.getElementById('safari').hidden);
  console.log('cards:', document.querySelectorAll('#safariList .safaricard').length);
  console.log('compare rows:', document.querySelectorAll('#safariList .scmptable tbody tr').length);
  console.log('hotspot chips:', document.querySelectorAll('#safariList .hotrow .chip[data-coords]').length);
  console.log('tab button hidden:', sfBtn && sfBtn.hidden);
  console.log('countdowns:', document.querySelectorAll('#safariList [data-cd]').length);
  console.log('addon blocks:', document.querySelectorAll('#safariList .addons').length);
  const sfTable = document.querySelector('#safariList .scmptable');
  console.log('compare table:', sfTable && sfTable.textContent.replace(/\s+/g, ' ').slice(0, 420));
  console.log('safari city order:', Array.from(document.querySelectorAll('#safariList .scmptable tbody tr td:first-child')).map((e) => e.textContent.trim()).join(' → '));
  const sfFirst = document.querySelector('#safariList .safaricard');
  console.log('first card:', sfFirst && sfFirst.textContent.replace(/\s+/g, ' ').slice(0, 260));
  // status maths: a finished edition must read 'ended' (that is what the filter uses)
  console.log('past edition status:', window.safariStatus({ days: ['2026-09-01', '2026-09-02'], tz: 'Asia/Kuala_Lumpur', start: '10:00', end: '18:00' }).st);

  const tzSel = document.getElementById('tz');
  if (tzSel) {
    tzSel.value = 'Asia/Kuala_Lumpur';
    tzSel.dispatchEvent(new window.Event('change', { bubbles: true }));
    await sleep(200);
    const tbl2 = document.querySelector('#safariList .scmptable');
    console.log('\n=== after tz -> Asia/Kuala_Lumpur ===');
    console.log('header:', tbl2 && tbl2.querySelector('thead tr').textContent.replace(/\s+/g, ' '));
    const rows2 = tbl2 ? Array.from(tbl2.querySelectorAll('tbody tr')) : [];
    rows2.slice(0, 3).forEach((r) => console.log('  ', r.textContent.replace(/\s+/g, ' ')));
  }

  // simulate every edition finished -> tab hides itself and falls back to Live Now
  const realStatus = window.safariStatus;
  window.safariStatus = () => ({ st: 'ended', w: { s: 0, e: 0 }, days: [] });
  window.renderSafari();
  await sleep(150);
  console.log('\n=== after all editions ended ===');
  console.log('tab button hidden:', sfBtn && sfBtn.hidden);
  console.log('safari section hidden:', document.getElementById('safari').hidden);
  console.log('active tab:', document.querySelector('.tabs button.active').dataset.tab);
  window.safariStatus = realStatus;
  window.renderSafari();
  await sleep(120);
  console.log('restored -> tab hidden:', sfBtn && sfBtn.hidden, '| cards:', document.querySelectorAll('.safaricard').length);

  // ---- MOONLIGHT TAB (regional event, four 5-min bursts a day) ----
  const mnBtn = document.querySelector('.tabs button[data-tab="moon"]');
  mnBtn.click();
  await sleep(250);
  console.log('\n=== MOONLIGHT TAB ===');
  console.log('section hidden:', document.getElementById('moon').hidden);
  console.log('rows:', document.querySelectorAll('#moonList .moonrow').length);
  console.log('countdowns:', document.querySelectorAll('#moonList [data-cd]').length);
  console.log('live rows:', document.querySelectorAll('#moonList .moonrow.live').length);
  console.log('bar:', (document.querySelector('#moonList .moonbar') || {}).textContent);
  console.log('info rows:', document.querySelectorAll('#moonList .mooninfo > div').length);
  Array.from(document.querySelectorAll('#moonList .moonrow')).forEach((r) => {
    const c = Array.from(r.children).map((e) => e.textContent.trim().replace(/\s+/g, ' '));
    console.log('  ' + c.join(' | '));
  });
  // tz switch must re-flow the comparison column
  const mtz = document.getElementById('tz');
  const keepTZ = mtz.value;
  mtz.value = 'Europe/London';
  mtz.dispatchEvent(new window.Event('change', { bubbles: true }));
  await sleep(200);
  console.log('tz=Europe/London first row:', Array.from(document.querySelectorAll('#moonList .moonrow')[0].children).map((e) => e.textContent.trim().replace(/\s+/g, ' ')).join(' | '));
  mtz.value = keepTZ;
  mtz.dispatchEvent(new window.Event('change', { bubbles: true }));
  await sleep(150);
  // simulate the edition being over -> tab hides itself like City Safari
  const realMoonStatus = window.moonStatus;
  window.moonStatus = () => ({ bursts: [], live: null, next: null });
  window.renderMoonlight();
  await sleep(150);
  console.log('\n=== after every Moonlight burst ended ===');
  console.log('tab button hidden:', mnBtn && mnBtn.hidden);
  console.log('moon section hidden:', document.getElementById('moon').hidden);
  console.log('active tab:', document.querySelector('.tabs button.active').dataset.tab);
  window.moonStatus = realMoonStatus;
  window.renderMoonlight();
  await sleep(120);
  console.log('restored -> tab hidden:', mnBtn && mnBtn.hidden, '| rows:', document.querySelectorAll('#moonList .moonrow').length);
  // force the clock inside a burst window (Indonesia 20:00 WIB) -> LIVE row + live top bar
  const realNow = window.Date.now;
  const burstTs = window.wallMs('Asia/Jakarta', '2026-09-26T20:01:00');
  window.Date.now = () => burstTs;
  window.renderMoonlight();
  await sleep(140);
  console.log('\n=== during an Indonesia burst ===');
  console.log('live rows:', document.querySelectorAll('#moonList .moonrow.live').length);
  console.log('live row:', (document.querySelector('#moonList .moonrow.live') || {}).textContent);
  console.log('bar:', (document.querySelector('#moonList .moonbar') || {}).textContent);
  Date.now = realNow;
  window.renderMoonlight();
  await sleep(120);

  // click banner -> should switch to wave view
  const btn = bar && bar.querySelector('.nextbtn');
  if (btn) {
    btn.click();
    await sleep(100);
    const wave = document.getElementById('wave');
    console.log('\n=== after banner click ===');
    console.log('wave hidden:', wave.hidden);
    console.log('waveSel:', document.getElementById('waveSel').value);
    // ---- WAVE CITY ORDER (must run east → west: Kiribati … Hawaii) ----
    const wsel = document.getElementById('waveSel');
    if (wsel) {
      for (const opt of Array.from(wsel.options).slice(0, 12)) {
        wsel.value = opt.value;
        wsel.dispatchEvent(new window.Event('change', { bubbles: true }));
        await sleep(80);
        if (document.querySelectorAll('#waveList .wcity').length > 3) break;
      }
    }
    console.log('\n=== WAVE CITY ORDER (' + (wsel && wsel.value) + ') ===');
    console.log(Array.from(document.querySelectorAll('#waveList .wcity')).map((e) => e.textContent.trim().replace(/\s+/g, ' ')).join(' | '));
    process.exit(0);
  } else {
    console.log('NO BANNER BUTTON!');
    process.exit(1);
  }
}, 300);

// NOTE: assigning window.localStorage does NOT work in jsdom (native getter wins).
// To test i18n/BM, extract and eval the I18N object from app.js source directly, or use:
//   Object.defineProperty(window, 'localStorage', { value: { getItem: () => 'ms', setItem: () => {} } });
