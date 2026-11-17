import "server-only";
import { rentangBulanWIB, tanggalIsoWIB } from "@/lib/format";
import { ambilLaporan, ambilTargetDesa, daftarDesa, daftarKecamatan, type Komoditas, type Supa } from "@/lib/data";
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
 * Kecamatan & PPL diurutkan dari capaian terendah; yang belum isi target (capaian null) paling atas.
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
  target: number;
  realisasi: number;
  capaian: number | null;
  /** PPL yang sudah mengisi target minimal satu desa */
  sudahIsi: number;
};
export type RekapRealisasiPpl = {
  tahun: number;
  bulan: number;
  /** tanggal akhir data (YYYY-MM-DD): hari ini untuk bulan berjalan, akhir bulan untuk bulan lalu */
  sampai: string;
  kec: KecRealisasi[];
  target: number;
  realisasi: number;
  capaian: number | null;
  jumlahPpl: number;
  sudahIsi: number;
  lengkap: number;
};

const capaian = (realisasi: number, target: number) => (target > 0 ? (realisasi / target) * 100 : null);
/** null (belum ada target) dianggap paling rendah. */
const urutCapaian = (a: number | null, b: number | null) => (a ?? -1) - (b ?? -1);

export async function rekapRealisasiPpl(
  s: Supa,
  f: { tahun: number; bulan: number; kecamatanId?: number | null; userId?: string | null; komoditas?: Komoditas },
): Promise<RekapRealisasiPpl> {
  const komoditas = f.komoditas ?? "Padi";
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

  const [target, lap] = await Promise.all([
    ambilTargetDesa(s, ids, { tahun: f.tahun, bulan: f.bulan, komoditas }),
    ids.length ? ambilLaporan(s, { dari, sampai, komoditas, desaIds: ids }, kecs) : Promise.resolve([]),
  ]);
  const tgtDesa = new Map<number, number>();
  for (const t of target) tgtDesa.set(t.desaId, (tgtDesa.get(t.desaId) ?? 0) + t.tanam);
  const realDesa = new Map<number, number>();
  for (const l of lap) realDesa.set(l.desaId, (realDesa.get(l.desaId) ?? 0) + l.tanam);

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
      const daftar = perKec.get(k.id)!.sort((a, b) => urutCapaian(a.capaian, b.capaian) || a.nama.localeCompare(b.nama, "id"));
      const tg = daftar.reduce((a, p) => a + p.target, 0);
      const rl = daftar.reduce((a, p) => a + p.realisasi, 0);
      return { id: k.id, nama: k.nama, ppl: daftar, target: tg, realisasi: rl, capaian: capaian(rl, tg), sudahIsi: daftar.filter((p) => p.terisi > 0).length };
    })
    .sort((a, b) => urutCapaian(a.capaian, b.capaian) || a.nama.localeCompare(b.nama, "id"));

  const semua = kec.flatMap((k) => k.ppl);
  const tg = kec.reduce((a, k) => a + k.target, 0);
  const rl = kec.reduce((a, k) => a + k.realisasi, 0);
  return {
    tahun: f.tahun,
    bulan: f.bulan,
    sampai: sampaiTgl,
    kec,
    target: tg,
    realisasi: rl,
    capaian: capaian(rl, tg),
    jumlahPpl: semua.length,
    sudahIsi: semua.filter((p) => p.terisi > 0).length,
    lengkap: semua.filter((p) => p.terisi === p.desa.length).length,
  };
}
