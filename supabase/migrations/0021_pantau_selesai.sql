-- =====================================================================
-- SMART LTT — 0021: Kartu "Tandai Selesai" di Pantau Tanaman (28 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0020. Aman diulang.
--
-- Menyimpan kartu Pantau Tanaman (/ppl/tanaman) yang ditandai selesai oleh PPL,
-- supaya kartu itu tidak tampil lagi. HANYA menyembunyikan kartu —
-- tabel laporan_ltt TIDAK disentuh sama sekali.
--
-- Satu kartu = desa × komoditas × jenis LTT × metode × tanggal tanam.
-- luas_tanam & sisa disimpan saat ditandai: kartu MUNCUL LAGI kalau data
-- di tanggal itu diperbarui (luas tanam berubah, atau sisa belum panen bertambah),
-- mis. pembaruan data e-Pusluh di akhir bulan.
--
-- Permanen dari sisi aplikasi: PPL hanya bisa menandai (insert/update), tidak bisa
-- menghapus. Admin bisa memulihkan kartu dengan menghapus barisnya di Supabase.
-- =====================================================================

create table if not exists ltt.pantau_selesai (
  id             serial primary key,
  desa_id        int not null references ltt.desa(id) on delete cascade,
  komoditas      text not null check (komoditas in ('Padi', 'Jagung')),
  jenis_ltt      text not null,           -- nama jenis LTT (mis. 'LTT Reguler'), '-' bila kosong
  metode         text not null,           -- 'Regular' | 'PM AAS' | '-' (Jagung)
  tanggal_tanam  date not null,
  luas_tanam     numeric(12, 2) not null check (luas_tanam >= 0),  -- snapshot saat ditandai
  sisa           numeric(12, 2) not null check (sisa >= 0),        -- snapshot saat ditandai
  ditandai_oleh  uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint pantau_selesai_unik unique (desa_id, komoditas, jenis_ltt, metode, tanggal_tanam)
);

create index if not exists idx_pantau_selesai_desa on ltt.pantau_selesai(desa_id);

-- RLS: PPL baca & tandai hanya untuk desa binaannya; tidak ada policy delete ----
alter table ltt.pantau_selesai enable row level security;

drop policy if exists "pantau_selesai dibaca ppl binaan" on ltt.pantau_selesai;
create policy "pantau_selesai dibaca ppl binaan" on ltt.pantau_selesai
  for select to authenticated
  using (ltt.role_saya() in ('penyuluh', 'admin_bpp') and ltt.is_desa_binaan(desa_id));

drop policy if exists "pantau_selesai ditandai ppl binaan" on ltt.pantau_selesai;
create policy "pantau_selesai ditandai ppl binaan" on ltt.pantau_selesai
  for insert to authenticated
  with check (ltt.role_saya() in ('penyuluh', 'admin_bpp') and ltt.is_desa_binaan(desa_id));

drop policy if exists "pantau_selesai diperbarui ppl binaan" on ltt.pantau_selesai;
create policy "pantau_selesai diperbarui ppl binaan" on ltt.pantau_selesai
  for update to authenticated
  using (ltt.role_saya() in ('penyuluh', 'admin_bpp') and ltt.is_desa_binaan(desa_id))
  with check (ltt.role_saya() in ('penyuluh', 'admin_bpp') and ltt.is_desa_binaan(desa_id));

grant select, insert, update on ltt.pantau_selesai to authenticated;
grant all on ltt.pantau_selesai to service_role;
grant usage, select on sequence ltt.pantau_selesai_id_seq to authenticated, service_role;

drop trigger if exists trg_updated_at on ltt.pantau_selesai;
create trigger trg_updated_at before update on ltt.pantau_selesai
  for each row execute function ltt.set_updated_at();

-- Cek
select tablename, policyname, cmd from pg_policies
where schemaname = 'ltt' and tablename = 'pantau_selesai'
order by policyname;
