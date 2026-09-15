#!/usr/bin/env python3
"""Build docs/citysafari.json — Pokemon GO City Safari in-person events.

Two data sources:
  * Curated event facts (dates, local window, price, timezone, summaries) from the
    official pages https://pokemongo.com/en/featured-in-person-events/citysafari/<city>
  * Hotspot coordinates: densest OSM POI clusters (best public proxy for Pokestop /
    gym density). `--scan` refreshes the Overpass POI cache, otherwise the cached
    dump is reused and every hotspot gets a POI count within 330 m.

Usage:
  python scripts/build_citysafari.py                 # use ./hotspot_cache if present
  python scripts/build_citysafari.py --scan          # re-query Overpass first
  python scripts/build_citysafari.py --cache DIR     # custom cache dir
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
import collections
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "docs", "citysafari.json")
DEFAULT_CACHE = os.path.join(HERE, "..", ".hotspot-cache")

MIRRORS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
OVERPASS_TPL = """[out:json][timeout:180];
(
  node["amenity"~"^(restaurant|cafe|bar|fast_food|pub|bench|drinking_water|theatre|cinema|fountain|place_of_worship|marketplace|bus_station|ferry_terminal|arts_centre|library)$"]({b});
  node["shop"]({b});
  node["tourism"]({b});
  node["historic"]({b});
  node["leisure"~"^(park|garden|playground|pitch|sports_centre|fitness_centre|common)$"]({b});
  node["artwork"]({b});
  node["railway"~"^(station|tram_stop|subway_entrance)$"]({b});
  node["highway"="bus_stop"]({b});
);
out body;
"""
POI_RADIUS_M = 330

EVENT_DAYS = ["2026-09-26", "2026-09-27"]
EVENT_START = "10:00"
EVENT_END = "18:00"
SOURCE_BASE = "https://pokemongo.com/en/featured-in-person-events/citysafari/"

SUMMARY_COMMON_EN = (
    "Explorer-hat Eevee from the City Safari Special Research (evolves into any Eeveelution), "
    "an 8-stamp City Safari Stamp Rally at highlighted Pokestops (one Eevee per stamp), "
    "event-only wild spawns (Mudbray debut, Unown B/L/M/R, Hawlucha, Oranguru, Komala, Flamigo) "
    "plus 7 km eggs (Flabébé Orange Flower, Hawlucha, Mudbray, Komala) and exclusive Field Research. "
    "Ticket perks: boosted shiny odds, 4-hour Lures, 5 special trades a day at half Stardust, "
    "Tiny Compass buddy souvenir, 8-hour Party Play."
)
SUMMARY_COMMON_MS = (
    "Eevee bertopi explorer dari Special Research (boleh evolve jadi mana-mana Eeveelution), "
    "Stamp Rally 8 stamp kat Pokestop bertanda (1 Eevee setiap stamp), spawn eksklusif "
    "(Mudbray debut, Unown B/L/M/R, Hawlucha, Oranguru, Komala, Flamigo), telur 7 km, dan Field Research khas. "
    "Bonus tiket: shiny rate naik, Lure 4 jam, 5 special trade sehari separuh Stardust, "
    "souvenir Tiny Compass, Party Play 8 jam."
)

# name, country, flag, tz, tz abbreviation, city-centre lat/lng, price, addon prices, Overpass bbox
CITY_META = {
    "brisbane": dict(
        city="Brisbane", country="Australia", flag="img/flags/au.svg",
        tz="Australia/Brisbane", tzAbbr="AEST", lat=-27.4698, lng=153.0251,
        price="AU$17.00", ticket="AU$17.00", addons=[("Raid Lover", "AU$8.00"), ("Egg-thusiast", "AU$8.00"), ("Extra Day", "AU$12.00")],
        bbox=(-27.58, 152.92, -27.38, 153.14),
        hotspots=[
            ("Queen Street Mall / Brisbane CBD", -27.46900, 153.02600, "Central Pokestop wall — mall + King George Square, best all-day lure cluster.", "Pusat Pokestop — mall + King George Square, cluster lure terbaik."),
            ("University of Queensland (St Lucia)", -27.49750, 153.01340, "Campus-wide gym/stop density — the classic Brisbane grind spot.", "Seluruh kampus padat gym/stop — spot grind klasik Brisbane."),
            ("Fortitude Valley (Brunswick Street)", -27.45750, 153.03450, "Chinatown + Brunswick St strip, dense stops and gyms.", "Chinatown + jalur Brunswick St, stop & gym padat."),
            ("South Bank Parklands (Grey St & Streets Beach)", -27.47800, 153.01900, "Riverside gardens, beach and Cultural Centre — walkable loop.", "Taman tepi sungai, beach & Cultural Centre — loop senang jalan."),
            ("West End (Boundary Street)", -27.48000, 153.00700, "Cafes, markets, Boundary St stops — relaxed grind + good coffee.", "Kafe, market, stop Boundary St — grind santai + kopi sedap."),
        ],
    ),
    "boston": dict(
        city="Boston", country="USA", flag="img/flags/us.svg",
        tz="America/New_York", tzAbbr="EDT", lat=42.3601, lng=-71.0589,
        price="US$10.00", ticket="US$10.00", addons=[("Raid Lover", "US$6.00"), ("Egg-thusiast", "US$6.00"), ("Extra Day", "US$8.00")],
        bbox=(42.31, -71.18, 42.41, -70.99),
        hotspots=[
            ("Downtown Crossing", 42.35400, -71.06300, "Washington St shopping core — densest stop cluster in downtown.", "Terus Washington St shopping — cluster stop paling padat di downtown."),
            ("Boston Common & Public Garden", 42.35500, -71.07200, "Park loops full of stops, spawns + gyms, spawn-heavy in the morning.", "Loop taman penuh stop, spawn & gym, paling padat pagi."),
            ("Faneuil Hall / Quincy Market", 42.36100, -71.05400, "Historic market halls, tourist crowd = heavy lures.", "Dewan pasar bersejarah, crowd pelancong = lure banyak."),
            ("Copley Square / Back Bay", 42.34900, -71.07900, "Trinity Church, library, Newbury St — prime downtown grind.", "Trinity Church, library, Newbury St — grind downtown terbaik."),
            ("Harvard Square (Cambridge)", 42.37500, -71.11900, "Legendary stop/gym density, most reliable hotspot in Greater Boston.", "Kepadatan stop/gym legenda, hotspot paling reliable di Greater Boston."),
            ("Kendall Square / MIT (Cambridge)", 42.36200, -71.08700, "MIT campus edge + Kendall labs, high stop & gym count.", "Tepi kampus MIT + Kendall lab, stop & gym banyak."),
        ],
    ),
    "lisbon": dict(
        city="Lisbon", country="Portugal", flag="img/flags/pt.svg",
        tz="Europe/Lisbon", tzAbbr="WEST", lat=38.7223, lng=-9.1393,
        price="€10.00", ticket="€10.00", addons=[("Raid Lover", "€6.00"), ("Egg-thusiast", "€6.00"), ("Extra Day", "€8.00")],
        bbox=(38.69, -9.24, 38.79, -9.09),
        hotspots=[
            ("Baixa–Chiado (Rua Augusta & Rua do Carmo)", 38.71150, -9.13950, "Densest stop cluster in Lisbon — pedestrian shopping grid, lures everywhere.", "Cluster stop paling padat di Lisbon — grid shopping pedestrian, lure merata."),
            ("Alfama / Castelo de São Jorge", 38.71390, -9.13350, "Old-town hillside, viewpoints and tram stops — big spawn volume.", "Bandar lama atas bukit, miradouro & stop tram — spawn banyak."),
            ("Bairro Alto / Príncipe Real", 38.71500, -9.14700, "Night-life + garden stops, strong evening cluster.", "Hiburan malam + taman, cluster petang/malam kuat."),
            ("Cais do Sodré / Time Out Market", 38.70670, -9.14580, "Riverfront market & ferry terminal, busy all day.", "Market tepi sungai & terminal feri, ramai sepanjang hari."),
            ("Praça do Comércio (Terreiro do Paço)", 38.70770, -9.13640, "Iconic square by the river, easy walking loop to Alfama.", "Dataran ikonik tepi sungai, senang loop jalan ke Alfama."),
            ("Belém (Mosteiro dos Jerónimos)", 38.69790, -9.20650, "Monastery + tower + pastéis — tourist cluster, thinner stops but worth a pass.", "Monasteri + menara + pastel — cluster pelancong, stop kurang tapi berbaloi."),
        ],
    ),
    "marseille": dict(
        city="Marseille", country="France", flag="img/flags/fr.svg",
        tz="Europe/Paris", tzAbbr="CEST", lat=43.2965, lng=5.3698,
        price="€10.00", ticket="€10.00", addons=[("Raid Lover", "€6.00"), ("Egg-thusiast", "€6.00"), ("Extra Day", "€8.00")],
        bbox=(43.25, 5.29, 43.34, 5.42),
        hotspots=[
            ("Vieux-Port / Quai des Belges", 43.29510, 5.37440, "Old harbour quays — densest cluster in Marseille, fish market + ferry stops.", "Kes tepi pelabuhan lama — cluster paling padat di Marseille, pasar ikan + stop feri."),
            ("Cours Julien / Noailles", 43.29450, 5.38150, "Street-art quarter, cafes and market streets — second-densest cluster.", "Kawasan street-art, kafe & jalan pasar — cluster kedua padat."),
            ("La Canebière / Réformés", 43.29750, 5.37900, "Main avenue between Vieux-Port and station, non-stop stops.", "Jalan utama antara Vieux-Port & stesen, stop tak putus."),
            ("Le Panier / Vieux-Port north quay", 43.29650, 5.37100, "Oldest quarter, narrow lanes full of stops and gyms.", "Kawasan tertua, lorong sempit penuh stop & gym."),
            ("La Joliette / Les Docks", 43.30450, 5.36700, "Waterfront redevelopment + MuCEM walk, quieter but steady.", "Tepi air baru + jalan ke MuCEM, sunyi sikit tapi stabil."),
            ("Castellane / Cours Pierre Puget", 43.28800, 5.38250, "Roundabout hub linking Prado, beaches and Notre-Dame de la Garde.", "Hub bulatan sambung Prado, pantai & Notre-Dame de la Garde."),
        ],
    ),
    "munich": dict(
        city="Munich", country="Germany", flag="img/flags/de.svg",
        tz="Europe/Berlin", tzAbbr="CEST", lat=48.1374, lng=11.5755,
        price="€10.00", ticket="€10.00", addons=[("Raid Lover", "€6.00"), ("Egg-thusiast", "€6.00"), ("Extra Day", "€8.00")],
        bbox=(48.09, 11.47, 48.19, 11.68),
        hotspots=[
            ("Marienplatz / Viktualienmarkt", 48.13740, 11.57550, "Highest density in Munich — old-town core, lures + gyms all day.", "Kepadatan tertinggi di Munich — pusat bandar lama, lure & gym sepanjang hari."),
            ("Gärtnerplatz / Isarvorstadt", 48.13140, 11.57550, "Cafe-packed quarter just south of the old town.", "Kawasan penuh kafe di selatan bandar lama."),
            ("Odeonsplatz / Hofgarten", 48.14230, 11.57730, "Gate to the Englischer Garten — big stop field, easy loops.", "Pintu masuk Englischer Garten — medan stop luas, senang loop."),
            ("Hauptbahnhof / Stachus", 48.14020, 11.56100, "Station + Karlsplatz shopping strip, constant traffic of players.", "Stesen + jalur shopping Karlsplatz, player lalu-lalang."),
            ("Schwabing / Münchner Freiheit", 48.16000, 11.58700, "Student quarter + Englischer Garten north — long grind route.", "Kawasan pelajar + Englischer Garten utara — route grind panjang."),
            ("Theresienwiese (Oktoberfest grounds)", 48.13200, 11.54900, "Only a few stops, but if Oktoberfest 2026 is still running (19 Sep–4 Oct) the Wiesn crowd makes it the liveliest lure spot in town.", "Stop sikit je, tapi kalau Oktoberfest 2026 masih jalan (19 Sep–4 Okt) crowd Wiesn buat tempat ni paling meriah."),
        ],
    ),
    "rio-de-janeiro": dict(
        city="Rio de Janeiro", country="Brazil", flag="img/flags/br.svg",
        tz="America/Sao_Paulo", tzAbbr="BRT", lat=-22.9068, lng=-43.1729,
        price="R$38.00", ticket="R$38.00", addons=[("Raid Lover", "R$23.00"), ("Egg-thusiast", "R$23.00"), ("Extra Day", "R$30.00")],
        bbox=(-23.01, -43.27, -22.86, -43.11),
        hotspots=[
            ("Cinelândia / Av. Rio Branco (Centro)", -22.90800, -43.17600, "Top density in Rio — theatre square, museums, wide avenue of stops.", "Kepadatan tertinggi di Rio — dataran teater, muzium, avenue penuh stop."),
            ("Candelária / Praça XV (Centro histórico)", -22.90250, -43.17500, "Colonial streets, ferry terminal, pack of gyms.", "Jalan kolonial, terminal feri, banyak gym."),
            ("Uruguaiana / Saara market", -22.90600, -43.18200, "Busy market grid — cheap grind with constant spawns.", "Grid pasar sibuk — grind murah, spawn tak berhenti."),
            ("Flamengo / Aterro do Flamengo", -22.92800, -43.17500, "Park strip along the bay — walkable stop/gym chain.", "Taman sepanjang teluk — rantaian stop/gym senang jalan."),
            ("Lapa / Escadaria Selarón", -22.91350, -43.17950, "Arches + famous steps, night crowd with heavy lures.", "Arcos + tangga terkenal, crowd malam dengan lure banyak."),
            ("Copacabana & Leme beach", -22.96450, -43.17800, "Posto 1–4 promenade — iconic beach loop, gyms at every posto.", "Promenade Posto 1–4 — loop pantai ikonik, gym di setiap posto."),
        ],
    ),
}

# Event art (og:image) per city page
IMAGES = {
    "brisbane": "https://lh3.googleusercontent.com/pfmQwowEancYRhhAC8W9PnYllGycWzZxU3tvtZOAhe2prk4cu0bKVTbY4NWBgFCnyByzJINEPG7lvPJHsEeGF83m2QJotvZe-pyGZWxl95fO",
    "boston": "https://lh3.googleusercontent.com/5SAHXmMPUCpY_TUiDA81oiN00LXrIbsOXN9CTFtZbjI4pz_0RbQr0tmSACr1JErfEvZqM131RfCU8-LA2uskPRaP7YAom1uS216jhW_JpQ",
    "lisbon": "https://lh3.googleusercontent.com/OM6SsjLLeDXEFU9WeJV5mgRhfNeN93NhtA98dvUbWn08auFfoPxVwMpe3eYmNz306ZLH9lRlNA1FjYgSXa7FxgbXORo4LJJL2CE1zkeLatw",
    "marseille": "https://lh3.googleusercontent.com/y8H0LP2rL5dOxzgrQ3JI0MtULQDWCADx97DGeRcO8TM_fqI9ft93DKdiO4meMIkx-Fbqd6coqwto0dYH9hUg6G3hJLIBS1DoU4WNDjGc-Mo",
    "munich": "https://lh3.googleusercontent.com/-yL57uAK3PNb2YrfNtHuqAA85NzRiXDUtk3s4hktZz_9EDjFJLea0IpVk0J7n7eFmw0STTJvOaTEUJ5zNy10rsvp-Ppyprqisk1ckji82z8",
    "rio-de-janeiro": "https://lh3.googleusercontent.com/v4ipgzZkv2FsEUCH_7xW6ecciRiBHgddJfqQmhhXT9hWXsWbkWmW2e-RGhUm6n2_ve6U6Jipmeutbq8AVIDhKCaHHYjJRL8HxOvzRmEw26s",
}


def scan(cache_dir: str, keys=None) -> None:
    os.makedirs(cache_dir, exist_ok=True)
    for slug, meta in CITY_META.items():
        if keys and slug not in keys:
            continue
        path = os.path.join(cache_dir, slug + ".json")
        if os.path.exists(path):
            print("cache hit", slug, file=sys.stderr)
            continue
        b = "%s,%s,%s,%s" % meta["bbox"]
        body = urllib.parse.urlencode({"data": OVERPASS_TPL.replace("{b}", b)}).encode()
        for mirror in MIRRORS:
            try:
                req = urllib.request.Request(mirror, data=body, headers={"User-Agent": "pogo-wave-radar/1.0 hotspot-density"})
                with urllib.request.urlopen(req, timeout=300) as r:
                    data = json.load(r)
                pois = [{"lat": e["lat"], "lng": e["lon"]} for e in data.get("elements", []) if e.get("type") == "node"]
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(pois, f)
                print("scanned", slug, len(pois), file=sys.stderr)
                break
            except Exception as ex:  # noqa: BLE001
                print("fail", slug, mirror, repr(ex)[:160], file=sys.stderr)
                time.sleep(20)
        time.sleep(5)


def poi_counts(cache_dir: str, slug: str, hotspots) -> list:
    # 1) explicit per-hotspot Overpass counts (small, exact) win
    cpath = os.path.join(cache_dir, slug + ".counts.json")
    if os.path.exists(cpath):
        with open(cpath, encoding="utf-8") as f:
            saved = json.load(f)
        return [saved.get(str(i)) for i in range(len(hotspots))]
    path = os.path.join(cache_dir, slug + ".json")
    if not os.path.exists(path):
        return [None] * len(hotspots)
    with open(path, encoding="utf-8") as f:
        pois = json.load(f)
    if isinstance(pois, dict):          # scan dump: {city, bbox, pois:[...]}
        pois = pois.get("pois", [])
    dlat = POI_RADIUS_M / 111320.0
    out = []
    for (_n, lat, lng, _t, _tm) in hotspots:
        dlng = POI_RADIUS_M / (111320.0 * max(0.2, math.cos(math.radians(lat))))
        cnt = 0
        for p in pois:
            plat = p.get("lat", p.get("y"))
            plng = p.get("lng", p.get("lon", p.get("x")))
            if plat is None or plng is None:
                continue
            if abs(plat - lat) <= dlat and abs(plng - lng) <= dlng:
                cnt += 1
        out.append(cnt)
    return out


def verify(cache_dir: str, keys=None) -> None:
    """Exact per-hotspot POI count: one small `out count` query per hotspot."""
    os.makedirs(cache_dir, exist_ok=True)
    for slug, meta in CITY_META.items():
        if keys and slug not in keys:
            continue
        out = {}
        for i, (name, lat, lng, _t, _tm) in enumerate(meta["hotspots"]):
            d = 0.0035
            b = "%.5f,%.5f,%.5f,%.5f" % (lat - d, lng - d, lat + d, lng + d)
            q = OVERPASS_TPL.replace("{b}", b).replace("out body;", "out count;")
            body = urllib.parse.urlencode({"data": q}).encode()
            got = None
            for mirror in MIRRORS:
                try:
                    req = urllib.request.Request(mirror, data=body, headers={"User-Agent": "pogo-wave-radar/1.0 hotspot-density"})
                    with urllib.request.urlopen(req, timeout=180) as r:
                        data = json.load(r)
                    got = int(data["elements"][0]["tags"]["total"])
                    break
                except Exception as ex:  # noqa: BLE001
                    print("verify fail", slug, name, repr(ex)[:120], file=sys.stderr)
                    time.sleep(10)
            out[str(i)] = got
            print("verify", slug, name, got, file=sys.stderr)
            time.sleep(2)
        with open(os.path.join(cache_dir, slug + ".counts.json"), "w", encoding="utf-8") as f:
            json.dump(out, f)


def build(cache_dir: str, keys=None):
    events = []
    for slug, meta in CITY_META.items():
        if keys and slug not in keys:
            continue
        counts = poi_counts(cache_dir, slug, meta["hotspots"])
        hotspots = []
        for (name, lat, lng, tip, tip_ms), cnt in zip(meta["hotspots"], counts):
            h = {"name": name, "lat": round(lat, 5), "lng": round(lng, 5), "tip": tip, "tip_ms": tip_ms}
            if cnt:
                h["pois"] = cnt
            hotspots.append(h)
        events.append({
            "slug": "city-safari-" + slug + "-2026",
            "city": meta["city"], "country": meta["country"], "flag": meta["flag"],
            "tz": meta["tz"], "tzAbbr": meta["tzAbbr"],
            "lat": meta["lat"], "lng": meta["lng"],
            "days": EVENT_DAYS, "start": EVENT_START, "end": EVENT_END,
            "price": meta["price"], "addons": [{"name": n, "price": p} for n, p in meta["addons"]],
            "img": IMAGES.get(slug), "url": SOURCE_BASE + slug,
            "summary": "Pokémon GO City Safari %s, %s: 26-27 Sep 2026, 10:00-18:00 %s, citywide (ticket only). %s" % (
                meta["city"], "Australia" if slug == "brisbane" else meta["country"], meta["tzAbbr"], SUMMARY_COMMON_EN),
            "summary_ms": "Pokémon GO City Safari %s, %s: 26-27 Sep 2026, 10:00-18:00 %s, seluruh bandar (kena tiket). %s" % (
                meta["city"], meta["country"], meta["tzAbbr"], SUMMARY_COMMON_MS),
            "hotspots": hotspots,
        })
    events.sort(key=lambda e: e["slug"])
    doc = {
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": SOURCE_BASE,
        "poi_radius_m": POI_RADIUS_M,
        "poi_note": "pois = OSM POIs within 330 m (proxy for Pokestop/gym density)",
        "events": events,
    }
    out = os.path.abspath(OUT)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print("wrote", out, len(events), "events", sum(len(e["hotspots"]) for e in events), "hotspots")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scan", action="store_true", help="re-query Overpass for the POI cache")
    ap.add_argument("--verify", action="store_true", help="exact Overpass POI count per hotspot")
    ap.add_argument("--cache", default=DEFAULT_CACHE)
    ap.add_argument("--city", action="append", help="limit to a city slug")
    a = ap.parse_args()
    if a.scan:
        scan(a.cache, a.city)
    if a.verify:
        verify(a.cache, a.city)
    build(a.cache, a.city)


if __name__ == "__main__":
    main()
