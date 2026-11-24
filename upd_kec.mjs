import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: "ltt" }, auth: { persistSession: false } });
// argv[2] = JSON [[desa_id, nama, lama, baru], ...] — Padi November 2026, hanya kolom luas_baku, guard nilai lama
const rencana = JSON.parse(process.argv[2]);
let ok = 0;
for (const [id, nama, lama, baru] of rencana) {
  const { data, error } = await a.from("target_desa").update({ luas_baku: baru })
    .eq("tahun", 2026).eq("bulan", 11).eq("komoditas", "Padi").eq("desa_id", id).eq("luas_baku", lama).select("luas_baku");
  if (error) { console.log("GAGAL", nama, error.message); continue; }
  if (!data.length) { console.log("DILEWATI (nilai sudah berubah)", nama); continue; }
  ok++; console.log("OK", nama, lama, "→", Number(data[0].luas_baku));
}
console.log(`Selesai: ${ok}/${rencana.length} diperbarui`);
