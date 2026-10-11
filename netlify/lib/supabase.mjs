// Shared helper for Netlify functions: read-only access with the public anon key.
// Netlify env vars (SUPABASE_URL, SUPABASE_ANON_KEY) override the defaults below.
// The defaults are the PUBLIC anon key (same one shipped in public/assets/js/config.js);
// every write is protected by Row Level Security, so it is safe in code.
const DEFAULT_URL = "https://nvtpngjecdzerbbzqmtg.supabase.co";
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dHBuZ2plY2R6ZXJiYnpxbXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2ODI4NTEsImV4cCI6MjEwNzI1ODg1MX0.cPS2zkz32GzEsp-a_JTd4rpK8V6S34dKmvY2e_tF-5E";
export function sb() {
  const url = Netlify.env.get("SUPABASE_URL") || DEFAULT_URL;
  const key = Netlify.env.get("SUPABASE_ANON_KEY") || DEFAULT_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_ANON_KEY env vars");
  return async (path) => {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    return res.json();
  };
}
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const abs = (origin, src) => (!src ? `${origin}/images/brand/og-cover.jpg` : /^https?:\/\//.test(src) ? src : `${origin}${src.startsWith("/") ? "" : "/"}${src}`);
