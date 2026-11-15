-- =====================================================================
-- SMART LTT — 0007: id_sumber, kode wilayah wajib, impor Excel e-Pusluh (16 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0006. Aman diulang.
--
--  1. laporan_ltt.id_lama  → id_sumber (HANYA ganti nama; isi tidak berubah).
--     Isinya ID di sistem asal: ID asli e-Pusluh ("49758007"), SYNC-… (bot lama),
--     LTT-… (Google Sheet lama), atau kosong (input manual aplikasi baru).
--  2. Unik pada (sumber, id_sumber), bukan id_sumber saja.
--  3. kode Kemendagri kecamatan & desa wajib + unik → ETL mencocokkan wilayah lewat kode,
--     bukan urutan baris sheet (keputusan desa_id opsi B).
--  4. ltt.sinkron_padi() disesuaikan (dipakai bot VPS).
--  5. ltt.impor_padi(): impor Excel e-Pusluh oleh Admin Kab — upsert per ID e-Pusluh,
--     TIDAK menghapus apa pun; baris pada tanggal+kecamatan yang masih berisi data
--     lama ber-ID SYNC-… dilewati (cegah data ganda).
-- =====================================================================

-- 1. Ganti nama kolom (sekali saja)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'ltt' and table_name = 'laporan_ltt' and column_name = 'id_lama') then
    alter table ltt.laporan_ltt rename column id_lama to id_sumber;
  end if;
end $$;

comment on column ltt.laporan_ltt.id_sumber is
  'ID laporan di sistem asal (e-Pusluh / sheet lama / bot). Kosong untuk input manual aplikasi.';

-- 2. Unik per sumber
alter table ltt.laporan_ltt drop constraint if exists laporan_ltt_id_lama_key;
alter table ltt.laporan_ltt drop constraint if exists laporan_ltt_sumber_id_sumber_key;
alter table ltt.laporan_ltt add constraint laporan_ltt_sumber_id_sumber_key unique (sumber, id_sumber);

-- 3. Kode Kemendagri wajib (sudah unik sejak 0001)
alter table ltt.kecamatan alter column kode set not null;
alter table ltt.desa      alter column kode set not null;

-- Ejaan desa mengikuti e-Pusluh (sheet lama menulis "Kiling"). Dicocokkan lewat kode, bukan nama.
update ltt.desa set nama = 'Kiling-kiling' where kode = '1808122002' and nama <> 'Kiling-kiling';

-- 4. Sinkron bot: sama seperti 0003, hanya kolom & kunci konflik yang berubah
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
    id_sumber, tanggal_lapor, nama_pelapor, desa_id, komoditas, jenis_ltt_id,
    luas_bera, realisasi_olah, realisasi_tanam, realisasi_panen,
    metode_penanaman, keterangan, sumber
  )
  select
    nullif(coalesce(r->>'id_sumber', r->>'id_lama'), ''),
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
  on conflict (sumber, id_sumber) do update set
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

-- 5. Impor Excel e-Pusluh (Admin Kab). p_simpan = false → hanya hitung (pratinjau).
-- p_rows: [{ id_sumber, tanggal_lapor (timestamptz), nama_pelapor, desa_id, jenis_ltt,
--            luas_bera, realisasi_olah, realisasi_tanam, realisasi_panen,
--            metode_penanaman, keterangan }]   (ID unik per baris, sudah divalidasi aplikasi)
create or replace function ltt.impor_padi(p_rows jsonb, p_simpan boolean default false)
returns table (ditambah int, diperbarui int, dilewati int, wilayah_dilewati text[], jenis_baru text[])
language plpgsql security definer
set search_path = ltt, public
as $$
declare
  v_jenis text[];
begin
  if ltt.role_saya() is distinct from 'admin_kab' then
    raise exception 'Hanya Admin Kabupaten yang boleh mengimpor.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return query select 0, 0, 0, array[]::text[], array[]::text[];
    return;
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'Maksimal 5000 baris per impor.';
  end if;

  drop table if exists pg_temp._impor;
  create temp table _impor on commit drop as
  select
    r->>'id_sumber'                                  as id_sumber,
    (r->>'tanggal_lapor')::timestamptz               as tanggal_lapor,
    ((r->>'tanggal_lapor')::timestamptz at time zone 'Asia/Jakarta')::date as tgl,
    d.id                                             as desa_id,
    d.kecamatan_id,
    nullif(r->>'nama_pelapor', '')                   as nama_pelapor,
    nullif(r->>'jenis_ltt', '')                      as jenis_ltt,
    coalesce((r->>'luas_bera')::numeric, 0)          as luas_bera,
    coalesce((r->>'realisasi_olah')::numeric, 0)     as realisasi_olah,
    coalesce((r->>'realisasi_tanam')::numeric, 0)    as realisasi_tanam,
    coalesce((r->>'realisasi_panen')::numeric, 0)    as realisasi_panen,
    nullif(r->>'metode_penanaman', '')               as metode_penanaman,
    nullif(r->>'keterangan', '')                     as keterangan,
    false                                            as lewat,
    false                                            as ada
  from jsonb_array_elements(p_rows) r
  join ltt.desa d on d.id = (r->>'desa_id')::int
  where coalesce(r->>'id_sumber', '') <> '';

  -- Tanggal + kecamatan yang masih berisi data lama ber-ID SYNC-… → lewati (cegah ganda)
  update _impor i set lewat = true
  where exists (
    select 1 from ltt.laporan_ltt l join ltt.desa d on d.id = l.desa_id
    where l.sumber = 'epusluh' and l.id_sumber like 'SYNC-%' and l.dihapus_pada is null
      and d.kecamatan_id = i.kecamatan_id
      and l.tanggal_lapor >= (i.tgl::timestamp at time zone 'Asia/Jakarta')
      and l.tanggal_lapor <  ((i.tgl + 1)::timestamp at time zone 'Asia/Jakarta')
  );

  update _impor i set ada = true
  where exists (select 1 from ltt.laporan_ltt l where l.sumber = 'epusluh' and l.id_sumber = i.id_sumber);

  -- Jenis LTT yang belum terdaftar (dihitung sebelum disimpan)
  select coalesce(array_agg(distinct i.jenis_ltt), array[]::text[]) into v_jenis
  from _impor i
  where not i.lewat and i.jenis_ltt is not null
    and not exists (select 1 from ltt.jenis_ltt j where j.nama = i.jenis_ltt and j.komoditas = 'Padi');

  if p_simpan then
    insert into ltt.jenis_ltt (nama, komoditas, urutan)
    select distinct jenis_ltt, 'Padi', 50 from _impor where not lewat and jenis_ltt is not null
    on conflict (nama, komoditas) do nothing;

    insert into ltt.laporan_ltt (
      id_sumber, tanggal_lapor, nama_pelapor, desa_id, komoditas, jenis_ltt_id,
      luas_bera, realisasi_olah, realisasi_tanam, realisasi_panen,
      metode_penanaman, keterangan, sumber
    )
    select i.id_sumber, i.tanggal_lapor, i.nama_pelapor, i.desa_id, 'Padi', j.id,
           i.luas_bera, i.realisasi_olah, i.realisasi_tanam, i.realisasi_panen,
           i.metode_penanaman, i.keterangan, 'epusluh'
    from _impor i
    left join ltt.jenis_ltt j on j.nama = i.jenis_ltt and j.komoditas = 'Padi'
    where not i.lewat
    on conflict (sumber, id_sumber) do update set
      tanggal_lapor = excluded.tanggal_lapor, nama_pelapor = excluded.nama_pelapor,
      desa_id = excluded.desa_id, jenis_ltt_id = excluded.jenis_ltt_id,
      luas_bera = excluded.luas_bera, realisasi_olah = excluded.realisasi_olah,
      realisasi_tanam = excluded.realisasi_tanam, realisasi_panen = excluded.realisasi_panen,
      metode_penanaman = excluded.metode_penanaman, keterangan = excluded.keterangan,
      dihapus_pada = null, updated_at = now();
  end if;

  return query
  select
    (count(*) filter (where not i.lewat and not i.ada))::int,
    (count(*) filter (where not i.lewat and i.ada))::int,
    (count(*) filter (where i.lewat))::int,
    coalesce(
      (select array_agg(x order by x) from (
         select distinct to_char(i2.tgl, 'DD-MM-YYYY') || ' · ' || k.nama as x
         from _impor i2 join ltt.kecamatan k on k.id = i2.kecamatan_id where i2.lewat) s),
      array[]::text[]),
    v_jenis
  from _impor i;
end;
$$;

revoke all on function ltt.impor_padi(jsonb, boolean) from public, anon;
grant execute on function ltt.impor_padi(jsonb, boolean) to authenticated, service_role;
