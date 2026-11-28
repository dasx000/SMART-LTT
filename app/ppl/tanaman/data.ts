import "server-only";
import type { supabaseServer } from "@/lib/supabase/server";
import { ambilSemua } from "@/lib/supabase/ambil-semua";
import { tanggalIsoWIB } from "@/lib/format";
import { hitungPantau, jenisTanam, metodeKelompok, type BarisLaporan, type KomoditasPantau, type Petak } from "./hitung";

type Supa = Awaited<ReturnType<typeof supabaseServer>>;

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
