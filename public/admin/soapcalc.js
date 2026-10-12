/* Rébecca Studio — soap calculator engine (pure functions, no network).
   Lye: grams of each oil × SAP × (1 − superfat) ÷ purity. NaOH SAP = sap_koh / 1403, KOH SAP = sap_koh / 1000.
   With purity 100% this reproduces Soapmaking Friend's lye for all of Rebecca's 71 recipes (to 0.01 g, one recipe 0.12 g).
   Qualities follow the SoapCalc method: weighted fatty acids of the oils. */
(function (root) {
  const FA = ["lauric", "myristic", "palmitic", "stearic", "ricinoleic", "oleic", "linoleic", "linolenic"];
  const OIL_STAGE = "שמנים וחמאות";
  const RANGES = { hardness: [29, 54], cleansing: [12, 22], condition: [44, 69], bubbly: [14, 46], creamy: [16, 48], iodine: [41, 70], ins: [136, 165] };
  const LABELS = { hardness: "קשיות", cleansing: "ניקוי", condition: "לחות", bubbly: "קצף בועות", creamy: "קצף קרמי", longevity: "עמידות", iodine: "יוד", ins: "INS" };
  const r2 = n => Math.round(n * 100) / 100;

  /** Parse "2.19:1" → 2.19 */
  function parseRatio(s) { const m = String(s || "").match(/^\s*([\d.]+)\s*:\s*([\d.]+)\s*$/); return m && Number(m[2]) ? Number(m[1]) / Number(m[2]) : null; }

  /** Pick the liquid setting that best describes a stored recipe. */
  function inferLiquid(recipe) {
    const oils = Number(recipe.oils_g) || 0, lye = Number(recipe.lye_g) || 0, liq = Number(recipe.liquid_g) || 0;
    if (!oils || !lye || !liq) return { mode: "ratio", value: 2 };
    const pct = liq / oils, ratio = parseRatio(recipe.liquid_lye_ratio) || liq / lye;
    if (Math.abs(ratio * 2 - Math.round(ratio * 2)) < 0.005) return { mode: "ratio", value: Math.round(ratio * 2) / 2 };
    if (Math.abs(pct * 100 - Math.round(pct * 100)) < 0.05) return { mode: "pct", value: Math.round(pct * 100) / 100 };
    return { mode: "ratio", value: Math.round(ratio * 1000) / 1000 };
  }

  /**
   * input: { lines:[{material_id, stage, grams}], materials:{id:{sap_koh, iodine, ins, fatty_acids, soap_data, name_he}},
   *          lyeType:'NaOH'|'KOH', purity (0–1, default 1), superfat (0–1), liquid:{mode:'ratio'|'conc'|'pct', value}, fragrancePct (0–1) | fragranceG }
   */
  function calc(input) {
    const mats = input.materials || {};
    const lyeType = input.lyeType === "KOH" ? "KOH" : "NaOH";
    const purity = input.purity > 0 && input.purity <= 1 ? input.purity : 1;
    const sf = Number(input.superfat) || 0;
    const oils = (input.lines || []).filter(l => (l.stage || OIL_STAGE) === OIL_STAGE && l.material_id && Number(l.grams) > 0);
    const oils_g = oils.reduce((s, l) => s + Number(l.grams), 0);
    const missing = [], unverified = [], warnings = [];
    let base = 0;
    const fa = Object.fromEntries(FA.map(k => [k, 0])); let iodine = 0, ins = 0;
    for (const l of oils) {
      const m = mats[l.material_id] || {}, g = Number(l.grams), w = oils_g ? g / oils_g : 0;
      if (m.sap_koh == null) { missing.push(l.material_id); continue; }
      if (m.soap_data !== "מאומת") unverified.push(l.material_id);
      base += g * Number(m.sap_koh) / (lyeType === "KOH" ? 1000 : 1403);
      const f = m.fatty_acids || {};
      FA.forEach(k => { fa[k] += w * (Number(f[k]) || 0); });
      iodine += w * (Number(m.iodine) || 0); ins += w * (Number(m.ins) || 0);
    }
    const lye_g = base * (1 - sf) / purity;
    const liq = input.liquid || { mode: "ratio", value: 2 };
    let liquid_g = 0;
    if (liq.mode === "conc") liquid_g = liq.value > 0 && liq.value < 1 ? lye_g / liq.value - lye_g : 0;
    else if (liq.mode === "pct") liquid_g = oils_g * (Number(liq.value) || 0);
    else liquid_g = lye_g * (Number(liq.value) || 0);
    const frag_g = input.fragranceG != null ? Number(input.fragranceG) || 0 : oils_g * (Number(input.fragrancePct) || 0);
    const q = {
      hardness: fa.lauric + fa.myristic + fa.palmitic + fa.stearic,
      cleansing: fa.lauric + fa.myristic,
      condition: fa.oleic + fa.linoleic + fa.linolenic + fa.ricinoleic,
      bubbly: fa.lauric + fa.myristic + fa.ricinoleic,
      creamy: fa.palmitic + fa.stearic + fa.ricinoleic,
      longevity: fa.palmitic + fa.stearic,
      iodine, ins
    };
    const sat = Math.round(q.hardness);
    if (sf < 0) warnings.push("שומן עודף שלילי: הסבון יהיה חריף. אסור להשתמש.");
    else if (sf < 0.02 && oils_g) warnings.push("שומן עודף נמוך מ-2%: סבון ניקוי בלבד, לא לעור.");
    if (sf > 0.15) warnings.push("שומן עודף גבוה מ-15%: הסבון עלול להיות רך ולהתקלקל מהר.");
    const conc = lye_g + liquid_g > 0 ? lye_g / (lye_g + liquid_g) : 0;
    if (lyeType === "NaOH" && liquid_g && (conc > 0.42 || conc < 0.22)) warnings.push(`ריכוז הסודה ${Math.round(conc * 1000) / 10}% מחוץ לטווח המקובל (25%–40%).`);
    if (missing.length) warnings.push("לחלק מהשמנים אין נתוני סודה, ולכן החישוב חלקי. אסור להשתמש בתוצאה עד שמשלימים.");
    return {
      ok: oils_g > 0 && !missing.length,
      oils_g: r2(oils_g), lye_g: r2(lye_g), liquid_g: r2(liquid_g), frag_g: r2(frag_g), batch_g: r2(oils_g + lye_g + liquid_g + frag_g),
      lye_type: lyeType, lye_concentration: Math.round(conc * 10000) / 10000,
      liquid_lye_ratio: lye_g ? `${Math.round(liquid_g / lye_g * 100) / 100}:1` : null,
      qualities: Object.fromEntries(Object.entries(q).map(([k, v]) => [k, Math.round(v)])),
      sat_unsat: `${sat}:${100 - sat}`,
      fatty_acids: Object.fromEntries(FA.map(k => [k, Math.round(fa[k])])),
      missing: [...new Set(missing)], unverified: [...new Set(unverified)], warnings
    };
  }

  /** Scale a recipe so that the finished batch weighs `targetBatch` grams (e.g. a mold's fill weight). Returns the factor for oil grams. */
  function scaleToBatch(input, targetBatch) {
    const c = calc(input); if (!c.batch_g) return 1;
    return targetBatch / c.batch_g;
  }

  const api = { calc, inferLiquid, parseRatio, scaleToBatch, FA, RANGES, LABELS, OIL_STAGE };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SoapCalc = api;
})(typeof window !== "undefined" ? window : globalThis);
