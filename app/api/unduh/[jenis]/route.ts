import type { NextRequest } from "next/server";
import { bacaPengguna, type Pengguna, type Role } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, NAMA_BULAN_PENDEK, bulanTahunWIB, formatTanggalJam, tanggalIsoWIB } from "@/lib/format";
import { HIJAU_TUA, headerKolom, rasio, type Blok, type Kolom, type Lembar, type Sel, type SpesifikasiExcel } from "@/lib/excel-spec";
import {
  KOLOM_SARANA, KOMODITAS,
  ambilLaporan, ambilProduktivitas, ambilSarana, daftarDesa, daftarKecamatan, desaBinaanSaya, desaRekapPpl,
  rataPositif, rekapBulananPpl, rekapHarianPpl,
  rekapPerKecamatan,
  type Komoditas, type Supa,
} from "@/lib/data";
import { lembarTabel, rentangTanggal, specLaporan, specLttProvinsi, specRekapDinas } from "@/lib/unduh";

/**
 * GET /api/unduh/<jenis>?... — data untuk semua tombol unduh Excel.
 * Mengembalikan SpesifikasiExcel (JSON); file .xlsx dirakit di BROWSER (components/tombol-unduh.tsx)
 * supaya server tidak terbebani ExcelJS. Data diambil dengan sesi user (RLS berlaku).
 */

const HAK: Record<string, Role[]> = {
  "laporan": ["admin_bpp", "admin_kab"],
  "rekap-kecamatan": ["admin_kab", "viewer"],
  "rekap-dinas": ["admin_kab", "viewer"],
  "ltt-provinsi": ["admin_kab", "viewer"],
  "rekap-ppl": ["penyuluh", "admin_bpp"],
  "produktivitas": ["penyuluh", "admin_bpp", "admin_kab"],
};

const teksErr = (pesan: string, status: number) =>
  new Response(pesan, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
const kirim = (spec: SpesifikasiExcel) => Response.json(spec, { headers: { "Cache-Control": "private, no-store" } });

const tglValid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const angka = (v: string | null, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : def;
};
const komValid = (v: string | null): Komoditas | null => (KOMODITAS as string[]).includes(v ?? "") ? (v as Komoditas) : null;

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
      case "ltt-provinsi": return await unduhLttProvinsi(s, q);
      case "rekap-ppl": return await unduhRekapPpl(s, p, q);
      case "produktivitas": return await unduhProduktivitas(s, p, q);
    }
  } catch (e) {
    console.error("[unduh]", jenis, e);
    return teksErr("Gagal menyiapkan data Excel. Coba lagi.", 500);
  }
  return teksErr("Jenis unduhan tidak dikenal.", 404);
}

// ─── Laporan LTT (Kab & BPP) ──────────────────────────────────────────────────
async function unduhLaporan(s: Supa, p: Pengguna, q: URLSearchParams) {
  const { tahun, bulan } = bulanTahunWIB();
  const dari = tglValid(q.get("dari")) ?? `${tahun}-${String(bulan).padStart(2, "0")}-01`;
  const sampai = tglValid(q.get("sampai")) ?? tanggalIsoWIB();
  // BPP dikunci ke kecamatannya sendiri
  const kecId = p.role === "admin_bpp" ? p.kecamatanId : angka(q.get("kecamatan"), 1, 100000, 0) || null;
  if (p.role === "admin_bpp" && !kecId) return teksErr("Akun belum terikat ke kecamatan.", 400);
  return kirim(await specLaporan(s, { dari, sampai, komoditas: komValid(q.get("komoditas")), kecId }));
}

// ─── Rekap per kecamatan, rentang tanggal ─────────────────────────────────────
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

  const kolom: Kolom[] = isPadi
    ? [
        { judul: "KECAMATAN", lebar: 25 }, { judul: "JENIS LTT", lebar: 20 }, { judul: "METODE PENANAMAN", lebar: 18 },
        { judul: "LUAS TANAM (HA)", lebar: 20, jenis: "angka" }, { judul: "LUAS PANEN (HA)", lebar: 20, jenis: "angka" },
      ]
    : [{ judul: "KECAMATAN", lebar: 25 }, { judul: "LUAS TANAM (HA)", lebar: 20, jenis: "angka" }, { judul: "LUAS PANEN (HA)", lebar: 20, jenis: "angka" }];
  return kirim({
    namaFile: ["Rekap_Kecamatan", komoditas, jenis ?? "", dari === sampai ? dari : `${dari}_sd_${sampai}`],
    lembar: [
      lembarTabel(
        "Rekap Kecamatan",
        `REKAPITULASI ${komoditas.toUpperCase()} PER KECAMATAN`,
        [isPadi ? `Tanggal Laporan: ${tglInfo} | Jenis LTT: ${jenis ?? "Semua"}` : `Tanggal Laporan: ${tglInfo}`],
        kolom,
        r.baris.map((b) => (isPadi ? [b.kecamatan, b.jenis, b.metode, b.tanam, b.panen] : [b.kecamatan, b.tanam, b.panen])),
        { nilai: isPadi ? ["TOTAL KABUPATEN", "", "", r.totalTanam, r.totalPanen] : ["TOTAL KABUPATEN", r.totalTanam, r.totalPanen], gabung: isPadi ? 3 : 1 },
      ),
    ],
  });
}

function bulanDariQuery(q: URLSearchParams) {
  const now = bulanTahunWIB();
  return { tahun: angka(q.get("tahun"), 2000, 2100, now.tahun), bulan: angka(q.get("bulan"), 1, 12, now.bulan) };
}

// ─── Rekap LTT format Dinas ───────────────────────────────────────────────────
async function unduhRekapDinas(s: Supa, q: URLSearchParams) {
  // ?tanggal=YYYY-MM-DD → rekap satu hari; tanpa tanggal → per bulan (tahun, bulan)
  const tanggal = tglValid(q.get("tanggal"));
  return kirim(await specRekapDinas(s, tanggal ? { tanggal } : bulanDariQuery(q)));
}

// ─── LTT Padi format Provinsi (hari ini + 1 s.d hari ini) ─────────────────────
async function unduhLttProvinsi(s: Supa, q: URLSearchParams) {
  return kirim(await specLttProvinsi(s, bulanDariQuery(q)));
}

// ─── Rekap PPL bulanan / harian ───────────────────────────────────────────────
async function unduhRekapPpl(s: Supa, p: Pengguna, q: URLSearchParams) {
  const desa = await desaRekapPpl(s, p);

  if (q.get("mode") === "harian") {
    const tanggal = tglValid(q.get("tanggal")) ?? tanggalIsoWIB();
    const rows = await rekapHarianPpl(s, desa, tanggal);
    const kolom: Kolom[] = [
      { judul: "No", lebar: 5, jenis: "bulat" },
      { judul: "Desa", lebar: 26 },
      { judul: "Luas Tanam (Ha)", lebar: 16, jenis: "angka" },
      { judul: "Luas Panen (Ha)", lebar: 16, jenis: "angka" },
    ];
    const blok: Blok[] = [];
    for (const kom of KOMODITAS) {
      const isi = rows.filter((r) => r.komoditas === kom);
      blok.push(
        { t: "grup", teks: `Komoditas: ${kom}` },
        headerKolom(kolom, HIJAU_TUA),
        { t: "data", baris: isi.map((r, i) => [i + 1, r.desa, r.tanam, r.panen]) },
        { t: "total", nilai: ["JUMLAH", "", isi.reduce((a, r) => a + r.tanam, 0), isi.reduce((a, r) => a + r.panen, 0)], gabung: 2 },
        { t: "kosong" },
      );
    }
    return kirim({
      namaFile: ["Rekap_Harian", p.nama, tanggal],
      lembar: [{ nama: "Rekap Harian", judul: `REKAP HARIAN LTT – ${p.nama}`, info: [`Tanggal Laporan: ${tanggal}`], kolom, blok }],
    });
  }

  const { tahun, bulan } = bulanDariQuery(q);
  const rows = await rekapBulananPpl(s, desa, tahun, bulan);
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
  const blok: Blok[] = [headerKolom(kolom, HIJAU_TUA)];
  let no = 0;
  for (const kom of KOMODITAS) {
    const isi = rows.filter((r) => r.komoditas === kom);
    blok.push({
      t: "data",
      baris: isi.map((r) => [
        ++no, r.desa, kom, kom === "Padi" ? r.luasBaku : null, 0, r.targetTanam, r.realisasiTanam,
        rasio(r.realisasiTanam, r.targetTanam), "—", r.targetPanen, r.realisasiPanen, rasio(r.realisasiPanen, r.targetPanen),
      ]),
    });
    const s2 = (f: (r: (typeof isi)[number]) => number) => isi.reduce((a, r) => a + f(r), 0);
    blok.push({
      t: "total",
      gabung: 3,
      nilai: [
        `JUMLAH ${kom.toUpperCase()}`, "", "", kom === "Padi" ? s2((r) => r.luasBaku) : null, 0,
        s2((r) => r.targetTanam), s2((r) => r.realisasiTanam), rasio(s2((r) => r.realisasiTanam), s2((r) => r.targetTanam)),
        "—", s2((r) => r.targetPanen), s2((r) => r.realisasiPanen), rasio(s2((r) => r.realisasiPanen), s2((r) => r.targetPanen)),
      ],
    });
  }
  return kirim({
    namaFile: ["Rekap_LTT", p.nama, `${NAMA_BULAN[bulan - 1]}_${tahun}`],
    lembar: [{ nama: "Rekap LTT", judul: `REKAP LAPORAN LTT – ${p.nama}`, info: [`Periode: ${NAMA_BULAN[bulan - 1]} ${tahun}`], kolom, blok }],
  });
}

// ─── Produktivitas & sarana ───────────────────────────────────────────────────
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

  const kolomBulan: Kolom[] = [
    { judul: "No", lebar: 5, jenis: "bulat" },
    { judul: "Kecamatan", lebar: 18 },
    { judul: "Desa", lebar: 22 },
    ...NAMA_BULAN_PENDEK.map((b) => ({ judul: b, lebar: 8, jenis: "angka" as const })),
  ];
  const lembar: Lembar[] = [];

  const tahunList = Array.from({ length: tSampai - tDari + 1 }, (_, i) => tDari + i);
  const nilaiTahun = await Promise.all(tahunList.map((t) => ambilProduktivitas(s, t, ids)));
  tahunList.forEach((tahun, ti) => {
    const nilai = nilaiTahun[ti];
    for (const kom of KOMODITAS) {
      const blok: Blok[] = [headerKolom(kolomBulan, "FF15803D")];
      const rataKec: number[][] = [];
      let no = 0;
      for (const k of grup) {
        const vals = k.desa.map((d) => nilai.get(`${d.id}|${kom}`) ?? new Array(12).fill(0));
        blok.push({ t: "data", baris: k.desa.map((d, i) => [++no, k.nama, d.nama, ...vals[i].map((v) => v || null)]) });
        const rata = Array.from({ length: 12 }, (_, b) => rataPositif(vals.map((v) => v[b])));
        rataKec.push(rata);
        if (p.role !== "penyuluh") blok.push({ t: "total", nilai: ["", `Rata-rata Kec. ${k.nama}`, "", ...rata] });
      }
      if (grup.length > 1) {
        const rataKab = Array.from({ length: 12 }, (_, b) => rataPositif(rataKec.map((r) => r[b])));
        blok.push({ t: "total", nilai: ["", "Rata-rata Kabupaten", "", ...rataKab] });
      }
      lembar.push({
        nama: `${kom} ${tahun}`,
        judul: `PRODUKTIVITAS ${kom.toUpperCase()} (TON/HA) TAHUN ${tahun}`,
        info: [wilayah],
        kolom: kolomBulan,
        beku: { x: 3, y: 5 },
        blok,
      });
    }
  });

  // Sarana (tanpa tahun)
  const sarana = await ambilSarana(s, ids);
  const kolomS: Kolom[] = [
    { judul: "No", lebar: 5, jenis: "bulat" },
    { judul: "Kecamatan", lebar: 18 },
    { judul: "Desa", lebar: 22 },
    ...KOLOM_SARANA.map((k) => ({ judul: k.label, lebar: 14, jenis: "bulat" as const })),
    { judul: "Terakhir Update", lebar: 20 },
  ];
  const blokS: Blok[] = [headerKolom(kolomS, "FF15803D")];
  let no = 0;
  const totalKab = KOLOM_SARANA.map(() => 0);
  let terisiKab = 0;
  for (const k of grup) {
    const totalKec = KOLOM_SARANA.map(() => 0);
    let terisi = 0;
    const baris: Sel[][] = [];
    for (const d of k.desa) {
      const sr = sarana.get(d.id);
      const v = KOLOM_SARANA.map((c) => (sr ? Number(sr[c.kunci]) || 0 : null));
      if (sr) {
        terisi++;
        v.forEach((x, i) => (totalKec[i] += x ?? 0));
      }
      baris.push([++no, k.nama, d.nama, ...v, sr ? formatTanggalJam(sr.updated_at) : "Belum diisi"]);
    }
    totalKec.forEach((x, i) => (totalKab[i] += x));
    terisiKab += terisi;
    blokS.push({ t: "data", baris }, { t: "total", nilai: ["", `Jumlah Kec. ${k.nama} (terisi ${terisi}/${k.desa.length} desa)`, "", ...totalKec, ""] });
  }
  if (grup.length > 1) {
    blokS.push({ t: "total", nilai: ["", `Total Kabupaten (terisi ${terisiKab}/${desa.length} desa)`, "", ...totalKab, ""] });
  }
  lembar.push({ nama: "Sarana Desa", judul: "SARANA PASCAPANEN PER DESA", info: [wilayah], kolom: kolomS, beku: { x: 3, y: 5 }, blok: blokS });

  return kirim({ namaFile: ["Produktivitas", wilayah, tDari === tSampai ? `${tDari}` : `${tDari}-${tSampai}`], lembar });
}
