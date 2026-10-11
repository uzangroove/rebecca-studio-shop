/* Rébecca Studio — shared helpers for the public site and catalog */
(function () {
  const C = window.RS_CONFIG;

  /* ---------- tiny REST client (read-only + public insert) ---------- */
  async function rest(path, opts = {}) {
    const res = await fetch(`${C.SUPABASE_URL}/rest/v1/${path}`, {
      method: opts.method || "GET",
      headers: Object.assign({
        apikey: C.SUPABASE_KEY,
        Authorization: `Bearer ${C.SUPABASE_KEY}`,
        "Content-Type": "application/json"
      }, opts.headers || {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).message || msg; } catch (e) {}
      throw new Error(msg);
    }
    if (res.status === 204 || opts.method === "POST") return null;
    return res.json();
  }

  const api = {
    products: () => rest("products?select=*&published=eq.true&order=category.asc,sort_order.asc,created_at.asc"),
    workshops: () => rest("workshops?select=*&published=eq.true&order=starts_at.asc.nullslast,sort_order.asc"),
    seats: () => rest("rpc/workshop_seats_taken", { method: "GET" }).catch(() => []),
    settings: () => rest("settings?select=data&id=eq.1").then(r => (r && r[0] && r[0].data) || {}),
    signup: (row) => rest("workshop_signups", { method: "POST", body: row, headers: { Prefer: "return=minimal" } })
  };

  /* ---------- cache (so the site paints instantly on repeat visits) ---------- */
  const cache = {
    get(k) { try { const v = JSON.parse(localStorage.getItem("rs_cache_" + k)); return v && v.d; } catch (e) { return null; } },
    set(k, d) { try { localStorage.setItem("rs_cache_" + k, JSON.stringify({ t: Date.now(), d })); } catch (e) {} }
  };

  /* ---------- language ---------- */
  const DICT = {
    he: {
      nav_products: "מוצרים", nav_workshops: "סדנאות", nav_about: "אודות", nav_contact: "צור קשר",
      lang_btn: "English", products_title: "המוצרים שלנו",
      cat_all: "הכל", cat_soap: "סבונים", cat_candle: "נרות", cat_bundle: "מארזים", cat_other: "עוד",
      add: "הוספה לסל", added: "נוסף לסל", sold_out: "אזל זמנית", price_ask: "מחיר בפנייה",
      details: "לפרטים", ask_wa: "שאלה בוואטסאפ", share: "שיתוף", link_copied: "הקישור הועתק",
      qty: "כמות", close: "סגירה", cart: "סל ההזמנה", cart_empty: "הסל ריק עדיין. בחרו מוצרים ונשלח את ההזמנה בוואטסאפ.",
      remove: "הסרה", total: "סה״כ משוער", partial_total: "חלק מהפריטים יתומחרו בוואטסאפ",
      your_name: "שם", delivery: "קבלת ההזמנה", pickup: "איסוף עצמי מכרמיאל", ship: "משלוח",
      address: "עיר וכתובת למשלוח", note: "הערה", optional: "לא חובה",
      send_wa: "שליחת ההזמנה בוואטסאפ", clear_cart: "ניקוי הסל",
      cart_note: "ההזמנה נשלחת כהודעה מוכנה לוואטסאפ. התשלום והמשלוח נסגרים מול רבקה.",
      wa_hello: "שלום רבקה! אשמח להזמין מ-Rébecca Studio:", wa_total: "סה״כ משוער", wa_name: "שם",
      wa_delivery: "קבלה", wa_note: "הערה", wa_q: "שלום רבקה, אשמח לפרטים על",
      workshops_title: "סדנאות", by_arrangement: "בתיאום אישי", minutes: "דק׳", seats_left: "נותרו {n} מקומות", full: "הסדנה מלאה",
      register: "להרשמה", private_ws: "לתיאום סדנה פרטית", phone: "טלפון", participants: "משתתפים",
      send: "שליחה", sending: "שולח…", signup_ok: "תודה! ההרשמה התקבלה ורבקה תחזור אליך.", continue_wa: "להמשך בוואטסאפ",
      signup_err: "משהו השתבש. אפשר לנסות שוב או לכתוב בוואטסאפ.", wa_ws: "שלום רבקה, נרשמתי לסדנה",
      about_title: "אודות", contact_title: "יצירת קשר", shipping_title: "משלוחים ואיסוף", payment_title: "תשלום",
      footer_rights: "כל הזכויות שמורות", accessibility: "הצהרת נגישות", privacy: "מדיניות פרטיות", terms: "תקנון",
      catalog: "קטלוג להורדה", skip: "דילוג לתוכן", loading: "טוען…", load_err: "לא הצלחנו לטעון את המוצרים כרגע. נסו לרענן.",
      empty_cat: "אין עדיין מוצרים בקטגוריה הזו.", whatsapp: "וואטסאפ", email: "מייל", call: "טלפון"
    },
    en: {
      nav_products: "Products", nav_workshops: "Workshops", nav_about: "About", nav_contact: "Contact",
      lang_btn: "עברית", products_title: "Our Products",
      cat_all: "All", cat_soap: "Soaps", cat_candle: "Candles", cat_bundle: "Gift sets", cat_other: "More",
      add: "Add to order", added: "Added", sold_out: "Sold out", price_ask: "Price on request",
      details: "Details", ask_wa: "Ask on WhatsApp", share: "Share", link_copied: "Link copied",
      qty: "Qty", close: "Close", cart: "Your order", cart_empty: "Your order is empty. Pick products and send the order on WhatsApp.",
      remove: "Remove", total: "Estimated total", partial_total: "Some items will be priced on WhatsApp",
      your_name: "Name", delivery: "Delivery", pickup: "Pickup in Karmiel", ship: "Shipping",
      address: "City and address", note: "Note", optional: "optional",
      send_wa: "Send order on WhatsApp", clear_cart: "Clear order",
      cart_note: "Your order is sent as a ready WhatsApp message. Payment and delivery are arranged with Rebecca.",
      wa_hello: "Hi Rebecca! I'd like to order from Rébecca Studio:", wa_total: "Estimated total", wa_name: "Name",
      wa_delivery: "Delivery", wa_note: "Note", wa_q: "Hi Rebecca, I'd like details about",
      workshops_title: "Workshops", by_arrangement: "By arrangement", minutes: "min", seats_left: "{n} seats left", full: "Fully booked",
      register: "Register", private_ws: "Book a private workshop", phone: "Phone", participants: "Participants",
      send: "Send", sending: "Sending…", signup_ok: "Thank you! Your registration was received and Rebecca will get back to you.", continue_wa: "Continue on WhatsApp",
      signup_err: "Something went wrong. Please try again or message on WhatsApp.", wa_ws: "Hi Rebecca, I registered for the workshop",
      about_title: "About", contact_title: "Contact", shipping_title: "Shipping & pickup", payment_title: "Payment",
      footer_rights: "All rights reserved", accessibility: "Accessibility", privacy: "Privacy", terms: "Terms",
      catalog: "Download catalog", skip: "Skip to content", loading: "Loading…", load_err: "We couldn't load the products right now. Please refresh.",
      empty_cat: "No products in this category yet.", whatsapp: "WhatsApp", email: "Email", call: "Phone"
    }
  };

  function getLang() {
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "en" || q === "he") { try { localStorage.setItem("rs_lang", q); } catch (e) {} return q; }
    try { return localStorage.getItem("rs_lang") || "he"; } catch (e) { return "he"; }
  }
  function setLang(l) { try { localStorage.setItem("rs_lang", l); } catch (e) {} }
  function t(key, lang) { const d = DICT[lang || RS.lang] || DICT.he; return d[key] != null ? d[key] : (DICT.he[key] || key); }
  /** pick a bilingual field: obj.name_he / obj.name_en with Hebrew fallback */
  function pick(obj, field, lang) {
    lang = lang || RS.lang;
    if (!obj) return "";
    const v = obj[`${field}_${lang}`];
    return (v && String(v).trim()) ? v : (obj[`${field}_he`] || obj[`${field}_en`] || "");
  }
  function applyI18n(root) {
    (root || document).querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    (root || document).querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    document.documentElement.lang = RS.lang;
    document.documentElement.dir = RS.lang === "he" ? "rtl" : "ltr";
  }

  /* ---------- formatting ---------- */
  function price(n, lang) {
    if (n == null || n === "") return "";
    const v = Number(n);
    return "₪" + (Number.isInteger(v) ? v.toString() : v.toFixed(2));
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }
  function waLink(number, text) {
    const n = String(number || C.DEFAULT_WHATSAPP).replace(/[^0-9]/g, "");
    return `https://wa.me/${n}?text=${encodeURIComponent(text || "")}`;
  }
  function fmtDate(iso, lang) {
    if (!iso) return "";
    const d = new Date(iso);
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "he-IL", {
      weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem"
    }).format(d);
  }
  function applyTheme(settings) {
    document.documentElement.dataset.theme = (settings && settings.theme) === "brand" ? "brand" : "mono";
  }
  function toast(msg) {
    let el = document.getElementById("rs-toast");
    if (!el) { el = document.createElement("div"); el.id = "rs-toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("show");
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2200);
  }
  function productUrl(slug, lang) {
    return `${location.origin}/p/${encodeURIComponent(slug)}${lang === "en" ? "?lang=en" : ""}`;
  }
  async function shareLink(url, title) {
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(url); toast(t("link_copied")); } catch (e) { prompt("", url); }
  }

  const RS = window.RS = { api, cache, DICT, t, pick, applyI18n, price, esc, nl2br, waLink, fmtDate, applyTheme, toast, productUrl, shareLink, setLang, lang: getLang() };
})();
