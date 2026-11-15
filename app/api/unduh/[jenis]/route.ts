import type { NextRequest } from "next/server";
import { bacaPengguna, type Pengguna, type Role } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, NAMA_BULAN_PENDEK, bulanTahunWIB, formatTanggalJam, tanggalIsoWIB } from "@/lib/format";
import { bukuBaru, kepala, tabel, barisData, barisTotal, gayaHeader, rasio, kirimXlsx, HIJAU_TUA, type Kolom } from "@/lib/excel";
import {
  KATEGORI, KOLOM_SARANA, KOMODITAS,
  ambilLaporan, ambilProduktivitas, ambilSarana, daftarDesa, daftarKecamatan, desaBinaanSaya, desaRekapPpl,
  laporanBulan, rataPositif, realisasiKategoriPerKecamatan, rekapBulananPpl, rekapDinas, rekapHarianPpl,
  rekapPerKecamatan, targetKategoriPerKecamatan,
  type Kategori, type Komoditas, type Supa,
} from "@/lib/data";

/**
 * GET /api/unduh/<jenis>?... — semua tombol unduh Excel (plan §6b).
 * Data diambil dengan sesi user (RLS berlaku) lewat lib/data.ts yang sama dengan halaman.
 */

const HAK: Record<string, Role[]> = {
  "laporan": ["admin_bpp", "admin_kab"],
  "rekap-kecamatan": ["admin_kab"],
  "rekap-dinas": ["admin_kab", "viewer"],
  "target-realisasi": ["admin_kab", "viewer"],
  "rekap-ppl": ["penyuluh", "admin_bpp"],
  "produktivitas": ["penyuluh", "admin_bpp", "admin_kab"],
};

const teksErr = (pesan: string, status: number) =>
  new Response(pesan, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

const tglValid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const angka = (v: string | null, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : def;
};
const komValid = (v: string | null): Komoditas | null => (KOMODITAS as string[]).includes(v ?? "") ? (v as Komoditas) : null;

/** [dari, sampai] inklusif (YYYY-MM-DD) → rentang ISO [dari 00:00, sampai+1 00:00) WIB. */
function rentangTanggal(dari: string, sampai: string) {
  const akhir = new Date(`${sampai}T00:00:00+07:00`);
  akhir.setUTCDate(akhir.getUTCDate() + 1);
  return { dari: `${dari}T00:00:00+07:00`, sampai: `${tanggalIsoWIB(akhir)}T00:00:00+07:00` };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ jenis: string }> }) {
  const { jenis } = await ctx.params;
  const hak = HAK[jenis];
  if (!hak) return teksErr("Jenis unduhan tidak dikenal.", 404);

  const p = await bacaPengguna();
  if (!p) return teksErr("Silakan login terlebih dahulu.", 401);
  if (!hak.includes(p.role)) return teksErr("Anda tidak berhak mengunduh data ini.", 403);

  const q = req.nextUrl.searchParams;
  const s = await supabaseServer();
  try {
    switch (jenis) {
      case "laporan": return await unduhLaporan(s, p, q);
      case "rekap-kecamatan": return await unduhRekapKecamatan(s, q);
      case "rekap-dinas": return await unduhRekapDinas(s, q);
      case "target-realisasi": return await unduhTargetRealisasi(s, q);
      case "rekap-ppl": return await unduhRekapPpl(s, p, q);
      case "produktivitas": return await unduhProduktivitas(s, p, q);
    }
  } catch (e) {
    console.error("[unduh]", jenis, e);
    return teksErr("Gagal membuat file Excel. Coba lagi.", 500);
  }
  return teksErr("Jenis unduhan tidak dikenal.", 404);
}

// ─── Laporan LTT (Kab & BPP) — unduhExcelLaporan / unduhExcelLaporanBPP ─────────
async function unduhLaporan(s: Supa, p: Pengguna, q: URLSearchParams) {
  const hariIni = tanggalIsoWIB();
  const { tahun, bulan } = bulanTahunWIB();
  const dari = tglValid(q.get("dari")) ?? `${tahun}-${String(bulan).padStart(2, "0")}-01`;
  const sampai = tglValid(q.get("sampai")) ?? hariIni;
  const komoditas = komValid(q.get("komoditas"));

  const kecs = await daftarKecamatan(s);
  // BPP dikunci ke kecamatannya sendiri
  const kecId = p.role === "admin_bpp" ? p.kecamatanId : angka(q.get("kecamatan"), 1, 100000, 0) || null;
  if (p.role === "admin_bpp" && !kecId) return teksErr("Akun belum terikat ke kecamatan.", 400);
  const desaIds = kecId ? (await daftarDesa(s, kecId)).map((d) => d.id) : null;

  const data = await ambilLaporan(s, { ...rentangTanggal(dari, sampai), komoditas, desaIds }, kecs);
  const namaKec = kecId ? (kecs.find((k) => k.id === kecId)?.nama ?? "") : "Semua Kecamatan";

  const wb = bukuBaru();
  const ws = wb.addWorksheet("Laporan LTT", { views: [{ state: "frozen", ySplit: 5 }] });
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
  kepala(ws, kolom.length, `LAPORAN LTT ${komoditas?.toUpperCase() ?? "SEMUA KOMODITAS"} — ${namaKec.toUpperCase()}`, [
    `Periode: ${dari} s/d ${sampai}`,
  ]);
  const sum = (f: (l: (typeof data)[number]) => number) => data.reduce((a, l) => a + f(l), 0);
  tabel(
    ws,
    kolom,
    data.map((l, i) => [
      i + 1, formatTanggalJam(l.waktu), l.pelapor, l.kecamatan, l.desa, l.komoditas, l.jenis ?? "-",
      l.bera, l.olah, l.tanam, l.panen, l.metode ?? "-", l.keterangan ?? "",
    ]),
    { nilai: ["TOTAL", "", "", "", "", "", "", sum((l) => l.bera), sum((l) => l.olah), sum((l) => l.tanam), sum((l) => l.panen), "", ""], gabung: 7 },
  );
  return kirimXlsx(wb, ["Laporan", namaKec, komoditas ?? "", `${dari}_sd_${sampai}`]);
}

// ─── Rekap per kecamatan, rentang tanggal — unduhExcelKecamatan ───────────────
async function unduhRekapKecamatan(s: Supa, q: URLSearchParams) {
  const hariIni = tanggalIsoWIB();
  const dari = tglValid(q.get("dari")) ?? hariIni;
  const sampai = tglValid(q.get("sampai")) ?? dari;
  const komoditas = komValid(q.get("komoditas")) ?? "Padi";
  const jenis = komoditas === "Padi" ? q.get("jenisLtt") || null : null;
  const isPadi = komoditas === "Padi";

  const kecs = await daftarKecamatan(s);
  const lap = await ambilLaporan(s, { ...rentangTanggal(dari, sampai), komoditas }, kecs);
  const r = rekapPerKecamatan(kecs, lap, komoditas, jenis);
  const tglInfo = dari === sampai ? dari : `${dari} s/d ${sampai}`;

  const wb = bukuBaru();
  const ws = wb.addWorksheet("Rekap Kecamatan");
  const kolom: Kolom[] = isPadi
    ? [{ judul: "KECAMATAN", lebar: 25 }, { judul: "JENIS LTT", lebar: 20 }, { judul: "LUAS TANAM (HA)", lebar: 20, jenis: "angka" }, { judul: "LUAS PANEN (HA)", lebar: 20, jenis: "angka" }]
    : [{ judul: "KECAMATAN", lebar: 25 }, { judul: "LUAS TANAM (HA)", lebar: 20, jenis: "angka" }, { judul: "LUAS PANEN (HA)", lebar: 20, jenis: "angka" }];
  kepala(ws, kolom.length, `REKAPITULASI ${komoditas.toUpperCase()} PER KECAMATAN`, [
    isPadi ? `Tanggal Laporan: ${tglInfo} | Jenis LTT: ${jenis ?? "Semua"}` : `Tanggal Laporan: ${tglInfo}`,
  ]);
  tabel(
    ws,
    kolom,
    r.baris.map((b) => (isPadi ? [b.kecamatan, b.jenis, b.tanam, b.panen] : [b.kecamatan, b.tanam, b.panen])),
    { nilai: isPadi ? ["TOTAL KABUPATEN", "", r.totalTanam, r.totalPanen] : ["TOTAL KABUPATEN", r.totalTanam, r.totalPanen], gabung: isPadi ? 2 : 1 },
  );
  return kirimXlsx(wb, ["Rekap_Kecamatan", komoditas, jenis ?? "", dari === sampai ? dari : `${dari}_sd_${sampai}`]);
}

function bulanDariQuery(q: URLSearchParams) {
  const now = bulanTahunWIB();
  return { tahun: angka(q.get("tahun"), 2000, 2100, now.tahun), bulan: angka(q.get("bulan"), 1, 12, now.bulan) };
}

// ─── Rekap LTT format Dinas — unduhExcelRekapLTT ──────────────────────────────
async function unduhRekapDinas(s: Supa, q: URLSearchParams) {
  const { tahun, bulan } = bulanDariQuery(q);
  const kecs = await daftarKecamatan(s);
  const rows = rekapDinas(kecs, await laporanBulan(s, tahun, bulan, kecs));

  const wb = bukuBaru();
  const ws = wb.addWorksheet("Rekap LTT");
  const kolom: Kolom[] = [
    { judul: "NO", lebar: 5, jenis: "bulat" },
    { judul: "KECAMATAN", lebar: 22 },
    ...Array.from({ length: 10 }, () => ({ judul: "", lebar: 12, jenis: "angka" as const })),
  ];
  kepala(ws, 12, "LAPORAN REKAPITULASI LUAS TAMBAH TANAM (LTT)", [`Periode: ${NAMA_BULAN[bulan - 1]} ${tahun}`]);
  kolom.forEach((k, i) => (ws.getColumn(i + 1).width = k.lebar));
  const grup = ["PADI REGULER", "PADI GOGO", "JAGUNG", "KEDELAI", "UBI KAYU"];
  const h1 = ws.addRow(["NO", "KECAMATAN", ...grup.flatMap((g) => [g, ""])]);
  const h2 = ws.addRow(["", "", ...grup.flatMap(() => ["Tanam (Ha)", "Panen (Ha)"])]);
  ws.mergeCells(h1.number, 1, h2.number, 1);
  ws.mergeCells(h1.number, 2, h2.number, 2);
  grup.forEach((_, i) => ws.mergeCells(h1.number, 3 + i * 2, h1.number, 4 + i * 2));
  gayaHeader(h1);
  gayaHeader(h2);

  const nilai = (b: (typeof rows)[number]) => [b.padiReguler, b.padiGogo, b.jagung, b.kedelai, b.ubiKayu].flatMap((t) => [t.tanam, t.panen]);
  rows.forEach((b, i) => barisData(ws, kolom, [i + 1, b.kecamatan, ...nilai(b)]));
  const total = Array.from({ length: 10 }, (_, c) => rows.reduce((a, b) => a + nilai(b)[c], 0));
  barisTotal(ws, kolom, ["JUMLAH", "", ...total], 2);
  return kirimXlsx(wb, ["Rekap_LTT", `${NAMA_BULAN[bulan - 1]}_${tahun}`]);
}

// ─── Target vs realisasi per kecamatan — unduhExcelTargetVsRealisasi ─────────
async function unduhTargetRealisasi(s: Supa, q: URLSearchParams) {
  const { tahun, bulan } = bulanDariQuery(q);
  const kat = (KATEGORI.find((k) => k.kunci === q.get("kategori"))?.kunci ?? "LTTReguler") as Kategori;
  const sisi = q.get("sisi") === "panen" ? "panen" : "tanam";
  const label = KATEGORI.find((k) => k.kunci === kat)!.label;
  const komoditas = kat === "Jagung" ? "JAGUNG" : kat === "UbiKayu" ? "UBI KAYU" : "PADI";

  const kecs = await daftarKecamatan(s);
  const [target, lap] = await Promise.all([targetKategoriPerKecamatan(s, bulan), laporanBulan(s, tahun, bulan, kecs)]);
  const real = realisasiKategoriPerKecamatan(lap);

  const wb = bukuBaru();
  const ws = wb.addWorksheet("Target vs Realisasi");
  const kolom: Kolom[] = [
    { judul: "KECAMATAN", lebar: 25 },
    { judul: "TARGET (HA)", lebar: 18, jenis: "angka" },
    { judul: "REALISASI (HA)", lebar: 18, jenis: "angka" },
    { judul: "CAPAIAN (%)", lebar: 18, jenis: "persen" },
  ];
  kepala(ws, 4, "LAPORAN TARGET VS REALISASI PER KECAMATAN", [
    `Komoditas: ${komoditas} (${label}) | Tipe: ${sisi.toUpperCase()}`,
    `Periode: ${NAMA_BULAN[bulan - 1]} ${tahun}`,
  ]);
  const data = kecs.map((k) => {
    const t = target.get(k.id)?.[kat][sisi] ?? 0;
    const r = real.get(k.id)?.[kat][sisi] ?? 0;
    return [k.nama, t, r, rasio(r, t) ?? 0];
  });
  const tT = data.reduce((a, d) => a + (d[1] as number), 0);
  const tR = data.reduce((a, d) => a + (d[2] as number), 0);
  tabel(ws, kolom, data, { nilai: ["TOTAL KABUPATEN", tT, tR, rasio(tR, tT) ?? 0] });
  return kirimXlsx(wb, ["Target_VS_Realisasi", label, sisi, `${NAMA_BULAN[bulan - 1]}_${tahun}`]);
}

// ─── Rekap PPL bulanan / harian — downloadRekapExcel / _downloadRekapHarianExcel ─
async function unduhRekapPpl(s: Supa, p: Pengguna, q: URLSearchParams) {
  const desa = await desaRekapPpl(s, p);
  const wb = bukuBaru();

  if (q.get("mode") === "harian") {
    const tanggal = tglValid(q.get("tanggal")) ?? tanggalIsoWIB();
    const rows = await rekapHarianPpl(s, desa, tanggal);
    const ws = wb.addWorksheet("Rekap Harian");
    const kolom: Kolom[] = [
      { judul: "No", lebar: 5, jenis: "bulat" },
      { judul: "Desa", lebar: 26 },
      { judul: "Luas Tanam (Ha)", lebar: 16, jenis: "angka" },
      { judul: "Luas Panen (Ha)", lebar: 16, jenis: "angka" },
    ];
    kepala(ws, 4, `REKAP HARIAN LTT – ${p.nama}`, [`Tanggal Laporan: ${tanggal}`]);
    kolom.forEach((k, i) => (ws.getColumn(i + 1).width = k.lebar));
    for (const kom of KOMODITAS) {
      const isi = rows.filter((r) => r.komoditas === kom);
      const g = ws.addRow([`Komoditas: ${kom}`]);
      ws.mergeCells(g.number, 1, g.number, 4);
      g.getCell(1).font = { bold: true };
      gayaHeader(ws.addRow(kolom.map((k) => k.judul)), HIJAU_TUA);
      isi.forEach((r, i) => barisData(ws, kolom, [i + 1, r.desa, r.tanam, r.panen]));
      barisTotal(ws, kolom, ["JUMLAH", "", isi.reduce((a, r) => a + r.tanam, 0), isi.reduce((a, r) => a + r.panen, 0)], 2);
      ws.addRow([]);
    }
    return kirimXlsx(wb, ["Rekap_Harian", p.nama, tanggal]);
  }

  const { tahun, bulan } = bulanDariQuery(q);
  const rows = await rekapBulananPpl(s, desa, tahun, bulan);
  const ws = wb.addWorksheet("Rekap LTT");
  const kolom: Kolom[] = [
    { judul: "No", lebar: 5, jenis: "bulat" },
    { judul: "Kampung", lebar: 22 },
    { judul: "Komoditas", lebar: 11 },
    { judul: "LBS (Ha)", lebar: 10, jenis: "angka" },
    { judul: "Standing Crop", lebar: 11, jenis: "angka" },
    { judul: "Target Tanam", lebar: 12, jenis: "angka" },
    { judul: "Realisasi Tanam", lebar: 12, jenis: "angka" },
    { judul: "Capaian Tanam (%)", lebar: 12, jenis: "persen" },
    { judul: "Bera", lebar: 8 },
    { judul: "Target Panen", lebar: 12, jenis: "angka" },
    { judul: "Realisasi Panen", lebar: 12, jenis: "angka" },
    { judul: "Capaian Panen (%)", lebar: 12, jenis: "persen" },
  ];
  kepala(ws, 12, `REKAP LAPORAN LTT – ${p.nama}`, [`Periode: ${NAMA_BULAN[bulan - 1]} ${tahun}`]);
  kolom.forEach((k, i) => (ws.getColumn(i + 1).width = k.lebar));
  gayaHeader(ws.addRow(kolom.map((k) => k.judul)), HIJAU_TUA);
  let no = 0;
  for (const kom of KOMODITAS) {
    const isi = rows.filter((r) => r.komoditas === kom);
    for (const r of isi) {
      barisData(ws, kolom, [
        ++no, r.desa, kom, kom === "Padi" ? r.luasBaku : null, 0, r.targetTanam, r.realisasiTanam,
        rasio(r.realisasiTanam, r.targetTanam), "—", r.targetPanen, r.realisasiPanen, rasio(r.realisasiPanen, r.targetPanen),
      ]);
    }
    const s2 = (f: (r: (typeof isi)[number]) => number) => isi.reduce((a, r) => a + f(r), 0);
    barisTotal(ws, kolom, [
      `JUMLAH ${kom.toUpperCase()}`, "", "", kom === "Padi" ? s2((r) => r.luasBaku) : null, 0,
      s2((r) => r.targetTanam), s2((r) => r.realisasiTanam), rasio(s2((r) => r.realisasiTanam), s2((r) => r.targetTanam)),
      "—", s2((r) => r.targetPanen), s2((r) => r.realisasiPanen), rasio(s2((r) => r.realisasiPanen), s2((r) => r.targetPanen)),
    ], 3);
  }
  return kirimXlsx(wb, ["Rekap_LTT", p.nama, `${NAMA_BULAN[bulan - 1]}_${tahun}`]);
}

// ─── Produktivitas & sarana — _buatExcelProduktivitas ─────────────────────────
async function unduhProduktivitas(s: Supa, p: Pengguna, q: URLSearchParams) {
  const now = bulanTahunWIB().tahun;
  const tDari = angka(q.get("tahunDari"), 2000, 2100, now);
  const tSampai = Math.max(tDari, angka(q.get("tahunSampai"), 2000, 2100, tDari));
  if (tSampai - tDari > 10) return teksErr("Rentang tahun maksimal 10 tahun.", 400);

  const kecs = await daftarKecamatan(s);
  // Cakupan: penyuluh = desa binaan; BPP = kecamatannya; Kab = semua (logika-bisnis §20)
  let desa =
    p.role === "penyuluh" ? await desaBinaanSaya(s, p.id)
    : p.role === "admin_bpp" ? await daftarDesa(s, p.kecamatanId)
    : await daftarDesa(s);
  const kecParam = p.role === "admin_kab" ? angka(q.get("kecamatan"), 1, 100000, 0) : 0;
  if (kecParam) desa = desa.filter((d) => d.kecamatan_id === kecParam);
  const ids = desa.map((d) => d.id);

  const grup = kecs
    .map((k) => ({ ...k, desa: desa.filter((d) => d.kecamatan_id === k.id) }))
    .filter((k) => k.desa.length > 0);
  const wilayah = p.role === "penyuluh" ? p.nama : grup.length === 1 ? grup[0].nama : "Kabupaten";

  const wb = bukuBaru();
  const kolomBulan: Kolom[] = [
    { judul: "No", lebar: 5, jenis: "bulat" },
    { judul: "Kecamatan", lebar: 18 },
    { judul: "Desa", lebar: 22 },
    ...NAMA_BULAN_PENDEK.map((b) => ({ judul: b, lebar: 8, jenis: "angka" as const })),
  ];

  for (let tahun = tDari; tahun <= tSampai; tahun++) {
    const nilai = await ambilProduktivitas(s, tahun, ids);
    for (const kom of KOMODITAS) {
      const ws = wb.addWorksheet(`${kom} ${tahun}`, { views: [{ state: "frozen", xSplit: 3, ySplit: 5 }] });
      kepala(ws, kolomBulan.length, `PRODUKTIVITAS ${kom.toUpperCase()} (TON/HA) TAHUN ${tahun}`, [wilayah]);
      kolomBulan.forEach((k, i) => (ws.getColumn(i + 1).width = k.lebar));
      gayaHeader(ws.addRow(kolomBulan.map((k) => k.judul)), "FF15803D");
      const rataKec: number[][] = [];
      let no = 0;
      for (const k of grup) {
        const vals = k.desa.map((d) => nilai.get(`${d.id}|${kom}`) ?? new Array(12).fill(0));
        k.desa.forEach((d, i) => barisData(ws, kolomBulan, [++no, k.nama, d.nama, ...vals[i].map((v) => v || null)]));
        const rata = Array.from({ length: 12 }, (_, b) => rataPositif(vals.map((v) => v[b])));
        rataKec.push(rata);
        if (p.role !== "penyuluh") barisTotal(ws, kolomBulan, ["", `Rata-rata Kec. ${k.nama}`, "", ...rata]);
      }
      if (grup.length > 1) {
        const rataKab = Array.from({ length: 12 }, (_, b) => rataPositif(rataKec.map((r) => r[b])));
        barisTotal(ws, kolomBulan, ["", "Rata-rata Kabupaten", "", ...rataKab]);
      }
    }
  }

  // Sarana (tanpa tahun)
  const sarana = await ambilSarana(s, ids);
  const ws = wb.addWorksheet("Sarana Desa", { views: [{ state: "frozen", xSplit: 3, ySplit: 5 }] });
  const kolomS: Kolom[] = [
    { judul: "No", lebar: 5, jenis: "bulat" },
    { judul: "Kecamatan", lebar: 18 },
    { judul: "Desa", lebar: 22 },
    ...KOLOM_SARANA.map((k) => ({ judul: k.label, lebar: 14, jenis: "bulat" as const })),
    { judul: "Terakhir Update", lebar: 20 },
  ];
  kepala(ws, kolomS.length, "SARANA PASCAPANEN PER DESA", [wilayah]);
  kolomS.forEach((k, i) => (ws.getColumn(i + 1).width = k.lebar));
  gayaHeader(ws.addRow(kolomS.map((k) => k.judul)), "FF15803D");
  let no = 0;
  const totalKab = [0, 0, 0, 0];
  let terisiKab = 0;
  for (const k of grup) {
    const totalKec = [0, 0, 0, 0];
    let terisi = 0;
    for (const d of k.desa) {
      const sr = sarana.get(d.id);
      const v = KOLOM_SARANA.map((c) => (sr ? Number(sr[c.kunci]) || 0 : null));
      if (sr) {
        terisi++;
        v.forEach((x, i) => (totalKec[i] += x ?? 0));
      }
      barisData(ws, kolomS, [++no, k.nama, d.nama, ...v, sr ? formatTanggalJam(sr.updated_at) : "Belum diisi"]);
    }
    totalKec.forEach((x, i) => (totalKab[i] += x));
    terisiKab += terisi;
    barisTotal(ws, kolomS, ["", `Jumlah Kec. ${k.nama} (terisi ${terisi}/${k.desa.length} desa)`, "", ...totalKec, ""]);
  }
  if (grup.length > 1) {
    barisTotal(ws, kolomS, ["", `Total Kabupaten (terisi ${terisiKab}/${desa.length} desa)`, "", ...totalKab, ""]);
  }

  return kirimXlsx(wb, ["Produktivitas", wilayah, tDari === tSampai ? `${tDari}` : `${tDari}-${tSampai}`]);
}

