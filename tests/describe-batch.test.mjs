// node --test — "תיאור מוצע" before printing: what is picked, what the description is written from, how it prints. No network.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { describeContext, productsToDo, imagesToDo } = require("../public/admin/describe-batch.js");
const { formsHtml, suggestionOf } = require("../public/admin/forms.js");

test("only products with a photo, no site description and no suggestion are described", () => {
  const products = [
    { id: "a", images: ["x.jpg"], desc_he: "" },
    { id: "b", images: ["x.jpg"], desc_he: "יש תיאור" },
    { id: "c", images: ["x.jpg"] },
    { id: "d", images: [] }
  ];
  assert.deepEqual(productsToDo(products, { c: { desc_suggestion: "כבר הוצע" } }).map(p => p.id), ["a"]);
});

test("only new studio images without a suggestion are described", () => {
  const imgs = [{ id: 1, status: "new", meta: {} }, { id: 2, status: "new", meta: { desc_suggestion: "x" } }, { id: 3, status: "used", meta: {} }, { id: 4, status: "new" }];
  assert.deepEqual(imagesToDo(imgs).map(m => m.id), [1, 4]);
});

test("the description is written from what is known — and says no scent was chosen", () => {
  const c = describeContext({ category: "soap", name: "תשרית", technique: "סווירל", analysis: { colors: ["ורוד", "לבן"], shape: "מלבן", technique: "שכבות", notes: "חיתוך נקי" } });
  for (const s of ["סוג המוצר: סבון", "שם: תשרית", "ריח: לא נבחר ריח", "סווירל", "ורוד, לבן", "מלבן"]) assert.ok(c.includes(s), s);
  const img = describeContext({ analysis: { type: "נר בכלי זכוכית" } });
  assert.ok(img.includes("סוג המוצר: נר בכלי זכוכית") && !img.includes("שם:"));
});

const ctx = { recipes: [], molds: [], tags: {}, legend: false, today: "13.11.2026" };
test("the form prints the site description, else the suggestion, else empty lines", () => {
  const p = { id: "aaaa1111", name_he: "א", category: "soap", images: [] };
  const cur = formsHtml({ ...ctx, products: [{ ...p, desc_he: "תיאור <מהאתר>" }] });
  assert.ok(cur.includes('class="sugg">תיאור &lt;מהאתר&gt;') && cur.includes("התיאור שבאתר"));
  const sug = formsHtml({ ...ctx, products: [p], details: { aaaa1111: { desc_suggestion: "הצעה יפה" } } });
  assert.ok(sug.includes('class="sugg">הצעה יפה') && sug.includes("הצעה — אפשר למחוק"));
  const none = formsHtml({ ...ctx, products: [p] });
  assert.ok(!none.includes('class="sugg"') && none.includes("תיאור — במילים שלך"));
  assert.ok(!none.includes("מה מיוחד בסבון הזה"), "the old field is replaced");
});

test("a group of studio images prints the first suggestion saved on one of them", () => {
  const imgs = [{ id: "e1", url: "u", meta: {} }, { id: "e2", url: "u", meta: { desc_suggestion: "מהתמונה השנייה" } }];
  assert.equal(suggestionOf(imgs), "מהתמונה השנייה");
  assert.ok(formsHtml({ ...ctx, groups: [{ images: imgs }] }).includes('class="sugg">מהתמונה השנייה'));
});
