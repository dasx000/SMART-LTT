import "server-only";
import { rentangBulanWIB, tanggalIsoWIB } from "@/lib/format";
import { ambilLaporan, ambilTargetDesa, ambilTargetDesaPmAas, daftarDesa, daftarKecamatan, type Komoditas, type Supa } from "@/lib/data";
import { daftarAnggota } from "@/lib/pengguna";
import type { Role } from "@/lib/auth";

/**
 * Realisasi LTT per PPL, satu komoditas (bawaan Padi; menu PPL bisa memilih Jagung / Ubi Kayu).
 * - Target PPL   = jumlah `target_desa` padi (semua jenis LTT) desa binaannya, tahun+bulan itu.
 * - Realisasi    = jumlah luas tanam laporan padi (semua jenis LTT) di desa binaannya, bulan itu
 *                  (bulan berjalan otomatis = 1 s.d. hari ini).
 * - Capaian %    = realisasi ÷ target (target 0 → null, ditampilkan "–").
 * - "Terisi"     = desa punya baris target padi (nilai 0 tetap dihitung terisi, sama dengan menu Target).
 * Realisasi desa yang belum ada target tetap dihitung (keputusan user 17 Nov 2026).
 * Hanya Penyuluh & Admin BPP aktif yang punya desa binaan. Satu desa hanya dipegang satu PPL.
 * Target Provinsi (keputusan user 24 Nov 2026): hanya ada di tingkat kecamatan (`target_provinsi`, diisi Admin Kab).
 *   - Capaian KECAMATAN & KABUPATEN = realisasi ÷ target provinsi (`capaianProv`).
 *   - Capaian PPL & DESA tetap = realisasi ÷ target isian PPL sendiri.
 *   - Selisih isian = jumlah isian PPL − target provinsi (negatif = isian PPL kurang).
 *   (Semua desa pasti punya PPL, jadi realisasi desa binaan = realisasi kecamatan.)
 * Urutan kecamatan (keputusan user 24 Nov 2026), per kelompok:
 *   1) isian PPL KURANG dari provinsi → kekurangan terbesar dulu;
 *   2) isian PPL SESUAI / LEBIH → capaian provinsi terendah dulu;
 *   3) target provinsi belum diisi → paling bawah.
 *   Seri → capaian provinsi terendah, lalu nama A–Z.
 * Urutan PPL (keputusan user 18 Nov 2026): 1) % desa terisi target terendah, 2) capaian terendah (null paling atas), 3) nama.
 * Desa: capaian terendah (belum ada target paling atas), lalu nama.
 *
 * Filter PM-AAS (`pmAas`, keputusan user 26 Nov 2026; hanya Padi, dipakai halaman PPL):
 *   target = `target_desa_pm_aas`, realisasi = laporan bermetode "PM AAS", target provinsi tidak dipakai.
 *
 * PEMANGGIL WAJIB memeriksa role & cakupan (BPP = kecamatannya, penyuluh = dirinya).
 */

export type DesaRealisasi = { id: number; nama: string; target: number | null; realisasi: number; capaian: number | null };
export type PplRealisasi = {
  id: string;
  nama: string;
  role: Role;
  desa: DesaRealisasi[];
  target: number;
  realisasi: number;
  /** jumlah desa yang sudah punya baris target */
  terisi: number;
  capaian: number | null;
};
export type KecRealisasi = {
  id: number;
  nama: string;
  ppl: PplRealisasi[];
  /** jumlah target isian PPL */
  target: number;
  /** target provinsi kecamatan (null = belum diisi Admin Kab) */
  targetProv: number | null;
  realisasi: number;
  /** realisasi ÷ target isian PPL */
  capaian: number | null;
  /** realisasi ÷ target provinsi */
  capaianProv: number | null;
  /** PPL yang sudah mengisi target minimal satu desa */
  sudahIsi: number;
};
export type RekapRealisasiPpl = {
  tahun: number;
  bulan: number;
  /** tanggal akhir data (YYYY-MM-DD): hari ini untuk bulan berjalan, akhir bulan untuk bulan lalu */
  sampai: string;
  kec: KecRealisasi[];
  /** jumlah target isian PPL */
  target: number;
  /** jumlah target provinsi kecamatan yang tampil (null = belum ada satu pun) */
  targetProv: number | null;
  realisasi: number;
  capaian: number | null;
  capaianProv: number | null;
  jumlahPpl: number;
  sudahIsi: number;
  lengkap: number;
};

const capaian = (realisasi: number, target: number) => (target > 0 ? (realisasi / target) * 100 : null);
/** null (belum ada target) dianggap paling rendah. */
const urutCapaian = (a: number | null, b: number | null) => (a ?? -1) - (b ?? -1);
/** Rasio desa terisi target (0–1); tanpa desa dianggap 0. */
const rasioIsi = (terisi: number, jumlah: number) => (jumlah > 0 ? terisi / jumlah : 0);
/** Selisih isian PPL − target provinsi; provinsi belum diisi → null. */
export const selisihIsian = (isian: number, prov: number | null) => (prov == null ? null : isian - prov);
/** null (provinsi belum diisi) paling bawah, kurang terbesar paling atas. */
const urutSelisih = (a: number | null, b: number | null) => {
  const kel = (x: number | null) => (x == null ? 2 : x < -0.005 ? 0 : 1);
  const ka = kel(a);
  const kb = kel(b);
  if (ka !== kb) return ka - kb;
  return ka === 0 ? a! - b! : 0; // kelompok 1 & 3 diurutkan oleh capaian (pembanding berikutnya)
};

export async function rekapRealisasiPpl(
  s: Supa,
  f: { tahun: number; bulan: number; kecamatanId?: number | null; userId?: string | null; komoditas?: Komoditas; pmAas?: boolean },
): Promise<RekapRealisasiPpl> {
  const komoditas = f.komoditas ?? "Padi";
  const pmAas = komoditas === "Padi" && Boolean(f.pmAas);
  const { dari, sampai } = rentangBulanWIB(f.tahun, f.bulan);
  const hariIni = tanggalIsoWIB();
  const akhirBulan = tanggalIsoWIB(new Date(new Date(sampai).getTime() - 1));
  const sampaiTgl = hariIni < akhirBulan ? hariIni : akhirBulan;

  const [kecs, desaRef, anggota] = await Promise.all([
    daftarKecamatan(s),
    daftarDesa(s, f.kecamatanId ?? null),
    daftarAnggota({ kecamatanId: f.kecamatanId ?? null, role: ["penyuluh", "admin_bpp"] }),
  ]);
  const ppl = anggota.filter((u) => u.aktif && u.desaIds.length > 0 && (!f.userId || u.id === f.userId));
  const desaPeta = new Map(desaRef.map((d) => [d.id, d]));
  const ids = [...new Set(ppl.flatMap((u) => u.desaIds))].filter((id) => desaPeta.has(id));

  const [target, lap, prov] = await Promise.all([
    pmAas ? ambilTargetDesaPmAas(s, ids, { tahun: f.tahun, bulan: f.bulan }) : ambilTargetDesa(s, ids, { tahun: f.tahun, bulan: f.bulan, komoditas }),
    ids.length ? ambilLaporan(s, { dari, sampai, komoditas, desaIds: ids }, kecs) : Promise.resolve([]),
    f.userId || pmAas ? Promise.resolve(null) : ambilTargetProvinsi(s, { tahun: f.tahun, bulan: f.bulan, komoditas }),
  ]);
  const tgtDesa = new Map<number, number>();
  for (const t of target) tgtDesa.set(t.desaId, (tgtDesa.get(t.desaId) ?? 0) + t.tanam);
  const realDesa = new Map<number, number>();
  for (const l of lap) {
    if (pmAas && l.metode !== "PM AAS") continue;
    realDesa.set(l.desaId, (realDesa.get(l.desaId) ?? 0) + l.tanam);
  }

  const perKec = new Map<number, PplRealisasi[]>();
  for (const u of ppl) {
    const desa: DesaRealisasi[] = u.desaIds
      .filter((id) => desaPeta.has(id))
      .map((id) => {
        const t = tgtDesa.has(id) ? tgtDesa.get(id)! : null;
        const r = realDesa.get(id) ?? 0;
        return { id, nama: desaPeta.get(id)!.nama, target: t, realisasi: r, capaian: t == null ? null : capaian(r, t) };
      })
      .sort((a, b) => urutCapaian(a.capaian, b.capaian) || a.nama.localeCompare(b.nama, "id"));
    if (desa.length === 0) continue;
    const tg = desa.reduce((a, d) => a + (d.target ?? 0), 0);
    const rl = desa.reduce((a, d) => a + d.realisasi, 0);
    const kecId = u.kecamatanId ?? desaPeta.get(desa[0].id)!.kecamatan_id;
    const baris: PplRealisasi = {
      id: u.id,
      nama: u.nama,
      role: u.role,
      desa,
      target: tg,
      realisasi: rl,
      terisi: desa.filter((d) => d.target != null).length,
      capaian: capaian(rl, tg),
    };
    perKec.set(kecId, [...(perKec.get(kecId) ?? []), baris]);
  }

  const kec: KecRealisasi[] = kecs
    .filter((k) => perKec.has(k.id))
    .map((k) => {
      const daftar = perKec
        .get(k.id)!
        .sort(
          (a, b) =>
            rasioIsi(a.terisi, a.desa.length) - rasioIsi(b.terisi, b.desa.length) ||
            urutCapaian(a.capaian, b.capaian) ||
            a.nama.localeCompare(b.nama, "id"),
        );
      const tg = daftar.reduce((a, p) => a + p.target, 0);
      const rl = daftar.reduce((a, p) => a + p.realisasi, 0);
      const tp = prov?.get(k.id) ?? null;
      return {
        id: k.id, nama: k.nama, ppl: daftar, target: tg, targetProv: tp, realisasi: rl,
        capaian: capaian(rl, tg), capaianProv: tp == null ? null : capaian(rl, tp),
        sudahIsi: daftar.filter((p) => p.terisi > 0).length,
      };
    });
  kec.sort(
    (a, b) =>
      urutSelisih(selisihIsian(a.target, a.targetProv), selisihIsian(b.target, b.targetProv)) ||
      urutCapaian(a.capaianProv, b.capaianProv) ||
      a.nama.localeCompare(b.nama, "id"),
  );

  const semua = kec.flatMap((k) => k.ppl);
  const tg = kec.reduce((a, k) => a + k.target, 0);
  const rl = kec.reduce((a, k) => a + k.realisasi, 0);
  const adaProv = kec.filter((k) => k.targetProv != null);
  const tp = adaProv.length ? adaProv.reduce((a, k) => a + k.targetProv!, 0) : null;
  return {
    tahun: f.tahun,
    bulan: f.bulan,
    sampai: sampaiTgl,
    kec,
    target: tg,
    targetProv: tp,
    realisasi: rl,
    capaian: capaian(rl, tg),
    capaianProv: tp == null ? null : capaian(rl, tp),
    jumlahPpl: semua.length,
    sudahIsi: semua.filter((p) => p.terisi > 0).length,
    lengkap: semua.filter((p) => p.terisi === p.desa.length).length,
  };
}

/** Target Provinsi (tanam) per kecamatan satu bulan & komoditas → Map kecamatan_id → Ha. */
async function ambilTargetProvinsi(s: Supa, f: { tahun: number; bulan: number; komoditas: Komoditas }) {
  const { data, error } = await s
    .from("target_provinsi")
    .select("kecamatan_id, target_tanam")
    .eq("tahun", f.tahun)
    .eq("bulan", f.bulan)
    .eq("komoditas", f.komoditas);
  if (error) throw new Error(error.message);
  const peta = new Map<number, number>();
  for (const t of data ?? []) peta.set(t.kecamatan_id, (peta.get(t.kecamatan_id) ?? 0) + (Number(t.target_tanam) || 0));
  return peta;
}
