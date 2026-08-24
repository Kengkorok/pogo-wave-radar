#!/usr/bin/env python3
"""Scrape PoGo events from leekduck.com/events/ -> docs/events.json

Leekduck marks each event with:
  data-event-type, data-event-occurrence-id, data-event-local-time,
  data-event-start-date(-check), data-event-end-date, data-event-date-sort
Events appear TWICE on the page (Live section + Upcoming section) so we
dedupe by slug and merge start/end fields.

Event summaries (short intro) come from each event's detail page
(div.event-description). They are cached in docs/event_summaries.json so
we only fetch a detail page once per slug (new slugs only, plus a 7-day
refresh so placeholder pages get filled in later).

FULL event details (Bonuses / Features / Spawns / Raids / Research / ...)
are also scraped from each detail page and written to docs/details.json as
sanitized HTML (safe tag/attribute subset, images from leekduck CDN kept).
The app lazy-loads details.json when the user opens the wave tracker.
"""
import json, os, re, sys, html as h, datetime, urllib.request, time

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
URL = "https://leekduck.com/events/"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "docs", "events.json")
SUM = os.path.join(HERE, "..", "docs", "event_summaries.json")
DET = os.path.join(HERE, "..", "docs", "details.json")
REFRESH_DAYS = 7  # re-fetch detail pages older than this (placeholder updates etc.)

# HTML tags we keep in the detail output. Everything else is stripped.
ALLOWED_TAGS = {
    "h2", "h3", "h4", "h5", "p", "ul", "ol", "li",
    "b", "strong", "i", "em", "u", "s", "small", "sup", "sub",
    "a", "img", "br", "hr", "span", "div", "blockquote",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
}
ALLOWED_ATTRS = {
    "a": {"href"},
    "img": {"src", "alt"},
    "th": {"colspan", "rowspan"},
    "td": {"colspan", "rowspan"},
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "ignore")


def balanced(raw, start, open_tag="<div", close_tag="</div>"):
    """Return the substring of `raw` starting at `start` through the matching
    close tag of the element that starts at `start`."""
    depth = 0
    i = start
    n = len(raw)
    while i < n:
        if raw.startswith(open_tag, i):
            depth += 1
            i += len(open_tag)
        elif raw.startswith(close_tag, i):
            depth -= 1
            i += len(close_tag)
            if depth == 0:
                return raw[start:i]
        else:
            i += 1
    return raw[start:]


def extract_region(raw):
    """Return the event content region: intro (event-description) through all
    detail sections, ending before the author box / article end. Starts at the
    opening tag of event-description so divs stay balanced."""
    a = raw.find('<div class="event-description">')
    if a == -1:
        a = raw.find('<article')
        if a == -1:
            return None
    ends = [p for p in [raw.find('<section class="author-box"'), raw.find('</article>')] if p != -1]
    b = min(ends) if ends else len(raw)
    return raw[a:b] if b > a else None


def strip_tag(raw, tagname):
    """Remove <tagname ...>...</tagname> blocks (balanced for divs)."""
    out = raw
    pat = re.compile(r'<' + tagname + r'[^>]*>', re.I)
    while True:
        m = pat.search(out)
        if not m:
            break
        seg = balanced(out, m.start(), '<' + tagname, '</' + tagname + '>') or m.group(0)
        out = out[:m.start()] + out[m.start() + len(seg):]
    return out


def remove_div_class(raw, cls):
    """Remove <div class="cls..."> blocks (balanced) — ads, TOC, etc."""
    out = raw
    pat = re.compile(r'<div class="' + re.escape(cls) + r'[^"]*"[^>]*>', re.I)
    while True:
        m = pat.search(out)
        if not m:
            break
        blk = balanced(out, m.start()) or m.group(0)
        out = out[:m.start()] + out[m.start() + len(blk):]
    return out


def sanitize_detail(seg):
    """Reduce LeekDuck detail HTML to a safe, app-styleable subset."""
    if not seg:
        return None
    # Drop non-content blocks first (balanced so nested markup is removed whole).
    for tag in ("script", "style", "svg", "iframe", "noscript", "nav", "form", "button", "input", "select", "template", "figure"):
        seg = strip_tag(seg, tag)
    # TOC navigation & ad slots (balanced div removal keeps the markup tidy).
    seg = remove_div_class(seg, "event-toc")
    for cls in ("ad-slot-group", "ad-slot", "ad-label", "display-ad"):
        seg = remove_div_class(seg, cls)
    # Drop the little section-header icons (events/icons/*.png).
    seg = re.sub(r'<img[^>]*src="[^"]*/events/icons/[^"]*"[^>]*>', '', seg, flags=re.I)

    # Tag/attribute whitelist pass.
    def fix(m):
        full = m.group(0)
        closing = full.startswith('</')
        name = re.match(r'</?\s*([a-zA-Z0-9]+)', full).group(1).lower()
        if name not in ALLOWED_TAGS:
            return ''
        if closing:
            return '</' + name + '>'
        attrs = {}
        for am in re.finditer(r'([a-zA-Z-]+)\s*=\s*"([^"]*)"', full):
            k, v = am.group(1).lower(), am.group(2)
            if k in ALLOWED_ATTRS.get(name, ()) and v:
                attrs[k] = v
        out = '<' + name
        if name == 'a' and 'href' in attrs:
            href = attrs['href'].strip()
            if href.startswith('/'):
                href = 'https://leekduck.com' + href
            if href.startswith(('http://', 'https://')):
                out += ' href="' + href + '" target="_blank" rel="noopener"'
        elif name == 'img' and 'src' in attrs:
            src = attrs['src'].strip()
            if src.startswith(('http://', 'https://')):
                out += ' src="' + src + '"'
                if 'alt' in attrs and attrs['alt'].strip():
                    out += ' alt="' + attrs['alt'].strip() + '"'
                out += ' loading="lazy"'
        elif name in ('th', 'td'):
            for k in ('colspan', 'rowspan'):
                if k in attrs and attrs[k].isdigit() and int(attrs[k]) > 1:
                    out += ' ' + k + '="' + attrs[k] + '"'
        out += '>'
        return out

    seg = re.sub(r'<[^>]+>', fix, seg)
    # Collapse whitespace between/around tags AND inside text nodes.
    seg = re.sub(r'>\s+<', '><', seg)
    seg = re.sub(r'\s+', ' ', seg)
    # Drop empty paragraphs / lone br runs.
    seg = re.sub(r'<p>\s*</p>', '', seg)
    seg = re.sub(r'(?:<br\s*/?>)+', '<br>', seg)
    # Balance any source-side unclosed <div>s (LeekDuck markup is occasionally sloppy).
    diff = seg.count('<div>') - seg.count('</div>')
    if diff > 0:
        seg += '</div>' * diff
    return seg.strip() or None


def text_only(seg):
    """Plain text of an HTML fragment (for the short summary)."""
    seg = re.sub(r'<script.*?</script>', ' ', seg, flags=re.S)
    seg = re.sub(r'<[^>]+>', ' ', seg)
    seg = h.unescape(re.sub(r'\s+', ' ', seg)).strip()
    return seg or None


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


def fetch_page_details(slug):
    """Fetch the event detail page once; return (summary_text, detail_html)."""
    try:
        raw = fetch(f"https://leekduck.com/events/{slug}/")
    except Exception:
        return None, None
    region = extract_region(raw)
    if not region:
        return None, None
    # Summary = text of the event-description div only (the intro).
    d = raw.find('<div class="event-description">')
    if d != -1:
        dseg = balanced(raw, d)
        summary = text_only(dseg)
    else:
        summary = text_only(region)
    detail = sanitize_detail(region)
    return summary, detail


def main():
    raw = fetch(URL)
    events = parse(raw)
    summaries = {}
    details = {}
    if os.path.exists(SUM):
        summaries = json.load(open(SUM, encoding="utf-8"))
    if os.path.exists(DET):
        details = json.load(open(DET, encoding="utf-8"))
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_fetched = 0
    refreshed = 0
    for ev in events:
        slug = ev["slug"]
        cur = summaries.get(slug, {})
        det = details.get(slug, {})
        old_fetch = cur.get("fetched_at") or det.get("fetched_at")
        need_refresh = False
        if old_fetch:
            try:
                need_refresh = (datetime.datetime.now(datetime.timezone.utc)
                                - datetime.datetime.fromisoformat(old_fetch)) > datetime.timedelta(days=REFRESH_DAYS)
            except Exception:
                need_refresh = False
        if slug not in summaries or slug not in details or need_refresh:
            summary, detail = fetch_page_details(slug)
            if summary is not None:
                summaries[slug] = {
                    "summary": summary,
                    "summary_ms": cur.get("summary_ms"),
                    "fetched_at": now,
                }
            if detail is not None:
                details[slug] = {
                    "detail": detail,
                    "detail_ms": det.get("detail_ms") if det.get("detail") == detail else None,
                    "fetched_at": now,
                }
            if slug not in summaries or slug not in details:
                new_fetched += 1
            else:
                refreshed += 1
            time.sleep(0.4)
        ev["summary"] = summaries.get(slug, {}).get("summary")
        ev["summary_ms"] = summaries.get(slug, {}).get("summary_ms")
    data = {"fetched_at": now, "source": URL, "events": events}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    with open(SUM, "w", encoding="utf-8") as f:
        json.dump(summaries, f, ensure_ascii=False, indent=1)
    with open(DET, "w", encoding="utf-8") as f:
        json.dump(details, f, ensure_ascii=False, indent=1)
    local = sum(1 for e in events if e["local_time"])
    have_sum = sum(1 for e in events if e["summary"])
    have_det = len(details)
    print(f"OK {len(events)} events ({local} local-time, {len(events)-local} UTC), "
          f"{have_sum} summaries ({new_fetched} new, {refreshed} refreshed), "
          f"{have_det} details -> {os.path.abspath(OUT)}")


if __name__ == "__main__":
    sys.exit(main())
