/* PoGo Wave Radar — core app (i18n EN/BM) */
/* eslint-env browser */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

let CITIES = [];
let EVENTS = [];
let FETCHED_AT = null;
const PVPTYPES = new Set(['go-battle-league']);
const TZ_STORAGE = 'pwr-tz';
const PVP_STORAGE = 'pwr-pvp';
const LANG_STORAGE = 'pwr-lang';
let USER_TZ = null;
let LANG = 'en';

/* ---------- i18n ---------- */
const I18N = {
  en: {
    title: 'PoGo Wave Radar',
    tagline: 'Never miss a Pokémon GO event again — chase the wave across time zones',
    tzLabel: 'Your timezone',
    pvpLabel: 'Show PvP / GBL (hidden by default)',
    tabLive: '🔥 Live Now', tabWave: '🌊 Wave Tracker', tabAll: '📅 All Events',
    sectionLive: '🔥 Live Now', sectionUpcoming: '🟡 Upcoming Events',
    tools: '🧰 Tools', iosNote: 'supports iOS',
    loading: 'Loading…', pickEvent: 'Pick an event:',
    footerData: 'Event data from <a href="https://leekduck.com/events/" target="_blank" rel="noopener">leekduck.com</a> · updated <span id="fetched">—</span>',
    disclaimer: 'For spoofers: use the coords in GPS Joystick at your own risk. Respect cooldown &amp; fair play.',
    noEvents: 'No events right now. Try enabling PvP or wait for the next event. 🌊',
    loadError: 'Could not load data. Refresh — if it persists, GitHub Actions will update soon.',
    endedArea: 'Ended in your area', notStartedArea: 'Not started in your area',
    endsIn: 'Ends in', startsIn: 'Starts in', citiesLive: 'cities live',
    startsSoon: 'Starts in', in_: 'in', // "Starts in 2h · 6:00 pm in Tokyo"
    viewFullWave: '🌊 View full wave', viewWave: 'View wave',
    local: 'local', yourTime: 'your time',
    startsLbl: 'STARTS', endsLbl: 'ENDS', liveLbl: 'LIVE', yourArea: 'your area',
    localNote: '🕐 Local-time event — the wave moves east to west. Pick a city, copy coords, spoof!',
    globalNote: '🕐 Global event — simultaneous worldwide (UTC).',
    suggestion: '⭐ Suggestion:', stillLive: 'still live, ends',
    grpLive: '🔥 Live now', grpUp: '🟡 Upcoming', grpEnd: '⚫ Ended',
    startsShort: 'starts',
    copyToast: 'paste into GPS Joystick',
    buyCoffee: '☕ Buy me a coffee', scanDonate: '🇲🇾 Scan to donate (MY)',
    qrTitle: 'Scan with TNG eWallet or any DuitNow app. Thank you! 🙏',
    qrName: 'Maybank DuitNow QR',
  },
  ms: {
    title: 'Radar Ombak PoGo',
    tagline: 'Jangan terlepas event Pokémon GO lagi — chase ombak ikut zon waktu',
    tzLabel: 'Zon kau',
    pvpLabel: 'Tunjuk PvP / GBL (disorok secara default)',
    tabLive: '🔥 Live Sekarang', tabWave: '🌊 Wave Tracker', tabAll: '📅 Semua Event',
    sectionLive: '🔥 Live Sekarang', sectionUpcoming: '🟡 Event Akan Datang',
    tools: '🧰 Tools', iosNote: 'sokong iOS',
    loading: 'Memuatkan…', pickEvent: 'Pilih event:',
    footerData: 'Data event dari <a href="https://leekduck.com/events/" target="_blank" rel="noopener">leekduck.com</a> · dikemas kini <span id="fetched">—</span>',
    disclaimer: 'Buat spoofer: guna koordinat kat GPS Joystick ikut risiko sendiri. Hormati cooldown &amp; fair play.',
    noEvents: 'Tiada event sekarang. Cuba aktifkan PvP atau tunggu event seterusnya. 🌊',
    loadError: 'Tak dapat load data. Cuba refresh — kalau masih rosak, GitHub Actions akan update.',
    endedArea: 'Dah habis kat tempat kau', notStartedArea: 'Belum start kat tempat kau',
    endsIn: 'Tamat dalam', startsIn: 'Bermula dalam', citiesLive: 'bandar live',
    startsSoon: 'Mula dalam', in_: 'waktu',
    viewFullWave: '🌊 Lihat wave penuh', viewWave: 'Lihat wave',
    local: 'tempatan', yourTime: 'waktu kau',
    startsLbl: 'MULA', endsLbl: 'HABIS', liveLbl: 'LIVE', yourArea: 'tempat kau',
    localNote: '🕐 Event ikut waktu tempatan — ombak bergerak dari timur ke barat. Pilih bandar, salin koordinat, spoof!',
    globalNote: '🕐 Event global — serentak seluruh dunia (UTC).',
    suggestion: '⭐ Cadangan:', stillLive: 'masih live, tamat',
    grpLive: '🔥 Live sekarang', grpUp: '🟡 Akan datang', grpEnd: '⚫ Dah tamat',
    startsShort: 'mula',
    copyToast: 'paste kat GPS Joystick',
    buyCoffee: '☕ Belanja aku kopi', scanDonate: '🇲🇾 Scan untuk derma (MY)',
    qrTitle: 'Scan dengan TNG eWallet atau mana-mana app DuitNow. Terima kasih! 🙏',
    qrName: 'Maybank DuitNow QR',
  },
};
function t(key) {
  return (I18N[LANG] && I18N[LANG][key]) || I18N.en[key] || key;
}
/* Event summary in current language; fallback to English when BM missing */
function sum(ev) {
  if (!ev) return null;
  return LANG === 'ms' ? (ev.summary_ms || ev.summary) : ev.summary;
}

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
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
/* Format a window [s,e] in a given timezone; adds the date when it isn't today there */
function fmtWin(s, e, tz) {
  const off = tzOffsetMs(tz, new Date(s));
  const di = (ms) => Math.floor((ms + off) / 86400000);
  const now = Date.now();
  const tm = (ms) => fmtTime(ms, tz);
  const dshort = (ms) => new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', timeZone: tz }).format(new Date(ms));
  if (di(s) === di(e)) {
    if (di(s) === Math.floor((now + tzOffsetMs(tz, new Date(now))) / 86400000)) return tm(s) + ' – ' + tm(e);
    return dshort(s) + ' · ' + tm(s) + ' – ' + tm(e);
  }
  return dshort(s) + ' ' + tm(s) + ' – ' + dshort(e) + ' ' + tm(e);
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
function cardHtml(r) {
  const isLive = r.live.length > 0;
  const tag = r.ev.type.replace(/-/g, ' ');
  const myBadge = r.my.st === 'ended' ? ' <span class="badge ended">' + t('endedArea') + '</span>'
    : r.my.st === 'upcoming' ? ' <span class="badge soon">' + t('notStartedArea') + '</span>'
    : isLive ? ' <span class="badge live">' + t('liveLbl') + '</span>' : '';
  const chips = isLive
    ? '<div class="chips">' + r.live.map((s) => chip(s, r.ev)).join('') + '</div>'
    : '';
  const cta = isLive
    ? '<button class="btn" data-wave="' + r.ev.slug + '">' + t('viewFullWave') + '</button>'
    : '<button class="btn ghost" data-wave="' + r.ev.slug + '">' + t('viewWave') + '</button>';
  return '<article class="card' + (isLive ? ' live' : '') + '" id="ev-' + r.ev.slug + '">'
    + (r.ev.img ? '<img class="thumb" loading="lazy" src="' + r.ev.img + '" alt="">' : '')
    + '<div class="body">'
    + '<div class="row1"><span class="tag">' + esc(tag) + '</span>' + myBadge + '</div>'
    + '<h3>' + esc(r.ev.name) + '</h3>'
    + (sum(r.ev) ? '<div class="evsum">ℹ️ ' + esc(sum(r.ev)) + '</div>' : '')
    + (isLive
        ? '<div class="cd">' + t('endsIn') + ' <b data-cd="' + Math.min(...r.live.map((s) => s.e)) + '">…</b> · <b>' + r.live.length + '</b> ' + t('citiesLive') + '</div>'
        : '<div class="cd">' + t('startsIn') + ' <b data-cd="' + r.upcoming[0].s + '">…</b> · ' + fmtWin(r.upcoming[0].s, r.upcoming[0].e, getUserTZ()) + ' ' + t('yourTime') + '</div>')
    + chips
    + cta
    + '</div></article>';
}
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

  const liveRows = rows.filter((r) => r.live.length > 0);
  const upRows = rows.filter((r) => r.live.length === 0);

  if (!liveRows.length && !upRows.length) {
    box.innerHTML = '<div class="empty">' + t('noEvents') + '</div>';
    return;
  }
  let html = '';
  if (liveRows.length) {
    html += '<h2 class="group-title">' + t('sectionLive') + ' <span class="cnt">' + liveRows.length + '</span></h2>'
      + liveRows.map(cardHtml).join('');
  }
  if (upRows.length) {
    html += '<h2 class="group-title">' + t('sectionUpcoming') + ' <span class="cnt">' + upRows.length + '</span></h2>'
      + upRows.map(cardHtml).join('');
  }
  box.innerHTML = html;
  bindWaveButtons();
  bindChips();
  startTicker();
}

function chip(s, ev) {
  const c = s.city;
  const coords = c.lat.toFixed(4) + ', ' + c.lng.toFixed(4);
  const until = s.e === Infinity ? '' : ' · ' + t('endsLbl').toLowerCase() + ' ' + fmtTime(s.e, getUserTZ()) + ' ' + t('yourTime');
  return '<button class="chip" data-coords="' + coords + '" data-name="' + esc(c.name) + '">'
    + '<span class="dot"></span>' + flagHtml(c) + ' ' + esc(c.name) + until + '</button>';
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
      if (a.st === 'live') return b.e - a.e; // most time left first
      if (a.st === 'upcoming') return a.s - b.s;
      return 0;
    });
  const suggestion = states.find((s) => s.st === 'live');
  const myTZ = getUserTZ();
  $('#waveList').innerHTML = '<div class="wavehead">'
    + '<span class="tag">' + esc(ev.type.replace(/-/g, ' ')) + '</span>'
    + '<h3>' + esc(ev.name) + '</h3>'
    + (sum(ev) ? '<p class="evsum-full">ℹ️ ' + esc(sum(ev)) + '</p>' : '')
    + (ev.local_time ? '<p class="note">' + t('localNote') + '</p>' : '<p class="note">' + t('globalNote') + '</p>')
    + '</div>'
    + '<div class="wavetable">' + states.map((s) => {
      const icon = s.st === 'live' ? '🟢' : s.st === 'upcoming' ? '🟡' : '⚫';
      const lbl = s.st === 'live' ? t('liveLbl') : s.st === 'upcoming' ? t('startsLbl') + ' ' + fmtTime(s.s, s.city.tz) : t('endsLbl') + ' ' + fmtTime(s.e, s.city.tz);
      const isMy = s.city.tz === myTZ ? ' <span class="badge mine">' + t('yourArea') + '</span>' : '';
      const suggest = suggestion && s.city.tz === suggestion.city.tz ? ' ⭐' : '';
      return '<div class="wrow st-' + s.st + '">'
        + '<div class="wcity">' + icon + ' ' + flagHtml(s.city) + ' <b>' + esc(s.city.name) + '</b>' + isMy + suggest + '</div>'
        + '<div class="wtime">' + (ev.local_time
            ? '<span class="locwin">' + fmtWin(s.s, s.e, s.city.tz) + ' ' + t('local') + '</span><br><b class="yourwin">' + fmtWin(s.s, s.e, myTZ) + ' ' + t('yourTime') + '</b>'
            : lbl) + '</div>'
        + '<div class="wact"><button class="chip" data-coords="' + s.coords + '" data-name="' + esc(s.city.name) + '">📋 ' + s.coords + '</button></div>'
        + '</div>';
    }).join('') + '</div>'
    + (suggestion ? '<div class="hint">' + t('suggestion') + ' <b>' + suggestion.city.name + '</b> — ' + t('stillLive') + ' ' + fmtTime(suggestion.e, suggestion.city.tz) + ' ' + t('local') + '.</div>' : '');
  bindChips();
}

/* ---------- render: all events ---------- */
function renderAll() {
  const box = $('#all');
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
    ['live', t('grpLive')],
    ['up', t('grpUp')],
    ['end', t('grpEnd')],
  ];
  box.innerHTML = groups.map(([g, title]) => {
    const items = rows.filter((r) => r.group === g);
    if (!items.length) return '';
    return '<h2 class="group-title">' + title + ' <span class="cnt">' + items.length + '</span></h2>'
      + '<div class="alllist">' + items.map((r) => {
        const badge = r.group === 'live' ? '<span class="badge live">' + r.live + ' ' + t('citiesLive') + '</span>'
          : r.group === 'up' ? '<span class="badge soon">' + t('startsShort') + ' ' + fmtTime(new Date(r.ev.start).getTime(), getUserTZ()) + '</span>' : '';
        return '<div class="allrow" data-wave="' + r.ev.slug + '">'
          + '<div><span class="tag">' + esc(r.ev.type.replace(/-/g, ' ')) + '</span> <b>' + esc(r.ev.name) + '</b></div>'
          + '<div class="sub">' + (r.ev.local_time ? t('local') : 'UTC') + ' · ' + esc(r.ev.start || '?') + ' → ' + esc(r.ev.end || '?') + ' ' + badge + '</div>'
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
    try { await navigator.clipboard.writeText(txt); toast('📋 ' + el.dataset.name + ': ' + txt + ' — ' + t('copyToast')); }
    catch (e) { toast('📋 ' + el.dataset.name + ': ' + txt); }
  }));
}
function toast(msg) {
  const tEl = $('#toast');
  tEl.textContent = msg;
  tEl.classList.add('show');
  clearTimeout(tEl._h);
  tEl._h = setTimeout(() => tEl.classList.remove('show'), 2600);
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
      const v = +el.dataset.cd - Date.now();
      el.textContent = v > 0 ? fmtDur(v) : '0m';
    });
  }, 1000);
}
function renderTZ() {
  const sel = $('#tz');
  const tzs = [...new Set(CITIES.map((c) => c.tz))];
  if (!tzs.includes(getUserTZ())) tzs.unshift(getUserTZ());
  sel.innerHTML = tzs.map((tz) => '<option value="' + tz + '">' + tz + '</option>').join('');
  sel.value = getUserTZ();
  const clk = $('#tzclock');
  if (clk) clk.textContent = '🕐 ' + fmtTime(Date.now(), getUserTZ(), { dateStyle: 'medium' });
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function flagHtml(c) {
  return c.flag && c.flag.indexOf('.svg') > -1 ? '<img class="flag" src="' + c.flag + '" alt="">' : (c.flag || '');
}

/* ---------- donate ---------- */
function renderDonate() {
  const d = APP_CONFIG.donate || {};
  const btns = [];
  if (d.kofi) btns.push('<a class="donate-btn kofi" href="' + d.kofi + '" target="_blank" rel="noopener">' + t('buyCoffee') + '</a>');
  if (d.buymeacoffee) btns.push('<a class="donate-btn" href="' + d.buymeacoffee + '" target="_blank" rel="noopener">🧋 Support</a>');
  if (d.paypal) btns.push('<a class="donate-btn" href="' + d.paypal + '" target="_blank" rel="noopener">💛 PayPal</a>');
  if (d.duitnow_qr) btns.push('<button class="donate-btn qr" id="qrbtn" type="button">' + t('scanDonate') + '</button>');
  const el = $('#donateTop');
  if (el) el.innerHTML = btns.join(' ');
}
function showQR() {
  const d = APP_CONFIG.donate || {};
  const old = document.getElementById('qroverlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.className = 'qroverlay';
  overlay.id = 'qroverlay';
  overlay.innerHTML = '<div class="qrbox">'
    + '<button class="qrclose" aria-label="Close" type="button">✕</button>'
    + '<h3>🇲🇾 ' + esc(d.duitnow_qr_name || t('qrName')) + '</h3>'
    + '<img src="' + d.duitnow_qr + '" alt="DuitNow QR">'
    + '<p>' + t('qrTitle') + '</p>'
    + '</div>';
  document.body.appendChild(overlay);
}

/* ---------- language ---------- */
function renderLang() {
  document.documentElement.lang = LANG;
  document.title = t('title');
  $$('[data-i18n]').forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
  const btn = $('#langbtn');
  if (btn) btn.textContent = LANG === 'en' ? '🌐 BM' : '🌐 EN';
  const f = $('#fetched');
  if (f) f.textContent = FETCHED_AT ? timeAgo(FETCHED_AT) : '—';
  renderTZ();
  renderLive();
  renderWaveSelect();
  renderWave();
  renderAll();
  renderDonate();
}

/* ---------- init ---------- */
async function init() {
  LANG = localStorage.getItem(LANG_STORAGE) === 'ms' ? 'ms' : 'en';
  USER_TZ = localStorage.getItem(TZ_STORAGE) || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kuala_Lumpur';
  $('#pvp').checked = localStorage.getItem(PVP_STORAGE) === '1';
  try {
    const [c, e] = await Promise.all([fetch('cities.json').then((r) => r.json()), fetch('events.json').then((r) => r.json())]);
    CITIES = c; EVENTS = e.events || []; FETCHED_AT = e.fetched_at;
  } catch (err) {
    $('#live').innerHTML = '<div class="empty">' + t('loadError') + '</div>';
    return;
  }
  $('#langbtn').addEventListener('click', () => {
    LANG = LANG === 'en' ? 'ms' : 'en';
    localStorage.setItem(LANG_STORAGE, LANG);
    renderLang();
  });
  const toolsNav = $('#toolsnav');
  const toolsBtn = $('#toolsbtn');
  if (toolsBtn && toolsNav) {
    toolsBtn.addEventListener('click', (e) => { e.stopPropagation(); toolsNav.classList.toggle('open'); });
    document.addEventListener('click', (e) => { if (!toolsNav.contains(e.target)) toolsNav.classList.remove('open'); });
  }
  $('#tz').addEventListener('change', (ev) => { USER_TZ = ev.target.value; localStorage.setItem(TZ_STORAGE, USER_TZ); renderTZ(); renderLive(); renderAll(); });
  $('#pvp').addEventListener('change', () => { localStorage.setItem(PVP_STORAGE, $('#pvp').checked ? '1' : '0'); renderLive(); renderWaveSelect(); renderWave(); renderAll(); });
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $('#waveSel').addEventListener('change', renderWave);
  renderLang();
  const w = new URLSearchParams(location.search).get('wave');
  if (w && EVENTS.some((e) => e.slug === w)) { $('#waveSel').value = w; switchTab('wave'); renderWave(); }
  document.addEventListener('click', (e) => {
    const tEl = e.target;
    if (tEl && tEl.id === 'qrbtn') { showQR(); return; }
    if (tEl && (tEl.classList && tEl.classList.contains('qrclose'))) {
      const ov = document.getElementById('qroverlay');
      if (ov) ov.remove();
      return;
    }
    if (tEl && tEl.id === 'qroverlay') tEl.remove();
  });
}
document.addEventListener('DOMContentLoaded', init);
