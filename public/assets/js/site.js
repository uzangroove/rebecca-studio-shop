/* Rébecca Studio — public site logic */
(function () {
  const { api, cache, t, pick, applyI18n, price, esc, waLink, fmtDate, applyTheme, toast, productUrl, shareLink } = RS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const state = {
    products: cache.get("products") || [],
    workshops: cache.get("workshops") || [],
    seats: {},
    settings: cache.get("settings") || {},
    cat: "all",
    cart: loadCart(),
    current: null,
    qty: 1
  };

  /* ================= cart ================= */
  function loadCart() { try { return JSON.parse(localStorage.getItem("rs_cart")) || []; } catch (e) { return []; } }
  function saveCart() { try { localStorage.setItem("rs_cart", JSON.stringify(state.cart)); } catch (e) {} renderCartCount(); }
  function addToCart(id, qty) {
    const row = state.cart.find(r => r.id === id);
    if (row) row.qty = Math.min(99, row.qty + qty); else state.cart.push({ id, qty });
    saveCart(); toast(t("added"));
  }
  function cartLines() {
    return state.cart.map(r => ({ ...r, p: state.products.find(p => p.id === r.id) })).filter(r => r.p);
  }
  function renderCartCount() {
    const n = cartLines().reduce((s, r) => s + r.qty, 0);
    const el = $("#cartCount"); el.textContent = n; el.hidden = n === 0;
  }

  /* ================= rendering ================= */
  const catLabel = c => t("cat_" + c);
  const imgOf = p => (p.images && p.images[0]) || "/images/brand/og-cover.jpg";

  function renderGrid() {
    const grid = $("#grid");
    const items = state.products.filter(p => state.cat === "all" || p.category === state.cat);
    // featured first inside "all"
    if (state.cat === "all") items.sort((a, b) => (b.featured - a.featured) || 0);
    if (!items.length) {
      grid.innerHTML = `<p class="muted center">${esc(state.products.length ? t("empty_cat") : t("loading"))}</p>`;
      return;
    }
    grid.innerHTML = items.map((p, i) => {
      const name = pick(p, "name"), short = pick(p, "short");
      const pr = p.price != null ? `<span class="card-price">${price(p.price)}</span>` : `<span class="card-price ask">${esc(t("price_ask"))}</span>`;
      return `<article class="card" style="--i:${Math.min(i, 12)}">
        <button class="card-media" type="button" data-open="${esc(p.slug)}" aria-label="${esc(name)} – ${esc(t("details"))}">
          <img src="${esc(imgOf(p))}" alt="${esc(name)}" loading="${i < 4 ? "eager" : "lazy"}" decoding="async">
          ${p.sold_out ? `<span class="badge">${esc(t("sold_out"))}</span>` : ""}
        </button>
        <div class="card-body">
          <h3 class="card-name">${esc(name)}</h3>
          ${short ? `<p class="card-short">${esc(short)}</p>` : ""}
          <div class="card-foot">${pr}
            <button class="btn" type="button" data-add="${esc(p.id)}" ${p.sold_out ? "disabled" : ""}>${esc(p.sold_out ? t("sold_out") : t("add"))}</button>
          </div>
        </div>
      </article>`;
    }).join("");
  }

  function renderFilters() {
    const cats = new Set(state.products.map(p => p.category));
    $$("#filters .filter").forEach(b => {
      const c = b.dataset.cat;
      b.hidden = c !== "all" && state.products.length > 0 && !cats.has(c);
      b.classList.toggle("active", c === state.cat);
      b.setAttribute("aria-pressed", c === state.cat ? "true" : "false");
    });
  }

  function renderWorkshops() {
    const s = state.settings, list = $("#wsList");
    $("#wsIntro").textContent = pick(s, "workshops_intro");
    const ws = state.workshops;
    const cards = ws.map(w => {
      const title = pick(w, "title");
      const when = w.starts_at ? fmtDate(w.starts_at, RS.lang) : t("by_arrangement");
      const taken = state.seats[w.id] || 0;
      const left = w.seats ? Math.max(0, w.seats - taken) : null;
      const meta = [when, w.duration_min ? `${w.duration_min} ${t("minutes")}` : "", pick(w, "location"), w.price != null ? price(w.price) : ""].filter(Boolean).join(" · ");
      return `<article class="ws-card">
        ${w.image ? `<img src="${esc(w.image)}" alt="" loading="lazy">` : ""}
        <div class="ws-body">
          <h3>${esc(title)}</h3>
          <p class="ws-meta">${esc(meta)}</p>
          ${pick(w, "desc") ? `<p>${esc(pick(w, "desc"))}</p>` : ""}
          ${left != null ? `<p class="ws-meta">${esc(left > 0 ? t("seats_left").replace("{n}", left) : t("full"))}</p>` : ""}
          <button class="btn btn-solid" type="button" data-ws="${esc(w.id)}" ${left === 0 ? "disabled" : ""}>${esc(t("register"))}</button>
        </div>
      </article>`;
    }).join("");
    const cta = `<div class="ws-cta"><a class="btn" target="_blank" rel="noopener" href="${esc(waLink(s.whatsapp, t("private_ws")))}">${esc(t("private_ws"))}</a></div>`;
    list.innerHTML = cards || "";
    let ctaEl = $("#wsCta");
    if (!ctaEl) { ctaEl = document.createElement("div"); ctaEl.id = "wsCta"; ctaEl.style.marginTop = "28px"; list.after(ctaEl); }
    ctaEl.innerHTML = cta;
  }

  function renderSettings() {
    const s = state.settings;
    applyTheme(s);
    $("#heroTag").textContent = pick(s, "tagline") || t("loading");
    $("#aboutText").textContent = pick(s, "about");
    $("#shippingText").textContent = pick(s, "shipping");
    $("#paymentText").textContent = pick(s, "payment");
    const ann = pick(s, "announcement"), annEl = $("#announce");
    annEl.textContent = ann; annEl.hidden = !ann;
    const wa = s.whatsapp || RS_CONFIG.DEFAULT_WHATSAPP;
    const setHref = (sel, url) => { const el = $(sel); if (el) el.href = url; };
    setHref("#tbWa", waLink(wa, ""));
    setHref("#tbMail", `mailto:${s.email || ""}`);
    setHref("#tbTel", `tel:${(s.phone || "").replace(/[^0-9+]/g, "")}`);
    $("#footerContact").innerHTML = [
      s.phone ? `<a href="tel:${esc(s.phone.replace(/[^0-9+]/g, ""))}" dir="ltr">${esc(s.phone)}</a>` : "",
      s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : "",
      esc(pick(s, "city"))
    ].filter(Boolean).join(" · ");
    $("#footerSocial").innerHTML = [["instagram", "Instagram"], ["facebook", "Facebook"], ["tiktok", "TikTok"]]
      .filter(([k]) => s[k]).map(([k, n]) => `<a href="${esc(s[k])}" target="_blank" rel="noopener">${n}</a>`).join(" · ");
  }

  function renderAll() {
    applyI18n();
    renderSettings(); renderFilters(); renderGrid(); renderWorkshops(); renderCartCount();
    if (state.current) fillProduct(state.current);
    if ($("#cartDlg").open) renderCart();
  }

  /* ================= product dialog ================= */
  function fillProduct(p) {
    const name = pick(p, "name");
    $("#pdCat").textContent = catLabel(p.category);
    $("#pdName").textContent = name;
    const note = pick(p, "price_note");
    $("#pdPrice").textContent = p.price != null ? `${price(p.price)}${note ? " · " + note : ""}` : t("price_ask");
    $("#pdDesc").textContent = pick(p, "desc") || pick(p, "short");
    const imgs = (p.images && p.images.length) ? p.images : [imgOf(p)];
    const main = $("#pdImg"); main.src = imgs[0]; main.alt = name;
    $("#pdThumbs").innerHTML = imgs.length > 1 ? imgs.map((src, i) =>
      `<button type="button" data-img="${esc(src)}" aria-current="${i === 0}"><img src="${esc(src)}" alt=""></button>`).join("") : "";
    $("#pdQty").textContent = state.qty;
    const add = $("#pdAdd"); add.disabled = !!p.sold_out; add.textContent = p.sold_out ? t("sold_out") : t("add");
    $("#pdAsk").href = waLink(state.settings.whatsapp, `${t("wa_q")} "${name}"\n${productUrl(p.slug, RS.lang)}`);
  }
  function openProduct(slug, push = true) {
    const p = state.products.find(x => x.slug === slug);
    if (!p) return;
    state.current = p; state.qty = 1; fillProduct(p);
    const d = $("#productDlg"); if (!d.open) d.showModal();
    if (push) history.replaceState(null, "", `?p=${encodeURIComponent(slug)}${location.hash}`);
  }

  /* ================= cart drawer ================= */
  function renderCart() {
    const lines = cartLines(), box = $("#cartItems");
    if (!lines.length) {
      box.innerHTML = `<p class="muted">${esc(t("cart_empty"))}</p>`;
      $("#cartForm").hidden = true; return;
    }
    $("#cartForm").hidden = false;
    box.innerHTML = lines.map(({ p, qty }) => `
      <div class="cart-item">
        <img src="${esc(imgOf(p))}" alt="">
        <div>
          <h3>${esc(pick(p, "name"))}</h3>
          <div class="muted small">${p.price != null ? price(p.price) : esc(t("price_ask"))}</div>
          <div class="qty"><button type="button" data-dec="${p.id}" aria-label="-">−</button><output>${qty}</output><button type="button" data-inc="${p.id}" aria-label="+">+</button></div>
        </div>
        <button class="linklike small" type="button" data-rm="${p.id}">${esc(t("remove"))}</button>
      </div>`).join("");
    const priced = lines.filter(l => l.p.price != null);
    const total = priced.reduce((s, l) => s + Number(l.p.price) * l.qty, 0);
    $("#cartTotal").textContent = priced.length
      ? `${t("total")}: ${price(total)}${priced.length < lines.length ? " · " + t("partial_total") : ""}`
      : t("partial_total");
  }
  function buildOrderMessage(form) {
    const lines = cartLines();
    const L = RS.lang;
    const rows = lines.map(({ p, qty }) => `• ${pick(p, "name", L)} × ${qty}${p.price != null ? ` — ${price(p.price * qty)}` : ""}`);
    const priced = lines.filter(l => l.p.price != null);
    const total = priced.reduce((s, l) => s + Number(l.p.price) * l.qty, 0);
    const fd = new FormData(form);
    const deliv = fd.get("delivery") === "ship" ? `${t("ship")}: ${fd.get("address") || ""}` : t("pickup");
    return [
      t("wa_hello"), "", ...rows, "",
      priced.length ? `${t("wa_total")}: ${price(total)}${priced.length < lines.length ? ` (${t("partial_total")})` : ""}` : null,
      `${t("wa_name")}: ${fd.get("name") || ""}`,
      `${t("wa_delivery")}: ${deliv}`,
      fd.get("note") ? `${t("wa_note")}: ${fd.get("note")}` : null
    ].filter(x => x != null).join("\n");
  }

  /* ================= workshops signup ================= */
  let wsCurrent = null;
  function openSignup(id) {
    const w = state.workshops.find(x => x.id === id); if (!w) return;
    wsCurrent = w;
    $("#wsDlgTitle").textContent = pick(w, "title");
    $("#wsDlgWhen").textContent = w.starts_at ? fmtDate(w.starts_at, RS.lang) : t("by_arrangement");
    $("#wsMsg").textContent = ""; $("#wsForm").reset();
    $("#wsForm button[type=submit]").disabled = false;
    $("#wsDlg").showModal();
  }

  /* ================= events ================= */
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-open],[data-add],[data-ws],[data-img],[data-inc],[data-dec],[data-rm],[data-close],.filter");
    if (!el) return;
    if (el.matches(".filter")) {
      state.cat = el.dataset.cat; renderFilters(); renderGrid(); return;
    }
    if (el.dataset.open) return openProduct(el.dataset.open);
    if (el.dataset.add) return addToCart(el.dataset.add, 1);
    if (el.dataset.ws) return openSignup(el.dataset.ws);
    if (el.dataset.img) {
      $("#pdImg").src = el.dataset.img;
      $$("#pdThumbs button").forEach(b => b.setAttribute("aria-current", b === el ? "true" : "false")); return;
    }
    const id = el.dataset.inc || el.dataset.dec || el.dataset.rm;
    if (id) {
      const row = state.cart.find(r => r.id === id);
      if (row) {
        if (el.dataset.inc) row.qty = Math.min(99, row.qty + 1);
        if (el.dataset.dec) row.qty -= 1;
        if (el.dataset.rm || row.qty <= 0) state.cart = state.cart.filter(r => r.id !== id);
      }
      saveCart(); renderCart(); return;
    }
    if (el.hasAttribute("data-close")) el.closest("dialog").close();
  });

  $("#productDlg").addEventListener("close", () => {
    state.current = null;
    if (new URLSearchParams(location.search).has("p")) history.replaceState(null, "", location.pathname + location.hash);
  });
  $$("dialog").forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); })); // click backdrop
  $("#pdMinus").onclick = () => { state.qty = Math.max(1, state.qty - 1); $("#pdQty").textContent = state.qty; };
  $("#pdPlus").onclick = () => { state.qty = Math.min(99, state.qty + 1); $("#pdQty").textContent = state.qty; };
  $("#pdAdd").onclick = () => { if (state.current) { addToCart(state.current.id, state.qty); $("#productDlg").close(); } };
  $("#pdShare").onclick = () => { if (state.current) shareLink(productUrl(state.current.slug, RS.lang), pick(state.current, "name")); };
  $("#cartBtn").onclick = () => { renderCart(); $("#cartDlg").showModal(); };
  $("#cartClear").onclick = () => { state.cart = []; saveCart(); renderCart(); };
  $$("#cartForm input[name=delivery]").forEach(r => r.onchange = () => { $("#addrRow").hidden = $("#cartForm").delivery.value !== "ship"; });
  $("#cartForm").onsubmit = e => {
    e.preventDefault();
    const msg = buildOrderMessage(e.target);
    window.open(waLink(state.settings.whatsapp, msg), "_blank", "noopener");
  };
  $("#wsForm").onsubmit = async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector("button[type=submit]"), msg = $("#wsMsg");
    const fd = new FormData(f);
    btn.disabled = true; msg.textContent = t("sending");
    try {
      await api.signup({
        workshop_id: wsCurrent.id, name: String(fd.get("name")).trim(), phone: String(fd.get("phone")).trim(),
        participants: Number(fd.get("participants")) || 1, note: String(fd.get("note") || "").trim() || null
      });
      const text = `${t("wa_ws")} "${pick(wsCurrent, "title")}"\n${t("wa_name")}: ${fd.get("name")} · ${t("participants")}: ${fd.get("participants")}`;
      msg.innerHTML = `${esc(t("signup_ok"))}<br><a class="btn" style="margin-top:10px" target="_blank" rel="noopener" href="${esc(waLink(state.settings.whatsapp, text))}">${esc(t("continue_wa"))}</a>`;
      loadSeats().then(renderWorkshops);
    } catch (err) {
      console.error(err); msg.textContent = t("signup_err"); btn.disabled = false;
    }
  };
  $("#langBtn").onclick = () => {
    RS.lang = RS.lang === "he" ? "en" : "he"; RS.setLang(RS.lang); renderAll();
  };

  /* decorative cursor ring on desktop */
  if (matchMedia("(pointer:fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const ring = document.createElement("div"); ring.className = "cursor-ring"; ring.setAttribute("aria-hidden", "true"); document.body.appendChild(ring);
    let x = 0, y = 0, rx = 0, ry = 0;
    addEventListener("mousemove", e => { x = e.clientX; y = e.clientY; ring.classList.add("on"); ring.classList.toggle("big", !!e.target.closest("a,button,.card-media")); }, { passive: true });
    document.addEventListener("mouseleave", () => ring.classList.remove("on"));
    (function loop() { rx += (x - rx) * .2; ry += (y - ry) * .2; ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`; requestAnimationFrame(loop); })();
    ring.style.left = "0"; ring.style.top = "0";
  }

  /* ================= data ================= */
  async function loadSeats() {
    const rows = await api.seats();
    state.seats = {}; (rows || []).forEach(r => { state.seats[r.workshop_id] = Number(r.taken); });
  }
  async function load() {
    $("#year").textContent = new Date().getFullYear();
    renderAll();
    try {
      const [products, workshops, settings] = await Promise.all([api.products(), api.workshops(), api.settings(), loadSeats()]);
      state.products = products; state.workshops = workshops; state.settings = settings;
      cache.set("products", products); cache.set("workshops", workshops); cache.set("settings", settings);
      renderAll();
    } catch (err) {
      console.error(err);
      if (!state.products.length) $("#grid").innerHTML = `<p class="muted center">${esc(t("load_err"))}</p>`;
    }
    const slug = new URLSearchParams(location.search).get("p");
    if (slug) openProduct(slug, false);
    const cat = new URLSearchParams(location.search).get("cat");
    if (cat && ["soap", "candle", "bundle", "other"].includes(cat)) { state.cat = cat; renderFilters(); renderGrid(); }
  }
  load();
})();
