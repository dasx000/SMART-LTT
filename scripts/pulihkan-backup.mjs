#!/usr/bin/env node
/**
 * Pulihkan backup SMART LTT (.json.gz dari menu Backup Data) ke project Supabase di .env.local.
 *
 *   node scripts/pulihkan-backup.mjs <file.json.gz>              → SIMULASI: bandingkan isi file vs database, tanpa menulis
 *   node scripts/pulihkan-backup.mjs <file.json.gz> --jalankan   → tulis (upsert: tambah/timpa per kunci, TIDAK menghapus)
 *   ... --tabel ltt.laporan_ltt,ltt.target_desa                  → hanya tabel tertentu
 *
 * Catatan:
 * - Memakai SUPABASE_SERVICE_ROLE_KEY (melewati RLS). Jalankan hanya dari laptop admin.
 * - Password tidak ada di backup. Pada pemulihan TOTAL (project baru), akun login (auth.users) harus dibuat
 *   dulu dengan ID yang sama, atau baris core.profiles/ltt.anggota akan ditolak (foreign key) — skrip melaporkannya.
 * - Upsert memicu trigger log_perubahan (jejak "diubah" bertambah). Ini wajar.
 * - Urutan tabel = lib/backup.ts (TABEL_BACKUP). Ubah keduanya bersamaan.
 */
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

const KUNCI = {
  "ltt.kecamatan": "id",
  "ltt.desa": "id",
  "ltt.jenis_ltt": "id",
  "core.profiles": "id",
  "core.memberships": "user_id,app_slug",
  "ltt.anggota": "user_id",
  "ltt.anggota_desa": "user_id,desa_id",
  "ltt.laporan_ltt": "id",
  "ltt.target_desa": "id",
  "ltt.target_desa_rincian": "target_desa_id,jenis_ltt_id",
  "ltt.target_kecamatan": "id",
  "ltt.target_provinsi": "tahun,bulan,kecamatan_id,komoditas",
  "ltt.target_pm_aas": "tahun,bulan",
  "ltt.target_pm_aas_kecamatan": "tahun,bulan,kecamatan_id",
  "ltt.produktivitas_desa": "tahun,bulan,desa_id,komoditas",
  "ltt.sarana_desa": "desa_id",
  "ltt.logs_sinkron": "id",
  "ltt.log_perubahan": "id",
};
const PER_KIRIM = 500;

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const jalankan = args.includes("--jalankan");
const iTabel = args.indexOf("--tabel");
const hanya = iTabel >= 0 ? new Set((args[iTabel + 1] ?? "").split(",").filter(Boolean)) : null;
if (!file) {
  console.error("Pakai: node scripts/pulihkan-backup.mjs <file.json.gz> [--jalankan] [--tabel a,b]");
  process.exit(1);
}

// .env.local
const envPath = path.join(process.cwd(), ".env.local");
const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !KEY) { console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum ada di .env.local"); process.exit(1); }

const isi = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
if (isi.versi !== 1 || typeof isi.tabel !== "object") { console.error("File bukan backup SMART LTT versi 1."); process.exit(1); }

console.log(`Backup dibuat ${isi.dibuat} oleh ${isi.oleh}`);
console.log(`Tujuan: ${new URL(URL_SB).host}`);
console.log(jalankan ? "MODE: JALANKAN (menulis ke database)\n" : "MODE: SIMULASI (tidak menulis). Tambah --jalankan untuk memulihkan.\n");
if (isi.dilewati?.length) console.log(`Tabel yang tidak ada saat backup: ${isi.dilewati.join(", ")}\n`);

const kepala = (skema, extra = {}) => ({ apikey: KEY, Authorization: `Bearer ${KEY}`, "Accept-Profile": skema, "Content-Profile": skema, ...extra });

async function hitungDb(skema, tabel) {
  let q = `${URL_SB}/rest/v1/${tabel}?select=*`;
  if (skema === "core" && tabel === "memberships") q += "&app_slug=eq.ltt";
  const r = await fetch(q, { method: "HEAD", headers: kepala(skema, { Prefer: "count=exact", Range: "0-0" }) });
  if (!r.ok) return null;
  return Number((r.headers.get("content-range") ?? "*/0").split("/")[1]);
}

let gagalTotal = 0;
for (const [nama, kunci] of Object.entries(KUNCI)) {
  if (hanya && !hanya.has(nama)) continue;
  const baris = isi.tabel[nama];
  if (!Array.isArray(baris)) { console.log(`${nama.padEnd(26)} (tidak ada di file)`); continue; }
  const [skema, tabel] = nama.split(".");
  const diDb = await hitungDb(skema, tabel);
  const ket = diDb === null ? "tabel tidak ada di database!" : `di database ${diDb}`;
  if (!jalankan) { console.log(`${nama.padEnd(26)} file ${String(baris.length).padStart(6)} | ${ket}`); continue; }

  let ok = 0, gagal = 0;
  for (let i = 0; i < baris.length; i += PER_KIRIM) {
    const potong = baris.slice(i, i + PER_KIRIM);
    const r = await fetch(`${URL_SB}/rest/v1/${tabel}?on_conflict=${kunci}`, {
      method: "POST",
      headers: kepala(skema, { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(potong),
    });
    if (r.ok) ok += potong.length;
    else { gagal += potong.length; console.log(`  ! ${nama} baris ${i + 1}-${i + potong.length}: ${(await r.text()).slice(0, 200)}`); }
  }
  gagalTotal += gagal;
  console.log(`${nama.padEnd(26)} dipulihkan ${ok}${gagal ? `, GAGAL ${gagal}` : ""}`);
}

if (jalankan) {
  const r = await fetch(`${URL_SB}/rest/v1/rpc/setel_ulang_sequence`, { method: "POST", headers: kepala("ltt", { "Content-Type": "application/json" }), body: "{}" });
  console.log(r.ok ? "\nSequence ID disetel ulang." : `\n! Gagal setel ulang sequence: ${(await r.text()).slice(0, 200)}`);
  console.log(gagalTotal ? `\nSelesai dengan ${gagalTotal} baris gagal (lihat pesan di atas).` : "\nSelesai tanpa kesalahan.");
}
