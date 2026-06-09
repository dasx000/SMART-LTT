# Planning Fitur Saran (Feedback)

Fitur ini bertujuan untuk memfasilitasi pengguna (khususnya PPL) agar dapat mengirimkan saran atau masukan terkait aplikasi. Saran ini akan diteruskan secara *real-time* ke server Node.js eksternal menggunakan mekanisme Webhook.

## Alur Kerja (Workflow)

### 1. Frontend (Antarmuka Pengguna)
- **Penempatan Tombol**: Tambahkan tombol "Kirim Saran" atau sejenisnya pada halaman/dashboard PPL, letakkan di bagian **Menu Lainnya**.
- **Form Input**: Saat tombol diklik, tampilkan modal atau pop-up sederhana (bisa memanfaatkan *SweetAlert2* yang sudah terintegrasi di sistem) yang memuat *text area* untuk mengetik saran.
- **Aksi Submit**: Setelah pengguna menekan tombol kirim, ambil teks tersebut beserta identitas *user* yang sedang aktif (seperti NIP atau Nama), lalu panggil fungsi backend Google Apps Script.

### 2. Backend (Google Apps Script)
- **Fungsi Handler**: Buat fungsi baru di backend (misalnya `kirimSaran(teksSaran, infoPengguna)`).
- **Proses Webhook**: Di dalam fungsi tersebut, gunakan rutin yang serupa dengan contoh `testWebhook()` di `Code.gs`.
- **Eksekusi**: Lakukan HTTP POST request menggunakan `UrlFetchApp.fetch` ke URL Node.js yang sudah Anda siapkan. Kirimkan data *payload* dengan tipe `application/json`.
- **Penanganan Error**: Pastikan untuk menyertakan atribut `muteHttpExceptions: true` pada konfigurasi *fetch* agar jika Node.js *down*, aplikasi utama LTT tidak mengalami *crash*, lalu kembalikan status berhasil/gagal ke Frontend.

### 3. Respons (Notifikasi)
- Setelah backend selesai memanggil webhook, berikan notifikasi umpan balik (misalnya "Saran berhasil dikirim, terima kasih!") kepada PPL melalui antarmuka.

## Panduan Eksekusi (Untuk Junior/LLM)
- Cukup buat satu blok kode UI untuk modal di `File_HTML_PPL`.
- Sisipkan logika pemanggilan `google.script.run` pada `File_Javascript`.
- Duplikasi dan modifikasi sedikit struktur dari `testWebhook()` di `Code.gs` untuk menangkap parameter teks saran, lalu sesuaikan URL Webhooknya dengan URL Node.js yang sesungguhnya.
