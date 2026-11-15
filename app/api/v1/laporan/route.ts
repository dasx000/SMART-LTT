import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { galat, jalankanApi, sukses } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { daftarAnggota } from "@/lib/pengguna";
import { angkaHa } from "@/lib/validasi";
import { tanggalIsoWIB } from "@/lib/format";

const KOMODITAS = ["Padi", "Jagung", "Ubi Kayu"] as const;
const PER_BAWAAN = 500;
const PER_MAKS = 1000;
const RENTANG_MAKS_HARI = 92;

const tglValid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
const hariSesudah = (t: string) => tanggalIsoWIB(new Date(new Date(`${t}T00:00:00+07:00`).getTime() + 86_400_000));

const SELECT =
  "id, id_sumber, sumber, tanggal_lapor, komoditas, metode_penanaman, nama_pelapor, nip_pelapor, " +
  "luas_bera, realisasi_olah, realisasi_tanam, realisasi_panen, keterangan, created_at, updated_at, " +
  "jenis:jenis_ltt_id(nama), desa:desa_id(kode, nama, kecamatan:kecamatan_id(kode, nama))";

type BarisDb = {
  id: number; id_sumber: string | null; sumber: string; tanggal_lapor: string; komoditas: string;
  metode_penanaman: string | null; nama_pelapor: string | null; nip_pelapor: string | null;
  luas_bera: number; realisasi_olah: number; realisasi_tanam: number; realisasi_panen: number;
  keterangan: string | null; created_at: string; updated_at: string;
  jenis: { nama: string } | null;
  desa: { kode: string; nama: string; kecamatan: { kode: string; nama: string } | null } | null;
};

/** Waktu ISO dengan offset WIB, mis. 2026-11-16T09:12:30+07:00 */
function isoWib(t: string): string {
  const d = new Date(new Date(t).getTime() + 7 * 3600_000);
  return d.toISOString().slice(0, 19) + "+07:00";
}

function bentuk(r: BarisDb) {
  return {
    id: r.id,
    id_sumber: r.id_sumber,
    sumber: r.sumber,
    tanggal_lapor: isoWib(r.tanggal_lapor),
    komoditas: r.komoditas,
    jenis_ltt: r.jenis?.nama ?? null,
    metode_penanaman: r.metode_penanaman,
    kecamatan: r.desa?.kecamatan ?? null,
    desa: r.desa ? { kode: r.desa.kode, nama: r.desa.nama } : null,
    pelapor: { nama: r.nama_pelapor, nip: r.nip_pelapor },
    luas_bera: Number(r.luas_bera) || 0,
    realisasi_olah: Number(r.realisasi_olah) || 0,
    realisasi_tanam: Number(r.realisasi_tanam) || 0,
    realisasi_panen: Number(r.realisasi_panen) || 0,
    keterangan: r.keterangan,
    dibuat: r.created_at,
    diperbarui: r.updated_at,
  };
}

/**
 * GET /api/v1/laporan — izin: laporan:baca
 * Parameter:
 *   dari, sampai   YYYY-MM-DD (WIB). Bawaan: hari ini. Rentang maks. 92 hari.
 *   komoditas      Padi | Jagung | Ubi Kayu
 *   kecamatan      kode 6 angka      desa  kode 10 angka
 *   sumber         manual | epusluh
 *   nip            laporan satu PPL
 *   halaman, per   bawaan 1 & 500 (maks. 1000)
 * Urut: tanggal_lapor terbaru dulu. Laporan yang dihapus tidak ikut.
 */
export async function GET(req: NextRequest) {
  return jalankanApi(req, "laporan:baca", async () => {
    const p = req.nextUrl.searchParams;
    const hariIni = tanggalIsoWIB();
    const dari = tglValid(p.get("dari")) ?? (p.get("dari") ? null : hariIni);
    const sampai = tglValid(p.get("sampai")) ?? (p.get("sampai") ? null : dari);
    if (!dari || !sampai) return galat(400, "dari/sampai harus berformat YYYY-MM-DD.");
    if (sampai < dari) return galat(400, "sampai tidak boleh sebelum dari.");
    if ((Date.parse(sampai) - Date.parse(dari)) / 86_400_000 >= RENTANG_MAKS_HARI) {
      return galat(400, `Rentang tanggal maksimal ${RENTANG_MAKS_HARI} hari. Pecah menjadi beberapa permintaan.`);
    }
    const komoditas = p.get("komoditas");
    if (komoditas && !(KOMODITAS as readonly string[]).includes(komoditas)) return galat(400, "komoditas harus Padi, Jagung, atau Ubi Kayu.");
    const sumber = p.get("sumber");
    if (sumber && !["manual", "epusluh"].includes(sumber)) return galat(400, "sumber harus manual atau epusluh.");
    const kodeKec = p.get("kecamatan");
    const kodeDesa = p.get("desa");
    if (kodeKec && !/^\d{6}$/.test(kodeKec)) return galat(400, "kecamatan harus kode 6 angka.");
    if (kodeDesa && !/^\d{10}$/.test(kodeDesa)) return galat(400, "desa harus kode 10 angka.");
    const halaman = Math.max(1, Number.parseInt(p.get("halaman") ?? "1", 10) || 1);
    const per = Math.min(PER_MAKS, Math.max(1, Number.parseInt(p.get("per") ?? String(PER_BAWAAN), 10) || PER_BAWAAN));

    const a = supabaseAdmin();
    let desaIds: number[] | null = null;
    if (kodeKec || kodeDesa) {
      let q = a.from("desa").select("id, kode, kecamatan:kecamatan_id(kode)").limit(5000);
      if (kodeDesa) q = q.eq("kode", kodeDesa);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      desaIds = (data ?? [])
        .filter((x) => !kodeKec || (x.kecamatan as unknown as { kode: string } | null)?.kode === kodeKec)
        .map((x) => x.id as number);
      if (desaIds.length === 0) return sukses({ dari, sampai, halaman, per, total: 0, jumlah_halaman: 1, data: [] });
    }

    let q = a
      .from("laporan_ltt")
      .select(SELECT, { count: "exact" })
      .is("dihapus_pada", null)
      .gte("tanggal_lapor", `${dari}T00:00:00+07:00`)
      .lt("tanggal_lapor", `${hariSesudah(sampai)}T00:00:00+07:00`)
      .order("tanggal_lapor", { ascending: false })
      .order("id", { ascending: false })
      .range((halaman - 1) * per, halaman * per - 1);
    if (komoditas) q = q.eq("komoditas", komoditas);
    if (sumber) q = q.eq("sumber", sumber);
    if (desaIds) q = q.in("desa_id", desaIds);
    if (p.get("nip")) q = q.eq("nip_pelapor", p.get("nip")!.trim());

    const { data, count, error } = await q;
    if (error?.code === "PGRST103") {
      return sukses({ dari, sampai, halaman, per, total: count ?? 0, jumlah_halaman: Math.max(1, Math.ceil((count ?? 0) / per)), data: [] });
    }
    if (error) throw new Error(error.message);
    const total = count ?? 0;
    return sukses({
      dari, sampai, halaman, per, total,
      jumlah_halaman: Math.max(1, Math.ceil(total / per)),
      data: ((data ?? []) as unknown as BarisDb[]).map(bentuk),
    });
  });
}

const skemaKirim = z.object({
  nip: z.string().trim().min(5, "nip wajib diisi."),
  desa: z.string().trim().regex(/^\d{10}$/, "desa harus kode Kemendagri 10 angka."),
  komoditas: z.enum(["Jagung", "Ubi Kayu"], { error: "komoditas harus Jagung atau Ubi Kayu (padi masuk lewat e-Pusluh)." }),
  realisasi_tanam: angkaHa("realisasi_tanam"),
  realisasi_panen: angkaHa("realisasi_panen"),
  keterangan: z.string().trim().max(500, "keterangan maksimal 500 karakter.").optional().default(""),
  /** Kunci unik dari pengirim (mis. ID pesan WA). Kiriman ulang dengan kunci sama tidak membuat laporan ganda. */
  id_kirim: z.string().trim().max(100, "id_kirim maksimal 100 karakter.").optional(),
});

/**
 * POST /api/v1/laporan — izin: laporan:tulis
 * Kirim laporan LTT Jagung / Ubi Kayu atas nama PPL. Aturan sama dengan form PPL di aplikasi:
 * akun aktif (Penyuluh / Admin BPP) dan desa harus desa binaannya. Waktu lapor = waktu server.
 * Body JSON: { nip, desa, komoditas, realisasi_tanam, realisasi_panen, keterangan?, id_kirim? }
 */
export async function POST(req: NextRequest) {
  return jalankanApi(req, "laporan:tulis", async (klien) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return galat(400, "Body harus JSON.");
    }
    const p = skemaKirim.safeParse(body);
    if (!p.success) return galat(400, p.error.issues[0]?.message ?? "Isian tidak valid.");
    const x = p.data;

    const a = supabaseAdmin();
    const [anggota, { data: desa, error: errDesa }] = await Promise.all([
      daftarAnggota({ role: ["penyuluh", "admin_bpp"] }),
      a.from("desa").select("id, kode, nama").eq("kode", x.desa).maybeSingle(),
    ]);
    if (errDesa) throw new Error(errDesa.message);
    const u = anggota.find((g) => g.nip === x.nip);
    if (!u) return galat(404, "NIP tidak terdaftar sebagai Penyuluh / Admin BPP.");
    if (!u.aktif) return galat(403, "Akun PPL ini nonaktif.");
    if (!desa) return galat(404, "Kode desa tidak ditemukan.");
    if (!u.desaIds.includes(desa.id)) return galat(403, `Desa ${desa.nama} bukan desa binaan ${u.nama}.`);

    const { data: jenis } = await a.from("jenis_ltt").select("id").eq("nama", "LTT").eq("komoditas", x.komoditas).maybeSingle();
    const idSumber = x.id_kirim ? `api:${klien.id.slice(0, 8)}:${x.id_kirim}` : null;

    const { data, error } = await a
      .from("laporan_ltt")
      .insert({
        id_sumber: idSumber,
        jenis_ltt_id: jenis?.id ?? null,
        tanggal_lapor: new Date().toISOString(),
        pelapor_id: u.id,
        nama_pelapor: u.nama,
        nip_pelapor: u.nip,
        desa_id: desa.id,
        komoditas: x.komoditas,
        realisasi_tanam: x.realisasi_tanam,
        realisasi_panen: x.realisasi_panen,
        keterangan: x.keterangan || null,
        sumber: "manual",
      })
      .select(SELECT)
      .single();

    if (error?.code === "23505" && idSumber) {
      // Kiriman ulang (id_kirim sama) → kembalikan laporan yang sudah ada, tidak membuat ganda
      const { data: ada } = await a.from("laporan_ltt").select(SELECT).eq("sumber", "manual").eq("id_sumber", idSumber).single();
      return sukses({ duplikat: true, pesan: "Laporan dengan id_kirim ini sudah tersimpan sebelumnya.", data: ada ? bentuk(ada as unknown as BarisDb) : null });
    }
    if (error) throw new Error(error.message);

    revalidatePath("/", "layout");
    return sukses({ duplikat: false, pesan: `Laporan ${x.komoditas} desa ${desa.nama} tersimpan.`, data: bentuk(data as unknown as BarisDb) }, 201);
  });
}
