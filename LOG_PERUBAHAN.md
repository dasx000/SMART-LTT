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

## [2026-11-13 11:50 - 11:55 WIB] Fase 3.5 — Antarmuka & Alur Kerja Penyuluh (PPL)

### 1. Tujuan:
Membangun antarmuka mobile-first untuk Penyuluh Pertanian Lapangan (PPL) di `app/ppl/`, menggantikan `_gas_lama/File_HTML_PPL.html` dengan desain responsif yang ringan di HP.

### 2. Berkas Baru & Modifikasi:
1. `app/ppl/skema.ts` (Dibuat):
   * Skema validasi Zod untuk formulir input dan edit LTT (`desaId`, `komoditas`, `realisasiTanam`, `realisasiPanen`, `keterangan`).
2. `app/ppl/actions.ts` (Dibuat):
   * `simpanLaporanAction`: Server Action untuk menyimpan input laporan baru Jagung/Ubi Kayu dengan validasi wilayah binaan & aturan bisnis (pencegahan input nihil 0,00).
   * `editLaporanAction`: Server Action untuk memperbarui laporan hari ini.
   * `hapusLaporanAction`: Server Action untuk soft-delete laporan.
3. `app/ppl/tampilan-ppl.tsx` (Dibuat):
   * Client component interaktif:
     - Header kartu profil PPL (Nama, NIP, daftar WKPP desa binaan).
     - Kartu indikator ringkasan capaian tanam & panen hari ini (WIB).
     - Tombol seleksi komoditas (Padi, Jagung, Ubi Kayu).
     - Mode Padi: Tampilan status tarikan otomatis e-Pusluh hari ini per desa binaan (Sudah Lapor / Belum Lapor).
     - Mode Jagung & Ubi Kayu: Formulir input LTT responsif + daftar riwayat laporan hari ini.
     - Aksi Edit dan Hapus laporan dengan dialog konfirmasi SweetAlert2.
4. `app/ppl/page.tsx` (Dimodifikasi):
   * Server Component: membaca sesi PPL, memuat desa binaan, memuat data laporan hari ini, dan status padi secara aman.

### 3. Status Pengujian:
* `npx tsc --noEmit` -> **Lolos (0 error)**.
* `npm run lint` -> **Lolos (0 warning, 0 error)**.
* `npm run build` -> **Lolos (Turbopack build 100% sukses)**.

---

## [2026-11-13 12:53 - 12:57 WIB] Fase 5 — Antarmuka & Alur Kerja Koordinator BPP (`app/bpp/`)

### 1. Tujuan:
Membangun antarmuka Koordinator Balai Penyuluhan Pertanian (BPP) kecamatan di `app/bpp/`, menggantikan `_gas_lama/File_HTML_BPP.html` dengan fitur dashboard capaian vs target, rekap desa, daftar laporan kecamatan, dan pengisian target kecamatan (tanpa alur verifikasi).

### 2. Berkas Baru & Modifikasi:
1. `app/bpp/skema.ts` (Dibuat):
   * Skema validasi Zod untuk target kecamatan (`bulan`, `komoditas`, `targetTanam`, `targetPanen`) dan koreksi laporan LTT oleh BPP.
2. `app/bpp/actions.ts` (Dibuat):
   * `simpanTargetKecamatanAction`: Server Action untuk menyimpan target kecamatan (12 bulan berulang, tanpa tahun) yang diisi oleh Koordinator BPP.
   * `editLaporanBppAction`: Server Action untuk koreksi data laporan LTT di wilayah kecamatan BPP.
   * `hapusLaporanBppAction`: Server Action untuk soft-delete laporan di wilayah kecamatan BPP.
3. `app/bpp/tampilan-bpp.tsx` (Dibuat):
   * Client component interaktif dengan 3 tab:
     - **Tab Capaian Kecamatan:** 3 kartu komoditas (Padi, Jagung, Ubi Kayu) dengan progress bar capaian vs target, persentase, dan ambang warna resmi (<60% merah, 60–84% kuning, ≥85% hijau); serta tabel capaian per desa di kecamatan tersebut.
     - **Tab Laporan LTT Kecamatan:** Tabel seluruh laporan di kecamatan dengan filter komoditas, pencarian desa, dan aksi edit/hapus.
     - **Tab Target Kecamatan:** Formulir input target tanam & panen per komoditas & per bulan untuk diisi Admin BPP.
4. `app/bpp/page.tsx` (Dimodifikasi):
   * Server Component: membaca sesi BPP, mengambil nama kecamatan, target kecamatan, dan agregasi data laporan desa secara aman.

### 3. Status Pengujian:
* `npx tsc --noEmit` -> **Lolos (0 error)**.
* `npm run lint` -> **Lolos (0 warning, 0 error)**.
* `npm run build` -> **Lolos (Turbopack build 100% sukses)**.

---

## [2026-11-13 13:10 - 13:15 WIB] Fase 6 — Admin Kabupaten, Dinas (`app/kab/`), & Endpoint API Bot VPS

### 1. Tujuan:
Membangun antarmuka Admin Kabupaten dan Dinas TPHP di `app/kab/` (menggantikan `_gas_lama/File_HTML_Admin.html`) serta endpoint Route Handler API `POST /api/epusluh/sinkron-padi` untuk menerima tarikan data padi otomatis dari cron bot Playwright VPS (`DASBOT`).

### 2. Berkas Baru & Modifikasi:
1. `app/kab/skema.ts` (Dibuat):
   * Skema validasi Zod untuk koreksi data laporan tingkat kabupaten (`luasBera`, `realisasiOlah`, `realisasiTanam`, `realisasiPanen`, `metodePenanaman`, `keterangan`).
2. `app/kab/actions.ts` (Dibuat):
   * `editLaporanKabAction`: Server Action koreksi laporan dengan wewenang Admin Kabupaten (bisa ubah olah, bera, tanam, panen, metode PM AAS).
   * `hapusLaporanKabAction`: Server Action soft-delete laporan se-kabupaten.
3. `app/kab/tampilan-kab.tsx` (Dibuat):
   * Client component responsif dengan pembatasan hak akses:
     - **Role Dinas:** Hanya dapat melihat *Smart Dashboard* dan *LTT PM AAS* (read-only, tanpa menu edit/hapus).
     - **Role Admin_Kab:** Memiliki akses penuh termasuk tab *Laporan LTT se-Kabupaten* dengan filter kecamatan & komoditas serta aksi koreksi/hapus.
     - **KPI Ringkasan Kabupaten:** Padi, Jagung, Ubi Kayu, dan PM AAS dengan capaian vs target otomatis kabupaten dan indikator warna resmi (<60%, 60-84%, >=85%).
     - **Tabel 15 Kecamatan:** Rekapitulasi capaian tanam dan panen 15 kecamatan lengkap dengan baris total se-Kabupaten Way Kanan.
4. `app/kab/page.tsx` (Dimodifikasi):
   * Server Component: membaca sesi Admin_Kab / Dinas, memuat data agregat 15 kecamatan, target kabupaten, dan rekap PM AAS.
5. `app/api/epusluh/sinkron-padi/route.ts` (Dibuat):
   * Route Handler API pengganti `doPost aksi=sinkron_padi` pada Google Apps Script lama.
   * Memeriksa token header keamanan (`EPUSLUH_INGEST_TOKEN`).
   * Menerapkan aturan "timpa per tanggal": menghapus data padi lama pada tanggal tarikan lalu menginjeksi data baru secara batch.
   * Mencatat riwayat ke tabel `ltt.logs_sinkron`.

### 3. Status Pengujian:
* `npx tsc --noEmit` -> **Lolos (0 error)**.
* `npm run lint` -> **Lolos (0 warning, 0 error)**.
* `npm run build` -> **Lolos (Turbopack build 100% sukses, 10 route ter-generate)**.

---
