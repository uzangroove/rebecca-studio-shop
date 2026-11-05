// node --test tests/*.test.mjs — weight on the product card + printable fill-in forms. No network.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const F = require("../public/assets/js/product-facts.js");
const { formsHtml, formCode } = require("../public/admin/forms.js");

test("a price note that only holds a number is a weight", () => {
  for (const [note, g] of [["100", 100], ["105 גרם", 105], ["110g", 110], ["100 ג׳", 100], [" 95,5 ", 95.5]]) assert.equal(F.weightFromNote(note), g, note);
  for (const note of ["ל-100 גרם", "מחיר למארז", "", null, "3 יחידות"]) assert.equal(F.weightFromNote(note), null, String(note));
});

test("weight comes from the weight field first, then from a weight-only price note", () => {
  assert.equal(F.weightOf({ weight_g: 120, price_note_he: "100" }), 120);
  assert.equal(F.weightOf({ price_note_he: "100" }), 100);
  assert.equal(F.weightOf({ price_note_he: "ל-100 גרם" }), null);
  assert.equal(F.weightOf({}), null);
});

test("the weight is shown under the description with grams, not next to the price", () => {
  const rhubarb = { price: 30, price_note_he: "100" };
  assert.equal(F.priceNote(rhubarb, "he"), "");
  assert.deepEqual(F.facts(rhubarb, "he"), [{ key: "weight", label: "משקל", value: "100 גרם" }]);
  assert.deepEqual(F.facts({ weight_g: 100 }, "en"), [{ key: "weight", label: "Weight", value: "100 g" }]);
  assert.equal(F.priceNote({ price_note_he: "ל-100 גרם" }, "he"), "ל-100 גרם");
  assert.deepEqual(F.facts({ price: 30 }, "he"), []);
});

const products = [
  { id: "aaaa1111-2222-3333-4444-555566667777", name_he: "תשרית רובארב", category: "soap", price: 30, published: false, images: ["https://x/img/a.jpg"] },
  { id: "bbbb1111-2222-3333-4444-555566667777", name_he: "ריקוד <הפרחים>", category: "soap", published: false, images: [] }
];
const ctx = {
  products,
  details: { [products[0].id]: { recipe_id: "RC-012", mold_tool_id: "MO-003", unit_weight_g: 100, tags: { "קהל": ["נשים"] } } },
  recipes: [{ id: "RC-012", name: "תשרית רובארב" }, { id: "RC-013", name: "זית ודבש" }],
  molds: [{ id: "MO-003", name: "תבנית מלבן 6" }],
  tags: { "קהל": ["נשים", "גברים"] }, legend: true, today: "05.11.2026"
};

test("one page per product, plus a legend page", () => {
  const html = formsHtml(ctx);
  assert.equal((html.match(/<section class="page"/g) || []).length, 2);
  assert.equal((html.match(/<section class="page legend"/g) || []).length, 1);
  assert.ok(html.includes('dir="rtl"'));
});

test("each form carries its photo, a matching code, and what is already known", () => {
  const html = formsHtml(ctx);
  assert.equal(formCode(products[0]), "F-AAAA11");
  assert.ok(html.includes("F-AAAA11") && html.includes("F-BBBB11"));
  assert.ok(html.includes("https://x/img/a.jpg"));
  assert.ok(html.includes("משקל: 100 גרם"));
  assert.ok(html.includes("RC-012 · תשרית רובארב"));
  assert.ok(html.includes('class="ck on">נשים'));
  assert.ok(html.includes("אין תמונה"));
});

test("names are escaped and the legend lists every recipe and mold code", () => {
  const html = formsHtml(ctx);
  assert.ok(html.includes("ריקוד &lt;הפרחים&gt;") && !html.includes("<הפרחים>"));
  for (const code of ["RC-012", "RC-013", "MO-003"]) assert.ok(html.includes(`>${code}<`), code);
  assert.ok(!formsHtml({ ...ctx, legend: false }).includes("מקרא קודים"));
});
