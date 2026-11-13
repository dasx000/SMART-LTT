-- =====================================================================
-- SMART LTT — 0001: schema `ltt` + dasar akun/akses
-- Project Supabase DIPAKAI BERSAMA (CWS, TANIKU, ...). Pola:
--   core.profiles     = identitas lintas-app (id, email, nama, nip)  [sudah ada]
--   core.apps         = daftar aplikasi                               [sudah ada]
--   core.memberships  = role user per aplikasi (app_slug, role)      [sudah ada]
--   ltt.*             = data khusus SMART LTT                         [file ini]
-- File ini HANYA MENAMBAH (tidak mengubah/menghapus tabel core/cws/taniku).
-- Jalankan di Supabase → SQL Editor. Aman dijalankan ulang.
-- Setelah itu: Settings → API → "Exposed schemas" → tambahkan `ltt`.
-- =====================================================================

create schema if not exists ltt;

-- Daftarkan aplikasi di core.apps
insert into core.apps (slug, name, is_active)
values ('ltt', 'SMART LTT', true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Wilayah (isi lengkap dari Data_Geografi saat ETL, Fase 3)
-- ---------------------------------------------------------------------
create table if not exists ltt.kecamatan (
  id          serial primary key,
  kode        text unique,
  nama        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists ltt.desa (
  id            serial primary key,
  kode          text unique,
  kecamatan_id  int not null references ltt.kecamatan(id),
  nama          text not null,
  created_at    timestamptz not null default now(),
  unique (kecamatan_id, nama)
);

-- ---------------------------------------------------------------------
-- Anggota SMART LTT = data user khusus aplikasi ini.
-- Identitas (nama, nip, email) tetap di core.profiles; role di core.memberships.
-- ---------------------------------------------------------------------
create table if not exists ltt.anggota (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  kecamatan_id          int references ltt.kecamatan(id),
  whatsapp              text,
  aktif                 boolean not null default true,
  wajib_ganti_password  boolean not null default true,
  id_lama               text unique,          -- ID_User dari spreadsheet (jejak ETL)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists ltt.anggota_desa (
  user_id  uuid not null references ltt.anggota(user_id) on delete cascade,
  desa_id  int  not null references ltt.desa(id),
  primary key (user_id, desa_id)
);

-- ---------------------------------------------------------------------
-- Role SMART LTT di core.memberships (app_slug = 'ltt'):
--   'Penyuluh' | 'Admin_BPP' | 'Admin_Kab' | 'Dinas'
-- ---------------------------------------------------------------------
create or replace function ltt.role_saya()
returns text
language sql stable security definer
set search_path = core, ltt, public
as $$
  select m.role from core.memberships m
  where m.user_id = auth.uid() and m.app_slug = 'ltt'
  limit 1;
$$;

-- Profil gabungan user yang sedang login (dipakai lib/auth.ts).
create or replace function ltt.pengguna_saya()
returns table (
  id uuid, nip text, nama text, role text,
  kecamatan_id int, aktif boolean, wajib_ganti_password boolean
)
language sql stable security definer
set search_path = core, ltt, public
as $$
  select p.id, p.nip, p.nama, m.role, a.kecamatan_id, a.aktif, a.wajib_ganti_password
  from core.profiles p
  join core.memberships m on m.user_id = p.id and m.app_slug = 'ltt'
  join ltt.anggota a      on a.user_id = p.id
  where p.id = auth.uid();
$$;

-- Cari email dari NIP untuk login. HANYA untuk service role (dipanggil di server),
-- tidak dibuka ke anon/authenticated agar NIP tidak bisa dipakai menebak email.
create or replace function ltt.resolve_login_email(p_nip text)
returns text
language sql stable security definer
set search_path = core, public
as $$
  select p.email from core.profiles p
  where p.nip = trim(p_nip)
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- Hak akses
-- ---------------------------------------------------------------------
grant usage on schema ltt to authenticated, service_role;

revoke all on function ltt.resolve_login_email(text) from public, anon, authenticated;
grant execute on function ltt.resolve_login_email(text) to service_role;

revoke all on function ltt.pengguna_saya() from public, anon;
grant execute on function ltt.pengguna_saya() to authenticated, service_role;

revoke all on function ltt.role_saya() from public, anon;
grant execute on function ltt.role_saya() to authenticated, service_role;

grant select on ltt.kecamatan, ltt.desa to authenticated;
grant select on ltt.anggota, ltt.anggota_desa to authenticated;
grant all on all tables in schema ltt to service_role;
grant usage, select on all sequences in schema ltt to service_role;

-- RLS: semua tabel ltt wajib RLS. Kebijakan lengkap per role menyusul (0002).
alter table ltt.kecamatan    enable row level security;
alter table ltt.desa         enable row level security;
alter table ltt.anggota      enable row level security;
alter table ltt.anggota_desa enable row level security;

drop policy if exists "wilayah dibaca anggota" on ltt.kecamatan;
create policy "wilayah dibaca anggota" on ltt.kecamatan
  for select to authenticated using (ltt.role_saya() is not null);

drop policy if exists "desa dibaca anggota" on ltt.desa;
create policy "desa dibaca anggota" on ltt.desa
  for select to authenticated using (ltt.role_saya() is not null);

drop policy if exists "anggota baca diri sendiri" on ltt.anggota;
create policy "anggota baca diri sendiri" on ltt.anggota
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "desa binaan diri sendiri" on ltt.anggota_desa;
create policy "desa binaan diri sendiri" on ltt.anggota_desa
  for select to authenticated using (user_id = auth.uid());
