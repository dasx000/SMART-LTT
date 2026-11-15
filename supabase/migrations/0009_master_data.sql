-- =====================================================================
-- SMART LTT — 0009: Menu Master Data (Admin Kab) (16 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0008. Aman diulang.
--
-- Master yang bisa dikelola Admin Kab: Kecamatan, Desa, Jenis LTT (padi).
--  - Hanya TAMBAH & UBAH. Tidak ada hapus (dipakai laporan, target, desa binaan);
--    jenis LTT yang tidak dipakai lagi cukup dinonaktifkan.
--  - Kode Kemendagri: kecamatan 6 digit, desa 10 digit dan diawali kode kecamatannya.
-- =====================================================================

-- 1. Format kode (data saat ini sudah memenuhi)
alter table ltt.kecamatan drop constraint if exists kecamatan_kode_format;
alter table ltt.kecamatan add constraint kecamatan_kode_format check (kode ~ '^[0-9]{6}$');
alter table ltt.desa drop constraint if exists desa_kode_format;
alter table ltt.desa add constraint desa_kode_format check (kode ~ '^[0-9]{10}$');
alter table ltt.jenis_ltt drop constraint if exists jenis_ltt_nama_isi;
alter table ltt.jenis_ltt add constraint jenis_ltt_nama_isi check (length(btrim(nama)) > 0);

-- Kode desa harus diawali kode kecamatannya (dijaga juga di aplikasi)
create or replace function ltt.cek_kode_desa()
returns trigger language plpgsql
set search_path = ltt, public
as $$
declare v_kec text;
begin
  select kode into v_kec from ltt.kecamatan where id = new.kecamatan_id;
  if v_kec is null or left(new.kode, 6) <> v_kec then
    raise exception 'Kode desa % harus diawali kode kecamatan %.', new.kode, coalesce(v_kec, '?') using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_cek_kode_desa on ltt.desa;
create trigger trg_cek_kode_desa before insert or update of kode, kecamatan_id on ltt.desa
  for each row execute function ltt.cek_kode_desa();

-- 2. RLS: Admin Kab boleh menambah & mengubah (membaca sudah diatur sejak 0001/0002)
drop policy if exists "kecamatan ditambah admin kab" on ltt.kecamatan;
create policy "kecamatan ditambah admin kab" on ltt.kecamatan
  for insert to authenticated with check (ltt.role_saya() = 'admin_kab');
drop policy if exists "kecamatan diubah admin kab" on ltt.kecamatan;
create policy "kecamatan diubah admin kab" on ltt.kecamatan
  for update to authenticated using (ltt.role_saya() = 'admin_kab') with check (ltt.role_saya() = 'admin_kab');

drop policy if exists "desa ditambah admin kab" on ltt.desa;
create policy "desa ditambah admin kab" on ltt.desa
  for insert to authenticated with check (ltt.role_saya() = 'admin_kab');
drop policy if exists "desa diubah admin kab" on ltt.desa;
create policy "desa diubah admin kab" on ltt.desa
  for update to authenticated using (ltt.role_saya() = 'admin_kab') with check (ltt.role_saya() = 'admin_kab');

drop policy if exists "jenis_ltt ditambah admin kab" on ltt.jenis_ltt;
create policy "jenis_ltt ditambah admin kab" on ltt.jenis_ltt
  for insert to authenticated with check (ltt.role_saya() = 'admin_kab');
drop policy if exists "jenis_ltt diubah admin kab" on ltt.jenis_ltt;
create policy "jenis_ltt diubah admin kab" on ltt.jenis_ltt
  for update to authenticated using (ltt.role_saya() = 'admin_kab') with check (ltt.role_saya() = 'admin_kab');

-- 3. Hak tabel & sequence (tanpa DELETE)
grant insert, update on ltt.kecamatan, ltt.desa, ltt.jenis_ltt to authenticated;
grant usage, select on sequence ltt.kecamatan_id_seq, ltt.desa_id_seq, ltt.jenis_ltt_id_seq to authenticated;
