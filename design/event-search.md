# Event Search — Design

> Branch: `feat/event-search` — implementation commits to follow (manual).

## Why

- The **All Events** tab is a flat list that grows every time LeekDuck adds events; finding a specific event ("Mewtwo", "Spotlight", "Comday", "Raid Day") means scrolling a lot.
- Users want to search the events they actually need.

## Where

Search input at the top of the **All Events** tab (`#all` section) — same visual pattern as the nest search (`#nestSearch`).

- Filters **live as you type** across: event **name**, event **type** (e.g. `spotlight-hour`, `community-day`, `raid-day`), and **summary** (both EN `summary` and BM `summary_ms`).
- Group headers (🔥 Live now / 🟡 Upcoming / ⚫ Ended) stay; search just narrows the rows inside them.
- Empty state: "No events match your search." (i18n)

## Implementation notes

Reuse the nests-search pattern already in `app.js` (added with the nest tracker):

1. `docs/index.html` — add `<input id="evSearch" type="search">` inside `#all` section (before the list container), `data-i18n-ph` handled via `renderLang()` placeholder set (same as `#nestSearch`).
2. `docs/app.js`:
   - `let EVENT_QUERY = '';`
   - filter in `renderAll()`: `rows.filter((r) => !q || r.ev.name.toLowerCase().includes(q) || r.ev.type.includes(q) || (sum(r.ev) || '').toLowerCase().includes(q))`
   - input listener in `init()` (same as `#nestSearch`)
   - i18n keys: `evSearchPh` ("Search events…" / "Cari event…"), `evEmpty` ("No events match your search." / "Tiada event sepadan dengan carian kau.")
   - set placeholder in `renderLang()` next to `#nestSearch` placeholder
3. `docs/style.css` — share one search-input style: rename `.nests` search rule to a common class (e.g. `.searchinput`) applied to both `#nestSearch` and `#evSearch`, or duplicate the rule. Prefer a shared class to avoid drift.

## Acceptance criteria

- [ ] Typing "mewtwo" narrows All Events to matching events only
- [ ] Matches name, type, and summary (EN + BM)
- [ ] Empty state message shows when nothing matches
- [ ] i18n EN + BM in sync
- [ ] Mobile-friendly (input stretches full width on small screens, same as nest search)

## Optional follow-ups (not in this PR)

- Apply the same query to the **Live Now** tab cards.
- Debounce for very large lists (not needed at current event counts).
