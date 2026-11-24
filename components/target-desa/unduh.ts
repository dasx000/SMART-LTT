import "server-only";
import { NAMA_BULAN } from "@/lib/format";
import type { Blok, Kolom, Sel, SpesifikasiExcel } from "@/lib/excel-spec";
import { ambilTargetDesa, daftarDesa, daftarKecamatan, type Komoditas, type Supa } from "@/lib/data";
import { daftarAnggota } from "@/lib/pengguna";

const KABUPATEN = "WAY KANAN";
const PUDAR = "FF9CA3AF";
const BIRU_MUDA = "FFDBEAFE"; // latar baris desa (mengikuti format spreadsheet "Target LTT Penyuluh")
const JUMLAH = { bg: "FFBFDBFE", tebal: true };
/** Bulatkan 2 desimal — hindari sisa pecahan floating point (mis. 9426.630000000001). */
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Excel "TARGET LTT PENYULUH KAB. WAY KANAN" (format spreadsheet user, 24 Nov 2026) untuk satu
 * (tahun, bulan, komoditas), opsional satu kecamatan. Tombol "Unduh Excel" di tab Desa/Kelurahan
 * (Admin Kab: semua / satu kecamatan; Admin BPP: kecamatannya sendiri — dipaksa di route).
 * Kolom: NO | KABUPATEN | KECAMATAN | DESA | LBS | NAMA PENYULUH | NIP | NO WA | TARGET DESA <bulan>.
 * - Urut kecamatan A–Z, lalu desa A–Z. NO = nomor kecamatan (baris pertama tiap kecamatan).
 * - LBS & target dari target_desa bulan itu (target = target tanam); desa belum isi → kosong.
 * - Penyuluh = PPL aktif (penyuluh / admin_bpp) yang membina desa; >1 orang digabung koma.
 * - Baris JUMLAH tiap kecamatan + JUMLAH keseluruhan.
 * PEMANGGIL WAJIB sudah memeriksa role & cakupan (daftarAnggota memakai service role).
 */
export async function specTargetDesa(
  s: Supa,
  f: { tahun: number; bulan: number; kom: Komoditas; kecamatanId: number | null },
): Promise<SpesifikasiExcel> {
  const [kecs, semuaDesa, anggota] = await Promise.all([daftarKecamatan(s), daftarDesa(s), daftarAnggota()]);
  const kecTerpilih = f.kecamatanId ? kecs.find((k) => k.id === f.kecamatanId) ?? null : null;
  const desa = kecTerpilih ? semuaDesa.filter((d) => d.kecamatan_id === kecTerpilih.id) : semuaDesa;
  const target = await ambilTargetDesa(s, desa.map((d) => d.id), { tahun: f.tahun, bulan: f.bulan, komoditas: f.kom });
  const tDesa = new Map(target.map((t) => [t.desaId, t]));
  const ppl = anggota.filter((a) => a.aktif && (a.role === "penyuluh" || a.role === "admin_bpp"));

  const namaBulan = NAMA_BULAN[f.bulan - 1];
  const isPadi = f.kom === "Padi";
  const kolom: Kolom[] = [
    { judul: "NO", lebar: 5, rata: "center" },
    { judul: "KABUPATEN", lebar: 13 },
    { judul: "KECAMATAN", lebar: 20 },
    { judul: "DESA", lebar: 24 },
    { judul: isPadi ? "LBS (Ha)" : "LUAS BAKU LAHAN (Ha)", lebar: 11, jenis: "angka" },
    { judul: "NAMA PENYULUH", lebar: 32 },
    { judul: "NIP", lebar: 21 },
    { judul: "NO WA", lebar: 16 },
    { judul: `TARGET ${isPadi ? "DESA" : f.kom.toUpperCase()} ${namaBulan.toUpperCase()} (Ha)`, lebar: 14, jenis: "angka" },
  ];

  const urutKec = [...kecs].filter((k) => desa.some((d) => d.kecamatan_id === k.id)).sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  const blok: Blok[] = [{ t: "header", baris: [kolom.map((k) => k.judul)], warna: "FF166534" }];
  const tot = { lbs: 0, target: 0 };
  const biru = (v: Sel): Sel => (v !== null && typeof v === "object" ? { bg: BIRU_MUDA, ...v } : { v, bg: BIRU_MUDA });
  const gabung = (xs: (string | null)[]) => xs.filter(Boolean).join(", ");

  urutKec.forEach((k, ki) => {
    const ds = desa.filter((d) => d.kecamatan_id === k.id).sort((a, b) => a.nama.localeCompare(b.nama, "id"));
    let lbsKec = 0;
    let tgtKec = 0;
    const baris: Sel[][] = ds.map((d, di) => {
      const t = tDesa.get(d.id);
      const pembina = ppl.filter((a) => a.desaIds.includes(d.id));
      lbsKec += t?.luasBaku ?? 0;
      tgtKec += t?.tanam ?? 0;
      return [
        di === 0 ? ki + 1 : "",
        KABUPATEN,
        k.nama.toUpperCase(),
        d.nama.toUpperCase(),
        t ? t.luasBaku : null,
        pembina.length ? gabung(pembina.map((a) => a.nama)) : { v: "Belum ada PPL", fc: PUDAR },
        gabung(pembina.map((a) => a.nip || null)),
        gabung(pembina.map((a) => a.whatsapp)),
        t ? t.tanam : null,
      ].map(biru);
    });
    baris.push([
      { v: "", ...JUMLAH }, { v: `JUMLAH KEC. ${k.nama.toUpperCase()}`, ...JUMLAH }, { v: "", ...JUMLAH }, { v: "", ...JUMLAH },
      { v: r2(lbsKec), ...JUMLAH }, { v: "", ...JUMLAH }, { v: "", ...JUMLAH }, { v: "", ...JUMLAH }, { v: r2(tgtKec), ...JUMLAH },
    ]);
    tot.lbs += lbsKec;
    tot.target += tgtKec;
    blok.push({ t: "data", baris });
  });

  blok.push({
    t: "total",
    gabung: 4,
    nilai: [kecTerpilih ? `JUMLAH KEC. ${kecTerpilih.nama.toUpperCase()}` : "JUMLAH KABUPATEN", "", "", "", r2(tot.lbs), "", "", "", r2(tot.target)],
  });
  blok.push(
    { t: "kosong" },
    { t: "catatan", teks: `Target = target tanam ${f.kom.toLowerCase()} yang diisi PPL untuk ${namaBulan} ${f.tahun}. Kolom kosong = desa belum mengisi target bulan ini.` },
  );

  const periode = `${namaBulan} ${f.tahun}`;
  const cakupan = kecTerpilih ? `Kec. ${kecTerpilih.nama}` : "Kabupaten";
  return {
    namaFile: ["Target_LTT_Penyuluh", f.kom, kecTerpilih?.nama ?? "Kabupaten", `${namaBulan}_${f.tahun}`],
    judulFile: `Target LTT Penyuluh ${f.kom} - ${cakupan} - ${periode}`,
    lembar: [{
      nama: "Target LTT Penyuluh",
      judul: `TARGET LTT PENYULUH KAB. ${KABUPATEN}`,
      info: [`Komoditas ${f.kom} · ${periode} · ${cakupan}`],
      kolom,
      beku: { y: 5 },
      tanpaZebra: true,
      blok,
    }],
  };
}
