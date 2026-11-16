-- =====================================================================
-- SMART LTT — 0016: Push notifikasi PWA (16 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0015. Aman diulang.
--
-- ltt.push_langganan = satu baris per PERANGKAT/BROWSER yang mengizinkan notifikasi.
-- Notifikasi saat ini hanya untuk PPL (penyuluh / admin_bpp):
--   - pengingat harian bila target desa PADI bulan berjalan belum diisi.
-- Ditulis & dibaca HANYA oleh server (service role), dikunci ke user sesi di Server Action.
-- Role authenticated tidak diberi akses sama sekali (RLS aktif tanpa policy).
--
-- ltt.pengaturan = sakelar aplikasi (kunci → nilai jsonb). Dipakai untuk on/off notifikasi PPL
-- oleh Admin Kab (kunci 'notifikasi_ppl', nilai {"aktif": true/false}). Dibaca semua anggota.
-- =====================================================================

create table if not exists ltt.push_langganan (
  id               bigserial primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  endpoint         text not null unique,
  p256dh           text not null,
  auth             text not null,
  user_agent       text,
  dibuat           timestamptz not null default now(),
  terakhir_kirim   timestamptz
);
create index if not exists push_langganan_user_idx on ltt.push_langganan (user_id);

alter table ltt.push_langganan enable row level security;

revoke all on ltt.push_langganan from anon, authenticated;
grant all on ltt.push_langganan to service_role;
grant usage, select on sequence ltt.push_langganan_id_seq to service_role;

-- Pengaturan aplikasi -------------------------------------------------
create table if not exists ltt.pengaturan (
  kunci        text primary key,
  nilai        jsonb not null default '{}'::jsonb,
  diubah_oleh  uuid references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now()
);

alter table ltt.pengaturan enable row level security;

drop policy if exists "pengaturan dibaca anggota" on ltt.pengaturan;
create policy "pengaturan dibaca anggota" on ltt.pengaturan
  for select to authenticated using (ltt.role_saya() is not null);

drop policy if exists "pengaturan dikelola admin kab" on ltt.pengaturan;
create policy "pengaturan dikelola admin kab" on ltt.pengaturan
  for all to authenticated
  using (ltt.role_saya() = 'admin_kab')
  with check (ltt.role_saya() = 'admin_kab');

grant select, insert, update on ltt.pengaturan to authenticated;
grant all on ltt.pengaturan to service_role;

drop trigger if exists trg_updated_at on ltt.pengaturan;
create trigger trg_updated_at before update on ltt.pengaturan
  for each row execute function ltt.set_updated_at();

-- Default: notifikasi PPL AKTIF
insert into ltt.pengaturan (kunci, nilai) values ('notifikasi_ppl', '{"aktif": true}')
on conflict (kunci) do nothing;

-- Cek
select 'push_langganan' as cek, count(*) from ltt.push_langganan
union all
select 'pengaturan', count(*) from ltt.pengaturan;
