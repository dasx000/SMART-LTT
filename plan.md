# Rencana Pengembangan: Upgrade Menu Laporan LTT

Dokumen ini berisi panduan tingkat tinggi (high-level) untuk melakukan upgrade pada fitur "Laporan LTT". Instruksi ini ditujukan agar mudah dieksekusi oleh junior programmer atau asisten AI.

## 1. Modifikasi Filter Tanggal (From - To)
Saat ini filter di Menu Laporan LTT hanya menggunakan satu input tanggal. Ini harus diubah menjadi rentang tanggal (Start Date & End Date).

### Kebutuhan Modifikasi:
- **UI/UX Frontend:** 
  - Ubah input filter yang ada menjadi dua buah input tipe `date` (misalnya: `Dari Tanggal` dan `Sampai Tanggal`).
  - Set nilai default untuk kedua input tersebut ke tanggal hari ini (*today*).
- **Validasi Frontend (Penting):**
  - Buat validasi yang memastikan tanggal "From" **tidak pernah melebihi** tanggal "To".
  - Buat validasi batasan rentang: Selisih waktu antara "From" dan "To" **maksimal 31 hari**. Jika melebihi rentang 31 hari, tampilkan notifikasi/pesan peringatan dan hentikan eksekusi pengambilan data. (Catatan: Ini penting untuk menjaga performa server Google Apps Script).
- **Penyesuaian Backend:**
  - Update parameter pada fungsi Google Apps Script yang mengambil data laporan (misalnya fungsi `getLaporanLTT`) agar menerima parameter dua rentang tanggal.
  - Modifikasi logika penyaringan data di backend agar melakukan filter rentang (*between*) dari "From" hingga "To".

---

## 2. Penambahan Kolom dan Tombol Aksi "Edit"
Saat ini tabel daftar Laporan LTT hanya menampilkan data tanpa interaksi lanjutan. Kita perlu memberikan akses kepada pengguna untuk melakukan perubahan.

### Kebutuhan Modifikasi:
- **Perubahan Tabel (Frontend):**
  - Tambahkan satu kolom baru pada tabel di posisi paling kanan dengan nama header "Aksi".
  - Di dalam kolom tersebut, sediakan sebuah tombol "Edit" pada setiap baris laporan.
- **Alur Interaksi (Event Handling):**
  - Ketika tombol "Edit" diklik, sistem harus menangkap ID unik dari baris data terkait (misal: `ID_Laporan`).
  - Tampilkan modal/form edit yang sudah terisi dengan data *existing* (pre-filled data) sesuai baris yang dipilih. (Bisa memanfaatkan ulang komponen form LTT yang sudah ada, dengan menambahkan penanda status "Mode Edit").
- **Pemrosesan Data (Backend):**
  - Pastikan terdapat fungsi backend (Google Apps Script) untuk melakukan *Update* baris pada Spreadsheet berdasarkan ID yang dikirim dari form Edit.

---

## Ringkasan Eksekusi (Untuk Junior Programmer)
1. Cari file HTML/JS yang menangani UI Laporan LTT, lalu ganti input tanggal tunggal menjadi ganda (From-To) + pasang logic validasi JS-nya.
2. Cari file `.gs` backend yang merespon pemanggilan data Laporan LTT, lalu sesuaikan agar menerima dan memproses rentang 2 tanggal.
3. Pada saat *render* tabel data (biasanya menggunakan loop JS atau template HTML), tambahkan tag `<button>Edit</button>` beserta data attribut (misal: `data-id`).
4. Buat event listener ketika tombol Edit ditekan untuk membuka modal form dan menampilkan data.
5. Buat atau update *endpoint* backend yang berfungsi untuk menimpa/menyimpan ulang data yang sudah diedit.
