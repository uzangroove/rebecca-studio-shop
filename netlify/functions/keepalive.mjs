// Daily ping so the free Supabase project never pauses for inactivity
// (free projects pause after ~7 days without requests).
// 06:15 UTC = 09:15 Israel time in summer (08:15 in winter).
import { sb } from "../lib/supabase.mjs";

export default async () => {
  const rows = await sb()("settings?select=id&id=eq.1");
  console.log("keepalive ok", rows.length);
};

export const config = { schedule: "15 6 * * *" };
