/* jsdom test harness for pogo-wave-radar (and similar static GitHub Pages apps).
   Loads the real index.html + config.js + app.js, stubs fetch to read docs/ from disk,
   dispatches DOMContentLoaded, then lets you assert on the rendered DOM.

   Run from repo root:
     npm install jsdom --no-save
     node scripts/test-harness.js
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

setTimeout(() => {
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
  setTimeout(() => {
    const nests = document.getElementById('nests');
    const list = document.getElementById('nestList');
    const mig = document.getElementById('nestMigrate');
    console.log('\n=== NESTS TAB ===');
    console.log('nests section hidden:', nests && nests.hidden);
    console.log('migration banner hidden:', mig && mig.hidden);
    console.log('migration banner:', mig && mig.innerHTML);
    console.log('nest cards:', document.querySelectorAll('#nestList .nestcard').length);
    console.log('combee cards:', Array.from(document.querySelectorAll('#nestList .nestcard')).filter((c) => c.textContent.includes('Combee')).length);
    console.log('stardust badges:', document.querySelectorAll('#nestList .badge.sd').length);
    console.log('coords chips:', document.querySelectorAll('#nestList .chip[data-coords]').length);
    console.log('first card:', document.querySelector('#nestList .nestcard') && document.querySelector('#nestList .nestcard').innerHTML.slice(0, 220));
    console.log('nest cd text:', mig && mig.querySelector('[data-cd]') && mig.querySelector('[data-cd]').textContent);

    // click banner -> should switch to wave view
    const btn = bar && bar.querySelector('.nextbtn');
    if (btn) {
      btn.click();
      setTimeout(() => {
        const wave = document.getElementById('wave');
        console.log('\n=== after banner click ===');
        console.log('wave hidden:', wave.hidden);
        console.log('waveSel:', document.getElementById('waveSel').value);
        process.exit(0);
      }, 100);
    } else {
      console.log('NO BANNER BUTTON!');
      process.exit(1);
    }
  }, 200);
}, 300);

// NOTE: assigning window.localStorage does NOT work in jsdom (native getter wins).
// To test i18n/BM, extract the I18N object from app.js source and eval it directly,
// or drive the language via the real localStorage value using Object.defineProperty:
//   Object.defineProperty(window, 'localStorage', { value: { getItem: () => 'ms', setItem: () => {} } });
