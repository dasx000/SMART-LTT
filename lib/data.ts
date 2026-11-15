import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { ambilSemua } from "@/lib/supabase/ambil-semua";
import { rentangBulanWIB, tanggalIsoWIB } from "@/lib/format";

/**
 * Lapisan data bersama: dipakai halaman DAN tombol unduh Excel, supaya angka di layar
 * dan di file selalu sama (plan §6b). Semua lewat client user (RLS berlaku).
 */

export type Supa = Awaited<ReturnType<typeof supabaseServer>>;
export type Komoditas = "Padi" | "Jagung" | "Ubi Kayu";
export const KOMODITAS: Komoditas[] = ["Padi", "Jagung", "Ubi Kayu"];

export type Kec = { id: number; nama: string };
export type DesaRef = { id: number; nama: string; kecamatan_id: number };

export async function daftarKecamatan(s: Supa): Promise<Kec[]> {
  const { data, error } = await s.from("kecamatan").select("id, nama").order("nama");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function daftarDesa(s: Supa, kecamatanId?: number | null): Promise<DesaRef[]> {
  let q = s.from("desa").select("id, nama, kecamatan_id").order("nama").limit(2000);
  if (kecamatanId) q = q.eq("kecamatan_id", kecamatanId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Desa binaan user yang login (ltt.anggota_desa, RLS: diri sendiri). */
export async function desaBinaanSaya(s: Supa, userId: string): Promise<DesaRef[]> {
  const { data, error } = await s
    .from("anggota_desa")
    .select("desa:desa_id(id, nama, kecamatan_id)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((r: { desa: unknown }) => r.desa as DesaRef | null)
    .filter((d): d is DesaRef => d !== null)
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

export type JenisRef = { id: number; nama: string; urutan: number };

export async function jenisPadi(s: Supa): Promise<JenisRef[]> {
  const { data, error } = await s
    .from("jenis_ltt")
    .select("id, nama, urutan")
    .eq("komoditas", "Padi")
    .eq("aktif", true)
    .order("urutan");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Laporan ───────────────────────────────────────────────────────────────────

export type BarisLaporan = {
  id: number;
  waktu: string;
  pelapor: string;
  kecamatanId: number;
  kecamatan: string;
  desaId: number;
  desa: string;
  komoditas: Komoditas;
  jenis: string | null;
  bera: number;
  olah: number;
  tanam: number;
  panen: number;
  metode: string | null;
  keterangan: string | null;
  sumber: string;
};

/**
 * Laporan dalam rentang [dari, sampai) — ISO dengan zona +07:00.
 * Filter wilayah lewat daftar desa (satu kecamatan ≈ 10–20 desa).
 */
export async function ambilLaporan(
  s: Supa,
  f: { dari: string; sampai: string; komoditas?: Komoditas | null; desaIds?: number[] | null },
  kecs?: Kec[],
): Promise<BarisLaporan[]> {
  if (f.desaIds && f.desaIds.length === 0) return [];
  const namaKec = new Map((kecs ?? (await daftarKecamatan(s))).map((k) => [k.id, k.nama]));

  type Mentah = {
    id: number; tanggal_lapor: string; nama_pelapor: string | null; desa_id: number; komoditas: Komoditas;
    luas_bera: number; realisasi_olah: number; realisasi_tanam: number; realisasi_panen: number;
    metode_penanaman: string | null; keterangan: string | null; sumber: string;
    desa: unknown; jenis: unknown;
  };

  const rows = await ambilSemua<Mentah>((a, b) => {
    let q = s
      .from("laporan_ltt")
      .select(
        "id, tanggal_lapor, nama_pelapor, desa_id, komoditas, luas_bera, realisasi_olah, realisasi_tanam, realisasi_panen, metode_penanaman, keterangan, sumber, desa:desa_id(nama, kecamatan_id), jenis:jenis_ltt_id(nama)",
      )
      .gte("tanggal_lapor", f.dari)
      .lt("tanggal_lapor", f.sampai)
      .is("dihapus_pada", null);
    if (f.komoditas) q = q.eq("komoditas", f.komoditas);
    if (f.desaIds) q = q.in("desa_id", f.desaIds);
    return q.order("tanggal_lapor", { ascending: false }).order("id").range(a, b) as unknown as PromiseLike<{
      data: Mentah[] | null;
      error: { message: string } | null;
    }>;
  });

  return rows.map((r) => {
    const d = r.desa as { nama: string; kecamatan_id: number } | null;
    const j = r.jenis as { nama: string } | null;
    const kecId = d?.kecamatan_id ?? 0;
    return {
      id: r.id,
      waktu: r.tanggal_lapor,
      pelapor: r.nama_pelapor ?? (r.sumber === "epusluh" ? "e-Pusluh" : "-"),
      kecamatanId: kecId,
      kecamatan: namaKec.get(kecId) ?? "-",
      desaId: r.desa_id,
      desa: d?.nama ?? "-",
      komoditas: r.komoditas,
      jenis: r.komoditas === "Padi" ? (j?.nama ?? "LTT Reguler") : null,
      bera: Number(r.luas_bera) || 0,
      olah: Number(r.realisasi_olah) || 0,
      tanam: Number(r.realisasi_tanam) || 0,
      panen: Number(r.realisasi_panen) || 0,
      metode: r.metode_penanaman,
      keterangan: r.keterangan,
      sumber: r.sumber,
    };
  });
}

// ─── Kategori (dashboard target vs realisasi & rekap Dinas) ───────────────────

/** Kategori lama (logika-bisnis §23d/23e). Oplah 2024/2026, CSR, Rehab tidak masuk (keputusan §25 no. 16). */
export type Kategori = "LTTReguler" | "PadiGogo" | "Oplah2025" | "Jagung" | "UbiKayu";

export const KATEGORI: { kunci: Kategori; label: string }[] = [
  { kunci: "LTTReguler", label: "LTT Reguler" },
  { kunci: "PadiGogo", label: "LTT Padi Gogo" },
  { kunci: "Oplah2025", label: "LTT Oplah 2025" },
  { kunci: "Jagung", label: "Jagung" },
  { kunci: "UbiKayu", label: "Ubi Kayu" },
];

export function kategoriDari(komoditas: Komoditas, jenis: string | null): Kategori | null {
  if (komoditas === "Jagung") return "Jagung";
  if (komoditas === "Ubi Kayu") return "UbiKayu";
  const j = (jenis ?? "").toLowerCase();
  if (!j || j.includes("reguler") || j === "ltt") return "LTTReguler";
  if (j.includes("gogo")) return "PadiGogo";
  if (j.includes("oplah") && j.includes("2025")) return "Oplah2025";
  return null;
}

type TR = { tanam: number; panen: number };
const nol = (): TR => ({ tanam: 0, panen: 0 });

/** Target per kecamatan per kategori untuk satu bulan. */
export async function targetKategoriPerKecamatan(s: Supa, bulan: number): Promise<Map<number, Record<Kategori, TR>>> {
  const desa = await daftarDesa(s);
  const kecDesa = new Map(desa.map((d) => [d.id, d.kecamatan_id]));
  const jenis = await jenisPadi(s);
  const namaJenis = new Map(jenis.map((j) => [j.id, j.nama]));

  const [{ data: td, error: e1 }, { data: tk, error: e2 }] = await Promise.all([
    s.from("target_desa")
      .select("desa_id, komoditas, target_tanam, target_panen, rincian:target_desa_rincian(jenis_ltt_id, target_tanam, target_panen)")
      .eq("bulan", bulan)
      .limit(5000),
    s.from("target_kecamatan").select("kecamatan_id, komoditas, target_tanam, target_panen").eq("bulan", bulan),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  const hasil = new Map<number, Record<Kategori, TR>>();
  const ambil = (kecId: number) => {
    let r = hasil.get(kecId);
    if (!r) {
      r = { LTTReguler: nol(), PadiGogo: nol(), Oplah2025: nol(), Jagung: nol(), UbiKayu: nol() };
      hasil.set(kecId, r);
    }
    return r;
  };

  // 1. Jumlah target desa (padi per jenis dari rincian)
  for (const t of td ?? []) {
    const kecId = kecDesa.get(t.desa_id);
    if (!kecId) continue;
    const r = ambil(kecId);
    if (t.komoditas === "Padi") {
      for (const ri of (t.rincian as { jenis_ltt_id: number; target_tanam: number; target_panen: number }[]) ?? []) {
        const k = kategoriDari("Padi", namaJenis.get(ri.jenis_ltt_id) ?? null);
        if (!k) continue;
        r[k].tanam += Number(ri.target_tanam) || 0;
        r[k].panen += Number(ri.target_panen) || 0;
      }
    } else {
      const k = kategoriDari(t.komoditas as Komoditas, null)!;
      r[k].tanam += Number(t.target_tanam) || 0;
      r[k].panen += Number(t.target_panen) || 0;
    }
  }

  // 2. Target kecamatan (diisi Admin BPP) MENIMPA hasil jumlah desa, seperti Target_Kecamatan_Provinsi
  //    di aplikasi lama: padi → hanya kategori LTT Reguler (logika-bisnis §17a). Nilai 0 = tidak diisi.
  for (const t of tk ?? []) {
    const r = ambil(t.kecamatan_id);
    const k: Kategori = t.komoditas === "Padi" ? "LTTReguler" : t.komoditas === "Jagung" ? "Jagung" : "UbiKayu";
    if (Number(t.target_tanam) > 0) r[k].tanam = Number(t.target_tanam);
    if (Number(t.target_panen) > 0) r[k].panen = Number(t.target_panen);
  }
  return hasil;
}

export function realisasiKategoriPerKecamatan(laporan: BarisLaporan[]): Map<number, Record<Kategori, TR>> {
  const hasil = new Map<number, Record<Kategori, TR>>();
  for (const l of laporan) {
    const k = kategoriDari(l.komoditas, l.jenis);
    if (!k) continue;
    let r = hasil.get(l.kecamatanId);
    if (!r) {
      r = { LTTReguler: nol(), PadiGogo: nol(), Oplah2025: nol(), Jagung: nol(), UbiKayu: nol() };
      hasil.set(l.kecamatanId, r);
    }
    r[k].tanam += l.tanam;
    r[k].panen += l.panen;
  }
  return hasil;
}

/** Laporan satu bulan (WIB) se-kabupaten. */
export async function laporanBulan(s: Supa, tahun: number, bulan: number, kecs?: Kec[]) {
  const { dari, sampai } = rentangBulanWIB(tahun, bulan);
  return ambilLaporan(s, { dari, sampai }, kecs);
}

// ─── Rekap Dinas (logika-bisnis §23e) ──────────────────────────────────────────

export type BarisDinas = {
  kecamatan: string;
  padiReguler: TR;
  padiGogo: TR;
  jagung: TR;
  kedelai: TR; // selalu 0 (keputusan §25 no. 15)
  ubiKayu: TR;
};

export function rekapDinas(kecs: Kec[], laporan: BarisLaporan[]): BarisDinas[] {
  const r = realisasiKategoriPerKecamatan(laporan);
  return kecs.map((k) => {
    const x = r.get(k.id);
    return {
      kecamatan: k.nama,
      padiReguler: x?.LTTReguler ?? nol(),
      padiGogo: x?.PadiGogo ?? nol(),
      jagung: x?.Jagung ?? nol(),
      kedelai: nol(),
      ubiKayu: x?.UbiKayu ?? nol(),
    };
  });
}

// ─── Rekap per kecamatan, rentang tanggal (logika-bisnis §12, §13) ─────────────

export type BarisRekapKec = { kecamatan: string; jenis: string; tanam: number; panen: number };

/**
 * Padi: satu baris per (kecamatan, jenis); kecamatan tanpa data → satu baris "-", 0, 0.
 * Palawija: satu baris per kecamatan (semua 15 kecamatan).
 */
export function rekapPerKecamatan(kecs: Kec[], laporan: BarisLaporan[], komoditas: Komoditas, jenis?: string | null) {
  const baris: BarisRekapKec[] = [];
  for (const k of kecs) {
    const milik = laporan.filter(
      (l) => l.kecamatanId === k.id && l.komoditas === komoditas && (!jenis || komoditas !== "Padi" || l.jenis === jenis),
    );
    if (komoditas === "Padi") {
      const perJenis = new Map<string, TR>();
      for (const l of milik) {
        const j = l.jenis ?? "LTT Reguler";
        const t = perJenis.get(j) ?? nol();
        t.tanam += l.tanam;
        t.panen += l.panen;
        perJenis.set(j, t);
      }
      if (perJenis.size === 0) baris.push({ kecamatan: k.nama, jenis: "-", tanam: 0, panen: 0 });
      for (const [j, t] of [...perJenis].sort(([a], [b]) => a.localeCompare(b))) {
        baris.push({ kecamatan: k.nama, jenis: j, ...t });
      }
    } else {
      baris.push({
        kecamatan: k.nama,
        jenis: komoditas,
        tanam: milik.reduce((a, l) => a + l.tanam, 0),
        panen: milik.reduce((a, l) => a + l.panen, 0),
      });
    }
  }
  return {
    baris,
    totalTanam: baris.reduce((a, b) => a + b.tanam, 0),
    totalPanen: baris.reduce((a, b) => a + b.panen, 0),
  };
}

// ─── Rekap PPL (logika-bisnis §19, §23i) ──────────────────────────────────────

/** Desa yang dihitung di rekap PPL: penyuluh = desa binaan; admin_bpp = semua desa kecamatannya. */
export async function desaRekapPpl(
  s: Supa,
  p: { id: string; role: string; kecamatanId: number | null },
): Promise<DesaRef[]> {
  if (p.role === "admin_bpp" && p.kecamatanId) return daftarDesa(s, p.kecamatanId);
  return desaBinaanSaya(s, p.id);
}

export type BarisRekapBulanan = {
  desa: string;
  komoditas: Komoditas;
  luasBaku: number;
  targetTanam: number;
  realisasiTanam: number;
  targetPanen: number;
  realisasiPanen: number;
};

export async function rekapBulananPpl(s: Supa, desa: DesaRef[], tahun: number, bulan: number) {
  const ids = desa.map((d) => d.id);
  if (ids.length === 0) return [] as BarisRekapBulanan[];
  const { dari, sampai } = rentangBulanWIB(tahun, bulan);
  const [laporan, { data: target, error }] = await Promise.all([
    ambilLaporan(s, { dari, sampai, desaIds: ids }),
    s.from("target_desa").select("desa_id, komoditas, target_tanam, target_panen, luas_baku").eq("bulan", bulan).in("desa_id", ids),
  ]);
  if (error) throw new Error(error.message);

  const hasil: BarisRekapBulanan[] = [];
  for (const kom of KOMODITAS) {
    for (const d of desa) {
      const t = (target ?? []).find((x) => x.desa_id === d.id && x.komoditas === kom);
      const l = laporan.filter((x) => x.desaId === d.id && x.komoditas === kom);
      hasil.push({
        desa: d.nama,
        komoditas: kom,
        luasBaku: Number(t?.luas_baku) || 0,
        targetTanam: Number(t?.target_tanam) || 0,
        realisasiTanam: l.reduce((a, x) => a + x.tanam, 0),
        targetPanen: Number(t?.target_panen) || 0,
        realisasiPanen: l.reduce((a, x) => a + x.panen, 0),
      });
    }
  }
  return hasil;
}

export type BarisRekapHarian = { desa: string; komoditas: Komoditas; tanam: number; panen: number; jumlah: number };

export async function rekapHarianPpl(s: Supa, desa: DesaRef[], tanggal: string) {
  const ids = desa.map((d) => d.id);
  if (ids.length === 0) return [] as BarisRekapHarian[];
  const besok = new Date(`${tanggal}T00:00:00+07:00`);
  besok.setUTCDate(besok.getUTCDate() + 1);
  const laporan = await ambilLaporan(s, {
    dari: `${tanggal}T00:00:00+07:00`,
    sampai: `${tanggalIsoWIB(besok)}T00:00:00+07:00`,
    desaIds: ids,
  });
  const hasil: BarisRekapHarian[] = [];
  for (const kom of KOMODITAS) {
    for (const d of desa) {
      const l = laporan.filter((x) => x.desaId === d.id && x.komoditas === kom);
      hasil.push({
        desa: d.nama,
        komoditas: kom,
        tanam: l.reduce((a, x) => a + x.tanam, 0),
        panen: l.reduce((a, x) => a + x.panen, 0),
        jumlah: l.length,
      });
    }
  }
  return hasil;
}

/** 5 bulan terakhir (bulan ini + 4 sebelumnya), terbaru dulu — pilihan rekap bulanan lama. */
export function limaBulanTerakhir(tahun: number, bulan: number) {
  const hasil: { tahun: number; bulan: number }[] = [];
  let t = tahun;
  let b = bulan;
  for (let i = 0; i < 5; i++) {
    hasil.push({ tahun: t, bulan: b });
    b--;
    if (b === 0) {
      b = 12;
      t--;
    }
  }
  return hasil;
}

// ─── Produktivitas & sarana (logika-bisnis §20) ───────────────────────────────

/** Rata-rata nilai > 0 (aturan lama). Tidak ada nilai > 0 → 0. */
export function rataPositif(nilai: number[]): number {
  const p = nilai.filter((v) => v > 0);
  return p.length ? p.reduce((a, b) => a + b, 0) / p.length : 0;
}

export type NilaiProd = Map<string, number[]>; // kunci `${desaId}|${komoditas}` → 12 bulan

export async function ambilProduktivitas(s: Supa, tahun: number, desaIds?: number[]): Promise<NilaiProd> {
  type R = { desa_id: number; komoditas: string; bulan: number; nilai: number };
  const rows = await ambilSemua<R>((a, b) => {
    let q = s.from("produktivitas_desa").select("desa_id, komoditas, bulan, nilai").eq("tahun", tahun);
    if (desaIds) q = q.in("desa_id", desaIds);
    return q.order("desa_id").order("komoditas").order("bulan").range(a, b) as unknown as PromiseLike<{
      data: R[] | null;
      error: { message: string } | null;
    }>;
  });
  const m: NilaiProd = new Map();
  for (const r of rows) {
    const k = `${r.desa_id}|${r.komoditas}`;
    const arr = m.get(k) ?? new Array(12).fill(0);
    arr[r.bulan - 1] = Number(r.nilai) || 0;
    m.set(k, arr);
  }
  return m;
}

export type Sarana = { gudang_gabah: number; embung: number; lantai_jemur: number; mesin_pengering: number; updated_at: string };
export const KOLOM_SARANA = [
  { kunci: "gudang_gabah", label: "Gudang Gabah" },
  { kunci: "embung", label: "Embung" },
  { kunci: "lantai_jemur", label: "Lantai Jemur" },
  { kunci: "mesin_pengering", label: "Mesin Pengering" },
] as const;

export async function ambilSarana(s: Supa, desaIds?: number[]): Promise<Map<number, Sarana>> {
  let q = s.from("sarana_desa").select("desa_id, gudang_gabah, embung, lantai_jemur, mesin_pengering, updated_at").limit(2000);
  if (desaIds) q = q.in("desa_id", desaIds);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((r) => [r.desa_id, r as Sarana]));
}

/** Tahun yang sudah punya data produktivitas (+ tahun berjalan). */
export async function tahunProduktivitas(s: Supa, tahunIni: number): Promise<number[]> {
  const { data } = await s.from("produktivitas_desa").select("tahun").order("tahun").limit(1000);
  return [...new Set([...(data ?? []).map((r) => r.tahun as number), tahunIni])].sort((a, b) => b - a);
}

// ─── Target desa (form PPL / BPP) ─────────────────────────────────────────────

export type TargetDesaData = {
  desaId: number;
  bulan: number;
  komoditas: Komoditas;
  tanam: number;
  panen: number;
  luasBaku: number;
  rincian: { jenisId: number; tanam: number; panen: number }[];
};

export async function ambilTargetDesa(s: Supa, desaIds: number[]): Promise<TargetDesaData[]> {
  if (desaIds.length === 0) return [];
  type R = {
    desa_id: number; bulan: number; komoditas: Komoditas; target_tanam: number; target_panen: number; luas_baku: number | null;
    rincian: { jenis_ltt_id: number; target_tanam: number; target_panen: number }[] | null;
  };
  const rows = await ambilSemua<R>((a, b) =>
    s
      .from("target_desa")
      .select("desa_id, bulan, komoditas, target_tanam, target_panen, luas_baku, rincian:target_desa_rincian(jenis_ltt_id, target_tanam, target_panen)")
      .in("desa_id", desaIds)
      .order("id")
      .range(a, b) as unknown as PromiseLike<{ data: R[] | null; error: { message: string } | null }>,
  );
  return rows.map((r) => ({
    desaId: r.desa_id,
    bulan: r.bulan,
    komoditas: r.komoditas,
    tanam: Number(r.target_tanam) || 0,
    panen: Number(r.target_panen) || 0,
    luasBaku: Number(r.luas_baku) || 0,
    rincian: (r.rincian ?? []).map((x) => ({ jenisId: x.jenis_ltt_id, tanam: Number(x.target_tanam) || 0, panen: Number(x.target_panen) || 0 })),
  }));
}
