# e-LTT Palawija & Padi

Sistem pelaporan LTT (Luas Tambah Tanam) berbasis Google Apps Script untuk komoditas Padi, Jagung, dan Ubi Kayu.

## 🚀 Fitur Utama
- **Dashboard Multi-Role:** Akses khusus untuk PPL (Penyuluh), BPP (Kecamatan), dan Admin Kabupaten.
- **Virtual Sheet Array:** Optimasi performa tinggi untuk pengolahan data ribuan baris tanpa time-out.
- **Otomasi Arsip:** Pemindahan data bulanan otomatis ke sheet arsip tiap tanggal 1.
- **Sinkronisasi e-Pusluh:** Integrasi log sinkronisasi data dari sistem e-Pusluh.
- **Client-Side Caching:** Perpindahan menu instan dengan memori cache di browser.

## 🛠️ Cara Setup (Deploy Baru)
1. **Spreadsheet:** Buat Spreadsheet baru dan catat ID-nya.
2. **Database.gs:** Masukkan ID Spreadsheet tersebut ke variabel `SPREADSHEET_ID` di baris pertama.
3. **Deploy:** Lakukan `clasp push` atau copy-paste kode ke Google Apps Script editor.
4. **Inisialisasi:** Jalankan aplikasi (buka URL Web App). Sistem akan otomatis membuat semua sheet yang diperlukan (`Data_User`, `Data_LTT`, dll).
5. **Aktivasi Otomasi:** Di Editor GAS, jalankan fungsi `setupTriggers()` sekali saja untuk mengaktifkan fitur arsip otomatis.

## 📂 Struktur Database
- `Data_User`: Manajemen akun dan role penyuluh.
- `Data_LTT`: Data realisasi Jagung & Ubi Kayu (manual).
- `Data_LTT_Padi`: Data realisasi Padi (hasil sinkron).
- `Ringkasan_Harian`: Tabel pivot harian untuk performa dashboard cepat.
- `Data_Geografi`: Referensi wilayah Kecamatan & Desa.

## ⚡ Pemeliharaan
Jika data dashboard terasa tidak sinkron dengan data mentah, jalankan fungsi `rekalkulasiRingkasan()` di editor script untuk membangun ulang tabel rekap dari nol.

---
**Status:** Production Ready | **Optimized by Antigravity**
