-- =====================================================================
-- SMART LTT — 0022: Hapus fitur "Tandai Selesai" Pantau Tanaman (29 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH kode tanpa tombol Tandai Selesai
-- ter-deploy. Aman diulang.
--
-- Membatalkan 0021. Tombol Tandai Selesai ditiadakan karena kartu Pantau Tanaman
-- kini hilang otomatis setelah 150 hari sejak tanam. Tabel laporan_ltt TIDAK disentuh.
--
-- Isi saat dihapus (diperiksa 28 Nov 2026): 1 baris — NARYONO, Simpang Asam (Banjit),
-- Padi LTT Reguler/Regular tanam 2026-07-29, 6 ha. Dihapus atas keputusan pengguna.
-- =====================================================================

drop table if exists ltt.pantau_selesai;

-- Cek: harus kosong
select table_name from information_schema.tables
where table_schema = 'ltt' and table_name = 'pantau_selesai';
