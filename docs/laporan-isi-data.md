# Laporan Isi Data Spreadsheet Lama

> Dibuat otomatis oleh `scripts/etl/laporan_isi_data.py` dari `MASTER DATABASE LTT.xlsx` pada 13 Nov 2026 11:16. Hanya angka agregat — tidak ada data pribadi.

## 1. Wilayah (`Data_Geografi`)

- 15 kecamatan, 227 baris desa, 227 pasangan kecamatan+desa unik.
- Nama desa yang sama di lebih dari satu kecamatan: **6** (karena itu desa selalu dicocokkan bersama kecamatannya).
- Jumlah desa per kecamatan: Bahuga 11, Banjit 20, Baradatu 22, Blambangan Umpu 13, Buay Bahuga 9, Bumi Agung 10, Gunung Labuhan 21, Kasui 19, Negara Batin 15, Negeri Agung 19, Negeri Besar 13, Pakuan Ratu 19, Rebang Tangkas 10, Umpu Semenguk 13, Way Tuba 13

## 2. Pengguna (`Data_User`)

- 104 baris. Kolom: ID_User, Nama_Penyuluh, NIP, PIN, Role, Kecamatan, Desa_Binaan, Status_Aktif, WhatsApp.
- Role: Penyuluh 80, Admin_BPP 15, Dinas 5, Admin_Kab 4
- Status: Aktif 102, Nonaktif 2
- NIP kosong: 0; NIP dobel: 0.
- NIP berisi selain angka: 4.
- Password (`PIN`) < 6 karakter: **0** (Supabase Auth mensyaratkan min. 6 → perlu password sementara).
- Kecamatan user yang tidak ada di `Data_Geografi`: 9 (way kanan, -).
- Desa binaan: 234 entri, **3** tidak cocok dengan kecamatan+desa di `Data_Geografi`.
- Kolom WhatsApp terisi: 2.

## 3. Laporan LTT

| Sheet | Baris | Komoditas | Format tanggal | Desa tak cocok | Angka negatif/bukan angka |
|---|---|---|---|---|---|
| `Data_LTT_2026_10` | 517 | JAGUNG 457, UBI KAYU 60 | Date 517 | 0 | 0 |
| `Data_LTT_Padi_2026_10` | 524 | Padi 524 | teks 'Bulan d, yyyy' 524 | 0 | 0 |
| `Data_LTT_2026_09` | 490 | JAGUNG 376, UBI KAYU 114 | Date 490 | 0 | 0 |
| `Data_LTT_Padi_2026_09` | 760 | Padi 760 | Date 760 | 0 | 0 |
| `Data_LTT_2026_08` | 1056 | JAGUNG 749, UBI KAYU 307 | Date 1056 | 0 | 0 |
| `Data_LTT_Padi_2026_08` | 1261 | Padi 1261 | teks 'Bulan d, yyyy' 1261 | 0 | 0 |
| `Data_LTT_2026_07` | 1455 | JAGUNG 1008, UBI KAYU 447 | Date 1455 | 0 | 0 |
| `Data_LTT_Padi_2026_07` | 1519 | Padi 1519 | Date 1519 | 0 | 0 |
| `Data_LTT_2026_06` | 2161 | JAGUNG 1500, UBI KAYU 640, Jagung 12, Ubi Kayu 8, PADI 1 | Date 2161 | 0 | 0 |
| `Data_LTT_Padi_2026_06` | 1101 | Padi 1101 | Date 1101 | 0 | 0 |
| `Data_LTT_Padi_2026_04` | 2144 | Padi 2144 | Date 2144 | 0 | 0 |
| `Data_LTT_2026_05` | 0 |  |  | 0 | 0 |
| `Data_LTT_Padi_2026_05` | 1777 | Padi 1777 | teks 'Bulan d, yyyy' 1777 | 0 | 0 |
| `Data_LTT_Padi` | 345 | Padi 345 | Date 345 | 0 | 0 |
| `Data_LTT` | 407 | JAGUNG 344, UBI KAYU 63 | Date 407 | 0 | 0 |

- **Total baris laporan:** 15517.
- ID laporan dobel (lintas sheet): 0; ID kosong: 0.
- Komoditas (semua sheet): `Padi` 9431, `JAGUNG` 4434, `UBI KAYU` 1631, `Jagung` 12, `Ubi Kayu` 8, `PADI` 1
- Status verifikasi: `Menunggu` 5819, `Terverifikasi BPP` 5674, `Terverifikasi Provinsi` 2617, `Diajukan` 762, `Terverifikasi KabKota` 645 → **tidak dimigrasi** (fitur verifikasi dihapus).
- Jenis LTT padi: `LTT Reguler` 9241, `LTT Padi Gogo` 140, `LTT Oplah 2024` 13, `LTT Oplah 2025` 13, `LTT CSR` 13, `LTT Oplah 2026` 7, `LTT Rehab Bencana` 4
- Jenis LTT palawija: `LTT` 6086
- Metode penanaman (padi): `(kosong)` 6365, `Regular` 2987, `PM AAS` 79

## 4. Target

- `Target_Desa_Padi`: 799 baris; bulan: 1.0:22, 2.0:22, 3.0:22, 4.0:227, 5.0:227, 6.0:64, 7.0:85, 8.0:48, 9.0:49, 10.0:16, 11.0:14, 12.0:3; desa tak cocok 0; kunci (bulan+kec+desa) dobel 0.
  - Baris yang Total_Target_Tanam ≠ jumlah rincian per jenis: **0**.
- `Target_Desa_Jagung`: 362 baris; bulan: 1.0:5, 2.0:5, 3.0:2, 4.0:27, 5.0:16, 6.0:56, 7.0:89, 8.0:47, 9.0:41, 10.0:41, 11.0:30, 12.0:3; desa tak cocok 0; kunci (bulan+kec+desa) dobel 0.
- `Target_Desa_UbiKayu`: 102 baris; bulan: 1.0:3, 2.0:3, 3.0:5, 4.0:3, 5.0:9, 6.0:7, 7.0:32, 8.0:13, 9.0:16, 10.0:5, 11.0:6; desa tak cocok 0; kunci (bulan+kec+desa) dobel 0.
- `Target_Kecamatan`: 124 baris; bulan: 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0; komoditas: Jagung, Padi, Ubi Kayu.
- `Target_Kecamatan_Provinsi`: 15 baris; bulan: 11.0; komoditas: Padi.
- `Target_Kabupaten`: 9 baris; bulan: 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0; komoditas: Jagung, Padi.
- `Target_PmAas_Kabupaten`: 2 baris; bulan: 7.0, 8.0.

## 5. Lain-lain

- `Jenis_LTT`: 6 baris; nilai: `LTT Reguler` (Padi), `LTT Oplah 2024` (Padi), `LTT Oplah 2025` (Padi), `LTT Padi Gogo` (Padi), `LTT CSR` (Padi), `LTT Rehab Bencana` (Padi).
- `Data_Produktivitas_Desa`: 12 baris.
- `Data_Sarana_Desa`: 9 baris.
- `Logs_Sinkron`: 864 baris.
- Tidak dimigrasi: `Copy of Data_LTT`, `Copy of Data_User`, `Copy of Ringkasan_Harian`, `Data_Produktivitas_Kec_Arsip`, `Ringkasan_Harian`, `Target`.
