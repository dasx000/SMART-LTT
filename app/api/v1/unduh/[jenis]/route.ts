import type { NextRequest } from "next/server";
import { galat, jalankanApi, sukses } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { KOMODITAS, type Komoditas } from "@/lib/data";
import { bulanTahunWIB, tanggalIsoWIB } from "@/lib/format";
import { specLaporan, specLttProvinsi, specRekapDinas } from "@/lib/unduh";

const RENTANG_MAKS_HARI = 92;
const tglValid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
const bulat = (v: string | null, min: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/**
 * GET /api/v1/unduh/<jenis> — izin: unduh:baca
 * Spesifikasi Excel yang SAMA dengan tombol unduh aplikasi (lib/unduh.ts). Klien merakit .xlsx sendiri
 * (perender: lib/excel.ts), jadi server tidak menjalankan ExcelJS.
 * Balasan: { status: "success", namaFile: string[], lembar: Lembar[] }
 *
 * rekap-dinas  tanggal=YYYY-MM-DD (satu hari)  ATAU  tahun & bulan (bawaan: bulan berjalan)
 * ltt-provinsi tahun & bulan (bawaan: bulan berjalan = realisasi hari ini + kumulatif 1 s.d hari ini)
 * laporan      dari, sampai (YYYY-MM-DD, bawaan hari ini, maks. 92 hari), komoditas, kecamatan (kode 6 angka)
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ jenis: string }> }) {
  return jalankanApi(req, "unduh:baca", async () => {
    const { jenis } = await ctx.params;
    const q = req.nextUrl.searchParams;
    const s = supabaseAdmin();

    if (jenis === "rekap-dinas") {
      if (q.get("tanggal")) {
        const tanggal = tglValid(q.get("tanggal"));
        if (!tanggal) return galat(400, "tanggal harus berformat YYYY-MM-DD.");
        return sukses({ ...(await specRekapDinas(s, { tanggal })) });
      }
      const now = bulanTahunWIB();
      const tahun = q.get("tahun") ? bulat(q.get("tahun"), 2000, 2100) : now.tahun;
      const bulan = q.get("bulan") ? bulat(q.get("bulan"), 1, 12) : now.bulan;
      if (!tahun || !bulan) return galat(400, "tahun (2000–2100) dan bulan (1–12) harus angka.");
      return sukses({ ...(await specRekapDinas(s, { tahun, bulan })) });
    }

    if (jenis === "ltt-provinsi") {
      // Tanpa parameter = bulan berjalan → realisasi hari ini + kumulatif 1 s.d hari ini (sama dengan dashboard)
      const now = bulanTahunWIB();
      const tahun = q.get("tahun") ? bulat(q.get("tahun"), 2000, 2100) : now.tahun;
      const bulan = q.get("bulan") ? bulat(q.get("bulan"), 1, 12) : now.bulan;
      if (!tahun || !bulan) return galat(400, "tahun (2000–2100) dan bulan (1–12) harus angka.");
      return sukses({ ...(await specLttProvinsi(s, { tahun, bulan })) });
    }

    if (jenis === "laporan") {
      const hariIni = tanggalIsoWIB();
      const dari = q.get("dari") ? tglValid(q.get("dari")) : hariIni;
      const sampai = q.get("sampai") ? tglValid(q.get("sampai")) : dari;
      if (!dari || !sampai) return galat(400, "dari/sampai harus berformat YYYY-MM-DD.");
      if (sampai < dari) return galat(400, "sampai tidak boleh sebelum dari.");
      if ((Date.parse(sampai) - Date.parse(dari)) / 86_400_000 >= RENTANG_MAKS_HARI) {
        return galat(400, `Rentang tanggal maksimal ${RENTANG_MAKS_HARI} hari.`);
      }
      const kom = q.get("komoditas");
      if (kom && !(KOMODITAS as string[]).includes(kom)) return galat(400, "komoditas harus Padi, Jagung, atau Ubi Kayu.");

      let kecId: number | null = null;
      const kodeKec = q.get("kecamatan");
      if (kodeKec) {
        if (!/^\d{6}$/.test(kodeKec)) return galat(400, "kecamatan harus kode 6 angka.");
        const { data, error } = await supabaseAdmin().from("kecamatan").select("id").eq("kode", kodeKec).maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return galat(404, "Kecamatan tidak ditemukan.");
        kecId = data.id as number;
      }
      return sukses({ ...(await specLaporan(s, { dari, sampai, komoditas: (kom as Komoditas) || null, kecId })) });
    }

    return galat(404, "Jenis unduhan tidak dikenal. Pilihan: rekap-dinas, ltt-provinsi, laporan.");
  });
}
