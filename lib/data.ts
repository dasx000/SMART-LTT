import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { ambilSemua } from "@/lib/supabase/ambil-semua";
import { bulanTahunWIB, rentangBulanWIB, tanggalIsoWIB } from "@/lib/format";

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
  /** status laporan di e-Pusluh (khusus Padi), mis. "Diajukan" */
  status: string | null;
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
    metode_penanaman: string | null; keterangan: string | null; status_epusluh: string | null; sumber: string;
    desa: unknown; jenis: unknown;
  };

  const rows = await ambilSemua<Mentah>((a, b) => {
    let q = s
      .from("laporan_ltt")
      .select(
        "id, tanggal_lapor, nama_pelapor, desa_id, komoditas, luas_bera, realisasi_olah, realisasi_tanam, realisasi_panen, metode_penanaman, keterangan, status_epusluh, sumber, desa:desa_id(nama, kecamatan_id), jenis:jenis_ltt_id(nama)",
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
      status: r.komoditas === "Padi" ? r.status_epusluh : null,
      sumber: r.sumber,
    };
  });
}

// ─── Kategori jenis LTT (dipakai rekap Dinas & format Provinsi) ────────────────

/** Kategori lama (logika-bisnis §23d/23e). */
export type Kategori = "LTTReguler" | "PadiGogo" | "Oplah2025" | "Jagung" | "UbiKayu";

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

/** Laporan satu bulan (WIB) se-kabupaten. */
export async function laporanBulan(s: Supa, tahun: number, bulan: number, kecs?: Kec[]) {
  const { dari, sampai } = rentangBulanWIB(tahun, bulan);
  return ambilLaporan(s, { dari, sampai }, kecs);
}

// ─── Rekap Dinas (logika-bisnis §23e) ──────────────────────────────────────────

/** Kolom tabel Rekapitulasi LTT (dashboard & Excel), berurutan. Kedelai dihapus (16 Nov 2026). */
export const KOLOM_DINAS = [
  { kunci: "padiReguler", label: "LTT Padi Reguler" },
  { kunci: "padiGogo", label: "LTT Padi Gogo" },
  { kunci: "oplah2026", label: "LTT Padi OPLAH 2026" },
  { kunci: "jagung", label: "LTT Jagung" },
  { kunci: "ubiKayu", label: "LTT Ubi Kayu" },
] as const;
export type KunciDinas = (typeof KOLOM_DINAS)[number]["kunci"];
export type BarisDinas = { kecamatan: string } & Record<KunciDinas, TR>;

function kunciDinas(l: BarisLaporan): KunciDinas | null {
  if (l.komoditas === "Jagung") return "jagung";
  if (l.komoditas === "Ubi Kayu") return "ubiKayu";
  const j = (l.jenis ?? "").toLowerCase().replace(/\s+/g, " ");
  if (j.includes("oplah") && j.includes("2026")) return "oplah2026";
  const k = kategoriDari("Padi", l.jenis);
  return k === "LTTReguler" ? "padiReguler" : k === "PadiGogo" ? "padiGogo" : null;
}

export function rekapDinas(kecs: Kec[], laporan: BarisLaporan[]): BarisDinas[] {
  const baru = (nama: string): BarisDinas => ({ kecamatan: nama, padiReguler: nol(), padiGogo: nol(), oplah2026: nol(), jagung: nol(), ubiKayu: nol() });
  const peta = new Map(kecs.map((k) => [k.id, baru(k.nama)]));
  for (const l of laporan) {
    const b = peta.get(l.kecamatanId);
    const k = kunciDinas(l);
    if (!b || !k) continue;
    b[k].tanam += l.tanam;
    b[k].panen += l.panen;
  }
  return [...peta.values()];
}

// ─── Laporan LTT Padi format Provinsi (hari ini + 1 s.d hari ini) ───────────────

/** Kolom realisasi tabel format Provinsi (khusus padi), berurutan. */
export const KOLOM_PROV = [
  { kunci: "reguler", label: "LTT Padi Reguler" },
  { kunci: "gogo", label: "LTT Padi Lahan Kering/Gogo" },
  { kunci: "oplah2026", label: "LTT Padi OPLAH 2026" },
  { kunci: "pmAasReguler", label: "LTT PM-AAS Reguler" },
  { kunci: "pmAasOplah", label: "LTT PM-AAS OPLAH" },
] as const;
export type KunciProv = (typeof KOLOM_PROV)[number]["kunci"];
type NilaiProv = Record<KunciProv, number>;
export type BarisProv = {
  kecamatan: string;
  target: number;
  hariIni: NilaiProv & { total: number };
  kumulatifPmAas: number;
  kumulatif: number;
  persen: number;
};

/**
 * Kategori laporan padi untuk tabel Provinsi. PM-AAS dipisah dulu (Reguler / Oplah tahun berapa pun);
 * selain itu Reguler, Gogo, Oplah 2026. Jenis lain (Oplah 2024/2025, CSR, Rehab) → null, tidak dihitung.
 */
function kunciProv(l: BarisLaporan): KunciProv | null {
  if (l.komoditas !== "Padi") return null;
  const j = (l.jenis ?? "").toLowerCase().replace(/\s+/g, " ");
  const oplah = j.includes("oplah");
  const kat = kategoriDari("Padi", l.jenis);
  if (l.metode === "PM AAS") {
    if (oplah) return "pmAasOplah";
    if (kat === "LTTReguler") return "pmAasReguler";
  }
  if (kat === "LTTReguler") return "reguler";
  if (kat === "PadiGogo") return "gogo";
  if (oplah && j.includes("2026")) return "oplah2026";
  return null;
}

/**
 * Tabel LTT Padi format Provinsi untuk bulan terpilih (WIB). Tanggal akhir = hari ini bila bulan berjalan,
 * atau tanggal terakhir bulan itu bila bulan lalu. Kolom realisasi = tanggal akhir saja,
 * total = tanggal 1 s.d tanggal akhir. Target = Target Provinsi padi per kecamatan bulan itu (diisi Admin Kab, `target_provinsi`).
 */
export async function rekapProvinsiPadi(s: Supa, tahun: number, bulan: number, kecs?: Kec[]) {
  const daftar = kecs ?? (await daftarKecamatan(s));
  const now = bulanTahunWIB();
  const bulanBerjalan = now.tahun === tahun && now.bulan === bulan;
  const hariTerakhir = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
  const akhir = bulanBerjalan ? tanggalIsoWIB() : `${tahun}-${String(bulan).padStart(2, "0")}-${String(hariTerakhir).padStart(2, "0")}`;
  const { dari, sampai } = rentangBulanWIB(tahun, bulan);
  const [lap, { data: tgt, error }] = await Promise.all([
    ambilLaporan(s, { dari, sampai, komoditas: "Padi" }, daftar),
    s.from("target_provinsi").select("kecamatan_id, target_tanam").eq("tahun", tahun).eq("bulan", bulan).eq("komoditas", "Padi"),
  ]);
  if (error) throw new Error(error.message);

  const kosong = (): NilaiProv => ({ reguler: 0, gogo: 0, oplah2026: 0, pmAasReguler: 0, pmAasOplah: 0 });
  const peta = new Map(daftar.map((k) => [k.id, { hari: kosong(), kum: kosong(), target: 0 }]));
  for (const t of tgt ?? []) {
    const p = peta.get(t.kecamatan_id);
    if (p) p.target += Number(t.target_tanam) || 0;
  }
  for (const l of lap) {
    const p = peta.get(l.kecamatanId);
    const k = kunciProv(l);
    if (!p || !k) continue;
    const tgl = tanggalIsoWIB(l.waktu);
    if (tgl > akhir) continue;
    p.kum[k] += l.tanam;
    if (tgl === akhir) p.hari[k] += l.tanam;
  }

  const jumlah = (n: NilaiProv) => KOLOM_PROV.reduce((a, c) => a + n[c.kunci], 0);
  const baris: BarisProv[] = daftar.map((k) => {
    const p = peta.get(k.id)!;
    const kumulatif = jumlah(p.kum);
    return {
      kecamatan: k.nama,
      target: p.target,
      hariIni: { ...p.hari, total: jumlah(p.hari) },
      kumulatifPmAas: p.kum.pmAasReguler + p.kum.pmAasOplah,
      kumulatif,
      persen: p.target > 0 ? (kumulatif / p.target) * 100 : 0,
    };
  });
  const tot = (f: (b: BarisProv) => number) => baris.reduce((a, b) => a + f(b), 0);
  const totalTarget = tot((b) => b.target);
  const totalKum = tot((b) => b.kumulatif);
  const total = {
    target: totalTarget,
    hariIni: { ...Object.fromEntries(KOLOM_PROV.map((c) => [c.kunci, tot((b) => b.hariIni[c.kunci])])), total: tot((b) => b.hariIni.total) } as NilaiProv & { total: number },
    kumulatifPmAas: tot((b) => b.kumulatifPmAas),
    kumulatif: totalKum,
    persen: totalTarget > 0 ? (totalKum / totalTarget) * 100 : 0,
  };
  return { akhir, bulanBerjalan, tahun, bulan, baris, total };
}

// ─── Rekap per kecamatan, rentang tanggal (logika-bisnis §12, §13) ─────────────

/**
 * Metode penanaman (kolom laporan_ltt.metode_penanaman). Daftar tetap: nilainya dipakai sinkron e-Pusluh,
 * validasi form, dan logika PM-AAS — jangan diganti tanpa migrasi data.
 */
export const METODE_PENANAMAN = [
  { kode: "Regular", label: "Reguler", keterangan: "Tanam biasa, di luar program PM-AAS." },
  { kode: "PM AAS", label: "PM-AAS", keterangan: "Tanam melalui program PM-AAS; dihitung di dashboard PM-AAS dan kolom PM-AAS format Provinsi." },
] as const;

/** Nama tampil metode; kosong → "Tidak diisi". */
export function labelMetode(kode: string | null | undefined): string {
  if (!kode) return "Tidak diisi";
  return METODE_PENANAMAN.find((m) => m.kode === kode)?.label ?? kode;
}

export type BarisRekapKec = { kecamatan: string; jenis: string; metode: string; tanam: number; panen: number };

/**
 * Padi: satu baris per (kecamatan, jenis, metode penanaman); kecamatan tanpa data → satu baris "-", 0, 0.
 * Palawija: satu baris per kecamatan (semua 15 kecamatan).
 */
export function rekapPerKecamatan(kecs: Kec[], laporan: BarisLaporan[], komoditas: Komoditas, jenis?: string | null) {
  const baris: BarisRekapKec[] = [];
  for (const k of kecs) {
    const milik = laporan.filter(
      (l) => l.kecamatanId === k.id && l.komoditas === komoditas && (!jenis || komoditas !== "Padi" || l.jenis === jenis),
    );
    if (komoditas === "Padi") {
      const per = new Map<string, TR & { jenis: string; metode: string }>();
      for (const l of milik) {
        const j = l.jenis ?? "LTT Reguler";
        const m = labelMetode(l.metode);
        const kunci = `${j}|${m}`;
        const t = per.get(kunci) ?? { jenis: j, metode: m, ...nol() };
        t.tanam += l.tanam;
        t.panen += l.panen;
        per.set(kunci, t);
      }
      if (per.size === 0) baris.push({ kecamatan: k.nama, jenis: "-", metode: "-", tanam: 0, panen: 0 });
      for (const t of [...per.values()].sort((a, b) => a.jenis.localeCompare(b.jenis) || a.metode.localeCompare(b.metode))) {
        baris.push({ kecamatan: k.nama, ...t });
      }
    } else {
      baris.push({
        kecamatan: k.nama,
        jenis: komoditas,
        metode: "-",
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

/** Total padi per jenis LTT (LTT Reguler, Padi Gogo, Oplah 2025, …) dari laporan mentah. */
export function padiPerJenis(laporan: BarisLaporan[]): { jenis: string; tanam: number; panen: number }[] {
  const m = new Map<string, TR>();
  for (const l of laporan) {
    if (l.komoditas !== "Padi") continue;
    const j = l.jenis ?? "LTT Reguler";
    const t = m.get(j) ?? nol();
    t.tanam += l.tanam;
    t.panen += l.panen;
    m.set(j, t);
  }
  return [...m].map(([jenis, t]) => ({ jenis, ...t }));
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
    s.from("target_desa").select("desa_id, komoditas, target_tanam, target_panen, luas_baku").eq("tahun", tahun).eq("bulan", bulan).in("desa_id", ids),
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

export async function ambilTargetDesa(s: Supa, desaIds: number[], f: { tahun: number; bulan?: number; komoditas?: Komoditas }): Promise<TargetDesaData[]> {
  if (desaIds.length === 0) return [];
  type R = {
    desa_id: number; bulan: number; komoditas: Komoditas; target_tanam: number; target_panen: number; luas_baku: number | null;
    rincian: { jenis_ltt_id: number; target_tanam: number; target_panen: number }[] | null;
  };
  const rows = await ambilSemua<R>((a, b) => {
    let q = s
      .from("target_desa")
      .select("desa_id, bulan, komoditas, target_tanam, target_panen, luas_baku, rincian:target_desa_rincian(jenis_ltt_id, target_tanam, target_panen)")
      .in("desa_id", desaIds)
      .eq("tahun", f.tahun);
    if (f.bulan) q = q.eq("bulan", f.bulan);
    if (f.komoditas) q = q.eq("komoditas", f.komoditas);
    return q.order("id").range(a, b) as unknown as PromiseLike<{ data: R[] | null; error: { message: string } | null }>;
  });
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

// ─── Daftar laporan berhalaman (Kab & BPP) — filter & halaman lewat URL, diproses di server ───

export const PER_HALAMAN = 50;

/** Periode "YYYY-MM" dari URL; default bulan berjalan WIB. Pilihan = 12 bulan terakhir. */
export function periodeDariParam(nilai: string | null, now: { tahun: number; bulan: number }) {
  const m = /^(\d{4})-(\d{2})$/.exec(nilai ?? "");
  const pilihan = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.tahun, now.bulan - 1 - i, 1));
    return { tahun: d.getUTCFullYear(), bulan: d.getUTCMonth() + 1 };
  });
  const cocok = m && pilihan.find((p) => p.tahun === Number(m[1]) && p.bulan === Number(m[2]));
  return { ...(cocok || pilihan[0]), pilihan };
}

export const kodePeriode = (p: { tahun: number; bulan: number }) => `${p.tahun}-${String(p.bulan).padStart(2, "0")}`;

export type FilterLaporan = {
  dari: string;
  sampai: string;
  komoditas?: Komoditas | null;
  metode?: string | null;
  /** batas wilayah (kecamatan/desa) — null = semua */
  desaIds?: number[] | null;
  /** kata cari: nama penyuluh, desa, atau kecamatan */
  cari?: string | null;
};

/**
 * Daftar laporan berhalaman + ringkasan (jumlah, total tanam/panen) untuk filter yang sama.
 * Semua penyaringan di database; browser hanya menerima satu halaman.
 */
export async function cariLaporan(
  s: Supa,
  f: FilterLaporan & { hal: number; per?: number },
  kecs: Kec[],
  semuaDesa: DesaRef[],
): Promise<{ baris: BarisLaporan[]; total: number; ringkas: { jumlah: number; tanam: number; panen: number } }> {
  const per = f.per ?? PER_HALAMAN;
  const kosong = { baris: [], total: 0, ringkas: { jumlah: 0, tanam: 0, panen: 0 } };
  if (f.desaIds && f.desaIds.length === 0) return kosong;

  // Kata cari → nama pelapor, desa/kecamatan, jenis LTT, metode, status e-Pusluh, atau keterangan yang cocok
  let orCari: string | null = null;
  if (f.cari) {
    const c = f.cari.toLowerCase();
    const kecCocok = new Set(kecs.filter((k) => k.nama.toLowerCase().includes(c)).map((k) => k.id));
    const desaCocok = semuaDesa.filter((d) => d.nama.toLowerCase().includes(c) || kecCocok.has(d.kecamatan_id)).map((d) => d.id);
    const aman = f.cari.replace(/[,()*%]/g, " ").trim();
    const { data: jenis } = await s.from("jenis_ltt").select("id").ilike("nama", `%${aman}%`);
    const jenisCocok = (jenis ?? []).map((j) => j.id as number);
    orCari = [
      `nama_pelapor.ilike.*${aman}*`,
      `keterangan.ilike.*${aman}*`,
      `metode_penanaman.ilike.*${aman}*`,
      `status_epusluh.ilike.*${aman}*`,
      desaCocok.length ? `desa_id.in.(${desaCocok.join(",")})` : null,
      jenisCocok.length ? `jenis_ltt_id.in.(${jenisCocok.join(",")})` : null,
      // Padi tanpa jenis ditampilkan sebagai "LTT Reguler" → ikut tercari dengan kata itu
      "ltt reguler".includes(c) ? "and(komoditas.eq.Padi,jenis_ltt_id.is.null)" : null,
    ].filter(Boolean).join(",");
  }
  type Saring = {
    gte(k: string, v: string): Saring; lt(k: string, v: string): Saring; is(k: string, v: null): Saring;
    eq(k: string, v: string): Saring; in(k: string, v: number[]): Saring; or(v: string): Saring;
  };
  /** Filter yang sama untuk query halaman & query ringkasan */
  const terapkan = <T,>(q: T): T => {
    let x = q as unknown as Saring;
    x = x.gte("tanggal_lapor", f.dari).lt("tanggal_lapor", f.sampai).is("dihapus_pada", null);
    if (f.komoditas) x = x.eq("komoditas", f.komoditas);
    if (f.metode) x = x.eq("metode_penanaman", f.metode);
    if (f.desaIds) x = x.in("desa_id", f.desaIds);
    if (orCari) x = x.or(orCari);
    return x as unknown as T;
  };

  const dari = (f.hal - 1) * per;
  const [{ data, error, count }, nilai] = await Promise.all([
    terapkan(
      s.from("laporan_ltt").select(
        "id, tanggal_lapor, nama_pelapor, desa_id, komoditas, luas_bera, realisasi_olah, realisasi_tanam, realisasi_panen, metode_penanaman, keterangan, status_epusluh, sumber, desa:desa_id(nama, kecamatan_id), jenis:jenis_ltt_id(nama)",
        { count: "exact" },
      ),
    )
      .order("tanggal_lapor", { ascending: false })
      .order("id")
      .range(dari, dari + per - 1),
    // Ringkasan seluruh hasil filter (hanya 2 kolom angka)
    ambilSemua<{ realisasi_tanam: number; realisasi_panen: number }>((a, b) =>
      terapkan(s.from("laporan_ltt").select("realisasi_tanam, realisasi_panen")).order("id").range(a, b) as unknown as PromiseLike<{
        data: { realisasi_tanam: number; realisasi_panen: number }[] | null;
        error: { message: string } | null;
      }>,
    ),
  ]);
  const ringkas = {
    jumlah: nilai.length,
    tanam: nilai.reduce((a, r) => a + (Number(r.realisasi_tanam) || 0), 0),
    panen: nilai.reduce((a, r) => a + (Number(r.realisasi_panen) || 0), 0),
  };
  // ?hal= melewati jumlah data (mis. URL lama / filter berubah): PostgREST menjawab 416 → tampilkan kosong
  if (error?.code === "PGRST103") return { baris: [], total: ringkas.jumlah, ringkas };
  if (error) throw new Error(error.message);

  const namaKec = new Map(kecs.map((k) => [k.id, k.nama]));
  const baris = (data ?? []).map((r) => {
    const d = r.desa as unknown as { nama: string; kecamatan_id: number } | null;
    const j = r.jenis as unknown as { nama: string } | null;
    return {
      id: r.id as number,
      waktu: r.tanggal_lapor as string,
      pelapor: (r.nama_pelapor as string | null) ?? (r.sumber === "epusluh" ? "e-Pusluh" : "-"),
      kecamatanId: d?.kecamatan_id ?? 0,
      kecamatan: namaKec.get(d?.kecamatan_id ?? 0) ?? "-",
      desaId: r.desa_id as number,
      desa: d?.nama ?? "-",
      komoditas: r.komoditas as Komoditas,
      jenis: r.komoditas === "Padi" ? (j?.nama ?? "LTT Reguler") : null,
      bera: Number(r.luas_bera) || 0,
      olah: Number(r.realisasi_olah) || 0,
      tanam: Number(r.realisasi_tanam) || 0,
      panen: Number(r.realisasi_panen) || 0,
      metode: r.metode_penanaman as string | null,
      keterangan: r.keterangan as string | null,
      status: r.komoditas === "Padi" ? (r.status_epusluh as string | null) : null,
      sumber: r.sumber as string,
    };
  });
  return { baris, total: count ?? ringkas.jumlah, ringkas };
}

/** Satu laporan (untuk form edit lewat ?edit=ID). RLS menentukan boleh terlihat atau tidak. */
export async function satuLaporan(s: Supa, id: number) {
  const { data } = await s
    .from("laporan_ltt")
    .select("id, desa_id, komoditas, jenis_ltt_id, luas_bera, realisasi_olah, realisasi_tanam, realisasi_panen, metode_penanaman, keterangan, status_epusluh, sumber, desa:desa_id(nama, kecamatan_id), jenis:jenis_ltt_id(nama)")
    .eq("id", id)
    .is("dihapus_pada", null)
    .maybeSingle();
  return data;
}

/**
 * Koreksi jenis LTT (khusus Padi). `null` = boleh disimpan, string = pesan galat.
 * Laporan harus Padi dan jenis harus jenis Padi — Jagung/Ubi Kayu tetap "LTT".
 */
export async function cekJenisPadi(s: Supa, laporanId: number, jenisId: number): Promise<string | null> {
  const [{ data: lap }, { data: jenis }] = await Promise.all([
    s.from("laporan_ltt").select("komoditas").eq("id", laporanId).maybeSingle(),
    s.from("jenis_ltt").select("id").eq("id", jenisId).eq("komoditas", "Padi").maybeSingle(),
  ]);
  if (!lap) return "Laporan tidak ditemukan.";
  if (lap.komoditas !== "Padi") return "Jenis LTT hanya bisa diubah untuk laporan Padi.";
  if (!jenis) return "Jenis LTT tidak valid.";
  return null;
}

// ─── Ringkasan dashboard (Kab & BPP) — dihitung di server, browser hanya menerima angka ───

export type TanamPanen = { tanam: number; panen: number };
export type RingkasanWilayah = {
  total: Record<Komoditas, TanamPanen>;
  pmAas: TanamPanen;
  target: Record<Komoditas, TanamPanen>;
  /** per kecamatan (Kab) atau per desa (BPP) */
  baris: { id: number; nama: string; tanam: Record<Komoditas, number>; panen: number; target: number; pmAas: TanamPanen }[];
  /** baris laporan mentah (server saja — jangan dikirim ke browser) */
  laporan: BarisLaporan[];
  kecs: Kec[];
};

const kosongTP = (): TanamPanen => ({ tanam: 0, panen: 0 });
const perKom = <T,>(f: () => T) => ({ Padi: f(), Jagung: f(), "Ubi Kayu": f() }) as Record<Komoditas, T>;

/**
 * Kab: baris = kecamatan, target = Target Provinsi per kecamatan (`target_provinsi`, diisi Admin Kab).
 * BPP: kecamatanId diisi → baris = desa di kecamatan itu, target = Target Provinsi kecamatannya.
 */
export async function ringkasanWilayah(s: Supa, tahun: number, bulan: number, kecamatanId?: number | null): Promise<RingkasanWilayah> {
  const kecs = await daftarKecamatan(s);
  const desa = kecamatanId ? await daftarDesa(s, kecamatanId) : null;
  const { dari, sampai } = rentangBulanWIB(tahun, bulan);
  let qt = s.from("target_provinsi").select("kecamatan_id, komoditas, target_tanam, target_panen").eq("tahun", tahun).eq("bulan", bulan);
  if (kecamatanId) qt = qt.eq("kecamatan_id", kecamatanId);
  const [lap, { data: tgt, error }] = await Promise.all([
    ambilLaporan(s, { dari, sampai, desaIds: desa ? desa.map((d) => d.id) : null }, kecs),
    qt,
  ]);
  if (error) throw new Error(error.message);

  const total = perKom(kosongTP);
  const target = perKom(kosongTP);
  const pmAas = kosongTP();
  const unit = desa ? desa.map((d) => ({ id: d.id, nama: d.nama })) : kecs;
  const baris = unit.map((u) => ({ id: u.id, nama: u.nama, tanam: perKom(() => 0), panen: 0, target: 0, pmAas: kosongTP() }));
  const idx = new Map(baris.map((b) => [b.id, b]));

  for (const t of tgt ?? []) {
    const k = t.komoditas as Komoditas;
    target[k].tanam += Number(t.target_tanam) || 0;
    target[k].panen += Number(t.target_panen) || 0;
    const b = !desa ? idx.get(t.kecamatan_id) : undefined;
    if (b) b.target += Number(t.target_tanam) || 0;
  }
  for (const l of lap) {
    total[l.komoditas].tanam += l.tanam;
    total[l.komoditas].panen += l.panen;
    const pm = l.komoditas === "Padi" && l.metode === "PM AAS";
    if (pm) {
      pmAas.tanam += l.tanam;
      pmAas.panen += l.panen;
    }
    const b = idx.get(desa ? l.desaId : l.kecamatanId);
    if (!b) continue;
    b.tanam[l.komoditas] += l.tanam;
    b.panen += l.panen;
    if (pm) {
      b.pmAas.tanam += l.tanam;
      b.pmAas.panen += l.panen;
    }
  }
  return { total, pmAas, target, baris, laporan: lap, kecs };
}

export type TargetPmAas = {
  /** Target kabupaten: jumlah target kecamatan, atau angka lama `target_pm_aas` bila belum ada rincian. */
  total: number;
  /** kecamatan_id → target tanam (Ha). Kosong bila bulan itu belum dirinci per kecamatan. */
  perKec: Map<number, number>;
};

/**
 * Target PM AAS (tahun, bulan). Rincian per kecamatan (migrasi 0014) diutamakan;
 * bila belum ada, pakai target kabupaten lama (0006). Tabel belum dibuat → 0.
 */
export async function ambilTargetPmAasRinci(s: Supa, tahun: number, bulan: number): Promise<TargetPmAas> {
  const [kec, kab] = await Promise.all([
    s.from("target_pm_aas_kecamatan").select("kecamatan_id, target_tanam").eq("tahun", tahun).eq("bulan", bulan),
    s.from("target_pm_aas").select("target_tanam").eq("tahun", tahun).eq("bulan", bulan).maybeSingle(),
  ]);
  const perKec = new Map<number, number>();
  for (const t of kec.error ? [] : (kec.data ?? [])) {
    const n = Number(t.target_tanam) || 0;
    if (n > 0) perKec.set(t.kecamatan_id, n);
  }
  const total = perKec.size > 0 ? [...perKec.values()].reduce((a, b) => a + b, 0) : kab.error ? 0 : Number(kab.data?.target_tanam) || 0;
  return { total, perKec };
}

/** Target PM AAS kabupaten (tahun, bulan) — lihat `ambilTargetPmAasRinci`. */
export async function ambilTargetPmAas(s: Supa, tahun: number, bulan: number): Promise<number> {
  return (await ambilTargetPmAasRinci(s, tahun, bulan)).total;
}
