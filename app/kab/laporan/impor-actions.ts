"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { wajibRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseSiap } from "@/lib/env";
import { SELECT_DESA, angka, idValid, jenisLtt, keterangan, kunciNama, metode, nihil, petaDesa, teks } from "@/lib/epusluh";

const BATAS_BYTE = 5 * 1024 * 1024;
const BATAS_BARIS = 5000;

export type RingkasImpor = {
  barisFile: number;
  valid: number;
  ditambah: number;
  diperbarui: number;
  dilewati: number;
  nihil: number;
  wilayahDilewati: string[];
  jenisBaru: string[];
  desaTakCocok: string[];
  tanggalGagal: number;
  idTidakValid: number;
  idGanda: number;
  tanggal: string[];
};

export type HasilImpor = { sukses: boolean; pesan: string; ringkas?: RingkasImpor };

/** Judul kolom ekspor e-Pusluh (dinormalisasi) → kunci internal. Kolom lain diabaikan. */
const KOLOM = {
  id: "id laporan",
  waktu: "waktu lapor",
  kec: "kecamatan",
  desa: "desa",
  pelapor: "pelapor",
  jenis: "jenis ltt",
  metode: "metode penanaman",
  tanam: "realisasi luas tambah tanam",
  bera: "luas lahan bera",
  olah: "realisasi luas olah lahan",
  panen: "realisasi luas panen",
  ket: "keterangan",
} as const;
type Kunci = keyof typeof KOLOM;
const OPSIONAL: Kunci[] = ["metode", "ket"];

const judul = (v: unknown) => kunciNama(v).replace(/\(ha\)/g, "").trim();

/** Nilai mentah sel ExcelJS → nilai sederhana (teks kaya, rumus, tautan). */
function nilaiSel(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return v.result;
    if ("text" in v) return v.text;
  }
  return v;
}

const dua = (n: number) => String(n).padStart(2, "0");

/**
 * Waktu Lapor → ISO WIB. Format tegas e-Pusluh: "15-11-2026 14:31:47" (hari-bulan-tahun).
 * Sel bertipe tanggal Excel juga diterima (jam dinding dianggap WIB). Selain itu ditolak, tidak ditebak.
 */
function waktuLapor(v: unknown): string | null {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return `${v.getUTCFullYear()}-${dua(v.getUTCMonth() + 1)}-${dua(v.getUTCDate())}T${dua(v.getUTCHours())}:${dua(v.getUTCMinutes())}:${dua(v.getUTCSeconds())}+07:00`;
  }
  const m = teks(v).match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [hari, bulan, tahun, jam, menit] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31 || jam > 23 || menit > 59) return null;
  const iso = `${tahun}-${dua(bulan)}-${dua(hari)}T${dua(jam)}:${dua(menit)}:${m[6] ?? "00"}+07:00`;
  const d = new Date(iso);
  // tolak tanggal mustahil (mis. 31-02) yang digeser otomatis oleh Date
  return Number.isNaN(d.getTime()) || new Date(d.getTime() + 7 * 3600e3).getUTCDate() !== hari ? null : iso;
}

/**
 * Impor Excel ekspor e-Pusluh (padi) — khusus Admin Kab.
 * mode "pratinjau": hanya menghitung; mode "simpan": menulis (upsert per ID e-Pusluh, tidak menghapus apa pun).
 * Aturan sama dengan bot (ltt.upsert_padi_epusluh): baris nihil dilewati.
 */
export async function imporEpusluhAction(formData: FormData): Promise<HasilImpor> {
  await wajibRole("admin_kab");
  if (!supabaseSiap()) return { sukses: false, pesan: "Koneksi Supabase belum aktif." };

  const simpan = formData.get("mode") === "simpan";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { sukses: false, pesan: "Pilih file Excel (.xlsx) terlebih dahulu." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { sukses: false, pesan: "Format file harus .xlsx (ekspor Laporan LTT e-Pusluh)." };
  if (file.size > BATAS_BYTE) return { sukses: false, pesan: "Ukuran file maksimal 5 MB." };

  // 1. Baca workbook (sheet pertama)
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    return { sukses: false, pesan: "File tidak bisa dibaca. Pastikan file .xlsx asli hasil unduhan e-Pusluh." };
  }
  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount < 2) return { sukses: false, pesan: "File kosong." };

  // 2. Petakan kolom berdasarkan JUDUL (bukan posisi)
  const kolom = {} as Record<Kunci, number>;
  ws.getRow(1).eachCell((sel, no) => {
    const j = judul(nilaiSel(sel.value));
    for (const [k, nama] of Object.entries(KOLOM) as [Kunci, string][]) if (j === nama && !kolom[k]) kolom[k] = no;
  });
  const hilang = (Object.keys(KOLOM) as Kunci[]).filter((k) => !kolom[k] && !OPSIONAL.includes(k));
  if (hilang.length) {
    return { sukses: false, pesan: `Kolom wajib tidak ditemukan: ${hilang.map((k) => `"${KOLOM[k]}"`).join(", ")}. Pastikan ini file ekspor Laporan LTT e-Pusluh.` };
  }

  // 3. Normalisasi baris
  const s = await supabaseServer();
  const { data: desas, error: errDesa } = await s.from("desa").select(SELECT_DESA).limit(2000);
  if (errDesa) return { sukses: false, pesan: `Gagal memuat data desa: ${errDesa.message}` };
  const peta = petaDesa(desas ?? []);

  const baris: Record<string, unknown>[] = [];
  const idTerpakai = new Set<string>();
  const desaTakCocok = new Set<string>();
  const tanggal = new Set<string>();
  let barisFile = 0, tanggalGagal = 0, idTidakValid = 0, idGanda = 0, jmlNihil = 0;

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const ambil = (k: Kunci) => (kolom[k] ? nilaiSel(row.getCell(kolom[k]).value) : null);
    const id = teks(ambil("id"));
    if (!id && !teks(ambil("desa"))) continue; // baris kosong
    barisFile++;
    if (barisFile > BATAS_BARIS) return { sukses: false, pesan: `Maksimal ${BATAS_BARIS} baris per impor. Pecah file per tanggal.` };

    if (!idValid(id)) { idTidakValid++; continue; }
    if (idTerpakai.has(id)) { idGanda++; continue; }
    const waktu = waktuLapor(ambil("waktu"));
    if (!waktu) { tanggalGagal++; continue; }
    const desaId = peta.get(`${kunciNama(ambil("kec"))}|${kunciNama(ambil("desa"))}`);
    if (!desaId) { desaTakCocok.add(`${teks(ambil("kec"))} / ${teks(ambil("desa"))}`); continue; }

    const luas = { tanam: angka(ambil("tanam")), panen: angka(ambil("panen")), bera: angka(ambil("bera")), olah: angka(ambil("olah")) };
    idTerpakai.add(id);
    if (nihil(luas)) { jmlNihil++; continue; }

    tanggal.add(waktu.slice(0, 10));
    baris.push({
      id_sumber: id,
      tanggal_lapor: waktu,
      nama_pelapor: teks(ambil("pelapor")) || null,
      desa_id: desaId,
      jenis_ltt: jenisLtt(ambil("jenis")),
      luas_bera: luas.bera,
      realisasi_olah: luas.olah,
      realisasi_tanam: luas.tanam,
      realisasi_panen: luas.panen,
      metode_penanaman: metode(ambil("metode")),
      keterangan: keterangan(ambil("ket")),
    });
  }

  const ringkas: RingkasImpor = {
    barisFile, valid: baris.length, ditambah: 0, diperbarui: 0, dilewati: 0, nihil: jmlNihil, wilayahDilewati: [], jenisBaru: [],
    desaTakCocok: [...desaTakCocok].sort(), tanggalGagal, idTidakValid, idGanda,
    tanggal: [...tanggal].sort().map((t) => t.split("-").reverse().join("-")),
  };
  if (baris.length === 0) {
    return { sukses: false, pesan: jmlNihil ? "Semua baris berisi laporan nihil (tidak disimpan, sama dengan aturan bot)." : "Tidak ada baris yang bisa diimpor.", ringkas };
  }

  // 4. Hitung (pratinjau) atau simpan — satu transaksi di database
  const { data, error } = await s.rpc("impor_padi", { p_rows: baris, p_simpan: simpan });
  if (error) return { sukses: false, pesan: `Gagal ${simpan ? "menyimpan" : "memeriksa"}: ${error.message}`, ringkas };
  const h = (Array.isArray(data) ? data[0] : data) as
    | { ditambah: number; diperbarui: number; dilewati: number; wilayah_dilewati: string[]; jenis_baru: string[] }
    | null;
  Object.assign(ringkas, {
    ditambah: h?.ditambah ?? 0,
    diperbarui: h?.diperbarui ?? 0,
    dilewati: h?.dilewati ?? 0,
    wilayahDilewati: h?.wilayah_dilewati ?? [],
    jenisBaru: h?.jenis_baru ?? [],
  });

  if (!simpan) {
    const n = ringkas.ditambah + ringkas.diperbarui;
    return {
      sukses: true,
      pesan: n ? `File siap diimpor: ${n} laporan akan disimpan. Tekan Simpan untuk melanjutkan.` : "Tidak ada laporan baru atau perubahan untuk disimpan dari file ini.",
      ringkas,
    };
  }

  revalidatePath("/", "layout");
  return {
    sukses: true,
    pesan: `Impor selesai: ${ringkas.ditambah} laporan ditambahkan, ${ringkas.diperbarui} diperbarui${ringkas.dilewati ? `, ${ringkas.dilewati} dilewati` : ""}.`,
    ringkas,
  };
}
