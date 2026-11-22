-- =====================================================================
-- SMART LTT — 0019: Admin Kab & Admin BPP boleh mengisi Target Desa (22 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0018. Aman diulang.
--
-- Sejak 0015 target_desa hanya bisa ditulis PPL untuk desa binaannya.
-- Tambahan (policy permissive, di-OR dengan policy PPL yang tetap berlaku):
--   - admin_kab : semua desa
--   - admin_bpp : desa di kecamatannya sendiri
-- Rincian (target_desa_rincian) otomatis ikut karena policy-nya mengacu ke target_desa.
-- Menu PPL tidak berubah.
-- =====================================================================

drop policy if exists "target_desa dikelola admin wilayah" on ltt.target_desa;
create policy "target_desa dikelola admin wilayah" on ltt.target_desa
  for all to authenticated
  using (
    ltt.role_saya() = 'admin_kab'
    or (ltt.role_saya() = 'admin_bpp' and ltt.is_kecamatan_saya(ltt.kecamatan_desa(desa_id)))
  )
  with check (
    ltt.role_saya() = 'admin_kab'
    or (ltt.role_saya() = 'admin_bpp' and ltt.is_kecamatan_saya(ltt.kecamatan_desa(desa_id)))
  );

grant select, insert, update, delete on ltt.target_desa to authenticated;

-- Cek
select policyname, cmd from pg_policies where schemaname = 'ltt' and tablename = 'target_desa' order by policyname;
