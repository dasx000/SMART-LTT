-- =====================================================================
-- SMART LTT — 0003: Perbaikan hasil review 0002 (15 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0001 & 0002.
-- Aman karena tabel data ltt.* masih kosong (belum ada impor).
-- Idempoten: boleh dijalankan ulang bila sebelumnya gagal di tengah.
-- Tidak menyentuh schema core / cws / taniku / alsintan.
--
-- Isi:
--  1. Target desa: 1 baris per (bulan, desa, komoditas) + tabel rincian per jenis (padi)
--  2. Produktivitas: tambah kolom TAHUN (produktivitas berbeda tiap tahun)
--  3. View: security_invoker (tanpa ini view MELEWATI RLS → akun aplikasi lain
--     di project bersama bisa membaca data LTT)
--  4. RLS: Penyuluh/Admin_BPP hanya menulis produktivitas & sarana DESA BINAAN-nya
--     (aturan lama), kebijakan tulis memakai WITH CHECK eksplisit
--  5. Fungsi ltt.sinkron_padi(): hapus + sisip data padi e-Pusluh per tanggal
--     dalam SATU transaksi (dipanggil endpoint bot VPS, service role saja)
--  6. Jejak perubahan (ltt.log_perubahan) + updated_at otomatis
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Target desa
-- ---------------------------------------------------------------------
alter table ltt.target_desa drop constraint if exists target_desa_bulan_desa_id_komoditas_jenis_ltt_id_key;
alter table ltt.target_desa drop column if exists jenis_ltt_id;
alter table ltt.target_desa drop constraint if exists target_desa_unik;
alter table ltt.target_desa add constraint target_desa_unik unique (bulan, desa_id, komoditas);

-- Rincian target padi per jenis LTT (Reguler, Gogo, Oplah, CSR, Rehab Bencana).
-- Total di target_desa tetap disimpan (aturan lama: total diisi/ dihitung di form).
create table if not exists ltt.target_desa_rincian (
  target_desa_id  int not null references ltt.target_desa(id) on delete cascade,
  jenis_ltt_id    int not null references ltt.jenis_ltt(id),
  target_tanam    numeric(12, 2) not null default 0 check (target_tanam >= 0),
  target_panen    numeric(12, 2) not null default 0 check (target_panen >= 0),
  primary key (target_desa_id, jenis_ltt_id)
);

alter table ltt.target_desa
  drop constraint if exists target_desa_nilai_positif,
  add constraint target_desa_nilai_positif check (target_tanam >= 0 and target_panen >= 0);
alter table ltt.target_kecamatan
  drop constraint if exists target_kecamatan_nilai_positif,
  add constraint target_kecamatan_nilai_positif check (target_tanam >= 0 and target_panen >= 0);

-- ---------------------------------------------------------------------
-- 2. Produktivitas per TAHUN
-- ---------------------------------------------------------------------
alter table ltt.produktivitas_desa add column if not exists tahun int;
update ltt.produktivitas_desa set tahun = extract(year from now())::int where tahun is null;
alter table ltt.produktivitas_desa alter column tahun set not null;
alter table ltt.produktivitas_desa drop constraint if exists produktivitas_desa_tahun_valid;
alter table ltt.produktivitas_desa add constraint produktivitas_desa_tahun_valid check (tahun between 2000 and 2100);
alter table ltt.produktivitas_desa drop constraint if exists produktivitas_desa_pkey;
alter table ltt.produktivitas_desa add primary key (tahun, bulan, desa_id, komoditas);

-- ---------------------------------------------------------------------
-- 3. Laporan: angka tidak boleh negatif
-- ---------------------------------------------------------------------
alter table ltt.laporan_ltt
  drop constraint if exists laporan_ltt_nilai_positif,
  add constraint laporan_ltt_nilai_positif check (
    target_tanam >= 0 and target_panen >= 0 and luas_bera >= 0
    and realisasi_olah >= 0 and realisasi_tanam >= 0 and realisasi_panen >= 0
  );
create index if not exists idx_laporan_ltt_aktif on ltt.laporan_ltt (tanggal_lapor) where dihapus_pada is null;

-- ---------------------------------------------------------------------
-- 4. View mengikuti RLS pemanggil
-- ---------------------------------------------------------------------
alter view ltt.v_target_kabupaten        set (security_invoker = true);
alter view ltt.v_ringkasan_harian        set (security_invoker = true);
alter view ltt.v_rekap_bulanan_kecamatan set (security_invoker = true);

-- ---------------------------------------------------------------------
-- 5. RLS: kebijakan tulis yang lebih ketat
-- ---------------------------------------------------------------------
create or replace function ltt.kecamatan_desa(p_desa_id int)
returns int language sql stable security definer set search_path = ltt, public
as $$ select kecamatan_id from ltt.desa where id = p_desa_id $$;

-- Laporan
drop policy if exists "laporan_ltt ditulis sesuai hak wilayah" on ltt.laporan_ltt;
create policy "laporan_ltt ditulis sesuai hak wilayah" on ltt.laporan_ltt
  for insert to authenticated with check (
    ltt.role_saya() = 'admin_kab'
    or (ltt.role_saya() in ('penyuluh', 'admin_bpp') and ltt.is_desa_binaan(desa_id) and pelapor_id = auth.uid())
  );

drop policy if exists "laporan_ltt diubah sesuai hak wilayah" on ltt.laporan_ltt;
create policy "laporan_ltt diubah sesuai hak wilayah" on ltt.laporan_ltt
  for update to authenticated
  using (
    ltt.role_saya() = 'admin_kab'
    or (ltt.role_saya() = 'admin_bpp' and ltt.is_kecamatan_saya(ltt.kecamatan_desa(desa_id)))
    or (ltt.role_saya() = 'penyuluh' and pelapor_id = auth.uid())
  )
  with check (
    ltt.role_saya() = 'admin_kab'
    or (ltt.role_saya() = 'admin_bpp' and ltt.is_kecamatan_saya(ltt.kecamatan_desa(desa_id)))
    or (ltt.role_saya() = 'penyuluh' and pelapor_id = auth.uid() and ltt.is_desa_binaan(desa_id))
  );

-- Target desa (+ rincian): Admin_Kab semua; Admin_BPP sekecamatan (isi target untuk PPL-nya);
-- Penyuluh hanya desa binaannya.
drop policy if exists "target_desa dikelola bpp dan kab" on ltt.target_desa;
drop policy if exists "target_desa dikelola sesuai wilayah" on ltt.target_desa;
create policy "target_desa dikelola sesuai wilayah" on ltt.target_desa
  for all to authenticated
  using (
    ltt.role_saya() = 'admin_kab'
    or (ltt.role_saya() = 'admin_bpp' and ltt.is_kecamatan_saya(ltt.kecamatan_desa(desa_id)))
    or (ltt.role_saya() = 'penyuluh' and ltt.is_desa_binaan(desa_id))
  )
  with check (
    ltt.role_saya() = 'admin_kab'
    or (ltt.role_saya() = 'admin_bpp' and ltt.is_kecamatan_saya(ltt.kecamatan_desa(desa_id)))
    or (ltt.role_saya() = 'penyuluh' and ltt.is_desa_binaan(desa_id))
  );

alter table ltt.target_desa_rincian enable row level security;
drop policy if exists "rincian dibaca anggota" on ltt.target_desa_rincian;
create policy "rincian dibaca anggota" on ltt.target_desa_rincian
  for select to authenticated using (ltt.role_saya() is not null);
drop policy if exists "rincian mengikuti target desa" on ltt.target_desa_rincian;
create policy "rincian mengikuti target desa" on ltt.target_desa_rincian
  for all to authenticated
  using (exists (select 1 from ltt.target_desa t where t.id = target_desa_id))   -- RLS target_desa ikut berlaku
  with check (exists (select 1 from ltt.target_desa t where t.id = target_desa_id));

-- Target kecamatan: Admin_BPP kecamatannya sendiri, Admin_Kab semua
drop policy if exists "target_kecamatan dikelola bpp dan kab" on ltt.target_kecamatan;
create policy "target_kecamatan dikelola bpp dan kab" on ltt.target_kecamatan
  for all to authenticated
  using (ltt.role_saya() = 'admin_kab' or (ltt.role_saya() = 'admin_bpp' and ltt.is_kecamatan_saya(kecamatan_id)))
  with check (ltt.role_saya() = 'admin_kab' or (ltt.role_saya() = 'admin_bpp' and ltt.is_kecamatan_saya(kecamatan_id)));

-- Produktivitas & sarana: hanya desa binaan sendiri (aturan lama logika-bisnis §20), Admin_Kab semua
drop policy if exists "produktivitas ditulis sesuai wilayah" on ltt.produktivitas_desa;
drop policy if exists "produktivitas ditulis desa binaan" on ltt.produktivitas_desa;
create policy "produktivitas ditulis desa binaan" on ltt.produktivitas_desa
  for all to authenticated
  using (ltt.role_saya() = 'admin_kab' or (ltt.role_saya() in ('penyuluh', 'admin_bpp') and ltt.is_desa_binaan(desa_id)))
  with check (ltt.role_saya() = 'admin_kab' or (ltt.role_saya() in ('penyuluh', 'admin_bpp') and ltt.is_desa_binaan(desa_id)));

drop policy if exists "sarana ditulis sesuai wilayah" on ltt.sarana_desa;
drop policy if exists "sarana ditulis desa binaan" on ltt.sarana_desa;
create policy "sarana ditulis desa binaan" on ltt.sarana_desa
  for all to authenticated
  using (ltt.role_saya() = 'admin_kab' or (ltt.role_saya() in ('penyuluh', 'admin_bpp') and ltt.is_desa_binaan(desa_id)))
  with check (ltt.role_saya() = 'admin_kab' or (ltt.role_saya() in ('penyuluh', 'admin_bpp') and ltt.is_desa_binaan(desa_id)));

-- Hak akses tabel/fungsi
grant select, insert, update, delete on ltt.target_desa_rincian to authenticated;
grant delete on ltt.target_desa to authenticated;
grant select on ltt.logs_sinkron to authenticated;            -- policy membatasi ke Admin_Kab/BPP
grant all on ltt.target_desa_rincian to service_role;
revoke all on function ltt.kecamatan_desa(int) from public, anon;
grant execute on function ltt.kecamatan_desa(int), ltt.is_desa_binaan(int), ltt.is_kecamatan_saya(int)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. Sinkron padi e-Pusluh: timpa per tanggal dalam satu transaksi
-- ---------------------------------------------------------------------
-- p_rows: array objek { id_lama, tanggal_lapor (timestamptz), nama_pelapor, desa_id,
--          jenis_ltt, luas_bera, realisasi_olah, realisasi_tanam, realisasi_panen,
--          metode_penanaman, keterangan }
create or replace function ltt.sinkron_padi(p_rows jsonb)
returns table (tanggal date[], dihapus int, disisipkan int)
language plpgsql security definer
set search_path = ltt, public
as $$
declare
  v_tanggal date[];
  v_hapus int;
  v_sisip int;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return query select array[]::date[], 0, 0;
    return;
  end if;

  -- Jenis LTT baru dari e-Pusluh (mis. "LTT Oplah 2026") otomatis didaftarkan
  insert into ltt.jenis_ltt (nama, komoditas, urutan)
  select distinct r->>'jenis_ltt', 'Padi', 50
  from jsonb_array_elements(p_rows) r
  where coalesce(r->>'jenis_ltt', '') <> ''
  on conflict (nama, komoditas) do nothing;

  select array_agg(distinct ((r->>'tanggal_lapor')::timestamptz at time zone 'Asia/Jakarta')::date)
    into v_tanggal
  from jsonb_array_elements(p_rows) r;

  delete from ltt.laporan_ltt l
  where l.komoditas = 'Padi' and l.sumber = 'epusluh'
    and (l.tanggal_lapor at time zone 'Asia/Jakarta')::date = any (v_tanggal);
  get diagnostics v_hapus = row_count;

  insert into ltt.laporan_ltt (
    id_lama, tanggal_lapor, nama_pelapor, desa_id, komoditas, jenis_ltt_id,
    luas_bera, realisasi_olah, realisasi_tanam, realisasi_panen,
    metode_penanaman, keterangan, sumber
  )
  select
    nullif(r->>'id_lama', ''),
    (r->>'tanggal_lapor')::timestamptz,
    nullif(r->>'nama_pelapor', ''),
    (r->>'desa_id')::int,
    'Padi',
    j.id,
    coalesce((r->>'luas_bera')::numeric, 0),
    coalesce((r->>'realisasi_olah')::numeric, 0),
    coalesce((r->>'realisasi_tanam')::numeric, 0),
    coalesce((r->>'realisasi_panen')::numeric, 0),
    nullif(r->>'metode_penanaman', ''),
    nullif(r->>'keterangan', ''),
    'epusluh'
  from jsonb_array_elements(p_rows) r
  left join ltt.jenis_ltt j on j.nama = r->>'jenis_ltt' and j.komoditas = 'Padi'
  on conflict (id_lama) do update set
    tanggal_lapor = excluded.tanggal_lapor, nama_pelapor = excluded.nama_pelapor,
    desa_id = excluded.desa_id, jenis_ltt_id = excluded.jenis_ltt_id,
    luas_bera = excluded.luas_bera, realisasi_olah = excluded.realisasi_olah,
    realisasi_tanam = excluded.realisasi_tanam, realisasi_panen = excluded.realisasi_panen,
    metode_penanaman = excluded.metode_penanaman, keterangan = excluded.keterangan,
    dihapus_pada = null, updated_at = now();
  get diagnostics v_sisip = row_count;

  return query select v_tanggal, v_hapus, v_sisip;
end;
$$;

revoke all on function ltt.sinkron_padi(jsonb) from public, anon, authenticated;
grant execute on function ltt.sinkron_padi(jsonb) to service_role;

-- ---------------------------------------------------------------------
-- 7. updated_at otomatis + jejak perubahan
-- ---------------------------------------------------------------------
create or replace function ltt.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['laporan_ltt','target_desa','target_kecamatan','produktivitas_desa','sarana_desa','anggota'] loop
    execute format('drop trigger if exists trg_updated_at on ltt.%I', t);
    execute format('create trigger trg_updated_at before update on ltt.%I for each row execute function ltt.set_updated_at()', t);
  end loop;
end $$;

create table if not exists ltt.log_perubahan (
  id          bigserial primary key,
  waktu       timestamptz not null default now(),
  user_id     uuid,                         -- null = sistem / service role (bot, impor)
  tabel       text not null,
  aksi        text not null,                -- INSERT | UPDATE | DELETE
  kunci       jsonb,
  data_lama   jsonb,
  data_baru   jsonb
);
create index if not exists idx_log_perubahan_waktu on ltt.log_perubahan (waktu desc);
alter table ltt.log_perubahan enable row level security;
drop policy if exists "log dibaca admin kab" on ltt.log_perubahan;
create policy "log dibaca admin kab" on ltt.log_perubahan
  for select to authenticated using (ltt.role_saya() = 'admin_kab');
grant select on ltt.log_perubahan to authenticated;
grant all on ltt.log_perubahan to service_role;
grant usage, select on sequence ltt.log_perubahan_id_seq to service_role;

-- Hanya perubahan oleh USER yang dicatat (auth.uid() terisi). Sinkron bot & impor massal
-- (service role) tidak dicatat agar tabel log tidak membengkak.
create or replace function ltt.catat_perubahan()
returns trigger language plpgsql security definer set search_path = ltt, public
as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  insert into ltt.log_perubahan (user_id, tabel, aksi, kunci, data_lama, data_baru)
  values (
    auth.uid(), tg_table_name, tg_op,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end -> 'id',
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['laporan_ltt','target_desa','target_kecamatan','produktivitas_desa','sarana_desa'] loop
    execute format('drop trigger if exists trg_catat_perubahan on ltt.%I', t);
    execute format('create trigger trg_catat_perubahan after insert or update or delete on ltt.%I for each row execute function ltt.catat_perubahan()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. Setel ulang sequence setelah impor dengan ID eksplisit (kecamatan, desa)
--    Dipanggil skrip impor (service role) agar ID baru tidak bentrok.
-- ---------------------------------------------------------------------
create or replace function ltt.setel_ulang_sequence()
returns void language plpgsql security definer set search_path = ltt, public
as $$
begin
  perform setval(pg_get_serial_sequence('ltt.kecamatan', 'id'), coalesce((select max(id) from ltt.kecamatan), 1));
  perform setval(pg_get_serial_sequence('ltt.desa', 'id'),      coalesce((select max(id) from ltt.desa), 1));
end $$;
revoke all on function ltt.setel_ulang_sequence() from public, anon, authenticated;
grant execute on function ltt.setel_ulang_sequence() to service_role;
