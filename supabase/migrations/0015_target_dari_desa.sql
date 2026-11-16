-- =====================================================================
-- SMART LTT — 0015: Target per tahun, diisi PPL per desa + Target Provinsi (16 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0014. Aman diulang.
--
-- 1. target_desa dapat kolom TAHUN (data lama → 2026). Kunci: (tahun, bulan, desa, komoditas).
-- 2. Target desa hanya boleh DITULIS PPL (penyuluh / admin_bpp di mode PPL) untuk
--    DESA BINAANNYA sendiri. Semua anggota tetap boleh membaca.
-- 3. Target kecamatan = jumlah target desa (view v_target_kecamatan);
--    target kabupaten = jumlah target kecamatan (v_target_kabupaten).
-- 4. Tabel baru ltt.target_provinsi: target tiap kecamatan yang DITETAPKAN PROVINSI
--    (bukan penjumlahan desa), diisi Admin Kab per tahun+bulan+komoditas.
--    Isi awal = angka lama ltt.target_kecamatan (dulu diisi BPP), tahun 2026.
-- 5. Tabel lama ltt.target_kecamatan dibiarkan sebagai arsip (tidak bisa ditulis lagi).
-- =====================================================================

-- 1. Kolom tahun di target_desa ----------------------------------------
alter table ltt.target_desa add column if not exists tahun int;
update ltt.target_desa set tahun = 2026 where tahun is null;
alter table ltt.target_desa alter column tahun set not null;
alter table ltt.target_desa drop constraint if exists target_desa_tahun_valid;
alter table ltt.target_desa add constraint target_desa_tahun_valid check (tahun between 2000 and 2100);
alter table ltt.target_desa drop constraint if exists target_desa_unik;
alter table ltt.target_desa add constraint target_desa_unik unique (tahun, bulan, desa_id, komoditas);
drop index if exists ltt.idx_target_desa_bulan;
create index if not exists idx_target_desa_periode on ltt.target_desa (tahun, bulan, desa_id);

-- 2. Hak tulis target desa: hanya PPL di desa binaannya -----------------
drop policy if exists "target_desa dikelola sesuai wilayah" on ltt.target_desa;
drop policy if exists "target_desa dikelola ppl binaan" on ltt.target_desa;
create policy "target_desa dikelola ppl binaan" on ltt.target_desa
  for all to authenticated
  using (ltt.role_saya() in ('penyuluh', 'admin_bpp') and ltt.is_desa_binaan(desa_id))
  with check (ltt.role_saya() in ('penyuluh', 'admin_bpp') and ltt.is_desa_binaan(desa_id));
-- (policy "target_desa dibaca anggota" dari 0002 tetap berlaku)

revoke insert, update, delete on ltt.target_kecamatan from authenticated;

-- 3. View target kecamatan & kabupaten (penjumlahan target desa) --------
drop view if exists ltt.v_target_kabupaten;
drop view if exists ltt.v_target_kecamatan;

create view ltt.v_target_kecamatan
with (security_invoker = true) as
select
  t.tahun,
  t.bulan,
  d.kecamatan_id,
  t.komoditas,
  coalesce(sum(t.target_tanam), 0) as target_tanam,
  coalesce(sum(t.target_panen), 0) as target_panen,
  count(distinct t.desa_id)        as jumlah_desa_terisi
from ltt.target_desa t
join ltt.desa d on d.id = t.desa_id
group by t.tahun, t.bulan, d.kecamatan_id, t.komoditas;

create view ltt.v_target_kabupaten
with (security_invoker = true) as
select
  tahun,
  bulan,
  komoditas,
  coalesce(sum(target_tanam), 0) as target_tanam,
  coalesce(sum(target_panen), 0) as target_panen,
  count(distinct kecamatan_id)   as jumlah_kecamatan_terisi
from ltt.v_target_kecamatan
group by tahun, bulan, komoditas;

grant select on ltt.v_target_kecamatan, ltt.v_target_kabupaten to authenticated, service_role;

-- 4. Target Provinsi per kecamatan (diisi Admin Kab) --------------------
create table if not exists ltt.target_provinsi (
  tahun         int not null check (tahun between 2000 and 2100),
  bulan         int not null check (bulan between 1 and 12),
  kecamatan_id  int not null references ltt.kecamatan(id) on delete cascade,
  komoditas     text not null check (komoditas in ('Padi', 'Jagung', 'Ubi Kayu')),
  target_tanam  numeric(12, 2) not null default 0 check (target_tanam >= 0),
  target_panen  numeric(12, 2) not null default 0 check (target_panen >= 0),
  pembuat_id    uuid references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now(),
  primary key (tahun, bulan, kecamatan_id, komoditas)
);

alter table ltt.target_provinsi enable row level security;

drop policy if exists "target_provinsi dibaca anggota" on ltt.target_provinsi;
create policy "target_provinsi dibaca anggota" on ltt.target_provinsi
  for select to authenticated using (ltt.role_saya() is not null);

drop policy if exists "target_provinsi dikelola admin kab" on ltt.target_provinsi;
create policy "target_provinsi dikelola admin kab" on ltt.target_provinsi
  for all to authenticated
  using (ltt.role_saya() = 'admin_kab')
  with check (ltt.role_saya() = 'admin_kab');

grant select, insert, update, delete on ltt.target_provinsi to authenticated;
grant all on ltt.target_provinsi to service_role;

drop trigger if exists trg_updated_at on ltt.target_provinsi;
create trigger trg_updated_at before update on ltt.target_provinsi
  for each row execute function ltt.set_updated_at();

-- Isi awal dari target kecamatan lama (dipakai tabel format Provinsi sebelumnya)
insert into ltt.target_provinsi (tahun, bulan, kecamatan_id, komoditas, target_tanam, target_panen)
select 2026, bulan, kecamatan_id, komoditas, target_tanam, target_panen
from ltt.target_kecamatan
on conflict (tahun, bulan, kecamatan_id, komoditas) do nothing;

-- Cek
select 'target_desa tanpa tahun' as cek, count(*) from ltt.target_desa where tahun is null
union all
select 'target_provinsi', count(*) from ltt.target_provinsi;
