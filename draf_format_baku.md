# DOKUMEN DRAF FORMAT BAKU PELAPORAN LTT DIGITAL
**Aplikasi SMART LTT (Luas Tambah Tanam)**

Dokumen ini menetapkan format baku, tipe data, aturan validasi, dan skema database untuk pelaporan data Luas Tambah Tanam (LTT) secara digital tingkat Kecamatan dan Kabupaten.

---

### I. VARIABEL DATA & ATURAN VALIDASI
Setiap laporan LTT yang diinput oleh Penyuluh Pertanian Lapangan (PPL) harus memenuhi variabel berikut:

| No | Nama Variabel | Tipe Data | Format / Satuan | Keterangan & Validasi |
| :---: | :--- | :---: | :---: | :--- |
| 1 | Tanggal Realisasi | Date | `DD-MM-YYYY` | Tanggal riil tanam/panen di lapangan (bukan tanggal input). |
| 2 | Wilayah Kecamatan | Pilihan (Dropdown) | Teks | Otomatis terisi berdasarkan wilayah tugas BPP terkait. |
| 3 | Wilayah Desa | Pilihan (Dropdown) | Teks | Pilihan desa yang berada di bawah naungan Kecamatan terkait. |
| 4 | Komoditas | Pilihan (Dropdown) | Teks | Pilihan: `Padi Sawah`, `Padi Gogo`, `Jagung`, atau `Ubi Kayu`. |
| 5 | Jenis LTT / Metode | Pilihan (Dropdown) | Teks | Pilihan: `Manual`, `Alsintan`, `Tabela` (Sesuai Komoditas). |
| 6 | Luas Tanam | Desimal | Hektar (Ha) | Nilai harus $\ge 0$. Menggunakan titik `.` atau koma `,` desimal. |
| 7 | Luas Panen | Desimal | Hektar (Ha) | Nilai harus $\ge 0$. Menggunakan titik `.` atau koma `,` desimal. |
| 8 | Target Tanam | Desimal | Hektar (Ha) | Target tanam bulanan (Opsional). |
| 9 | Target Panen | Desimal | Hektar (Ha) | Target panen bulanan (Opsional). |
| 10| Luas Bera / Olah Lahan| Desimal | Hektar (Ha) | Luasan lahan bera atau yang sedang dalam pengolahan. |
| 11| Keterangan Tambahan | Teks Bebas | String | Catatan khusus seperti varietas, kendala hama, atau iklim. |

---

### II. SKEMA DATABASE (GOOGLE SHEETS: `Data_LTT`)
Data yang dikirim dari form input digital akan langsung disimpan ke dalam tabel database Google Sheets dengan struktur kolom sebagai berikut:

```
[Kolom A] ID_Laporan     : Kode unik otomatis (Format: LTT-Timestamp-Komoditas)
[Kolom B] Timestamp      : Tanggal & waktu pengiriman data dari perangkat user
[Kolom C] Pelapor        : Nama Lengkap Penyuluh (PPL)
[Kolom D] Kecamatan      : Nama Kecamatan lokasi LTT
[Kolom E] Desa           : Nama Desa lokasi LTT
[Kolom F] Komoditas      : Komoditas (Padi/Jagung/Ubi Kayu)
[Kolom G] Jenis_LTT      : Metode tanam yang digunakan
[Kolom H] Target_Tanam   : Angka target tanam (Ha)
[Kolom I] Target_Panen   : Angka target panen (Ha)
[Kolom J] Luas_Bera      : Luas lahan bera (Ha)
[Kolom K] Olah_Lahan     : Luas lahan olah tanah (Ha)
[Kolom L] Luas_Tanam     : Realisasi luas tanam (Ha)
[Kolom M] Luas_Panen     : Realisasi luas panen (Ha)
[Kolom N] Keterangan     : Catatan/keterangan tambahan
[Kolom O] Status         : Status verifikasi data ("Menunggu", "Disetujui", "Ditolak")
[Kolom P] Verifikator    : Nama petugas BPP/Kabupaten yang memverifikasi data
[Kolom Q] Tgl_Verifikasi : Waktu verifikasi dilakukan
[Kolom R] NIP_Pelapor    : Nomor Induk Pegawai pelapor untuk validasi sistem
```

---

### III. RANCANGAN ANTARMUKA FORM INPUT (MOCKUP LOGIS)
1. **Header Form:** Menampilkan nama penyuluh aktif dan wilayah tugasnya secara otomatis setelah login.
2. **Date Picker:** Kalender interaktif terbatas hanya pada bulan berjalan untuk mencegah kesalahan input tanggal di luar periode pelaporan.
3. **Dropdown Dinamis:** Pilihan desa otomatis menyaring hanya desa yang berada di kecamatan tugas penyuluh.
4. **Input Angka:** Dilengkapi validasi otomatis agar tidak bisa memasukkan karakter selain angka dan tanda koma/titik desimal.
5. **Tombol Konfirmasi:** Tombol "Kirim Laporan" yang memicu animasi *loading* sebelum data tersimpan ke Google Sheets.
