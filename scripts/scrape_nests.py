#!/usr/bin/env python3
"""Scrape nest locations from pokecoord.com -> docs/nests.json

Pokecoord exposes a public JSON API (unofficial, no auth):
  https://pokecoord-backend-production.up.railway.app/locations
  [{"location_name": "...", "coordinates": "lat,lng", "country": "JAPAN",
    "pokemon_number": 63, "pokemon_name": "Abra"}, ...]

Nests change every ~14 days (nest migration), so this runs once a day from
GitHub Actions (see .github/workflows/scrape_nests.yml). The migration
timestamp is read from pokecoord's index.html (nextMigrationDate); when that
fails we roll the previous migration forward by 14 days.

Design rules:
- App stays 100% static: data is committed to docs/nests.json, never fetched
  at runtime. If the upstream API dies, keep the previous nests.json and let
  humans edit it by hand (same as cities.json).
- Dedupe exact (dex, lat, lng) repeats — pokecoord returns duplicates.
- `stardust` field only for boosted species (base SD per catch).
"""
import json
import os
import re
import sys
import datetime
import urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
API = "https://pokecoord-backend-production.up.railway.app/locations"
PAGE = "https://pokecoord.com/index.html"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "docs", "nests.json")
MIGRATION_FALLBACK = "2026-09-09T14:18:00Z"  # first known migration (UTC)
MIGRATION_DAYS = 14

# Base stardust per catch for boosted species (dex -> SD).
# Combee (415) = 500 (5x), Audino (531) = 2100 (21x), Chimecho (358) = 500.
# The 150-club: Paras, Shellder, Staryu, Sableye, Foongus, Sunkern, Shroomish,
# Miltank, Lillipup. Meowth = 250. Tune as Niantic changes things.
STARDUST = {
    46: 150, 52: 250, 90: 150, 120: 150, 191: 150, 241: 150, 285: 150,
    302: 150, 358: 500, 415: 500, 506: 150, 531: 2100, 590: 150,
}

# Common country names -> flag emoji (fallback 🌍)
FLAGS = {
    "JAPAN": "🇯🇵", "JAPON": "🇯🇵", "GERMANY": "🇩🇪", "ALEMANIA": "🇩🇪",
    "UNITED STATES": "🇺🇸", "USA": "🇺🇸", "EEUU": "🇺🇸", "ESTADOS UNIDOS": "🇺🇸",
    "FRANCE": "🇫🇷", "SPAIN": "🇪🇸", "ESPAÑA": "🇪🇸", "ITALY": "🇮🇹", "ITALIA": "🇮🇹",
    "UNITED KINGDOM": "🇬🇧", "UK": "🇬🇧", "REINO UNIDO": "🇬🇧", "ENGLAND": "🇬🇧",
    "BRAZIL": "🇧🇷", "BRASIL": "🇧🇷", "ARGENTINA": "🇦🇷", "MEXICO": "🇲🇽", "MÉXICO": "🇲🇽",
    "CANADA": "🇨🇦", "AUSTRALIA": "🇦🇺", "NEW ZEALAND": "🇳🇿", "NUEVA ZELANDA": "🇳🇿",
    "SOUTH KOREA": "🇰🇷", "COREA DEL SUR": "🇰🇷", "KOREA": "🇰🇷", "TAIWAN": "🇹🇼",
    "SINGAPORE": "🇸🇬", "MALAYSIA": "🇲🇾", "THAILAND": "🇹🇭", "INDONESIA": "🇮🇩",
    "INDIA": "🇮🇳", "PHILIPPINES": "🇵🇭", "VIETNAM": "🇻🇳", "CHINA": "🇨🇳",
    "HONG KONG": "🇭🇰", "NETHERLANDS": "🇳🇱", "PAISES BAJOS": "🇳🇱", "POLAND": "🇵🇱",
    "SWEDEN": "🇸🇪", "NORWAY": "🇳🇴", "DENMARK": "🇩🇰", "FINLAND": "🇫🇮",
    "PORTUGAL": "🇵🇹", "BELGIUM": "🇧🇪", "BÉLGICA": "🇧🇪", "SWITZERLAND": "🇨🇭",
    "AUSTRIA": "🇦🇹", "IRELAND": "🇮🇪", "CZECHIA": "🇨🇿", "CZECH REPUBLIC": "🇨🇿",
    "GREECE": "🇬🇷", "TURKEY": "🇹🇷", "TURQUÍA": "🇹🇷", "RUSSIA": "🇷🇺",
    "SOUTH AFRICA": "🇿🇦", "EGYPT": "🇪🇬", "SAUDI ARABIA": "🇸🇦", "UNITED ARAB EMIRATES": "🇦🇪",
    "UAE": "🇦🇪", "ISRAEL": "🇮🇱", "CHILE": "🇨🇱", "COLOMBIA": "🇨🇴",
    "PERU": "🇵🇪", "ECUADOR": "🇪🇨", "URUGUAY": "🇺🇾", "VENEZUELA": "🇻🇪",
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "ignore")


def next_migration():
    """Best-effort: pokecoord's hardcoded date, else previous + 14 days."""
    try:
        html = fetch(PAGE)
        m = re.search(r"nextMigrationDate\s*=\s*new Date\('([^']+)'\)", html)
        if m:
            dt = datetime.datetime.fromisoformat(m.group(1).replace("Z", "+00:00"))
            return dt.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        pass
    base = MIGRATION_FALLBACK
    try:
        old = json.load(open(OUT, encoding="utf-8"))
        if old.get("migration"):
            base = old["migration"]
    except Exception:
        pass
    dt = datetime.datetime.fromisoformat(base.replace("Z", "+00:00"))
    now = datetime.datetime.now(datetime.timezone.utc)
    while dt <= now:
        dt += datetime.timedelta(days=MIGRATION_DAYS)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def main():
    try:
        data = json.loads(fetch(API))
    except Exception as e:
        # Keep previous data — a dead upstream must not break Pages.
        print(f"::error::pokecoord API unreachable ({e}) — keeping previous nests.json")
        sys.exit(0)

    nests, seen = [], set()
    for it in data:
        try:
            lat, lng = [float(x.strip()) for x in it["coordinates"].split(",")]
        except Exception:
            continue
        dex = int(it.get("pokemon_number") or 0)
        pokemon = (it.get("pokemon_name") or it.get("location_name") or "?").strip()
        country = (it.get("country") or "").strip().upper()
        key = (dex, round(lat, 4), round(lng, 4))
        if key in seen:
            continue
        seen.add(key)
        nests.append({
            "pokemon": pokemon,
            "dex": dex,
            "country": country,
            "flag": FLAGS.get(country, "🌍"),
            "lat": round(lat, 4),
            "lng": round(lng, 4),
            "stardust": STARDUST.get(dex),
            "source": "pokecoord",
        })

    # Stardust boosters first, then alphabetical — matches the app's default
    # "Stardust" filter (Combee & friends on top).
    nests.sort(key=lambda n: (0 if n["stardust"] else 1, n["pokemon"].lower(), n["country"]))
    out = {
        "fetched_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "migration": next_migration(),
        "nests": nests,
    }
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    os.replace(tmp, OUT)
    boosted = sum(1 for n in nests if n["stardust"])
    print(f"OK: {len(nests)} nests ({boosted} stardust-boosted) -> docs/nests.json (migration {out['migration']})")


if __name__ == "__main__":
    main()
