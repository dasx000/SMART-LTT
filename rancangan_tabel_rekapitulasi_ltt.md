# 📋 RANCANGAN: TABEL REKAPITULASI LUAS TAMBAH TANAM (LTT) BULANAN

Dokumen ini berisi instruksi **Langkah-demi-Langkah (Step-by-Step)** untuk mengimplementasikan Tabel Rekapitulasi LTT Bulanan (seperti pada format baku Excel dinas) ke dalam aplikasi e-LTT berbasis web.

Tabel ini akan menampilkan data agregasi dari setiap kecamatan untuk berbagai komoditas.

---

## 🎯 1. TUJUAN & LOKASI PENEMPATAN
*   **Lokasi**: Di dalam file `File_HTML_Admin.html` (Panel Admin Kabupaten).
*   **Posisi**: Tepat di bawah sesi grafik "Target vs Realisasi per Kecamatan" atau grafik tren harian.
*   **Karakteristik**: Karena tabel memiliki banyak kolom (sangat lebar), tabel wajib dibungkus dengan kontainer yang bisa di-scroll secara horizontal (`overflow-x-auto`) agar ramah layar kecil.

---

## 🎨 2. SPESIFIKASI UI/UX & STYLING (TAILWIND CSS)
Desain tabel tidak boleh terlihat kaku seperti Excel murni, melainkan harus menggunakan standar UI modern yang premium.

### A. Pembungkus Tabel (Card Container)
Gunakan card modern:
*   Kelas: `bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8 overflow-hidden`
*   Header Card: Teks judul `text-lg font-bold text-gray-800` ("REKAPITULASI LUAS TAMBAH TANAM (LTT) BULANAN").

### B. Struktur Tabel (`<table>`)
*   Bungkus tag `<table>` dengan `div` berkelas `overflow-x-auto w-full`.
*   Tabel menggunakan garis batas tipis: `w-full text-left border-collapse border border-gray-200`.

### C. Header Tabel (Nested `<thead>`)
Tabel memiliki 2 baris header (nested/col-span).
*   **Warna Latar**: Abu-abu lembut (`bg-gray-50`).
*   **Teks Header**: `text-xs font-bold text-gray-700 uppercase tracking-wider text-center p-3 border border-gray-200`.
*   **Struktur Baris 1**:
    *   `<th rowspan="2">NO</th>`
    *   `<th rowspan="2">KECAMATAN</th>`
    *   `<th colspan="2">PADI SAWAH</th>`
    *   `<th colspan="2">PADI GOGO</th>`
    *   `<th colspan="2">JAGUNG</th>`
    *   `<th colspan="2">KEDELAI</th>`
    *   `<th colspan="2">UBI KAYU</th>`
*   **Struktur Baris 2**:
    *   Diulang 5 kali untuk tiap komoditas: 
    *   `<th>TAMBAH TANAM (HA)</th>`
    *   `<th>PANEN (HA)</th>`

### D. Isi Tabel (`<tbody>`)
*   **Baris (Row)**: Hover effect `hover:bg-blue-50/30 transition duration-150`.
*   **Sel (Cell)**: `p-3 text-sm text-gray-600 border border-gray-200`.
*   *Catatan*: Kolom NO dan KECAMATAN teksnya rata kiri/tengah. Kolom angka (HA) **wajib rata kanan** (`text-right font-mono`).

### E. Footer Tabel (`<tfoot>` - Baris JUMLAH)
*   Baris total/jumlah di bawah.
*   **Styling**: `bg-yellow-50 text-yellow-800 font-bold`.
*   **Teks**: Kolom 1-2 digabung (`colspan="2"`) teks "JUMLAH" rata tengah. Kolom angka dicetak tebal rata kanan.

---

## 🛠️ 3. INSTRUKSI EKSEKUSI UNTUK JUNIOR PROGRAMMER / LLM

Jika Anda ditugaskan untuk mengeksekusi rancangan ini, ikuti 3 langkah berikut tanpa merusak kode yang sudah ada:

### LANGKAH 1: Injeksi HTML di `File_HTML_Admin.html`
1. Cari lokasi penempatan yang tepat (misalnya di bawah `<!-- Target vs Realisasi -->`).
2. Tulis blok HTML Card berisi `div.overflow-x-auto` dan struktur `table` kosong yang hanya memiliki `thead` sesuai spesifikasi di atas.
3. Beri ID pada `tbody` (misalnya: `id="tbodyRekapLTT"`) dan pada `tfoot` (misalnya: `id="tfootRekapLTT"`).

### LANGKAH 2: Buat Fungsi Render di `File_Javascript.html`
1. Buat fungsi baru bernama `function renderTabelRekapLTT(data) { ... }`.
2. Fungsi ini harus me-loop array daftar kecamatan.
3. Untuk setiap kecamatan, ekstrak nilai Tanam & Panen dari objek data untuk jenis komoditas:
   - `LTTReguler` (Padi Sawah)
   - `PadiGogo`
   - `Jagung`
   - `Kedelai` (Jika datanya sudah tersedia di backend)
   - `UbiKayu`
4. Lakukan akumulasi variabel `total` untuk setiap kolom angka.
5. Gunakan `toLocaleString('id-ID')` untuk memformat angka dengan koma/titik ribuan agar mudah dibaca.
6. Suntikkan string HTML baris tersebut ke dalam `tbodyRekapLTT.innerHTML`.
7. Suntikkan baris total ke `tfootRekapLTT.innerHTML`.

### LANGKAH 3: Panggil Fungsi Render
1. Cari fungsi yang bertugas menarik data dari backend untuk Dashboard (kemungkinan besar `muatChartTarget()` atau fungsi lain yang memanggil `getDashboardTarget()`).
2. Setelah data sukses ditarik dari server, panggil fungsi `renderTabelRekapLTT(data)` dan lewatkan data tersebut.
3. Pastikan menampilkan animasi "Loading..." di tabel sebelum data terisi penuh.

---
**Pesan Penutup**: Selalu perhatikan *responsive design*. Tabel ini sangat lebar, sehingga `overflow-x-auto` pada pembungkus tabel adalah syarat mutlak agar tampilan tidak berantakan di layar kecil. Selamat mengeksekusi!
