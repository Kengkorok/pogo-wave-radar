#!/usr/bin/env python3
"""Scrape PoGo events from leekduck.com/events/ -> docs/events.json

Leekduck marks each event with:
  data-event-type, data-event-occurrence-id, data-event-local-time,
  data-event-start-date(-check), data-event-end-date, data-event-date-sort
Events appear TWICE on the page (Live section + Upcoming section) so we
dedupe by slug and merge start/end fields.

Event summaries (bonuses etc) come from each event's detail page
(div.event-description). They are cached in docs/event_summaries.json so
we only fetch a detail page once per slug (new slugs only).
"""
import json, os, re, sys, html as h, datetime, urllib.request, time

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
URL = "https://leekduck.com/events/"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "docs", "events.json")
SUM = os.path.join(HERE, "..", "docs", "event_summaries.json")

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "ignore")

def parse(raw):
    events = {}
    chunks = raw.split('<span class="event-header-item-wrapper" ')[1:]
    for chunk in chunks:
        chunk = chunk.split('</a></span>')[0] + '</a>'
        t = re.search(r'data-event-type="([^"]*)"', chunk)
        if not t:
            continue
        slug_m = re.search(r'href="/events/([^"]*)/"', chunk)
        slug = slug_m.group(1) if slug_m else ""
        if not slug:
            continue
        ev = events.setdefault(slug, {
            "slug": slug, "name": "", "type": t.group(1), "start": None,
            "end": None, "local_time": False, "img": None, "summary": None,
            "url": f"https://leekduck.com/events/{slug}/",
        })
        n = re.search(r'<h2>([^<]*)</h2>', chunk)
        if n and not ev["name"]:
            ev["name"] = h.unescape(n.group(1)).strip()
        lt = re.search(r'data-event-local-time="([^"]*)"', chunk)
        if lt:
            ev["local_time"] = lt.group(1) == "true"
        sd = re.search(r'data-event-start-date="([^"]*)"', chunk)
        if sd:
            ev["start"] = sd.group(1)
        if not ev["start"]:
            sd2 = re.search(r'data-event-start-date-check="([^"]*)"', chunk)
            if sd2:
                ev["start"] = sd2.group(1)
        ed = re.search(r'data-event-end-date="([^"]*)"', chunk)
        if ed:
            ev["end"] = ed.group(1)
        img = re.search(r'<img[^>]*src="([^"]*)"', chunk)
        if img and not ev["img"]:
            ev["img"] = img.group(1)
    out = []
    for ev in events.values():
        if not ev["start"] and not ev["end"]:
            continue
        out.append(ev)
    out.sort(key=lambda e: (e["start"] or e["end"] or ""))
    return out

def get_summary(slug):
    """Fetch event detail page and return div.event-description text."""
    try:
        raw = fetch(f"https://leekduck.com/events/{slug}/")
    except Exception:
        return None
    m = re.search(r'class="event-description">(.*?)</div>', raw, re.S)
    if not m:
        return None
    seg = re.sub(r'<[^>]+>', ' ', m.group(1))
    seg = h.unescape(re.sub(r'\s+', ' ', seg)).strip()
    return seg or None

def main():
    raw = fetch(URL)
    events = parse(raw)
    summaries = {}
    if os.path.exists(SUM):
        summaries = json.load(open(SUM, encoding="utf-8"))
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_fetched = 0
    for ev in events:
        slug = ev["slug"]
        if slug not in summaries:
            ev["summary"] = get_summary(slug)
            summaries[slug] = {"summary": ev["summary"], "fetched_at": now}
            new_fetched += 1
            time.sleep(0.4)
        else:
            ev["summary"] = summaries[slug].get("summary")
    data = {"fetched_at": now, "source": URL, "events": events}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    with open(SUM, "w", encoding="utf-8") as f:
        json.dump(summaries, f, ensure_ascii=False, indent=1)
    local = sum(1 for e in events if e["local_time"])
    have_sum = sum(1 for e in events if e["summary"])
    print(f"OK {len(events)} events ({local} local-time, {len(events)-local} UTC), {have_sum} summaries ({new_fetched} new) -> {os.path.abspath(OUT)}")

if __name__ == "__main__":
    sys.exit(main())
