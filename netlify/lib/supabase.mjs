// Shared helper for Netlify functions: read-only access with the public anon key.
// Values come from Netlify environment variables (SUPABASE_URL, SUPABASE_ANON_KEY).
export function sb() {
  const url = Netlify.env.get("SUPABASE_URL");
  const key = Netlify.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_ANON_KEY env vars");
  return async (path) => {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    return res.json();
  };
}
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const abs = (origin, src) => (!src ? `${origin}/images/brand/og-cover.jpg` : /^https?:\/\//.test(src) ? src : `${origin}${src.startsWith("/") ? "" : "/"}${src}`);
