/* Rébecca Studio — "מאגרים": list, search, filter, add, edit, duplicate, delete and export for every back-office table.
   One generic engine driven by the TABLES config below. Recipes, purchase docs and sales docs also edit their lines. */
window.RSData = function (sb, { $, esc, toast, fail, openProduct, onChange }) {
  /* ---------------- value lists (mirror the database CHECK constraints) ---------------- */
  const MAT_PREFIX = { "שמנים": "OIL", "חמאות": "BTR", "שעוות": "WAX", "ריחות": "EO", "צבענים": "CLR", "תוספים": "ADD", "בסיסים וסודה": "BAS", "צמחים ועיטורים": "BOT", "חומרים לנרות": "WCK" };
  const MOLD_PREFIX = { "תבנית": "MO", "כלי עזר": "TL", "חותמת": "SM", "כלי לנר": "VS" };
  const PDOC = { "בקשה להצעת מחיר": "RFQ", "הזמנת רכש": "PO" };
  const SDOC = { "הצעת מחיר": "QT", "הזמנה": "SO", "קבלה": "RCT" };
  const EN = {
    matCat: Object.keys(MAT_PREFIX), useIn: ["סבון", "נר", "שניהם"], approval: ["ממתין", "מאושר", "לבדוק", "להסיר"],
    method: ["CP — תהליך קר", "HP — תהליך חם", "MP — המסה ויציקה", "נר", "אחר"], lye: ["NaOH", "KOH"],
    stage: ["שמנים וחמאות", "נוזלים", "בסיס (סודה)", "ריח", "צבע", "תוספים", "עיטור"],
    moldKind: Object.keys(MOLD_PREFIX), moldSrc: ["ייצור עצמי", "נקנה", "בתכנון"],
    batch: ["בייצור", "בייבוש", "מוכן", "נמכר", "נגמר"], origin: ["ארץ", "חו\"ל"],
    pdoc: Object.keys(PDOC), pstat: ["טיוטה", "נשלח", "התקבלה הצעה", "אושר", "התקבל במלואו", "התקבל חלקית", "בוטל"],
    sdoc: Object.keys(SDOC), sstat: ["טיוטה", "נשלחה", "אושרה", "בייצור", "נשלח ללקוח", "נמסר", "שולם", "בוטל"],
    cust: ["פרטי", "ארגון", "עסק", "מוסד חינוך"], pay: ["מזומן", "העברה בנקאית", "ביט", "פייבוקס", "אשראי", "צ'ק"],
    shipM: ["דואר ישראל — רשום", "דואר ישראל — חבילה", "דואר ישראל — שליח עד הבית", "חברת שליחויות", "שליח פרטי", "איסוף עצמי", "מסירה אישית"],
    shipSt: ["הוכן", "נשלח", "בדרך", "נמסר", "חזר לשולח", "בעיה"], paidBy: ["הלקוח", "הסטודיו"],
    pdStatus: ["טיוטה", "מאושר", "באתר", "לא למכירה"]
  };
  const PCAT = { soap: "סבונים", candle: "נרות", bundle: "מארזים", other: "עוד" };
  const FA_HE = { lauric: "לאורית", myristic: "מיריסטית", palmitic: "פלמיטית", stearic: "סטארית", ricinoleic: "ריצינולאית", oleic: "אולאית", linoleic: "לינולאית", linolenic: "לינולנית" };

  /* ---------------- lookups for linked fields ---------------- */
  const REF = {
    materials: { cols: "id,name_he,category", label: r => r.name_he, group: r => r.category, order: "category" },
    suppliers: { cols: "id,name", label: r => r.name },
    molds_tools: { cols: "id,name,kind", label: r => r.name, group: r => r.kind },
    recipes: { cols: "id,name", label: r => r.name },
    customers: { cols: "id,name", label: r => r.name },
    products: { cols: "id,name_he,category,price", label: r => r.name_he, group: r => PCAT[r.category], hideKey: true, order: "category" },
    batches: { cols: "id,made_on", label: r => r.made_on || "" },
    purchase_docs: { key: "number", cols: "number,doc_type", label: r => r.doc_type },
    sales_docs: { key: "number", cols: "number,doc_type,customer_id", label: r => r.doc_type }
  };
  const refKey = t => REF[t].key || "id";

  /* ---------------- field helpers ---------------- */
  const F = (k, l, t = "text", x = {}) => ({ k, l, t, ...x });
  const req = { req: true }, ltr = { dir: "ltr" };

  /* ---------------- tables ---------------- */
  const TABLES = {
    products: {
      label: "מוצרים", group: "מוצרים ומלאי", special: "products", pk: "id",
      cols: [F("name_he", "שם"), F("category", "קטגוריה", "fmt", { fmt: r => PCAT[r.category] || r.category }), F("price", "מחיר", "money"),
        F("sku", "מק״ט", "text", ltr), F("recipe_id", "מתכון", "ref", { ref: "recipes" }), F("cost_unit", "עלות חומרים ליחידה", "money"),
        F("published", "באתר", "bool")],
      filters: [{ k: "category", l: "קטגוריה", fmt: v => PCAT[v] || v }],
      hint: "עריכה ומחיקה של מוצר נפתחות בעורך המוצרים הרגיל (תמונות, תיאור, פרטי ייצור)."
    },
    materials: {
      label: "חומרים", group: "מוצרים ומלאי", pk: "id", order: [["category"], ["name_he"]],
      title: r => r.name_he,
      cols: [F("name_he", "שם"), F("id", "קוד", "text", ltr), F("category", "קטגוריה"), F("subcategory", "תת־קטגוריה"),
        F("use_in", "שימוש"), F("approval", "אישור"), F("on_shelf", "במלאי", "bool"), F("preferred_supplier_id", "ספק מועדף", "ref", { ref: "suppliers" })],
      filters: [{ k: "category", l: "קטגוריה" }, { k: "approval", l: "אישור" }, { k: "on_shelf", l: "במלאי", fmt: v => v ? "במלאי" : "לא במלאי" }],
      secs: [
        { n: "זיהוי", f: [F("category", "קטגוריה", "enum", { o: EN.matCat, ...req }), F("family", "קוד משפחה (3 אותיות באנגלית)", "text", { ...ltr, ...req, ph: "LAV", max: 3, upper: true }),
          F("id", "קוד החומר", "text", { ...ltr, ...req, keyField: true, hint: "נוצר מהקטגוריה ומקוד המשפחה. לשמן ניחוח (לא אתרי) שנו את EO ל-FO." }),
          F("name_he", "שם בעברית", "text", req), F("name_en", "שם באנגלית", "text", ltr), F("subcategory", "תת־קטגוריה"),
          F("use_in", "שימוש", "enum", { o: EN.useIn }), F("approval", "אישור", "enum", { o: EN.approval, ...req }),
          F("preferred_supplier_id", "ספק מועדף", "ref", { ref: "suppliers" }), F("on_shelf", "יש במלאי", "bool")] },
        { n: "מידע מקצועי", f: [F("inci", "INCI", "text", ltr), F("inci_soap", "INCI בסבון", "text", ltr), F("usage_range", "טווח שימוש"),
          F("properties", "תכונות", "long"), F("suits", "מתאים ל…", "long"), F("caution", "זהירות", "long"), F("notes", "הערות", "long")] },
        { n: "נתונים למחשבון הסבון", hint: "לשמנים, חמאות ושעוות שנכנסים לסבון. ערך סודה (SAP) במ״ג KOH לגרם, כמו ב-SoapCalc. חומר בלי ערך סודה לא יחושב במחשבון.",
          f: [F("sap_koh", "ערך סודה (SAP KOH)", "num", { ph: "190" }), F("soap_data", "מקור הנתונים", "enum", { o: ["מאומת", "ספרותי"], hint: "מאומת = נבדק מול Soapmaking Friend." }),
            F("iodine", "ערך יוד", "num"), F("ins", "INS", "num"), F("fatty_acids", "חומצות שומן (%)", "fa")] }
      ],
      defaults: { approval: "ממתין", on_shelf: false },
      related: [{ t: "recipes", l: "במתכונים", via: { t: "recipe_lines", fk: "material_id", pick: "recipe_id" } },
        { t: "supplier_items", fk: "material_id", l: "מחירים אצל ספקים" },
        { t: "products", l: "במוצרים", via: { t: "product_materials", fk: "material_id", pick: "product_id" } }]
    },
    recipes: {
      label: "מתכונים", group: "מוצרים ומלאי", pk: "id", seq: "RC", order: [["id"]],
      title: r => r.name,
      cols: [F("id", "מספר", "text", ltr), F("name", "שם"), F("method", "שיטה"), F("oils_g", "שמנים (גרם)", "num"), F("superfat", "שומן עודף", "pct"),
        F("batch_g", "משקל המנה (גרם)", "num"), F("recipe_date", "תאריך", "date")],
      filters: [{ k: "method", l: "שיטה" }, { k: "author", l: "מחבר" }],
      secs: [
        { n: "פרטים", f: [F("name", "שם המתכון", "text", req), F("method", "שיטה", "enum", { o: EN.method }), F("author", "מחבר"),
          F("recipe_date", "תאריך", "date"), F("source", "מקור"), F("source_file", "קישור למקור", "text", ltr)] },
        { n: "חישוב", f: [F("oils_g", "סך השמנים (גרם)", "num", { hint: "שינוי הסך משנה את הגרמים של כל השמנים לפי האחוזים." }), F("superfat", "שומן עודף (%)", "pct"), F("lye_type", "סוג בסיס", "enum", { o: EN.lye }),
          F("lye_purity", "טוהר הבסיס (%)", "pct", { hint: "100 = כמו Soapmaking Friend. לסודה של 99% אפשר לרשום 99." })] },
        { n: "כמויות שנשמרות עם המתכון", f: [F("lye_g", "בסיס (גרם)", "num", { out: true }), F("liquid_g", "נוזלים (גרם)", "num", { out: true }),
          F("lye_concentration", "ריכוז הבסיס (%)", "pct", { out: true }), F("liquid_lye_ratio", "יחס נוזל:בסיס", "text", { ...ltr, out: true }), F("fragrance_g", "ריח (גרם)", "num", { out: true }),
          F("batch_g", "משקל המנה (גרם)", "num", { out: true })],
          hint: "מחושב אוטומטית במחשבון שלמעלה." },
        { n: "הערות", f: [F("notes", "הערות, ריחות ותוספים", "long", { rows: 4 })] }
      ],
      defaults: { method: "CP — תהליך קר", lye_type: "NaOH", lye_purity: 1, superfat: 0.05, source: "סטודיו", oils_g: 1000 },
      calc: true, calcAfter: 1,
      beforeSave(row) { if (window.RSCalcUI) window.RSCalcUI.beforeSave(row); },
      lines: {
        t: "recipe_lines", fk: "recipe_id", seq: "sort_order", title: "רכיבי המתכון", after: 0,
        cols: [F("material_id", "רכיב", "ref", { ref: "materials", w: 3, ...req }), F("stage", "שלב", "enum", { o: EN.stage, w: 2 }),
          F("pct_of_oils", "% מהשמנים", "pct", { w: 1 }), F("grams", "גרם", "num", { w: 1 }), F("notes", "הערה", "text", { w: 2 })],
        blank: () => ({ stage: "שמנים וחמאות" }),
        derive(line, k, form) {
          const oils = num(form.oils_g);
          if (k === "pct_of_oils" && oils && line.pct_of_oils != null) line.grams = round(line.pct_of_oils * oils, 2);
          if (k === "grams" && oils && line.grams != null && line.stage === "שמנים וחמאות") line.pct_of_oils = round(line.grams / oils, 4);
        },
        onForm(k, lines, form) { if (k === "oils_g") { const o = num(form.oils_g); if (o) lines.forEach(l => { if (l.pct_of_oils != null) l.grams = round(l.pct_of_oils * o, 2); }); return true; } },
        footer(lines) {
          const oil = lines.filter(l => l.stage === "שמנים וחמאות");
          const p = oil.reduce((s, l) => s + (num(l.pct_of_oils) || 0), 0), g = oil.reduce((s, l) => s + (num(l.grams) || 0), 0);
          const ok = Math.abs(p - 1) < 0.002;
          return `<span class="tag ${ok ? "ok" : "warn"}">שמנים: ${fmtN(p * 100, 1)}%${ok ? "" : " (צריך 100%)"}</span> <span class="tag">${fmtN(g, 1)} גרם</span>${ok || !g ? "" : ` <button type="button" class="chip" id="dmBalance">איזון ל-100% לפי הגרמים</button>`}`;
        }
      },
      related: [{ t: "products", l: "מוצרים עם המתכון", via: { t: "product_details", fk: "recipe_id", pick: "product_id" } }, { t: "batches", fk: "recipe_id", l: "אצוות ייצור" }]
    },
    molds_tools: {
      label: "תבניות וכלים", group: "מוצרים ומלאי", pk: "id", order: [["id"]],
      title: r => r.name,
      cols: [F("id", "קוד", "text", ltr), F("name", "שם"), F("kind", "סוג"), F("material", "חומר"), F("fill_grams", "מילוי (גרם)", "num"),
        F("cavities", "חללים", "int"), F("in_use", "בשימוש", "bool"), F("for_sale", "למכירה", "bool")],
      filters: [{ k: "kind", l: "סוג" }, { k: "source", l: "מקור" }],
      secs: [
        { n: "פרטים", f: [F("kind", "סוג", "enum", { o: EN.moldKind, ...req }), F("name", "שם", "text", req), F("material", "חומר"), F("shape", "צורה"),
          F("cavity_mm", "מידות חלל (מ״מ)", "text", ltr), F("fill_grams", "משקל מילוי לכל התבנית (גרם)", "num"), F("cavities", "מספר חללים", "int"),
          F("source", "מקור", "enum", { o: EN.moldSrc }), F("fits", "מתאים ל…"), F("in_use", "בשימוש", "bool"), F("for_sale", "למכירה", "bool")] },
        { n: "מחיר", f: [F("cost_ils", "עלות (₪)", "money"), F("price_ils", "מחיר מכירה (₪)", "money"), F("store_product_id", "מוצר בחנות", "ref", { ref: "products" })] },
        { n: "הערות", f: [F("notes", "הערות", "long")] }
      ],
      defaults: { kind: "תבנית", in_use: true, for_sale: false },
      newKey: async row => nextSeq("molds_tools", "id", MOLD_PREFIX[row.kind] || "MO"),
      related: [{ t: "supplier_items", fk: "mold_tool_id", l: "אצל ספקים" }, { t: "products", l: "מוצרים", via: { t: "product_details", fk: "mold_tool_id", pick: "product_id" } }, { t: "batches", fk: "mold_tool_id", l: "אצוות" }]
    },
    batches: {
      label: "יומן ייצור", group: "מוצרים ומלאי", pk: "id", doc: () => "B", order: [["made_on", false]],
      title: r => `${r.id} · ${refText("recipes", r.recipe_id) || ""}`,
      cols: [F("id", "אצווה", "text", ltr), F("made_on", "תאריך", "date"), F("recipe_id", "מתכון", "ref", { ref: "recipes" }), F("product_id", "מוצר", "ref", { ref: "products" }),
        F("units", "יחידות", "int"), F("ready_on", "מוכן ב-", "date"), F("status", "סטטוס")],
      filters: [{ k: "status", l: "סטטוס" }],
      secs: [{ n: "אצווה", f: [F("made_on", "תאריך ייצור", "date", req), F("status", "סטטוס", "enum", { o: EN.batch, ...req }), F("recipe_id", "מתכון", "ref", { ref: "recipes" }),
        F("mold_tool_id", "תבנית", "ref", { ref: "molds_tools" }), F("product_id", "מוצר", "ref", { ref: "products" }), F("units", "יחידות", "int"),
        F("total_g", "משקל כולל (גרם)", "num"), F("cure_days", "ימי ייבוש", "int"), F("ready_on", "מוכן לשימוש", "date", { hint: "אם ריק: תאריך הייצור ועוד ימי הייבוש." }), F("notes", "הערות", "long")] }],
      defaults: () => ({ made_on: today(), status: "בייצור", cure_days: 28 }),
      beforeSave(row) { if (!row.ready_on && row.made_on && row.cure_days) { const d = new Date(row.made_on); d.setDate(d.getDate() + row.cure_days); row.ready_on = d.toISOString().slice(0, 10); } },
      related: [{ t: "sales_docs", l: "במסמכי מכירה", via: { t: "sales_lines", fk: "batch_id", pick: "doc_number" } }]
    },
    suppliers: {
      label: "ספקים", group: "רכש", pk: "id", seq: "SUP", order: [["id"]],
      title: r => r.name,
      cols: [F("id", "קוד", "text", ltr), F("name", "שם"), F("origin", "ארץ/חו״ל"), F("phone", "טלפון", "text", ltr), F("sells", "מה מוכרים"), F("rating", "דירוג", "int")],
      filters: [{ k: "origin", l: "ארץ/חו״ל" }],
      secs: [
        { n: "פרטים", f: [F("name", "שם הספק", "text", req), F("origin", "ארץ / חו״ל", "enum", { o: EN.origin }), F("contact_person", "איש קשר"),
          F("phone", "טלפון", "text", ltr), F("whatsapp", "וואטסאפ", "text", ltr), F("email", "מייל", "text", ltr), F("website", "אתר", "text", ltr), F("address", "כתובת"),
          F("rating", "דירוג (1–5)", "int", { min: 1, max: 5 })] },
        { n: "תנאים", f: [F("sells", "מה מוכרים", "long"), F("shipping", "משלוח"), F("payment", "תשלום"), F("lead_time", "זמן אספקה"), F("prices_vat", "מחירים כוללים מע״מ?"), F("notes", "הערות", "long")] }
      ],
      defaults: { origin: "ארץ" },
      related: [{ t: "supplier_items", fk: "supplier_id", l: "פריטים ומחירים" }, { t: "purchase_docs", fk: "supplier_id", l: "מסמכי רכש" }, { t: "materials", fk: "preferred_supplier_id", l: "ספק מועדף לחומרים" }]
    },
    supplier_items: {
      label: "מחירי ספקים", group: "רכש", pk: "id", view: "supplier_item_prices", order: [["supplier_id"], ["product_name"]],
      title: r => r.product_name,
      cols: [F("supplier_id", "ספק", "ref", { ref: "suppliers" }), F("product_name", "מוצר אצל הספק"), F("material_id", "חומר", "ref", { ref: "materials" }),
        F("package_text", "אריזה"), F("price", "מחיר", "money"), F("price_per_unit", "מחיר ליחידה", "money"), F("checked_on", "נבדק", "date")],
      filters: [{ k: "supplier_id", l: "ספק", ref: "suppliers" }, { k: "preferred", l: "מועדף", fmt: v => v ? "מועדף" : "לא מועדף" }],
      secs: [
        { n: "פריט", f: [F("supplier_id", "ספק", "ref", { ref: "suppliers", ...req }), F("product_name", "שם המוצר אצל הספק", "text", req),
          F("material_id", "חומר אצלנו", "ref", { ref: "materials" }), F("mold_tool_id", "או תבנית/כלי", "ref", { ref: "molds_tools" }),
          F("supplier_sku", "מק״ט ספק", "text", ltr), F("url", "קישור", "text", ltr)] },
        { n: "מחיר", f: [F("package_text", "אריזה (טקסט)"), F("package_qty", "כמות באריזה", "num"), F("unit", "יחידה", "text", { ph: "גרם / מ״ל / יח׳" }),
          F("price", "מחיר (₪)", "money"), F("price_to", "עד מחיר (₪)", "money"), F("includes_vat", "כולל מע״מ", "bool"), F("preferred", "ספק מועדף לפריט", "bool"),
          F("checked_on", "תאריך בדיקה", "date"), F("notes", "הערות", "long")] }
      ],
      defaults: () => ({ includes_vat: true, checked_on: today() })
    },
    purchase_docs: {
      label: "מסמכי רכש", group: "רכש", pk: "number", doc: r => PDOC[r.doc_type] || "PO", order: [["doc_date", false], ["number", false]],
      title: r => `${r.number} · ${refText("suppliers", r.supplier_id) || ""}`,
      cols: [F("number", "מספר", "text", ltr), F("doc_type", "סוג"), F("doc_date", "תאריך", "date"), F("supplier_id", "ספק", "ref", { ref: "suppliers" }), F("status", "סטטוס"), F("wanted_by", "נדרש עד", "date")],
      filters: [{ k: "doc_type", l: "סוג" }, { k: "status", l: "סטטוס" }],
      secs: [{ n: "מסמך", f: [F("doc_type", "סוג המסמך", "enum", { o: EN.pdoc, ...req, lockOnEdit: true }), F("doc_date", "תאריך", "date", req), F("supplier_id", "ספק", "ref", { ref: "suppliers", ...req }),
        F("status", "סטטוס", "enum", { o: EN.pstat, ...req }), F("wanted_by", "נדרש עד", "date"), F("related_number", "מסמך קשור", "ref", { ref: "purchase_docs" }), F("notes", "הערות", "long")] }],
      defaults: () => ({ doc_type: "בקשה להצעת מחיר", doc_date: today(), status: "טיוטה" }),
      lines: {
        t: "purchase_lines", fk: "doc_number", seq: "line_no", title: "שורות", after: 0,
        cols: [F("material_id", "חומר", "ref", { ref: "materials", w: 3 }), F("description", "תיאור", "text", { w: 3, ...req }), F("qty", "כמות", "num", { w: 1, ...req }),
          F("unit", "יחידה", "text", { w: 1 }), F("unit_price", "מחיר ליחידה", "money", { w: 1 })],
        blank: () => ({ qty: 1 }),
        derive(line, k) { if (k === "material_id" && line.material_id && !line.description) line.description = refLabel("materials", line.material_id); },
        footer(lines) { const s = lines.reduce((a, l) => a + (num(l.qty) || 0) * (num(l.unit_price) || 0), 0); return `<span class="tag">סה״כ: ${money(s)}</span>`; }
      }
    },
    customers: {
      label: "לקוחות", group: "מכירות", pk: "id", seq: "CU", order: [["name"]],
      title: r => r.name,
      cols: [F("name", "שם"), F("id", "קוד", "text", ltr), F("kind", "סוג"), F("phone", "טלפון", "text", ltr), F("email", "מייל", "text", ltr), F("city", "עיר")],
      filters: [{ k: "kind", l: "סוג" }, { k: "city", l: "עיר" }],
      secs: [{ n: "לקוח", f: [F("name", "שם", "text", req), F("kind", "סוג", "enum", { o: EN.cust }), F("contact", "איש קשר"), F("phone", "טלפון", "text", ltr),
        F("email", "מייל", "text", ltr), F("address", "כתובת"), F("city", "עיר"), F("company_no", "ח.פ / ע.מ", "text", ltr), F("referral", "הגיע דרך"), F("notes", "הערות", "long")] }],
      defaults: { kind: "פרטי" },
      related: [{ t: "sales_docs", fk: "customer_id", l: "מסמכי מכירה" }]
    },
    sales_docs: {
      label: "הצעות, הזמנות וקבלות", group: "מכירות", pk: "number", doc: r => SDOC[r.doc_type] || "QT", order: [["doc_date", false], ["number", false]],
      title: r => `${r.number} · ${refText("customers", r.customer_id) || ""}`,
      cols: [F("number", "מספר", "text", ltr), F("doc_type", "סוג"), F("doc_date", "תאריך", "date"), F("customer_id", "לקוח", "ref", { ref: "customers" }), F("status", "סטטוס"), F("total", "סה״כ", "money")],
      filters: [{ k: "doc_type", l: "סוג" }, { k: "status", l: "סטטוס" }],
      secs: [
        { n: "מסמך", f: [F("doc_type", "סוג המסמך", "enum", { o: EN.sdoc, ...req, lockOnEdit: true }), F("doc_date", "תאריך", "date", req), F("customer_id", "לקוח", "ref", { ref: "customers", ...req }),
          F("status", "סטטוס", "enum", { o: EN.sstat, ...req }), F("valid_until", "בתוקף עד", "date"), F("related_number", "מסמך קשור (למשל ההצעה)", "ref", { ref: "sales_docs" })] },
        { n: "תשלום", f: [F("discount_pct", "הנחה (%)", "pct"), F("shipping_ils", "משלוח (₪)", "money"), F("payment_method", "אמצעי תשלום", "enum", { o: EN.pay }),
          F("received_ils", "התקבל בפועל (₪)", "money"), F("payment_ref", "אסמכתא"), F("notes", "הערות", "long")] }
      ],
      defaults: () => ({ doc_type: "הצעת מחיר", doc_date: today(), status: "טיוטה", discount_pct: 0, shipping_ils: 0 }),
      lines: {
        t: "sales_lines", fk: "doc_number", seq: "line_no", title: "שורות", after: 0,
        cols: [F("product_id", "מוצר", "ref", { ref: "products", w: 3 }), F("description", "תיאור", "text", { w: 3, ...req }), F("qty", "כמות", "num", { w: 1, ...req }),
          F("unit_price", "מחיר ליחידה", "money", { w: 1, ...req }), F("batch_id", "אצווה", "ref", { ref: "batches", w: 2 })],
        blank: () => ({ qty: 1 }),
        derive(line, k) {
          if (k !== "product_id" || !line.product_id) return;
          const p = refRow("products", line.product_id); if (!p) return;
          if (!line.description) line.description = p.name_he;
          if (line.unit_price == null && p.price != null) line.unit_price = Number(p.price);
        },
        footer(lines, form) {
          const sub = lines.reduce((a, l) => a + (num(l.qty) || 0) * (num(l.unit_price) || 0), 0);
          const disc = sub * (num(form.discount_pct) || 0), ship = num(form.shipping_ils) || 0;
          return `<span class="tag">לפני הנחה: ${money(sub)}</span>${disc ? ` <span class="tag">הנחה: −${money(disc)}</span>` : ""}${ship ? ` <span class="tag">משלוח: ${money(ship)}</span>` : ""} <span class="tag ok">סה״כ: ${money(sub - disc + ship)}</span>`;
        },
        onForm(k) { return k === "discount_pct" || k === "shipping_ils"; }
      },
      related: [{ t: "shipments", fk: "doc_number", l: "משלוחים" }]
    },
    shipments: {
      label: "משלוחים", group: "מכירות", pk: "id", doc: () => "SH", order: [["sent_on", false]],
      title: r => `${r.id} · ${r.doc_number}`,
      cols: [F("id", "משלוח", "text", ltr), F("sent_on", "נשלח", "date"), F("doc_number", "מסמך", "text", ltr), F("method", "אופן"), F("tracking_no", "מעקב", "text", ltr), F("status", "סטטוס")],
      filters: [{ k: "status", l: "סטטוס" }, { k: "method", l: "אופן" }],
      secs: [{ n: "משלוח", f: [F("doc_number", "מסמך מכירה", "ref", { ref: "sales_docs", ...req }), F("sent_on", "תאריך שליחה", "date", req), F("method", "אופן משלוח", "enum", { o: EN.shipM }),
        F("carrier", "חברה"), F("tracking_no", "מספר מעקב", "text", ltr), F("address", "כתובת למשלוח"), F("cost_ils", "עלות (₪)", "money"),
        F("paid_by", "מי משלם", "enum", { o: EN.paidBy }), F("status", "סטטוס", "enum", { o: EN.shipSt, ...req }), F("delivered_on", "נמסר בתאריך", "date"), F("notes", "הערות", "long")] }],
      defaults: () => ({ sent_on: today(), status: "הוכן", paid_by: "הלקוח" })
    }
  };

  /* ---------------- small utils ---------------- */
  const num = v => { if (v == null || v === "") return null; const n = Number(String(v).replace(",", ".")); return isFinite(n) ? n : null; };
  const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
  const fmtN = (n, d = 2) => n == null ? "" : Number(n).toLocaleString("he-IL", { maximumFractionDigits: d });
  const money = n => n == null || n === "" ? "" : "₪" + Number(n).toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const fmtDate = v => v ? String(v).slice(0, 10).split("-").reverse().join(".") : "";
  const allFields = cfg => (cfg.secs || []).flatMap(s => s.f);
  const pkOf = (cfg, r) => r[cfg.pk];

  /* ---------------- state ---------------- */
  const S = { t: "materials", rows: [], q: "", f: {}, jump: null, sort: null, limit: 150, refs: {}, loaded: {}, edit: null, lines: [], removed: [], dirty: false };
  try { const last = localStorage.getItem("rs_dm_table"); if (last && TABLES[last]) S.t = last; } catch (e) {}

  /* ---------------- references ---------------- */
  async function loadRef(t, force) {
    if (S.refs[t] && !force) return;
    const d = REF[t];
    let q = sb.from(t).select(d.cols).limit(5000);
    q = d.order ? q.order(d.order).order(refKey(t)) : q.order(refKey(t));
    const { data, error } = await q;
    if (error) throw error;
    S.refs[t] = { rows: data, by: Object.fromEntries(data.map(r => [r[refKey(t)], r])) };
  }
  const refRow = (t, v) => S.refs[t] && S.refs[t].by[v];
  const refLabel = (t, v) => { const r = refRow(t, v); return r ? REF[t].label(r) : ""; };
  function refText(t, v) {
    if (v == null || v === "") return "";
    const l = refLabel(t, v);
    if (REF[t].hideKey) return l || "(נמחק)";
    return l ? `${v} · ${l}` : String(v);
  }
  function refsFor(cfg) {
    const ts = new Set();
    [...(cfg.cols || []), ...(cfg.filters || [])].forEach(f => { if (f.ref) ts.add(f.ref); });
    return [...ts];
  }
  function refOptions(t, cur, allowEmpty = true) {
    const d = REF[t], rows = (S.refs[t] || { rows: [] }).rows, k = refKey(t);
    const opt = r => `<option value="${esc(r[k])}" ${String(r[k]) === String(cur ?? "") ? "selected" : ""}>${esc(d.hideKey ? d.label(r) : `${r[k]} · ${d.label(r)}`)}</option>`;
    let html = allowEmpty ? `<option value="">—</option>` : "";
    if (d.group) {
      const g = {}; rows.forEach(r => { const n = d.group(r) || "אחר"; (g[n] = g[n] || []).push(r); });
      html += Object.entries(g).map(([n, rs]) => `<optgroup label="${esc(n)}">${rs.map(opt).join("")}</optgroup>`).join("");
    } else html += rows.map(opt).join("");
    if (cur != null && cur !== "" && !rows.some(r => String(r[k]) === String(cur))) html += `<option value="${esc(cur)}" selected>${esc(cur)}</option>`;
    return html;
  }

  /* ---------------- formatting ---------------- */
  function cell(f, r) {
    const v = r[f.k];
    switch (f.t) {
      case "fmt": return esc(f.fmt(r));
      case "bool": return v ? `<span class="dm-yes">✓</span>` : "";
      case "pct": return v == null ? "" : fmtN(v * 100, 2) + "%";
      case "money": return esc(money(v));
      case "num": case "int": return esc(fmtN(v));
      case "date": return esc(fmtDate(v));
      case "ref": return esc(refText(f.ref, v));
      default: return f.dir === "ltr" ? `<span dir="ltr">${esc(v)}</span>` : esc(v);
    }
  }
  function searchText(cfg, r) {
    return [...Object.values(r).map(v => v == null || typeof v === "object" ? "" : String(v)), ...(cfg.cols || []).filter(f => f.ref).map(f => refLabel(f.ref, r[f.k]))].join(" ").toLowerCase();
  }

  /* ---------------- loading a table ---------------- */
  async function loadTable() {
    const cfg = TABLES[S.t];
    $("#dmList").innerHTML = `<div class="empty">טוען…</div>`;
    try {
      await Promise.all(refsFor(cfg).map(t => loadRef(t)));
      if (cfg.special === "products") {
        const [p, d] = await Promise.all([sb.from("products").select("*").order("category").order("sort_order"), sb.from("product_details").select("product_id,sku,recipe_id,status,cost_estimate,unit_weight_g")]);
        if (p.error) throw p.error; if (d.error) throw d.error;
        const by = Object.fromEntries(d.data.map(x => [x.product_id, x]));
        S.rows = p.data.map(x => { const e = by[x.id] || {}; return { ...x, sku: e.sku || null, recipe_id: e.recipe_id || null, pd_status: e.status || null, cost_unit: e.cost_estimate ? e.cost_estimate.per_unit : null }; });
      } else {
        let q = sb.from(cfg.view || S.t).select("*").limit(5000);
        (cfg.order || [[cfg.pk]]).forEach(([c, asc = true]) => { q = q.order(c, { ascending: asc }); });
        const { data, error } = await q; if (error) throw error;
        S.rows = data;
        if (S.t === "sales_docs" && data.length) {
          const { data: tot } = await sb.from("sales_doc_totals").select("number,total");
          const by = Object.fromEntries((tot || []).map(x => [x.number, x.total]));
          S.rows.forEach(r => { r.total = by[r.number] ?? null; });
        }
      }
      S.loaded[S.t] = true;
      render();
    } catch (e) { $("#dmList").innerHTML = `<div class="empty">לא ניתן לטעון את הטבלה כרגע.</div>`; fail(e); }
  }

  /* ---------------- list view ---------------- */
  function renderTables() {
    const groups = {};
    Object.entries(TABLES).forEach(([k, c]) => { (groups[c.group] = groups[c.group] || []).push([k, c]); });
    $("#dmTables").innerHTML = Object.entries(groups).map(([g, ts]) => `<div class="dm-group"><span class="dm-gl">${esc(g)}</span><div class="chips">${ts.map(([k, c]) => `<button type="button" class="chip ${k === S.t ? "on" : ""}" data-dmt="${k}">${esc(c.label)}</button>`).join("")}</div></div>`).join("");
  }
  function filtered() {
    const cfg = TABLES[S.t], q = S.q.trim().toLowerCase();
    let rows = S.rows.filter(r => {
      for (const [k, v] of Object.entries(S.f)) if (v !== "" && String(r[k] ?? "") !== v) return false;
      if (S.jump && !S.jump.vals.includes(String(r[S.jump.col] ?? ""))) return false;
      return !q || searchText(cfg, r).includes(q);
    });
    if (S.sort) {
      const f = cfg.cols.find(c => c.k === S.sort.k), dir = S.sort.asc ? 1 : -1;
      const val = r => f && f.t === "ref" ? refLabel(f.ref, r[f.k]) : f && f.t === "fmt" ? f.fmt(r) : r[S.sort.k];
      rows = [...rows].sort((a, b) => {
        const x = val(a), y = val(b);
        if (x == null || x === "") return 1; if (y == null || y === "") return -1;
        const isNum = v => typeof v === "number" || typeof v === "boolean" || /^-?\d+([.,]\d+)?$/.test(String(v));
        return (isNum(x) && isNum(y) ? Number(x) - Number(y) : String(x).localeCompare(String(y), "he")) * dir;
      });
    }
    return rows;
  }
  function renderFilters() {
    const cfg = TABLES[S.t];
    const sel = (cfg.filters || []).map(fl => {
      const vals = [...new Set(S.rows.map(r => r[fl.k]).filter(v => v != null && v !== ""))].map(String).sort((a, b) => a.localeCompare(b, "he"));
      if (vals.length < 2 && !S.f[fl.k]) return "";
      const lab = v => fl.ref ? refText(fl.ref, v) : fl.fmt ? fl.fmt(v === "true" ? true : v === "false" ? false : v) : v;
      return `<select data-dmf="${fl.k}" aria-label="${esc(fl.l)}"><option value="">${esc(fl.l)}: הכל</option>${vals.map(v => `<option value="${esc(v)}" ${S.f[fl.k] === v ? "selected" : ""}>${esc(lab(v))}</option>`).join("")}</select>`;
    }).join("");
    const jump = S.jump ? `<button type="button" class="chip on" id="dmJumpClear">${esc(S.jump.label)} ✕</button>` : "";
    $("#dmFilters").innerHTML = jump + sel;
    $("#dmFilters").hidden = !(jump || sel);
  }
  function render() {
    const cfg = TABLES[S.t];
    renderTables(); renderFilters();
    $("#dmTitle").textContent = cfg.label;
    $("#dmHint").textContent = cfg.hint || "";
    $("#dmHint").hidden = !cfg.hint;
    const rows = filtered(), shown = rows.slice(0, S.limit);
    $("#dmMeta").innerHTML = `<span>${rows.length === S.rows.length ? `${rows.length} רשומות` : `${rows.length} מתוך ${S.rows.length}`}</span><button type="button" class="chip" id="dmExport">ייצוא לאקסל</button>`;
    if (!rows.length) { $("#dmList").innerHTML = `<div class="empty">${S.rows.length ? "לא נמצא. נסי חיפוש אחר או נקי את הסינון." : `עדיין אין כאן רשומות. לחצי על "+ חדש".`}</div>`; return; }
    const th = cfg.cols.map(c => `<th><button type="button" data-dms="${c.k}">${esc(c.l)}${S.sort && S.sort.k === c.k ? (S.sort.asc ? " ▲" : " ▼") : ""}</button></th>`).join("");
    const tr = shown.map(r => `<tr data-dmk="${esc(pkOf(cfg, r))}" tabindex="0">${cfg.cols.map((c, i) => `<td data-l="${esc(c.l)}"${i === 0 ? ` class="dm-first"` : ""}>${cell(c, r)}</td>`).join("")}</tr>`).join("");
    $("#dmList").innerHTML = `<table class="dm-table"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>` +
      (rows.length > shown.length ? `<button type="button" class="btn wide" id="dmMore">הצגת עוד ${Math.min(150, rows.length - shown.length)} (מתוך ${rows.length - shown.length} נוספות)</button>` : "");
  }

  function switchTable(t, jump) {
    S.t = t; S.q = ""; S.f = {}; S.sort = null; S.limit = 150; S.jump = jump || null;
    $("#dmSearch").value = "";
    try { localStorage.setItem("rs_dm_table", t); } catch (e) {}
    loadTable();
  }

  /* ---------------- events: list ---------------- */
  $("#dmTables").addEventListener("click", e => { const b = e.target.closest("[data-dmt]"); if (b) switchTable(b.dataset.dmt); });
  $("#dmSearch").addEventListener("input", e => { S.q = e.target.value; S.limit = 150; render(); });
  $("#dmFilters").addEventListener("change", e => { const s = e.target.closest("[data-dmf]"); if (s) { S.f[s.dataset.dmf] = s.value; S.limit = 150; render(); } });
  $("#dmFilters").addEventListener("click", e => { if (e.target.closest("#dmJumpClear")) { S.jump = null; render(); } });
  $("#dmMeta").addEventListener("click", e => { if (e.target.closest("#dmExport")) exportCsv(); });
  $("#dmList").addEventListener("click", e => {
    const s = e.target.closest("[data-dms]");
    if (s) { const k = s.dataset.dms; S.sort = S.sort && S.sort.k === k ? (S.sort.asc ? { k, asc: false } : null) : { k, asc: true }; render(); return; }
    if (e.target.closest("#dmMore")) { S.limit += 150; render(); return; }
    const r = e.target.closest("tr[data-dmk]"); if (r) openRecord(r.dataset.dmk);
  });
  $("#dmList").addEventListener("keydown", e => { const r = e.target.closest("tr[data-dmk]"); if (r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openRecord(r.dataset.dmk); } });
  $("#dmNew").addEventListener("click", () => openRecord(null));

  /* ---------------- export ---------------- */
  function exportCsv() {
    const cfg = TABLES[S.t], rows = filtered();
    const fields = cfg.special ? cfg.cols : [...cfg.cols, ...allFields(cfg).filter(f => !cfg.cols.some(c => c.k === f.k) && f.t !== "json")];
    const q = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const val = (f, r) => {
      const v = r[f.k];
      if (f.t === "ref") return refText(f.ref, v);
      if (f.t === "fmt") return f.fmt(r);
      if (f.t === "bool") return v ? "כן" : "";
      if (f.t === "pct") return v == null ? "" : round(v * 100, 2);
      return Array.isArray(v) ? v.join(", ") : v;
    };
    const lines = [fields.map(f => q(f.l)).join(",")].concat(rows.map(r => fields.map(f => q(val(f, r))).join(",")));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${cfg.label}-${today()}.csv`; a.click();
  }

  /* ---------------- editor ---------------- */
  function input(f, v, prefix = "f_") {
    const name = prefix + f.k, dir = f.dir ? ` dir="${f.dir}"` : "", ph = f.ph ? ` placeholder="${esc(f.ph)}"` : "", rq = f.req ? " required" : "";
    switch (f.t) {
      case "long": return `<textarea name="${name}" rows="${f.rows || 3}"${dir}${ph}>${esc(v ?? "")}</textarea>`;
      case "bool": return `<label class="switch"><input type="checkbox" name="${name}" ${v ? "checked" : ""}><span></span> ${esc(f.l)}</label>`;
      case "enum": return `<select name="${name}"${rq}>${f.req ? "" : `<option value="">—</option>`}${f.o.map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}${v && !f.o.includes(v) ? `<option selected>${esc(v)}</option>` : ""}</select>`;
      case "ref": return `<select name="${name}"${rq}>${refOptions(f.ref, v, !f.req || v == null)}</select>`;
      case "date": return `<input type="date" name="${name}" value="${esc(v ? String(v).slice(0, 10) : "")}"${rq}>`;
      case "int": return `<input type="number" step="1" name="${name}" value="${esc(v ?? "")}"${f.min != null ? ` min="${f.min}"` : ""}${f.max != null ? ` max="${f.max}"` : ""} inputmode="numeric" dir="ltr"${rq}>`;
      case "num": case "money": return `<input name="${name}" value="${esc(v ?? "")}" inputmode="decimal" dir="ltr"${ph}${rq}>`;
      case "pct": return `<input name="${name}" value="${v == null ? "" : esc(round(v * 100, 4))}" inputmode="decimal" dir="ltr"${rq}>`;
      case "fa": { const o = v || {}; return `<div class="dm-fa">${["lauric", "myristic", "palmitic", "stearic", "ricinoleic", "oleic", "linoleic", "linolenic"].map(k => `<label><span>${FA_HE[k]}</span><input name="${name}__${k}" value="${esc(o[k] ?? "")}" inputmode="decimal" dir="ltr"></label>`).join("")}</div>`; }
      case "json": return `<div class="dm-json">${v && Object.keys(v).length ? Object.entries(v).map(([k, x]) => `<span class="tag">${esc(k)}: ${esc(x)}</span>`).join(" ") : `<span class="muted">—</span>`}</div>`;
      default: return `<input name="${name}" value="${esc(v ?? "")}"${dir}${ph}${f.max ? ` maxlength="${f.max}"` : ""}${rq}>`;
    }
  }
  function fieldHtml(f, v, isNew) {
    if (f.t === "bool") return `<div class="dm-f dm-bool">${input(f, v)}</div>`;
    const locked = (f.keyField && !isNew) || (f.lockOnEdit && !isNew) || (f.out && S.edit && S.edit.cfg.calc && window.SoapCalc);
    const body = f.out && locked ? input(f, v).replace(/^<input /, `<input readonly class="dm-ro" `) : locked ? `<input value="${esc(v ?? "")}" readonly dir="${f.dir || "auto"}" class="dm-ro"><input type="hidden" name="f_${f.k}" value="${esc(v ?? "")}">` : input(f, v);
    return `<label class="dm-f ${f.t === "long" || f.t === "json" || f.t === "fa" ? "dm-full" : ""}">${esc(f.l)}${f.req ? " *" : ""}${body}${f.hint ? `<small class="muted">${esc(f.hint)}</small>` : ""}</label>`;
  }
  function readField(f, form) {
    const el = form.elements["f_" + f.k]; if (!el && f.t !== "fa") return undefined;
    if (f.t === "json") return undefined;
    if (f.t === "fa") { const o = {}; let any = false; ["lauric", "myristic", "palmitic", "stearic", "ricinoleic", "oleic", "linoleic", "linolenic"].forEach(k => { const e = form.elements[`f_${f.k}__${k}`]; const n = e ? num(e.value) : null; o[k] = n == null ? 0 : n; if (n != null) any = true; }); return any ? o : null; }
    if (f.t === "bool") return el.checked;
    const s = String(el.value).trim();
    if (s === "") return null;
    if (f.t === "num" || f.t === "money") return num(s);
    if (f.t === "int") return parseInt(s, 10);
    if (f.t === "pct") { const n = num(s); return n == null ? null : round(n / 100, 6); }
    if (f.upper) return s.toUpperCase();
    return s;
  }
  function formValues() {
    const form = $("#dmForm"), cfg = TABLES[S.t], o = {};
    allFields(cfg).forEach(f => { const v = readField(f, form); if (v !== undefined) o[f.k] = v; });
    return o;
  }

  async function openRecord(key, copyFrom) {
    const cfg = TABLES[S.t];
    if (cfg.special === "products") { const p = key ? S.rows.find(r => r.id === key) : null; return openProduct(p || null); }
    const isNew = key == null;
    let row = isNew ? (copyFrom ? { ...copyFrom } : (typeof cfg.defaults === "function" ? cfg.defaults() : { ...(cfg.defaults || {}) })) : S.rows.find(r => String(pkOf(cfg, r)) === String(key));
    if (!row) return;
    if (cfg.view && !isNew) { const { data, error } = await sb.from(S.t).select("*").eq(cfg.pk, key).single(); if (error) return fail(error); row = data; }
    S.edit = { cfg, isNew, key, row };
    S.removed = []; S.dirty = false;
    S.lines = [];
    try { if (cfg.lines) await Promise.all(cfg.lines.cols.filter(c => c.ref).map(c => loadRef(c.ref))); await Promise.all(allFields(cfg).filter(f => f.ref).map(f => loadRef(f.ref))); if (cfg.calc && window.RSCalcUI) await window.RSCalcUI.load(sb); }
    catch (e) { return fail(e); }
    if (cfg.lines) {
      if (copyFrom && copyFrom.__lines) S.lines = copyFrom.__lines.map(l => { const c = { ...l }; delete c.id; delete c[cfg.lines.fk]; return c; });
      else if (!isNew) {
        const { data, error } = await sb.from(cfg.lines.t).select("*").eq(cfg.lines.fk, key).order(cfg.lines.seq);
        if (error) return fail(error);
        S.lines = data.map(l => ({ ...l }));
      }
    }
    const title = isNew ? (copyFrom ? `${cfg.label}: העתק חדש` : `${cfg.label}: חדש`) : (cfg.title ? cfg.title(row) : key);
    $("#dmDlgTitle").textContent = S.quick && isNew ? "מחשבון סבון" : title;
    $("#dmSave").textContent = S.quick && isNew ? "שמירה כמתכון" : "שמירה";
    S.quick = false;
    const auto = !!(cfg.seq || cfg.doc || cfg.newKey);
    const keyNote = !auto ? "" : isNew ? `<p class="hint" style="margin:0">המספר יינתן אוטומטית בשמירה.</p>` : `<p class="dm-key" dir="ltr">${esc(key)}</p>`;
    const secHtml = s => `<fieldset><legend>${esc(s.n)}</legend>${s.hint ? `<p class="hint" style="margin:0">${esc(s.hint)}</p>` : ""}<div class="dm-grid">${s.f.map(f => fieldHtml(f, row[f.k], isNew)).join("")}</div></fieldset>`;
    const linesHtml = cfg.lines ? `<fieldset class="dm-lines"><legend>${esc(cfg.lines.title)}</legend><div id="dmLines"></div><button type="button" class="btn" id="dmAddLine">+ הוספת שורה</button><div class="dm-foot" id="dmFoot"></div></fieldset>` : "";
    const calcHtml = cfg.calc && window.RSCalcUI ? window.RSCalcUI.html() : "";
    const linesAt = cfg.lines && cfg.lines.after != null ? cfg.lines.after : cfg.secs.length - 1;
    $("#dmBody").innerHTML = keyNote + cfg.secs.map((sec, i) => secHtml(sec) + (i === linesAt ? linesHtml : "") + (i === cfg.calcAfter ? calcHtml : "")).join("") +
      (!isNew && cfg.related ? `<fieldset><legend>קשור לרשומה</legend><div class="chips" id="dmRel"><span class="muted">בודק…</span></div></fieldset>` : "") +
      `<div class="dm-actions">${!isNew ? `<button type="button" class="btn" id="dmDup">שכפול</button>` : ""}${!isNew ? `<button type="button" class="btn danger" id="dmDel">מחיקה</button>` : ""}</div>`;
    if (cfg.lines) { renderLines(); updateFoot(); }
    if (cfg.calc && window.RSCalcUI) window.RSCalcUI.open(row, calcApi);
    if (!isNew && cfg.related) loadRelated(cfg, key);
    $("#dmDlg").showModal();
    $("#dmBody").scrollTop = 0;
  }

  /* ---------- lines (recipe ingredients / document rows) ---------- */
  function renderLines() {
    const lc = S.edit.cfg.lines, tmpl = lc.cols.map(c => `${c.w || 1}fr`).join(" ") + " 44px";
    $("#dmLines").innerHTML = (S.lines.length ? `<div class="dm-line dm-lhead" style="grid-template-columns:${tmpl}">${lc.cols.map(c => `<span>${esc(c.l)}</span>`).join("")}<span></span></div>` : `<p class="hint" style="margin:0">אין שורות עדיין.</p>`) +
      S.lines.map((l, i) => `<div class="dm-line" style="grid-template-columns:${tmpl}" data-li="${i}">${lc.cols.map(c => `<label class="dm-lc dm-w${c.w || 1}"><span class="dm-ll">${esc(c.l)}</span>${input(c, l[c.k], `l${i}_`)}</label>`).join("")}<button type="button" class="dm-ldel" data-ldel="${i}" aria-label="מחיקת שורה">✕</button></div>`).join("");
  }
  function updateFoot() { const lc = S.edit.cfg.lines; if (lc && lc.footer) $("#dmFoot").innerHTML = lc.footer(S.lines, formValues()); }
  function readLineInput(el) {
    const m = el.name && el.name.match(/^l(\d+)_(.+)$/); if (!m) return null;
    const i = Number(m[1]), k = m[2], f = S.edit.cfg.lines.cols.find(c => c.k === k);
    const s = String(el.value).trim();
    let v = s === "" ? null : (f.t === "num" || f.t === "money") ? num(s) : f.t === "pct" ? (num(s) == null ? null : round(num(s) / 100, 6)) : s;
    return { i, k, v };
  }
  function syncLineInputs(i) {
    const lc = S.edit.cfg.lines, row = $(`.dm-line[data-li="${i}"]`); if (!row) return;
    lc.cols.forEach(c => {
      const el = row.querySelector(`[name="l${i}_${c.k}"]`); if (!el || el === document.activeElement) return;
      const v = S.lines[i][c.k];
      el.value = v == null ? "" : c.t === "pct" ? round(v * 100, 4) : v;
    });
  }

  $("#dmDlg").addEventListener("input", e => {
    if (!S.edit) return;
    S.dirty = true;
    const el = e.target, lc = S.edit.cfg.lines;
    const li = lc && readLineInput(el);
    if (li) {
      S.lines[li.i][li.k] = li.v;
      if (lc.derive) { lc.derive(S.lines[li.i], li.k, formValues()); syncLineInputs(li.i); }
      updateFoot(); return;
    }
    const m = el.name && el.name.match(/^f_(.+)$/); if (!m) return;
    const k = m[1];
    if (S.t === "materials" && S.edit.isNew && (k === "category" || k === "family")) {
      const f = $("#dmForm"), fam = String(f.elements.f_family.value).trim().toUpperCase(), pre = MAT_PREFIX[f.elements.f_category.value] || "";
      const idEl = f.elements.f_id;
      if (!idEl.dataset.touched && pre && fam) idEl.value = `${pre}-${fam}`;
    }
    if (S.t === "materials" && k === "id") el.dataset.touched = "1";
    if (lc && lc.onForm && lc.onForm(k, S.lines, formValues())) { S.lines.forEach((_, i) => syncLineInputs(i)); updateFoot(); }
  });
  $("#dmDlg").addEventListener("click", async e => {
    if (!S.edit) return;
    if (e.target.closest("#dmAddLine")) {
      const lc = S.edit.cfg.lines; S.lines.push(lc.blank ? lc.blank() : {}); S.dirty = true; renderLines(); updateFoot(); recalcIf();
      const last = $(`.dm-line[data-li="${S.lines.length - 1}"] select, .dm-line[data-li="${S.lines.length - 1}"] input`); if (last) last.focus();
      return;
    }
    const d = e.target.closest("[data-ldel]");
    if (d) { const i = Number(d.dataset.ldel), l = S.lines[i]; if (l.id) S.removed.push(l.id); S.lines.splice(i, 1); S.dirty = true; renderLines(); updateFoot(); recalcIf(); return; }
    if (e.target.closest("#dmBalance")) { balanceOils(); return; }
    const rel = e.target.closest("[data-rel]");
    if (rel) { const j = S.relJumps[Number(rel.dataset.rel)]; $("#dmDlg").close(); S.edit = null; switchTable(j.t, j.jump); return; }
    if (e.target.closest("#dmDup")) return duplicate();
    if (e.target.closest("#dmDel")) return remove();
  });
  $("#dmDlg").addEventListener("input", () => { if (S.edit && S.edit.cfg.calc && window.RSCalcUI) window.RSCalcUI.recalc(); });
  $("#dmCancel").addEventListener("click", () => { if (S.dirty && !confirm("לצאת בלי לשמור את השינויים?")) return; S.edit = null; $("#dmDlg").close(); });
  $("#dmDlg").addEventListener("cancel", e => { if (S.dirty && !confirm("לצאת בלי לשמור את השינויים?")) e.preventDefault(); else S.edit = null; });

  function recalcIf() { if (S.edit && S.edit.cfg.calc && window.RSCalcUI) window.RSCalcUI.recalc(); }
  function balanceOils() {
    const oil = S.lines.filter(l => l.stage === "שמנים וחמאות" && num(l.grams) > 0), sum = oil.reduce((a, l) => a + num(l.grams), 0);
    if (!sum) return;
    oil.forEach(l => { l.pct_of_oils = round(num(l.grams) / sum, 4); });
    $("#dmForm").elements.f_oils_g.value = round(sum, 2);
    S.lines.forEach((_, i) => syncLineInputs(i)); S.dirty = true; updateFoot(); recalcIf();
  }
  /* the calculator UI (calcui.js) reads and writes the open recipe through this */
  const calcApi = {
    lines: () => S.lines, form: () => $("#dmForm"), values: () => formValues(),
    scale(k) {
      const f = $("#dmForm"), o = num(f.elements.f_oils_g.value);
      S.lines.forEach(l => { if (num(l.grams) != null) l.grams = round(num(l.grams) * k, 2); });
      const sum = S.lines.filter(l => l.stage === "שמנים וחמאות").reduce((a, l) => a + (num(l.grams) || 0), 0);
      f.elements.f_oils_g.value = round(sum || (o || 0) * k, 2);
      S.lines.forEach((_, i) => syncLineInputs(i)); updateFoot(); S.dirty = true;
    },
    refs: t => (S.refs[t] || { rows: [] }).rows, esc, toast
  };

  /* ---------- related records ---------- */
  async function loadRelated(cfg, key) {
    S.relJumps = [];
    const parts = await Promise.all(cfg.related.map(async r => {
      try {
        let vals;
        if (r.via) {
          const { data, error } = await sb.from(r.via.t).select(r.via.pick).eq(r.via.fk, key).limit(2000);
          if (error) throw error;
          vals = [...new Set(data.map(x => String(x[r.via.pick])))];
          return { r, n: vals.length, jump: { col: TABLES[r.t].pk, vals } };
        }
        const pk = TABLES[r.t].pk;
        const { data, error } = await sb.from(r.t).select(pk).eq(r.fk, key).limit(2000);
        if (error) throw error;
        return { r, n: data.length, jump: { col: r.fk, vals: [String(key)] } };
      } catch (e) { console.warn("related", e); return { r, n: null }; }
    }));
    if (!S.edit || S.edit.key !== key) return;
    const label = cfg.title ? cfg.title(S.edit.row) : key;
    $("#dmRel").innerHTML = parts.map(p => {
      if (!p.n) return `<span class="chip dm-dim">${esc(p.r.l)}: ${p.n === 0 ? "אין" : "?"}</span>`;
      S.relJumps.push({ t: p.r.t, jump: { ...p.jump, label: `${p.r.l} · ${label}` } });
      return `<button type="button" class="chip" data-rel="${S.relJumps.length - 1}">${esc(p.r.l)}: ${p.n} ←</button>`;
    }).join("");
  }

  /* ---------- keys for new records ---------- */
  async function nextSeq(t, col, prefix) {
    const { data, error } = await sb.from(t).select(col).like(col, `${prefix}-%`).limit(5000);
    if (error) throw error;
    const max = data.reduce((m, r) => { const n = parseInt(String(r[col]).slice(prefix.length + 1), 10); return isFinite(n) && n > m ? n : m; }, 0);
    return `${prefix}-${String(max + 1).padStart(3, "0")}`;
  }
  async function newKey(cfg, row) {
    if (cfg.newKey) return cfg.newKey(row);
    if (cfg.seq) return nextSeq(S.t, cfg.pk, cfg.seq);
    if (cfg.doc) {
      const { data, error } = await sb.rpc("next_doc_number", { p_prefix: cfg.doc(row), p_date: row.doc_date || row.made_on || row.sent_on || today() });
      if (error) throw error; return data;
    }
    return undefined;
  }

  /* ---------- save ---------- */
  function friendly(e) {
    const m = (e && (e.message || "")) + " " + (e && e.details || "");
    if (e && e.code === "23505") return "כבר קיימת רשומה עם הקוד הזה. בחרי קוד אחר.";
    if (e && e.code === "23503") {
      const t = (m.match(/table "([a-z_]+)"/g) || []).map(x => x.match(/"([a-z_]+)"/)[1]).find(x => x !== S.t);
      const LBL = { recipe_lines: "מתכונים", product_materials: "מוצרים", product_details: "מוצרים", supplier_items: "מחירי ספקים", purchase_lines: "מסמכי רכש", sales_lines: "מסמכי מכירה", sales_docs: "מסמכי מכירה", purchase_docs: "מסמכי רכש", batches: "יומן הייצור", shipments: "משלוחים", materials: "חומרים" };
      return `אי אפשר למחוק: הרשומה בשימוש ב${LBL[t] || "טבלה אחרת"}. אפשר לסמן אותה כלא פעילה, או קודם להסיר את השימוש בה.`;
    }
    if (e && e.code === "23514") return "אחד הערכים לא תקין (למשל קוד בפורמט לא נכון או ערך מחוץ לרשימה).";
    return e && e.message ? e.message : String(e);
  }
  $("#dmForm").addEventListener("submit", async e => {
    e.preventDefault();
    const { cfg, isNew, key } = S.edit, btn = $("#dmSave");
    const row = formValues();
    for (const f of allFields(cfg)) if (f.req && (row[f.k] == null || row[f.k] === "")) return toast(`חסר: ${f.l}`);
    if (S.t === "materials") {
      if (!/^[A-Z]{3}$/.test(row.family || "")) return toast("קוד משפחה: 3 אותיות באנגלית");
      if (!/^[A-Z]{2,3}-[A-Z]{3}$/.test(row.id || "")) return toast("קוד החומר צריך להיות כמו OIL-OLV");
    }
    if (cfg.lines) {
      for (const [i, l] of S.lines.entries()) for (const c of cfg.lines.cols) if (c.req && (l[c.k] == null || l[c.k] === "")) return toast(`שורה ${i + 1}: חסר ${c.l}`);
      if (cfg.lines.t !== "recipe_lines") for (const [i, l] of S.lines.entries()) if (!(num(l.qty) > 0)) return toast(`שורה ${i + 1}: הכמות צריכה להיות גדולה מ-0`);
    }
    if (cfg.beforeSave) cfg.beforeSave(row);
    btn.disabled = true;
    try {
      let k = key;
      if (isNew) {
        const nk = await newKey(cfg, row);
        if (nk !== undefined) row[cfg.pk] = nk;
        const { data, error } = await sb.from(S.t).insert(row).select(cfg.pk).single();
        if (error) throw error;
        k = data[cfg.pk];
      } else {
        delete row[cfg.pk];
        const { error } = await sb.from(S.t).update(row).eq(cfg.pk, key);
        if (error) throw error;
      }
      if (cfg.lines) await saveLines(cfg.lines, k);
      S.dirty = false; S.edit = null;
      $("#dmDlg").close();
      toast(isNew ? `נשמר ✓ ${cfg.pk !== "id" || cfg.seq || cfg.doc || cfg.newKey ? "(" + k + ")" : ""}` : "נשמר ✓");
      if (REF[S.t]) S.refs[S.t] = null;
      if (onChange) onChange(S.t);
      loadTable();
    } catch (err) { toast("שגיאה: " + friendly(err), 6000); console.error(err); }
    btn.disabled = false;
  });
  async function saveLines(lc, parentKey) {
    if (S.removed.length) { const { error } = await sb.from(lc.t).delete().in("id", S.removed); if (error) throw error; }
    const rows = S.lines.map((l, i) => {
      const r = { [lc.fk]: parentKey, [lc.seq]: i + 1 };
      lc.cols.forEach(c => { r[c.k] = l[c.k] ?? null; });
      if (l.id) r.id = l.id;
      return r;
    });
    const upd = rows.filter(r => r.id), ins = rows.filter(r => !r.id);
    if (upd.length) { const { error } = await sb.from(lc.t).upsert(upd); if (error) throw error; }
    if (ins.length) { const { error } = await sb.from(lc.t).insert(ins); if (error) throw error; }
  }

  /* ---------- duplicate / delete ---------- */
  function duplicate() {
    const { cfg, row } = S.edit;
    const copy = { ...row, ...formValues() };
    delete copy[cfg.pk]; delete copy.created_at; delete copy.updated_at;
    if (S.t === "materials") { copy.id = ""; copy.family = ""; }
    ["name", "name_he", "product_name"].forEach(k => { if (copy[k]) copy[k] += " (העתק)"; });
    if (cfg.lines) copy.__lines = S.lines.map(l => ({ ...l }));
    $("#dmDlg").close(); S.edit = null;
    openRecord(null, copy);
  }
  async function remove() {
    const { cfg, key, row } = S.edit;
    const name = cfg.title ? cfg.title(row) : key;
    if (!confirm(`למחוק לצמיתות את "${name}"?${cfg.lines ? " גם השורות שלו יימחקו." : ""} אי אפשר לבטל.`)) return;
    const { error } = await sb.from(S.t).delete().eq(cfg.pk, key);
    if (error) return toast(friendly(error), 7000);
    S.dirty = false; S.edit = null; $("#dmDlg").close(); toast("נמחק");
    if (REF[S.t]) S.refs[S.t] = null;
    if (onChange) onChange(S.t);
    loadTable();
  }

  /* ---------------- public ---------------- */
  return {
    show() { if (!S.loaded[S.t]) loadTable(); else render(); },
    quickCalc() { if (S.t !== "recipes") switchTable("recipes"); else if (!S.loaded.recipes) loadTable(); S.t = "recipes"; S.quick = true; openRecord(null); },
    refresh(t) { if (t) S.refs[t] = null; if (S.loaded[S.t] && (!t || t === S.t || TABLES[S.t].special === t)) loadTable(); },
    tables: TABLES
  };
};
