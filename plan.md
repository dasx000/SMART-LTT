# Rencana Implementasi (Implementation Plan): Optimasi Load Time Aplikasi e-LTT

## 🎯 Tujuan Utama (Goal)
Memangkas waktu tunggu awal (Load Time) dari 5-7 detik menjadi **kurang dari 1 detik** (Instan).
Fokus utama adalah menunda pemuatan *resource* yang berat (Lazy Loading) dan mengeliminasi proses *bottleneck* di sisi server pada saat aplikasi pertama kali dibuka.

---

## 🛠️ Langkah-Langkah High Level (Instruksi untuk Eksekusi)

### Tahap 1: Eliminasi *Bottleneck* di Sisi Server (Code.gs & Database.gs)
- **Tugas:** Hapus pemanggilan fungsi `inisialisasiDatabase_()` dari dalam fungsi `doGet(e)`.
- **Alasan:** Pengecekan 14 *sheet* menggunakan API Spreadsheet pada setiap kali aplikasi dimuat sangat memakan waktu.
- **Tindakan:** Buat satu fungsi baru bernama `setupApp()` yang memanggil `inisialisasiDatabase_()` dan `setupTriggers()`. Fungsi ini HANYA perlu dijalankan sekali secara manual oleh admin saat pertama kali mendeploy aplikasi.

### Tahap 2: Minimalisasi *Payload* Awal (Index.html)
- **Tugas:** Rombak struktur `Index.html` agar tidak memuat seluruh file aplikasi (Login, PPL, BPP, Admin, dan JS seberat 200KB) secara bersamaan.
- **Tindakan:** 
  - `Index.html` HANYA boleh berisi *header* standar, `File_CSS.html`, `File_HTML_Login.html`, dan sebuah skrip kecil (Bootstrap Script).
  - Sebisa mungkin hindari penggunaan `<?!= include() ?>` yang membutuhkan evaluasi template berat di sisi server (Server-side rendering). Jika memungkinkan, kirim file langsung menggunakan `HtmlService.createHtmlOutputFromFile()`.
  - Pindahkan *hardcoded* URL seperti `LOGO_SRC_` ke Javascript sisi *client* untuk menghindari keharusan mengevaluasi template.

### Tahap 3: Buat Skrip Bootstrap & *Splash Screen* (Client-Side)
- **Tugas:** Skrip kecil ini harus berjalan seketika setelah DOM utama dimuat untuk mengecek sesi login pengguna.
- **Tindakan:** 
  - Segera cek keberadaan objek `user_eLTT` di `localStorage`.
  - **Jika pengguna BELUM login:** Tampilkan form login (Instan, karena ukurannya sangat kecil).
  - **Jika pengguna SUDAH login:** Sembunyikan form login dan tampilkan elemen *Splash Screen* atau *Loading Spinner* berdesain elegan secara instan.

### Tahap 4: Fetch Modul Aplikasi secara Asinkron (*Lazy Loading*)
- **Tugas:** Buat mekanisme untuk mengunduh modul HTML dan Javascript utama secara asinkron di latar belakang.
- **Tindakan Sisi Server:** Buat satu fungsi yang bisa dipanggil dari *client* (misalnya `getAppResources()`). Fungsi ini bertugas membaca sisa berkas yang dibutuhkan (PPL, BPP, Admin, Javascript) menggunakan `createHtmlOutputFromFile` dan mereturn string-nya.
- **Tindakan Sisi Client:** 
  - Panggil `google.script.run.getAppResources()` segera setelah *Splash Screen* / Layar Login dirender.
  - Setelah data diterima, injeksikan *string* HTML dan JS tersebut ke dalam DOM utama (misalnya ke dalam sebuah `<div id="app-container">`).
  - Setelah DOM siap, panggil fungsi inisialisasi *dashboard* sesuai *role* (seperti `inisialisasiPPL()` atau `inisialisasiAdmin()`), dan tutup animasi *loading*.

---

## 🚦 Verifikasi Hasil Akhir
Setelah semua langkah dieksekusi, lakukan pengujian berikut:
1. **Pengguna Baru (Tanpa Sesi):** Buka link aplikasi. Pastikan form login langsung muncul di bawah 1 detik.
2. **Pengguna Terautentikasi (Ada Sesi):** Login, lalu *refresh* halaman aplikasi. Pastikan langsung melihat layar *loading* ringan (< 1 detik), diikuti dengan kemunculan dashboard lengkap dalam beberapa detik kemudian.
3. **Fungsionalitas:** Uji coba klik fitur navigasi, penyimpanan data, dan render chart untuk memastikan tidak ada konflik variabel setelah JS diinjeksikan secara dinamis.
