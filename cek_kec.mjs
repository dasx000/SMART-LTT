import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: "ltt" }, auth: { persistSession: false } });
const KEC = process.argv[2];
const gambar = JSON.parse(process.argv[3]);
const { data: kec } = await a.from("kecamatan").select("id, nama").ilike("nama", KEC);
const { data: desa } = await a.from("desa").select("id, nama").eq("kecamatan_id", kec[0].id).order("nama");
const { data: t } = await a.from("target_desa").select("desa_id, luas_baku, target_tanam").eq("tahun", 2026).eq("bulan", 11).eq("komoditas", "Padi").in("desa_id", desa.map((d) => d.id));
const tm = new Map(t.map((x) => [x.desa_id, x]));
const norm = (s) => s.toUpperCase().replace(/[^A-Z]/g, "");
const gN = new Map(Object.entries(gambar).map(([k, v]) => [norm(k), [k, v]]));
const pakai = new Set();
console.log(`Desa ${kec[0].nama} di database:`, desa.length, "· di gambar:", Object.keys(gambar).length);
for (const d of desa) {
  const x = tm.get(d.id); const g = gN.get(norm(d.nama)); if (g) pakai.add(g[0]);
  const lama = x ? Number(x.luas_baku) : null;
  const tanda = !g ? "??" : lama === g[1] ? "sama" : "UBAH";
  console.log([d.id, d.nama, "LBS DB=" + (lama ?? "(tak ada baris)"), "target=" + (x ? Number(x.target_tanam) : "-"), "gambar=" + (g ? g[1] : "??"), tanda].join(" | "));
}
console.log("Nama di gambar tidak cocok:", Object.keys(gambar).filter((k) => !pakai.has(k)).join(", ") || "-");
