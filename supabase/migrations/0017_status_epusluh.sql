-- =====================================================================
-- SMART LTT — 0017: Status laporan e-Pusluh (khusus Padi) (17 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0016. Aman diulang.
-- WAJIB dijalankan SEBELUM kode aplikasi versi ini di-deploy
-- (halaman Laporan LTT membaca kolom status_epusluh).
--
-- Status dari e-Pusluh (mis. "Diajukan", "Verifikasi Korluh", ...) sudah dikirim bot
-- (kolom ke-14) & ada di ekspor Excel, tapi selama ini dibuang. Sekarang disimpan apa adanya.
-- Jagung & Ubi Kayu (input web) → null.
-- Data lama terisi saat bot/impor Excel memperbarui ID-nya lagi.
-- =====================================================================

alter table ltt.laporan_ltt add column if not exists status_epusluh text;

create or replace function ltt.upsert_padi_epusluh(p_rows jsonb, p_simpan boolean)
returns table (ditambah int, diperbarui int, dilewati int, wilayah_dilewati text[], jenis_baru text[])
language plpgsql security definer
set search_path = ltt, public
as $$
declare
  v_jenis text[];
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return query select 0, 0, 0, array[]::text[], array[]::text[];
    return;
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'Maksimal 5000 baris per kiriman.';
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
    nullif(r->>'status_epusluh', '')                 as status_epusluh,
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
      metode_penanaman, keterangan, status_epusluh, sumber
    )
    select i.id_sumber, i.tanggal_lapor, i.nama_pelapor, i.desa_id, 'Padi', j.id,
           i.luas_bera, i.realisasi_olah, i.realisasi_tanam, i.realisasi_panen,
           i.metode_penanaman, i.keterangan, i.status_epusluh, 'epusluh'
    from _impor i
    left join ltt.jenis_ltt j on j.nama = i.jenis_ltt and j.komoditas = 'Padi'
    where not i.lewat
    on conflict (sumber, id_sumber) do update set
      tanggal_lapor = excluded.tanggal_lapor, nama_pelapor = excluded.nama_pelapor,
      desa_id = excluded.desa_id, jenis_ltt_id = excluded.jenis_ltt_id,
      luas_bera = excluded.luas_bera, realisasi_olah = excluded.realisasi_olah,
      realisasi_tanam = excluded.realisasi_tanam, realisasi_panen = excluded.realisasi_panen,
      metode_penanaman = excluded.metode_penanaman, keterangan = excluded.keterangan,
      -- file/kiriman tanpa kolom Status tidak menghapus status yang sudah tersimpan
      status_epusluh = coalesce(excluded.status_epusluh, laporan_ltt.status_epusluh),
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

revoke all on function ltt.upsert_padi_epusluh(jsonb, boolean) from public, anon, authenticated, service_role;
