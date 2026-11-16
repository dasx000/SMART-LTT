/**
 * Daftar tabel yang ikut backup manual (menu Backup Data, Admin Kab) — juga dipakai skrip pemulihan
 * (scripts/pulihkan-backup.mjs menyalin daftar yang sama; ubah keduanya bersamaan).
 *
 * Urutan = urutan pemulihan (tabel induk dulu).
 * TIDAK ikut: password (ada di Supabase Auth, tidak bisa dibaca), ltt.api_klien (hash kunci API),
 * ltt.api_log (log akses), ltt.riwayat_backup. Data aplikasi lain di project bersama tidak ikut:
 * core.memberships hanya app 'ltt', core.profiles hanya anggota SMART LTT.
 */
export const VERSI_BACKUP = 1;

export type TabelBackup = { skema: "ltt" | "core"; nama: string; urut: string; kunci: string };

export const TABEL_BACKUP: TabelBackup[] = [
  { skema: "ltt", nama: "kecamatan", urut: "id", kunci: "id" },
  { skema: "ltt", nama: "desa", urut: "id", kunci: "id" },
  { skema: "ltt", nama: "jenis_ltt", urut: "id", kunci: "id" },
  { skema: "core", nama: "profiles", urut: "id", kunci: "id" },
  { skema: "core", nama: "memberships", urut: "user_id", kunci: "user_id,app_slug" },
  { skema: "ltt", nama: "anggota", urut: "user_id", kunci: "user_id" },
  { skema: "ltt", nama: "anggota_desa", urut: "user_id,desa_id", kunci: "user_id,desa_id" },
  { skema: "ltt", nama: "laporan_ltt", urut: "id", kunci: "id" },
  { skema: "ltt", nama: "target_desa", urut: "id", kunci: "id" },
  { skema: "ltt", nama: "target_desa_rincian", urut: "target_desa_id,jenis_ltt_id", kunci: "target_desa_id,jenis_ltt_id" },
  { skema: "ltt", nama: "target_kecamatan", urut: "id", kunci: "id" },
  { skema: "ltt", nama: "target_provinsi", urut: "tahun,bulan,kecamatan_id,komoditas", kunci: "tahun,bulan,kecamatan_id,komoditas" },
  { skema: "ltt", nama: "target_pm_aas", urut: "tahun,bulan", kunci: "tahun,bulan" },
  { skema: "ltt", nama: "target_pm_aas_kecamatan", urut: "tahun,bulan,kecamatan_id", kunci: "tahun,bulan,kecamatan_id" },
  { skema: "ltt", nama: "produktivitas_desa", urut: "tahun,bulan,desa_id,komoditas", kunci: "tahun,bulan,desa_id,komoditas" },
  { skema: "ltt", nama: "sarana_desa", urut: "desa_id", kunci: "desa_id" },
  { skema: "ltt", nama: "logs_sinkron", urut: "id", kunci: "id" },
  { skema: "ltt", nama: "log_perubahan", urut: "id", kunci: "id" },
];

/** Hari sejak backup terakhir → warna pengingat (> 7 hari merah). */
export const BATAS_HARI_BACKUP = 7;
