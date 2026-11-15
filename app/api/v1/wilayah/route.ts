import type { NextRequest } from "next/server";
import { jalankanApi, sukses } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/v1/wilayah — izin: wilayah:baca
 * Kecamatan & desa, format sama dengan DASBOT database/master_desa.json:
 *   data: [{ id_kecamatan, nama_kecamatan, desa: [{ id_desa, nama_desa }] }]
 * id_* = kode Kemendagri. Diurutkan menurut kode.
 */
export async function GET(req: NextRequest) {
  return jalankanApi(req, "wilayah:baca", async () => {
    const a = supabaseAdmin();
    const [k, d] = await Promise.all([
      a.from("kecamatan").select("id, kode, nama").order("kode"),
      a.from("desa").select("kode, nama, kecamatan_id").order("kode").limit(5000),
    ]);
    if (k.error || d.error) throw new Error((k.error ?? d.error)!.message);

    const data = (k.data ?? []).map((kec) => ({
      id_kecamatan: kec.kode,
      nama_kecamatan: kec.nama,
      desa: (d.data ?? []).filter((x) => x.kecamatan_id === kec.id).map((x) => ({ id_desa: x.kode, nama_desa: x.nama })),
    }));
    return sukses({ total_kecamatan: data.length, total_desa: d.data?.length ?? 0, data });
  });
}
