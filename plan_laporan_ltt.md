# Plan: Laporan LTT — Halaman Laporan Detail

> Level: HIGH-LEVEL. Target eksekutor: junior programmer / LLM murah.

---

## Tujuan

Menambahkan menu **"Laporan LTT"** di sidebar Admin yang menampilkan seluruh data laporan dari dua sheet berbeda secara detail, lengkap dengan filter, live search, caching, dan pagination.

- **`Data_LTT`** → data laporan Jagung & Ubi Kayu (input manual PPL)
- **`Data_LTT_Padi`** → data laporan Padi dari tarikan ePusluh

Backend menggabungkan kedua sheet sebelum return ke client.

---

## Kolom yang Ditampilkan

Kedua sheet (`Data_LTT` dan `Data_LTT_Padi`) digabung menjadi satu tampilan tabel. Kolom diasumsikan sama strukturnya.

| No  | Kolom Sheet  | Label Tampil                                                          |
| --- | ------------ | --------------------------------------------------------------------- |
| 1   | Timestamp    | Tanggal & Waktu                                                       |
| 2   | Pelapor      | Nama Penyuluh                                                         |
| 3   | Kecamatan    | Kecamatan                                                             |
| 4   | Desa         | Desa                                                                  |
| 5   | Komoditas    | Komoditas                                                             |
| 6   | Jenis LTT    | Jenis LTT _(hanya terisi untuk Padi; kosong untuk Jagung & Ubi Kayu)_ |
| 7   | Target Tanam | Target Tanam (Ha)                                                     |
| 8   | Target Panen | Target Panen (Ha)                                                     |
| 9   | Luas Bera    | Lahan Bera (Ha)                                                       |
| 10  | Olah Lahan   | Olah Lahan (Ha)                                                       |
| 11  | Luas Tanam   | Luas Tanam (Ha)                                                       |
| 12  | Luas Panen   | Luas Panen (Ha)                                                       |
| 13  | Keterangan   | Keterangan                                                            |
| 14  | Status       | Status _(Menunggu / Disetujui / dll)_                                 |

Kolom tampil sama untuk semua 3 komoditas. Jenis LTT dikosongkan (tampil `—`) jika komoditas bukan Padi.

---

## Fitur

### 1. Filter (server-side via GAS, dikirim sebagai parameter)

- **Rentang Tanggal**: input tanggal 1 hari jangan from -to (format `yyyy-MM-dd`)
- **Kecamatan**: dropdown (isi dari daftar unik kecamatan)
- **Desa**: dropdown atau text, muncul setelah kecamatan dipilih (opsional)
- **Komoditas**: dropdown `Padi / Jagung / Ubi Kayu ` jgn ada filter smua komodtias
- Tombol **Terapkan Filter** → trigger fetch ulang ke GAS
- Tombol **Reset** → kembali ke default (tampilkan semua, tanggal 30 hari terakhir)

### 2. Live Search (client-side, tanpa GAS call)

- Input teks, search di atas tabel
- Cari berdasarkan: Nama Penyuluh, Kecamatan, atau Desa
- Filter berlaku pada data yang sudah di-load (hasil filter server)

### 3. Pagination (client-side)

- Opsi: **5 / 10 / 50 / Semua**
- Default: 10
- Tampilkan info: `Menampilkan X–Y dari Z data`
- Tombol Prev / Next

### 4. Tampilan Tabel

- Tabel responsif dengan horizontal scroll
- Baris berwarna bergantian (stripe)
- Kolom Tanggal format: `DD MMM YYYY HH:mm` (WIB)
- Kolom angka (Ha) diformat dengan koma: `1.234,56`
- Status ditampilkan ambil aja dari db jgn gunakan warna
- Kolom Jenis LTT tampilkan `—` uhntuk komodtias selain padi

---

## Arsitektur GAS (Backend)

### Fungsi Utama: `getLaporanLTT(params)`

- Menerima parameter: `{ tanggal, kecamatan, desa, komoditas }`
- Baca dua sheet dan gabungkan:
  - `Data_LTT` → Jagung & Ubi Kayu
  - `Data_LTT_Padi` → Padi
- Jika filter `komoditas` dipilih, hanya baca sheet yang relevan (skip sheet lain)
- Filter sesuai parameter yang dikirim
- Return array of objects sesuai kolom di atas, sudah terurut berdasarkan Timestamp terbaru
- **Role filter**: jika user adalah BPP/PPL, hanya tampilkan data kecamatan/desa mereka

### Caching (CacheService)

- **Cache key**: `laporan_ltt_{hash_params}` — hash sederhana dari JSON.stringify(params)
- **TTL**: 5 menit (data laporan cukup sering berubah, tidak seperti target)
- **Invalidasi**: setiap kali ada `submitLaporan`, `approvelaporan`, atau aksi tulis apapun ke `Data_LTT` maupun `Data_LTT_Padi` (termasuk import ePusluh) → hapus semua cache dengan prefix `laporan_ltt_`
- Karena GAS CacheService tidak support prefix-delete, simpan daftar active keys di satu cache key sentinel: `laporan_ltt_keys`
- Atau alternatif lebih sederhana: gunakan satu key `laporan_ltt_all` tanpa parameter — fetch semua data, filter di client. Pilih mana yang lebih cocok berdasarkan ukuran data.

**Rekomendasi**: jika jumlah baris `Data_LTT` < 5.000, gunakan **fetch-all + filter client-side** untuk simplisitas. Jika > 5.000, gunakan filter server-side dengan cache per params.

---

## Sidebar & Navigasi

- Tambahkan item menu `Laporan LTT` di sidebar Admin (antara menu yang sesuai)
- Klik menu → tampilkan section/panel `Laporan LTT`, sembunyikan section lain
- Icon: `fa-file-lines` atau `fa-clipboard-list`

---

## Penambahan yang Disarankan

1. **Export ke CSV / Excel**: tombol "Unduh" yang mengunduh data yang sedang ditampilkan (setelah filter + search)
2. **Ringkasan singkat di atas tabel**: total baris ditemukan, total luas tanam & panen (sum dari data ter-filter)
3. **Kolom ID Laporan**: tampilkan ID laporan (format `LTT-...`) sebagai tooltip atau kolom tersembunyi, berguna untuk debugging
4. **Sort kolom**: klik header untuk sort ascending/descending (terutama untuk Tanggal dan Luas Tanam)

---

## Urutan Eksekusi

1. Buat fungsi GAS `getLaporanLTT(params)` di `Database.gs` — baca & merge `Data_LTT` + `Data_LTT_Padi`
2. Tambahkan caching di fungsi tersebut
3. Tambahkan sidebar menu di `File_HTML_Admin.html`
4. Buat section HTML panel Laporan LTT (filter bar + tabel)
5. Buat fungsi JS untuk fetch, render tabel, live search, dan pagination
6. Test dengan data aktual
