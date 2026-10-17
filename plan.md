# Plan: Fitur Input Produktivitas

> Dokumen ini sengaja high-level. Ikuti pola kode yang sudah ada (Target Bulanan, Laporan LTT, Dashboard PM AAS) untuk detail implementasi.

---

## Input Produktivitas (ton/ha)

### A1. Ringkasan
- Input **produktivitas** komoditas **Padi, Jagung, Ubi Kayu**, satuan **ton/ha** (satuan di-hardcode, tidak bisa diubah user).
- Diisi **sebulan sekali** oleh **Koordinator BPP (role `Admin_BPP`)**, untuk **kecamatannya sendiri**.
- Jendela input: **tanggal 25 s.d. tanggal terakhir bulan berjalan**. Di luar itu menu tetap bisa dibuka untuk melihat tabel, tapi form terkunci.
- Hanya bisa input untuk **bulan berjalan** (tidak bisa mundur/maju bulan).
- Komoditas yang **tidak ada panen** di bulan itu boleh dikosongkan, dengan menandai "Tidak ada panen".

### A2. Penyimpanan (backend, `Database.gs`)
- Buat sheet baru `Data_Produktivitas` (dibuat otomatis bila belum ada, ikuti pola `insertSheet` yang sudah ada).
- Kolom yang disarankan: `ID, Tahun, Bulan, Kecamatan, Komoditas, Produktivitas_Ton_Ha, Tidak_Ada_Panen, NIP_Penginput, Nama_Penginput, Waktu_Input, Waktu_Update`.
- Kunci unik: **Tahun + Bulan + Kecamatan + Komoditas**. Kalau sudah ada, simpan sebagai **update** (upsert), bukan baris baru.
- Fungsi backend yang dibutuhkan:
  1. **Simpan produktivitas**: terima data 3 komoditas sekaligus. Validasi di server: role harus `Admin_BPP`, tanggal hari ini harus 25–akhir bulan, bulan/tahun harus bulan berjalan, nilai harus angka > 0 kecuali ditandai tidak ada panen. Pakai `LockService` dan hapus cache terkait setelah simpan.
  2. **Ambil riwayat per kecamatan per tahun**: untuk tabel di sisi BPP.
  3. **Ambil rekap kabupaten per tahun (+ opsional bulan)**: untuk tampilan Admin Kab.
- Timezone tetap `Asia/Jakarta`.

### A3. Tampilan Koordinator BPP (`File_HTML_PPL.html` + `File_Javascript.html`)
- Tambah tombol **"Produktivitas"** di section **"Menu Lainnya"**, letakkan **paling awal** (sebelum tombol "Target Bulanan").
- Tombol **hanya tampil** untuk role `Admin_BPP`, sembunyikan untuk `Penyuluh`.
- Saat jendela input tertutup (tanggal < 25), tampilkan ikon gembok di tombol (contoh pola: `ikonGembokTarget`). Menu tetap bisa dibuka untuk melihat tabel.
- Isi panel (overlay full-screen, contoh pola: `targetArea`):
  1. **Header**: judul, nama kecamatan, bulan berjalan.
  2. **Form input**: satu baris per komoditas (Padi, Jagung, Ubi Kayu), input angka desimal + label "ton/ha" + checkbox "Tidak ada panen bulan ini" yang menonaktifkan input-nya. Tombol Simpan. Jika data bulan ini sudah ada, isi form dengan nilai tersebut (mode edit).
  3. **Info jendela**: teks seperti "Input dibuka 25–31 Oktober 2026" atau "Input ditutup, dibuka kembali tgl 25".
  4. **Tabel hasil input** di bawah form: kolom Bulan | Padi | Jagung | Ubi Kayu | Waktu Input. Yang tidak ada panen tampil "–" atau label "Tidak panen".
  5. **Filter tahun** (dropdown) di atas tabel, default tahun berjalan.
- Validasi juga di front end (rentang tanggal, angka wajib), tapi validasi server tetap menjadi acuan.

### A4. Tampilan Admin Kabupaten (`File_HTML_Admin.html` + `File_Javascript.html`)
- Tambah item sidebar baru **"Produktivitas"** (ikuti pola item sidebar yang sudah ada).
- Isi halaman:
  1. **Filter**: Tahun (default tahun berjalan), Bulan (default bulan berjalan), Komoditas (opsional: tab Padi/Jagung/Ubi Kayu seperti di dashboard capaian).
  2. **Kartu ringkasan**: rata-rata kabupaten per komoditas, serta jumlah kecamatan yang sudah input dari 15.
  3. **Tabel 15 kecamatan**: Kecamatan | Padi | Jagung | Ubi Kayu | Status (Sudah input / Belum / Tidak panen). Daftar kecamatan diambil dari `getKecamatanLaporan()` agar selalu 15 baris, termasuk yang belum input.
  4. **Baris rata-rata kabupaten** di bawah tabel.
  5. (Opsional) Tampilan tahunan: tabel kecamatan × bulan untuk satu komoditas, untuk melihat tren.
- Admin Kab hanya **melihat**. Edit oleh Admin Kab opsional (lihat saran di bawah).

### A5. Saran / hal yang perlu diputuskan
1. **Cara hitung rata-rata**: rata-rata biasa dari kecamatan yang mengisi (lebih sederhana), atau rata-rata **tertimbang luas panen** dari data LTT bulan itu (lebih akurat secara statistik). Rekomendasi: mulai dari rata-rata biasa, kecamatan "Tidak panen" atau kosong **tidak dihitung** pembaginya.
2. **Batas nilai wajar** untuk mencegah salah ketik (misal input 55 padahal 5,5). Contoh peringatan (bukan blokir): Padi 2–12, Jagung 2–12, Ubi Kayu 10–50 ton/ha. Angkanya perlu dikonfirmasi ke dinas.
3. **Keterlambatan**: perlu ada mekanisme Admin Kab membuka kunci atau mengisi atas nama kecamatan jika BPP terlambat lewat akhir bulan?
4. **Pengingat**: badge/notifikasi di menu mulai tanggal 25 jika bulan ini belum diisi.
5. **Export Excel/CSV** untuk tabel Admin Kab (ikuti pola export yang sudah ada jika ada).
6. **Cross-check dengan LTT**: jika ditandai "Tidak ada panen" padahal data LTT bulan itu punya luas panen > 0, tampilkan peringatan.

### A6. Checklist uji
- Login sebagai `Penyuluh`: tombol Produktivitas tidak muncul.
- Login sebagai `Admin_BPP` tgl < 25: tombol bergembok, tabel bisa dilihat, form tidak bisa disimpan (cek juga panggilan langsung ke server ditolak).
- Tgl 25–akhir bulan: simpan berhasil, simpan ulang meng-update baris yang sama (tidak dobel).
- Tanda "Tidak ada panen" tersimpan dan tampil benar di tabel BPP & Admin Kab.
- Admin Kab: 15 kecamatan selalu tampil, rata-rata benar, filter tahun/bulan berfungsi.
- Naikkan `CODE_VERSION` di `Code.gs` setelah mengubah file HTML.
