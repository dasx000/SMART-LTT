import "server-only";
import { NAMA_BULAN, formatTanggalJam, tanggalIsoWIB } from "@/lib/format";
import { headerKolom, type Blok, type Kolom, type Lembar, type Sel, type SpesifikasiExcel } from "@/lib/excel-spec";
import { KOLOM_DINAS, KOLOM_PROV, ambilLaporan, daftarDesa, daftarKecamatan, laporanBulan, rekapDinas, rekapProvinsiPadi, type Komoditas, type Supa } from "@/lib/data";

/**
 * Spesifikasi Excel yang dipakai bersama oleh tombol unduh (/api/unduh, sesi login) dan
 * API v1 (/api/v1/unduh, kunci API untuk bot). Satu sumber format → isi file selalu sama.
 * Pemeriksaan hak akses dilakukan pemanggil.
 */

/** [dari, sampai] inklusif (YYYY-MM-DD) → rentang ISO [dari 00:00, sampai+1 00:00) WIB. */
export function rentangTanggal(dari: string, sampai: string) {
  const akhir = new Date(`${sampai}T00:00:00+07:00`);
  akhir.setUTCDate(akhir.getUTCDate() + 1);
  return { dari: `${dari}T00:00:00+07:00`, sampai: `${tanggalIsoWIB(akhir)}T00:00:00+07:00` };
}

/** "2026-11-17" → "17 November 2026" */
export function tanggalPanjang(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${NAMA_BULAN[m - 1]} ${y}`;
}

/** Lembar tabel sederhana: header + data + (opsional) total. */
export function lembarTabel(
  nama: string, judul: string, info: string[], kolom: Kolom[], data: Sel[][],
  total?: { nilai: Sel[]; gabung?: number }, extra?: Partial<Lembar>,
): Lembar {
  const blok: Blok[] = [headerKolom(kolom), { t: "data", baris: data }];
  if (total) blok.push({ t: "total", ...total });
  return { nama, judul, info, kolom, blok, ...extra };
}

// ─── Laporan LTT (data mentah) ────────────────────────────────────────────────

/** kecId = id kecamatan di database (null = semua kecamatan). */
export async function specLaporan(
  s: Supa,
  f: { dari: string; sampai: string; komoditas: Komoditas | null; kecId: number | null },
): Promise<SpesifikasiExcel> {
  const { dari, sampai, komoditas, kecId } = f;
  const kecs = await daftarKecamatan(s);
  const desaIds = kecId ? (await daftarDesa(s, kecId)).map((d) => d.id) : null;

  const data = await ambilLaporan(s, { ...rentangTanggal(dari, sampai), komoditas, desaIds }, kecs);
  const namaKec = kecId ? (kecs.find((k) => k.id === kecId)?.nama ?? "") : "Semua Kecamatan";

  const kolom: Kolom[] = [
    { judul: "No", lebar: 5, jenis: "bulat" },
    { judul: "Tanggal Laporan", lebar: 20 },
    { judul: "Nama Penyuluh", lebar: 24 },
    { judul: "Kecamatan", lebar: 18 },
    { judul: "Desa", lebar: 18 },
    { judul: "Komoditas", lebar: 11 },
    { judul: "Jenis LTT", lebar: 16 },
    { judul: "Lahan Bera (Ha)", lebar: 12, jenis: "angka" },
    { judul: "Olah Lahan (Ha)", lebar: 12, jenis: "angka" },
    { judul: "Luas Tanam (Ha)", lebar: 12, jenis: "angka" },
    { judul: "Luas Panen (Ha)", lebar: 12, jenis: "angka" },
    { judul: "Metode Penanaman", lebar: 14 },
    { judul: "Keterangan", lebar: 28 },
  ];
  const sum = (fn: (l: (typeof data)[number]) => number) => data.reduce((a, l) => a + fn(l), 0);
  return {
    namaFile: ["Laporan", namaKec, komoditas ?? "", `${dari}_sd_${sampai}`],
    lembar: [
      lembarTabel(
        "Laporan LTT",
        `LAPORAN LTT ${komoditas?.toUpperCase() ?? "SEMUA KOMODITAS"} — ${namaKec.toUpperCase()}`,
        [`Periode: ${dari} s/d ${sampai}`],
        kolom,
        data.map((l, i) => [
          i + 1, formatTanggalJam(l.waktu), l.pelapor, l.kecamatan, l.desa, l.komoditas, l.jenis ?? "-",
          l.bera, l.olah, l.tanam, l.panen, l.metode ?? "-", l.keterangan ?? "",
        ]),
        { nilai: ["TOTAL", "", "", "", "", "", "", sum((l) => l.bera), sum((l) => l.olah), sum((l) => l.tanam), sum((l) => l.panen), "", ""], gabung: 7 },
        { beku: { y: 5 } },
      ),
    ],
  };
}

// ─── Rekap LTT format Dinas ───────────────────────────────────────────────────

/** Periode: satu bulan ({ tahun, bulan }) atau satu hari ({ tanggal: "YYYY-MM-DD" }). */
export type PeriodeDinas = { tahun: number; bulan: number } | { tanggal: string };

export async function specRekapDinas(s: Supa, periode: PeriodeDinas): Promise<SpesifikasiExcel> {
  const kecs = await daftarKecamatan(s);
  const harian = "tanggal" in periode;
  const laporan = harian
    ? await ambilLaporan(s, rentangTanggal(periode.tanggal, periode.tanggal), kecs)
    : await laporanBulan(s, periode.tahun, periode.bulan, kecs);
  const rows = rekapDinas(kecs, laporan);
  const nG = KOLOM_DINAS.length;
  const labelPeriode = harian ? tanggalPanjang(periode.tanggal) : `${NAMA_BULAN[periode.bulan - 1]} ${periode.tahun}`;

  const kolom: Kolom[] = [
    { judul: "NO", lebar: 5, jenis: "bulat" },
    { judul: "KECAMATAN", lebar: 22 },
    ...Array.from({ length: nG * 2 }, () => ({ judul: "", lebar: 12, jenis: "angka" as const })),
  ];
  const grup = KOLOM_DINAS.map((g) => g.label.toUpperCase());
  const nilai = (b: (typeof rows)[number]) => KOLOM_DINAS.flatMap(({ kunci }) => [b[kunci].tanam, b[kunci].panen]);
  const total = Array.from({ length: nG * 2 }, (_, c) => rows.reduce((a, b) => a + nilai(b)[c], 0));
  /** Sel data bernilai 0 diberi latar merah muda (sama dengan rekap bot lama) supaya kecamatan yang belum ada realisasinya menonjol. */
  const NOL_BG = "FFFF9E9E";
  const sel = (x: number): Sel => (x ? x : { v: 0, bg: NOL_BG });

  return {
    namaFile: ["Rekap_LTT", harian ? periode.tanggal : `${NAMA_BULAN[periode.bulan - 1]}_${periode.tahun}`],
    judulFile: harian ? `Rekap LTT Harian - ${labelPeriode}` : `Rekap LTT - ${labelPeriode}`,
    lembar: [{
      nama: "Rekap LTT",
      judul: "LAPORAN REKAPITULASI LUAS TAMBAH TANAM (LTT)",
      info: [harian ? `Tanggal Laporan: ${labelPeriode}` : `Periode: ${labelPeriode}`],
      kolom,
      blok: [
        {
          t: "header",
          baris: [
            ["NO", "KECAMATAN", ...grup.flatMap((g) => [g, ""])],
            ["", "", ...grup.flatMap(() => ["Tanam (Ha)", "Panen (Ha)"])],
          ],
          gabung: [[1, 1, 2, 1], [1, 2, 2, 2], ...grup.map((_, i) => [1, 3 + i * 2, 1, 4 + i * 2] as [number, number, number, number])],
        },
        { t: "data", baris: rows.map((b, i) => [i + 1, b.kecamatan, ...nilai(b).map(sel)]) },
        { t: "total", nilai: ["JUMLAH", "", ...total], gabung: 2 },
      ],
    }],
  };
}

// ─── LTT Padi format Provinsi (hari ini + 1 s.d hari ini) ─────────────────────
/** Warna persentase (sama dengan dashboard): <60 merah, 60–84 kuning, ≥85 hijau. */
const PERSEN_MERAH = { bg: "FFEF4444", fc: "FFFFFFFF" };
const PERSEN_KUNING = { bg: "FFFDE047", fc: "FF713F12" };
const PERSEN_HIJAU = { bg: "FF16A34A", fc: "FFFFFFFF" };
const WARNA_PERSEN = (p: number) => (p >= 85 ? PERSEN_HIJAU : p >= 60 ? PERSEN_KUNING : PERSEN_MERAH);

/** Bulan berjalan → realisasi hari ini + kumulatif 1 s.d hari ini. Bulan lalu → s.d tanggal terakhir bulan itu. */
export async function specLttProvinsi(s: Supa, { tahun, bulan }: { tahun: number; bulan: number }): Promise<SpesifikasiExcel> {
  const d = await rekapProvinsiPadi(s, tahun, bulan);
  const tgl = Number(d.akhir.slice(8, 10));
  const bln = NAMA_BULAN[d.bulan - 1];
  const hariIniTeks = `${tgl} ${bln} ${d.tahun}`;
  const sd = `1 s.d ${hariIniTeks}`;
  const nK = KOLOM_PROV.length;

  // Warna = kelas Tailwind yang dipakai tabel di dashboard (components/tabel-ltt-provinsi.tsx).
  const W = {
    abu: { bg: "FFF9FAFB", fc: "FF4B5563" }, // gray-50 / gray-600 — No, Kecamatan, Target
    biruGrup: { bg: "FFDBEAFE", fc: "FF1E3A8A" }, // blue-100 / blue-900 — judul grup Realisasi
    biru: { bg: "FFEFF6FF", fc: "FF1E3A8A" }, // blue-50 — sub-kolom Realisasi
    ungu: { bg: "FFEDE9FE", fc: "FF4C1D95" }, // violet-100 — Total PM-AAS 1 s.d
    oranye: { bg: "FFFFEDD5", fc: "FF7C2D12" }, // orange-100 — Total LTT 1 s.d & Persentase (terkait)
    jumlah: { bg: "FFFEFCE8", fc: "FF854D0E" }, // yellow-50 / yellow-800 — baris JUMLAH
  };
  const ISI = { biru: "FFF7FAFF", ungu: "FFFAF8FF", oranye: "FFFFFBF5" }; // latar isi kolom (…-50 tipis)
  const NOL = "FFD1D5DB"; // gray-300 — angka 0 samar
  const TEKS = "FF1F2937"; // gray-800

  const kolom: Kolom[] = [
    { judul: "", lebar: 5, jenis: "bulat", rata: "center" },
    { judul: "", lebar: 22 },
    { judul: "", lebar: 16, jenis: "angka" },
    ...KOLOM_PROV.map(() => ({ judul: "", lebar: 13, jenis: "angka" as const })),
    { judul: "", lebar: 11, jenis: "angka" },
    { judul: "", lebar: 16, jenis: "angka" },
    { judul: "", lebar: 16, jenis: "angka" },
    { judul: "", lebar: 16, jenis: "angka" },
  ];
  const h = (v: string, w: { bg: string; fc: string }): Sel => ({ v: v.toUpperCase(), ...w });
  /** angka; 0 → abu-abu samar. `bg` = latar kolom, `tebal` = semibold di web. */
  const n = (x: number, bg?: string, tebal = false): Sel => (x ? { v: x, bg, fc: TEKS, tebal } : { v: 0, bg, fc: NOL });
  const persen = (p: number, ada: boolean): Sel =>
    ada ? { v: Math.round(p * 100) / 100, ...WARNA_PERSEN(p), tebal: true } : { v: "-", bg: W.abu.bg, fc: "FF9CA3AF" };
  const j = (x: number): Sel => (x ? { v: x, ...W.jumlah } : { v: 0, bg: W.jumlah.bg, fc: NOL });
  const cR = 4; // kolom pertama realisasi
  const cA = cR + nK + 1; // kolom setelah "Total LTT" harian

  return {
    namaFile: ["LTT_Padi_Provinsi", d.akhir],
    judulFile: `Realisasi LTT Padi 1 sd ${hariIniTeks}`,
    lembar: [{
      nama: "LTT Padi",
      judul: "LAPORAN LTT PADI (FORMAT PROVINSI)",
      info: [`Realisasi ${d.bulanBerjalan ? "hari ini" : "tanggal terakhir"} (${hariIniTeks}) dan kumulatif ${sd}`],
      kolom,
      beku: { x: 2, y: 7 },
      garis: "FFE5E7EB", // gray-200
      tanpaZebra: true,
      blok: [
        {
          t: "header",
          baris: [
            [
              h("No", W.abu), h("Kecamatan", W.abu), h(`Target LTT Bulan ${bln} ${d.tahun}`, W.abu),
              h(`Realisasi LTT ${hariIniTeks}`, W.biruGrup), ...Array.from({ length: nK }, () => h("", W.biruGrup)),
              h(`Total LTT PM-AAS ${sd}`, W.ungu), h(`Total LTT ${sd}`, W.oranye), h(`Persentase Total LTT ${sd}`, W.oranye),
            ],
            [
              h("", W.abu), h("", W.abu), h("", W.abu),
              ...KOLOM_PROV.map((k) => h(k.label, W.biru)), h("Total LTT", W.biru),
              h("", W.ungu), h("", W.oranye), h("", W.oranye),
            ],
          ],
          gabung: [
            [1, 1, 2, 1], [1, 2, 2, 2], [1, 3, 2, 3],
            [1, cR, 1, cR + nK],
            [1, cA, 2, cA], [1, cA + 1, 2, cA + 1], [1, cA + 2, 2, cA + 2],
          ],
        },
        {
          t: "total",
          gabung: 2,
          nilai: [
            { v: "JUMLAH", ...W.jumlah }, { v: "", ...W.jumlah }, j(d.total.target),
            ...KOLOM_PROV.map((k) => j(d.total.hariIni[k.kunci])), j(d.total.hariIni.total),
            j(d.total.kumulatifPmAas), j(d.total.kumulatif), persen(d.total.persen, d.total.target > 0),
          ],
        },
        {
          t: "data",
          baris: d.baris.map((b, i) => [
            { v: i + 1, fc: "FF6B7280" },
            { v: b.kecamatan, fc: "FF374151", tebal: true },
            b.target > 0 ? { v: b.target, fc: TEKS } : { v: "-", fc: "FF9CA3AF" },
            ...KOLOM_PROV.map((k) => n(b.hariIni[k.kunci])),
            n(b.hariIni.total, ISI.biru, true),
            n(b.kumulatifPmAas, ISI.ungu),
            n(b.kumulatif, ISI.oranye, true),
            persen(b.persen, b.target > 0),
          ]),
        },
        { t: "kosong" },
        { t: "catatan", teks: "Keterangan", fc: "FF374151" },
        { t: "catatan", teks: "< 60% — Rendah", ...PERSEN_MERAH },
        { t: "catatan", teks: "60% – 84,99% — Sedang", ...PERSEN_KUNING },
        { t: "catatan", teks: "≥ 85% — Baik / tercapai", ...PERSEN_HIJAU },
        { t: "catatan", teks: "-  Target belum diisi", bg: W.abu.bg, fc: "FF9CA3AF" },
        { t: "catatan", teks: `• Kolom Realisasi LTT ${hariIniTeks} hanya berisi laporan tanggal ${hariIniTeks}${d.bulanBerjalan ? " (hari ini)" : " (tanggal terakhir bulan ini)"}.` },
        { t: "catatan", teks: `• Total LTT PM-AAS dan Total LTT = akumulasi tanggal ${sd}.` },
        { t: "catatan", teks: `• Persentase = Total LTT ${sd} ÷ Target LTT bulan ${bln} × 100%.` },
        { t: "catatan", teks: "• Hanya jenis yang tampil di tabel yang dihitung; Oplah 2024/2025 (non PM-AAS), CSR, dan Rehab Bencana tidak dihitung." },
        { t: "catatan", teks: "• Angka 0 ditulis samar agar data yang berisi lebih mudah terlihat." },
      ],
    }],
  };
}
