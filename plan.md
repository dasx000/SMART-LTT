# Rencana Implementasi: Fitur Input/Edit Laporan Akhir Bulan (Role PPL)

## Deskripsi Singkat
Fitur ini memungkinkan PPL untuk melakukan input data susulan atau perbaikan data (Padi, Jagung, Ubi Kayu) di akhir bulan. Menu ini hanya muncul pada periode akhir bulan dan memungkinkan user memilih tanggal spesifik dalam bulan tersebut. Selain itu, pilihan cakupan desa diperluas menjadi tingkat kecamatan.

---

## 1. Penyesuaian Tampilan (UI/Frontend)
- **Menu Kondisional:** Tambahkan logika pada layar PPL untuk menampilkan menu baru (misal: "Evaluasi/Perbaikan Data Akhir Bulan"). Atur agar menu ini hanya terlihat pada periode akhir bulan (tanggal 25 ke atas dibulan berjalan).
- **Halaman Fitur Akhir Bulan:** Buat halaman baru yang terdiri dari:
  - **Form Input Data:** Form untuk memasukkan data baru (Padi, Jagung, Ubi Kayu) dengan tambahan input pemilih tanggal (`Date Picker`). hanay bisa pilih tanggal di bulan berjalan
  - **Daftar Laporan:** Tabel atau list yang menampilkan riwayat isian data di bulan tersebut.
- **Fitur Edit:** Tambahkan tombol/aksi "Edit" pada setiap baris di daftar laporan untuk memfasilitasi perbaikan data.

## 2. Penyesuaian Logika Form & Dropdown
- **Input Tanggal:** Pastikan user dapat mengatur tanggal secara bebas (custom date) melalui form, dengan batasan hanya untuk tanggal di bulan yang sedang berjalan.
- **Dropdown Desa:** Ubah sumber data (query) untuk dropdown pilihan Desa pada form laporan.
  - **Sebelumnya:** Hanya menampilkan desa sesuai WKPP user.
  - **Perubahan:** Tampilkan **seluruh desa** yang berada di dalam lingkup **Kecamatan** user PPL tersebut.

## 3. Penyesuaian Backend & Database (API)
- **API List Desa:** Buat atau modifikasi endpoint yang mengembalikan daftar Desa berdasarkan parameter Kecamatan (dari profil user), bukan parameter WKPP.
- **API Create Laporan:** Sesuaikan endpoint penyimpanan laporan agar menerima dan memproses data `tanggal` yang dikirim dari form (bukan selalu menggunakan tanggal *current system date*).
- **API Update Laporan:** Siapkan endpoint khusus (atau gunakan yang sudah ada) untuk menyimpan perubahan data (Padi, Jagung, Ubi Kayu) ketika user melakukan "Edit".
- **API List Laporan:** Sediakan endpoint untuk mengambil rekap/daftar laporan spesifik pada bulan tersebut untuk ditampilkan di tabel riwayat.

## 4. Skenario Pengujian Utama (QA/Testing)
1. **Visibilitas Menu:** Ubah tanggal sistem ke tengah bulan (menu harus hilang) dan ke akhir bulan (menu harus muncul).
2. **Cakupan Desa:** Buka form input, pastikan dropdown Desa menampilkan seluruh desa di kecamatan user, bukan sekadar desa WKPP-nya.
3. **Input Mundur:** Coba input laporan untuk tanggal beberapa hari ke belakang (di bulan yang sama) dan pastikan tersimpan dengan tanggal yang benar.
4. **Edit Data:** Lakukan perubahan angka pada data Padi, Jagung, dan Ubi Kayu yang sudah ada, simpan, dan pastikan data di tabel/database terbarui.
