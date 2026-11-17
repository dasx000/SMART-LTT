import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { tanggalIsoWIB } from "@/lib/format";
import { KOMODITAS, cariLaporan, daftarDesa, daftarKecamatan, jenisPadi, satuLaporan, type Komoditas } from "@/lib/data";
import { angkaParam, teksParam, urlDengan } from "@/lib/param";
import { PILIHAN_PER } from "./daftar-laporan";

const tglOk = (v: string | null, def: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : def);

/**
 * Baca URL halaman Laporan LTT → ambil data di server. Dipakai /kab/laporan & /bpp/laporan.
 * `kecamatanKunci` (BPP) membatasi wilayah apa pun isi URL-nya (RLS juga membatasi ubah/hapus).
 */
export async function muatHalamanLaporan(
  dasar: string,
  q: Record<string, string | string[] | undefined>,
  kecamatanKunci: number | null,
) {
  const s = await supabaseServer();
  const hariIni = tanggalIsoWIB();
  // Default = hari ini (seperti aplikasi lama)
  // Tidak boleh melewati hari ini (WIB); sampai >= dari.
  const dari = [tglOk(teksParam(q, "dari"), hariIni), hariIni].sort()[0];
  const sampai = [[tglOk(teksParam(q, "sampai"), dari), hariIni].sort()[0], dari].sort()[1];
  const komoditas = (KOMODITAS as string[]).includes(teksParam(q, "komoditas") ?? "") ? (teksParam(q, "komoditas") as Komoditas) : null;
  const metode = ["Regular", "PM AAS"].includes(teksParam(q, "metode") ?? "") ? teksParam(q, "metode") : null;
  const kecId = kecamatanKunci ?? (angkaParam(q, "kecamatan", 1, 100000, 0) || null);
  const desaId = angkaParam(q, "desa", 1, 1_000_000, 0) || null;
  const per = PILIHAN_PER.includes(angkaParam(q, "per", 1, 100, 10)) ? angkaParam(q, "per", 1, 100, 10) : 10;
  const hal = angkaParam(q, "hal", 1, 100000, 1);
  const editId = angkaParam(q, "edit", 1, Number.MAX_SAFE_INTEGER, 0);

  const [kecs, semuaDesa] = await Promise.all([daftarKecamatan(s), daftarDesa(s)]);
  const desaKec = kecId ? semuaDesa.filter((d) => d.kecamatan_id === kecId) : [];
  const desaIds = desaId && (!kecId || desaKec.some((d) => d.id === desaId)) ? [desaId] : kecId ? desaKec.map((d) => d.id) : null;

  const akhir = new Date(`${sampai}T00:00:00+07:00`);
  akhir.setUTCDate(akhir.getUTCDate() + 1);
  const [hasil, edit] = await Promise.all([
    cariLaporan(
      s,
      { dari: `${dari}T00:00:00+07:00`, sampai: `${tanggalIsoWIB(akhir)}T00:00:00+07:00`, komoditas, metode, desaIds, cari: teksParam(q, "q"), hal, per },
      kecs,
      semuaDesa,
    ),
    editId ? satuLaporan(s, editId) : Promise.resolve(null),
  ]);

  const kecEdit = edit ? (edit.desa as unknown as { kecamatan_id: number } | null)?.kecamatan_id : null;
  // Pilihan jenis LTT hanya untuk laporan Padi; jenis lama yang sudah nonaktif tetap dimunculkan
  let jenis: { id: number; nama: string }[] = [];
  if (edit?.komoditas === "Padi") {
    jenis = (await jenisPadi(s)).map(({ id, nama }) => ({ id, nama }));
    const idLama = edit.jenis_ltt_id as number | null;
    const namaLama = (edit.jenis as unknown as { nama: string } | null)?.nama;
    if (idLama && namaLama && !jenis.some((j) => j.id === idLama)) jenis.push({ id: idLama, nama: `${namaLama} (nonaktif)` });
  }
  return {
    daftar: {
      dasar, q, hal, per, dari, sampai, hariIni, kecs,
      baris: hasil.baris,
      total: hasil.total,
      ringkas: hasil.ringkas,
      desaPilihan: desaKec,
      kecamatanTerkunci: kecamatanKunci !== null,
      unduh: urlDengan("/api/unduh/laporan", {}, { dari, sampai, komoditas, kecamatan: kecId }),
    },
    edit: edit
      ? {
          data: {
            id: edit.id as number,
            desaId: edit.desa_id as number,
            komoditas: edit.komoditas as string,
            jenisId: (edit.jenis_ltt_id as number | null) ?? null,
            tanam: Number(edit.realisasi_tanam) || 0,
            panen: Number(edit.realisasi_panen) || 0,
            bera: Number(edit.luas_bera) || 0,
            olah: Number(edit.realisasi_olah) || 0,
            metode: edit.metode_penanaman as string | null,
            keterangan: edit.keterangan as string | null,
          },
          desa: semuaDesa.filter((d) => d.kecamatan_id === kecEdit),
          jenis,
          kembali: urlDengan(dasar, q, { edit: null }),
        }
      : null,
  };
}
