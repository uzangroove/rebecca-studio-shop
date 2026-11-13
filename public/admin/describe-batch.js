/* Rébecca Studio — "תיאור מוצע" for many items at once, before printing the fill-in forms.
   For every product without a description, and every new studio image, it runs the same two steps as the
   product editor (photo analysis, then a description) through the photo studio's /api/suggest.
   The result is only a suggestion: products get product_details.desc_suggestion, images get
   media_inbox.meta.desc_suggestion. Nothing is published and nothing already written is overwritten.
   describeContext() and the pick helpers are pure (tested in node). */
(function (root) {
  const CAT = { soap: "סבון", candle: "נר", bundle: "מארז", other: "אחר" };

  /** The text the description is written from: only what is known — no invented scents or ingredients. */
  function describeContext({ category, name, short, technique, analysis }) {
    const a = analysis || {};
    return [
      category ? "סוג המוצר: " + (CAT[category] || category) : (a.type ? "סוג המוצר: " + a.type : ""),
      name ? "שם: " + name : "",
      short ? "תיאור קצר קיים: " + short : "",
      "ריח: לא נבחר ריח",
      technique ? "טכניקה / עיצוב (במילים של רבקה): " + technique : "",
      "מה רואים בתמונה: צבעים " + (a.colors || []).join(", ") + "; צורה " + (a.shape || "") + "; טכניקה " + (a.technique || "") + "; " + (a.notes || "")
    ].filter(Boolean).join("\n").slice(0, 3000);
  }

  /** Products that still need a suggestion: no description on the site, no suggestion yet, and a photo. */
  function productsToDo(products, details) {
    return (products || []).filter(p => {
      const d = (details || {})[p.id] || {};
      return !(p.desc_he || "").trim() && !(d.desc_suggestion || "").trim() && p.images && p.images[0];
    });
  }
  /** New studio images without a suggestion yet. */
  function imagesToDo(images) {
    return (images || []).filter(m => m.status === "new" && !(m.meta && m.meta.desc_suggestion));
  }

  function RSDescribeBatch(sb, { settings, abs }) {
    const base = () => String((settings().photo_studio_url || "")).trim().replace(/\/+$/, "");
    async function call(task, extra) {
      const url = base();
      if (!url) throw new Error("כדי להכין תיאורים, צריך להדביק בהגדרות את כתובת סטודיו התמונות.");
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("צריך להתחבר מחדש.");
      for (let attempt = 0; ; attempt++) {
        let res;
        try {
          res = await fetch(url + "/api/suggest", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ task, ...extra }) });
        } catch (e) { throw new Error("אין חיבור לסטודיו התמונות."); }
        let data = {};
        try { data = await res.json(); } catch (e) {}
        if (res.ok) return data;
        // "יש כבר כמה בקשות בתהליך" — מחכים רגע ומנסים שוב, עד 4 פעמים
        if (res.status === 429 && !data.code && attempt < 4) { await new Promise(r => setTimeout(r, 2500 * (attempt + 1))); continue; }
        const err = new Error(data.error || "ההצעה לא התקבלה."); err.stop = res.status === 429 || res.status === 503 || res.status === 401 || res.status === 403; throw err;
      }
    }
    async function suggestFor({ image, category, name, short, technique, analysis }) {
      const a = analysis || await call("analyze", { image: abs(image), context: "" });
      const d = await call("describe", { context: describeContext({ category, name, short, technique, analysis: a }), name: name || "" });
      return { analysis: a, text: String(d.he || "").trim() };
    }

    async function doProduct(p, d) {
      const r = await suggestFor({ image: p.images[0], category: p.category, name: p.name_he, short: p.short_he, technique: d && d.technique, analysis: d && d.photo_analysis });
      if (!r.text) return false;
      const patch = { desc_suggestion: r.text };
      if (!(d && d.photo_analysis)) patch.photo_analysis = r.analysis;
      const q = d ? sb.from("product_details").update(patch).eq("product_id", p.id) : sb.from("product_details").insert({ product_id: p.id, ...patch });
      const { error } = await q; if (error) throw error;
      return true;
    }
    async function doImage(m) {
      const meta = m.meta || {};
      const r = await suggestFor({ image: m.url, technique: meta.technique, analysis: meta.photo_analysis });
      if (!r.text) return false;
      const next = { ...meta, photo_analysis: r.analysis, desc_suggestion: r.text };
      const { error } = await sb.from("media_inbox").update({ meta: next }).eq("id", m.id);
      if (error) throw error;
      m.meta = next;
      return true;
    }

    /** Runs over everything still missing. onProgress({done, total, failed}); two at a time. */
    async function run({ products, details, images, onProgress, isCancelled }) {
      const jobs = [
        ...productsToDo(products, details).map(p => () => doProduct(p, details[p.id])),
        ...imagesToDo(images).map(m => () => doImage(m))
      ];
      const st = { done: 0, total: jobs.length, failed: 0, stopped: null };
      onProgress && onProgress(st);
      let next = 0;
      async function worker() {
        while (next < jobs.length && !st.stopped && !(isCancelled && isCancelled())) {
          const job = jobs[next++];
          try { if (!(await job())) st.failed++; }
          catch (e) { st.failed++; if (e.stop) st.stopped = e.message; else console.warn("describe", e); }
          st.done++; onProgress && onProgress(st);
        }
      }
      await Promise.all([worker(), worker()]);
      return st;
    }
    return { run };
  }

  const api = { describeContext, productsToDo, imagesToDo, RSDescribeBatch };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.RSDescribeBatch = RSDescribeBatch;
})(typeof window !== "undefined" ? window : globalThis);
