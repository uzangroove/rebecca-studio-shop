/* Rébecca Studio — soap calculator panel inside the recipe editor (uses soapcalc.js for the math).
   Live lye/liquid/fragrance, soap qualities against target ranges, fit to a mold, raw-material cost, printable work sheet. */
window.RSCalcUI = (function () {
  const C = { mats: {}, price: {}, molds: [], at: 0, api: null, out: null, mode: "ratio", row: null };
  const SC = () => window.SoapCalc;
  const num = v => { if (v == null || v === "") return null; const n = Number(String(v).replace(",", ".")); return isFinite(n) ? n : null; };
  const rd = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
  const fmt = (n, d = 1) => n == null ? "—" : Number(n).toLocaleString("he-IL", { minimumFractionDigits: d, maximumFractionDigits: d });
  const ils = n => "₪" + Number(n).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nameOf = id => (C.mats[id] || {}).name_he || id;
  const OIL = "שמנים וחמאות", SCENT = "ריח";

  async function load(sb) {
    if (Date.now() - C.at < 60000) return;
    const [m, p, mo] = await Promise.all([
      sb.from("materials").select("id,name_he,category,sap_koh,iodine,ins,fatty_acids,soap_data"),
      sb.from("supplier_item_prices").select("material_id,price_per_unit").not("material_id", "is", null),
      sb.from("molds_tools").select("id,name,kind,fill_grams,cavities").order("id")
    ]);
    if (m.error) throw m.error;
    C.mats = Object.fromEntries(m.data.map(x => [x.id, x]));
    C.price = {};
    (p.data || []).forEach(x => { const v = Number(x.price_per_unit); if (v > 0 && (!C.price[x.material_id] || v < C.price[x.material_id])) C.price[x.material_id] = v; });
    C.molds = (mo.data || []).filter(x => Number(x.fill_grams) > 0);
    C.at = Date.now();
  }

  function html() {
    return `<fieldset class="cc" id="ccBox"><legend>מחשבון הסבון</legend>
      <div class="dm-grid">
        <label class="dm-f">איך מחשבים נוזלים<select name="c_liqmode">
          <option value="ratio">יחס נוזל לסודה (2 = ‎2:1)</option><option value="conc">ריכוז סודה (%)</option><option value="pct">אחוז מהשמנים (%)</option></select></label>
        <label class="dm-f">ערך<input name="c_liqval" inputmode="decimal" dir="ltr"></label>
        <label class="dm-f">ריח (% מהשמנים)<input name="c_frag" inputmode="decimal" dir="ltr"><small class="muted" id="ccFragNote"></small></label>
      </div>
      <div id="ccOut" aria-live="polite"></div>
      <details class="cc-more" open><summary>תבנית, עלות ודף עבודה</summary>
        <div class="dm-grid">
          <label class="dm-f">תבנית<select name="c_mold"></select></label>
          <label class="dm-f">כמה תבניות<input name="c_moldn" type="number" min="1" step="1" value="1" inputmode="numeric" dir="ltr"></label>
        </div>
        <div class="links"><button type="button" class="btn" id="ccFit">התאמת הכמויות לתבנית</button><button type="button" class="btn" id="ccPrint">דף עבודה להדפסה</button></div>
        <div id="ccCost"></div>
      </details>
    </fieldset>`;
  }

  function open(row, api) {
    C.api = api; C.row = row; C.out = null;
    const f = api.form(); if (!f.elements.c_liqmode) return;
    const liq = row && row.lye_g ? SC().inferLiquid(row) : { mode: "ratio", value: 2 };
    C.mode = liq.mode;
    f.elements.c_liqmode.value = liq.mode;
    f.elements.c_liqval.value = liq.mode === "ratio" ? liq.value : rd(liq.value * 100, 2);
    const oils = num(row && row.oils_g), fr = num(row && row.fragrance_g);
    f.elements.c_frag.value = row && row.lye_g ? (oils && fr ? rd(fr / oils * 100, 2) : 0) : 3;
    f.elements.c_mold.innerHTML = `<option value="">— בלי תבנית —</option>` + C.molds.map(m => `<option value="${esc(m.id)}">${esc(m.name)} · ${fmt(m.fill_grams, 0)} ג׳${Number(m.cavities) > 1 ? ` · ${m.cavities} חללים` : ""}</option>`).join("");
    document.getElementById("ccFit").onclick = fitMold;
    document.getElementById("ccPrint").onclick = printSheet;
    recalc();
  }

  function switchMode(m) {
    const f = C.api.form(), o = C.out;
    if (o && o.lye_g) {
      const v = m === "ratio" ? o.liquid_g / o.lye_g : m === "conc" ? o.lye_g / (o.lye_g + o.liquid_g) * 100 : o.liquid_g / o.oils_g * 100;
      f.elements.c_liqval.value = rd(v, m === "ratio" ? 3 : 2);
    }
    C.mode = m;
  }

  function inputs() {
    const f = C.api.form(), v = C.api.values();
    const lines = C.api.lines().map(l => ({ material_id: l.material_id, stage: l.stage || OIL, grams: num(l.grams) }));
    const mode = f.elements.c_liqmode.value, val = num(f.elements.c_liqval.value) || 0;
    const scentG = lines.filter(l => l.stage === SCENT && l.grams > 0).reduce((a, l) => a + l.grams, 0);
    const frag = f.elements.c_frag, note = document.getElementById("ccFragNote");
    frag.disabled = scentG > 0; if (note) note.textContent = scentG > 0 ? "לפי שורות הריח ברכיבים" : "";
    return {
      lines, materials: C.mats, lyeType: v.lye_type || "NaOH", purity: v.lye_purity == null ? 1 : v.lye_purity, superfat: v.superfat == null ? 0 : v.superfat,
      liquid: { mode, value: mode === "ratio" ? val : val / 100 },
      ...(scentG > 0 ? { fragranceG: scentG } : { fragrancePct: (num(frag.value) || 0) / 100 })
    };
  }

  function recalc() {
    if (!C.api) return;
    const f = C.api.form(); if (!f || !f.elements.c_liqmode) return;
    if (f.elements.c_liqmode.value !== C.mode) switchMode(f.elements.c_liqmode.value);
    const inp = inputs(), out = SC().calc(inp); C.out = out; C.inp = inp;
    if (out.ok) {
      const set = (k, v) => { if (f.elements["f_" + k]) f.elements["f_" + k].value = v; };
      set("lye_g", out.lye_g); set("liquid_g", out.liquid_g); set("fragrance_g", out.frag_g); set("batch_g", out.batch_g);
      set("lye_concentration", rd(out.lye_concentration * 100, 2)); set("liquid_lye_ratio", out.liquid_lye_ratio || "");
    }
    document.getElementById("ccOut").innerHTML = renderOut(out, inp);
    document.getElementById("ccCost").innerHTML = renderCost(out, inp);
  }

  function renderOut(o, inp) {
    if (!o.oils_g) return `<p class="hint" style="margin:0">מוסיפים שמנים ברכיבי המתכון (שלב "שמנים וחמאות") וממלאים גרמים או אחוזים, והחישוב מופיע כאן.</p>`;
    const L = SC().LABELS, R = SC().RANGES, MAX = { iodine: 150, ins: 250 };
    const qRows = ["hardness", "cleansing", "condition", "bubbly", "creamy", "longevity", "iodine", "ins"].map(k => {
      const v = o.qualities[k], rg = R[k], max = MAX[k] || 100, off = rg && (v < rg[0] || v > rg[1]);
      return `<div class="cc-q${off ? " off" : ""}"><span>${L[k]}</span><b>${v}</b>
        <span class="cc-bar">${rg ? `<i class="band" style="right:${rg[0] / max * 100}%;width:${(rg[1] - rg[0]) / max * 100}%"></i>` : ""}<i class="dot" style="right:calc(${Math.min(v / max, 1) * 100}% - 5px)"></i></span>
        <small>${rg ? `${rg[0]}–${rg[1]}` : ""}</small></div>`;
    }).join("");
    const warn = [...o.warnings];
    if (o.unverified.length) warn.push(`ערכי הסודה של ${o.unverified.map(nameOf).join(", ")} לקוחים מהספרות ולא נבדקו מול Soapmaking Friend. כדאי לבדוק פעם אחת לפני ייצור.`);
    if (o.missing.length) warn.push(`חסר ערך סודה ל: ${o.missing.map(nameOf).join(", ")}. אפשר להוסיף אותו בטבלת "חומרים".`);
    const lyeName = o.lye_type === "KOH" ? "אשלגן הידרוקסידי (KOH)" : "סודה קאוסטית (NaOH)";
    return `<div class="cc-big">
        <div class="cc-lye"><small>${lyeName}</small><b>${o.ok ? fmt(o.lye_g, 2) : "—"} <i>ג׳</i></b></div>
        <div><small>נוזלים</small><b>${fmt(o.liquid_g)} <i>ג׳</i></b></div>
        <div><small>ריח</small><b>${fmt(o.frag_g)} <i>ג׳</i></b></div>
        <div><small>שמנים</small><b>${fmt(o.oils_g)} <i>ג׳</i></b></div>
        <div class="cc-total"><small>משקל המנה</small><b>${fmt(o.batch_g)} <i>ג׳</i></b></div>
      </div>
      <p class="cc-sub">ריכוז סודה ${fmt(o.lye_concentration * 100)}% · יחס נוזל:סודה ${esc(o.liquid_lye_ratio || "—")} · שומן עודף ${fmt((inp.superfat || 0) * 100)}%${inp.purity < 1 ? ` · טוהר ${fmt(inp.purity * 100)}%` : ""} · רווי:לא רווי ${esc(o.sat_unsat)}</p>
      ${warn.length ? `<div class="cc-warn">${warn.map(w => `<p>${esc(w)}</p>`).join("")}</div>` : ""}
      <div class="cc-qs">${qRows}</div>
      <p class="hint" style="margin:0">הטווח המסומן הוא הטווח המומלץ (שיטת SoapCalc). מספר מחוץ לטווח מסומן באדום. זה כיוון, לא חוק.</p>`;
  }

  function moldInfo() {
    const f = C.api.form(), m = C.molds.find(x => x.id === f.elements.c_mold.value);
    if (!m) return null;
    const n = Math.max(1, parseInt(f.elements.c_moldn.value, 10) || 1);
    return { m, n, target: Number(m.fill_grams) * n, units: (Number(m.cavities) || 1) * n };
  }

  function costRows(o, inp) {
    const rows = [], missing = [];
    inp.lines.forEach(l => {
      if (!(l.grams > 0) || !l.material_id) return;
      const p = C.price[l.material_id];
      if (!(p > 0)) missing.push(nameOf(l.material_id));
      rows.push([nameOf(l.material_id), l.grams, p > 0 ? l.grams * p / 1000 : null]);
    });
    const lyeId = o.lye_type === "KOH" ? "BAS-KOH" : "BAS-LYE", pl = C.price[lyeId];
    if (o.lye_g) { if (!(pl > 0)) missing.push("סודה"); rows.push([o.lye_type === "KOH" ? "KOH" : "סודה קאוסטית", o.lye_g, pl > 0 ? o.lye_g * pl / 1000 : null]); }
    const hasScentLines = inp.lines.some(l => l.stage === SCENT && l.grams > 0);
    if (o.frag_g && !hasScentLines) missing.push("ריח (לא נבחר חומר ריח ברכיבים)");
    return { rows, missing, total: rows.reduce((a, r) => a + (r[2] || 0), 0) };
  }
  function renderCost(o, inp) {
    if (!o.oils_g) return "";
    const c = costRows(o, inp), mi = moldInfo();
    const per100 = o.batch_g ? c.total / o.batch_g * 100 : 0;
    return `<div class="cc-cost"><div class="st-big"><span><b>${ils(c.total)}</b> למנה</span><span><b>${ils(per100)}</b> ל-100 גרם</span>${mi ? `<span><b>${ils(c.total / mi.units)}</b> ליחידה (${mi.units} יח׳ של כ-${fmt(o.batch_g / mi.units, 0)} ג׳)</span>` : ""}</div>
      ${mi ? `<p class="hint" style="margin:0">התבנית שנבחרה מחזיקה ${fmt(mi.target, 0)} ג׳${Math.abs(o.batch_g - mi.target) > mi.target * 0.02 ? `, והמנה עכשיו ${fmt(o.batch_g, 0)} ג׳. לוחצים "התאמת הכמויות לתבנית".` : ". המנה מתאימה לתבנית."}</p>` : ""}
      <p class="hint" style="margin:0">${c.missing.length ? `חסר מחיר ל: ${esc(c.missing.join(", "))}. ` : ""}לפי המחיר הזול אצל הספקים, בלי מים, צבעים, אריזה ועבודה.</p></div>`;
  }

  function fitMold() {
    const mi = moldInfo(); if (!mi) return C.api.toast("בוחרים קודם תבנית");
    if (!C.out || !C.out.batch_g) return C.api.toast("אין עדיין כמויות לחשב");
    C.api.scale(mi.target / C.out.batch_g); recalc();
    C.api.toast(`הכמויות הותאמו ל-${fmt(mi.target, 0)} גרם`);
  }

  function beforeSave(row) {
    if (!C.out || !C.out.ok) return;
    const o = C.out;
    Object.assign(row, { oils_g: o.oils_g, lye_g: o.lye_g, liquid_g: o.liquid_g, fragrance_g: o.frag_g, batch_g: o.batch_g,
      lye_concentration: rd(o.lye_concentration, 4), liquid_lye_ratio: o.liquid_lye_ratio,
      qualities: { ...o.qualities, condition: o.qualities.condition, sat_unsat: o.sat_unsat }, fatty_acids: o.fatty_acids });
    const oils = C.api.lines().filter(l => (l.stage || OIL) === OIL && num(l.grams) > 0);
    oils.forEach(l => { l.pct_of_oils = rd(num(l.grams) / o.oils_g, 4); });
  }

  function printSheet() {
    const o = C.out, inp = C.inp; if (!o || !o.ok) return C.api.toast("קודם צריך חישוב תקין");
    const v = C.api.values(), mi = moldInfo(), c = costRows(o, inp);
    const lines = inp.lines.filter(l => l.material_id && l.grams > 0);
    const oils = lines.filter(l => l.stage === OIL), others = lines.filter(l => l.stage !== OIL);
    const row = (n, g, extra = "") => `<tr><td class="box"></td><td>${esc(n)}</td><td class="g">${fmt(g, n === "lye" ? 2 : 1)}</td><td>${extra}</td></tr>`;
    const today = new Date().toLocaleDateString("he-IL");
    const docHtml = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>דף עבודה · ${esc(v.name || "מתכון")}</title>
<style>
 body{font-family:Assistant,Arial,sans-serif;color:#1F2A24;margin:24px;font-size:15px}
 h1{font-family:"Frank Ruhl Libre",serif;font-weight:500;color:#163B30;margin:0 0 4px;text-align:center}
 .meta{text-align:center;color:#5E675F;margin-bottom:16px}
 h2{font-size:17px;color:#163B30;border-bottom:2px solid #E7DFCF;padding-bottom:4px;margin:18px 0 8px;text-align:center}
 table{width:100%;border-collapse:collapse} td,th{border:1px solid #D9CFBD;padding:6px 8px;text-align:right} th{background:#F3EDE1}
 td.g{direction:ltr;text-align:left;font-variant-numeric:tabular-nums;font-weight:700;width:90px} td.box{width:26px}
 td.box::before{content:"";display:inline-block;width:14px;height:14px;border:1.5px solid #163B30;border-radius:3px}
 .lye td{background:#FFF4F2;font-weight:700} .warn{border:2px solid #7A3B2E;border-radius:10px;padding:8px 12px;margin:12px 0;color:#7A3B2E}
 .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px} .fill{display:inline-block;min-width:150px;border-bottom:1px solid #999;min-height:20px}
 ol li{margin:4px 0} @media print{body{margin:10mm}}
</style></head><body>
<h1>${esc(v.name || "מתכון")}</h1>
<div class="meta">${esc(C.row && C.row.id || "")} · ${esc(v.method || "")} · הודפס ${today}</div>
<div class="grid"><div>מספר אצווה: <span class="fill">&nbsp;</span></div><div>תאריך ייצור: <span class="fill">&nbsp;</span></div>
<div>תבנית: ${mi ? `${esc(mi.m.name)} × ${mi.n}` : "<span class='fill'>&nbsp;</span>"}</div><div>משקל המנה: <b>${fmt(o.batch_g, 0)} ג׳</b>${mi ? ` · ${mi.units} יחידות` : ""}</div></div>
<div class="warn">בטיחות: כפפות ומשקפי מגן, חלון פתוח. תמיד סודה לתוך המים, לא להפך. ילדים ובעלי חיים מחוץ לחדר.</div>
<h2>שמנים וחמאות · ${fmt(o.oils_g, 1)} ג׳</h2>
<table><tr><th></th><th>רכיב</th><th>גרם</th><th>אחוז</th></tr>${oils.map(l => row(nameOf(l.material_id), l.grams, fmt(l.grams / o.oils_g * 100, 1) + "%")).join("")}</table>
<h2>תמיסת סודה</h2>
<table><tr><th></th><th>רכיב</th><th>גרם</th><th>הערה</th></tr>
<tr class="lye"><td class="box"></td><td>${o.lye_type === "KOH" ? "אשלגן הידרוקסידי (KOH)" : "סודה קאוסטית (NaOH)"}</td><td class="g">${fmt(o.lye_g, 2)}</td><td>שומן עודף ${fmt((inp.superfat || 0) * 100)}%</td></tr>
${row("נוזלים (מים מזוקקים / לפי המתכון)", o.liquid_g, `ריכוז ${fmt(o.lye_concentration * 100)}% · יחס ${esc(o.liquid_lye_ratio)}`)}</table>
<h2>ריח ותוספות</h2>
<table><tr><th></th><th>רכיב</th><th>גרם</th><th>שלב</th></tr>${others.length ? others.map(l => row(nameOf(l.material_id), l.grams, esc(l.stage))).join("") : row("ריח", o.frag_g, "")}</table>
<h2>שלבי עבודה</h2>
<ol><li>שוקלים ומחממים את השמנים והחמאות עד שהכול נמס.</li><li>מכינים את תמיסת הסודה: מפזרים את הסודה לתוך הנוזלים ומערבבים עד שמתמוססת.</li>
<li>מחכים שהשמנים והתמיסה יתקררו לטמפרטורה דומה (בערך 35–45 מעלות).</li><li>שופכים את התמיסה לשמנים ומערבבים עד "טרייס".</li>
<li>מוסיפים ריח, צבעים ותוספות.</li><li>יוצקים לתבנית, מכסים ומבודדים ל-24–48 שעות.</li><li>מוציאים, חותכים ומייבשים 4–6 שבועות לפני שימוש.</li></ol>
${v.notes ? `<h2>הערות</h2><p>${esc(v.notes).replace(/\n/g, "<br>")}</p>` : ""}
<h2>הערות מהייצור</h2><div class="fill" style="min-height:60px"></div>
<p class="meta" style="margin-top:14px">עלות חומרי גלם משוערת: ${ils(c.total)} למנה · RÉBECCA</p>
<script>setTimeout(function(){window.print()},300)<\/script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return C.api.toast("הדפדפן חסם חלון חדש. צריך לאפשר חלונות קופצים לאתר.");
    w.document.open(); w.document.write(docHtml); w.document.close();
  }

  return { load, html, open, recalc, beforeSave };
})();
