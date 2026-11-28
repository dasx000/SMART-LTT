import "server-only";
import type { supabaseServer } from "@/lib/supabase/server";
import { ambilSemua } from "@/lib/supabase/ambil-semua";
import { tanggalIsoWIB } from "@/lib/format";
import { hitungPantau, jenisTanam, metodeKelompok, type BarisLaporan, type KomoditasPantau, type Petak } from "./hitung";

type Supa = Awaited<ReturnType<typeof supabaseServer>>;

/** Kunci satu kartu — sama dengan kunci unik ltt.pantau_selesai. */
export function kunciKartu(x: { desaId: number; komoditas: string; jenisLtt: string; metode: string; tanggalTanam: string }): string {
  return `${x.desaId}|${x.komoditas}|${x.jenisLtt}|${x.metode}|${x.tanggalTanam}`;
}

/** Semua kartu Pantau Tanaman untuk desa-desa ini (dihitung dari laporan_ltt, baca saja). */
export async function muatPantau(s: Supa, desaIds: number[]): Promise<Petak[]> {
  if (desaIds.length === 0) return [];
  const data = await ambilSemua<{
    desa_id: number;
    komoditas: string;
    tanggal_lapor: string;
    realisasi_tanam: number;
    realisasi_panen: number;
    metode_penanaman: string | null;
    jenis: unknown; // relasi jenis_ltt: { nama } (PostgREST bisa juga mengetik sebagai array)
  }>((dari, sampai) =>
    s
      .from("laporan_ltt")
      .select("desa_id, komoditas, tanggal_lapor, realisasi_tanam, realisasi_panen, metode_penanaman, jenis:jenis_ltt_id(nama)")
      .in("desa_id", desaIds)
      .in("komoditas", ["Padi", "Jagung"])
      .is("dihapus_pada", null)
      .or("realisasi_tanam.gt.0,realisasi_panen.gt.0")
      .order("id")
      .range(dari, sampai),
  );

  const baris: BarisLaporan[] = data.flatMap((r) => {
    const rel = (Array.isArray(r.jenis) ? r.jenis[0] : r.jenis) as { nama?: string } | null | undefined;
    const jenis = jenisTanam(r.komoditas, r.metode_penanaman, rel?.nama ?? null);
    if (!jenis) return [];
    return [
      {
        desa_id: r.desa_id,
        komoditas: r.komoditas as KomoditasPantau,
        jenis,
        jenisLtt: rel?.nama ?? "-",
        metode: metodeKelompok(r.komoditas, r.metode_penanaman),
        tanggal: tanggalIsoWIB(r.tanggal_lapor),
        tanam: Number(r.realisasi_tanam) || 0,
        panen: Number(r.realisasi_panen) || 0,
      },
    ];
  });

  return hitungPantau(baris, tanggalIsoWIB());
}

const bulat = (n: number) => Math.round(n * 100) / 100;

/**
 * Buang kartu yang sudah ditandai selesai. Kartu muncul lagi kalau datanya diperbarui sejak ditandai:
 * luas tanam berubah, atau sisa belum panen bertambah. (Sisa berkurang karena lapor panen → tetap tersembunyi.)
 * Tabel belum ada / gagal dibaca → semua kartu tetap tampil.
 */
export async function saringSelesai(s: Supa, desaIds: number[], petak: Petak[]): Promise<Petak[]> {
  if (desaIds.length === 0 || petak.length === 0) return petak;
  const { data, error } = await s
    .from("pantau_selesai")
    .select("desa_id, komoditas, jenis_ltt, metode, tanggal_tanam, luas_tanam, sisa")
    .in("desa_id", desaIds);
  if (error || !data) return petak;

  const tanda = new Map(
    data.map((r) => [
      kunciKartu({ desaId: r.desa_id, komoditas: r.komoditas, jenisLtt: r.jenis_ltt, metode: r.metode, tanggalTanam: r.tanggal_tanam }),
      { luas: Number(r.luas_tanam), sisa: Number(r.sisa) },
    ]),
  );

  return petak.filter((x) => {
    const t = tanda.get(kunciKartu(x));
    if (!t) return true;
    const diperbarui = bulat(x.luasTanam) !== bulat(t.luas) || bulat(x.sisa) > bulat(t.sisa);
    return diperbarui;
  });
}
