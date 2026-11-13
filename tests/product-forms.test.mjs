// node --test tests/*.test.mjs — weight on the product card + printable fill-in forms. No network.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const F = require("../public/assets/js/product-facts.js");
const { formsHtml, formCode, imageCode, groupCode } = require("../public/admin/forms.js");

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
  // שם קיים: מוצג כ"שם נוכחי", והשורה לכתיבה היא "שם חדש" — רק אם רוצים לשנות
  assert.ok(html.includes("שם נוכחי:") && html.includes("שם חדש (רק אם רוצים לשנות)"));
});

test("names are escaped and the legend lists every recipe and mold code", () => {
  const html = formsHtml(ctx);
  assert.ok(html.includes("ריקוד &lt;הפרחים&gt;") && !html.includes("<הפרחים>"));
  for (const code of ["RC-012", "RC-013", "MO-003"]) assert.ok(html.includes(`>${code}<`), code);
  assert.ok(!formsHtml({ ...ctx, legend: false }).includes("מקרא קודים"));
});

test("a group of new studio images becomes one form with up to 4 photos and every image code", () => {
  const imgs = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}c11111-2222-3333-4444-555566667777`, url: `https://x/inbox/${i}.jpg` }));
  const html = formsHtml({ ...ctx, products: [], groups: [{ images: imgs }, { images: [imgs[0]] }, { images: [] }], legend: false });
  assert.equal((html.match(/<section class="page"/g) || []).length, 2, "empty groups are skipped");
  assert.equal(groupCode({ images: imgs }), "N-C0C111");
  assert.equal(imageCode(imgs[5]), "I-C5C111");
  const first = html.slice(html.indexOf('<section class="page"'), html.indexOf("</section>"));
  assert.equal((first.match(/https:\/\/x\/inbox\//g) || []).length, 4, "four photos on the page");
  for (const m of imgs) assert.ok(first.includes(imageCode(m)), imageCode(m));
  assert.ok(first.includes("מוצר חדש") && first.includes("6 תמונות") && first.includes("שם המוצר"));
  assert.ok(html.includes("1 מתוך 2") && html.includes("2 מתוך 2"));
});

test("products and image groups print together, products first", () => {
  const html = formsHtml({ ...ctx, groups: [{ images: [{ id: "dddd1111", url: "https://x/inbox/d.jpg" }] }] });
  assert.ok(html.indexOf("F-AAAA11") < html.indexOf("N-DDDD11"));
  assert.ok(html.includes("<title>טפסי מילוי · 3 טפסים</title>"));
});

test("every form has a technique field; a known technique is printed on it", () => {
  const { techniquesOf } = require("../public/admin/forms.js");
  const blank = formsHtml({ ...ctx, legend: false });
  assert.equal((blank.match(/טכניקה \/ עיצוב/g) || []).length, 2, "one per product page");
  const withT = formsHtml({ ...ctx, details: { [products[0].id]: { technique: "שכבות <ושיש>" } }, legend: false });
  assert.ok(withT.includes('<div class="ln pre">שכבות &lt;ושיש&gt;</div>'));
  const imgs = [{ id: "e1", url: "u1", meta: { technique: "סווירל" } }, { id: "e2", url: "u2", meta: { technique: " סווירל " } }, { id: "e3", url: "u3", meta: { technique: "הטבעה" } }, { id: "e4", url: "u4", meta: {} }];
  assert.equal(techniquesOf(imgs), "סווירל · הטבעה", "each technique once, empty ones skipped");
  const g = formsHtml({ ...ctx, products: [], groups: [{ images: imgs }], legend: false });
  assert.ok(g.includes('<div class="ln pre">סווירל · הטבעה</div>'));
  const none = formsHtml({ ...ctx, products: [], groups: [{ images: [imgs[3]] }], legend: false });
  assert.ok(none.includes("טכניקה / עיצוב") && !none.includes("ln pre"));
});
