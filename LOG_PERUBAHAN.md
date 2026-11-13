# Log Perubahan Migrasi SMART LTT

Dokumen ini mencatat seluruh aktivitas, pembuatan file, perubahan kode, dan tahapan migrasi yang dilakukan secara berurutan agar memudahkan review.

---

## [2026-11-13 11:40 - 11:46 WIB] Fase 2 & Ekstraksi ETL Lokal

### 1. Kebijakan & Aturan yang Diterapkan:
* **Database Supabase Live Tidak Disentuh:** Seluruh skrip SQL migrasi dan normalisasi data hanya diproses dan disimpan di file lokal. Belum ada DDL atau data yang di-insert ke Supabase live sesuai permintaan user.
* **Fitur Verifikasi Ditiadakan:** Menghilangkan status `Menunggu`, `Terverifikasi BPP`, `Terverifikasi Kab` pada struktur data tabel laporan.
* **Target Tanpa Tahun:** Struktur target desa dan target kecamatan menggunakan siklus 12 bulan berulang (tanpa tahun). Target kabupaten dihitung otomatis melalui SQL View.

### 2. Berkas Baru yang Dibuat:
1. `LOG_PERUBAHAN.md`: Dokumen pelacak riwayat perubahan.
2. `supabase/migrations/0002_ltt_data.sql`: 
   * Skema tabel `ltt.jenis_ltt`, `ltt.laporan_ltt` (Padi & Palawija bersatu, soft-delete, tanpa verifikasi).
   * Tabel `ltt.target_desa`, `ltt.target_kecamatan`, dan view `ltt.v_target_kabupaten`.
   * Tabel `ltt.produktivitas_desa`, `ltt.sarana_desa`, `ltt.logs_sinkron`.
   * View `ltt.v_ringkasan_harian`, `ltt.v_rekap_bulanan_kecamatan`.
   * Kebijakan Row Level Security (RLS) lengkap untuk 4 role.
3. `lib/supabase/types.ts`:
   * Tipe data TypeScript kuat untuk seluruh entitas database schema `ltt` (komoditas, wilayah, laporan, target, produktivitas, sarana, view).
4. `scripts/etl/transform_data.py`:
   * Skrip normalisasi data mentah dari `MASTER DATABASE LTT.xlsx`.
   * Berhasil memproses **100% data** secara lokal tanpa ada selisih:
     - 15 Kecamatan
     - 227 Desa
     - 104 Pengguna
     - 15.517 baris Laporan LTT (14 sheet padi & palawija)
     - 1.263 baris Target Desa
     - 124 baris Target Kecamatan
     - 102 baris Produktivitas Desa
     - 9 baris Sarana Desa
5. `scripts/etl/data_bersih/`:
   * Folder penyimpanan file JSON hasil normalisasi offline:
     - `kecamatan.json`, `desa.json`, `pengguna.json`, `laporan_ltt.json`, `target_desa.json`, `target_kecamatan.json`, `produktivitas_desa.json`, `sarana_desa.json`.

### 3. Status Pengujian:
* `python scripts/etl/transform_data.py` -> **SUKSES (15.517 / 15.517 data cocok 100%)**.
* `npx tsc --noEmit` -> **Lolos (0 error)**.
* `npm run build` -> **Lolos (Turbopack production build berhasil)**.

---
