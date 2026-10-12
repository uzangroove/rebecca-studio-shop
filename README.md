# Rébecca Studio — website

Handmade soap & candle studio, Karmiel. Bilingual (Hebrew / English) storefront with WhatsApp ordering.

## Structure
| Path | What |
|---|---|
| `public/index.html` | Public site: products, cart → WhatsApp, workshops + signup, about |
| `public/catalog/` | Shareable / printable catalog (print → Save as PDF), `?cat=soap&prices=0&lang=en` |
| `public/admin/` | Rebecca's admin (phone-first, side rail on desktop): products, images, workshops, signups, data tables, soap calculator, settings, share tools |
| `public/admin/data.js` | "מאגרים": generic list/search/add/edit/delete for every back-office table (config in `TABLES`) |
| `public/admin/soapcalc.js` | Soap calculator engine (pure functions, also loadable in Node) |
| `public/admin/calcui.js` | Calculator panel in the recipe editor: live results, fit to mold, cost, printable work sheet |
| `tests/` | `node --test tests/*.test.mjs` — calculator engine tests |
| `public/legal/` | Accessibility statement, privacy, terms |
| `netlify/functions/product-share.mjs` | `/p/:slug` — product link with WhatsApp/Facebook preview |
| `netlify/functions/product-feed.mjs` | `/feed.csv` — Meta (Facebook/Instagram/WhatsApp) catalog feed |
| `netlify/functions/keepalive.mjs` | Daily ping so the free Supabase project never pauses |

## Backend
Supabase project `rebecca-studio` (ref `nvtpngjecdzerbbzqmtg`, eu-central-1).
Tables: `products`, `workshops`, `workshop_signups`, `settings` (single row JSON), `admins`, plus the back office:
`materials`, `recipes` + `recipe_lines`, `molds_tools`, `batches`, `suppliers`, `supplier_items`, `purchase_docs` + `purchase_lines`,
`customers`, `sales_docs` + `sales_lines`, `shipments`, `product_details`, `product_materials`.

## Soap calculator
Lye = Σ(oil grams × `materials.sap_koh` / 1403) × (1 − superfat) ÷ purity (KOH: / 1000).
With purity 100% this reproduces Soapmaking Friend for all 71 imported recipes (to 0.01 g; one recipe entered in ounces is 0.12 g off),
so imported recipes are stored with `lye_purity = 1`. Qualities use the SoapCalc fatty-acid method.
`materials.soap_data` is `מאומת` (checked against those recipes) or `ספרותי` (published value — the calculator shows a check-before-use note).
Storage bucket `media` (public read, admin write). All writes are protected by RLS via `public.is_admin()`.
To add an admin: create the user in Supabase Auth, then `insert into admins(email) values ('…');`

## Deploy
Netlify site `rebecca-studio`, linked to this repo (branch `main`, publish dir `public`).
Env vars on Netlify: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public anon key).
Content changes made in the admin are live instantly — no redeploy needed.
