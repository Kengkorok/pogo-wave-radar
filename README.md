<div align="center">

# 🌊 PoGo Wave Radar

**Jangan terlepas event Pokémon GO lagi.** Chase ombak event ikut zon waktu — pilih bandar, salin koordinat, spoof!

[![Live Site](https://img.shields.io/badge/🌊-Buka_App-blueviolet?style=for-the-badge)](https://kengkorok.github.io/pogo-wave-radar/)
![Last Scrape](https://img.shields.io/github/last-commit/kengkorok/pogo-wave-radar?style=for-the-badge&label=Event+Update)
[![License](https://img.shields.io/github/license/kengkorok/pogo-wave-radar?style=for-the-badge)](LICENSE)

</div>

## Apa ni?

Event Pokémon GO yang ikut **waktu tempatan** (Community Day 2–5pm, Raid Day 11am–5pm, Spotlight Hour 6–7pm) bukan berlaku serentak seluruh dunia — ia bergerak macam **ombak** dari Kiribati → Jepun → Malaysia → Eropah → Brazil → US.

Kalau event dah habis kat tempat kau, **kemungkinan besar masih live kat tempat lain.** App ni tunjuk:

- 🔥 **Live Sekarang** — event mana tengah live & bandar mana nak spoof (dengan koordinat siap-siap)
- 🌊 **Wave Tracker** — pilih satu event, nampak ombak bergerak bandar demi bandar, masa window tempatan + koordinat
- 📅 **Semua Event** — full schedule dari leekduck

Data auto-update dari [leekduck.com/events](https://leekduck.com/events/) setiap **30 minit** melalui GitHub Actions.

## 📲 Guna kat phone

1. Buka [kengkorok.github.io/pogo-wave-radar](https://kengkorok.github.io/pogo-wave-radar/)
2. Chrome/Android: **Add to Home screen** → install sebagai app
3. Set zon kau (auto-detect biasanya dah betul)
4. Event live → tekan bandar → **📋 salin koordinat** → paste kat GPS Joystick

## ☕ Support

App ni free & takde iklan. Kalau app ni membantu korang tak terlepas event, boleh belanja aku kopi:

| Platform | Sesuai untuk | Pautan |
|---|---|---|
| **Ko-fi** ⭐ | Semua orang (international) — payout via PayPal | [ko-fi.com/kengkorok](https://ko-fi.com/kengkorok) |
| PayPal | Terus ke PayPal | *(set dalam `docs/config.js`)* |
| TNG / DuitNow QR | Rakan-rakan Malaysia — zero fee | *(set dalam `docs/config.js`)* |

<a href="https://ko-fi.com/kengkorok" target="_blank"><img height="48" src="https://storage.ko-fi.com/cdn/brandasset/kofi_s_tag_white.png" alt="Buy Me a Coffee at ko-fi.com" /></a>

> **Nak set link kau sendiri?** Edit `docs/config.js` — semua butang app & README baca dari situ.

## 🛠 Dev

```bash
# Scrape leekduck sekali
python scripts/scrape_events.py      # -> docs/events.json

# Serve app tempatan
cd docs && python -m http.server 8000
# buka http://localhost:8000
```

### Struktur

```
scripts/scrape_events.py     # Python scraper (leekduck -> events.json)
docs/                        # GitHub Pages site
  index.html  app.js  style.css  config.js  cities.json
  events.json                # di-generate oleh GitHub Actions
.github/workflows/scrape.yml # cron setiap 30 minit
```

### Bandar utama (19 lokasi)

Kiribati · Auckland · Sydney · Tokyo · Nagoya · Osaka · Seoul · KLCC · Marina Bay Sands · Dubai · Izmir · Larissa · Budapest · Seville · Zaragoza · São Paulo · Chancay · New York · California (LA)

Nak tambah/tukar bandar? Edit `docs/cities.json` (nama, IANA timezone, lat/lng).

## ⚠️ Disclaimer

Guna pada risiko sendiri. Hormati cooldown & syarat Niantic — kekalkan fair play. App ni bukan dari Niantic, tak bergabung, dan tak diluluskan oleh Niantic.

## License

MIT
