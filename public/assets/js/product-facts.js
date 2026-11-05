/* Rébecca Studio — product facts shown under the description (weight, etc.).
   Pure functions, shared by the site and the tests. */
(function (root) {
  // "100", "100 גרם", "100g", "105 ג׳" — a price note that is really just a weight.
  const WEIGHT_ONLY = /^\s*(\d+(?:[.,]\d+)?)\s*(?:g|gr|gram|grams|ג|ג׳|ג'|גר|גר׳|גרם)?\.?\s*$/i;

  function weightFromNote(note) {
    const m = WEIGHT_ONLY.exec(String(note == null ? "" : note));
    return m ? Number(m[1].replace(",", ".")) : null;
  }

  /** Unit weight in grams: the real weight field first, then a weight-only price note. */
  function weightOf(p) {
    if (!p) return null;
    const w = Number(p.weight_g);
    if (p.weight_g != null && p.weight_g !== "" && Number.isFinite(w) && w > 0) return w;
    return weightFromNote(p.price_note_he) || weightFromNote(p.price_note_en);
  }

  /** The price note to show next to the price — empty when it only holds a weight. */
  function priceNote(p, lang) {
    if (!p) return "";
    const own = p[`price_note_${lang}`];
    const v = own && String(own).trim() ? own : (p.price_note_he || p.price_note_en || "");
    return weightFromNote(v) != null ? "" : String(v).trim();
  }

  function fmtWeight(g, lang) {
    if (!g) return "";
    const n = Number.isInteger(g) ? String(g) : String(Math.round(g * 10) / 10);
    return lang === "en" ? `${n} g` : `${n} גרם`;
  }

  /** Rows for the details list under the description: [{label, value}]. */
  function facts(p, lang) {
    const rows = [];
    const w = weightOf(p);
    if (w) rows.push({ key: "weight", label: lang === "en" ? "Weight" : "משקל", value: fmtWeight(w, lang) });
    return rows;
  }

  const api = { weightFromNote, weightOf, priceNote, fmtWeight, facts };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.RSFacts = api;
})(typeof window !== "undefined" ? window : globalThis);
