import "server-only";

// Aturan baca data e-Pusluh — dipakai bersama oleh sinkron bot (/api/v1/epusluh/padi)
// dan impor Excel e-Pusluh (Admin Kab), supaya kedua jalur menghasilkan data yang sama persis.

export const teks = (v: unknown) => String(v ?? "").trim();

/** Kunci pencocokan nama wilayah: huruf kecil, spasi tunggal. */
export const kunciNama = (s: unknown) => teks(s).toLowerCase().replace(/\s+/g, " ");

/** Angka luas (ha): terima "1.234,5" / "1,5" / 1.5; negatif/tidak valid → 0. */
export function angka(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : 0;
  let s = teks(v).replace(/\s+/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "");
  const n = Number.parseFloat(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Jenis LTT sesuai e-Pusluh; kosong / "-" / "LTT" / "Padi" → "LTT Reguler". */
export function jenisLtt(v: unknown): string {
  const j = teks(v).replace(/\s+/g, " ").replace(/rehap/i, "Rehab");
  return !j || j === "-" || /^(ltt|padi)$/i.test(j) ? "LTT Reguler" : j;
}

export function metode(v: unknown): string | null {
  const m = teks(v).toUpperCase();
  if (m.includes("AAS")) return "PM AAS";
  if (m.startsWith("REG")) return "Regular";
  return null;
}

/** ID asli laporan e-Pusluh: hanya angka. ID buatan bot (SYNC-…) tidak diterima lagi. */
export const idValid = (id: string) => /^\d+$/.test(id);

/** Baris nihil (tanam, panen, bera, olah semuanya 0) tidak disimpan — sama dengan aturan bot. */
export const nihil = (r: { tanam: number; panen: number; bera: number; olah: number }) =>
  !r.tanam && !r.panen && !r.bera && !r.olah;

/** Keterangan: "-" dianggap kosong. */
export const keterangan = (v: unknown) => (teks(v) && teks(v) !== "-" ? teks(v) : null);

/** Kolom yang dibutuhkan petaDesa() dari tabel ltt.desa. */
export const SELECT_DESA = "id, nama, kecamatan:kecamatan_id(nama)";

/** Peta "kecamatan|desa" → desa_id (pakai keduanya: ada nama desa kembar di kecamatan lain). */
export function petaDesa(rows: { id: number; nama: string; kecamatan: unknown }[]): Map<string, number> {
  const peta = new Map<string, number>();
  for (const d of rows) {
    const kec = (d.kecamatan as { nama: string } | null)?.nama;
    peta.set(`${kunciNama(kec)}|${kunciNama(d.nama)}`, d.id);
  }
  return peta;
}
