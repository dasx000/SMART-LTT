import "server-only";
import { NAMA_BULAN } from "@/lib/format";
import type { Blok, Kolom, Sel, SpesifikasiExcel } from "@/lib/excel-spec";
import { daftarDesa, daftarKecamatan, semuaJenisPadi, type Komoditas, type Supa } from "@/lib/data";
import { barisTargetDesa } from "./data";

const MERAH = "FFB91C1C";
const PUDAR = "FF9CA3AF";
const KEC = { bg: "FFF0FDF4", fc: "FF166534", tebal: true };

/**
 * Excel Target Komoditas per Desa/Kelurahan (Admin Kab) untuk satu (tahun, bulan, komoditas),
 * opsional satu kecamatan. Padi: rincian tanam/panen per jenis LTT + total.
 * Urut kecamatan → desa, dengan baris subtotal per kecamatan dan JUMLAH di bawah.
 * PEMANGGIL WAJIB sudah memeriksa role admin_kab (barisTargetDesa memakai service role).
 */
export async function specTargetDesa(
  s: Supa,
  f: { tahun: number; bulan: number; kom: Komoditas; kecamatanId: number | null },
): Promise<SpesifikasiExcel> {
  const [kecs, semuaDesa, semuaJenis] = await Promise.all([
    daftarKecamatan(s),
    daftarDesa(s),
    f.kom === "Padi" ? semuaJenisPadi(s) : Promise.resolve([]),
  ]);
  const kecTerpilih = f.kecamatanId ? kecs.find((k) => k.id === f.kecamatanId) ?? null : null;
  const desa = kecTerpilih ? semuaDesa.filter((d) => d.kecamatan_id === kecTerpilih.id) : semuaDesa;
  const baris = (await barisTargetDesa(s, { tahun: f.tahun, bulan: f.bulan, kom: f.kom, kecs, desa })).sort(
    (a, b) => a.kecamatan.localeCompare(b.kecamatan, "id") || a.nama.localeCompare(b.nama, "id"),
  );

  // Jenis LTT: yang aktif, plus jenis nonaktif yang masih dipakai di rincian bulan ini
  const dipakai = new Set(baris.flatMap((b) => b.target?.rincian.map((r) => r.jenisId) ?? []));
  const jenis = semuaJenis.filter((j) => j.aktif || dipakai.has(j.id));
  const isPadi = f.kom === "Padi";

  const angka = (judul: string): Kolom => ({ judul, lebar: 11, jenis: "angka" });
  const kolom: Kolom[] = [
    { judul: "NO", lebar: 5, rata: "center" },
    { judul: "KECAMATAN", lebar: 18 },
    { judul: "DESA/KELURAHAN", lebar: 22 },
    { judul: "PPL", lebar: 30 },
    ...jenis.flatMap((j) => [angka(`${j.nama} TANAM`), angka(`${j.nama} PANEN`)]),
    angka("TOTAL TANAM"),
    angka("TOTAL PANEN"),
    { judul: `LUAS BAKU ${isPadi ? "SAWAH" : "LAHAN"} (HA)`, lebar: 13, jenis: "angka" },
    { judul: "STATUS", lebar: 13 },
    { judul: "DIISI OLEH", lebar: 26 },
  ];
  const nAwal = 4;
  const nJenis = jenis.length * 2;
  const nKolom = kolom.length;

  // Header 2 baris (Padi): nama jenis di-merge di atas TANAM | PANEN
  const header: Blok = isPadi
    ? {
        t: "header",
        warna: "FF166534",
        baris: [
          ["NO", "KECAMATAN", "DESA/KELURAHAN", "PPL", ...jenis.flatMap((j) => [j.nama.toUpperCase(), ""]), "TOTAL (HA)", "", kolom[nAwal + nJenis + 2].judul, "STATUS", "DIISI OLEH"],
          ["", "", "", "", ...jenis.flatMap(() => ["TANAM", "PANEN"]), "TANAM", "PANEN", "", "", ""],
        ],
        gabung: [
          ...[1, 2, 3, 4].map((c): [number, number, number, number] => [1, c, 2, c]),
          ...jenis.map((_, i): [number, number, number, number] => [1, nAwal + 1 + i * 2, 1, nAwal + 2 + i * 2]),
          [1, nAwal + nJenis + 1, 1, nAwal + nJenis + 2],
          ...[nKolom - 2, nKolom - 1, nKolom].map((c): [number, number, number, number] => [1, c, 2, c]),
        ],
      }
    : {
        t: "header",
        warna: "FF166534",
        baris: [["NO", "KECAMATAN", "DESA/KELURAHAN", "PPL", "TARGET TANAM (HA)", "TARGET PANEN (HA)", kolom[nAwal + 2].judul, "STATUS", "DIISI OLEH"]],
      };

  /** Angka 0 dibuat pudar di baris desa supaya yang berisi menonjol. */
  const nol = (v: number | null): Sel => (v != null && Math.abs(v) < 0.005 ? { v: 0, fc: PUDAR } : v);
  const k$ = (v: string | number): Sel => ({ v, ...KEC });

  /** Nilai angka satu desa / akumulasi: [per jenis tanam, panen]..., total tanam, total panen, luas baku */
  const nilaiDesa = (t: (typeof baris)[number]["target"]): number[] => [
    ...jenis.flatMap((j) => {
      const r = t?.rincian.find((x) => x.jenisId === j.id);
      return [r?.tanam ?? 0, r?.panen ?? 0];
    }),
    t?.tanam ?? 0,
    t?.panen ?? 0,
    t?.luasBaku ?? 0,
  ];
  const jumlahkan = (rows: number[][], n: number) => Array.from({ length: n }, (_, i) => rows.reduce((a, r) => a + r[i], 0));
  const nAngka = nJenis + 3;

  const blok: Blok[] = [header];
  const semuaNilai: number[][] = [];
  const grup = new Map<string, typeof baris>();
  for (const b of baris) grup.set(b.kecamatan, [...(grup.get(b.kecamatan) ?? []), b]);

  let no = 0;
  for (const [namaKec, ds] of grup) {
    const nilaiKec = ds.filter((d) => d.target).map((d) => nilaiDesa(d.target));
    const terisi = nilaiKec.length;
    const isi: Sel[][] = [[
      k$(""), k$(`KECAMATAN ${namaKec.toUpperCase()}`), k$(`${terisi}/${ds.length} desa terisi`), k$(""),
      ...jumlahkan(nilaiKec, nAngka).map((v) => k$(v)),
      k$(""), k$(""),
    ]];
    for (const d of ds) {
      no++;
      const v = d.target ? nilaiDesa(d.target) : null;
      isi.push([
        no,
        d.kecamatan,
        d.nama,
        d.ppl.join(", ") || { v: "Belum ada PPL", fc: PUDAR },
        ...(v ? v.map(nol) : Array.from({ length: nAngka }, () => null)),
        d.target ? "Sudah diisi" : { v: "Belum diisi", fc: MERAH, tebal: true },
        d.pembuat ? `${d.pembuat.peran ? `${d.pembuat.peran} · ` : ""}${d.pembuat.nama}` : "",
      ]);
    }
    semuaNilai.push(...nilaiKec);
    blok.push({ t: "data", baris: isi });
  }
  const terisiTotal = semuaNilai.length;
  blok.push({
    t: "total",
    gabung: 2,
    nilai: [kecTerpilih ? `JUMLAH KEC. ${kecTerpilih.nama.toUpperCase()}` : "JUMLAH KABUPATEN", "", `${terisiTotal}/${baris.length} desa terisi`, "", ...jumlahkan(semuaNilai, nAngka), "", ""],
  });
  blok.push(
    { t: "kosong" },
    { t: "catatan", teks: "Kosong = desa belum mengisi target. Isi 0 tetap dihitung sudah diisi." },
  );
  if (isPadi) blok.push({ t: "catatan", teks: "Total = jumlah rincian semua jenis LTT padi." });

  const periode = `${NAMA_BULAN[f.bulan - 1]} ${f.tahun}`;
  const cakupan = kecTerpilih ? `Kec. ${kecTerpilih.nama}` : "Kabupaten";
  return {
    namaFile: ["Target_Desa", f.kom, kecTerpilih?.nama ?? "Kabupaten", `${NAMA_BULAN[f.bulan - 1]}_${f.tahun}`],
    judulFile: `Target ${f.kom} per Desa - ${cakupan} - ${periode}`,
    lembar: [{
      nama: "Target Desa",
      judul: `TARGET ${f.kom.toUpperCase()} PER DESA/KELURAHAN`,
      info: [`${cakupan} · ${periode}`],
      kolom,
      beku: { x: 3, y: isPadi ? 6 : 5 },
      tanpaZebra: true,
      blok,
    }],
  };
}
