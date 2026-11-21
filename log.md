# Log Perubahan — Endpoint Backup via API Key

## 21 November 2026

### 1. Migrasi SQL: `0018_izin_backup_api.sql`
**File:** [`supabase/migrations/0018_izin_backup_api.sql`](file:///d:/CODING/LTT%20-%20VERCEL/supabase/migrations/0018_izin_backup_api.sql)

- Perluas constraint `api_klien.izin` agar menerima izin baru `'backup:baca'`
- Tambah kolom `sumber` (`'manual'` | `'api'`) di `ltt.riwayat_backup` — agar tahu backup berasal dari mana
- Tambah kolom `klien_id` (FK → `ltt.api_klien`) di `ltt.riwayat_backup` — untuk tracking API key mana yang mengunduh

> **⚠️ WAJIB dijalankan di Supabase SQL Editor sebelum endpoint bisa dipakai.**

---

### 2. Tambah izin `backup:baca` di `lib/api.ts`
**File:** [`lib/api.ts`](file:///d:/CODING/LTT%20-%20VERCEL/lib/api.ts#L20)

- Tambah entry `"backup:baca": "Unduh backup data SMART LTT (.json.gz) untuk keperluan cronjob / bot VPS"` ke objek `IZIN`
- Otomatis muncul di menu Akses API saat membuat/edit kunci API

---

### 3. Endpoint baru: `GET /api/v1/backup`
**File:** [`app/api/v1/backup/route.ts`](file:///d:/CODING/LTT%20-%20VERCEL/app/api/v1/backup/route.ts)

- Autentikasi via API key (header `Authorization: Bearer sltt_xxxxx...`)
- Izin diperlukan: `backup:baca`
- Output: file `.json.gz` (streaming + gzip) — isi identik dengan backup manual `/api/backup` (lewat `lib/backup-stream.ts`)
- Dicatat di `ltt.riwayat_backup` dengan `sumber='api'` dan `nama='Bot: <nama klien>'`
- Dicatat juga di `ltt.api_log` (via `jalankanApi()`) — durasi, status, jalur

---

### 4. Refactor: logika stream backup dipakai bersama
**File:** `lib/backup-stream.ts` (baru), `app/api/backup/route.ts`, `app/api/v1/backup/route.ts`

- `buatStreamBackup(oleh, catat)` + `headerBackup()` menampung seluruh logika baca tabel → JSON → gzip
- Kedua route kini hanya: cek auth, panggil fungsi bersama, catat riwayat sesuai sumbernya
- Perilaku `/api/backup` tidak berubah (isi file, header, pencatatan riwayat sama)

### 5. Dokumentasi API
**File:** `app/kab/akses-api/dokumentasi/page.tsx` — bagian baru "GET /backup" + daftar isi

---

### Tidak diubah
- `components/pengingat-backup.tsx` — sudah menampilkan jam (`formatTanggalJam`) dan nama. Backup via API akan tampil sebagai: *"Backup terakhir hari ini (21 Nov 2026, 17.30, oleh Bot: DASBOT)."*

