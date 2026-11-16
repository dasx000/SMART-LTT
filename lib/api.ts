import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseSiap } from "@/lib/env";

/**
 * API v1 untuk aplikasi luar (bot DASBOT, dll.).
 * Header: Authorization: Bearer sltt_xxxxxxxx…   (kunci dibuat di menu Akses API, Admin Kab)
 * Semua balasan JSON: { status: "success", ... } atau { status: "error", pesan }.
 */

export const IZIN = {
  "pengguna:baca": "Baca data pengguna (PPL, BPP, Admin) beserta desa binaan & nomor WA",
  "wilayah:baca": "Baca data kecamatan & desa",
  "laporan:baca": "Baca laporan LTT (padi, jagung, ubi kayu)",
  "laporan:tulis": "Kirim laporan LTT Jagung & Ubi Kayu atas nama PPL",
  "epusluh:tulis": "Kirim data padi hasil tarikan e-Pusluh (bot sinkron)",
} as const;
export type Izin = keyof typeof IZIN;
export const DAFTAR_IZIN = Object.keys(IZIN) as Izin[];

const AWALAN_KUNCI = "sltt_";

export const hashKunci = (kunci: string) => createHash("sha256").update(kunci).digest("hex");

/** Kunci baru: "sltt_" + 32 byte acak (base64url). Hanya hash-nya yang disimpan. */
export function buatKunci() {
  const kunci = AWALAN_KUNCI + randomBytes(32).toString("base64url");
  return { kunci, hash: hashKunci(kunci), awalan: kunci.slice(0, 12) };
}

export type Klien = { id: string; nama: string; izin: Izin[] };

export function galat(status: number, pesan: string, tambahan: Record<string, unknown> = {}) {
  return NextResponse.json({ status: "error", pesan, ...tambahan }, { status, headers: { "Cache-Control": "no-store" } });
}

export function sukses(isi: Record<string, unknown>, status = 200) {
  return NextResponse.json({ status: "success", ...isi }, { status, headers: { "Cache-Control": "no-store" } });
}

async function cariKlien(req: NextRequest): Promise<Klien | null> {
  const auth = req.headers.get("authorization") ?? "";
  const kunci = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!kunci.startsWith(AWALAN_KUNCI) || kunci.length < 40 || kunci.length > 100) return null;
  const { data } = await supabaseAdmin()
    .from("api_klien")
    .select("id, nama, izin, aktif")
    .eq("hash", hashKunci(kunci))
    .maybeSingle();
  if (!data || !data.aktif) return null;
  return { id: data.id as string, nama: data.nama as string, izin: (data.izin ?? []) as Izin[] };
}

/**
 * Bungkus handler API: periksa kunci & izin, catat log (klien, jalur, status, durasi), tangkap galat.
 * Handler tidak perlu memeriksa akses lagi.
 */
export async function jalankanApi(
  req: NextRequest,
  izin: Izin,
  handler: (klien: Klien) => Promise<NextResponse>,
): Promise<NextResponse> {
  if (!supabaseSiap() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return galat(503, "Layanan belum dikonfigurasi.");

  const mulai = Date.now();
  const klien = await cariKlien(req);
  if (!klien) return galat(401, "Kunci API tidak valid atau sudah dicabut.");

  let res: NextResponse;
  let catatan: string | null = null;
  if (!klien.izin.includes(izin)) {
    res = galat(403, `Kunci ini tidak punya izin "${izin}".`);
  } else {
    try {
      res = await handler(klien);
    } catch (e) {
      catatan = e instanceof Error ? e.message.slice(0, 500) : "galat";
      res = galat(500, "Terjadi kesalahan di server.");
    }
  }

  const a = supabaseAdmin();
  const url = new URL(req.url);
  await Promise.all([
    a.from("api_log").insert({
      klien_id: klien.id,
      metode: req.method,
      jalur: (url.pathname + url.search).slice(0, 500),
      status: res.status,
      durasi_ms: Date.now() - mulai,
      catatan,
    }),
    a.from("api_klien").update({ terakhir_dipakai: new Date().toISOString() }).eq("id", klien.id),
  ]).catch(() => undefined);
  return res;
}
