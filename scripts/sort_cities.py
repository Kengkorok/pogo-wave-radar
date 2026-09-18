#!/usr/bin/env python3
"""Keep docs/cities.json in wave order — UTC offset descending (Kiribati → Hawaii).

The wave tracker lists cities in file order, so the file itself is the wave: the
easternmost city (UTC+14) must come first and Hawaii (UTC-10) last. Cities sharing an
offset keep their existing relative order (stable sort), so hand-tuned groupings
(Tokyo/Nagoya/Osaka/Seoul, the three European +2s…) are never shuffled.

Run after adding or editing a city:  python scripts/sort_cities.py
"""
import json
import os
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
CITIES = os.path.join(HERE, "..", "docs", "cities.json")


def offset_minutes(tz: str, when: datetime) -> int:
    off = when.astimezone(ZoneInfo(tz)).utcoffset()
    return int(off.total_seconds() // 60)


def main() -> int:
    with open(CITIES, encoding="utf-8") as f:
        cities = json.load(f)
    ref = datetime.now(timezone.utc)
    # stable sort: same offset -> original file order is preserved
    ordered = sorted(cities, key=lambda c: -offset_minutes(c["tz"], ref))
    if ordered == cities:
        print("cities.json already in wave order")
    else:
        with open(CITIES, "w", encoding="utf-8") as f:
            json.dump(ordered, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print("reordered cities.json")
    for i, c in enumerate(ordered):
        m = offset_minutes(c["tz"], ref)
        print(f"{i:2d} UTC{m // 60:+03d}:{abs(m) % 60:02d}  {c['name']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
