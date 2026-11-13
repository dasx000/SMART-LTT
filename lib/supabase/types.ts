/**
-- Tipe Data TypeScript untuk Skema SMART LTT (schema: ltt)
-- Mengikuti skema 0001_ltt_auth.sql & 0002_ltt_data.sql
*/

export type Komoditas = "Padi" | "Jagung" | "Ubi Kayu";

export type MetodePenanaman = "Regular" | "PM AAS";

export type SumberLaporan = "manual" | "epusluh";

export interface Kecamatan {
  id: number;
  kode: string | null;
  nama: string;
  created_at: string;
}

export interface Desa {
  id: number;
  kode: string | null;
  kecamatan_id: number;
  nama: string;
  created_at: string;
  kecamatan?: Kecamatan;
}

export interface JenisLtt {
  id: number;
  nama: string;
  komoditas: Komoditas;
  kode: string | null;
  urutan: number;
  aktif: boolean;
  created_at: string;
}

export interface LaporanLtt {
  id: number;
  id_lama: string | null;
  tanggal_lapor: string;
  pelapor_id: string | null;
  nama_pelapor: string | null;
  nip_pelapor: string | null;
  desa_id: number;
  komoditas: Komoditas;
  jenis_ltt_id: number | null;
  target_tanam: number;
  target_panen: number;
  luas_bera: number;
  realisasi_olah: number;
  realisasi_tanam: number;
  realisasi_panen: number;
  metode_penanaman: MetodePenanaman | null;
  keterangan: string | null;
  sumber: SumberLaporan;
  dihapus_pada: string | null;
  created_at: string;
  updated_at: string;
  desa?: Desa;
  jenis_ltt?: JenisLtt;
}

export interface TargetDesa {
  id: number;
  bulan: number; // 1 - 12
  desa_id: number;
  komoditas: Komoditas;
  jenis_ltt_id: number | null;
  target_tanam: number;
  target_panen: number;
  ip_eksisting: number | null;
  luas_baku: number | null;
  luas_standing_crop: number | null;
  pembuat_id: string | null;
  created_at: string;
  updated_at: string;
  desa?: Desa;
}

export interface TargetKecamatan {
  id: number;
  bulan: number; // 1 - 12
  kecamatan_id: number;
  komoditas: Komoditas;
  target_tanam: number;
  target_panen: number;
  pembuat_id: string | null;
  created_at: string;
  updated_at: string;
  kecamatan?: Kecamatan;
}

export interface TargetKabupatenView {
  bulan: number;
  komoditas: Komoditas;
  target_tanam: number;
  target_panen: number;
  jumlah_kecamatan_terisi: number;
}

export interface ProduktivitasDesa {
  bulan: number;
  desa_id: number;
  komoditas: Komoditas;
  nilai: number;
  penginput_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaranaDesa {
  desa_id: number;
  gudang_gabah: number;
  embung: number;
  lantai_jemur: number;
  mesin_pengering: number;
  penginput_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RingkasanHarianView {
  tanggal: string;
  kecamatan_id: number;
  desa_id: number;
  komoditas: Komoditas;
  jenis_ltt_id: number | null;
  total_tanam: number;
  total_panen: number;
  total_bera: number;
  total_olah: number;
  jumlah_laporan: number;
}

export interface RekapBulananKecamatanView {
  tahun: number;
  bulan: number;
  kecamatan_id: number;
  nama_kecamatan: string;
  komoditas: Komoditas;
  total_tanam: number;
  total_panen: number;
  jumlah_desa_lapor: number;
  jumlah_laporan: number;
}
