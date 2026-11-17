# Plan

## Migrasi susulan LTT Jagung & Ubi Kayu — malam 17 Nov 2026

**Kondisi (dicek 17 Nov 2026, langsung ke Supabase):**

| Komoditas | Laporan migrasi terakhir | Input aplikasi baru mulai |
|---|---|---|
| Padi | 17 Nov (sinkron e-Pusluh, sudah up to date) | — |
| Jagung | 15 Nov ±13.12 WIB | 16 Nov ±00.59 WIB |
| Ubi Kayu | 15 Nov ±10.08 WIB | 16 Nov ±10.40 WIB |

Sumber migrasi: ekspor `MASTER DATABASE LTT.xlsx` 15 Nov sore, diimpor 15 Nov ±23.41 WIB.
Laporan yang masuk ke aplikasi GAS lama setelah ekspor itu **belum ada** di database baru.

**Target:** semua laporan Jagung & Ubi Kayu dari aplikasi lama sampai hari ini (17 Nov) masuk ke database.

**Langkah:**
- [ ] Ekspor ulang `MASTER DATABASE LTT.xlsx` dari spreadsheet lama.
- [ ] `python scripts/etl/transform_data.py`
- [ ] Cek laporan Jagung bertanggal **2026-12-06** di `data_bersih/laporan_ltt.json`. Kemungkinan hari/bulan tertukar saat parsing. Perbaiki sebelum impor.
- [ ] Cek kemungkinan dobel: laporan yang diinput di GAS lama **dan** di aplikasi baru sejak 16 Nov (desa + tanggal + komoditas + jenis LTT sama). Upsert hanya mencegah dobel antar-data spreadsheet (`sumber,id_sumber`), bukan dengan input aplikasi baru (`id_sumber` null).
- [ ] Simulasi: `python scripts/etl/impor_ke_supabase.py --sampai 2026-11-18`. Pakai `--sampai 2026-11-18` supaya laporan 17 Nov ikut; default-nya melewati hari berjalan.
- [ ] Kalau angka cocok: `python scripts/etl/impor_ke_supabase.py --jalankan --sampai 2026-11-18`
- [ ] Verifikasi: laporan terakhir Jagung & Ubi Kayu hasil migrasi (`id_sumber` tidak null) sudah tanggal 17 Nov.
