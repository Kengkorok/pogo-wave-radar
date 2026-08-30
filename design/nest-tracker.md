# Nest Tracker — Design

> Issue: #9 · Branch: `feat/nest-tracker`
> Status: Phase 1 (MVP) implemented on this branch — see commits below the doc.

Track Pokémon nests so spoofers can farm **stardust (Combee)** and **candy (any nest species)** — inside the same wave-radar flow: *pick a nest → copy coords → spoof*.

---

## 1. Why

- **Combee nests = best stardust farm**: Combee gives **500 SD per catch** (5×), 750 with a Star Piece. Perfect for beginners who just started spoofing.
- **General nests = candy farm**: e.g. a Magikarp nest → evolve candies for level-ups.
- Users currently use separate sites (e.g. pokecoord.com). Pulling nests into PoGo Wave Radar keeps the whole loop in one app and reuses our existing countdown + copy-coords UX.

## 2. Data source — verified

`https://pokecoord-backend-production.up.railway.app/locations` — **public JSON API**, no auth, verified working:

```json
[ {"location_name": "Abra", "coordinates": "35.17311,137.09034",
   "country": "JAPAN", "pokemon_number": 63, "pokemon_name": "Abra"}, ... ]
```

- 101 locations at last check; **Combee appears 5×**; also Oddish, Emolga, Snover, Abra, Grubbin, Rhyhorn, …
- Their migration countdown is hardcoded in their `index.html` (`nextMigrationDate`), updated manually every ~2 weeks. **We must not depend on it** — compute our own: `migration = last_known + 14 days`.

> ⚠️ Unofficial third-party API — may break or disappear. Architecture must keep the app 100% static: scrape at CI time, commit JSON, never fetch at runtime. If the API dies, `nests.json` stays editable by hand (same as `cities.json`).

## 3. Data model — `nests.json` (new, committed by CI)

```json
{
  "fetched_at": "2026-08-30T05:00:00Z",
  "migration": "2026-09-09T14:18:00Z",
  "nests": [
    {
      "pokemon": "Combee",
      "dex": 415,
      "park": "Koishikawa Korakuen",
      "city": "Tokyo",
      "country": "JP",
      "lat": 35.705,
      "lng": 139.752,
      "stardust": 500,
      "source": "pokecoord"
    }
  ]
}
```

Notes:

- `location_name` from pokecoord is the *pokemon name* — a nest is really "this park spawns X". Keep `park` optional; when unknown, use city area as fallback.
- `stardust` only for boosted species (see lookup below); `null`/absent otherwise.
- `lat`/`lng` parsed from their `coordinates` string `"lat,lng"`.
- `migration` drives the countdown banner; refresh logic: if `now > migration`, set `migration += 14 days`.

### Stardust lookup (Phase 2 badge)

| Pokémon | SD / catch | with Star Piece |
|---|---|---|
| Combee | 500 | 750 |
| Audino | 2100 | 3150 |
| Chimecho | 500 | 750 |
| Sableye / Shellder / Paras / Staryu | 150 | 225 |
| Meowth | 250 | 375 |

Keep as a small constant map in `app.js` (`STARDUST = {415:500, 531:2100, ...}`) keyed by dex — tune anytime. (Recheck values on a PoGo source before shipping; table is a starting point.)

## 4. Scraper — GitHub Actions

New workflow (or extend `scrape.yml`) — pattern identical to the existing LeekDuck scrape:

- **Cadence: once daily** (nests only change every ~14 days — 30-min cadence is wasted).
- Script: `scripts/scrape_nests.py` (Python) or Node — fetches the pokecoord API, normalises to the `nests.json` shape, commits.
- **Resilience**: if fetch fails, keep previous `nests.json` and don't fail the workflow (so a dead upstream doesn't churn commits or break Pages).
- Optional: also fetch their `index.html` to read `nextMigrationDate`; if present and newer, adopt it instead of `+14 days`.

## 5. UI — "Nests" tab

Nav: `Wave | Live Now | All Events | Tracker | **Nests**` (last). Mobile-first, matches existing dark-blue style.

### Layout (top → bottom)

1. **Migration countdown banner** — `⌛ Next nest migration in 2d 5h` — **reuse `data-cd` + `fmtDur()`**: no new countdown code. Data from `nests.migration`. Hide when `migration` unknown.
2. **Filter chips row** (sticky under nav): `⭐ Stardust (Combee)` default ON, `All`, search box (pokémon / city / country).
3. **Nest cards** — one per nest:
   - Left: pokémon name + dex, stardust badge if boosted (`⭐ 500 SD`), species icon (Phase 2: PokeAPI sprite).
   - Middle: park/area, city + country + flag emoji (flag pattern from `cities.json`).
   - Right/bottom: **coords pill** — same copy-to-clipboard component as event city rows, with "paste into GPS Joystick" hint.
4. **Empty state**: "No nests found — data refreshes at next migration" (i18n).

### Reused infrastructure (no duplication)

| Existing | Use |
|---|---|
| `data-cd` + `fmtDur()` | migration countdown banner |
| city-row coords pill + clipboard copy | nest coords |
| flag emoji pattern (`cities.json`) | nest country flag |
| `t(key)` i18n (EN + BM) | all new labels |
| GitHub Actions scrape pattern | daily nest scrape |
| PWA shell (`sw.js`) | nests are static JSON → offline after first load |

### i18n keys (EN / BM)

`nests` (Nests / Sarang), `next_migration` ("Next nest migration in {d}" / "Migrasi sarang seterusnya dalam {d}"), `stardust` (Stardust / Stardust), `copy_coords` (reuse existing), `no_nests` (empty state), `paste_gps` (reuse existing).

## 6. Phases

- **Phase 1 — MVP**: scraper + `nests.json` + Nests tab + migration countdown + copy-coords + Combee default filter.
- **Phase 2 — polish**: stardust badges + PokeAPI sprites + sort (by country, then pokémon) + community submit (link to repo issue/form).
- **Phase 3 — synergy** *(optional)*: cross-link nests with events (e.g. "Combee nest + Spotlight Hour" hint).

## 7. Acceptance criteria (from issue #9)

- [ ] `nests.json` generated by a GitHub Actions workflow (daily)
- [ ] "Nests" tab renders nest feed with migration countdown
- [ ] Combee default filter + stardust badge
- [ ] Copy-coords works same as event cities
- [ ] EN + BM translations
- [ ] Works offline (PWA) once loaded

## 8. Risks

- Upstream API (pokecoord backend) unofficial → may vanish. Mitigated: static committed JSON + manual edit path.
- Nest data can be stale between migrations → countdown + `fetched_at` shown to set expectations.
- Duplicate/overlapping coords in source data → dedupe in scraper (round coords to ~4 decimals, drop exact dupes).

---

*Design doc committed on `feat/nest-tracker`; implementation commits to follow manually.*
