-- =====================================================================
-- SMART LTT — 0002: Skema Data LTT, Target, Produktivitas, Sarana & Rekap
-- =====================================================================
-- Sesuai Keputusan User (docs/logika-bisnis.md §25):
-- 1. Fitur verifikasi DIHAPUS (laporan langsung tercatat, tanpa status verif).
-- 2. Target TANPA TAHUN (siklus bulan 1-12, ditimpa saat update).
-- 3. Target 3 level: Desa (input PPL/BPP), Kecamatan (input Admin BPP),
--    Kabupaten (view otomatis penjumlahan dari kecamatan).
-- 4. Padi dan Palawija bersatu di satu tabel `ltt.laporan_ltt`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Master Jenis LTT (Reguler, Oplah, Padi Gogo, CSR, Rehab Bencana)
-- ---------------------------------------------------------------------
create table if not exists ltt.jenis_ltt (
  id          serial primary key,
  nama        text not null,
  komoditas   text not null check (komoditas in ('Padi', 'Jagung', 'Ubi Kayu')),
  kode        text,
  urutan      int default 0,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (nama, komoditas)
);

-- Data awal jenis LTT
insert into ltt.jenis_ltt (nama, komoditas, urutan) values
  ('LTT Reguler', 'Padi', 1),
  ('LTT Padi Gogo', 'Padi', 2),
  ('LTT Oplah 2024', 'Padi', 3),
  ('LTT Oplah 2025', 'Padi', 4),
  ('LTT Oplah 2026', 'Padi', 5),
  ('LTT CSR', 'Padi', 6),
  ('LTT Rehab Bencana', 'Padi', 7),
  ('LTT', 'Jagung', 10),
  ('LTT', 'Ubi Kayu', 20)
on conflict (nama, komoditas) do nothing;

-- ---------------------------------------------------------------------
-- 2. Tabel Utama: Laporan LTT (Padi, Jagung, Ubi Kayu)
-- ---------------------------------------------------------------------
create table if not exists ltt.laporan_ltt (
  id                bigserial primary key,
  id_lama           text unique,          -- ID_Laporan lama dari Google Sheets (jejak ETL)
  tanggal_lapor     timestamptz not null,
  pelapor_id        uuid references auth.users(id) on delete set null,
  nama_pelapor      text,
  nip_pelapor       text,
  desa_id           int not null references ltt.desa(id),
  komoditas         text not null check (komoditas in ('Padi', 'Jagung', 'Ubi Kayu')),
  jenis_ltt_id      int references ltt.jenis_ltt(id),
  
  -- Luas (Hektare)
  target_tanam      numeric(12, 2) not null default 0,
  target_panen      numeric(12, 2) not null default 0,
  luas_bera         numeric(12, 2) not null default 0,
  realisasi_olah    numeric(12, 2) not null default 0,
  realisasi_tanam   numeric(12, 2) not null default 0,
  realisasi_panen   numeric(12, 2) not null default 0,
  
  metode_penanaman  text,                 -- 'Regular' | 'PM AAS' | null
  keterangan        text,
  sumber            text not null default 'manual' check (sumber in ('manual', 'epusluh')),
  dihapus_pada      timestamptz,          -- Soft-delete
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Index performa query rekap & filter
create index if not exists idx_laporan_ltt_tanggal on ltt.laporan_ltt (tanggal_lapor);
create index if not exists idx_laporan_ltt_desa_komoditas on ltt.laporan_ltt (desa_id, komoditas, tanggal_lapor);
create index if not exists idx_laporan_ltt_pelapor on ltt.laporan_ltt (pelapor_id);
create index if not exists idx_laporan_ltt_sumber on ltt.laporan_ltt (sumber);

-- ---------------------------------------------------------------------
-- 3. Target Wilayah (Tanpa Tahun, Siklus 12 Bulan)
-- ---------------------------------------------------------------------

-- 3a. Target Desa (diisi PPL / Admin BPP)
create table if not exists ltt.target_desa (
  id                  serial primary key,
  bulan               int not null check (bulan between 1 and 12),
  desa_id             int not null references ltt.desa(id),
  komoditas           text not null check (komoditas in ('Padi', 'Jagung', 'Ubi Kayu')),
  jenis_ltt_id        int references ltt.jenis_ltt(id),
  target_tanam        numeric(12, 2) not null default 0,
  target_panen        numeric(12, 2) not null default 0,
  ip_eksisting        numeric(6, 2),
  luas_baku           numeric(12, 2),
  luas_standing_crop  numeric(12, 2),
  pembuat_id          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (bulan, desa_id, komoditas, jenis_ltt_id)
);

create index if not exists idx_target_desa_bulan on ltt.target_desa (bulan, desa_id);

-- 3b. Target Kecamatan (diisi Admin BPP / koordinator)
create table if not exists ltt.target_kecamatan (
  id            serial primary key,
  bulan         int not null check (bulan between 1 and 12),
  kecamatan_id  int not null references ltt.kecamatan(id),
  komoditas     text not null check (komoditas in ('Padi', 'Jagung', 'Ubi Kayu')),
  target_tanam  numeric(12, 2) not null default 0,
  target_panen  numeric(12, 2) not null default 0,
  pembuat_id    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (bulan, kecamatan_id, komoditas)
);

-- 3c. View Target Kabupaten (Otomatis penjumlahan target kecamatan)
create or replace view ltt.v_target_kabupaten as
select
  bulan,
  komoditas,
  coalesce(sum(target_tanam), 0) as target_tanam,
  coalesce(sum(target_panen), 0) as target_panen,
  count(distinct kecamatan_id) as jumlah_kecamatan_terisi
from ltt.target_kecamatan
group by bulan, komoditas;

-- ---------------------------------------------------------------------
-- 4. Produktivitas & Sarana per Desa
-- ---------------------------------------------------------------------
create table if not exists ltt.produktivitas_desa (
  bulan         int not null check (bulan between 1 and 12),
  desa_id       int not null references ltt.desa(id),
  komoditas     text not null check (komoditas in ('Padi', 'Jagung', 'Ubi Kayu')),
  nilai         numeric(6, 2) not null check (nilai between 0 and 100),
  penginput_id  uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (bulan, desa_id, komoditas)
);

create table if not exists ltt.sarana_desa (
  desa_id          int primary key references ltt.desa(id),
  gudang_gabah     int not null default 0 check (gudang_gabah >= 0),
  embung           int not null default 0 check (embung >= 0),
  lantai_jemur     int not null default 0 check (lantai_jemur >= 0),
  mesin_pengering  int not null default 0 check (mesin_pengering >= 0),
  penginput_id     uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. Logs Sinkron e-Pusluh (dari bot cron VPS)
-- ---------------------------------------------------------------------
create table if not exists ltt.logs_sinkron (
  id              bigserial primary key,
  waktu           timestamptz not null default now(),
  total_tarik     int not null default 0,
  data_berisi     int not null default 0,
  data_nihil      int not null default 0,
  tanggal_laporan date,
  status          text not null,
  keterangan      jsonb
);

-- ---------------------------------------------------------------------
-- 6. SQL Views untuk Rekap Cepat
-- ---------------------------------------------------------------------

-- 6a. Ringkasan Harian (pengganti tabel Ringkasan_Harian GAS)
create or replace view ltt.v_ringkasan_harian as
select
  date(l.tanggal_lapor at time zone 'Asia/Jakarta') as tanggal,
  d.kecamatan_id,
  l.desa_id,
  l.komoditas,
  l.jenis_ltt_id,
  coalesce(sum(l.realisasi_tanam), 0) as total_tanam,
  coalesce(sum(l.realisasi_panen), 0) as total_panen,
  coalesce(sum(l.luas_bera), 0) as total_bera,
  coalesce(sum(l.realisasi_olah), 0) as total_olah,
  count(*) as jumlah_laporan
from ltt.laporan_ltt l
join ltt.desa d on d.id = l.desa_id
where l.dihapus_pada is null
group by
  date(l.tanggal_lapor at time zone 'Asia/Jakarta'),
  d.kecamatan_id,
  l.desa_id,
  l.komoditas,
  l.jenis_ltt_id;

-- 6b. Rekap Bulanan per Kecamatan & Komoditas
create or replace view ltt.v_rekap_bulanan_kecamatan as
select
  extract(year from (l.tanggal_lapor at time zone 'Asia/Jakarta'))::int as tahun,
  extract(month from (l.tanggal_lapor at time zone 'Asia/Jakarta'))::int as bulan,
  d.kecamatan_id,
  k.nama as nama_kecamatan,
  l.komoditas,
  coalesce(sum(l.realisasi_tanam), 0) as total_tanam,
  coalesce(sum(l.realisasi_panen), 0) as total_panen,
  count(distinct l.desa_id) as jumlah_desa_lapor,
  count(*) as jumlah_laporan
from ltt.laporan_ltt l
join ltt.desa d on d.id = l.desa_id
join ltt.kecamatan k on k.id = d.kecamatan_id
where l.dihapus_pada is null
group by
  extract(year from (l.tanggal_lapor at time zone 'Asia/Jakarta'))::int,
  extract(month from (l.tanggal_lapor at time zone 'Asia/Jakarta'))::int,
  d.kecamatan_id,
  k.nama,
  l.komoditas;

-- ---------------------------------------------------------------------
-- 7. Helper RLS & Hak Akses
-- ---------------------------------------------------------------------

-- Cek apakah desa termasuk desa binaan penyuluh yang sedang login
create or replace function ltt.is_desa_binaan(p_desa_id int)
returns boolean
language sql stable security definer
set search_path = ltt, public
as $$
  select exists (
    select 1 from ltt.anggota_desa ad
    where ad.user_id = auth.uid() and ad.desa_id = p_desa_id
  );
$$;

-- Cek apakah kecamatan sesuai dengan kecamatan anggota yang login
create or replace function ltt.is_kecamatan_saya(p_kecamatan_id int)
returns boolean
language sql stable security definer
set search_path = ltt, public
as $$
  select exists (
    select 1 from ltt.anggota a
    where a.user_id = auth.uid() and a.kecamatan_id = p_kecamatan_id
  );
$$;

-- Hak Akses Tabel
grant select on ltt.jenis_ltt to authenticated;
grant select, insert, update on ltt.laporan_ltt to authenticated;
grant select, insert, update on ltt.target_desa to authenticated;
grant select, insert, update on ltt.target_kecamatan to authenticated;
grant select on ltt.v_target_kabupaten to authenticated;
grant select, insert, update on ltt.produktivitas_desa to authenticated;
grant select, insert, update on ltt.sarana_desa to authenticated;
grant select on ltt.v_ringkasan_harian to authenticated;
grant select on ltt.v_rekap_bulanan_kecamatan to authenticated;

-- Service Role Full Akses (untuk backend / cron VPS / skrip migrasi)
grant all on all tables in schema ltt to service_role;
grant usage, select on all sequences in schema ltt to service_role;

-- ---------------------------------------------------------------------
-- 8. Kebijakan Row Level Security (RLS)
-- ---------------------------------------------------------------------
alter table ltt.jenis_ltt           enable row level security;
alter table ltt.laporan_ltt         enable row level security;
alter table ltt.target_desa         enable row level security;
alter table ltt.target_kecamatan    enable row level security;
alter table ltt.produktivitas_desa  enable row level security;
alter table ltt.sarana_desa         enable row level security;
alter table ltt.logs_sinkron        enable row level security;

-- Jenis LTT: dibaca semua anggota yang login
create policy "jenis_ltt dibaca anggota" on ltt.jenis_ltt
  for select to authenticated using (ltt.role_saya() is not null);

-- Laporan LTT:
-- - Semua anggota bisa membaca laporan (transparansi data LTT se-kabupaten)
-- - Penyuluh hanya bisa input/edit untuk desa binaannya sendiri
-- - Admin BPP bisa input/edit di kecamatannya
-- - Admin Kab bisa kelola semua
create policy "laporan_ltt dibaca semua anggota" on ltt.laporan_ltt
  for select to authenticated using (ltt.role_saya() is not null);

create policy "laporan_ltt ditulis sesuai hak wilayah" on ltt.laporan_ltt
  for insert to authenticated with check (
    ltt.role_saya() in ('Admin_Kab')
    or (ltt.role_saya() = 'Admin_BPP' and ltt.is_kecamatan_saya((select kecamatan_id from ltt.desa where id = desa_id)))
    or (ltt.role_saya() = 'Penyuluh' and ltt.is_desa_binaan(desa_id))
  );

create policy "laporan_ltt diubah sesuai hak wilayah" on ltt.laporan_ltt
  for update to authenticated using (
    ltt.role_saya() in ('Admin_Kab')
    or (ltt.role_saya() = 'Admin_BPP' and ltt.is_kecamatan_saya((select kecamatan_id from ltt.desa where id = desa_id)))
    or (ltt.role_saya() = 'Penyuluh' and ltt.is_desa_binaan(desa_id) and pelapor_id = auth.uid())
  );

-- Target Desa:
create policy "target_desa dibaca anggota" on ltt.target_desa
  for select to authenticated using (ltt.role_saya() is not null);

create policy "target_desa dikelola bpp dan kab" on ltt.target_desa
  for all to authenticated using (
    ltt.role_saya() in ('Admin_Kab')
    or (ltt.role_saya() in ('Admin_BPP', 'Penyuluh') and ltt.is_kecamatan_saya((select kecamatan_id from ltt.desa where id = desa_id)))
  );

-- Target Kecamatan:
create policy "target_kecamatan dibaca anggota" on ltt.target_kecamatan
  for select to authenticated using (ltt.role_saya() is not null);

create policy "target_kecamatan dikelola bpp dan kab" on ltt.target_kecamatan
  for all to authenticated using (
    ltt.role_saya() in ('Admin_Kab')
    or (ltt.role_saya() = 'Admin_BPP' and ltt.is_kecamatan_saya(kecamatan_id))
  );

-- Produktivitas & Sarana:
create policy "produktivitas dibaca anggota" on ltt.produktivitas_desa
  for select to authenticated using (ltt.role_saya() is not null);

create policy "produktivitas ditulis sesuai wilayah" on ltt.produktivitas_desa
  for all to authenticated using (
    ltt.role_saya() in ('Admin_Kab')
    or (ltt.role_saya() in ('Admin_BPP', 'Penyuluh') and ltt.is_kecamatan_saya((select kecamatan_id from ltt.desa where id = desa_id)))
  );

create policy "sarana dibaca anggota" on ltt.sarana_desa
  for select to authenticated using (ltt.role_saya() is not null);

create policy "sarana ditulis sesuai wilayah" on ltt.sarana_desa
  for all to authenticated using (
    ltt.role_saya() in ('Admin_Kab')
    or (ltt.role_saya() in ('Admin_BPP', 'Penyuluh') and ltt.is_kecamatan_saya((select kecamatan_id from ltt.desa where id = desa_id)))
  );

-- Logs Sinkron:
create policy "logs dibaca admin kab dan bpp" on ltt.logs_sinkron
  for select to authenticated using (ltt.role_saya() in ('Admin_Kab', 'Admin_BPP'));

