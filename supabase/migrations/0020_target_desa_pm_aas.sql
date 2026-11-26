-- =====================================================================
-- SMART LTT — 0020: Target PM AAS per Desa (26 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0019. Aman diulang.
--
-- Target tanam/panen padi PM AAS per desa, per tahun+bulan, dirinci per jenis LTT.
-- Diisi PPL (penyuluh / admin_bpp mode PPL) untuk DESA BINAANNYA lewat halaman
-- PPL → Realisasi LTT (tombol PM-AAS). Tanpa LBS. Tidak dibatasi target padi desa.
-- Tabel target_desa (target semua metode) TIDAK berubah.
-- Desa dicatat lewat desa_id (bukan nama), jadi nama desa kembar antar-kecamatan aman.
-- =====================================================================

create table if not exists ltt.target_desa_pm_aas (
  id            serial primary key,
  tahun         int not null check (tahun between 2000 and 2100),
  bulan         int not null check (bulan between 1 and 12),
  desa_id       int not null references ltt.desa(id) on delete cascade,
  target_tanam  numeric(12, 2) not null default 0 check (target_tanam >= 0),
  target_panen  numeric(12, 2) not null default 0 check (target_panen >= 0),
  pembuat_id    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint target_desa_pm_aas_unik unique (tahun, bulan, desa_id)
);

create table if not exists ltt.target_desa_pm_aas_rincian (
  target_id     int not null references ltt.target_desa_pm_aas(id) on delete cascade,
  jenis_ltt_id  int not null references ltt.jenis_ltt(id),
  target_tanam  numeric(12, 2) not null default 0 check (target_tanam >= 0),
  target_panen  numeric(12, 2) not null default 0 check (target_panen >= 0),
  primary key (target_id, jenis_ltt_id)
);

-- RLS: semua anggota boleh membaca; tulis hanya PPL untuk desa binaannya ----
alter table ltt.target_desa_pm_aas enable row level security;
alter table ltt.target_desa_pm_aas_rincian enable row level security;

drop policy if exists "target_desa_pm_aas dibaca anggota" on ltt.target_desa_pm_aas;
create policy "target_desa_pm_aas dibaca anggota" on ltt.target_desa_pm_aas
  for select to authenticated using (ltt.role_saya() is not null);

drop policy if exists "target_desa_pm_aas dikelola ppl binaan" on ltt.target_desa_pm_aas;
create policy "target_desa_pm_aas dikelola ppl binaan" on ltt.target_desa_pm_aas
  for all to authenticated
  using (ltt.role_saya() in ('penyuluh', 'admin_bpp') and ltt.is_desa_binaan(desa_id))
  with check (ltt.role_saya() in ('penyuluh', 'admin_bpp') and ltt.is_desa_binaan(desa_id));

drop policy if exists "rincian pm aas dibaca anggota" on ltt.target_desa_pm_aas_rincian;
create policy "rincian pm aas dibaca anggota" on ltt.target_desa_pm_aas_rincian
  for select to authenticated using (ltt.role_saya() is not null);

drop policy if exists "rincian pm aas mengikuti target" on ltt.target_desa_pm_aas_rincian;
create policy "rincian pm aas mengikuti target" on ltt.target_desa_pm_aas_rincian
  for all to authenticated
  using (exists (
    select 1 from ltt.target_desa_pm_aas t
    where t.id = target_id and ltt.role_saya() in ('penyuluh', 'admin_bpp') and ltt.is_desa_binaan(t.desa_id)
  ))
  with check (exists (
    select 1 from ltt.target_desa_pm_aas t
    where t.id = target_id and ltt.role_saya() in ('penyuluh', 'admin_bpp') and ltt.is_desa_binaan(t.desa_id)
  ));

grant select, insert, update, delete on ltt.target_desa_pm_aas, ltt.target_desa_pm_aas_rincian to authenticated;
grant all on ltt.target_desa_pm_aas, ltt.target_desa_pm_aas_rincian to service_role;
grant usage, select on sequence ltt.target_desa_pm_aas_id_seq to authenticated, service_role;

drop trigger if exists trg_updated_at on ltt.target_desa_pm_aas;
create trigger trg_updated_at before update on ltt.target_desa_pm_aas
  for each row execute function ltt.set_updated_at();

-- Cek
select tablename, policyname, cmd from pg_policies
where schemaname = 'ltt' and tablename in ('target_desa_pm_aas', 'target_desa_pm_aas_rincian')
order by tablename, policyname;
