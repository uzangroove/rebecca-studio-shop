// /feed.csv — product catalog feed for Meta Commerce Manager (Facebook & Instagram Shop)
// and WhatsApp Business catalog. Only published products that have a price are included.
import { sb, abs } from "../lib/supabase.mjs";

const csv = (v) => {
  const s = String(v ?? "").replace(/\r?\n/g, " ").trim();
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default async (req) => {
  const origin = new URL(req.url).origin;
  const rows = await sb()("products?select=id,slug,category,name_he,name_en,short_he,desc_he,price,images,sold_out&published=eq.true&price=not.is.null&order=category,sort_order");
  const head = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "additional_image_link", "brand", "product_type"];
  const catHe = { soap: "סבונים", candle: "נרות", bundle: "מארזים", other: "אחר" };
  const lines = rows.map((p) => [
    p.slug,
    p.name_he,
    p.desc_he || p.short_he || p.name_he,
    p.sold_out ? "out of stock" : "in stock",
    "new",
    `${Number(p.price).toFixed(2)} ILS`,
    `${origin}/p/${p.slug}`,
    abs(origin, p.images && p.images[0]),
    (p.images || []).slice(1).map((i) => abs(origin, i)).join(","),
    "Rébecca Studio",
    catHe[p.category] || p.category
  ].map(csv).join(","));
  return new Response([head.join(","), ...lines].join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "public, max-age=900" }
  });
};

export const config = { path: "/feed.csv" };
