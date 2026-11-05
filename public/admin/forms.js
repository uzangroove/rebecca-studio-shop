/* Rébecca Studio — printable fill-in forms (טפסי מילוי).
   One A4 page per existing product, or per group of new studio images (one soap = one group):
   the photo(s), what is already known, and lines for Rebecca to write on.
   A legend page lists the recipe and mold codes, so the form only asks for a code.
   formsHtml() is pure (tested in node); RSForms() wires the dialog in the admin. */
(function (root) {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CAT = { soap: "סבון", candle: "נר", bundle: "מארז", other: "אחר" };

  const short = id => String(id || "").replace(/-/g, "").slice(0, 6).toUpperCase();
  /** A short, stable code printed on every form, so a photo of a filled form matches its product. */
  function formCode(p) { return "F-" + short(p.id); }
  /** Code of one image from "תמונות חדשות", and of a form made from a group of them. */
  function imageCode(m) { return "I-" + short(m.id); }
  function groupCode(g) { return "N-" + short(g.images[0] && g.images[0].id); }

  const num = v => v == null || v === "" ? "" : String(Number(v));
  const lines = n => Array.from({ length: n }, () => `<div class="ln"></div>`).join("");
  const box = (label, value = "", wide = false) =>
    `<div class="box${wide ? " wide" : ""}"><span class="lbl">${esc(label)}</span><span class="val">${value ? esc(value) : ""}</span></div>`;

  /** The fields Rebecca writes in — the same on every form. */
  function fieldsHtml(p, d, ctx, nameLabel = "שם המוצר") {
    const tags = d.tags || {};
    const tagRows = Object.entries(ctx.tags).map(([g, vals]) => `<div class="tg"><b>${esc(g)}:</b> ${vals.map(v =>
      `<span class="ck${(tags[g] || []).includes(v) ? " on" : ""}">${esc(v)}</span>`).join("")}</div>`).join("");
    return `<div class="field"><span class="lbl">${esc(nameLabel)}</span>${lines(1)}</div>
<div class="grid">
  ${box("מתכון — קוד מהמקרא", d.recipe_id || "")}
  ${box("תבנית — קוד מהמקרא", d.mold_tool_id || "")}
  ${box("משקל יחידה (גרם)", num(d.unit_weight_g))}
  ${box("מחיר (₪)", num(p.price))}
</div>
<div class="field"><span class="lbl">ריח</span>${lines(1)}</div>
<div class="field"><span class="lbl">צבעים ותוספות (צמחים, חימר, מיקה, שמנים מיוחדים…)</span>${lines(2)}</div>
<div class="field"><span class="lbl">מה מיוחד בסבון הזה — במילים שלך, כמה מילים מספיקות</span>${lines(3)}</div>
<div class="field"><span class="lbl">למי ולמה מתאים — סמני ✓</span><div class="tags">${tagRows}</div></div>
<div class="foot"><span class="ck">מוכן לפרסום</span><span class="ck">עוד לא</span><span class="lbl">הערות:</span><span class="fill"></span></div>
<div class="pageno">${esc(ctx.today)} · ${ctx.i + 1} מתוך ${ctx.total}</div>`;
  }

  function productPage(p, d, ctx) {
    d = d || {};
    const img = p.images && p.images[0] ? ctx.abs(p.images[0]) : "";
    const recipe = d.recipe_id ? `${d.recipe_id}${ctx.recipeName[d.recipe_id] ? " · " + ctx.recipeName[d.recipe_id] : ""}` : "";
    return `<section class="page">
<header><div class="brand">Rébecca Studio · טופס פרטי מוצר</div><div class="code" dir="ltr">${esc(formCode(p))}</div></header>
<div class="top">
  ${img ? `<img src="${esc(img)}" alt="">` : `<div class="noimg">אין תמונה</div>`}
  <div class="known">
    <div class="muted small">שם נוכחי:</div>
    <h2>${esc(p.name_he || "מוצר בלי שם")}</h2>
    <div class="muted">${esc(CAT[p.category] || "")}${p.published ? " · מוצג באתר" : " · עוד לא באתר"}${d.sku ? ` · <span dir="ltr">${esc(d.sku)}</span>` : ""}</div>
    <div class="have">${[p.price != null ? `מחיר: ₪${num(p.price)}` : "", d.unit_weight_g ? `משקל: ${num(d.unit_weight_g)} גרם` : "", recipe ? `מתכון: ${recipe}` : ""]
      .filter(Boolean).map(esc).join("<br>") || "עוד אין פרטים — הכל ממלאים כאן"}</div>
  </div>
</div>
${fieldsHtml(p, d, ctx, p.name_he ? "שם חדש (רק אם רוצים לשנות)" : "שם המוצר")}
</section>`;
  }

  /** A new product from a group of images in "תמונות חדשות": up to 4 photos, and the code of every image. */
  function groupPage(g, ctx) {
    const shown = g.images.slice(0, 4);
    const codes = g.images.map(imageCode);
    return `<section class="page">
<header><div class="brand">Rébecca Studio · טופס מוצר חדש</div><div class="code" dir="ltr">${esc(groupCode(g))}</div></header>
<div class="top">
  <div class="photos n${shown.length}">${shown.map(m => `<img src="${esc(ctx.abs(m.url))}" alt="">`).join("")}</div>
  <div class="known">
    <h2>מוצר חדש</h2>
    <div class="muted">מתמונות הסטודיו · ${g.images.length} ${g.images.length === 1 ? "תמונה" : "תמונות"}</div>
    <div class="have"><span class="lbl">סוג:</span> <span class="ck">סבון</span><span class="ck">נר</span><span class="ck">מארז</span><span class="ck">אחר</span></div>
    <div class="codes" dir="ltr">${codes.map(esc).join(" · ")}</div>
  </div>
</div>
${fieldsHtml({}, {}, ctx)}
</section>`;
  }

  function legendPage(recipes, molds) {
    // שלוש עמודות, כדי שכל המתכונים והתבניות ייכנסו בדף אחד.
    const cols = (rows, n = 3) => {
      const per = Math.ceil(rows.length / n) || 1;
      const col = part => `<table>${part.map(r => `<tr><td class="c" dir="ltr">${esc(r.id)}</td><td>${esc(r.name || "")}</td></tr>`).join("")}</table>`;
      return `<div class="cols">${Array.from({ length: n }, (_, k) => col(rows.slice(k * per, (k + 1) * per))).join("")}</div>`;
    };
    return `<section class="page legend">
<header><div class="brand">Rébecca Studio · מקרא קודים לטופס</div></header>
<h2>מתכונים</h2>
${cols(recipes)}
${molds.length ? `<h2>תבניות</h2>${cols(molds)}` : ""}
<p class="muted center">בטופס כותבים רק את הקוד (למשל <span dir="ltr">RC-012</span>). אם אין מתכון או תבנית מתאימים — כותבים במילים.</p>
</section>`;
  }

  const CSS = `
@page{size:A4;margin:12mm}
*{box-sizing:border-box}
body{font-family:Assistant,Arial,sans-serif;color:#1F2A24;margin:0;font-size:14px;background:#EDE8DE}
.bar{position:sticky;top:0;display:flex;gap:10px;justify-content:center;align-items:center;padding:10px;background:#163B30;color:#FBF8F2}
.bar button{font:inherit;font-size:16px;padding:10px 22px;border:0;border-radius:12px;background:#8A6A2F;color:#fff;cursor:pointer;min-height:44px}
.page{background:#fff;width:210mm;min-height:297mm;margin:12px auto;padding:12mm;display:flex;flex-direction:column;gap:3.2mm;page-break-after:always;break-after:page}
header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #E7DFCF;padding-bottom:2mm}
.brand{font-family:"Frank Ruhl Libre",serif;color:#163B30;font-size:15px}
.code{font-size:20px;font-weight:700;letter-spacing:.06em;border:2px solid #163B30;border-radius:8px;padding:1mm 3mm}
.top{display:flex;gap:6mm;align-items:stretch}
.top img,.noimg{width:62mm;height:62mm;object-fit:cover;border-radius:4mm;border:1px solid #E7DFCF;flex:none}
.noimg{display:flex;align-items:center;justify-content:center;color:#5E675F;background:#F3EDE1}
.photos{width:62mm;height:62mm;flex:none;display:grid;gap:1.5mm}
.photos img{width:100%;height:100%;object-fit:cover;border-radius:3mm;border:1px solid #E7DFCF;min-height:0}
.photos.n2{grid-template-rows:1fr 1fr}.photos.n3,.photos.n4{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}
.photos.n3 img:first-child{grid-column:span 2}
.codes{font-size:10px;color:#5E675F;line-height:1.5;text-align:right;word-break:break-word}
.known{display:flex;flex-direction:column;gap:2mm}
h2{font-family:"Frank Ruhl Libre",serif;font-weight:500;color:#163B30;margin:0;font-size:22px;text-align:center}
.known h2{text-align:right}
.muted{color:#5E675F}.center{text-align:center}.small{font-size:12px}
.have{background:#F3EDE1;border-radius:3mm;padding:3mm;line-height:1.6}
.lbl{color:#163B30;font-weight:700;font-size:13px}
.field{display:flex;flex-direction:column;gap:1mm}
.ln{height:8.5mm;border-bottom:1px solid #9C9584}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
.box{border:1px solid #9C9584;border-radius:2.5mm;min-height:14mm;padding:1.5mm 2.5mm;display:flex;flex-direction:column}
.box .val{font-size:16px;color:#8A6A2F;margin-top:auto}
.tags{display:flex;flex-direction:column;gap:1.4mm;font-size:12.5px}
.tg b{color:#163B30;margin-left:1mm}
.ck{display:inline-flex;align-items:center;gap:1.2mm;margin-left:3.5mm;white-space:nowrap}
.ck::before{content:"";width:3.4mm;height:3.4mm;border:1.4px solid #163B30;border-radius:1mm;display:inline-block}
.ck.on::before{content:"✓";font-size:11px;line-height:3.4mm;text-align:center;color:#163B30}
.foot{display:flex;align-items:flex-end;gap:2mm;margin-top:1mm;font-size:14px}
.foot .fill{flex:1;border-bottom:1px solid #9C9584;height:7mm}
.pageno{margin-top:auto;text-align:center;color:#5E675F;font-size:11px}
.legend h2{margin-top:2mm}
.cols{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4mm}
table{width:100%;border-collapse:collapse;font-size:11.5px}
td{border-bottom:1px solid #E7DFCF;padding:1mm 1.2mm;vertical-align:top}
td.c{width:16mm;font-weight:700;white-space:nowrap;text-align:left}
@media print{body{background:#fff}.bar{display:none}.page{margin:0;width:auto;min-height:auto;height:272mm;padding:0}.page.legend{height:auto}}
`;

  /** The whole printable document.
      ctx: {products, details:{[id]:row}, groups:[{images:[{id,url}]}], recipes, molds, tags, legend, today, abs}. */
  function formsHtml(ctx) {
    const recipeName = {}, moldName = {};
    (ctx.recipes || []).forEach(r => { recipeName[r.id] = r.name; });
    (ctx.molds || []).forEach(m => { moldName[m.id] = m.name; });
    const abs = ctx.abs || (s => s);
    const list = ctx.products || [], groups = (ctx.groups || []).filter(g => g.images && g.images.length);
    const total = list.length + groups.length;
    const base = { abs, recipeName, moldName, tags: ctx.tags || {}, today: ctx.today || "", total };
    const pages = [
      ...list.map((p, i) => productPage(p, (ctx.details || {})[p.id], { ...base, i })),
      ...groups.map((g, k) => groupPage(g, { ...base, i: list.length + k }))
    ];
    if (ctx.legend) pages.push(legendPage(ctx.recipes || [], ctx.molds || []));
    return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>טפסי מילוי · ${total} טפסים</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;700&family=Frank+Ruhl+Libre:wght@500&display=swap">
<style>${CSS}</style></head><body>
<div class="bar"><span>${total} טפסים${ctx.legend ? " + דף מקרא" : ""}</span><button type="button" onclick="print()">הדפסה</button></div>
${pages.join("\n")}
</body></html>`;
  }

  /* ---------- admin dialog ---------- */
  function RSForms(sb, { getProducts, getInbox, toast, abs, tags }) {
    let dlg = null, tab = "products", groups = [];
    const newImages = () => (getInbox ? getInbox() : []).filter(m => m.status === "new");
    const grouped = () => new Set(groups.flatMap(g => g.images.map(m => m.id)));
    function build() {
      dlg = document.createElement("dialog");
      dlg.className = "sheet"; dlg.id = "formsDlg";
      dlg.innerHTML = `<div class="form">
  <div class="sheet-head">
    <button class="chip" type="button" data-fclose>ביטול</button>
    <h2>טפסי מילוי להדפסה</h2>
    <button class="btn solid" type="button" id="formsGo">פתיחה</button>
  </div>
  <div class="sheet-body">
    <div class="chips forms-tabs" role="tablist">
      <button type="button" class="chip" role="tab" data-ftab="products" id="formsTabProducts">מוצרים</button>
      <button type="button" class="chip" role="tab" data-ftab="images" id="formsTabImages">תמונות חדשות</button>
    </div>
    <div id="formsProducts">
      <p class="hint">דף לכל מוצר: התמונה, מה שכבר ידוע, ושורות לכתיבה ביד.</p>
      <div class="chips"><button type="button" class="chip" data-fsel="hidden">רק מה שלא באתר</button><button type="button" class="chip" data-fsel="all">הכל</button><button type="button" class="chip" data-fsel="none">ניקוי</button></div>
      <div class="forms-list" id="formsList"></div>
    </div>
    <div id="formsImages" hidden>
      <p class="hint">מסמנים את כל התמונות של אותו סבון ולוחצים "טופס אחד" — כך כל סבון מקבל דף אחד, עם כל התמונות שלו. חוזרים על זה לסבון הבא.</p>
      <div class="forms-groups" id="formsGroups"></div>
      <div class="forms-grid" id="formsGrid"></div>
      <div class="forms-act">
        <span id="formsPicked">לא סומנו תמונות</span>
        <button type="button" class="btn solid" id="formsGroupOne">טופס אחד לתמונות המסומנות</button>
        <button type="button" class="btn" id="formsGroupEach">טופס לכל תמונה</button>
      </div>
    </div>
    <label class="forms-legend"><input type="checkbox" id="formsLegend" checked> להוסיף דף מקרא עם קודי המתכונים והתבניות</label>
    <p class="hint">אחרי המילוי מצלמים את הדפים ושולחים, והפרטים נכנסים לכרטיסים כטיוטה. שום דבר לא מתפרסם לבד.</p>
  </div>
</div>`;
      document.body.appendChild(dlg);
      dlg.addEventListener("click", e => {
        if (e.target.closest("[data-fclose]")) return dlg.close();
        const t = e.target.closest("[data-ftab]"); if (t) { tab = t.dataset.ftab; return paint(); }
        const ungroup = e.target.closest("[data-fungroup]");
        if (ungroup) { groups.splice(Number(ungroup.dataset.fungroup), 1); return paint(); }
        const b = e.target.closest("[data-fsel]"); if (!b) return;
        const mode = b.dataset.fsel;
        dlg.querySelectorAll("#formsList input").forEach(i => { i.checked = mode === "all" || (mode === "hidden" && i.dataset.pub !== "1"); });
      });
      dlg.addEventListener("change", e => { if (e.target.closest("#formsGrid")) picked(); });
      dlg.querySelector("#formsGroupOne").onclick = () => makeGroups(false);
      dlg.querySelector("#formsGroupEach").onclick = () => makeGroups(true);
      dlg.querySelector("#formsGo").onclick = go;
    }
    function checkedImages() {
      const ids = new Set(Array.from(dlg.querySelectorAll("#formsGrid input:checked")).map(i => i.value));
      return newImages().filter(m => ids.has(m.id));
    }
    function picked() {
      const n = checkedImages().length;
      dlg.querySelector("#formsPicked").textContent = n ? `סומנו ${n} תמונות` : "לא סומנו תמונות";
      dlg.querySelector("#formsGroupOne").disabled = !n;
      dlg.querySelector("#formsGroupEach").disabled = !n;
    }
    function makeGroups(each) {
      const imgs = checkedImages(); if (!imgs.length) return;
      if (each) imgs.forEach(m => groups.push({ images: [m] })); else groups.push({ images: imgs });
      paint();
    }
    function paint() {
      const imgs = newImages(), used = grouped(), free = imgs.filter(m => !used.has(m.id));
      dlg.querySelector("#formsTabProducts").classList.toggle("on", tab === "products");
      dlg.querySelector("#formsTabImages").classList.toggle("on", tab === "images");
      dlg.querySelector("#formsTabImages").textContent = `תמונות חדשות (${imgs.length})`;
      dlg.querySelector("#formsProducts").hidden = tab !== "products";
      dlg.querySelector("#formsImages").hidden = tab !== "images";
      dlg.querySelector("#formsGroups").innerHTML = groups.length ? `<b>טפסים מתמונות: ${groups.length}</b>` + groups.map((g, k) => `<div class="forms-group">
  ${g.images.slice(0, 4).map(m => `<img src="${esc(abs(m.url))}" alt="" loading="lazy">`).join("")}
  <span>טופס ${k + 1} · ${g.images.length} ${g.images.length === 1 ? "תמונה" : "תמונות"}</span>
  <button type="button" class="chip" data-fungroup="${k}">ביטול</button></div>`).join("") : "";
      dlg.querySelector("#formsGrid").innerHTML = free.length ? free.map(m => `<label class="forms-pic">
  <input type="checkbox" value="${esc(m.id)}"><img src="${esc(abs(m.url))}" alt="" loading="lazy"><span class="tick" aria-hidden="true"></span></label>`).join("")
        : `<p class="hint">${imgs.length ? "כל התמונות כבר שובצו לטפסים." : "אין תמונות חדשות שממתינות."}</p>`;
      picked();
    }
    function open() {
      if (!dlg) build();
      const items = getProducts();
      dlg.querySelector("#formsList").innerHTML = items.map(p => `<label class="forms-item">
  <input type="checkbox" value="${esc(p.id)}" data-pub="${p.published ? 1 : 0}" ${p.published ? "" : "checked"}>
  ${p.images && p.images[0] ? `<img src="${esc(abs(p.images[0]))}" alt="" loading="lazy">` : `<span class="noimg"></span>`}
  <span>${esc(p.name_he || "בלי שם")}<small>${p.published ? "באתר" : "מוסתר"}</small></span></label>`).join("");
      const live = new Set(newImages().map(m => m.id));
      groups = groups.map(g => ({ images: g.images.filter(m => live.has(m.id)) })).filter(g => g.images.length);
      paint();
      dlg.showModal();
    }
    async function go() {
      const ids = Array.from(dlg.querySelectorAll("#formsList input:checked")).map(i => i.value);
      if (!ids.length && !groups.length) return toast("לא נבחרו מוצרים או טפסים מתמונות");
      const win = window.open("", "_blank");
      if (!win) return toast("הדפדפן חסם חלון חדש — צריך לאשר חלונות קופצים לאתר");
      win.document.write(`<p dir="rtl" style="font-family:Arial;padding:24px">מכינים את הטפסים…</p>`); win.document.close();
      try {
        const [d, r, m] = await Promise.all([
          ids.length ? sb.from("product_details").select("product_id,sku,recipe_id,mold_tool_id,unit_weight_g,tags").in("product_id", ids) : Promise.resolve({ data: [] }),
          sb.from("recipes").select("id,name").order("id"),
          sb.from("molds_tools").select("id,name").eq("kind", "תבנית").order("id")
        ]);
        const err = d.error || r.error || m.error; if (err) throw err;
        const details = {}; (d.data || []).forEach(x => { details[x.product_id] = x; });
        const order = new Map(ids.map((id, i) => [id, i]));
        const products = getProducts().filter(p => order.has(p.id)).sort((a, b) => order.get(a.id) - order.get(b.id));
        const html = formsHtml({ products, details, groups, recipes: r.data || [], molds: m.data || [], tags, legend: dlg.querySelector("#formsLegend").checked,
          today: new Date().toLocaleDateString("he-IL"), abs });
        // מסמך אמיתי (blob) ולא document.write — כך התמונות והגופנים נטענים כרגיל, וגם "שמירה כ-PDF" עובדת.
        win.location.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
        dlg.close();
      } catch (e) {
        win.close(); toast("לא הצלחנו להכין את הטפסים: " + (e.message || e));
      }
    }
    return { open };
  }

  const api = { formsHtml, formCode, imageCode, groupCode, RSForms };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else { root.RSForms = RSForms; root.RSFormsHtml = formsHtml; }
})(typeof window !== "undefined" ? window : globalThis);
