# 📋 Task Backlog & Panduan Eksekusi Fitur e-LTT (High-Level Plan)

Dokumen ini dirancang sebagai panduan instruksi tingkat tinggi (*High-Level Specification*) yang siap diserahkan kepada **Programmer Junior** atau **LLM (Model Bahasa)** untuk diimplementasikan ke dalam aplikasi e-LTT. 

---

## 🌉 FASE 2: Integrasi Jembatan Multi-Role & Manajemen Akun
**Tujuan Utama:** Menghubungkan fungsi login, manajemen pengguna, dan peralihan dasbor secara instan untuk Koordinator BPP (yang berperan ganda sebagai Penyuluh Lapangan) agar mereka tidak perlu log out untuk berganti peran.

### 📌 Sub-Task 2.1: Pembuatan Jembatan Lintas Peran (Multi-Role Switcher)
*   **Masalah:** Akun Koordinator BPP memiliki peran ganda (`Admin_BPP` sekaligus `Penyuluh` pelapor lapangan). Saat ini mereka kesulitan karena harus keluar-masuk sistem jika ingin melapor LTT mandiri dan memverifikasi laporan anggota.
*   **Instruksi Kerja (High-Level):**
    1.  **Default Landing Page:** Arahkan semua pengguna dengan peran `Penyuluh` maupun `Admin_BPP` ke Dasbor Laporan PPL secara default pasca login.
    2.  **Tombol Transisi Instan (PPL ⇆ BPP):** 
        *   Di dasbor PPL, pasang tombol transisi (ikon *shuffle/switch*) yang hanya tampil jika role pengguna adalah `Admin_BPP`.
        *   Di dasbor BPP, pasang tombol kembali bertuliskan "Kembali ke Panel Penyuluh".
    3.  **Transisi In-Memory:** Saat tombol diklik, ubah status dasbor aktif secara lokal (*in-memory state*) dan munculkan efek loading transisi visual yang halus (misal: SweetAlert2 loading).
    4.  **Security Guard:** Tambahkan proteksi di frontend agar dasbor BPP tidak bisa dibuka oleh PPL biasa meskipun mereka memanipulasi DOM.

### 📌 Sub-Task 2.2: Manajemen Akun PPL & Dynamic Desa Binaan
*   **Masalah:** Penulisan nama desa binaan penyuluh masih bersifat ketik manual (teks biasa), yang sering memicu kesalahan ketik (*typo*) dan data ganda. Dasbor BPP juga terasa sangat penuh jika semua card administrasi terbuka sekaligus.
*   **Instruksi Kerja (High-Level):**
    1.  **Dashboard Clean-Up (Collapse/Expand Card):**
        *   Ubah prioritas visual dasbor BPP: Tempatkan tabel verifikasi harian di posisi teratas.
        *   Buat modul "Input Target Bulanan" dan "Manajemen Akun PPL" dalam status default tertutup (*collapsed*). Tambahkan tombol toggle (Tampilkan/Sembunyikan) untuk membuka modul tersebut.
    2.  **Auto-Checklist Desa Binaan (Database Integrated):**
        *   Ganti kolom input teks desa binaan pada Form Tambah/Edit Penyuluh dengan kotak pilihan checklist dinamis (*checkboxes*).
        *   Data desa harus ditarik otomatis dari database wilayah (`Data_Geografi`) berdasarkan kecamatan tempat Koordinator BPP bertugas.
        *   Saat data disimpan, gabungkan desa terpilih menjadi string terpisah koma secara otomatis sebelum disimpan ke database sheet.

---

## ⚡ FASE 3: SWR Caching & Ketahanan Offline
**Tujuan Utama:** Menjamin aplikasi tetap cepat diakses di lokasi persawahan dengan sinyal internet yang lemah/tidak stabil.

### 📌 Instruksi Kerja (High-Level):
1.  **Stale-While-Revalidate (SWR) Caching:**
    *   Simpan data LTT harian yang ditarik dari server ke dalam penyimpanan lokal browser (*LocalStorage*).
    *   Saat halaman dimuat, tampilkan data dari penyimpanan lokal terlebih dahulu secara instan, lalu lakukan penarikan data terbaru di latar belakang untuk memperbarui antarmuka tanpa membuat pengguna menunggu layar loading.
2.  **Optimistic UI Updates:**
    *   Saat PPL mengirim laporan harian baru, langsung tambahkan baris data tersebut ke tabel di layar dengan status visual "Mengirim..." secara instan.
    *   Jika koneksi sukses, ubah status menjadi centang hijau. Jika gagal, beri notifikasi dan tombol "Kirim Ulang".

---

## 🤖 FASE 4: Otomasi Laporan & Integrasi WhatsApp
**Tujuan Utama:** Mempermudah pelaporan LTT langsung dari persawahan tanpa harus membuka web browser.

### 📌 Instruksi Kerja (High-Level):
1.  **Sinkronisasi Otomatis Backend:**
    *   Bangun fungsi sinkronisasi terjadwal (*trigger/cron job*) di backend Google Apps Script untuk menarik data realisasi dari sheet database resmi eksternal (CAPIR/EPusluh) ke sheet database lokal e-LTT.
2.  **WhatsApp Reporting Bot Commands:**
    *   Buat handler bot WhatsApp tingkat tinggi yang mendeteksi pesan masuk dengan format khusus (contoh: `/lapor [komoditas] [luas]`).
    *   Pesan yang valid akan dieksekusi secara otomatis dan langsung di-input ke sheet database LTT terkait tanpa keterlibatan manual.
