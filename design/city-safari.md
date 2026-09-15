# City Safari (in-person events) — design

**Status:** implemented (branch `feat/city-safari-tab`)
**Goal:** one place to see the Pokémon GO City Safari in-person events — summary, the schedule in
each host city's local time *and* in the user's own timezone, ticket info, and the densest
player hotspots (coordinates ready to copy).

## Data source

Official pages, one per city:

```
https://pokemongo.com/en/featured-in-person-events/citysafari/{brisbane,boston,lisbon,marseille,munich,rio-de-janeiro}
```

Extracted facts (identical layout on all six pages): 26–27 Sep 2026, 10:00–18:00 local time,
citywide, ticket-only. Prices/timezones per city:

| city | tz | abbr | ticket | day-1 local → MYT (UTC+8) |
|---|---|---|---|---|
| Brisbane | Australia/Brisbane | AEST (UTC+10) | AU$17.00 | 10:00–18:00 → 08:00–16:00 same day |
| Marseille | Europe/Paris | CEST (UTC+2) | €10.00 | 10:00–18:00 → 16:00–00:00 +1d |
| Munich | Europe/Berlin | CEST (UTC+2) | €10.00 | 10:00–18:00 → 16:00–00:00 +1d |
| Lisbon | Europe/Lisbon | WEST (UTC+1) | €10.00 | 10:00–18:00 → 17:00–01:00 +1d |
| Rio de Janeiro | America/Sao_Paulo | BRT (UTC−3) | R$38.00 | 10:00–18:00 → 21:00–05:00 +1d |
| Boston | America/New_York | EDT (UTC−4) | US$10.00 | 10:00–18:00 → 22:00–06:00 +1d |

In-game content (same for all six): explorer-hat Eevee from the City Safari Special Research,
8-stamp City Safari Stamp Rally at highlighted PokéStops (Stops flagged on Campfire + a dedicated
map), event wild spawns with Mudbray debuting (plus Unown B/L/M/R, Hawlucha, Oranguru, Komala,
Flamigo, Stantler, Miltank…), 7 km eggs (Flabébé Orange Flower, Hawlucha, Mudbray, Komala),
exclusive Field Research. Ticket bonuses: boosted shiny odds, 4-hour Lures, 5 special trades/day
at half Stardust, Tiny Compass buddy souvenir, 8-hour Party Play. Add-ons: Raid Lover,
Egg-thusiast, Extra Day.

## Hotspot coordinates — how they were chosen

PokéStops/gyms trace back to Ingress portals seeded from map POIs, so **OSM POI density is the best
public proxy for where players actually have stuff to catch**. For every host city we pull OSM
nodes (shops, amenities, tourism, historic, parks, artwork, station/tram/bus stops) from the
Overpass API, then:

1. Smooth counts on a ~110 m grid and take local maxima ≥600 m apart → *candidate* hotspots.
2. Curate the list by hand against known landmarks (Nominatim reverse geocode to confirm the
   suburb/landmark name).
3. Report `pois` = number of those OSM POIs inside a 330 m box around the final coordinate — a
   single comparable "density" number, e.g. Marienplatz 879, Baixa-Chiado 976, Queen St Mall 427.

`scripts/build_citysafari.py` does all of this (`--scan` refreshes the Overpass cache,
`--verify` does exact per-hotspot `out count` queries, default rebuilds `docs/citysafari.json`
from the cached dump and baked-in curated coordinates). Being an OSM-derived measure it is a
*proxy*: a low `pois` can still be a popular venue (Theresienwiese during Oktoberfest = 98 POIs
but the busiest crowd in Munich), which is why each hotspot carries a short tip.

## Files

| File | Role |
|---|---|
| `docs/citysafari.json` | 6 events: slug, city, country, flag, tz/tzAbbr, days + start/end wall times, price, addons, img, url, summary + summary_ms, hotspots[] (`name`, `lat`, `lng`, `pois`, `tip`, `tip_ms`) |
| `docs/app.js` | `wallMs()` (naive wall time → epoch, DST-safe), `safariDays()`, `safariStatus()`, `safariCompare()`, `safariTable()`, `safariHotspots()`, `safariCardHtml()`, `renderSafari()`; new i18n keys EN + BM |
| `docs/index.html` | `🏙️ City Safari` tab + `#safari` / `#safariList` |
| `docs/style.css` | `.scmptable`, `.safaricard`, `.swrow` (local vs your time), `.hotrow` hotspots |
| `docs/sw.js` | cache `pwr-v2`, `citysafari.json` pre-cached |
| `scripts/build_citysafari.py` | regenerates the JSON (Overpass scan/verify + curated metadata) |
| `scripts/test-harness.js` | jsdom assertions: 6 cards, 6 compare rows, 35 hotspot chips, 12 countdowns, tz switch re-render |

## Timezone handling

Wall times are naive (`10:00` in the host city), so `wallMs(tz, iso)` converts them with the
city's real offset for that date (two passes, so DST is handled). `safariCompare()` then renders
both sides plus the day shift the user feels: `10:00 am – 6:00 pm EDT` = `10:00 pm – 6:00 am +1d`
in Kuala Lumpur. The comparison table sorts rows by absolute start time, so it doubles as the
"wave" order: **Brisbane → Munich/Marseille → Lisbon → Rio → Boston**. Everything re-renders when
the user changes the timezone picker, same as the other tabs.

## Lifecycle (editions expire)

A City Safari edition only lives until its last in-game hour ends. `renderSafari()` filters out
finished editions (`st === 'ended'`), so once 26–27 Sep 2026 passes the six cards disappear; when
nothing is left the tab button hides itself and the app falls back to Live Now. The tab reappears
automatically as soon as a new edition lands in `docs/citysafari.json`. A 60 s interval inside
`startTicker()` re-checks, so the tab drops without needing a reload.

## Not done / next

- The pages are curated by hand; a scraper (`scripts/scrape_citysafari.py`) could extract
  city/date/time/price the way `scrape_events.py` does for LeekDuck, with the page text as source.
- Extra city editions (previous City Safaris) could be added as past events.
- Hotspot tips are static text; Campfire/the "dedicated map" Niantic promised for stamp-rally
  PokéStops could replace them once public.
