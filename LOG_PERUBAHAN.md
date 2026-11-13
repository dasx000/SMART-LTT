# Log Perubahan Migrasi SMART LTT

Dokumen ini mencatat seluruh aktivitas, pembuatan file, perubahan kode, dan tahapan migrasi yang dilakukan secara berurutan agar memudahkan review.

---

## [2026-11-13 11:40 WIB] Inisiasi Log & Persiapan Fase 2

### 1. Instruksi & Kebijakan Kerja:
* **Prinsip Bertahap:** Migrasi dijalankan bertahap (Fase 2: Skema Data -> Fase 3: Skrip ETL -> Fase 3.5: Irisan Tipis UI PPL/BPP/Kab).
* **Kebijakan Database:** Skrip SQL dan skrip migrasi hanya disiapkan di file lokal; **TIDAK ADA eksekusi atau input data ke Supabase live** sampai tahapan akhir diinstruksikan oleh user.
* **Log Perubahan:** File `LOG_PERUBAHAN.md` dibuat untuk mendokumentasikan setiap aksi.

### 2. File yang Dibuat / Diubah:
* `LOG_PERUBAHAN.md` (Dibuat): Berkas pelacak seluruh perubahan migrasi.

---
