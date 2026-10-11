// /p/:slug — share link for a single product.
// Returns a tiny HTML page with Open Graph tags (so WhatsApp / Facebook show the
// product photo, name and price) and immediately forwards people to the product on the site.
import { sb, esc, abs } from "../lib/supabase.mjs";

export default async (req, context) => {
  const url = new URL(req.url);
  const origin = url.origin;
  const slug = String(context.params.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const lang = url.searchParams.get("lang") === "en" ? "en" : "he";
  const target = `${origin}/?p=${encodeURIComponent(slug)}${lang === "en" ? "&lang=en" : ""}`;

  let p = null;
  try {
    const rows = await sb()(`products?select=slug,name_he,name_en,short_he,short_en,price,images,sold_out&published=eq.true&slug=eq.${encodeURIComponent(slug)}&limit=1`);
    p = rows[0] || null;
  } catch (e) {
    console.error(e);
  }
  if (!p) return Response.redirect(`${origin}/`, 302);

  const name = (lang === "en" && p.name_en) || p.name_he;
  const short = (lang === "en" && p.short_en) || p.short_he || "";
  const priceTxt = p.price != null ? ` · ₪${Number(p.price)}` : "";
  const title = `${name}${priceTxt} | Rébecca Studio`;
  const desc = short || (lang === "en" ? "Handmade natural soap & candles from Karmiel" : "סבונים ונרות בעבודת יד מכרמיאל");
  const img = abs(origin, p.images && p.images[0]);

  const html = `<!doctype html><html lang="${lang}" dir="${lang === "he" ? "rtl" : "ltr"}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Rébecca Studio">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:url" content="${esc(url.href)}">
${p.price != null ? `<meta property="product:price:amount" content="${Number(p.price)}"><meta property="product:price:currency" content="ILS">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(target)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body style="font-family:sans-serif;text-align:center;padding:40px">
<p><a href="${esc(target)}">${esc(name)}</a></p>
<script>location.replace(${JSON.stringify(target)})</script>
</body></html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" }
  });
};

export const config = { path: "/p/:slug" };
