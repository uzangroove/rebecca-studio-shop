/* Rébecca Studio — smart suggestions in the product editor: photo analysis, 5 names, description + hashtags.
   Calls the photo studio's server (/api/suggest), which checks the admin sign-in and talks to OpenAI. */
window.RSSuggest = function (sb, { $, esc, toast, images, settings, studio, abs }) {
  const S = { names: [], shown: [], chosen: -1, desc: null };
  const base = () => String((settings().photo_studio_url || "")).trim().replace(/\/+$/, "");

  function setStatus(t, err) { const el = $("#sgStatus"); el.textContent = t || ""; el.classList.toggle("err", !!err); }
  function busy(on) { ["#sgAnalyze", "#sgNames", "#sgMore", "#sgDesc"].forEach(s => { const b = $(s); if (b) b.disabled = on || (s === "#sgAnalyze" && !images().length); }); }

  async function call(task, extra) {
    const url = base();
    if (!url) throw new Error("כדי להפעיל את ההצעות, צריך להדביק בהגדרות את כתובת סטודיו התמונות.");
    if (studio && !studio.ready()) throw new Error("מאגר החומרים עוד נטען. נסו שוב בעוד רגע.");
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error("צריך להתחבר מחדש.");
    let res;
    try {
      res = await fetch(url + "/api/suggest", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ task, ...extra }) });
    } catch (e) { throw new Error("אין חיבור לסטודיו התמונות. בדקו את הכתובת בהגדרות."); }
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error(data.error || "ההצעה לא התקבלה. נסו שוב.");
    return data;
  }
  const ctx = () => studio ? studio.context() : "";
  const form = () => $("#prodForm");

  /* ---------- analyze ---------- */
  $("#sgAnalyze").onclick = async () => {
    const img = images()[0]; if (!img) return;
    busy(true); setStatus("מנתח את התמונה…");
    try {
      const a = await call("analyze", { image: abs(img), materials: studio.visibleMaterials(), context: "" });
      studio.setExtra({ photo_analysis: a });
      const added = studio.addMaterials(a.material_ids);
      const box = $("#sgAnalysis"); box.hidden = false;
      box.innerHTML = [["סוג", a.type], ["צבעים", (a.colors || []).join(", ")], ["צורה", a.shape], ["טכניקה", a.technique], ["הערה", a.notes]]
        .filter(([, v]) => v).map(([k, v]) => `<div><b>${esc(k)}:</b> ${esc(v)}</div>`).join("");
      setStatus(added === 1 ? "נוסף רכיב אחד שנראה בתמונה לפרטי הייצור. כדאי לעבור ולתקן." : added ? `נוספו ${added} רכיבים שנראים בתמונה לפרטי הייצור. כדאי לעבור ולתקן.` : "הניתוח נשמר ויעזור לשמות ולתיאור.");
    } catch (e) { setStatus(e.message, true); }
    busy(false);
  };

  /* ---------- names ---------- */
  async function names(more) {
    busy(true); setStatus("חושב על שמות…");
    if (!more) S.shown = [];
    try {
      const d = await call("names", { context: ctx(), avoid: S.shown });
      S.names = d.names || []; S.chosen = -1; S.shown.push(...S.names.map(n => n.name));
      renderNames(); $("#sgMore").hidden = false;
      setStatus("בוחרים שם בהקשה. אפשר לערוך אותו בשדה \"שם המוצר\".");
    } catch (e) { setStatus(e.message, true); }
    busy(false);
  }
  function renderNames() {
    $("#sgNamesBox").innerHTML = S.names.map((n, i) => `<button type="button" class="sg-name ${S.chosen === i ? "on" : ""}" data-sgname="${i}">
      <small class="sg-style">${esc(n.style)}</small><b>${esc(n.name)}</b>
      <small>${n.short ? "קצר: " + esc(n.short) : ""}${n.en ? " · " + esc(n.en) : ""}</small><small class="muted">${esc(n.why)}</small></button>`).join("");
  }
  $("#sgNamesBox").addEventListener("click", e => {
    const b = e.target.closest("[data-sgname]"); if (!b) return;
    const n = S.names[Number(b.dataset.sgname)]; S.chosen = Number(b.dataset.sgname);
    const f = form(); f.name_he.value = n.name || ""; if (n.en) f.name_en.value = n.en;
    if (studio && n.short) studio.setExtra({ name_short: n.short });
    renderNames(); toast("השם הוכנס לטופס");
  });
  $("#sgNames").onclick = () => names(false);
  $("#sgMore").onclick = () => names(true);

  /* ---------- description ---------- */
  $("#sgDesc").onclick = async () => {
    busy(true); setStatus("מנסח תיאור ותגיות…");
    try {
      const f = form();
      const d = await call("describe", { context: ctx(), name: f.name_he.value.trim() });
      S.desc = d;
      if (d.short) f.short_he.value = d.short;
      if (d.he) f.desc_he.value = d.he;
      if (d.en) f.desc_en.value = d.en;
      if (studio) studio.setExtra({ seo_keywords: d.seo || [], hashtags: d.hashtags || [], meta_description: d.meta || null });
      renderTags(d);
      setStatus("התיאור נכנס לטופס (קצר, מלא ובאנגלית). אפשר לערוך כל שדה לפני השמירה.");
    } catch (e) { setStatus(e.message, true); }
    busy(false);
  };
  function renderTags(d) {
    const box = $("#sgTags");
    const seo = d.seo || d.seo_keywords || [], tags = d.hashtags || [], meta = d.meta || d.meta_description || "";
    box.hidden = !(seo.length || tags.length || meta);
    box.innerHTML = (meta ? `<div><b>תיאור לגוגל:</b> ${esc(meta)}</div>` : "") +
      (seo.length ? `<div><b>מילות חיפוש:</b> <span class="sg-chips">${seo.map(s => `<span>${esc(s)}</span>`).join("")}</span></div>` : "") +
      (tags.length ? `<div><b>האשטגים:</b> <span class="sg-chips" dir="auto">${tags.map(s => `<span>${esc(s)}</span>`).join("")}</span></div>
        <button type="button" class="chip" id="sgCopyTags">העתקת ההאשטגים</button>` : "");
    const c = $("#sgCopyTags");
    if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(tags.join(" ")); toast("ההאשטגים הועתקו"); } catch (e) { prompt("", tags.join(" ")); } };
  }

  /* ---------- reset per product ---------- */
  function reset() {
    S.names = []; S.shown = []; S.chosen = -1; S.desc = null;
    $("#sgNamesBox").innerHTML = ""; $("#sgMore").hidden = true; $("#sgAnalysis").hidden = true; $("#sgAnalysis").innerHTML = "";
    setStatus(base() ? "" : "כדי להפעיל את ההצעות, צריך להדביק בהגדרות את כתובת סטודיו התמונות.", !base());
    $("#sgTags").hidden = true; $("#sgTags").innerHTML = "";
    busy(false);
  }
  // after the production details load: show what was saved before (search words, hashtags, photo analysis)
  function loaded() {
    const x = studio && studio.getExtra(); if (!x) return;
    if ((x.hashtags && x.hashtags.length) || (x.seo_keywords && x.seo_keywords.length) || x.meta_description) renderTags(x);
    const a = x.photo_analysis;
    if (a) { const box = $("#sgAnalysis"); box.hidden = false; box.innerHTML = [["סוג", a.type], ["צבעים", (a.colors || []).join(", ")], ["צורה", a.shape], ["טכניקה", a.technique], ["הערה", a.notes]].filter(([, v]) => v).map(([k, v]) => `<div><b>${esc(k)}:</b> ${esc(v)}</div>`).join(""); }
  }
  return { reset, loaded, refreshButtons: () => busy(false) };
};
