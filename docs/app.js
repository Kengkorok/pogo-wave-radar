/* PoGo Wave Radar — core app (i18n EN/BM) */
/* eslint-env browser */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

let CITIES = [];
let EVENTS = [];
let DETAILS = {};      // lazy-loaded from details.json (full LeekDuck detail HTML)
let DETAILS_LOADED = false;
let FETCHED_AT = null;
const PVPTYPES = new Set(['go-battle-league']);
const TZ_STORAGE = 'pwr-tz';
const PVP_STORAGE = 'pwr-pvp';
const LANG_STORAGE = 'pwr-lang';
let USER_TZ = null;
let LANG = 'en';
let NESTS = [];           // nest feed from nests.json
let NESTS_META = null;    // { fetched_at, migration }
let SAFARI = [];          // City Safari in-person events from citysafari.json
let MOON = null;          // Dancing in the Moonlight edition from moonlight.json
let NEST_FILTER = 'star'; // 'star' (default, Combee & friends) | 'all'
let NEST_QUERY = '';
let EVENT_QUERY = '';     // All Events search
/* Base stardust per catch for boosted species (dex -> SD).
   Combee 415 = 500 (5x), Audino 531 = 2100 (21x), Chimecho 358 = 500.
   Tune as Niantic changes things. */
const STARDUST = { 46: 150, 52: 250, 90: 150, 120: 150, 191: 150, 241: 150, 285: 150, 302: 150, 358: 500, 415: 500, 506: 150, 531: 2100, 590: 150 };
function nestSprite(dex) {
  return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + dex + '.png';
}

/* ---------- i18n ---------- */
const I18N = {
  en: {
    aboutTitle: "About PoGo Wave Radar",
    aboutIntro: "PoGo Wave Radar is a free Pokémon GO event tracker. Check live and upcoming events, compare city time zones and follow local-time events as they move around the world.",
    aboutFeatures: 'Use Live Now for active events, Wave Tracker for city-by-city start and end times, and All Events for the schedule. You can also explore Pokémon nests, City Safari schedules and the Moonlight burst timetable. The interface supports English and Bahasa Melayu.',
    aboutWave: "Community Day, Raid Hour and Spotlight Hour often follow local time, so an event can finish in one city while it is still running in another. Choose your timezone to compare event times. Global events start at the same moment worldwide.",
    aboutSource: "PoGo Wave Radar is an independent, open-source project by <a href=\"https://github.com/Kengkorok\">Kengkorok</a>. <a href=\"https://github.com/Kengkorok/pogo-wave-radar\">View the PoGo Wave Radar GitHub repository</a>. Event information comes from <a href=\"https://leekduck.com/events/\">LeekDuck</a>; check the event details for ticket and participation requirements.",
    title: 'PoGo Wave Radar — Pokémon GO Event & Time Zone Tracker',
    tagline: 'Never miss a Pokémon GO event again — chase the wave across time zones',
    tzLabel: 'Your timezone',
    pvpLabel: 'Show PvP / GBL (hidden by default)',
    tabLive: '🔥 Live Now', tabWave: '🌊 Wave Tracker', tabAll: '📅 All Events', tabNests: '🐝 Nests',
    sectionLive: '🔥 Live Now', sectionUpcoming: '🟡 Upcoming Events',
    tools: '🧰 Tools', iosNote: 'supports iOS', moreCities: 'more cities',
    loading: 'Loading…', pickEvent: 'Pick an event:',
    footerData: 'Event data from <a href="https://leekduck.com/events/" target="_blank" rel="noopener">leekduck.com</a> · updated <span id="fetched">—</span>',
    disclaimer: 'For spoofers: use the coords in GPS Joystick at your own risk. Respect cooldown &amp; fair play.',
    noEvents: 'No events right now. Try enabling PvP or wait for the next event. 🌊',
    loadError: 'Could not load data. Refresh — if it persists, GitHub Actions will update soon.',
    endedArea: 'Ended in your area', notStartedArea: 'Not started in your area',
    endsIn: 'Ends in', startsIn: 'Starts in', citiesLive: 'cities live',
    startsSoon: 'Starts in', in_: 'in', // "Starts in 2h · 6:00 pm in Tokyo"
    viewFullWave: '🌊 View full wave', viewWave: 'View wave',
    readFull: '📖 Read full details', sourceLink: 'View on LeekDuck ↗',
    detailLoading: 'Loading full details…', detailMissing: 'Full details not available yet.',
    local: 'local', yourTime: 'your time', cityNow: 'time now',
    startsLbl: 'STARTS', endsLbl: 'ENDS', liveLbl: 'LIVE', yourArea: 'your area',
    localNote: '🕐 Local-time event — the wave moves east to west. Pick a city, copy coords, spoof!',
    globalNote: '🕐 Global event — simultaneous worldwide (UTC).',
    suggestion: '⭐ Suggestion:', stillLive: 'still live, ends',
    grpLive: '🔥 Live now', grpUp: '🟡 Upcoming', grpEnd: '⚫ Ended',
    startsShort: 'starts',
    upNextLbl: 'Up next — starts in', liveNowLbl: 'Live now — ends in',
    copyToast: 'paste into GPS Joystick',
    nestMigrateLbl: '⌛ Next nest migration in',
    nestFilterStar: '⭐ Stardust', nestFilterAll: 'All',
    nestSearchPh: 'Search nest…',
    nestNote: 'Combee &amp; friends give bonus stardust per catch — the fastest farm for new spoofers. Pick a nest, copy coords, spoof!',
    nestEmpty: 'No nests found. Check back after the next migration! 🐝',
    nestSdUnit: 'SD',
    evSearchPh: 'Search events…', evEmpty: 'No events match your search. 🔍',
    tabSafari: '🏙️ City Safari',
    safariNote: 'In-person ticketed events — times shown in the host city\'s local time AND in your own timezone.',
    safariHdrCity: 'Host city',
    sameDay: 'same day',
    safariHdrLocal: 'Host city local time', safariHdrYours: 'Your time',
    safariCompareTitle: 'Schedule compare',
    safariHotspots: '📡 Player hotspots',
    safariHotspotNote: 'POI density (shops, stops, parks, landmarks) = best public proxy for PokéStop/gym density. Copy coords, spoof!',
    safariPois: 'POI',
    safariBuy: 'Buy ticket',
    safariAddons: 'Add-ons',
    safariBothDays: 'Sat 26 + Sun 27 Sep',
    safariTicketNote: 'One-day ticket — pick Saturday OR Sunday',
    safariMap: 'map',
    tabMoon: '🌙 Moonlight',
    moonTitle: '🌙 Dancing in the Moonlight — four bursts a day',
    moonNote: 'Regional event: Japan, Korea, Taiwan, Indonesia, Singapore, Hong Kong &amp; Malaysia. Each burst lasts only <b>5 minutes</b> — miss one and the next is hours away.',
    moonHdrCountry: 'Country',
    moonHdrBursts: 'Bursts (local time) ★ = Clefairy featured',
    moonHdrNext: 'Status',
    moonLiveLbl: '🔴 LIVE',
    moonNextIn: 'next in',
    moonWaveLbl: 'Next burst',
    moonSpawns: 'Spawns in each burst',
    moonBonus: 'Event bonus',
    moonResearch: 'Timed Research expires',
    moonDays: '23–27 Sep 2026',
    moonEnded: 'ended',
    moonSource: 'Schedule',
    buyCoffee: '☕ Buy me a coffee', scanDonate: '🇲🇾 Scan to donate (MY)',
    qrTitle: 'Scan with TNG eWallet or any DuitNow app. Thank you! 🙏',
    qrName: 'Maybank DuitNow QR',
  },
  ms: {
    aboutTitle: "Tentang PoGo Wave Radar",
    aboutIntro: "PoGo Wave Radar ialah penjejak event Pokémon GO percuma. Semak event yang sedang berlangsung dan akan datang, bandingkan zon waktu bandar dan ikuti event waktu tempatan di seluruh dunia.",
    aboutFeatures: "Guna Live Sekarang untuk event aktif, Wave Tracker untuk masa mula dan tamat mengikut bandar, serta Semua Event untuk jadual. Anda juga boleh semak sarang Pokémon, jadual City Safari dan waktu burst Moonlight. Antara muka menyokong English dan Bahasa Melayu.",
    aboutWave: "Community Day, Raid Hour dan Spotlight Hour selalunya mengikut waktu tempatan. Jadi, event boleh tamat di satu bandar tetapi masih berlangsung di bandar lain. Pilih zon waktu anda untuk membandingkan masa event. Event global pula bermula serentak di seluruh dunia.",
    aboutSource: "PoGo Wave Radar ialah projek bebas dan sumber terbuka oleh <a href=\"https://github.com/Kengkorok\">Kengkorok</a>. <a href=\"https://github.com/Kengkorok/pogo-wave-radar\">Lihat repositori GitHub PoGo Wave Radar</a>. Maklumat event bersumberkan <a href=\"https://leekduck.com/events/\">LeekDuck</a>; semak butiran event untuk syarat tiket dan penyertaan.",
    title: 'PoGo Wave Radar — Penjejak Event & Zon Waktu Pokémon GO',
    tagline: 'Jangan terlepas event Pokémon GO lagi — chase ombak ikut zon waktu',
    tzLabel: 'Zon kau',
    pvpLabel: 'Tunjuk PvP / GBL (disorok secara default)',
    tabLive: '🔥 Live Sekarang', tabWave: '🌊 Wave Tracker', tabAll: '📅 Semua Event', tabNests: '🐝 Sarang',
    sectionLive: '🔥 Live Sekarang', sectionUpcoming: '🟡 Event Akan Datang',
    tools: '🧰 Tools', iosNote: 'sokong iOS', moreCities: 'bandar lagi',
    loading: 'Memuatkan…', pickEvent: 'Pilih event:',
    footerData: 'Data event dari <a href="https://leekduck.com/events/" target="_blank" rel="noopener">leekduck.com</a> · dikemas kini <span id="fetched">—</span>',
    disclaimer: 'Buat spoofer: guna koordinat kat GPS Joystick ikut risiko sendiri. Hormati cooldown &amp; fair play.',
    noEvents: 'Tiada event sekarang. Cuba aktifkan PvP atau tunggu event seterusnya. 🌊',
    loadError: 'Tak dapat load data. Cuba refresh — kalau masih rosak, GitHub Actions akan update.',
    endedArea: 'Dah habis kat tempat kau', notStartedArea: 'Belum start kat tempat kau',
    endsIn: 'Tamat dalam', startsIn: 'Bermula dalam', citiesLive: 'bandar live',
    startsSoon: 'Mula dalam', in_: 'waktu',
    viewFullWave: '🌊 Lihat wave penuh', viewWave: 'Lihat wave',
    readFull: '📖 Baca butiran penuh', sourceLink: 'Buka kat LeekDuck ↗',
    detailLoading: 'Memuatkan butiran penuh…', detailMissing: 'Butiran penuh belum tersedia.',
    local: 'tempatan', yourTime: 'waktu kau', cityNow: 'masa sekarang',
    startsLbl: 'MULA', endsLbl: 'HABIS', liveLbl: 'LIVE', yourArea: 'tempat kau',
    localNote: '🕐 Event ikut waktu tempatan — ombak bergerak dari timur ke barat. Pilih bandar, salin koordinat, spoof!',
    globalNote: '🕐 Event global — serentak seluruh dunia (UTC).',
    suggestion: '⭐ Cadangan:', stillLive: 'masih live, tamat',
    grpLive: '🔥 Live sekarang', grpUp: '🟡 Akan datang', grpEnd: '⚫ Dah tamat',
    startsShort: 'mula',
    upNextLbl: 'Seterusnya — mula dalam', liveNowLbl: 'Live sekarang — tamat dalam',
    copyToast: 'paste kat GPS Joystick',
    nestMigrateLbl: '⌛ Migrasi sarang seterusnya dalam',
    nestFilterStar: '⭐ Stardust', nestFilterAll: 'Semua',
    nestSearchPh: 'Cari sarang…',
    nestNote: 'Combee &amp; kawan-kawan bagi stardust bonus setiap tangkapan — farm terpantas untuk spoofer baru. Pilih sarang, salin koordinat, spoof!',
    nestEmpty: 'Tiada sarang dijumpai. Check balik lepas migration seterusnya! 🐝',
    nestSdUnit: 'SD',
    evSearchPh: 'Cari event…', evEmpty: 'Tiada event sepadan dengan carian kau. 🔍',
    tabSafari: '🏙️ City Safari',
    safariNote: 'Event berbayar & kena hadir sendiri — masa ditunjuk dalam waktu tempatan bandar tu AND waktu zon kau.',
    safariHdrCity: 'Bandar tuan rumah',
    sameDay: 'sama hari',
    safariHdrLocal: 'Waktu tempatan bandar', safariHdrYours: 'Waktu kau',
    safariCompareTitle: 'Jadual bandingan',
    safariHotspots: '📡 Hotspot player',
    safariHotspotNote: 'Kepadatan POI (kedai, stop, taman, landmark) = proxi terbaik untuk kepadatan PokéStop/gym. Salin koordinat, spoof!',
    safariPois: 'POI',
    safariBuy: 'Beli tiket',
    safariAddons: 'Add-on',
    safariBothDays: 'Sabtu 26 + Ahad 27 Sep',
    safariTicketNote: 'Tiket sehari — pilih Sabtu ATAU Ahad',
    safariMap: 'peta',
    tabMoon: '🌙 Moonlight',
    moonTitle: '🌙 Dancing in the Moonlight — empat burst sehari',
    moonNote: 'Event serantau: Jepun, Korea, Taiwan, Indonesia, Singapura, Hong Kong &amp; Malaysia. Setiap burst cuma <b>5 minit</b> — terlepas satu, kena tunggu berjam untuk yang seterusnya.',
    moonHdrCountry: 'Negara',
    moonHdrBursts: 'Burst (waktu tempatan) ★ = Clefairy di-feature',
    moonHdrNext: 'Status',
    moonLiveLbl: '🔴 LIVE',
    moonNextIn: 'lagi',
    moonWaveLbl: 'Burst seterusnya',
    moonSpawns: 'Muncul dalam setiap burst',
    moonBonus: 'Bonus event',
    moonResearch: 'Timed Research tamat',
    moonDays: '23–27 Sep 2026',
    moonEnded: 'tamat',
    moonSource: 'Jadual',
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
/* Full LeekDuck detail HTML in current language; fallback to English */
function detailHtml(ev) {
  const d = DETAILS[ev.slug] || {};
  return LANG === 'ms' ? (d.detail_ms || d.detail || '') : (d.detail || d.detail_ms || '');
}
async function ensureDetails() {
  if (DETAILS_LOADED) return;
  DETAILS_LOADED = true;
  try {
    const r = await fetch('details.json');
    DETAILS = (await r.json()) || {};
  } catch (e) {
    DETAILS = {};
  }
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
/* Wave order guard: easternmost city first (Kiribati → Hawaii), even when cities.json is
   hand-edited out of order. Stable: same-offset cities keep their file order.
   Keep the file itself tidy with scripts/sort_cities.py. */
function sortCitiesByWave(list) {
  const now = new Date();
  return list
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (tzOffsetMs(b.c.tz, now) - tzOffsetMs(a.c.tz, now)) || (a.i - b.i))
    .map((x) => x.c);
}
function fmtTime(ms, tz, opts) {
  const base = (opts && (opts.dateStyle || opts.timeStyle))
    ? opts
    : Object.assign({ hour: 'numeric', minute: '2-digit', timeZone: tz }, opts || {});
  return new Intl.DateTimeFormat('en-MY', base).format(new Date(ms));
}
function fmtDur(ms) {
  if (ms < 0) ms = 0;
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
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
/* Current local time at tz, always with that place's local date (e.g. "28 Aug 6:45 pm") */
function nowIn(tz) {
  const ms = Date.now();
  const tm = fmtTime(ms, tz);
  return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', timeZone: tz }).format(new Date(ms)) + ' ' + tm;
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
  let cities = CITIES;
  if (ev.city_only) cities = CITIES.filter((c) => c.name === ev.city_only);
  return cities.map((c) => ({ city: c, ...statusFor(ev, c, now) }));
}
function isPvP(ev) { return PVPTYPES.has(ev.type); }

/* ---------- next event banner ---------- */
/* Pick the most relevant event for the user's own timezone:
   a live event ending soonest wins; otherwise the next upcoming one. */
function nextEventPick() {
  const my = { tz: getUserTZ() };
  const now = new Date();
  const rows = EVENTS
    .filter((ev) => (APP_CONFIG.show_pvp_default || $('#pvp').checked) || !isPvP(ev))
    .map((ev) => ({ ev, st: statusFor(ev, my, now) }))
    .filter((r) => r.st.st === 'live' || r.st.st === 'upcoming');
  const live = rows.filter((r) => r.st.st === 'live').sort((a, b) => a.st.e - b.st.e);
  if (live.length) return { ...live[0], isLive: true };
  const up = rows.filter((r) => r.st.st === 'upcoming').sort((a, b) => a.st.s - b.st.s);
  if (up.length) return { ...up[0], isLive: false };
  return null;
}
function renderNextBar() {
  const bar = $('#nextbar');
  if (!bar) return;
  const p = nextEventPick();
  if (!p) { bar.hidden = true; return; }
  const target = p.isLive ? p.st.e : p.st.s;
  bar.hidden = false;
  bar.className = 'nextbar' + (p.isLive ? ' live' : '');
  bar.innerHTML = '<button class="nextbtn" data-wave="' + p.ev.slug + '" type="button">'
    + (p.isLive ? '🔥' : '⏳') + ' <b>' + esc(p.ev.name) + '</b>'
    + ' <span class="nextlabel">' + (p.isLive ? t('liveNowLbl') : t('upNextLbl')) + '</span>'
    + ' <span class="nextcd" data-cd="' + target + '">' + fmtDur(target - Date.now()) + '</span>'
    + ' →</button>';
  const btn = bar.querySelector('.nextbtn');
  if (btn) btn.addEventListener('click', () => goWave(p.ev.slug));
}

/* ---------- render: live now ---------- */
function cardHtml(r) {
  const isLive = r.live.length > 0;
  const tag = r.ev.type.replace(/-/g, ' ');
  const myBadge = r.my.st === 'ended' ? ' <span class="badge ended">' + t('endedArea') + '</span>'
    : r.my.st === 'upcoming' ? ' <span class="badge soon">' + t('notStartedArea') + '</span>'
    : isLive ? ' <span class="badge live">' + t('liveLbl') + '</span>' : '';
  const chips = isLive
    ? '<div class="chips">' + chip(r.live[0], r.ev)
      + (r.live.length > 1 ? '<span class="chip-more">+' + (r.live.length - 1) + ' ' + t('moreCities') + '</span>' : '')
      + '</div>'
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
  const prev = sel.value;
  const opts = EVENTS
    .filter((ev) => (APP_CONFIG.show_pvp_default || $('#pvp').checked) || !isPvP(ev))
    .map((ev) => '<option value="' + ev.slug + '">' + esc(ev.name) + '</option>')
    .join('');
  sel.innerHTML = opts;
  if (prev && EVENTS.some((e) => e.slug === prev)) sel.value = prev;
}
function renderWave() {
  const sel = $('#waveSel');
  const ev = EVENTS.find((e) => e.slug === sel.value);
  if (!ev) { $('#waveList').innerHTML = ''; return; }
  /* Wave order: always the timezone ladder from cities.json (Kiribati → Hawaii), never
     grouped by status — the 🟢/🟡/⚫ icons show where the wave is right now, so the list
     itself stays a clean east → west sweep. */
  const waveIdx = (city) => {
    const i = CITIES.findIndex((c) => c.name === city.name);
    return i === -1 ? CITIES.length : i;
  };
  const states = cityStates(ev)
    .map((s) => ({ ...s, coords: s.city.lat.toFixed(4) + ', ' + s.city.lng.toFixed(4) }))
    .sort((a, b) => waveIdx(a.city) - waveIdx(b.city));
  const suggestion = states.find((s) => s.st === 'live');
  const myTZ = getUserTZ();
  $('#waveList').innerHTML = '<div class="wavehead">'
    + '<span class="tag">' + esc(ev.type.replace(/-/g, ' ')) + '</span>'
    + '<h3>' + esc(ev.name) + '</h3>'
    + (sum(ev) ? '<p class="evsum-full">ℹ️ ' + esc(sum(ev)) + '</p>' : '')
    + (ev.local_time ? '<p class="note">' + t('localNote') + '</p>' : '<p class="note">' + t('globalNote') + '</p>')
    + (ev.url ? '<a class="src-link" href="' + esc(ev.url) + '" target="_blank" rel="noopener">' + t('sourceLink') + '</a>' : '')
    + '</div>'
    + detailBlock(ev)
    + '<div class="wavetable">' + states.map((s) => {
      const icon = s.st === 'live' ? '🟢' : s.st === 'upcoming' ? '🟡' : '⚫';
      const lbl = s.st === 'live' ? t('liveLbl') : s.st === 'upcoming' ? t('startsLbl') + ' ' + fmtTime(s.s, s.city.tz) : t('endsLbl') + ' ' + fmtTime(s.e, s.city.tz);
      const isMy = s.city.tz === myTZ ? ' <span class="badge mine">' + t('yourArea') + '</span>' : '';
      const suggest = suggestion && s.city.tz === suggestion.city.tz ? ' ⭐' : '';
      const wnow = '<span class="wnow">' + esc(s.city.name) + ' ' + t('cityNow') + ' ' + nowIn(s.city.tz) + '</span>';
      return '<div class="wrow st-' + s.st + '">'
        + '<div class="wcity">' + icon + ' ' + flagHtml(s.city) + ' <b>' + esc(s.city.name) + '</b>' + isMy + suggest + '</div>'
        + '<div class="wtime">' + (ev.local_time
            ? wnow + '<br><b class="yourwin">' + fmtWin(s.s, s.e, myTZ) + ' ' + t('yourTime') + '</b>'
            : lbl + ' · ' + wnow) + '</div>'
        + '<div class="wact"><button class="chip" data-coords="' + s.coords + '" data-name="' + esc(s.city.name) + '">📋 ' + s.coords + '</button></div>'
        + '</div>';
    }).join('') + '</div>'
    + (suggestion ? '<div class="hint">' + t('suggestion') + ' <b>' + suggestion.city.name + '</b> — ' + t('stillLive') + ' ' + fmtTime(suggestion.e, suggestion.city.tz) + ' ' + t('local') + '.</div>' : '');
  bindChips();
}

/* Full LeekDuck detail (collapsible) in the wave view */
function detailBlock(ev) {
  const html = detailHtml(ev);
  if (html) {
    return '<details class="fulldetail"><summary>' + t('readFull') + '</summary>'
      + '<div class="fulldetail-body">' + html + '</div></details>';
  }
  if (!DETAILS_LOADED) {
    ensureDetails().then(renderWave);
    return '<p class="note detail-note">' + t('detailLoading') + '</p>';
  }
  return '<p class="note detail-note">' + t('detailMissing') + '</p>';
}

/* ---------- render: all events ---------- */
function renderAll() {
  const box = $('#allList');
  if (!box) return;
  const q = EVENT_QUERY.trim().toLowerCase();
  const rows = EVENTS
    .filter((ev) => (APP_CONFIG.show_pvp_default || $('#pvp').checked) || !isPvP(ev))
    .filter((ev) => !q || ev.name.toLowerCase().includes(q) || ev.type.toLowerCase().includes(q) || (sum(ev) || '').toLowerCase().includes(q))
    .map((ev) => {
      const states = cityStates(ev);
      const live = states.filter((s) => s.st === 'live').length;
      const up = states.filter((s) => s.st === 'upcoming').length;
      const group = live > 0 ? 'live' : up > 0 ? 'up' : 'end';
      return { ev, group, live, up };
    })
    .sort((a, b) => (a.ev.start || '').localeCompare(b.ev.start || ''));
  if (!rows.length) {
    box.innerHTML = q ? '<div class="empty">' + t('evEmpty') + '</div>' : '';
    return;
  }
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

/* ---------- render: nests ---------- */
function renderNests() {
  const bar = $('#nestMigrate');
  if (bar) {
    const mig = NESTS_META && NESTS_META.migration;
    if (mig) {
      const ms = new Date(mig).getTime();
      bar.hidden = false;
      bar.innerHTML = '<div class="nestbar-inner"><span>' + t('nestMigrateLbl') + ' <b data-cd="' + ms + '">' + fmtDur(ms - Date.now()) + '</b></span></div>';
    } else {
      bar.hidden = true;
    }
  }
  const box = $('#nestList');
  if (!box) return;
  const q = NEST_QUERY.trim().toLowerCase();
  const rows = NESTS
    .filter((n) => NEST_FILTER === 'all' || n.stardust)
    .filter((n) => !q || n.pokemon.toLowerCase().includes(q) || n.country.toLowerCase().includes(q))
    .sort((a, b) => (b.stardust || 0) - (a.stardust || 0) || a.pokemon.localeCompare(b.pokemon));
  if (!rows.length) {
    box.innerHTML = '<div class="empty">' + t('nestEmpty') + '</div>';
    return;
  }
  box.innerHTML = rows.map(nestCardHtml).join('');
  bindChips();
}
function nestCardHtml(n) {
  const coords = n.lat.toFixed(4) + ', ' + n.lng.toFixed(4);
  const sd = n.stardust ? ' <span class="badge sd">⭐ ' + n.stardust + ' ' + t('nestSdUnit') + '</span>' : '';
  const flag = n.flag || '🌍';
  return '<article class="nestcard' + (n.stardust ? ' sd' : '') + '">'
    + '<img class="nsprite" loading="lazy" src="' + nestSprite(n.dex) + '" alt="" onerror="this.remove()">'
    + '<div class="nbody">'
    + '<div class="nrow1"><b>' + esc(n.pokemon) + '</b><span class="tag">#' + n.dex + '</span>' + sd + '</div>'
    + '<div class="nsub">' + flag + ' ' + esc(n.country || '') + '</div>'
    + '</div>'
    + '<button class="chip" data-coords="' + coords + '" data-name="' + esc(n.pokemon) + '">📋 ' + coords + '</button>'
    + '</article>';
}

/* ---------- render: City Safari (in-person events) ---------- */
/* Naive wall-clock time in a timezone -> epoch ms (2 passes handle DST) */
function wallMs(tz, iso) {
  const target = Date.parse(iso + 'Z');
  let guess = target;
  for (let i = 0; i < 3; i += 1) {
    const next = target - tzOffsetMs(tz, new Date(guess));
    if (next === guess) break;
    guess = next;
  }
  return guess;
}
function safariDays(ev) {
  return (ev.days || []).map((d) => ({
    day: d,
    s: wallMs(ev.tz, d + 'T' + (ev.start || '10:00') + ':00'),
    e: wallMs(ev.tz, d + 'T' + (ev.end || '18:00') + ':00'),
  }));
}
function safariStatus(ev) {
  const days = safariDays(ev);
  const now = Date.now();
  const live = days.find((w) => now >= w.s && now < w.e);
  if (live) return { st: 'live', w: live, days };
  const up = days.filter((w) => now < w.s).sort((a, b) => a.s - b.s)[0];
  if (up) return { st: 'upcoming', w: up, days };
  return { st: 'ended', w: days[days.length - 1], days };
}
/* Wall-clock window in the host city vs the same window in the user's timezone,
   with the day shift the user actually feels (e.g. Boston 10 am = 10 pm MYT,
   ending 6 am the next day). */
function safariCompare(s, e, cityTZ) {
  const myTZ = getUserTZ();
  const dayIdx = (ms, tz) => Math.floor((ms + tzOffsetMs(tz, new Date(ms))) / 86400000);
  const startShift = dayIdx(s, myTZ) - dayIdx(s, cityTZ);
  const endShift = dayIdx(e, myTZ) - dayIdx(e, cityTZ);
  const short = (ms) => new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', timeZone: myTZ }).format(new Date(ms));
  const start = fmtTime(s, myTZ) + (startShift !== 0 ? ' (' + short(s) + ')' : '');
  const tailEnd = endShift > 0 ? ' +' + endShift + 'd' : endShift < 0 ? ' ' + endShift + 'd' : '';
  const tail = (startShift === 0 && endShift === 0) ? ' ' + t('sameDay') : tailEnd;
  return { city: fmtTime(s, cityTZ) + ' – ' + fmtTime(e, cityTZ), you: start + ' – ' + fmtTime(e, myTZ) + tail };
}
function safariDayLbl(ms, tz) {
  return new Intl.DateTimeFormat('en-MY', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }).format(new Date(ms));
}
/* Wave order for the host cities: UTC offset first (east → west, like cities.json),
   then longitude so same-offset neighbours still run east → west. */
function safariOffset(ev) {
  if (typeof ev.utcOffsetMin === 'number') return ev.utcOffsetMin;
  const day = (ev.days && ev.days[0]) || '2026-01-01';
  return Math.round(tzOffsetMs(ev.tz, new Date(wallMs(ev.tz, day + 'T12:00:00'))) / 60000);
}
function safariTable(rows) {
  return '<h2 class="group-title">' + t('safariCompareTitle') + ' <span class="cnt">26–27 Sep</span></h2>'
    + '<table class="scmptable"><thead><tr><th>' + t('safariHdrCity') + '</th><th>' + t('safariHdrLocal') + '</th><th>' + t('safariHdrYours') + ' · ' + esc(getUserTZ()) + '</th></tr></thead><tbody>'
    + rows.map((r) => {
      const c = safariCompare(r.w.s, r.w.e, r.ev.tz);
      return '<tr><td>' + flagHtml(r.ev) + ' ' + esc(r.ev.city) + '</td><td>' + esc(c.city + ' ' + (r.ev.tzAbbr || '')) + '</td><td class="you">' + esc(c.you) + '</td></tr>';
    }).join('')
    + '</tbody></table>'
    + '<p class="note">' + t('safariNote') + '</p>';
}
function safariHotspots(ev) {
  return (ev.hotspots || []).map((h) => {
    const coords = h.lat.toFixed(4) + ', ' + h.lng.toFixed(4);
    const tip = LANG === 'ms' ? (h.tip_ms || h.tip) : h.tip;
    return '<div class="hotrow">'
      + '<div class="hotname"><b>' + esc(h.name) + '</b>' + (h.pois ? ' <span class="pois">' + h.pois + ' ' + t('safariPois') + '</span>' : '') + (tip ? '<span class="hottip">' + esc(tip) + '</span>' : '') + '</div>'
      + '<div class="hotact">'
      + '<button class="chip" data-coords="' + coords + '" data-name="' + esc(ev.city + ' — ' + h.name) + '">📋 ' + coords + '</button>'
      + '<a class="maplink" href="https://www.google.com/maps?q=' + h.lat + ',' + h.lng + '" target="_blank" rel="noopener" title="' + t('safariMap') + '">🗺️</a>'
      + '</div></div>';
  }).join('');
}
function safariCardHtml(ev) {
  const { st, w, days } = safariStatus(ev);
  const badge = st === 'live' ? '<span class="badge live">' + t('liveLbl') + '</span>'
    : st === 'upcoming' ? '<span class="badge soon">' + t('startsIn') + ' <b data-cd="' + w.s + '">' + fmtDur(w.s - Date.now()) + '</b></span>'
      : '<span class="badge ended">' + t('grpEnd') + '</span>';
  const cdRow = st === 'ended' ? ''
    : '<div class="cd">' + (st === 'live' ? t('endsIn') : t('startsIn')) + ' <b data-cd="' + (st === 'live' ? w.e : w.s) + '">' + fmtDur((st === 'live' ? w.e : w.s) - Date.now()) + '</b>'
      + ' · ' + fmtWin(w.s, w.e, getUserTZ()) + ' ' + t('yourTime') + '</div>';
  const dayRows = days.map((d) => {
    const c = safariCompare(d.s, d.e, ev.tz);
    return '<div class="swrow"><span class="swday">' + esc(safariDayLbl(d.s, ev.tz)) + '</span>'
      + '<span class="swlocal">' + esc(c.city) + ' <small>' + esc(ev.tzAbbr || '') + '</small></span>'
      + '<span class="swyour">' + esc(c.you) + '</span></div>';
  }).join('');
  const addons = (ev.addons || []).map((a) => esc(a.name) + ' <b>' + esc(a.price) + '</b>').join(' · ');
  return '<article class="safaricard' + (st === 'live' ? ' live' : '') + '" id="sf-' + ev.slug + '">'
    + '<div class="shead">'
    + (ev.img ? '<img class="sthumb" loading="lazy" src="' + esc(ev.img) + '" alt="" onerror="this.remove()">' : '')
    + '<div class="sheadtext">'
    + '<div class="row1"><span class="tag">city safari</span>' + badge + '</div>'
    + '<h3>' + flagHtml(ev) + ' ' + esc(ev.city) + ', ' + esc(ev.country) + '</h3>'
    + '<div class="ssub">📅 ' + t('safariBothDays') + ' 2026 · 🎟️ <b>' + esc(ev.price) + '</b> ' + t('safariTicketNote') + '</div>'
    + '</div></div>'
    + '<div class="scmp">' + dayRows + '</div>'
    + cdRow
    + (sum(ev) ? '<div class="evsum">ℹ️ ' + esc(sum(ev)) + '</div>' : '')
    + '<h4 class="hothead">' + t('safariHotspots') + '</h4>'
    + '<div class="hots">' + safariHotspots(ev) + '</div>'
    + '<p class="note tiny">' + t('safariHotspotNote') + '</p>'
    + (addons ? '<div class="addons"><span>' + t('safariAddons') + ':</span> ' + addons + '</div>' : '')
    + '<div class="sact">'
    + '<a class="btn" href="' + esc(ev.url) + '" target="_blank" rel="noopener">🎟️ ' + t('safariBuy') + ' · ' + esc(ev.price) + '</a>'
    + '<button class="chip" data-coords="' + ev.lat.toFixed(4) + ', ' + ev.lng.toFixed(4) + '" data-name="' + esc(ev.city + ' (city centre)') + '">📋 ' + ev.lat.toFixed(4) + ', ' + ev.lng.toFixed(4) + '</button>'
    + '</div></article>';
}
function renderSafari() {
  const box = $('#safariList');
  if (!box) return;
  const tabBtn = $('.tabs button[data-tab="safari"]');
  const sec = $('#safari');
  /* A City Safari only lives until its last in-game hour is over: finished editions
     are dropped, and the tab disappears once nothing is left (until a new edition
     lands in citysafari.json). */
  const rows = SAFARI.map((ev) => ({ ev, ...safariStatus(ev) }))
    .filter((r) => r.st !== 'ended')
    .sort((a, b) => (safariOffset(b.ev) - safariOffset(a.ev)) || (b.ev.lng - a.ev.lng));
  if (tabBtn) tabBtn.hidden = rows.length === 0;
  if (!rows.length) {
    if (sec && !sec.hidden) switchTab('live'); // was open -> leave before hiding
    if (sec) sec.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.innerHTML = safariTable(rows) + rows.map((r) => safariCardHtml(r.ev)).join('');
  bindChips();
}

/* ---------- render: Dancing in the Moonlight (regional event, 4 bursts/day) ---------- */
/* The 2026 edition is a REGIONAL local-time event: Moonlight O'Clock fires four times a day,
   5 minutes each, at the same wall-clock times in every participating country. So each country
   is its own wave slot, and the user's own timezone is the comparison column. */
function moonText(key) {
  return LANG === 'ms' ? (MOON[key + '_ms'] || MOON[key]) : MOON[key];
}
function moonCountry(c) {
  return LANG === 'ms' && c.name_ms ? c.name_ms : c.name;
}
function moonOffsetMin(c) {
  const day = (MOON.days && MOON.days[0]) || '2026-01-01';
  return Math.round(tzOffsetMs(c.tz, new Date(wallMs(c.tz, day + 'T12:00:00'))) / 60000);
}
/* every burst of the edition in one country's timezone: {s, e, w (local "12:00"), day} */
function moonBursts(tz) {
  if (!MOON) return [];
  const dur = (MOON.burst_min || 5) * 60000;
  const out = [];
  (MOON.days || []).forEach((d) => (MOON.windows || []).forEach((w) => {
    const s = wallMs(tz, d + 'T' + w + ':00');
    out.push({ s, e: s + dur, w, day: d });
  }));
  return out;
}
function moonStatus(tz) {
  const bursts = moonBursts(tz);
  const now = Date.now();
  const live = bursts.find((b) => now >= b.s && now < b.e) || null;
  const next = bursts.filter((b) => now < b.s).sort((a, b) => a.s - b.s)[0] || null;
  return { bursts, live, next };
}
/* which day's windows the row should show: the live/next burst's day, else the last day */
function moonRefDay(st) {
  const b = st.live || st.next;
  if (b) return b.day;
  const days = MOON.days || [];
  return days[days.length - 1] || '';
}
/* calendar-day shift the user actually feels (e.g. Japan 12:00 = 11:00 the same day in MYT) */
function moonDayShift(ms, fromTZ, toTZ) {
  const idx = (m, tz) => Math.floor((m + tzOffsetMs(tz, new Date(m))) / 86400000);
  return idx(ms, toTZ) - idx(ms, fromTZ);
}
function moonTimeCells(c, st) {
  const day = moonRefDay(st);
  const myTZ = getUserTZ();
  const feat = MOON.featured || [];
  const local = [];
  const mine = [];
  (MOON.windows || []).forEach((w) => {
    const s = wallMs(c.tz, day + 'T' + w + ':00');
    const sh = moonDayShift(s, c.tz, myTZ);
    local.push(w + (feat.indexOf(w) > -1 ? '★' : ''));
    mine.push(fmtTime(s, myTZ) + (sh > 0 ? ' +' + sh + 'd' : sh < 0 ? ' ' + sh + 'd' : ''));
  });
  return { local: local.join(' · '), mine: mine.join(' · ') };
}
function moonRowHtml(r) {
  const { c, live, next } = r;
  const badge = live
    ? '<span class="badge live">' + t('moonLiveLbl') + '</span> <b data-cd="' + live.e + '">' + fmtDur(live.e - Date.now()) + '</b>'
    : next
      ? '<span class="mnext">' + t('moonNextIn') + ' <b data-cd="' + next.s + '">' + fmtDur(next.s - Date.now()) + '</b></span>'
      : '<span class="badge ended">' + t('moonEnded') + '</span>';
  const times = moonTimeCells(c, r);
  return '<tr class="moonrow' + (live ? ' live' : '') + '">'
    + '<td>' + flagHtml(c) + ' ' + esc(moonCountry(c)) + ' <small class="tzabbr">' + esc(c.tzAbbr || '') + '</small></td>'
    + '<td>' + esc(times.local) + '</td>'
    + '<td class="you">' + esc(times.mine) + '</td>'
    + '<td>' + badge + '</td></tr>';
}
/* top line: a live burst wins, else the soonest upcoming burst anywhere */
function moonBarHtml(rows) {
  const myTZ = getUserTZ();
  const liveRow = rows.filter((r) => r.live).sort((a, b) => a.live.e - b.live.e)[0];
  if (liveRow) {
    return '<div class="moonbar live">🔴 ' + flagHtml(liveRow.c) + ' <b>' + esc(moonCountry(liveRow.c)) + '</b> — ' + t('moonLiveLbl')
      + ' · ' + t('endsIn') + ' <b data-cd="' + liveRow.live.e + '">' + fmtDur(liveRow.live.e - Date.now()) + '</b>'
      + ' · ' + esc(fmtWin(liveRow.live.s, liveRow.live.e, myTZ)) + ' ' + t('yourTime') + '</div>';
  }
  const nx = rows.filter((r) => r.next).sort((a, b) => a.next.s - b.next.s)[0];
  if (!nx) return '';
  return '<div class="moonbar">🌙 ' + t('moonWaveLbl') + ': ' + flagHtml(nx.c) + ' <b>' + esc(moonCountry(nx.c)) + '</b> — '
    + esc(fmtWin(nx.next.s, nx.next.e, nx.c.tz)) + ' ' + esc(nx.c.tzAbbr || '')
    + ' (' + esc(fmtWin(nx.next.s, nx.next.e, myTZ)) + ' ' + t('yourTime') + ')'
    + ' · ' + t('moonNextIn') + ' <b data-cd="' + nx.next.s + '">' + fmtDur(nx.next.s - Date.now()) + '</b></div>';
}
function renderMoonlight() {
  const box = $('#moonList');
  if (!box || !MOON) return;
  const tabBtn = $('.tabs button[data-tab="moon"]');
  const sec = $('#moon');
  /* One edition only: once the last burst of the last day is over everywhere, the tab goes
     away (same lifecycle as City Safari) until moonlight.json carries a new edition. */
  const rows = (MOON.countries || []).map((c) => {
    const st = moonStatus(c.tz);
    return { c, bursts: st.bursts, live: st.live, next: st.next };
  }).sort((a, b) => moonOffsetMin(b.c) - moonOffsetMin(a.c));
  const alive = rows.filter((r) => r.live || r.next);
  if (tabBtn) tabBtn.hidden = alive.length === 0;
  if (!alive.length) {
    if (sec && !sec.hidden) switchTab('live'); // was open -> leave before hiding
    if (sec) sec.hidden = true;
    box.innerHTML = '';
    return;
  }
  const myTZ = getUserTZ();
  const spawns = moonText('spawns') || [];
  const shiny = MOON.shiny || [];
  const resMs = MOON.research_end ? wallMs(myTZ, MOON.research_end + ':00') : null;
  const resLbl = resMs ? new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: myTZ }).format(new Date(resMs)) : '—';
  box.innerHTML = moonBarHtml(alive)
    + '<h2 class="group-title">' + t('moonTitle') + ' <span class="cnt">' + t('moonDays') + '</span></h2>'
    + '<table class="scmptable moon"><thead><tr><th>' + t('moonHdrCountry') + '</th><th>' + t('moonHdrBursts')
    + '</th><th>' + t('safariHdrYours') + ' · ' + esc(myTZ) + '</th><th>' + t('moonHdrNext') + '</th></tr></thead><tbody>'
    + rows.map(moonRowHtml).join('')
    + '</tbody></table>'
    + '<p class="note">' + t('moonNote') + '</p>'
    + '<div class="mooninfo">'
    + '<div><b>' + t('moonSpawns') + ':</b> ' + esc(spawns.join(' · ')) + '</div>'
    + '<div><b>' + t('moonBonus') + ':</b> ' + esc(moonText('bonus')) + ' · ✨ ' + esc(shiny.join(' · ')) + '</div>'
    + '<div><b>' + t('moonResearch') + ':</b> ' + esc(resLbl) + '</div>'
    + '<div class="tiny">📅 ' + t('moonDays') + ' · ' + t('moonSource') + ': <a href="' + esc(MOON.source) + '" target="_blank" rel="noopener">pokemongohub.net ↗</a></div>'
    + '</div>';
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
  $('#nests').hidden = name !== 'nests';
  if ($('#safari')) $('#safari').hidden = name !== 'safari';
  if ($('#moon')) $('#moon').hidden = name !== 'moon';
  if (name === 'wave') renderWave(); // fresh render (details may have loaded since init)
  if (name === 'nests') renderNests();
  if (name === 'safari') renderSafari();
  if (name === 'moon') renderMoonlight();
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
  // re-pick the "next event" every 30s so the banner follows status transitions
  setInterval(renderNextBar, 30000);
  // drop City Safari editions as soon as they finish (tab hides itself when none left)
  setInterval(() => { if (SAFARI.length) renderSafari(); }, 60000);
  // Moonlight bursts are 5 minutes long — re-render often so a burst flips to LIVE right away
  setInterval(() => { if (MOON) renderMoonlight(); }, 30000);
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
  const s = $('#nestSearch');
  if (s) s.placeholder = t('nestSearchPh');
  const es = $('#evSearch');
  if (es) es.placeholder = t('evSearchPh');
  renderTZ();
  renderNextBar();
  renderLive();
  renderWaveSelect();
  renderWave();
  renderAll();
  renderNests();
  renderSafari();
  renderMoonlight();
  renderDonate();
}

/* ---------- init ---------- */
async function init() {
  LANG = localStorage.getItem(LANG_STORAGE) === 'ms' ? 'ms' : 'en';
  USER_TZ = localStorage.getItem(TZ_STORAGE) || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kuala_Lumpur';
  $('#pvp').checked = localStorage.getItem(PVP_STORAGE) === '1';
  try {
    const [c, e, m, n, sf, mo] = await Promise.all([
      fetch('cities.json').then((r) => r.json()),
      fetch('events.json').then((r) => r.json()),
      fetch('manual_events.json').then((r) => r.json()).catch(() => []),
      fetch('nests.json').then((r) => r.json()).catch(() => ({ nests: [], migration: null })),
      fetch('citysafari.json').then((r) => r.json()).catch(() => ({ events: [] })),
      fetch('moonlight.json').then((r) => r.json()).catch(() => null),
    ]);
    CITIES = sortCitiesByWave(c); EVENTS = (e.events || []).concat(m); FETCHED_AT = e.fetched_at;
    NESTS = (n && n.nests) || []; NESTS_META = n || null;
    SAFARI = (sf && sf.events) || [];
    MOON = mo || null;
    ensureDetails().then(() => { if (!$('#wave').hidden) renderWave(); });
    if (!$('#nests').hidden) renderNests();
    if ($('#safari')) renderSafari();
    if ($('#moon')) renderMoonlight();
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
  $('#tz').addEventListener('change', (ev) => { USER_TZ = ev.target.value; localStorage.setItem(TZ_STORAGE, USER_TZ); renderTZ(); renderNextBar(); renderLive(); renderAll(); renderSafari(); renderMoonlight(); });
  $('#pvp').addEventListener('change', () => { localStorage.setItem(PVP_STORAGE, $('#pvp').checked ? '1' : '0'); renderNextBar(); renderLive(); renderWaveSelect(); renderWave(); renderAll(); });
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $('#waveSel').addEventListener('change', renderWave);
  $$('.nchip').forEach((b) => b.addEventListener('click', () => {
    NEST_FILTER = b.dataset.nestfilter;
    $$('.nchip').forEach((x) => x.classList.toggle('active', x === b));
    renderNests();
  }));
  const nestSearch = $('#nestSearch');
  if (nestSearch) nestSearch.addEventListener('input', (e) => { NEST_QUERY = e.target.value; renderNests(); });
  const evSearch = $('#evSearch');
  if (evSearch) evSearch.addEventListener('input', (e) => { EVENT_QUERY = e.target.value; renderAll(); });
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
