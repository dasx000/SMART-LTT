-- =====================================================================
-- SMART LTT — 0016: Izin kunci API "unduh:baca" (17 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0011. Aman diulang.
--
-- Bot mengambil spesifikasi Excel yang sama dengan tombol unduh aplikasi
-- (Rekap Dinas & Laporan LTT). Endpoint: GET /api/v1/unduh/<jenis>.
-- =====================================================================

alter table ltt.api_klien drop constraint if exists api_klien_izin_check;
alter table ltt.api_klien add constraint api_klien_izin_check
  check (izin <@ array['pengguna:baca', 'wilayah:baca', 'laporan:baca', 'laporan:tulis', 'epusluh:tulis', 'unduh:baca']::text[]);
