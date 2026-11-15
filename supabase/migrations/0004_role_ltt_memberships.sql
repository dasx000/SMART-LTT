-- =====================================================================
-- SMART LTT — 0004: role LTT di core.memberships + nama role baru (15 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0003. Idempoten (aman diulang).
--
-- Nama role LTT (disepakati 15 Nov 2026), huruf kecil seragam dengan aplikasi lain:
--     penyuluh | admin_bpp | admin_kab | viewer   (viewer = Dinas, penyuluh provinsi, dll: hanya melihat)
--
-- 1. core.memberships_role_check (milik CWS/Alsintan) hanya mengenal role aplikasi lain.
--    Aturan lama DIPERTAHANKAN apa adanya, ditambah cabang khusus app 'ltt'.
-- 2. Membership 'ltt' yang masih memakai nama lama (bila ada) diganti ke nama baru.
-- 3. Semua kebijakan RLS yang memeriksa role ditulis ulang dengan nama baru
--    (0002/0003 yang sudah dijalankan masih memakai 'Admin_Kab' dst.).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 & 2. Constraint role + migrasi nama lama
-- ---------------------------------------------------------------------
do $$
declare
  v_def  text;
  v_lama text;
begin
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint
  where conrelid = 'core.memberships'::regclass and conname = 'memberships_role_check';

  if v_def is not null then
    alter table core.memberships drop constraint memberships_role_check;

    if v_def like '%''ltt''%' then
      -- Cabang ltt sudah pernah ditambahkan (mis. versi awal 0004 dengan nama lama):
      -- cukup ganti nama role lama di dalamnya. Nama ini tidak dipakai aplikasi lain.
      v_lama := replace(replace(replace(replace(substr(v_def, 7),
                  '''Penyuluh''',  '''penyuluh'''),
                  '''Admin_BPP''', '''admin_bpp'''),
                  '''Admin_Kab''', '''admin_kab'''),
                  '''Dinas''',     '''viewer''');
    else
      -- Aturan lama aplikasi lain dipertahankan utuh; tambah cabang khusus ltt.
      v_lama := format('((app_slug = %L and role in (%L, %L, %L, %L)) or %s)',
                  'ltt', 'penyuluh', 'admin_bpp', 'admin_kab', 'viewer',
                  substr(v_def, 7));   -- buang awalan "CHECK "
    end if;
  end if;

  update core.memberships set role = case role
      when 'Penyuluh'  then 'penyuluh'
      when 'Admin_BPP' then 'admin_bpp'
      when 'Admin_Kab' then 'admin_kab'
      when 'Dinas'     then 'viewer'
      else role end
  where app_slug = 'ltt';

  if v_def is not null then
    execute 'alter table core.memberships add constraint memberships_role_check check ' || v_lama;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Kebijakan RLS dengan nama role baru (isi sama dengan 0003 bagian 5)
-- ---------------------------------------------------------------------
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

-- Jejak perubahan
drop policy if exists "log dibaca admin kab" on ltt.log_perubahan;
create policy "log dibaca admin kab" on ltt.log_perubahan
  for select to authenticated using (ltt.role_saya() = 'admin_kab');

-- Logs sinkron (dari 0002)
drop policy if exists "logs dibaca admin kab dan bpp" on ltt.logs_sinkron;
create policy "logs dibaca admin kab dan bpp" on ltt.logs_sinkron
  for select to authenticated using (ltt.role_saya() in ('admin_kab', 'admin_bpp'));

-- ---------------------------------------------------------------------
-- Cek hasil
-- ---------------------------------------------------------------------
select pg_get_constraintdef(oid) as aturan_role
from pg_constraint
where conrelid = 'core.memberships'::regclass and conname = 'memberships_role_check';
