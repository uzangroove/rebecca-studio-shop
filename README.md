# Rébecca Studio — website

Handmade soap & candle studio, Karmiel. Bilingual (Hebrew / English) storefront with WhatsApp ordering.

## Structure
| Path | What |
|---|---|
| `public/index.html` | Public site: products, cart → WhatsApp, workshops + signup, about |
| `public/catalog/` | Shareable / printable catalog (print → Save as PDF), `?cat=soap&prices=0&lang=en` |
| `public/admin/` | Rebecca's admin (phone-first): products, images, workshops, signups, settings, share tools |
| `public/legal/` | Accessibility statement, privacy, terms |
| `netlify/functions/product-share.mjs` | `/p/:slug` — product link with WhatsApp/Facebook preview |
| `netlify/functions/product-feed.mjs` | `/feed.csv` — Meta (Facebook/Instagram/WhatsApp) catalog feed |
| `netlify/functions/keepalive.mjs` | Daily ping so the free Supabase project never pauses |

## Backend
Supabase project `rebecca-studio` (ref `nvtpngjecdzerbbzqmtg`, eu-central-1).
Tables: `products`, `workshops`, `workshop_signups`, `settings` (single row JSON), `admins`.
Storage bucket `media` (public read, admin write). All writes are protected by RLS via `public.is_admin()`.
To add an admin: create the user in Supabase Auth, then `insert into admins(email) values ('…');`

## Deploy
Netlify site `rebecca-studio`, linked to this repo (branch `main`, publish dir `public`).
Env vars on Netlify: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public anon key).
Content changes made in the admin are live instantly — no redeploy needed.
