/* Rébecca Studio — "פרטי ייצור" inside the product editor (internal; never shown on the public site).
   Reads materials / recipes / molds / supplier prices, saves product_details + product_materials. */
window.RSStudio = function (sb, { $, $$, esc, toast }) {
  const CAT_MAP = { soap: "SP", candle: "CN", bundle: "ST", other: "TL" };
  const SKU_CATS = [["SP", "סבון"], ["CN", "נר"], ["ST", "מארז"], ["WS", "סדנה"], ["MO", "תבנית"], ["TL", "כלי עזר"], ["SM", "חותמת"], ["VS", "כלי לנר"]];
  const TAGS = {
    "קהל": ["תינוקות", "ילדים", "נשים", "גברים", "כל המשפחה"],
    "סוג עור": ["רגיל", "יבש", "שמן", "רגיש", "מעורב", "בוגר", "בעייתי"],
    "שימוש": ["פנים", "גוף", "ידיים", "שיער", "גילוח", "רגליים", "מטבח", "בית (נר)"],
    "אופי / זמן": ["בוקר", "ערב", "מרגיע", "ממריץ", "מרענן", "מפנק"],
    "עונה / אירוע": ["קיץ", "חורף", "אביב", "סתיו", "ראש השנה", "חנוכה", "פסח", "מתנה", "חתונה / כלות", "יום הולדת"]
  };
  const D = { materials: [], byId: {}, recipes: {}, molds: [], price: {}, details: {}, loaded: false };
  const st = { productId: null, existing: null, mats: [], recipeMats: [], lead: null, leadAuto: true, tags: {}, touched: false };
  const fmt = n => (Math.round(n * 100) / 100).toFixed(2);

  /* ---------- data ---------- */
  async function load() {
    const [m, r, l, mo, pr, pd] = await Promise.all([
      sb.from("materials").select("id,family,category,name_he,name_en").order("category").order("name_he"),
      sb.from("recipes").select("id,name,method,oils_g,lye_g,lye_type,liquid_g,fragrance_g,batch_g").order("id"),
      sb.from("recipe_lines").select("recipe_id,material_id,pct_of_oils,sort_order").order("sort_order"),
      sb.from("molds_tools").select("id,name,kind,fill_grams,cavities").order("id"),
      sb.from("supplier_item_prices").select("material_id,price_per_unit").not("material_id", "is", null),
      sb.from("product_details").select("product_id,sku,status")
    ]);
    const err = [m, r, l, mo, pr, pd].find(x => x.error);
    if (err) { console.warn("studio data", err.error); return false; }
    D.materials = m.data; D.byId = Object.fromEntries(m.data.map(x => [x.id, x]));
    D.recipes = Object.fromEntries(r.data.map(x => [x.id, { ...x, lines: [] }]));
    l.data.forEach(x => { if (D.recipes[x.recipe_id]) D.recipes[x.recipe_id].lines.push([x.material_id, Number(x.pct_of_oils) || 0]); });
    D.molds = mo.data;
    D.price = {};
    pr.data.forEach(x => { const v = Number(x.price_per_unit); if (v > 0 && (!D.price[x.material_id] || v < D.price[x.material_id])) D.price[x.material_id] = v; });
    D.details = Object.fromEntries(pd.data.map(x => [x.product_id, x]));
    D.loaded = true;
    fillSelects();
    return true;
  }
  function fillSelects() {
    $("#stCat").innerHTML = SKU_CATS.map(([c, n]) => `<option value="${c}">${c} · ${esc(n)}</option>`).join("");
    $("#stRecipe").innerHTML = `<option value="">— בלי מתכון —</option>` + Object.values(D.recipes).map(x => `<option value="${esc(x.id)}">${esc(x.id)} · ${esc(x.name)}</option>`).join("");
    $("#stMold").innerHTML = `<option value="">— בלי תבנית —</option>` + D.molds.map(x => `<option value="${esc(x.id)}">${esc(x.id)} · ${esc(x.name)}</option>`).join("");
  }
  const skuOf = productId => (D.details[productId] || {}).sku || null;

  /* ---------- open / render ---------- */
  async function open(p, category) {
    st.productId = p ? p.id : null; st.existing = null; st.mats = []; st.recipeMats = []; st.lead = null; st.leadAuto = true; st.tags = {}; st.touched = false;
    $("#stSearch").value = ""; $("#stWeight").value = ""; $("#stFree").value = ""; $("#stStatus").value = "טיוטה";
    $("#stRecipe").value = ""; $("#stMold").value = ""; $("#stCat").value = CAT_MAP[category] || "SP";
    $("#studioBox").open = false;
    if (!D.loaded) { $("#stBody").hidden = true; $("#stLoading").hidden = false; if (!(await load())) { $("#stLoading").textContent = "לא ניתן לטעון את מאגר החומרים כרגע."; return; } }
    $("#stBody").hidden = false; $("#stLoading").hidden = true;
    if (st.productId) {
      const [d, pm] = await Promise.all([
        sb.from("product_details").select("*").eq("product_id", st.productId).maybeSingle(),
        sb.from("product_materials").select("material_id,is_lead").eq("product_id", st.productId)
      ]);
      if (d.data) {
        const v = d.data; st.existing = v;
        if (v.sku_cat) $("#stCat").value = v.sku_cat; else if (v.sku) $("#stCat").value = v.sku.slice(0, 2);
        $("#stRecipe").value = v.recipe_id || ""; $("#stMold").value = v.mold_tool_id || "";
        $("#stWeight").value = v.unit_weight_g || ""; $("#stFree").value = v.free_text || ""; $("#stStatus").value = v.status || "טיוטה";
        st.tags = JSON.parse(JSON.stringify(v.tags || {})); st.lead = v.lead_material_id || null; st.leadAuto = !st.lead;
        const r = D.recipes[v.recipe_id]; st.recipeMats = r ? r.lines.map(x => x[0]) : [];
      }
      if (pm.data) { st.mats = pm.data.map(x => x.material_id).filter(id => D.byId[id]); const ld = pm.data.find(x => x.is_lead); if (ld) st.lead = ld.material_id; }
    }
    renderAll();
  }
  function renderAll() { renderSelected(); renderPicker(); renderTags(); renderSku(); checkRecipe(); renderCost(); }

  function renderSku() {
    const fixed = st.existing && st.existing.sku;
    const lead = st.lead && D.byId[st.lead];
    const preview = fixed || (lead ? `${$("#stCat").value}-${lead.family}-…` : "");
    $("#stSku").value = fixed || (preview ? preview + " (ייקבע בשמירה)" : "ייקבע כשיש רכיב מוביל");
    $("#stCat").disabled = !!fixed;
    $("#stSkuBadge").textContent = fixed ? fixed : "";
  }
  function renderSelected() {
    const box = $("#stSel");
    if (!st.mats.length) { box.innerHTML = `<span class="hint" style="margin:0">עדיין לא נבחרו רכיבים. בחירת מתכון מכניסה את השמנים שלו.</span>`; return; }
    box.innerHTML = st.mats.map(id => {
      const m = D.byId[id]; if (!m) return "";
      const lead = st.lead === id, fromR = st.recipeMats.includes(id);
      return `<button type="button" class="chip ${lead ? "on" : ""}" data-stmat="${esc(id)}" title="${lead ? "רכיב מוביל — קובע את המק״ט. הקשה נוספת מסירה." : "הקשה הופכת לרכיב מוביל"}">${lead ? "★ " : ""}${esc(m.name_he)}${fromR ? ` <small class="st-from">מהמתכון</small>` : ""}</button>`;
    }).join("");
  }
  function renderPicker() {
    const q = $("#stSearch").value.trim().toLowerCase(), box = $("#stPicker");
    if (!q) { box.innerHTML = ""; box.hidden = true; return; }
    const hits = D.materials.filter(m => m.name_he.toLowerCase().includes(q) || (m.name_en || "").toLowerCase().includes(q) || m.id.toLowerCase().includes(q)).slice(0, 40);
    box.hidden = false;
    box.innerHTML = hits.length ? hits.map(m => `<button type="button" class="chip ${st.mats.includes(m.id) ? "on" : ""}" data-stpick="${esc(m.id)}">${esc(m.name_he)} <small class="muted">${esc(m.category)}</small></button>`).join("")
      : `<span class="hint" style="margin:0">לא נמצא רכיב בשם הזה.</span>`;
  }
  function renderTags() {
    $("#stTags").innerHTML = Object.entries(TAGS).map(([g, vals]) => `<div class="st-group"><b>${esc(g)}</b><div class="chips">${vals.map(v =>
      `<button type="button" class="chip ${(st.tags[g] || []).includes(v) ? "on" : ""}" data-sttag="${esc(g)}" data-v="${esc(v)}">${esc(v)}</button>`).join("")}</div></div>`).join("");
  }
  function defaultLead() {
    const scent = st.mats.find(id => /^(EO|FO)-/.test(id)); if (scent) return scent;
    const r = D.recipes[$("#stRecipe").value];
    if (r) { const top = r.lines.slice().sort((a, b) => b[1] - a[1]).find(l => st.mats.includes(l[0])); if (top) return top[0]; }
    return st.mats[0] || null;
  }
  function toggleMat(id) {
    st.touched = true;
    if (st.mats.includes(id)) st.mats = st.mats.filter(x => x !== id); else st.mats.push(id);
    if (st.lead && !st.mats.includes(st.lead)) { st.lead = null; st.leadAuto = true; }
    if (!st.lead || st.leadAuto) { st.lead = defaultLead(); st.leadAuto = true; }
    renderAll();
  }
  function applyRecipe(id) {
    st.touched = true;
    st.mats = st.mats.filter(m => !st.recipeMats.includes(m));
    const r = D.recipes[id];
    st.recipeMats = r ? r.lines.slice().sort((a, b) => b[1] - a[1]).map(l => l[0]).filter(m => D.byId[m]) : [];
    st.mats = [...st.recipeMats, ...st.mats.filter(m => !st.recipeMats.includes(m))];
    if (st.lead && !st.mats.includes(st.lead)) { st.lead = null; st.leadAuto = true; }
    if (!st.lead || st.leadAuto) { st.lead = defaultLead(); st.leadAuto = true; }
    const w = moldWeight($("#stMold").value); if (w && !$("#stWeight").value) $("#stWeight").value = w;
    renderAll();
  }
  function checkRecipe() {
    const w = $("#stWarn");
    if (!$("#stRecipe").value) { w.hidden = true; return; }
    const extra = st.mats.filter(m => /^(OIL|BTR)-/.test(m) && !st.recipeMats.includes(m));
    const missing = st.recipeMats.filter(m => !st.mats.includes(m));
    const parts = [];
    if (extra.length) parts.push("לא במתכון: " + extra.map(m => D.byId[m].name_he).join(", "));
    if (missing.length) parts.push("הוסרו מהמתכון: " + missing.map(m => D.byId[m].name_he).join(", "));
    w.hidden = !parts.length;
    w.textContent = parts.length ? parts.join(" · ") + ". אם הסבון שונה מהמתכון, צריך לעדכן מתכון או ליצור חדש (בקרוב גם מכאן)." : "";
  }
  function moldWeight(id) {
    const m = D.molds.find(x => x.id === id); if (!m) return null;
    const fill = Number(m.fill_grams) || 0, cav = Number(m.cavities) || 0;
    return fill && cav ? Math.round(fill / cav) : null;
  }

  /* ---------- cost ---------- */
  function computeCost() {
    const r = D.recipes[$("#stRecipe").value]; if (!r) return null;
    const oil = Number(r.oils_g) || 0; if (!oil) return null;
    const rows = [], missing = [];
    for (const [id, pct] of r.lines) {
      const m = D.byId[id], g = oil * pct, p = D.price[id];
      if (!(p > 0)) missing.push(m ? m.name_he : id);
      rows.push([m ? m.name_he : id, g, p > 0 ? g * p / 1000 : null]);
    }
    const lyeId = r.lye_type === "KOH" ? "BAS-KOH" : "BAS-LYE", lyeG = Number(r.lye_g) || 0;
    if (lyeG) { const p = D.price[lyeId]; if (!(p > 0)) missing.push("סודה"); rows.push(["סודה קאוסטית", lyeG, p > 0 ? lyeG * p / 1000 : null]); }
    const scents = st.mats.filter(id => /^(EO|FO)-/.test(id)), frag = Number(r.fragrance_g) || 0;
    if (scents.length && frag) for (const id of scents) { const g = frag / scents.length, p = D.price[id]; if (!(p > 0)) missing.push(D.byId[id].name_he); rows.push([D.byId[id].name_he, g, p > 0 ? g * p / 1000 : null]); }
    const batch = Number(r.batch_g) || (oil + (Number(r.liquid_g) || 0) + lyeG + frag);
    const total = rows.reduce((a, x) => a + (x[2] || 0), 0), per100 = batch ? total / batch * 100 : 0;
    const w = parseFloat(String($("#stWeight").value).replace(",", ".")) || 0;
    return { rows, missing, total, batch, per100, w, unit: w ? per100 * w / 100 : null, scentNoFrag: scents.length && !frag };
  }
  function renderCost() {
    const c = computeCost(), box = $("#stCost");
    if (!c) { box.innerHTML = `<span class="hint" style="margin:0">בוחרים מתכון כדי לראות עלות חומרי גלם.</span>`; return; }
    const notes = [];
    if (c.unit === null) notes.push("ממלאים משקל יחידה כדי לראות עלות ליחידה.");
    if (c.missing.length) notes.push("חסר מחיר ל: " + c.missing.join(", ") + ".");
    if (c.scentNoFrag) notes.push("נבחר ריח, אבל במתכון אין כמות ריח.");
    notes.push("לפי המחיר הזול אצל הספקים, בלי צבעים, תוספות, אריזה ועבודה.");
    box.innerHTML = `<div class="st-big">${c.unit !== null ? `<span><b>${fmt(c.unit)} ₪</b> ליחידה של ${c.w} גרם</span>` : ""}<span><b>${fmt(c.per100)} ₪</b> ל-100 גרם</span></div>
      <p class="hint" style="margin:0">${esc(notes.join(" "))}</p>
      <details><summary>פירוט לאצווה של ${Math.round(c.batch)} גרם · ${fmt(c.total)} ₪</summary>
      <table class="st-table">${c.rows.map(([n, g, cost]) => `<tr><td>${esc(n)}</td><td>${Math.round(g * 10) / 10} g</td><td>${cost === null ? "—" : fmt(cost) + " ₪"}</td></tr>`).join("")}</table></details>`;
  }

  /* ---------- events ---------- */
  $("#stSel").addEventListener("click", e => {
    const b = e.target.closest("[data-stmat]"); if (!b) return;
    const id = b.dataset.stmat;
    if (st.lead === id) toggleMat(id); else { st.lead = id; st.leadAuto = false; st.touched = true; renderSelected(); renderSku(); }
  });
  $("#stPicker").addEventListener("click", e => { const b = e.target.closest("[data-stpick]"); if (b) toggleMat(b.dataset.stpick); });
  $("#stSearch").addEventListener("input", renderPicker);
  $("#stTags").addEventListener("click", e => {
    const b = e.target.closest("[data-sttag]"); if (!b) return;
    const g = b.dataset.sttag, v = b.dataset.v, arr = st.tags[g] || (st.tags[g] = []);
    const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v);
    st.touched = true; renderTags();
  });
  $("#stRecipe").addEventListener("change", e => applyRecipe(e.target.value));
  $("#stMold").addEventListener("change", e => { st.touched = true; const w = moldWeight(e.target.value); if (w) $("#stWeight").value = w; renderCost(); });
  $("#stWeight").addEventListener("input", () => { st.touched = true; renderCost(); });
  $("#stCat").addEventListener("change", () => { st.touched = true; renderSku(); });
  $("#prodForm").category.addEventListener("change", e => { if (!$("#stCat").disabled) { $("#stCat").value = CAT_MAP[e.target.value] || "SP"; renderSku(); } });
  ["#stFree", "#stStatus"].forEach(s => $(s).addEventListener("input", () => { st.touched = true; }));

  /* ---------- save (called after the product row is saved) ---------- */
  async function save(productId) {
    if (!D.loaded) return;
    const hasData = st.mats.length || $("#stRecipe").value || $("#stMold").value || $("#stFree").value.trim() || $("#stWeight").value || Object.values(st.tags).some(a => a.length);
    if (!st.existing && !hasData) return;
    if (st.existing && !st.touched) return;
    let sku = st.existing && st.existing.sku;
    const cat = $("#stCat").value, lead = st.lead && D.byId[st.lead];
    if (!sku && lead && cat) {
      const { data, error } = await sb.rpc("next_sku", { p_cat: cat, p_family: lead.family });
      if (error) { toast("המק״ט לא נוצר: " + error.message, 5000); } else sku = data;
    }
    const c = computeCost();
    const row = {
      product_id: productId, sku: sku || null, sku_cat: cat || null, lead_material_id: st.lead || null,
      recipe_id: $("#stRecipe").value || null, mold_tool_id: $("#stMold").value || null,
      tags: st.tags, free_text: $("#stFree").value.trim() || null, status: $("#stStatus").value || "טיוטה",
      unit_weight_g: parseFloat(String($("#stWeight").value).replace(",", ".")) || null,
      cost_estimate: c ? { per_100g: Math.round(c.per100 * 100) / 100, per_unit: c.unit === null ? null : Math.round(c.unit * 100) / 100, missing: c.missing, at: new Date().toISOString().slice(0, 10) } : null
    };
    const { error } = await sb.from("product_details").upsert(row, { onConflict: "product_id" });
    if (error) { toast("פרטי הייצור לא נשמרו: " + error.message, 6000); return; }
    const del = await sb.from("product_materials").delete().eq("product_id", productId);
    if (del.error) { toast("הרכיבים לא נשמרו: " + del.error.message, 6000); return; }
    if (st.mats.length) {
      const ins = await sb.from("product_materials").insert(st.mats.map(id => ({ product_id: productId, material_id: id, is_lead: id === st.lead })));
      if (ins.error) { toast("הרכיבים לא נשמרו: " + ins.error.message, 6000); return; }
    }
    D.details[productId] = { product_id: productId, sku: row.sku, status: row.status };
    return row.sku;
  }

  return { load, open, save, skuOf };
};
