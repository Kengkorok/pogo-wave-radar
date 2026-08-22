/* PoGo Wave Radar — core app */
/* eslint-env browser */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

let CITIES = [];
let EVENTS = [];
let FETCHED_AT = null;
const PVPTYPES = new Set(['go-battle-league']);
const TZ_STORAGE = 'pwr-tz';
const PVP_STORAGE = 'pwr-pvp';
let USER_TZ = null;

/* ---------- timezone helpers ---------- */
function tzOffsetMs(tz, date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - date.getTime();
}
function localDayIndex(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return null;
  return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
}
function timeParts(iso) {
  const m = /T(\d{2}):(\d{2})/.exec(iso || '');
  return m ? [+m[1], +m[2]] : null;
}
function getUserTZ() {
  if (USER_TZ) return USER_TZ;
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kuala_Lumpur';
}
function fmtTime(ms, tz, opts) {
  const base = (opts && (opts.dateStyle || opts.timeStyle))
    ? opts
    : Object.assign({ hour: 'numeric', minute: '2-digit', timeZone: tz }, opts || {});
  return new Intl.DateTimeFormat('en-MY', base).format(new Date(ms));
}
function fmtDur(ms) {
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}
function timeAgo(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '—' : new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

/* ---------- wave computation ---------- */
function statusFor(ev, city, date) {
  const d = (date || new Date()).getTime();
  if (!ev.local_time) {
    const s = new Date(ev.start).getTime();
    if (!ev.end) return { st: d >= s ? 'live' : 'upcoming', s, e: Infinity };
    const e = new Date(ev.end).getTime();
    return { st: d < s ? 'upcoming' : d < e ? 'live' : 'ended', s, e };
  }
  const tp = timeParts(ev.start);
  if (!tp) return { st: 'live', s: 0, e: Infinity };
  const sh = tp[0] * 60 + tp[1];
  const te = timeParts(ev.end);
  const eh = te ? te[0] * 60 + te[1] : sh;
  const off = tzOffsetMs(city.tz, new Date(d));
  const localMs = d + off;
  const dayIdx = Math.floor(localMs / 86400000);
  const winStart = (day) => day * 86400000 - off + sh * 60000;
  const winEnd = (day) => day * 86400000 - off + eh * 60000;
  const s = winStart(dayIdx);
  const e = winEnd(dayIdx);
  const sDay = localDayIndex(ev.start);
  const eDay = localDayIndex(ev.end);
  if (sDay != null && eDay != null) {
    if (dayIdx < sDay) return { st: 'upcoming', s: winStart(sDay), e: winEnd(eDay) };
    if (dayIdx > eDay) return { st: 'ended', s: winStart(eDay), e: winEnd(eDay) };
    if (sh === eh) return { st: 'live', s: winStart(sDay), e: winEnd(eDay) }; // all-day window (season etc)
    if (d < s) return { st: 'upcoming', s, e };
    return { st: d < e ? 'live' : 'ended', s, e };
  }
  if (sh === eh) return { st: 'live', s, e };
  if (d < s) return { st: 'upcoming', s, e };
  return { st: d < e ? 'live' : 'ended', s, e };
}
function cityStates(ev) {
  const now = new Date();
  return CITIES.map((c) => ({ city: c, ...statusFor(ev, c, now) }));
}
function isPvP(ev) { return PVPTYPES.has(ev.type); }

/* ---------- render: live now ---------- */
function renderLive() {
  const box = $('#live');
  const now = new Date();
  const rows = EVENTS
    .filter((ev) => (APP_CONFIG.show_pvp_default || $('#pvp').checked) || !isPvP(ev))
    .map((ev) => {
      const states = cityStates(ev).map((s) => ({ city: s.city, st: s.st, s: s.s, e: s.e }));
      const live = states.filter((s) => s.st === 'live');
      const upcoming = states.filter((s) => s.st === 'upcoming');
      const my = states.find((s) => s.city.tz === getUserTZ()) || { st: 'none' };
      return { ev, states, live, upcoming, my };
    })
    .filter((r) => r.live.length > 0 || r.upcoming.length > 0)
    .sort((a, b) => {
      const aEnd = a.live.length ? Math.min(...a.live.map((s) => s.e)) : a.upcoming[0].s;
      const bEnd = b.live.length ? Math.min(...b.live.map((s) => s.e)) : b.upcoming[0].s;
      return aEnd - bEnd;
    });

  if (!rows.length) {
    box.innerHTML = '<div class="empty">Tiada event sekarang. Cuba aktifkan PvP atau tunggu event seterusnya. 🌊</div>';
    return;
  }
  box.innerHTML = rows.map((r) => {
    const isLive = r.live.length > 0;
    const tag = r.ev.type.replace(/-/g, ' ');
    const myBadge = r.my.st === 'ended' ? ' <span class="badge ended">Dah habis kat tempat kau</span>'
      : r.my.st === 'upcoming' ? ' <span class="badge soon">Belum start kat tempat kau</span>'
      : isLive ? ' <span class="badge live">LIVE</span>' : '';
    const liveChips = isLive
      ? '<div class="chips">' + r.live.map((s) => chip(s, r.ev)).join('') + '</div>'
      : '<div class="nextline">Mula dalam <b>' + fmtDur(r.upcoming[0].s - now.getTime()) + '</b> · ' +
        fmtTime(r.upcoming[0].s, r.upcoming[0].city.tz) + ' waktu ' + r.upcoming[0].city.name + '</div>';
    const cta = isLive
      ? '<button class="btn" data-wave="' + r.ev.slug + '">🌊 Lihat wave penuh</button>'
      : '<button class="btn ghost" data-wave="' + r.ev.slug + '">Lihat wave</button>';
    return '<article class="card' + (isLive ? ' live' : '') + '" id="ev-' + r.ev.slug + '">'
      + (r.ev.img ? '<img class="thumb" loading="lazy" src="' + r.ev.img + '" alt="">' : '')
      + '<div class="body">'
      + '<div class="row1"><span class="tag">' + esc(tag) + '</span>' + myBadge + '</div>'
      + '<h3>' + esc(r.ev.name) + '</h3>'
      + (isLive
          ? '<div class="cd">Tamat dalam <b data-cd="' + Math.min(...r.live.map((s) => s.e)) + '">…</b> · <b>' + r.live.length + '</b> bandar live</div>'
          : '<div class="cd">Bermula <b data-cd="' + r.upcoming[0].s + '">…</b></div>')
      + liveChips
      + cta
      + '</div></article>';
  }).join('');
  bindWaveButtons();
  bindChips();
  startTicker();
}

function chip(s, ev) {
  const c = s.city;
  const coords = c.lat.toFixed(4) + ', ' + c.lng.toFixed(4);
  const until = s.e === Infinity ? '' : ' · tamat ' + fmtTime(s.e, c.tz);
  return '<button class="chip" data-coords="' + coords + '" data-name="' + esc(c.name) + '">'
    + '<span class="dot"></span>' + c.flag + ' ' + esc(c.name) + until + '</button>';
}

/* ---------- render: wave tracker ---------- */
function renderWaveSelect() {
  const sel = $('#waveSel');
  const opts = EVENTS
    .filter((ev) => (APP_CONFIG.show_pvp_default || $('#pvp').checked) || !isPvP(ev))
    .map((ev) => '<option value="' + ev.slug + '">' + esc(ev.name) + '</option>')
    .join('');
  sel.innerHTML = opts;
}
function renderWave() {
  const sel = $('#waveSel');
  const ev = EVENTS.find((e) => e.slug === sel.value);
  if (!ev) { $('#waveList').innerHTML = ''; return; }
  const now = new Date();
  const states = cityStates(ev)
    .map((s) => ({ ...s, coords: s.city.lat.toFixed(4) + ', ' + s.city.lng.toFixed(4) }))
    .sort((a, b) => {
      const order = { live: 0, upcoming: 1, ended: 2 };
      if (order[a.st] !== order[b.st]) return order[a.st] - order[b.st];
      if (a.st === 'live') return b.e - a.e; // paling lama tinggal dulu
      if (a.st === 'upcoming') return a.s - b.s;
      return 0;
    });
  const suggestion = states.find((s) => s.st === 'live');
  const myTZ = getUserTZ();
  $('#waveList').innerHTML = '<div class="wavehead">'
    + '<span class="tag">' + esc(ev.type.replace(/-/g, ' ')) + '</span>'
    + '<h3>' + esc(ev.name) + '</h3>'
    + (ev.local_time ? '<p class="note">🕐 Event ikut waktu <b>tempatan</b> — ombak bergerak dari timur ke barat. Pilih bandar, salin koordinat, spoof!</p>'
        : '<p class="note">🕐 Event global — serentak seluruh dunia (waktu UTC).</p>')
    + '</div>'
    + '<div class="wavetable">' + states.map((s) => {
      const icon = s.st === 'live' ? '🟢' : s.st === 'upcoming' ? '🟡' : '⚫';
      const lbl = s.st === 'live' ? 'LIVE' : s.st === 'upcoming' ? 'MULA ' + fmtTime(s.s, s.city.tz) : 'HABIS ' + fmtTime(s.e, s.city.tz);
      const isMy = s.city.tz === myTZ ? ' <span class="badge mine">tempat kau</span>' : '';
      const suggest = suggestion && s.city.tz === suggestion.city.tz ? ' ⭐' : '';
      return '<div class="wrow st-' + s.st + '">'
        + '<div class="wcity">' + icon + ' ' + s.city.flag + ' <b>' + esc(s.city.name) + '</b>' + isMy + suggest + '</div>'
        + '<div class="wtime">' + (ev.local_time && s.st !== 'ended' ? fmtTime(s.s, s.city.tz) + ' – ' + fmtTime(s.e, s.city.tz) + ' waktu tempatan' : lbl) + '</div>'
        + '<div class="wact"><button class="chip" data-coords="' + s.coords + '" data-name="' + esc(s.city.name) + '">📋 ' + s.coords + '</button></div>'
        + '</div>';
    }).join('') + '</div>'
    + (suggestion ? '<div class="hint">⭐ Cadangan: <b>' + suggestion.city.name + '</b> — masih live, tamat ' + fmtTime(suggestion.e, suggestion.city.tz) + ' waktu tempatan.</div>' : '');
  bindChips();
}

/* ---------- render: all events ---------- */
function renderAll() {
  const box = $('#all');
  const now = new Date();
  const rows = EVENTS
    .filter((ev) => (APP_CONFIG.show_pvp_default || $('#pvp').checked) || !isPvP(ev))
    .map((ev) => {
      const states = cityStates(ev);
      const live = states.filter((s) => s.st === 'live').length;
      const up = states.filter((s) => s.st === 'upcoming').length;
      const group = live > 0 ? 'live' : up > 0 ? 'up' : 'end';
      return { ev, group, live, up };
    })
    .sort((a, b) => (a.ev.start || '').localeCompare(b.ev.start || ''));
  const groups = [
    ['live', '🔥 LIVE sekarang'],
    ['up', '🟡 Akan datang'],
    ['end', '⚫ Dah tamat'],
  ];
  box.innerHTML = groups.map(([g, title]) => {
    const items = rows.filter((r) => r.group === g);
    if (!items.length) return '';
    return '<h2 class="group-title">' + title + ' <span class="cnt">' + items.length + '</span></h2>'
      + '<div class="alllist">' + items.map((r) => {
        const badge = r.group === 'live' ? '<span class="badge live">' + r.live + ' bandar live</span>'
          : r.group === 'up' ? '<span class="badge soon">mula ' + fmtTime(new Date(r.ev.start).getTime(), getUserTZ()) + '</span>' : '';
        return '<div class="allrow" data-wave="' + r.ev.slug + '">'
          + '<div><span class="tag">' + esc(r.ev.type.replace(/-/g, ' ')) + '</span> <b>' + esc(r.ev.name) + '</b></div>'
          + '<div class="sub">' + (r.ev.local_time ? 'waktu tempatan' : 'UTC') + ' · ' + esc(r.ev.start || '?') + ' → ' + esc(r.ev.end || '?') + ' ' + badge + '</div>'
          + '</div>';
      }).join('') + '</div>';
  }).join('');
  $$('#all [data-wave]').forEach((el) => el.addEventListener('click', () => { goWave(el.dataset.wave); }));
}

/* ---------- interactions ---------- */
function bindWaveButtons() {
  $$('[data-wave]').forEach((el) => el.addEventListener('click', () => goWave(el.dataset.wave)));
}
function goWave(slug) {
  $('#waveSel').value = slug;
  switchTab('wave');
  renderWave();
}
function bindChips() {
  $$('.chip[data-coords]').forEach((el) => el.addEventListener('click', async () => {
    const txt = el.dataset.coords;
    try { await navigator.clipboard.writeText(txt); toast('📋 ' + el.dataset.name + ': ' + txt + ' — paste kat GPS Joystick'); }
    catch (e) { toast('📋 ' + el.dataset.name + ': ' + txt); }
  }));
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2600);
}
function switchTab(name) {
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $('#live').hidden = name !== 'live';
  $('#wave').hidden = name !== 'wave';
  $('#all').hidden = name !== 'all';
}
function startTicker() {
  if (startTicker._on) return;
  startTicker._on = true;
  setInterval(() => {
    $$('[data-cd]').forEach((el) => {
      const t = +el.dataset.cd - Date.now();
      el.textContent = t > 0 ? fmtDur(t) : 'tamat';
    });
  }, 1000);
}
function renderTZ() {
  const sel = $('#tz');
  const tzs = [...new Set(CITIES.map((c) => c.tz))];
  if (!tzs.includes(getUserTZ())) tzs.unshift(getUserTZ());
  sel.innerHTML = tzs.map((tz) => '<option value="' + tz + '">' + tz + '</option>').join('');
  sel.value = getUserTZ();
  $('#tzclock').textContent = '🕐 ' + fmtTime(Date.now(), getUserTZ(), { dateStyle: 'medium' });
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- init ---------- */
async function init() {
  USER_TZ = localStorage.getItem(TZ_STORAGE) || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kuala_Lumpur';
  $('#pvp').checked = localStorage.getItem(PVP_STORAGE) === '1';
  try {
    const [c, e] = await Promise.all([fetch('cities.json').then((r) => r.json()), fetch('events.json').then((r) => r.json())]);
    CITIES = c; EVENTS = e.events || []; FETCHED_AT = e.fetched_at;
  } catch (err) {
    $('#live').innerHTML = '<div class="empty">Tak dapat load data. Cuba refresh — kalau still rosak, tunggu GitHub Actions update.</div>';
    return;
  }
  $('#fetched').textContent = FETCHED_AT ? timeAgo(FETCHED_AT) : '—';
  renderTZ();
  $('#tz').addEventListener('change', (ev) => { USER_TZ = ev.target.value; localStorage.setItem(TZ_STORAGE, USER_TZ); renderTZ(); renderLive(); renderAll(); });
  $('#pvp').addEventListener('change', () => { localStorage.setItem(PVP_STORAGE, $('#pvp').checked ? '1' : '0'); renderLive(); renderWaveSelect(); renderWave(); renderAll(); });
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $('#waveSel').addEventListener('change', renderWave);
  renderLive();
  renderWaveSelect();
  const w = new URLSearchParams(location.search).get('wave');
  if (w && EVENTS.some((e) => e.slug === w)) { $('#waveSel').value = w; switchTab('wave'); }
  renderWave();
  renderAll();
  renderDonate();
}
function renderDonate() {
  const d = APP_CONFIG.donate || {};
  const btns = [];
  if (d.kofi) btns.push('<a class="donate-btn" href="' + d.kofi + '" target="_blank" rel="noopener">☕ Buy me a coffee</a>');
  if (d.buymeacoffee) btns.push('<a class="donate-btn" href="' + d.buymeacoffee + '" target="_blank" rel="noopener">🧋 Support</a>');
  if (d.paypal) btns.push('<a class="donate-btn" href="' + d.paypal + '" target="_blank" rel="noopener">💛 PayPal</a>');
  if (d.duitnow_qr) btns.push('<button class="donate-btn" id="qrbtn">🇲🇾 TNG / DuitNow</button>');
  $('#donate').innerHTML = btns.join(' ');
  const qr = $('#qrbtn');
  if (qr) qr.addEventListener('click', () => {
    toast('🇲🇾 DuitNow: ' + (APP_CONFIG.donate.duitnow_qr_name || 'sila set config'));
    window.open(APP_CONFIG.donate.duitnow_qr, '_blank');
  });
}
document.addEventListener('DOMContentLoaded', init);
