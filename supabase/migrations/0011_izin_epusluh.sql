-- =====================================================================
-- SMART LTT — 0011: Izin kunci API "epusluh:tulis" (16 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0010. Aman diulang.
--
-- Sinkron padi e-Pusluh oleh bot memakai kunci API (menu Akses API) seperti endpoint lain,
-- menggantikan token tunggal EPUSLUH_INGEST_TOKEN. Endpoint: POST /api/v1/epusluh/padi.
-- =====================================================================

alter table ltt.api_klien drop constraint if exists api_klien_izin_check;
alter table ltt.api_klien add constraint api_klien_izin_check
  check (izin <@ array['pengguna:baca', 'wilayah:baca', 'laporan:baca', 'laporan:tulis', 'epusluh:tulis']::text[]);
