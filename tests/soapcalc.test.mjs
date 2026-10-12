// node --test tests/*.test.mjs   — soap calculator engine (public/admin/soapcalc.js). Pure math, no network.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const C = createRequire(import.meta.url)("../public/admin/soapcalc.js");

const fa = (lau, myr, pal, ste, ric, ole, lin, lnn) => ({ lauric: lau, myristic: myr, palmitic: pal, stearic: ste, ricinoleic: ric, oleic: ole, linoleic: lin, linolenic: lnn });
const M = {
  OLV: { sap_koh: 190, iodine: 85, ins: 105, fatty_acids: fa(0, 0, 14, 3, 0, 69, 12, 1), soap_data: "מאומת" },
  CCN: { sap_koh: 257, iodine: 10, ins: 258, fatty_acids: fa(48, 19, 9, 3, 0, 8, 2, 0), soap_data: "מאומת" },
  PLM: { sap_koh: 199, iodine: 53, ins: 145, fatty_acids: fa(0, 1, 44, 5, 0, 39, 10, 0), soap_data: "מאומת" },
  SHE: { sap_koh: 179, iodine: 59, ins: 116, fatty_acids: fa(0, 0, 5, 40, 0, 48, 6, 0), soap_data: "מאומת" },
  CST: { sap_koh: 180, iodine: 86, ins: 95, fatty_acids: fa(0, 0, 0, 0, 90, 4, 4, 0), soap_data: "מאומת" },
  JOJ: { sap_koh: 92, iodine: 83, ins: 11, fatty_acids: fa(0, 0, 0, 0, 0, 12, 0, 0), soap_data: "ספרותי" },
  NOSAP: { name_he: "בלי נתונים" }
};
const classic = [["OLV", 350], ["CCN", 250], ["PLM", 250], ["SHE", 100], ["CST", 50]].map(([material_id, grams]) => ({ material_id, grams, stage: "שמנים וחמאות" }));

test("lye = Σ grams × SAP_KOH/1403 × (1 − superfat)", () => {
  const out = C.calc({ lines: classic, materials: M, superfat: 0.05, liquid: { mode: "ratio", value: 2 }, fragrancePct: 0.03 });
  const expected = (350 * 190 + 250 * 257 + 250 * 199 + 100 * 179 + 50 * 180) / 1403 * 0.95;
  assert.equal(out.ok, true);
  assert.equal(out.lye_g, Math.round(expected * 100) / 100);
  assert.equal(out.liquid_g, Math.round(expected * 2 * 100) / 100);
  assert.equal(out.frag_g, 30);
  assert.equal(out.batch_g, Math.round((1000 + expected * 3 + 30) * 100) / 100);
});

test("Soapmaking Friend reference recipe (500 g, SF 5%, 2:1) gives 69.44 g NaOH", () => {
  const lines = [["OLV", 150], ["CCN", 100], ["PLM", 100], ["SHE", 50]].map(([material_id, grams]) => ({ material_id, grams }));
  lines.push({ material_id: "ALM", grams: 100 });
  const mats = { ...M, ALM: { sap_koh: 195, iodine: 99, ins: 97, fatty_acids: fa(0, 0, 7, 0, 0, 71, 18, 0), soap_data: "מאומת" } };
  const out = C.calc({ lines, materials: mats, superfat: 0.05, liquid: { mode: "ratio", value: 2 }, fragranceG: 15 });
  assert.equal(out.lye_g, 69.44);
  assert.equal(out.liquid_g, 138.88);
  assert.equal(out.batch_g, 723.32);
  assert.deepEqual([out.qualities.hardness, out.qualities.condition, out.qualities.longevity], [37, 60, 23]);
});

test("purity and KOH", () => {
  const base = C.calc({ lines: classic, materials: M, superfat: 0.05 });
  const p99 = C.calc({ lines: classic, materials: M, superfat: 0.05, purity: 0.99 });
  assert.ok(Math.abs(p99.lye_g - base.lye_g / 0.99) < 0.01);
  const koh = C.calc({ lines: classic, materials: M, superfat: 0.05, lyeType: "KOH" });
  assert.ok(Math.abs(koh.lye_g - base.lye_g * 1.403) < 0.02);
});

test("liquid modes", () => {
  const conc = C.calc({ lines: classic, materials: M, superfat: 0.05, liquid: { mode: "conc", value: 0.3 } });
  assert.ok(Math.abs(conc.lye_concentration - 0.3) < 0.0005);
  const pct = C.calc({ lines: classic, materials: M, superfat: 0.05, liquid: { mode: "pct", value: 0.33 } });
  assert.equal(pct.liquid_g, 330);
});

test("non-oil stages are not saponified; missing SAP blocks the result", () => {
  const withScent = C.calc({ lines: [...classic, { material_id: "NOSAP", grams: 30, stage: "ריח" }], materials: M, superfat: 0.05 });
  assert.equal(withScent.ok, true);
  const missing = C.calc({ lines: [...classic, { material_id: "NOSAP", grams: 30, stage: "שמנים וחמאות" }], materials: M, superfat: 0.05 });
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.missing, ["NOSAP"]);
  const unver = C.calc({ lines: [...classic, { material_id: "JOJ", grams: 30 }], materials: M, superfat: 0.05 });
  assert.deepEqual(unver.unverified, ["JOJ"]);
});

test("inferLiquid and scaleToBatch", () => {
  assert.deepEqual(C.inferLiquid({ oils_g: 500, lye_g: 69.44, liquid_g: 138.88, liquid_lye_ratio: "2:1" }), { mode: "ratio", value: 2 });
  assert.deepEqual(C.inferLiquid({ oils_g: 900, lye_g: 121.89, liquid_g: 297, liquid_lye_ratio: "2.44:1" }), { mode: "pct", value: 0.33 });
  const input = { lines: classic, materials: M, superfat: 0.05, liquid: { mode: "ratio", value: 2 }, fragrancePct: 0.03 };
  const k = C.scaleToBatch(input, 1200);
  const scaled = C.calc({ ...input, lines: classic.map(l => ({ ...l, grams: l.grams * k })) });
  assert.ok(Math.abs(scaled.batch_g - 1200) < 0.05);
});

test("low superfat warns", () => {
  const out = C.calc({ lines: classic, materials: M, superfat: 0 });
  assert.ok(out.warnings.some(w => w.includes("2%")));
});
