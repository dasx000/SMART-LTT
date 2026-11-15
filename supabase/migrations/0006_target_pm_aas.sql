-- =====================================================================
-- SMART LTT — 0006: Target PM AAS Kabupaten (15 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0005. Aman diulang.
--
-- Pengganti sheet Target_PmAas_Kabupaten (logika-bisnis §5): satu baris per tahun + bulan.
-- Dipakai Smart Dashboard (gauge PM-AAS) dan halaman LTT PM AAS ("Set Target", Admin Kab).
-- =====================================================================
create table if not exists ltt.target_pm_aas (
  tahun         int not null check (tahun between 2000 and 2100),
  bulan         int not null check (bulan between 1 and 12),
  target_tanam  numeric(12, 2) not null default 0 check (target_tanam >= 0),
  pembuat_id    uuid references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now(),
  primary key (tahun, bulan)
);

alter table ltt.target_pm_aas enable row level security;

drop policy if exists "target_pm_aas dibaca anggota" on ltt.target_pm_aas;
create policy "target_pm_aas dibaca anggota" on ltt.target_pm_aas
  for select to authenticated using (ltt.role_saya() is not null);

drop policy if exists "target_pm_aas dikelola admin kab" on ltt.target_pm_aas;
create policy "target_pm_aas dikelola admin kab" on ltt.target_pm_aas
  for all to authenticated
  using (ltt.role_saya() = 'admin_kab')
  with check (ltt.role_saya() = 'admin_kab');

grant select, insert, update on ltt.target_pm_aas to authenticated;
grant all on ltt.target_pm_aas to service_role;

drop trigger if exists trg_updated_at on ltt.target_pm_aas;
create trigger trg_updated_at before update on ltt.target_pm_aas
  for each row execute function ltt.set_updated_at();

-- Data dari sheet lama Target_PmAas_Kabupaten
insert into ltt.target_pm_aas (tahun, bulan, target_tanam) values
  (2026, 7, 100),
  (2026, 8, 60)
on conflict (tahun, bulan) do nothing;

select * from ltt.target_pm_aas order by tahun, bulan;
