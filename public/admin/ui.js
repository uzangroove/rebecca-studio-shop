/* Rébecca Studio — "בוטיק" admin look (Oct 2026)
   Home screen of floating photoreal objects (rendered in Blender), objects in the
   side rail, soap-bar buttons and acrylic panels. The look is per device and can be
   switched back to the classic green/gold look in Settings. Navigation only — every
   object opens an existing screen (products, workshops, calculator, data tables). */
(function () {
  const KEY = "rs_admin_look";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const getLook = () => { try { return localStorage.getItem(KEY) || "boutique"; } catch (e) { return "boutique"; } };
  const isBoutique = () => document.documentElement.classList.contains("boutique");

  const SECTIONS = [
    ["מוצרים", ["soaps", "candle", "gift"]],
    ["סדנה", ["dropper", "calc", "mold", "chalk"]],
    ["עסק", ["bag", "carton", "papers"]]
  ];
  const O = {
    soaps:   { n: "סבונים",   d: "קטלוג ומלאי",          go: { tab: "products", cat: "soap" } },
    candle:  { n: "נרות",     d: "קטלוג ומלאי",          go: { tab: "products", cat: "candle" } },
    gift:    { n: "מארזים",   d: "סטים ומתנות",          go: { tab: "products", cat: "bundle" } },
    dropper: { n: "מתכונים",  d: "מתכונים וחומרי גלם",   go: { tab: "data", table: "recipes" } },
    calc:    { n: "מחשבון",   d: "חישוב מתכון",          go: { tab: "calc" } },
    mold:    { n: "תבניות",   d: "תבניות וכלים",         go: { tab: "data", table: "molds_tools" } },
    chalk:   { n: "סדנאות",   d: "מפגשים והרשמה",        go: { tab: "workshops" } },
    bag:     { n: "לקוחות",   d: "לקוחות והזמנות",       go: { tab: "data", table: "customers" } },
    carton:  { n: "ספקים",    d: "רכש ומשלוחים",         go: { tab: "data", table: "suppliers" } },
    papers:  { n: "חשבוניות", d: "הצעות, הזמנות וקבלות", go: { tab: "data", table: "sales_docs" } }
  };
  const ORDER = SECTIONS.flatMap(s => s[1]);
  const img = (kind, k) => `/admin/ui/${kind}-${k}.webp`;

  /* ---------- build the home screen and the object rail ---------- */
  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? "בוקר טוב" : h < 17 ? "צהריים טובים" : "ערב טוב";
  }
  function buildHome() {
    const home = $("#homeView");
    if (!home) return;
    $("#homeHello").textContent = greeting() + ", רבקה";
    $("#homeSections").innerHTML = SECTIONS.map(([title, keys]) => `
      <section class="home-sec" aria-label="${title}">
        <h2 class="home-h">${title}</h2>
        <div class="home-grid">${keys.map((k, i) => `
          <button class="hobj" type="button" data-go="${k}">
            <span class="stage">
              <span class="halo"></span><span class="shadow" style="animation-delay:${(-(ORDER.indexOf(k) * 0.53) % 4.2).toFixed(2)}s"></span>
              <span class="lift"><img class="obj" src="${img("obj", k)}" alt="" style="animation-delay:${(-(ORDER.indexOf(k) * 0.53) % 4.2).toFixed(2)}s"></span>
            </span>
            <span class="hname">${O[k].n}</span><span class="hsub">${O[k].d}</span>
          </button>`).join("")}
        </div>
      </section>`).join("");
  }
  function buildRail() {
    const rail = $("#objRail");
    if (!rail) return;
    rail.innerHTML = ORDER.map(k => `<button class="orb" type="button" data-go="${k}"><img src="${img("rail", k)}" alt="">${O[k].n}</button>`).join("");
  }

  /* ---------- navigation ---------- */
  let programmatic = false;
  function clickTab(tab) {
    const b = $(`.tab[data-tab="${tab}"]`);
    if (!b) return;
    programmatic = true;
    try { b.click(); } finally { programmatic = false; }
  }
  function markActive(k) {
    $$(".orb").forEach(b => b.classList.toggle("on", b.dataset.go === k));
  }
  function setHeadObject(k) {
    $$(".vh-obj").forEach(x => x.remove());
    if (!k) return;
    const view = $(".view:not([hidden])");
    const head = view && $(".view-head", view);
    if (!head) return;
    const im = document.createElement("img");
    im.className = "vh-obj"; im.src = img("obj", k); im.alt = "";
    head.prepend(im);
  }
  function go(k) {
    const o = O[k];
    if (!o) return;
    const g = o.go;
    if (g.table && window.RSAdmin) window.RSAdmin.openTable(g.table);
    clickTab(g.tab);
    if (g.cat) { const chip = $(`#prodCats .chip[data-cat="${g.cat}"]`); if (chip) chip.click(); }
    markActive(k);
    setHeadObject(k);
  }
  function goHome() { clickTab("home"); markActive(null); setHeadObject(null); }

  document.addEventListener("click", e => {
    const h = e.target.closest(".hobj");
    if (h) {
      if (document.body.classList.contains("launching")) return;
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return go(h.dataset.go);
      document.body.classList.add("launching");
      h.classList.add("launch");
      setTimeout(() => { document.body.classList.remove("launching"); h.classList.remove("launch"); go(h.dataset.go); }, 280);
      return;
    }
    const r = e.target.closest(".orb");
    if (r) return go(r.dataset.go);
    if (e.target.closest(".rail-top") && isBoutique()) return goHome();
  });
  // a normal tab click (not one of ours) clears the object highlight
  document.addEventListener("click", e => {
    if (!programmatic && e.target.closest(".tab")) { markActive(null); setHeadObject(null); }
  }, true);

  /* ---------- look switch (Settings) ---------- */
  function applyLook(look, nav) {
    const b = look === "boutique";
    document.documentElement.classList.toggle("boutique", b);
    $$('input[name="adminLook"]').forEach(r => { r.checked = r.value === look; });
    if (!nav) return;
    const homeOpen = $("#homeView") && !$("#homeView").hidden;
    if (!b && homeOpen) clickTab("products");
  }
  document.addEventListener("change", e => {
    if (e.target.name !== "adminLook") return;
    try { localStorage.setItem(KEY, e.target.value); } catch (err) {}
    applyLook(e.target.value, true);
  });

  buildHome();
  buildRail();
  applyLook(getLook(), false);
  if (isBoutique()) goHome();
})();
