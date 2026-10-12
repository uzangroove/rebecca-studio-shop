/* Rébecca Studio — admin app (Supabase auth + CRUD) */
(function () {
  const C = window.RS_CONFIG;
  const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CAT = { soap: "סבונים", candle: "נרות", bundle: "מארזים", other: "עוד" };
  const SITE = location.origin;

  let ST = null; // "פרטי ייצור" module (studio.js)
  let SG = null; // smart suggestions (suggest.js)
  let DM = null; // "מאגרים" — all back-office tables (data.js)
  const S = { products: [], workshops: [], signups: [], settings: {}, cat: "all", q: "", editing: null, editImgs: [], wsEditing: null, wsImg: null, share: null, fmt: "square", inbox: [], inboxFilter: "new", pendingInbox: [] };

  function toast(m, ms = 2400) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), ms); }
  function fail(e) { console.error(e); toast("שגיאה: " + (e && e.message ? e.message : e), 5000); }
  const abs = src => !src ? "" : /^https?:/.test(src) ? src : SITE + src;
  const money = n => n == null ? "מחיר בפנייה" : "₪" + Number(n);

  /* ================= auth ================= */
  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return showLogin();
    const { data: ok, error } = await sb.rpc("is_admin");
    if (error || !ok) { await sb.auth.signOut(); return showLogin("למשתמש הזה אין הרשאת ניהול."); }
    $("#login").hidden = true; $("#app").hidden = false;
    if (window.RSStudio && !ST) { try { ST = window.RSStudio(sb, { $, $$, esc, toast }); } catch (e) { console.warn("studio", e); } }
    if (window.RSSuggest && ST && !SG) { try { SG = window.RSSuggest(sb, { $, esc, toast, images: () => S.editImgs, settings: () => S.settings, studio: ST, abs }); } catch (e) { console.warn("suggest", e); } }
    if (window.RSData && !DM) {
      try {
        DM = window.RSData(sb, { $, esc, toast, fail,
          openProduct: p => openProduct(p ? S.products.find(x => x.id === p.id) || p : null),
          onChange: () => { if (ST) ST.load(); } });
      } catch (e) { console.warn("data", e); }
    }
    await Promise.all([loadProducts(), loadWorkshops(), loadSettings(), loadSignups(), loadInbox()]);
    if (ST) ST.load().then(ok => { if (ok) renderProducts(); });
  }
  function showLogin(msg) { $("#app").hidden = true; $("#login").hidden = false; $("#loginMsg").textContent = msg || ""; }
  $("#loginForm").onsubmit = async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector("button"); btn.disabled = true; $("#loginMsg").textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    btn.disabled = false;
    if (error) { $("#loginMsg").textContent = "המייל או הסיסמה שגויים."; return; }
    boot();
  };
  $("#logoutBtn").onclick = $("#logoutBtn2").onclick = async () => { await sb.auth.signOut(); showLogin(); };

  /* ================= tabs ================= */
  $$(".tab").forEach(b => b.onclick = () => {
    $$(".tab").forEach(x => x.classList.toggle("on", x === b));
    const view = b.dataset.tab === "calc" ? "data" : b.dataset.tab;
    $$(".view").forEach(v => v.hidden = v.dataset.view !== view);
    if (b.dataset.tab === "calc" && DM) DM.quickCalc();
    if (b.dataset.tab === "signups") { try { localStorage.setItem("rs_seen_signups", new Date().toISOString()); } catch (e) {} updateBadge(); }
    if (b.dataset.tab === "data" && DM) DM.show();
    scrollTo(0, 0);
  });
  $$("dialog [data-close]").forEach(b => b.onclick = () => b.closest("dialog").close());

  /* ================= image helpers ================= */
  async function resizeToJpeg(file, max = 1600, q = 0.85) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch (e) { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
    const w = bmp.width, h = bmp.height, k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(res, "image/jpeg", q));
  }
  async function uploadImage(file, folder) {
    const blob = await resizeToJpeg(file);
    const name = `${folder}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from("media").upload(name, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (error) throw error;
    return sb.storage.from("media").getPublicUrl(name).data.publicUrl;
  }
  async function removeStorageImage(url) {
    const m = String(url).match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
    if (m) await sb.storage.from("media").remove([decodeURIComponent(m[1])]);
  }

  /* ================= products ================= */
  async function loadProducts() {
    const { data, error } = await sb.from("products").select("*").order("category").order("sort_order").order("created_at");
    if (error) return fail(error);
    S.products = data; renderProducts();
    if (DM) DM.refresh("products");
  }
  function renderProducts() {
    const q = S.q.trim().toLowerCase();
    const items = S.products.filter(p => (S.cat === "all" || p.category === S.cat) && (!q || [p.name_he, p.name_en, p.short_he, ST && ST.skuOf(p.id)].join(" ").toLowerCase().includes(q)));
    const noPrice = S.products.filter(p => p.price == null).length, noDesc = S.products.filter(p => !p.desc_he).length;
    $("#todo").innerHTML = (noPrice || noDesc) ? `<b>מה נשאר להשלים:</b> ${noPrice ? `${noPrice} מוצרים בלי מחיר` : ""}${noPrice && noDesc ? " · " : ""}${noDesc ? `${noDesc} בלי תיאור מלא` : ""}. לחצי "עריכה" על כל מוצר כדי להשלים.` : "";
    $("#todo").hidden = !(noPrice || noDesc);
    $("#prodList").innerHTML = items.length ? items.map(p => `
      <div class="row ${p.published ? "" : "off"}">
        ${p.images && p.images[0] ? `<img src="${esc(abs(p.images[0]))}" alt="" loading="lazy">` : `<div class="noimg"></div>`}
        <div>
          <h3>${esc(p.name_he)}</h3>
          <div class="sub">${esc(CAT[p.category])} · ${esc(money(p.price))}
            ${p.published ? `<span class="tag ok">באתר</span>` : `<span class="tag">מוסתר</span>`}
            ${p.sold_out ? `<span class="tag bad">אזל</span>` : ""}${p.featured ? ` <span class="tag">מומלץ</span>` : ""}
            ${ST && ST.skuOf(p.id) ? ` <span class="tag" dir="ltr">${esc(ST.skuOf(p.id))}</span>` : ""}
            ${p.price == null ? ` <span class="tag warn">חסר מחיר</span>` : ""}${!p.desc_he ? ` <span class="tag warn">חסר תיאור</span>` : ""}</div>
          <div class="acts">
            <button class="chip" data-edit="${p.id}" type="button">עריכה</button>
            <button class="chip" data-toggle="published" data-id="${p.id}" type="button">${p.published ? "הסתרה" : "הצגה באתר"}</button>
            <button class="chip" data-toggle="sold_out" data-id="${p.id}" type="button">${p.sold_out ? "חזר למלאי" : "סימון אזל"}</button>
            <button class="chip" data-share="${p.id}" type="button">שיתוף</button>
            <button class="chip" data-move="-1" data-id="${p.id}" type="button" aria-label="הזזה למעלה">▲</button>
            <button class="chip" data-move="1" data-id="${p.id}" type="button" aria-label="הזזה למטה">▼</button>
          </div>
        </div>
      </div>`).join("") : `<div class="empty">אין מוצרים כאן עדיין. לחצי על "+ מוצר חדש".</div>`;
  }
  $("#prodSearch").oninput = e => { S.q = e.target.value; renderProducts(); };
  $$("#prodCats .chip").forEach(b => b.onclick = () => { S.cat = b.dataset.cat; $$("#prodCats .chip").forEach(x => x.classList.toggle("on", x === b)); renderProducts(); });

  $("#prodList").addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.edit) return openProduct(S.products.find(p => p.id === b.dataset.edit));
    if (b.dataset.share) return openShare(S.products.find(p => p.id === b.dataset.share));
    if (b.dataset.toggle) {
      const p = S.products.find(x => x.id === b.dataset.id), field = b.dataset.toggle;
      b.disabled = true;
      const { error } = await sb.from("products").update({ [field]: !p[field] }).eq("id", p.id);
      if (error) { b.disabled = false; return fail(error); }
      p[field] = !p[field]; renderProducts(); toast("עודכן ✓"); return;
    }
    if (b.dataset.move) return moveProduct(b.dataset.id, Number(b.dataset.move));
  });

  async function moveProduct(id, dir) {
    const p = S.products.find(x => x.id === id);
    const same = S.products.filter(x => x.category === p.category);
    const i = same.indexOf(p), j = i + dir;
    if (j < 0 || j >= same.length) return;
    [same[i], same[j]] = [same[j], same[i]];
    const updates = same.map((x, k) => ({ id: x.id, sort_order: (k + 1) * 10 })).filter(u => S.products.find(x => x.id === u.id).sort_order !== u.sort_order);
    updates.forEach(u => { S.products.find(x => x.id === u.id).sort_order = u.sort_order; });
    S.products.sort((a, b) => a.category.localeCompare(b.category) || a.sort_order - b.sort_order);
    renderProducts();
    for (const u of updates) { const { error } = await sb.from("products").update({ sort_order: u.sort_order }).eq("id", u.id); if (error) return fail(error); }
  }

  function slugify(s) {
    return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  }
  function uniqueSlug(base, selfId) {
    let s = base || ("p-" + Date.now().toString(36)), n = 2;
    while (S.products.some(p => p.slug === s && p.id !== selfId)) s = `${base}-${n++}`;
    return s;
  }

  function openProduct(p, opts = {}) {
    const f = $("#prodForm"); f.reset();
    S.editing = p || null;
    S.editImgs = p ? [...(p.images || [])] : [...(opts.images || [])];
    S.pendingInbox = [...(opts.inboxIds || [])];
    $("#prodDlgTitle").textContent = p ? "עריכת מוצר" : "מוצר חדש";
    $("#prodDelete").hidden = !p;
    const v = p || { category: S.cat !== "all" ? S.cat : "soap", published: !opts.inboxIds, sort_order: 100 };
    ["category", "name_he", "name_en", "short_he", "short_en", "desc_he", "desc_en", "price", "price_note_he", "price_note_en", "slug", "sort_order"]
      .forEach(k => { if (f[k]) f[k].value = v[k] == null ? "" : v[k]; });
    ["published", "sold_out", "featured"].forEach(k => f[k].checked = !!v[k]);
    $("#uploadMsg").textContent = "";
    renderEditImgs();
    if (SG) SG.reset();
    if (ST) ST.open(p, v.category).then(() => { if (SG) SG.loaded(); }).catch(e => console.warn("studio open", e));
    $("#prodDlg").showModal();
  }
  function renderEditImgs() {
    if (SG) SG.refreshButtons();
    $("#prodImgs").innerHTML = S.editImgs.map((src, i) => `
      <div class="img-cell">
        <img src="${esc(abs(src))}" alt="">
        ${i === 0 ? `<span class="main">ראשית</span>` : ""}
        <div class="ctl">
          <button type="button" data-imgact="right" data-i="${i}" aria-label="הזזה ימינה">→</button>
          ${i !== 0 ? `<button type="button" data-imgact="main" data-i="${i}">ראשית</button>` : ""}
          <button type="button" data-imgact="del" data-i="${i}" aria-label="מחיקה">🗑</button>
          <button type="button" data-imgact="left" data-i="${i}" aria-label="הזזה שמאלה">←</button>
        </div>
      </div>`).join("");
  }
  $("#prodImgs").addEventListener("click", e => {
    const b = e.target.closest("button[data-imgact]"); if (!b) return;
    const i = Number(b.dataset.i), a = S.editImgs;
    if (b.dataset.imgact === "del") { if (confirm("להסיר את התמונה מהמוצר?")) a.splice(i, 1); }
    if (b.dataset.imgact === "main") a.unshift(a.splice(i, 1)[0]);
    if (b.dataset.imgact === "right" && i > 0) [a[i - 1], a[i]] = [a[i], a[i - 1]];
    if (b.dataset.imgact === "left" && i < a.length - 1) [a[i + 1], a[i]] = [a[i], a[i + 1]];
    renderEditImgs();
  });
  $("#prodFiles").onchange = async e => {
    const files = Array.from(e.target.files || []); e.target.value = "";
    if (!files.length) return;
    const msg = $("#uploadMsg");
    for (let k = 0; k < files.length; k++) {
      msg.textContent = `מעלה תמונה ${k + 1} מתוך ${files.length}…`;
      try { S.editImgs.push(await uploadImage(files[k], "products")); renderEditImgs(); }
      catch (err) { fail(err); }
    }
    msg.textContent = "התמונות עלו ✓ (נשמרות במוצר אחרי לחיצה על שמירה)";
  };
  $("#prodForm").onsubmit = async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector("button[type=submit]");
    const val = k => { const x = f[k].value.trim(); return x === "" ? null : x; };
    const row = {
      category: f.category.value, name_he: val("name_he"), name_en: val("name_en"),
      short_he: val("short_he"), short_en: val("short_en"), desc_he: val("desc_he"), desc_en: val("desc_en"),
      price: val("price") == null ? null : Number(val("price")),
      price_note_he: val("price_note_he"), price_note_en: val("price_note_en"),
      images: S.editImgs, published: f.published.checked, sold_out: f.sold_out.checked, featured: f.featured.checked,
      sort_order: val("sort_order") == null ? 100 : parseInt(val("sort_order"), 10)
    };
    if (!row.name_he) return toast("חסר שם מוצר");
    const selfId = S.editing && S.editing.id;
    row.slug = uniqueSlug(slugify(val("slug") || row.name_en || "") || (S.editing && S.editing.slug) || "", selfId);
    btn.disabled = true;
    const q = selfId ? sb.from("products").update(row).eq("id", selfId).select("id").single() : sb.from("products").insert(row).select("id").single();
    const { data: saved, error } = await q;
    btn.disabled = false;
    if (error) { btn.disabled = false; return fail(error); }
    if (ST) { btn.disabled = true; try { await ST.save(saved.id); } catch (e2) { console.warn("studio save", e2); } btn.disabled = false; }
    const used = S.pendingInbox.filter(id => S.inbox.some(m => m.id === id && row.images.includes(m.url)));
    if (used.length) {
      const { error: e2 } = await sb.from("media_inbox").update({ status: "used", product_id: saved.id }).in("id", used);
      if (e2) console.warn(e2);
    }
    S.pendingInbox = [];
    $("#prodDlg").close(); toast(row.published ? "נשמר ✓" : "נשמר ✓ (מוסתר באתר עד שתסמני \"מוצג באתר\")"); loadProducts(); loadInbox();
  };
  $("#newProduct").onclick = () => openProduct(null);
  $("#prodDelete").onclick = async () => {
    const p = S.editing; if (!p) return;
    if (!confirm(`למחוק לצמיתות את "${p.name_he}"? (אפשר גם רק להסתיר אותו)`)) return;
    const { error } = await sb.from("products").delete().eq("id", p.id);
    if (error) return fail(error);
    for (const src of p.images || []) { try { await removeStorageImage(src); } catch (e) {} }
    $("#prodDlg").close(); toast("נמחק"); loadProducts();
  };

  /* ================= inbox: images sent from the photo studio ================= */
  function applyStudioLink() {
    const u = (S.settings.photo_studio_url || "").trim();
    ["#studioLink", "#studioLink2", "#studioLink3"].forEach(sel => { const a = $(sel); if (!a) return; a.hidden = !u; if (u) a.href = u; });
  }
  async function loadInbox() {
    const { data, error } = await sb.from("media_inbox").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) { console.warn(error); return; }
    S.inbox = data; renderInbox();
  }
  const STATUS_LBL = { new: "ממתינה", used: "במוצר", post: "לפוסט", discarded: "נדחתה" };
  function inboxMeta(m) {
    const d = new Date(m.created_at).toLocaleDateString("he-IL", { day: "numeric", month: "short", timeZone: "Asia/Jerusalem" });
    return `${m.variant === "branded" ? "עם מיתוג" : "נקייה"} · ${d}`;
  }
  function renderInbox() {
    const items = S.inbox.filter(m => S.inboxFilter === "all" || m.status === "new");
    const n = S.inbox.filter(m => m.status === "new").length;
    const dot = $("#newInbox"); dot.textContent = n; dot.hidden = n === 0;
    $("#inboxGrid").innerHTML = items.length ? items.map(m => {
      const prod = m.product_id && S.products.find(p => p.id === m.product_id);
      return `<div class="inbox-card ${m.status === "new" ? "" : "done"}">
        <div class="ph"><img src="${esc(m.url)}" alt="" loading="lazy"><span class="tag ${m.status === "new" ? "warn" : m.status === "used" ? "ok" : ""}">${STATUS_LBL[m.status]}</span></div>
        <div class="meta">${esc(inboxMeta(m))}${prod ? ` · ${esc(prod.name_he)}` : ""}</div>
        <div class="acts">
          <button type="button" class="main" data-ix="new" data-id="${m.id}">מוצר חדש</button>
          <button type="button" data-ix="assign" data-id="${m.id}">למוצר קיים</button>
          <button type="button" data-ix="post" data-id="${m.id}">לפוסט</button>
          <button type="button" class="del" data-ix="del" data-id="${m.id}">מחיקה</button>
        </div>
      </div>`;
    }).join("") : `<div class="empty" style="grid-column:1/-1">${S.inboxFilter === "new" ? "אין תמונות ממתינות. תמונות שתשלחי מסטודיו התמונות יופיעו כאן." : "עדיין לא נשלחו תמונות."}</div>`;
  }
  $$("#inboxFilter .chip").forEach(b => b.onclick = () => { S.inboxFilter = b.dataset.f; $$("#inboxFilter .chip").forEach(x => x.classList.toggle("on", x === b)); renderInbox(); });
  $("#inboxGrid").addEventListener("click", async e => {
    const b = e.target.closest("button[data-ix]"); if (!b) return;
    const m = S.inbox.find(x => x.id === b.dataset.id); if (!m) return;
    if (b.dataset.ix === "new") return openProduct(null, { images: [m.url], inboxIds: [m.id] });
    if (b.dataset.ix === "assign") return openAssign(m);
    if (b.dataset.ix === "post") {
      await sb.from("media_inbox").update({ status: "post" }).eq("id", m.id);
      m.status = "post"; renderInbox();
      return openShare({ name_he: "Rébecca Studio", short_he: "", desc_he: "", category: "other", price: null, images: [m.url], slug: null });
    }
    if (b.dataset.ix === "del") {
      if (!confirm("למחוק את התמונה מהתיבה? (מוצר שכבר משתמש בה לא ייפגע אם התמונה לא בשימוש)")) return;
      const inUse = S.products.some(p => (p.images || []).includes(m.url));
      const { error } = await sb.from("media_inbox").delete().eq("id", m.id);
      if (error) return fail(error);
      if (!inUse && m.storage_path) { try { await sb.storage.from("media").remove([m.storage_path]); } catch (err) {} }
      S.inbox = S.inbox.filter(x => x.id !== m.id); renderInbox(); toast("נמחקה");
    }
  });

  // assign to an existing product
  let assignItem = null;
  function openAssign(m) {
    assignItem = m; $("#assignImg").src = m.url; $("#assignSearch").value = ""; renderAssign(); $("#assignDlg").showModal();
  }
  function renderAssign() {
    const q = $("#assignSearch").value.trim().toLowerCase();
    const items = S.products.filter(p => !q || [p.name_he, p.name_en].join(" ").toLowerCase().includes(q));
    $("#assignList").innerHTML = items.map(p => `<div class="row pick-row" data-pid="${p.id}" role="button" tabindex="0">
      ${p.images && p.images[0] ? `<img src="${esc(abs(p.images[0]))}" alt="">` : `<div class="noimg"></div>`}
      <div><h3>${esc(p.name_he)}</h3><div class="sub">${esc(CAT[p.category])} · ${(p.images || []).length} תמונות</div></div></div>`).join("") || `<div class="empty">לא נמצא מוצר</div>`;
  }
  $("#assignSearch").oninput = renderAssign;
  async function doAssign(pid) {
    const p = S.products.find(x => x.id === pid); if (!p || !assignItem) return;
    const asMain = document.querySelector('input[name="assignPos"]:checked').value === "main";
    const imgs = (p.images || []).filter(u => u !== assignItem.url);
    const next = asMain ? [assignItem.url, ...imgs] : [...imgs, assignItem.url];
    const { error } = await sb.from("products").update({ images: next }).eq("id", p.id);
    if (error) return fail(error);
    await sb.from("media_inbox").update({ status: "used", product_id: p.id }).eq("id", assignItem.id);
    $("#assignDlg").close(); toast(`התמונה נוספה ל"${p.name_he}" ✓`); loadProducts(); loadInbox();
  }
  $("#assignList").addEventListener("click", e => { const r = e.target.closest("[data-pid]"); if (r) doAssign(r.dataset.pid); });
  $("#assignList").addEventListener("keydown", e => { const r = e.target.closest("[data-pid]"); if (r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); doAssign(r.dataset.pid); } });

  // pick inbox images from inside the product editor
  const picked = new Set();
  $("#pickInbox").onclick = async () => {
    await loadInbox();
    picked.clear();
    const items = S.inbox.filter(m => m.status === "new" && !S.editImgs.includes(m.url));
    $("#pickGrid").innerHTML = items.length ? items.map(m => `<div class="inbox-card" data-pick="${m.id}" role="button" tabindex="0" aria-pressed="false">
      <div class="ph"><img src="${esc(m.url)}" alt="" loading="lazy"><span class="check" hidden>✓</span></div>
      <div class="meta" style="padding-bottom:8px">${esc(inboxMeta(m))}</div></div>`).join("")
      : `<div class="empty" style="grid-column:1/-1">אין תמונות ממתינות בתיבה.</div>`;
    $("#pickDone").textContent = "הוספה"; $("#pickDlg").showModal();
  };
  function togglePick(card) {
    const id = card.dataset.pick, on = !picked.has(id);
    on ? picked.add(id) : picked.delete(id);
    card.classList.toggle("sel", on); card.setAttribute("aria-pressed", on); card.querySelector(".check").hidden = !on;
    $("#pickDone").textContent = picked.size ? `הוספה (${picked.size})` : "הוספה";
  }
  $("#pickGrid").addEventListener("click", e => { const c = e.target.closest("[data-pick]"); if (c) togglePick(c); });
  $("#pickGrid").addEventListener("keydown", e => { const c = e.target.closest("[data-pick]"); if (c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); togglePick(c); } });
  $("#pickDone").onclick = () => {
    for (const id of picked) { const m = S.inbox.find(x => x.id === id); if (m && !S.editImgs.includes(m.url)) { S.editImgs.push(m.url); S.pendingInbox.push(m.id); } }
    renderEditImgs(); $("#pickDlg").close();
    if (picked.size) $("#uploadMsg").textContent = "התמונות נוספו ✓ (נשמרות במוצר אחרי לחיצה על שמירה)";
  };

  /* ================= workshops ================= */
  async function loadWorkshops() {
    const { data, error } = await sb.from("workshops").select("*").order("starts_at", { ascending: true, nullsFirst: false }).order("sort_order");
    if (error) return fail(error);
    S.workshops = data; renderWorkshops(); renderSignupFilter();
  }
  const fmtWhen = iso => iso ? new Intl.DateTimeFormat("he-IL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }).format(new Date(iso)) : "בתיאום אישי";
  function renderWorkshops() {
    const taken = {}; S.signups.filter(s => s.status !== "cancelled").forEach(s => { taken[s.workshop_id] = (taken[s.workshop_id] || 0) + s.participants; });
    $("#wsList").innerHTML = S.workshops.length ? S.workshops.map(w => `
      <div class="row ${w.published ? "" : "off"}">
        ${w.image ? `<img src="${esc(abs(w.image))}" alt="">` : `<div class="noimg"></div>`}
        <div>
          <h3>${esc(w.title_he)}</h3>
          <div class="sub">${esc(fmtWhen(w.starts_at))}${w.price != null ? " · ₪" + Number(w.price) : ""}
            · ${taken[w.id] || 0}${w.seats ? "/" + w.seats : ""} נרשמו
            ${w.published ? `<span class="tag ok">באתר</span>` : `<span class="tag">מוסתר</span>`}</div>
          <div class="acts">
            <button class="chip" data-wsedit="${w.id}" type="button">עריכה</button>
            <button class="chip" data-wstoggle="${w.id}" type="button">${w.published ? "הסתרה" : "הצגה באתר"}</button>
            <button class="chip" data-wsdup="${w.id}" type="button">שכפול לתאריך חדש</button>
          </div>
        </div>
      </div>`).join("") : `<div class="empty">אין סדנאות עדיין.</div>`;
  }
  $("#wsList").addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.wsedit) return openWorkshop(S.workshops.find(w => w.id === b.dataset.wsedit));
    if (b.dataset.wsdup) { const w = S.workshops.find(x => x.id === b.dataset.wsdup); const copy = { ...w }; delete copy.id; copy.starts_at = null; copy.published = false; return openWorkshop(copy, true); }
    if (b.dataset.wstoggle) {
      const w = S.workshops.find(x => x.id === b.dataset.wstoggle);
      const { error } = await sb.from("workshops").update({ published: !w.published }).eq("id", w.id);
      if (error) return fail(error); w.published = !w.published; renderWorkshops(); toast("עודכן ✓");
    }
  });
  const toLocalInput = iso => { if (!iso) return ""; const d = new Date(iso); const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  function openWorkshop(w, isCopy) {
    const f = $("#wsForm"); f.reset();
    S.wsEditing = w && w.id ? w : null; S.wsImg = w ? w.image || null : null;
    $("#wsDlgTitle").textContent = S.wsEditing ? "עריכת סדנה" : (isCopy ? "סדנה חדשה (העתק)" : "סדנה חדשה");
    $("#wsDelete").hidden = !S.wsEditing;
    const v = w || { published: true, duration_min: 180, location_he: "הסטודיו בכרמיאל", location_en: "The studio, Karmiel" };
    ["title_he", "title_en", "desc_he", "desc_en", "duration_min", "price", "seats", "location_he", "location_en"].forEach(k => f[k].value = v[k] == null ? "" : v[k]);
    f.starts_at.value = toLocalInput(v.starts_at); f.published.checked = !!v.published;
    renderWsImg(); $("#wsDlg").showModal();
  }
  function renderWsImg() {
    $("#wsImg").innerHTML = S.wsImg ? `<div class="img-cell"><img src="${esc(abs(S.wsImg))}" alt=""><div class="ctl"><span></span><button type="button" id="wsImgDel">🗑</button></div></div>` : "";
    const d = $("#wsImgDel"); if (d) d.onclick = () => { S.wsImg = null; renderWsImg(); };
  }
  $("#wsFile").onchange = async e => {
    const file = e.target.files && e.target.files[0]; e.target.value = ""; if (!file) return;
    toast("מעלה תמונה…");
    try { S.wsImg = await uploadImage(file, "workshops"); renderWsImg(); toast("התמונה עלתה ✓"); } catch (err) { fail(err); }
  };
  $("#wsForm").onsubmit = async e => {
    e.preventDefault();
    const f = e.target, val = k => { const x = f[k].value.trim(); return x === "" ? null : x; };
    const row = {
      title_he: val("title_he"), title_en: val("title_en"), desc_he: val("desc_he"), desc_en: val("desc_en"),
      starts_at: val("starts_at") ? new Date(val("starts_at")).toISOString() : null,
      duration_min: val("duration_min") ? parseInt(val("duration_min"), 10) : null,
      price: val("price") == null ? null : Number(val("price")), seats: val("seats") ? parseInt(val("seats"), 10) : null,
      location_he: val("location_he"), location_en: val("location_en"), image: S.wsImg, published: f.published.checked
    };
    if (!row.title_he) return toast("חסר שם סדנה");
    const q = S.wsEditing ? sb.from("workshops").update(row).eq("id", S.wsEditing.id) : sb.from("workshops").insert(row);
    const { error } = await q; if (error) return fail(error);
    $("#wsDlg").close(); toast("נשמר ✓"); loadWorkshops();
  };
  $("#newWorkshop").onclick = () => openWorkshop(null);
  $("#wsDelete").onclick = async () => {
    if (!S.wsEditing || !confirm("למחוק את הסדנה? ההרשמות יישארו שמורות.")) return;
    const { error } = await sb.from("workshops").delete().eq("id", S.wsEditing.id);
    if (error) return fail(error); $("#wsDlg").close(); toast("נמחק"); loadWorkshops();
  };

  /* ================= signups ================= */
  async function loadSignups() {
    const { data, error } = await sb.from("workshop_signups").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) return fail(error);
    S.signups = data; renderSignups(); renderWorkshops(); updateBadge();
  }
  function updateBadge() {
    let seen = null; try { seen = localStorage.getItem("rs_seen_signups"); } catch (e) {}
    const n = S.signups.filter(s => !seen || s.created_at > seen).length;
    const d = $("#newSignups"); d.textContent = n; d.hidden = n === 0;
  }
  function renderSignupFilter() {
    const sel = $("#signupFilter"), cur = sel.value;
    sel.innerHTML = `<option value="">כל הסדנאות</option>` + S.workshops.map(w => `<option value="${w.id}">${esc(w.title_he)} · ${esc(fmtWhen(w.starts_at))}</option>`).join("");
    sel.value = cur;
  }
  $("#signupFilter").onchange = renderSignups;
  function renderSignups() {
    const f = $("#signupFilter").value;
    const rows = S.signups.filter(s => !f || s.workshop_id === f);
    const wsName = id => { const w = S.workshops.find(x => x.id === id); return w ? w.title_he : "סדנה שנמחקה"; };
    const STATUS = { new: "חדש", confirmed: "אושר", cancelled: "בוטל" };
    $("#signupList").innerHTML = rows.length ? rows.map(s => {
      const phone = s.phone.replace(/[^0-9+]/g, ""), intl = phone.replace(/^\+/, "").replace(/^0/, "972");
      return `<div class="row signup">
        <div class="line"><h3>${esc(s.name)}</h3><span class="tag ${s.status === "confirmed" ? "ok" : s.status === "cancelled" ? "bad" : ""}">${STATUS[s.status]}</span></div>
        <div class="sub">${esc(wsName(s.workshop_id))} · ${s.participants} משתתפים · ${esc(new Date(s.created_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }))}</div>
        ${s.note ? `<div>${esc(s.note)}</div>` : ""}
        <div class="acts">
          <a class="chip" href="tel:${esc(phone)}" dir="ltr">${esc(s.phone)}</a>
          <a class="chip" target="_blank" rel="noopener" href="https://wa.me/${esc(intl)}?text=${encodeURIComponent(`היי ${s.name}, כאן רבקה מ-Rébecca Studio לגבי ההרשמה ל${wsName(s.workshop_id)} 🙂`)}">וואטסאפ</a>
          <select data-status="${s.id}" aria-label="סטטוס" style="width:auto">
            ${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${k === s.status ? "selected" : ""}>${l}</option>`).join("")}
          </select>
          <button class="chip" type="button" data-sdel="${s.id}">מחיקה</button>
        </div>
      </div>`;
    }).join("") : `<div class="empty">אין הרשמות עדיין.</div>`;
  }
  $("#signupList").addEventListener("change", async e => {
    const sel = e.target.closest("select[data-status]"); if (!sel) return;
    const { error } = await sb.from("workshop_signups").update({ status: sel.value }).eq("id", sel.dataset.status);
    if (error) return fail(error);
    S.signups.find(s => s.id === sel.dataset.status).status = sel.value; renderSignups(); renderWorkshops(); toast("עודכן ✓");
  });
  $("#signupList").addEventListener("click", async e => {
    const b = e.target.closest("button[data-sdel]"); if (!b || !confirm("למחוק את ההרשמה?")) return;
    const { error } = await sb.from("workshop_signups").delete().eq("id", b.dataset.sdel);
    if (error) return fail(error); loadSignups();
  });
  $("#exportSignups").onclick = () => {
    const wsName = id => (S.workshops.find(x => x.id === id) || {}).title_he || "";
    const q = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const lines = [["סדנה", "שם", "טלפון", "משתתפים", "הערה", "סטטוס", "נרשם"].map(q).join(",")]
      .concat(S.signups.map(s => [wsName(s.workshop_id), s.name, s.phone, s.participants, s.note, s.status, new Date(s.created_at).toLocaleString("he-IL")].map(q).join(",")));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "הרשמות-סדנאות.csv"; a.click();
  };

  /* ================= settings ================= */
  async function loadSettings() {
    const { data, error } = await sb.from("settings").select("data").eq("id", 1).single();
    if (error) return fail(error);
    S.settings = data.data || {};
    applyStudioLink();
    const f = $("#settingsForm");
    Array.from(f.elements).forEach(el => {
      if (!el.name) return;
      if (el.type === "radio") el.checked = (S.settings[el.name] || "mono") === el.value;
      else el.value = S.settings[el.name] == null ? "" : S.settings[el.name];
    });
  }
  $("#settingsForm").onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target), next = { ...S.settings };
    for (const [k, v] of fd.entries()) next[k] = String(v).trim();
    next.whatsapp = (next.whatsapp || "").replace(/[^0-9]/g, "");
    const { error } = await sb.from("settings").update({ data: next }).eq("id", 1);
    if (error) return fail(error); S.settings = next; applyStudioLink(); toast("ההגדרות נשמרו ✓");
  };
  $$("[data-copy]").forEach(b => b.onclick = async () => { const u = SITE + b.dataset.copy; try { await navigator.clipboard.writeText(u); toast("הועתק: " + u); } catch (e) { prompt("", u); } });
  $$("[data-wa-share]").forEach(b => b.onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent("הקטלוג של Rébecca Studio 🌿\n" + SITE + b.dataset.waShare)}`, "_blank", "noopener"));
  $("#pwForm").onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password: e.target.pw.value });
    if (error) return fail(error); e.target.reset(); toast("הסיסמה עודכנה ✓");
  };

  /* ================= share / social tools ================= */
  function captionFor(p) {
    const link = p.slug ? `${SITE}/p/${p.slug}` : SITE;
    const tags = { soap: "#סבון_טבעי #סבוןבעבודתיד #handmadesoap", candle: "#נרות #נרותבעבודתיד #handmadecandles", bundle: "#מארזמתנה #מתנה #giftbox", other: "#עבודתיד" }[p.category];
    const body = [
      `${p.name_he} 🌿`,
      p.short_he || "",
      p.desc_he ? p.desc_he.split("\n")[0] : "",
      p.price != null ? `₪${Number(p.price)}${p.price_note_he ? " · " + p.price_note_he : ""}` : ""
    ].filter(Boolean).join("\n");
    return `${body}\n\nבעבודת יד, בכמויות קטנות, בסטודיו בכרמיאל.\nלהזמנה: ${link}\n\n${tags} #rebeccastudio #כרמיאל #עבודתיד`;
  }
  function openShare(p) {
    S.share = p; S.fmt = "square";
    const link = p.slug ? `${SITE}/p/${p.slug}` : SITE;
    $("#shareName").textContent = p.name_he;
    $("#shWa").href = `https://wa.me/?text=${encodeURIComponent(`${p.name_he} 🌿\n${link}`)}`;
    $("#shFb").href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
    $("#shCaption").value = captionFor(p);
    $$("#shareDlg [data-fmt]").forEach(x => x.classList.toggle("on", x.dataset.fmt === "square"));
    $("#shareDlg").showModal(); drawCard();
  }
  $("#shCopyLink").onclick = async () => { const u = S.share.slug ? `${SITE}/p/${S.share.slug}` : SITE; try { await navigator.clipboard.writeText(u); toast("הקישור הועתק"); } catch (e) { prompt("", u); } };
  $("#shCopyCaption").onclick = async () => { try { await navigator.clipboard.writeText($("#shCaption").value); toast("הטקסט הועתק — אפשר להדביק באינסטגרם/פייסבוק"); } catch (e) { $("#shCaption").select(); } };
  $$("#shareDlg [data-fmt]").forEach(b => b.onclick = () => { S.fmt = b.dataset.fmt; $$("#shareDlg [data-fmt]").forEach(x => x.classList.toggle("on", x === b)); drawCard(); });

  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
  async function drawCard() {
    const p = S.share, c = $("#shCanvas"), story = S.fmt === "story";
    c.width = 1080; c.height = story ? 1920 : 1080;
    const g = c.getContext("2d"), W = c.width, H = c.height;
    const dark = (S.settings.theme === "brand") ? "#1e3a2c" : "#111111", paper = (S.settings.theme === "brand") ? "#fbf8f2" : "#ffffff";
    g.fillStyle = paper; g.fillRect(0, 0, W, H);
    try { await document.fonts.load('64px "Playfair Display"'); await document.fonts.load('600 60px "Assistant"'); await document.fonts.load('48px "Frank Ruhl Libre"'); } catch (e) {}
    const band = story ? 520 : 250, imgH = H - band;
    if (p.images && p.images[0]) {
      try {
        const im = await loadImg(abs(p.images[0]));
        const k = Math.max(W / im.width, imgH / im.height), w = im.width * k, h = im.height * k;
        g.drawImage(im, (W - w) / 2, (imgH - h) / 2, w, h);
      } catch (e) { console.warn("image", e); }
    }
    g.fillStyle = paper; g.fillRect(0, imgH, W, band);
    g.fillStyle = dark; g.textAlign = "center"; g.direction = "rtl";
    g.font = `500 ${story ? 76 : 62}px "Frank Ruhl Libre", serif`;
    g.fillText(p.name_he, W / 2, imgH + (story ? 150 : 95), W - 80);
    g.font = `600 ${story ? 48 : 40}px "Assistant", sans-serif`;
    const priceLine = p.price != null ? `₪${Number(p.price)}` : (p.short_he || "");
    if (priceLine) g.fillText(priceLine, W / 2, imgH + (story ? 240 : 155), W - 80);
    g.direction = "ltr";
    g.font = `${story ? 54 : 40}px "Playfair Display", serif`;
    g.letterSpacing = "8px";
    g.fillText("RÉBECCA", W / 2, H - (story ? 120 : 38));
    g.letterSpacing = "0px";
    if (story) { g.font = `600 36px "Assistant", sans-serif`; g.direction = "rtl"; g.fillText("להזמנה — קישור בפרופיל / וואטסאפ", W / 2, H - 210); }
  }
  function canvasBlob() { return new Promise(res => $("#shCanvas").toBlob(res, "image/jpeg", 0.92)); }
  $("#shDownload").onclick = async () => {
    try { const b = await canvasBlob(); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `${S.share.slug || "rebecca"}-${S.fmt}.jpg`; a.click(); }
    catch (e) { fail(e); }
  };
  $("#shShareImg").onclick = async () => {
    try {
      const b = await canvasBlob(), file = new File([b], `${S.share.slug || "rebecca"}.jpg`, { type: "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text: $("#shCaption").value });
      else { toast("בדפדפן הזה אין שיתוף ישיר — מורידה את התמונה"); $("#shDownload").click(); }
    } catch (e) { if (e.name !== "AbortError") fail(e); }
  };

  sb.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") showLogin(); });
  boot().catch(fail);
})();
