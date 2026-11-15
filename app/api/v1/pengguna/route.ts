import type { NextRequest } from "next/server";
import { galat, jalankanApi, sukses } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { daftarAnggota } from "@/lib/pengguna";
import type { Role } from "@/lib/auth";

/** Label role lama (ppl.json DASBOT) — dipertahankan agar bot tidak perlu diubah. */
const LABEL_ROLE: Record<Role, string> = { penyuluh: "Penyuluh", admin_bpp: "Admin_BPP", admin_kab: "Admin_Kab", viewer: "Viewer" };
const SEMUA_ROLE = Object.keys(LABEL_ROLE) as Role[];

const fmtWaktu = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});

/** Nomor WA seragam: hanya angka, awalan 62 (0812… → 62812…). */
function noWa(v: string | null): string {
  const d = (v ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return "62" + d.slice(1);
  if (d.startsWith("8")) return "62" + d;
  return d;
}

/**
 * GET /api/v1/pengguna — izin: pengguna:baca
 * Format sama dengan DASBOT database/ppl.json, ditambah kolom baru (tidak ada yang dikurangi):
 *   { total_staff, last_updated, staff: [{ nip, nama, desa_binaan: ["kode-nama"], no_wa, role,
 *       role_kode, kecamatan: { kode, nama } | null, aktif }],
 *     geography: { "180801-Blambangan Umpu": ["1808011005-Blambangan Umpu", …] } }
 *
 * Parameter (opsional):
 *   role=penyuluh,admin_bpp,admin_kab,viewer   (bawaan: semua kecuali viewer, sama dengan ppl.json)
 *   kecamatan=180801                            kode Kemendagri
 *   aktif=semua                                  (bawaan: hanya akun aktif)
 *   nip=1979…                                    satu orang
 */
export async function GET(req: NextRequest) {
  return jalankanApi(req, "pengguna:baca", async () => {
    const p = req.nextUrl.searchParams;
    const roleParam = (p.get("role") ?? "").split(",").map((r) => r.trim()).filter(Boolean);
    if (roleParam.some((r) => !SEMUA_ROLE.includes(r as Role))) return galat(400, `role harus salah satu dari: ${SEMUA_ROLE.join(", ")}.`);
    const roles = (roleParam.length ? roleParam : SEMUA_ROLE.filter((r) => r !== "viewer")) as Role[];
    const kodeKec = p.get("kecamatan");
    if (kodeKec && !/^\d{6}$/.test(kodeKec)) return galat(400, "kecamatan harus kode 6 angka (mis. 180801).");
    const nip = p.get("nip")?.trim() || null;

    const a = supabaseAdmin();
    const [anggota, k, d] = await Promise.all([
      daftarAnggota({ role: roles }),
      a.from("kecamatan").select("id, kode, nama").order("kode"),
      a.from("desa").select("id, kode, nama, kecamatan_id").order("kode").limit(5000),
    ]);
    if (k.error || d.error) throw new Error((k.error ?? d.error)!.message);
    const kec = new Map((k.data ?? []).map((x) => [x.id, x]));
    const desa = new Map((d.data ?? []).map((x) => [x.id, x]));
    const idKec = kodeKec ? (k.data ?? []).find((x) => x.kode === kodeKec)?.id : undefined;
    if (kodeKec && !idKec) return galat(404, "Kecamatan tidak ditemukan.");

    const staff = anggota
      .filter((u) => (p.get("aktif") === "semua" || u.aktif) && (!idKec || u.kecamatanId === idKec) && (!nip || u.nip === nip))
      .map((u) => {
        const kc = u.kecamatanId ? kec.get(u.kecamatanId) : undefined;
        return {
          nip: u.nip,
          nama: u.nama,
          desa_binaan: u.desaIds
            .map((id) => desa.get(id))
            .filter((x) => x !== undefined)
            .sort((x, y) => x.kode.localeCompare(y.kode))
            .map((x) => `${x.kode}-${x.nama}`),
          no_wa: noWa(u.whatsapp),
          role: LABEL_ROLE[u.role],
          role_kode: u.role,
          kecamatan: kc ? { kode: kc.kode, nama: kc.nama } : null,
          aktif: u.aktif,
        };
      });

    // Dipakai fitur arsip folder bot (pplData.geography): "kode-nama kecamatan" → ["kode-nama desa"]
    const geography = Object.fromEntries(
      (k.data ?? []).map((kc) => [
        `${kc.kode}-${kc.nama}`,
        (d.data ?? []).filter((x) => x.kecamatan_id === kc.id).map((x) => `${x.kode}-${x.nama}`),
      ]),
    );

    return sukses({
      total_staff: staff.length,
      last_updated: fmtWaktu.format(new Date()).replace(/\//g, "-").replace(",", "").replace(/\./g, ":"),
      staff,
      geography,
    });
  });
}
