#!/usr/bin/env python3
"""One-off: add summary_ms (Bahasa Melayu) to docs/event_summaries.json"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
SUM = os.path.join(HERE, "..", "docs", "event_summaries.json")

MS = {
  "season-23-forever-forward": "Selamat datang ke Pokémon GO: Forever Forward! Season ialah tempoh yang membawakan event baru, debut Pokémon, dan kejutan bertema. Bila season bertukar, Pokémon berbeza akan muncul di kawasan anda dan menetas dari Telur. Pastikan anda meneroka sepanjang season ini.",
  "lego-pokemon-go-2026": "Kerjasama Pokémon GO dan LEGO Group diteruskan untuk Trainer di US, UK, Poland, Perancis, Jerman, dan Australia! Kunjungi kedai LEGO yang menyertai untuk raid, stamp rally bertema LEGO, sticker event, dan LEGO Pokémon SMART Play. Event LEGO Stores dan Pokémon GO akan berlangsung dari tarikh tersebut.",
  "go-pass-august-2026": "Lucky Trinket kembali dan Latias terbang masuk ke GO Pass: August! GO Pass dan GO Pass Deluxe untuk Ogos tersedia dari 4 Ogos 2026, 10:00 pagi hingga 8 September 2026, 10:00 pagi waktu tempatan.",
  "shadow-giratina-altered-in-shadow-raids-august-2026": "Shadow Giratina (Altered Forme) bakal buat debut Shadow Raid dalam Pokémon GO! Kalau bernasib baik, anda boleh jumpa Shiny Shadow Giratina (Altered Forme)! Shadow Giratina (Altered Forme) akan muncul dalam Shadow Raid 5 bintang setiap hujung minggu dari 5 Ogos hingga 8 September.",
  "10th-anniversary-celebration": "Semua Trainer boleh sambut ulang tahun ke-10 Pokémon GO dengan Mewtwo istimewa! Timed Research Perfect Mewtwo akan tersedia dari 12 Ogos 2026, 4:00 petang PDT hingga 6 September 2026, 11 malam waktu tempatan.",
  "water-festival-2026": "Arrokuda dan Cramorant melompat masuk ke Pokémon GO semasa Ultra Unlock: Water Festival! Event Ultra Unlock: Water Festival akan berlangsung dari 18 Ogos 2026, 10 pagi hingga 24 Ogos 2026, 8 malam waktu tempatan.",
  "gbl-forever-forward_great-league_scroll-cup-great-league-edition": "Great League dan Scroll Cup: Great League Edition akan berjalan dari 18 Ogos 2026, 1:00 petang hingga 25 Ogos 2026, 1:00 petang PT. Pokémon Great League mesti CP 1,500 ke bawah. Scroll Cup: Great League Edition juga CP 1,500 ke bawah. Hanya Pokémon jenis Water, Fighting, dan lain-lain yang layak.",
  "lunala-in-5-star-raid-battles-august-2026": "Lunala akan berada dalam raid 5 bintang dari 19 Ogos 2026 hingga 25 Ogos 2026. Ada juga Raid Hour featuring Lunala dari 6:00 petang hingga 7:00 petang waktu tempatan pada tarikh: 19 Ogos.",
  "mega-swampert-in-mega-raids-august-2026": "Mega Swampert akan berada dalam Mega Raids dari 19 Ogos 2026, 6 pagi hingga 25 Ogos 2026, 10 malam waktu tempatan.",
  "max-mondays-2026-08-24": "Dynamax Pokemon ini mungkin muncul dalam Max Battles sepanjang season ini. Max Battles tersedia dari 6:00 pagi hingga 9:00 malam waktu tempatan pada hari Isnin. Power Spots akan refresh lebih kerap, dan lebih banyak Power Spots aktif pada hari Isnin berbanding hari lain. Max Battles akan berputar secara berkala.",
  "pokemon-xp-2026-worlds": "Sambut PokémonXP dan Kejohanan Dunia Pokémon 2026 dalam Pokémon GO! Event PokémonXP & 2026 Worlds akan berlangsung dari 25 Ogos 2026, 10 pagi hingga 30 Ogos 2026, 8 malam waktu tempatan. PokémonXP: Selasa, 25 Ogos, 10:00 pagi hingga Jumaat, 28 Ogos 2026, 10:00 pagi waktu tempatan. Bahagian 2026 Worlds turut disertakan.",
  "gbl-forever-forward_great-league_ultra-league_master-league-split-3": "Great League, Ultra League, dan Master League akan berjalan dari 25 Ogos 2026, 1:00 petang hingga 1 September 2026, 1:00 petang PT. Trainer juga akan dapat 4× Stardust dari win rewards (tidak termasuk end-of-set rewards). Pokémon Great League mesti CP 1,500 ke bawah. Ultra League mesti CP 2,500 ke bawah.",
  "mega-gyarados-in-mega-raids-august-2026": "Mega Gyarados akan berada dalam Mega Raids dari 26 Ogos 2026, 6 pagi hingga 8 September 2026, 10 malam waktu tempatan.",
  "regirock-regice-registeel-in-5-star-raid-battles-august-2026": "Regirock, Regice, dan Registeel akan berada dalam raid 5 bintang dari 26 Ogos 2026 hingga 8 September 2026. Ada juga Raid Hour featuring mereka dari 6:00 petang hingga 7:00 petang waktu tempatan pada tarikh: 26 Ogos, 2 September, dan seterusnya.",
  "raidhour20260826": "Raid Hour featuring Regirock, Regice, dan Registeel dijadualkan dari 6 hingga 7 petang waktu tempatan. Pada jam ini, bilangan Raid 5 bintang akan bertambah.",
  "pokemonspotlighthour2026-08-27": "Jam Spotlight Pokémon akan menampilkan Pokémon dan bonus istimewa berbeza selama satu jam pada 6:00 petang waktu tempatan hari Khamis. 27 Ogos: Pokémon featured ialah Mankey dan bonus istimewanya 2× Catch Candy.",
  "pokemon-world-championships-2026-timed-research-twitch-drops": "Dapatkan kod untuk Timed Research eksklusif, avatar item Worlds Tee, dan encounter Pikachu istimewa dengan menonton livestream Kejohanan Dunia Pokémon 2026 dan PokémonXP. Trainer boleh peroleh sehingga lima ganjaran Pokémon GO sepanjang siaran rasmi.",
  "max-mondays-2026-08-31": "Dynamax Pokemon ini mungkin muncul dalam Max Battles sepanjang season ini. Max Battles tersedia dari 6:00 pagi hingga 9:00 malam waktu tempatan pada hari Isnin. Power Spots akan refresh lebih kerap, dan lebih banyak Power Spots aktif pada hari Isnin berbanding hari lain. Max Battles akan berputar secara berkala.",
  "mega-ascension": "Tanda-tanda minggu mega yang luar biasa mula muncul. Sertai Mega Ascension untuk bersedia ke Pokémon GO Fest 2026: Mega Finale dengan Mega Raids, Pokémon partner pertama Kalos, dan GO Pass: Mega Finale! Event Mega Ascension akan berlangsung dari 31 Ogos 2026, 10 pagi hingga 4 September 2026.",
  "gbl-forever-forward_great-league_ultra-league_master-league-mega-edition": "Great League, Ultra League, dan Master League: Mega Edition akan berjalan dari 1 September 2026, 1:00 petang hingga 8 September 2026, 1:00 petang PT. Trainer juga akan dapat 4× Stardust dari win rewards (tidak termasuk end-of-set rewards). Pokémon Great League mesti CP 1,500 ke bawah.",
  "raidhour20260902": "Raid Hour featuring Regirock, Regice, dan Registeel dijadualkan dari 6 hingga 7 petang waktu tempatan. Pada jam ini, bilangan Raid 5 bintang akan bertambah.",
  "pokemon-go-fest-2026-mega-finale": "Berkumpullah dengan Trainer seluruh dunia untuk kemuncak mega Pokémon GO Fest 2026! Pokémon GO Fest 2026: Mega Finale membawakan habitat berputar, Mega Raids berkuasa, dan Super Mega Raids featuring Mega Mewtwo X dan Mega Mewtwo Y. Bersedia semasa event pendahulunya Mega Ascension, kemudian sertai kemuncak event ini.",
  "september-communitydayclassic2026": "Event September Community Day Classic akan berlangsung pada 12 September 2026 dari 2 petang hingga 5 petang. Nantikan butiran lanjut.",
  "super-mega-raid-day-september-2026": "Event Super Mega Raid Day akan berlangsung pada 19 September 2026 dari 2 petang hingga 5 petang. Nantikan butiran lanjut.",
  "catch-mastery-september-2026": "Event Catch Mastery akan berlangsung pada 26 September 2026 dari 10 pagi hingga 8 malam. Nantikan butiran lanjut.",
  "max-battle-day-october-2026": "Event Max Battle Day akan berlangsung pada 3 Oktober 2026 dari 2 petang hingga 5 petang. Nantikan butiran lanjut.",
  "october-communityday2026": "Event October Community Day akan berlangsung pada 10 Oktober 2026 dari 2 petang hingga 5 petang. Nantikan butiran lanjut.",
  "hatch-day-october-2026": "Event Hatch Day akan berlangsung pada 17 Oktober 2026 dari 11 pagi hingga 5 petang. Nantikan butiran lanjut.",
  "max-battle-day-october-24-2026": "Event Max Battle Day akan berlangsung pada 24 Oktober 2026 dari 2 petang hingga 5 petang. Nantikan butiran lanjut.",
  "super-mega-raid-day-october-2026": "Event Super Mega Raid Day akan berlangsung pada 31 Oktober 2026 dari 2 petang hingga 5 petang. Nantikan butiran lanjut.",
  "november-communityday2026": "Event November Community Day akan berlangsung pada 21 November 2026 dari 2 petang hingga 5 petang. Nantikan butiran lanjut.",
  "super-mega-raid-day-november-2026": "Event Super Mega Raid Day akan berlangsung pada 28 November 2026 dari 2 petang hingga 5 petang. Nantikan butiran lanjut.",
}

with open(SUM, encoding="utf-8") as f:
    data = json.load(f)

added = 0
for slug, ms in MS.items():
    if slug in data:
        data[slug]["summary_ms"] = ms
        added += 1

with open(SUM, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=1)

missing = [s for s in data if not data[s].get("summary_ms")]
print(f"OK: {added} summaries translated to BM; {len(missing)} missing summary_ms")
