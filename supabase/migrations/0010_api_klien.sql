-- =====================================================================
-- SMART LTT — 0010: Kunci API untuk aplikasi luar (bot, dll.) (16 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0009. Aman diulang.
--
-- - Satu kunci per klien (mis. "Bot DASBOT"), bisa dicabut kapan saja tanpa mengganggu klien lain.
-- - Kunci TIDAK disimpan; hanya hash SHA-256-nya. Kunci asli ditampilkan sekali saat dibuat.
-- - Izin per kunci: pengguna:baca, wilayah:baca, laporan:baca, laporan:tulis.
-- - Kedua tabel hanya bisa diakses service role (RLS aktif tanpa policy); dikelola
--   lewat menu Akses API (Admin Kab) yang memeriksa role di server.
-- =====================================================================

create table if not exists ltt.api_klien (
  id                uuid primary key default gen_random_uuid(),
  nama              text not null check (length(btrim(nama)) between 2 and 80),
  awalan            text not null,                 -- 12 karakter awal kunci, untuk dikenali di daftar
  hash              text not null unique,          -- sha256(kunci) hex
  izin              text[] not null default '{}'
                    check (izin <@ array['pengguna:baca', 'wilayah:baca', 'laporan:baca', 'laporan:tulis']::text[]),
  aktif             boolean not null default true,
  dibuat_oleh       uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  terakhir_dipakai  timestamptz,
  dicabut_pada      timestamptz
);

create table if not exists ltt.api_log (
  id          bigserial primary key,
  klien_id    uuid references ltt.api_klien(id) on delete cascade,
  waktu       timestamptz not null default now(),
  metode      text not null,
  jalur       text not null,
  status      int not null,
  durasi_ms   int,
  catatan     text
);
create index if not exists api_log_klien_waktu_idx on ltt.api_log (klien_id, waktu desc);
create index if not exists api_log_waktu_idx on ltt.api_log (waktu desc);

alter table ltt.api_klien enable row level security;
alter table ltt.api_log   enable row level security;

revoke all on ltt.api_klien, ltt.api_log from anon, authenticated;
grant all on ltt.api_klien, ltt.api_log to service_role;
grant usage, select on sequence ltt.api_log_id_seq to service_role;
