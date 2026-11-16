-- =====================================================================
-- SMART LTT — 0013: Riwayat backup manual (16 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0012. Aman diulang.
--
-- Backup = tombol "Unduh Backup" di menu Backup Data (Admin Kab) → file .json.gz ke perangkat.
-- Tabel ini hanya mencatat SIAPA & KAPAN mengunduh, untuk pengingat "backup terakhir X hari lalu".
-- Diisi server dengan service role; dibaca Admin Kab.
-- =====================================================================

create table if not exists ltt.riwayat_backup (
  id            bigserial primary key,
  waktu         timestamptz not null default now(),
  pengguna_id   uuid references auth.users(id) on delete set null,
  nama          text,
  jumlah_baris  int  not null default 0,
  ukuran_byte   int  not null default 0
);
create index if not exists riwayat_backup_waktu_idx on ltt.riwayat_backup (waktu desc);

alter table ltt.riwayat_backup enable row level security;

drop policy if exists "riwayat_backup dibaca admin kab" on ltt.riwayat_backup;
create policy "riwayat_backup dibaca admin kab" on ltt.riwayat_backup
  for select to authenticated using (ltt.role_saya() = 'admin_kab');

grant select on ltt.riwayat_backup to authenticated;
grant all on ltt.riwayat_backup to service_role;
grant usage, select on sequence ltt.riwayat_backup_id_seq to service_role;

-- ---------------------------------------------------------------------
-- Setel ulang SEMUA sequence di schema ltt (dulu hanya kecamatan & desa).
-- Dipanggil skrip pemulihan backup setelah memasukkan baris dengan ID eksplisit,
-- agar data baru tidak bentrok ID.
-- ---------------------------------------------------------------------
create or replace function ltt.setel_ulang_sequence()
returns void language plpgsql security definer set search_path = ltt, public
as $$
declare
  r record;
begin
  for r in
    select c.relname as tabel, a.attname as kolom
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'ltt'
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    where c.relkind = 'r'
      and pg_get_serial_sequence(format('ltt.%I', c.relname), a.attname) is not null
  loop
    execute format(
      'select setval(pg_get_serial_sequence(%L, %L), coalesce((select max(%I) from ltt.%I), 0) + 1, false)',
      'ltt.' || r.tabel, r.kolom, r.kolom, r.tabel
    );
  end loop;
end $$;
revoke all on function ltt.setel_ulang_sequence() from public, anon, authenticated;
grant execute on function ltt.setel_ulang_sequence() to service_role;

-- Cek
select count(*) as riwayat_backup from ltt.riwayat_backup;
