-- =====================================================================
-- SMART LTT — 0014: Target PM AAS per Kecamatan (16 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0013. Aman diulang.
--
-- Target ("kesanggupan tanam") PM AAS kini diisi per kecamatan per bulan (Admin Kab).
-- Target kabupaten = jumlah target kecamatan bulan itu. Bila bulan itu belum ada
-- rincian kecamatan, aplikasi memakai angka lama di ltt.target_pm_aas (0006).
-- =====================================================================
create table if not exists ltt.target_pm_aas_kecamatan (
  tahun         int not null check (tahun between 2000 and 2100),
  bulan         int not null check (bulan between 1 and 12),
  kecamatan_id  int not null references ltt.kecamatan(id) on delete cascade,
  target_tanam  numeric(12, 2) not null default 0 check (target_tanam >= 0),
  pembuat_id    uuid references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now(),
  primary key (tahun, bulan, kecamatan_id)
);

alter table ltt.target_pm_aas_kecamatan enable row level security;

drop policy if exists "target_pm_aas_kec dibaca anggota" on ltt.target_pm_aas_kecamatan;
create policy "target_pm_aas_kec dibaca anggota" on ltt.target_pm_aas_kecamatan
  for select to authenticated using (ltt.role_saya() is not null);

drop policy if exists "target_pm_aas_kec dikelola admin kab" on ltt.target_pm_aas_kecamatan;
create policy "target_pm_aas_kec dikelola admin kab" on ltt.target_pm_aas_kecamatan
  for all to authenticated
  using (ltt.role_saya() = 'admin_kab')
  with check (ltt.role_saya() = 'admin_kab');

grant select, insert, update, delete on ltt.target_pm_aas_kecamatan to authenticated;
grant all on ltt.target_pm_aas_kecamatan to service_role;

drop trigger if exists trg_updated_at on ltt.target_pm_aas_kecamatan;
create trigger trg_updated_at before update on ltt.target_pm_aas_kecamatan
  for each row execute function ltt.set_updated_at();

-- Kesanggupan Tanam PM AAS Nov–Des 2026 (pesan WA 16 Nov 2026)
insert into ltt.target_pm_aas_kecamatan (tahun, bulan, kecamatan_id, target_tanam)
select 2026, v.bulan, k.id, v.target
from (values
  ('BANJIT',      11, 181),    ('BANJIT',      12, 273.75),
  ('BUAY BAHUGA', 11, 163),    ('BUAY BAHUGA', 12, 264),
  ('BAHUGA',      11, 230),    ('BAHUGA',      12, 263),
  ('BUMI AGUNG',  11, 120),    ('BUMI AGUNG',  12, 375)
) as v(nama, bulan, target)
join ltt.kecamatan k on upper(trim(k.nama)) = v.nama
on conflict (tahun, bulan, kecamatan_id) do nothing;

-- Cek: harus 8 baris (4 kecamatan × 2 bulan). Kurang → nama kecamatan di master berbeda.
select t.tahun, t.bulan, k.nama, t.target_tanam
from ltt.target_pm_aas_kecamatan t join ltt.kecamatan k on k.id = t.kecamatan_id
order by t.tahun, t.bulan, k.nama;
