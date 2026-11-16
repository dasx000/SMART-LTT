-- =====================================================================
-- SMART LTT — 0012: Bersihkan entitas HTML di teks (16 Nov 2026)
-- Jalankan di Supabase → SQL Editor SETELAH 0011. Aman diulang.
--
-- Data dari sheet lama & tabel HTML e-Pusluh menyimpan teks ter-escape, mis.
-- "TAUFIQ MA&#039;RUF, SP" → seharusnya "TAUFIQ MA'RUF, SP".
-- Ditemukan 16 Nov 2026: 1 nama akun (core.profiles), 105 nama pelapor & 2 keterangan (ltt.laporan_ltt).
-- Pencegahan data baru: lib/epusluh.ts (bot & impor Excel) dan scripts/etl/transform_data.py.
-- =====================================================================

-- Ubah entitas HTML (&#39; &#x27; &amp; &quot; &apos; &lt; &gt; &nbsp;) jadi karakter aslinya
create or replace function ltt.decode_html(s text)
returns text language plpgsql immutable
set search_path = pg_catalog
as $$
declare
  m text[];
  r text := s;
  kode int;
begin
  if r is null or position('&' in r) = 0 then
    return r;
  end if;
  for m in select regexp_matches(r, '(&#([0-9]{1,7});)', 'g') loop
    kode := m[2]::int;
    if kode between 1 and 1114111 then r := replace(r, m[1], chr(kode)); end if;
  end loop;
  for m in select regexp_matches(r, '(&#[xX]([0-9a-fA-F]{1,6});)', 'g') loop
    kode := ('x' || lpad(m[2], 8, '0'))::bit(32)::int;
    if kode between 1 and 1114111 then r := replace(r, m[1], chr(kode)); end if;
  end loop;
  r := replace(r, '&quot;', '"');
  r := replace(r, '&apos;', '''');
  r := replace(r, '&lt;', '<');
  r := replace(r, '&gt;', '>');
  r := replace(r, '&nbsp;', ' ');
  r := replace(r, '&amp;', '&');   -- terakhir, agar "&amp;#039;" tidak ikut terurai dua kali sekaligus
  return r;
end $$;

revoke all on function ltt.decode_html(text) from public, anon, authenticated;

-- Pola baris yang perlu dibersihkan
-- (diulang dua kali untuk kasus ter-escape ganda, mis. "&amp;#039;")
do $$
declare
  pola constant text := '&(#[0-9]+|#[xX][0-9a-fA-F]+|amp|quot|apos|lt|gt|nbsp);';
  i int;
begin
  for i in 1..2 loop
    update core.profiles
      set nama = ltt.decode_html(nama)
      where nama ~ pola;

    update ltt.laporan_ltt
      set nama_pelapor = ltt.decode_html(nama_pelapor),
          keterangan   = ltt.decode_html(keterangan)
      where nama_pelapor ~ pola or keterangan ~ pola;
  end loop;
end $$;

-- Cek: harus 0 semua
select
  (select count(*) from core.profiles where nama ~ '&(#[0-9]+|amp|quot|apos);') as profil_tersisa,
  (select count(*) from ltt.laporan_ltt
     where nama_pelapor ~ '&(#[0-9]+|amp|quot|apos);' or keterangan ~ '&(#[0-9]+|amp|quot|apos);') as laporan_tersisa;
