-- =====================================================================
-- SMART LTT — 0018: Tambah izin "backup:baca" untuk API key (21 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0017. Aman diulang.
--
-- Kunci API yang diberi izin "backup:baca" bisa mengunduh backup data
-- lewat endpoint GET /api/v1/backup (untuk bot VPS / cronjob otomatis).
-- =====================================================================

-- Perluas constraint izin di api_klien agar menerima 'backup:baca'
alter table ltt.api_klien
  drop constraint if exists api_klien_izin_check;

alter table ltt.api_klien
  add constraint api_klien_izin_check
  check (izin <@ array[
    'pengguna:baca',
    'wilayah:baca',
    'laporan:baca',
    'laporan:tulis',
    'epusluh:tulis',
    'unduh:baca',
    'backup:baca'
  ]::text[]);

-- Tambah kolom sumber di riwayat_backup (agar tahu backup dari mana: manual / api)
alter table ltt.riwayat_backup
  add column if not exists sumber text not null default 'manual'
  check (sumber in ('manual', 'api'));

-- Tambah kolom klien_id di riwayat_backup (referensi ke api_klien, untuk backup via API)
alter table ltt.riwayat_backup
  add column if not exists klien_id uuid references ltt.api_klien(id) on delete set null;

-- Cek
select
  conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'ltt.api_klien'::regclass and conname = 'api_klien_izin_check';

