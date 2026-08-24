#!/usr/bin/env python3
"""Translate PoGo event summaries & full details EN -> BM via DeepSeek API.

Reads docs/event_summaries.json + docs/details.json and fills in the missing
Bahasa Melayu fields:
  * summary_ms  — translated when missing (new events).
  * detail_ms   — translated when missing, or when the EN detail was
                  re-fetched (translated_at older than fetched_at).

Requires DEEPSEEK_API_KEY (env). When the key is absent the script does
nothing and exits 0, so the site still ships with English-only content and
the app falls back to English — the translation step is best-effort.

Long details are split at <h2> section boundaries so each API call stays
well under the model's output limit and tag structure survives intact.
"""
import json, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SUM = os.path.join(HERE, "..", "docs", "event_summaries.json")
DET = os.path.join(HERE, "..", "docs", "details.json")

API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
API_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/") + "/chat/completions"
MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

SYSTEM = (
    "You are a professional translator for a Pokémon GO event app. "
    "Translate the visible text of the given HTML fragment from English into "
    "natural, casual Bahasa Melayu (the register used on Malaysian social media, "
    "using 'anda' for formality). "
    "STRICT RULES: keep every HTML tag, attribute, URL, and image src EXACTLY "
    "as-is — translate only text content; do NOT translate Pokémon names, "
    "item names, move names, location names, or English proper nouns; keep "
    "numbers, dates and times in their original format. "
    "Output ONLY the translated HTML — no commentary, no markdown fences."
)


def api_call(text):
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": text},
        ],
        "temperature": 0.3,
        "max_tokens": 8192,
        "stream": False,
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + API_KEY},
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        body = json.loads(r.read().decode("utf-8"))
    return body["choices"][0]["message"]["content"].strip()


def split_sections(html):
    """Split HTML at <h2 ...> boundaries: [before-first-h2, section1, section2, ...]."""
    parts = re.split(r'(?=<h2[ >])', html)
    return [p for p in parts if p.strip()]


def translate_html(html):
    """Translate an HTML fragment. Long fragments are split by <h2> sections
    and translated one call per section, then re-joined."""
    sections = split_sections(html)
    if len(sections) <= 1:
        return api_call(html)
    out = []
    for sec in sections:
        out.append(api_call(sec))
        time.sleep(0.3)
    return "".join(out)


def main():
    if not API_KEY:
        print("DEEPSEEK_API_KEY not set — skipping BM translation (site ships EN only)")
        return 0
    if not os.path.exists(SUM) or not os.path.exists(DET):
        print("summaries/details files missing — nothing to translate")
        return 0
    summaries = json.load(open(SUM, encoding="utf-8"))
    details = json.load(open(DET, encoding="utf-8"))
    now = datetime_iso()

    done_sum = 0
    done_det = 0
    failed = []

    # --- summary_ms (short intro) ---
    for slug in list(summaries.keys()):
        ent = summaries[slug]
        if ent.get("summary_ms") or not ent.get("summary"):
            continue
        try:
            ent["summary_ms"] = translate_html(ent["summary"])
            done_sum += 1
            time.sleep(0.3)
        except Exception as e:
            failed.append(f"summary:{slug} ({e})")
        if done_sum % 5 == 0 and done_sum:
            save(summaries, details)

    # --- detail_ms (full detail HTML) ---
    for slug in list(details.keys()):
        ent = details[slug]
        if not ent.get("detail"):
            continue
        stale = not ent.get("detail_ms") or (ent.get("translated_at") or "") < (ent.get("fetched_at") or "")
        if not stale:
            continue
        try:
            ent["detail_ms"] = translate_html(ent["detail"])
            ent["translated_at"] = now
            done_det += 1
            time.sleep(0.3)
        except Exception as e:
            failed.append(f"detail:{slug} ({e})")
        if done_det % 3 == 0 and done_det:
            save(summaries, details)

    save(summaries, details)
    missing_sum = [s for s in summaries if not summaries[s].get("summary_ms")]
    missing_det = [s for s in details if not details[s].get("detail_ms")]
    print(f"OK: {done_sum} summaries + {done_det} details translated to BM")
    if missing_sum:
        print(f"  {len(missing_sum)} summaries still missing BM: {', '.join(missing_sum[:5])}{'…' if len(missing_sum) > 5 else ''}")
    if missing_det:
        print(f"  {len(missing_det)} details still missing BM: {', '.join(missing_det[:5])}{'…' if len(missing_det) > 5 else ''}")
    if failed:
        print(f"  {len(failed)} failed: {'; '.join(failed[:5])}")
    return 0


def datetime_iso():
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def save(summaries, details):
    with open(SUM, "w", encoding="utf-8") as f:
        json.dump(summaries, f, ensure_ascii=False, indent=1)
    with open(DET, "w", encoding="utf-8") as f:
        json.dump(details, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    sys.exit(main())
