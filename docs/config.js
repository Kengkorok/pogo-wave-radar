/* PoGo Wave Radar — donate & config */
const APP_CONFIG = {
  /* ============================================================
     SET KAU PUNYA LINK DI SINI, lepas tu commit & push.
     ============================================================ */
  donate: {
    /* Ko-fi: daftar percuma kat https://ko-fi.com , link jadi
       https://ko-fi.com/NAMA_KAU  — terbaik utk audience global */
    kofi: "https://ko-fi.com/kengkorok",
    /* Buy Me a Coffee: https://buymeacoffee.com/NAMA_KAU */
    buymeacoffee: null,
    /* PayPal.Me: https://paypal.me/NAMA_KAU */
    paypal: null,
    /* TNG/DuitNow: letak URL/imej QR DuitNow kau sendiri (host
       kat repo, e.g. "img/duitnow-qr.png"). Personal transfer,
       zero fee, tapi manual. Ko-fi tetap utama untuk luar negara. */
    duitnow_qr: null,
    duitnow_qr_name: "",
  },
  /* Default: event PvP (GO Battle League) disorok dari Live Now
     supaya tak dominate. User boleh on semula kat app. */
  show_pvp_default: false,
};
