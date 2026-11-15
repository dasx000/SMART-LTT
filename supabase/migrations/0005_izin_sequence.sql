-- =====================================================================
-- SMART LTT — 0005: izin sequence untuk user login (15 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0004. Aman diulang.
--
-- Bug ditemukan saat uji role: PPL tidak bisa mengirim laporan baru
--   "permission denied for sequence laporan_ltt_id_seq"
-- karena role `authenticated` hanya diberi izin tabel, bukan sequence id-nya.
-- Hanya tabel yang memang di-INSERT oleh user (lewat RLS) yang diberi izin.
-- log_perubahan diisi trigger SECURITY DEFINER → tidak perlu.
-- =====================================================================
grant usage, select on sequence ltt.laporan_ltt_id_seq      to authenticated;
grant usage, select on sequence ltt.target_desa_id_seq      to authenticated;
grant usage, select on sequence ltt.target_kecamatan_id_seq to authenticated;

-- Cek hasil (harus 3 baris, semua true)
select s as sequence, has_sequence_privilege('authenticated', s, 'USAGE') as boleh
from unnest(array['ltt.laporan_ltt_id_seq', 'ltt.target_desa_id_seq', 'ltt.target_kecamatan_id_seq']) s;
