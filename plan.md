# Plan: Fitur Input Produktivitas

> Dokumen ini sengaja high-level. Ikuti pola kode yang sudah ada (Target Bulanan, Laporan LTT, Dashboard PM AAS) untuk detail implementasi.

---

## 1. Ringkasan
- Input **produktivitas** komoditas **Padi, Jagung, Ubi Kayu**, satuan **ton/ha** (satuan di-hardcode, tidak bisa diubah user).
- Diisi **sebulan sekali** oleh **Koordinator BPP (role `Admin_BPP`)**, untuk **kecamatannya sendiri**.
- **Tidak ada kunci waktu**: input dan edit bisa dilakukan kapan saja.
- Bulan yang tidak diisi bernilai **0** (default). Nilai 0 juga berarti tidak ada panen.
- Koordinator BPP bisa **mengedit nilai di semua bulan** (bulan lalu, bulan berjalan, maupun bulan depan) lewat tombol Edit di tabel.
- Admin Kabupaten **hanya melihat**, tidak bisa mengedit.

## 2. Penyimpanan (backend, `Database.gs`)
- Buat sheet baru `Data_Produktivitas` (dibuat otomatis bila belum ada, ikuti pola `insertSheet` yang sudah ada).
- Kolom: `ID, Tahun, Bulan, Kecamatan, Komoditas, Produktivitas_Ton_Ha, NIP_Penginput, Nama_Penginput, Waktu_Input, Waktu_Update`.
- Kunci unik: **Tahun + Bulan + Kecamatan + Komoditas**. Jika sudah ada, simpan sebagai **update** (upsert), bukan baris baru.
- Bulan yang belum punya baris di sheet dianggap **0** saat ditampilkan (tidak perlu membuat baris kosong).
- Fungsi backend yang dibutuhkan:
  1. **Simpan produktivitas** (dipakai untuk input bulan berjalan maupun edit bulan lain): terima tahun, bulan, dan nilai 3 komoditas sekaligus.
     - Role harus `Admin_BPP`, kecamatan diambil dari data user login (bukan dari input).
     - Nilai harus angka ≥ 0. Kosong dianggap 0.
     - Bulan harus 1–12. Tidak ada batasan tanggal atau bulan (masa lalu & masa depan boleh).
     - Pakai `LockService` dan hapus cache terkait setelah simpan.
  2. **Ambil data per kecamatan per tahun**: kembalikan 12 bulan lengkap, bulan tanpa data diisi 0. Untuk tabel BPP.
  3. **Ambil rekap kabupaten per tahun + bulan**: semua kecamatan, kecamatan tanpa data diisi 0. Untuk tampilan Admin Kab.
- Timezone tetap `Asia/Jakarta`.

## 3. Tampilan Koordinator BPP (`File_HTML_PPL.html` + `File_Javascript.html`)
- Tambah tombol **"Produktivitas"** di section **"Menu Lainnya"**, letakkan **paling awal** (sebelum tombol "Target Bulanan").
- Tombol **hanya tampil** untuk role `Admin_BPP`, sembunyikan untuk `Penyuluh`.
- Isi panel (overlay full-screen, contoh pola: `targetArea`):
  1. **Header**: judul, nama kecamatan, bulan berjalan.
  2. **Form input bulan berjalan**: satu baris per komoditas (Padi, Jagung, Ubi Kayu), input angka desimal + label "ton/ha", default 0. Tombol Simpan. Jika data bulan ini sudah ada, isi form dengan nilai tersebut. Form selalu aktif (tidak dikunci).
  3. **Tabel hasil input** di bawah form: kolom Bulan | Padi | Jagung | Ubi Kayu | Waktu Update | Aksi.
     - Selalu tampil **12 bulan** untuk tahun terpilih, bulan tanpa data tampil **0**.
  4. **Tombol Edit** di setiap baris bulan (termasuk bulan depan): membuka modal berisi 3 input komoditas (terisi nilai saat ini), lalu simpan memakai fungsi simpan yang sama.
  5. **Filter tahun** (dropdown) di atas tabel, default tahun berjalan.
- Validasi juga di front end (angka ≥ 0), tapi validasi server tetap menjadi acuan.
- **Separator desimal**: user boleh mengetik koma atau titik (misal `5,5` atau `5.5`).
  - Pakai `<input type="text" inputmode="decimal">`, jangan `type="number"` (di sebagian browser HP koma ditolak).
  - Sebelum kirim ke server, ubah dengan helper yang sudah ada `_parseDesimal()` di `File_Javascript.html`.
  - Saat menampilkan nilai di form/tabel, pakai `_toKoma()` agar tampil dengan koma.
  - Di server, tetap amankan dengan `parseFloat(String(val).replace(',', '.'))`.

## 4. Tampilan Admin Kabupaten (`File_HTML_Admin.html` + `File_Javascript.html`)
- Tambah item sidebar baru **"Produktivitas"** (ikuti pola item sidebar yang sudah ada).
- Isi halaman (hanya lihat, tanpa tombol edit):
  1. **Filter**: Tahun (default tahun berjalan), Bulan (default bulan berjalan).
  2. **Tabel 15 kecamatan**: Kecamatan | Padi | Jagung | Ubi Kayu (ton/ha). Daftar kecamatan diambil dari `getKecamatanLaporan()` agar selalu 15 baris; kecamatan tanpa data tampil **0**.
  3. **Baris "Rata-rata Kabupaten"** di bagian bawah tabel (dicetak tebal), dihitung **per komoditas**:
     - Rata-rata = jumlah nilai ÷ jumlah kecamatan yang nilainya **> 0**. Kecamatan bernilai 0 **tidak ikut dihitung** (tidak masuk pembagi).
     - Jika semua kecamatan bernilai 0 untuk komoditas itu, tampilkan **0**.
     - Tampilkan juga jumlah kecamatan yang dihitung, misal `5,62 (12 kec)`, agar jelas basis rata-ratanya.
     - Bulatkan 2 angka desimal, tampil dengan koma (`_toKoma()`).
     - Hitung di backend (fungsi rekap kabupaten), front end tinggal menampilkan.

## 5. Checklist uji
- Login sebagai `Penyuluh`: tombol Produktivitas tidak muncul.
- Login sebagai `Admin_BPP`: form dan tombol Edit bisa dipakai di tanggal berapa pun.
- Simpan berhasil, simpan ulang meng-update baris yang sama (tidak dobel).
- Bulan yang belum diisi tampil 0 di tabel BPP dan Admin Kab.
- Edit bulan lalu dan bulan depan berhasil dan langsung terlihat di tabel BPP & Admin Kab.
- Panggilan simpan dengan role selain `Admin_BPP` ditolak server.
- Admin Kab: 15 kecamatan selalu tampil, filter tahun/bulan berfungsi, tidak ada tombol edit.
- Rata-rata kabupaten: contoh 3 kecamatan isi Padi 5, 6, 7 dan 12 kecamatan 0 → rata-rata **6,00 (3 kec)**, bukan 1,2.
- Naikkan `CODE_VERSION` di `Code.gs` setelah mengubah file HTML.
