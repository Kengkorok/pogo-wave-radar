# 🌙 Moonlight tab — Dancing in the Moonlight (2026)

Design doc for the per-country burst schedule tab added Sep 2026.

## Event shape (why it needs its own tab)

| Fact | Value |
|---|---|
| Edition | 23–27 Sep 2026 |
| Region | Japan, Korea, Taiwan, Indonesia, Singapore, Hong Kong, **Malaysia** |
| Start / end | 10:00 AM local, 23 Sep → 11:59 PM local, 27 Sep |
| Bursts | **4× a day, 5 minutes each**: 12:00 · 13:00 · 19:00 · 20:00 local |
| Featured | Clefairy (Special Background) at 13:00 & 19:00; Clefairy also at 13:00/19:00 for the plain featured spawn |
| Bonus | 2× Catch XP |
| Spawns in a burst | Clefairy ✨, Jigglypuff, Teddiursa, Skitty, Munna, Bunnelby |
| Timed Research | two consecutive; first expires 29 Sep 2026 |
| Source | https://pokemongohub.net/post/event/dancing-in-the-moonlight-2026/ |

Two things make it different from every other event in the app:

1. **The whole event is 25 windows, not one window.** A 5-minute burst is easy to miss — a
   countdown matters more than a date.
2. **The burst times are local wall-clock times that are identical in every participating
   country** (everyone gets 12:00 local). So the wave is driven purely by UTC offset: Japan/Korea
   (+9) fire first, then all the +8 countries, then Indonesia WIB (+7).

## Data — `docs/moonlight.json`

Hand-maintained (not scraped, not from LeekDuck). One edition per file:

```json
{ "slug": "...", "days": ["2026-09-23", ...], "windows": ["12:00","13:00","19:00","20:00"],
  "featured": ["13:00","19:00"], "burst_min": 5,
  "spawns": [...], "spawns_ms": [...], "shiny": [...],
  "research_end": "2026-09-29T23:59", "source": "https://…",
  "summary": "EN", "summary_ms": "BM",
  "countries": [ {"name":"Japan","name_ms":"Jepun","flag":"img/flags/jp.svg","tz":"Asia/Tokyo","tzAbbr":"JST"} ] }
```

`windows` + `days` + `burst_min` are the only fields the schedule math needs; everything else is
copy. Adding next year's edition = replace this file (the tab appears on its own, see Lifecycle).

## Rendering (`renderMoonlight()` in app.js)

- `moonBursts(tz)` → every burst of the edition as `{s, e, w, day}`, using the existing
  `wallMs(tz, "YYYY-MM-DDTHH:MM:SS")` helper (DST-safe, shared with City Safari).
- `moonStatus(tz)` → `{bursts, live, next}`; `live` = a burst whose window contains `now`.
- Table columns: **Country** (flag + tzAbbr) · **Bursts (local time, ★ = Clefairy featured)** ·
  **Your time** (each window converted with the day shift, e.g. `+1d`) · **Status**
  (`🔴 LIVE 3m` / `next in 2h 15m`).
- Rows sorted by UTC offset descending — same east→west ladder as `cities.json`.
- Top bar: a live burst wins (country + countdown + your-time window), else the soonest upcoming
  burst anywhere ("Next burst: Indonesia — 8:00 pm WIB (9:00 pm your time) · next in 30m").
- The featured windows are marked `★` in the local column and explained in the header, so the
  Clefairy 13:00/19:00 bursts are obvious without extra rows.

## Lifecycle

Same pattern as City Safari: `renderMoonlight()` drops countries whose bursts are all in the past,
and when **no** country has a live or upcoming burst (edition over) it hides the tab button
(`.tabs button[data-tab="moon"]`), closes the section and falls back to Live Now. A new edition in
`moonlight.json` brings the tab back with no code change. `startTicker()` re-renders every 30 s so a
burst flips to LIVE without a reload (the 1 s ticker keeps the countdown text moving).

Wiring notes: `switchTab` handles `moon`, `renderLang()` and the tz-change handler both re-render
it, `init()` fetches `moonlight.json` in the existing `Promise.all`, and `sw.js` caches it
(`CACHE = 'pwr-v3'`).

## Verification (jsdom harness)

`node scripts/test-harness.js` asserts: 7 country rows in wave order, the ★ markers, 8 countdowns
(7 rows + bar), 4 info lines, the tz switch re-flowing the comparison column
(`tz=Europe/London` → Japan 12:00 JST = 4:00 am), the LIVE row + live bar when the clock is forced
inside a burst (`window.Date.now` — see pitfall below), and the tab auto-hiding once every burst is
over.

**Pitfall:** the harness runs in Node while app.js is evaluated inside the jsdom realm, so
`Date.now = ...` in the harness does **not** affect the app — patch `window.Date.now` instead.
