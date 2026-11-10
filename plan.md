# Plan: Produktivitas & Sarana per Desa

> Menggantikan plan "Produktivitas per Kecamatan". Ikuti pola kode yang sudah ada (fitur Produktivitas lama, Target Bulanan, Laporan LTT) untuk detail implementasi.
> Permintaan dari Katim (Mbak Alen): produktivitas padi & jagung per desa Jan–sekarang, plus jumlah gudang gabah, embung, lantai jemur, dan mesin pengering per desa.

---

## 1. Keputusan yang sudah disepakati
| # | Keputusan |
|---|---|
| 1 | Produktivitas diganti total menjadi **per desa**. Input per kecamatan dihapus. |
| 2 | Yang input: **PPL (role `Penyuluh` dan `Admin_BPP`) untuk desa binaannya sendiri** (`Desa_Binaan` di `Data_User`, bisa lebih dari satu desa, dipisah koma). |
| 3 | Komoditas: **Padi, Jagung, Ubi Kayu**. Satuan ton/ha (hardcode). |
| 4 | Tidak ada kolom sumber data. |
| 5 | Diisi manual oleh PPL per bulan, Jan–Des, tanpa kaitan dengan luas panen di Data_LTT. **Nilai 0 atau kosong tidak ikut rata-rata.** |
| 6 | Sarana cukup **jumlah per desa** (4 angka). |
| 7 | "Kampung" = desa di `Data_Geografi`. |
| 8 | Rata-rata kecamatan = rata-rata desa yang > 0. **Rata-rata kabupaten = rata-rata kecamatan yang > 0.** |
| 9 | Koordinator BPP: **hanya melihat rekap** kecamatannya (+ unduh Excel), tidak mengedit desa milik PPL lain. Desa binaannya sendiri tetap ia isi seperti PPL biasa. |
| 10 | Sarana disimpan **satu data per desa** (bisa diupdate kapan saja, tanpa riwayat per tahun). |
| 11 | Sheet lama `Data_Produktivitas` **diarsipkan** (rename), tidak dihapus. |
| 12 | Tidak ada kunci waktu: semua bulan (lalu/berjalan/depan) bisa diisi & diedit kapan saja. |

## 2. Penyimpanan (backend, `Database.gs`)

### 2a. Sheet `Data_Produktivitas_Desa` (format lebar)
- Kolom: `ID, Tahun, Kecamatan, Desa, Komoditas, Jan, Feb, Mar, Apr, Mei, Jun, Jul, Agu, Sep, Okt, Nov, Des, NIP_Penginput, Nama_Penginput, Waktu_Input, Waktu_Update`.
- **Satu baris = Tahun + Desa + Komoditas** (kunci unik; Kecamatan ikut dicocokkan supaya nama desa kembar di kecamatan lain tidak bentrok).
- Alasan format lebar: simpan 12 bulan × 3 komoditas cukup **3 kali `setValues`** (bukan 36 kali tulis), dan sheet mudah dibaca langsung oleh manusia.
- Sel kosong = 0. Nilai disimpan sebagai angka (titik desimal di sheet, tampilan pakai koma).
- Baris yang 12 bulannya 0 semua boleh tetap ada (tidak perlu dihapus).

### 2b. Sheet `Data_Sarana_Desa`
- Kolom: `ID, Kecamatan, Desa, Gudang_Gabah, Embung, Lantai_Jemur, Mesin_Pengering, NIP_Penginput, Nama_Penginput, Waktu_Input, Waktu_Update`.
- Satu baris = satu desa (kunci Kecamatan + Desa). Nilai **bilangan bulat ≥ 0** (unit).
- Beda dengan produktivitas: **0 tetap disimpan**, karena "0 unit" berbeda dari "belum diisi". Desa tanpa baris tampil **"belum diisi"**.

### 2c. Arsip data lama
- Helper `getSheetProduktivitasDesa_(ss)`: jika `Data_Produktivitas` (versi kecamatan) masih ada dan `Data_Produktivitas_Kec_Arsip` belum ada, **rename** jadi `Data_Produktivitas_Kec_Arsip`. Lalu buat `Data_Produktivitas_Desa` bila belum ada.
- Hapus konstanta & fungsi lama yang tidak terpakai (`simpanProduktivitas`, `getProduktivitasKecamatan`, versi lama `getProduktivitasKabupaten`/`getProduktivitasSemua`).

### 2d. Keamanan input
- Server **tidak percaya** role/kecamatan/desa dari client. Dari `nip`, cari user di `Data_User`, lalu:
  - Role harus `Penyuluh` atau `Admin_BPP` dan status aktif.
  - `desa` yang dikirim harus ada di `Desa_Binaan` user (bandingkan trim + huruf kecil).
  - `kecamatan` diambil dari `Nama_Kecamatan` user, bukan dari input.
- Validasi angka: produktivitas desimal ≥ 0 (koma/titik diterima, `parseFloat(String(v).replace(',', '.'))`), sarana bilangan bulat ≥ 0. Kosong = 0.
- Pakai `LockService` saat simpan. Timezone `Asia/Jakarta`.

### 2e. Fungsi backend
| Fungsi | Dipakai oleh | Isi |
|---|---|---|
| `getProduktivitasDesa({nip, desa, tahun})` | PPL | 12 bulan × 3 komoditas untuk satu desa + waktu update terakhir. Desa harus desa binaan user. |
| `simpanProduktivitasDesa({nip, desa, tahun, nilai})` | PPL | `nilai = {Padi:[12], Jagung:[12], 'Ubi Kayu':[12]}`. Upsert 3 baris sekaligus. |
| `getSaranaDesa({nip, desa})` | PPL | 4 angka sarana atau `null` jika belum diisi. |
| `simpanSaranaDesa({nip, desa, nilai})` | PPL | Upsert 1 baris. |
| `getRekapProduktivitasKecamatan({kecamatan, tahun, bulan})` | BPP & Admin Kab (detail) | Semua desa kecamatan itu + rata-rata kecamatan per komoditas `{nilai, jumlahDesa}`. |
| `getRekapProduktivitasKabupaten({tahun, bulan})` | Admin Kab | Semua kecamatan (rata-rata kecamatan + jumlah desa terhitung) + rata-rata kabupaten `{nilai, jumlahKec}`. |
| `getRekapSaranaKecamatan({kecamatan})` | BPP & Admin Kab (detail) | Semua desa + total kecamatan + "desa terisi x / y". |
| `getRekapSaranaKabupaten()` | Admin Kab | Total per kecamatan + total kabupaten + desa terisi. |
| `getProduktivitasSaranaExport({tahunDari, tahunSampai, kecamatan?})` | Excel | Data mentah produktivitas + sarana; `kecamatan` diisi untuk BPP. |

- **Daftar desa** per kecamatan diambil dari `Data_Geografi` (`getDaftarDesabyKecamatan`), plus desa yang ada di data tapi tidak ada di Geografi (agar data tidak hilang dari tampilan). Daftar kecamatan dari `getKecamatanLaporan()` (selalu 15).
- **Rumus rata-rata** (dihitung di backend, dibulatkan 2 desimal):
  - Kecamatan (per komoditas, per bulan) = jumlah nilai desa > 0 ÷ banyaknya desa > 0. Jika tidak ada → 0.
  - Kabupaten = jumlah rata-rata kecamatan > 0 ÷ banyaknya kecamatan > 0. Jika tidak ada → 0.
  - Contoh uji: Kec A desa 5, 6, 0 → 5,50 (2 desa). Kec B desa 7 → 7,00 (1 desa). Kec lain 0 → Kab = (5,5 + 7) ÷ 2 = **6,25 (2 kec)**.

## 3. Tampilan PPL & Koordinator BPP (`File_HTML_PPL.html` + `File_Javascript.html`)

### 3a. Menu Lainnya
- Tombol **"Produktivitas"** (sudah ada, ikon `fa-scale-balanced`) sekarang tampil untuk **`Penyuluh` dan `Admin_BPP`**.
- Tombol baru **"Sarana Desa"** (ikon mis. `fa-warehouse`) tepat setelahnya, untuk kedua role.

### 3b. Panel Produktivitas (`prodArea`, dirombak)
1. **Header**: judul, nama kecamatan.
2. **Pilih Desa** (dropdown dari `Desa_Binaan`; jika hanya 1 desa, tampil sebagai teks) + **Pilih Tahun** (default tahun berjalan).
3. **Tabel isian 12 bulan** (bisa langsung diketik, cocok untuk mengisi Jan–sekarang sekaligus):
   `Bulan | Padi | Jagung | Ubi Kayu` — tiap sel `<input type="text" inputmode="decimal">`, bulan berjalan disorot.
   - Tampilan nilai pakai `_toKoma()`, kirim ke server mentah (server yang parse).
   - Catatan kecil: "Satuan ton/ha. Kosongkan atau isi 0 bila tidak ada panen."
4. **Tombol "Simpan"** (satu tombol untuk seluruh tabel). Validasi front end per sel (sel tidak valid diberi border merah). Tampilkan "Terakhir diperbarui: dd/MM/yyyy HH:mm".
5. Jika ganti desa/tahun saat ada perubahan belum disimpan → konfirmasi dulu.
6. **Khusus `Admin_BPP`**: di atas panel ada tab **"Isi Desa Saya" | "Rekap Kecamatan"**.
   - Rekap Kecamatan: filter Tahun + Bulan, tabel `Desa | Padi | Jagung | Ubi Kayu` untuk semua desa di kecamatannya, baris tebal **"Rata-rata Kecamatan"** dengan `(n desa)`, tombol **Unduh Excel** (kecamatannya saja). Hanya lihat.
   - Jika Admin_BPP tidak punya desa binaan, tab "Isi Desa Saya" disembunyikan dan langsung tampil Rekap.

### 3c. Panel Sarana Desa (`saranaArea`, baru, pola sama dengan `prodArea`)
1. Pilih Desa (sama seperti di atas).
2. Form 4 isian angka bulat (`inputmode="numeric"`): Gudang Penyimpanan Gabah, Embung, Lantai Jemur, Mesin Pengering (label "unit").
3. Jika belum pernah diisi → form kosong + label "Belum diisi". Tombol **Simpan** + "Terakhir diperbarui".
4. **Khusus `Admin_BPP`**: tab **Rekap Kecamatan**: tabel `Desa | Gudang | Embung | Lantai Jemur | Pengering`, desa belum mengisi tampil "–" (abu-abu), baris **Total Kecamatan** + "Desa terisi x / y". Hanya lihat.

## 4. Tampilan Admin Kabupaten (`File_HTML_Admin.html` + `File_Javascript.html`)
- Sidebar: **"Produktivitas"** (sudah ada) dan item baru **"Sarana Desa"**, `data-roles="Admin_Kab"`.

### 4a. Section Produktivitas (dirombak)
- Filter Tahun + Bulan, tombol **Unduh Excel**.
- Tabel 15 kecamatan: `Kecamatan | Padi | Jagung | Ubi Kayu`; nilai = rata-rata kecamatan, dengan keterangan kecil `(n desa)`.
- Footer tebal **"Rata-rata Kabupaten"** dengan `(n kec)`.
- **Klik baris kecamatan** → baris detail terbuka di bawahnya (accordion) berisi semua desa kecamatan itu (memakai `getRekapProduktivitasKecamatan`). Hanya lihat.

### 4b. Section Sarana Desa (baru)
- Tabel 15 kecamatan: `Kecamatan | Gudang | Embung | Lantai Jemur | Pengering | Desa Terisi` (mis. `8 / 12`).
- Footer **Total Kabupaten**. Klik kecamatan → detail per desa. Tombol **Unduh Excel**.

## 5. Excel (ExcelJS, diolah di client, pola `_buatExcelProduktivitas` lama)
- File: `Produktivitas_Sarana_<tahun>_<yyyymmdd>.xlsx` (Admin Kab: semua kecamatan; BPP: kecamatannya saja).
- **Sheet per komoditas per tahun** (mis. `Padi 2026`): kolom `No | Kecamatan | Desa | Jan … Des`.
  - Desa dikelompokkan per kecamatan; setelah tiap kelompok ada baris tebal **"Rata-rata Kec. X"**.
  - Baris paling bawah **"Rata-rata Kabupaten"** (hanya di file Admin Kab).
  - Catatan: "0 = tidak ada panen / belum diisi. Rata-rata hanya dari nilai > 0."
- **Sheet `Sarana Desa`**: `No | Kecamatan | Desa | Gudang Gabah | Embung | Lantai Jemur | Mesin Pengering | Terakhir Update`, subtotal per kecamatan, total kabupaten. Desa belum mengisi ditulis kosong.

## 6. Lain-lain
- Naikkan `CODE_VERSION` di `Code.gs` (saat ini di working tree tertulis `1`, sebelumnya `21` — set ke **22**).
- Hapus cache terkait setelah simpan jika ada cache rekap.
- Kode front end lama untuk input kecamatan (`simpanProduktivitasBppForm`, `editProduktivitasBpp`, form `prodInputPadi` dkk.) dihapus.

## 7. Urutan eksekusi (target selesai hari ini)
1. Commit kondisi sekarang sebagai checkpoint.
2. Backend: sheet + arsip + fungsi simpan/ambil + rekap + export (Bagian 2).
3. Panel PPL: Produktivitas + Sarana (Bagian 3a–3c, tanpa tab BPP).
4. Tab Rekap Kecamatan untuk Admin_BPP.
5. Section Admin Kab: Produktivitas + Sarana (Bagian 4).
6. Excel (Bagian 5).
7. Uji (Bagian 8), `clasp push`, naikkan `CODE_VERSION`.

## 8. Checklist uji
- PPL dengan 1 desa: dropdown tidak muncul, nama desa tampil. PPL dengan 2+ desa: bisa pilih desa, data tidak tertukar.
- Isi Jan–Nov sekaligus lalu Simpan → di sheet muncul 3 baris (Padi/Jagung/Ubi Kayu) untuk desa+tahun itu. Simpan ulang → baris sama ter-update, tidak dobel.
- Input `5,5` dan `5.5` sama-sama tersimpan 5.5. Input huruf / negatif ditolak (front end & server).
- Memanggil simpan dengan desa di luar `Desa_Binaan` atau NIP non-PPL → ditolak server.
- Sarana: desa belum mengisi tampil "Belum diisi"; isi 0 semua → tampil 0 (bukan "belum diisi").
- Rata-rata: contoh di Bagian 2e menghasilkan Kec A 5,50 (2 desa), Kec B 7,00 (1 desa), Kab 6,25 (2 kec).
- Admin_BPP: tab Rekap hanya menampilkan desa kecamatannya, tanpa tombol edit.
- Admin Kab: 15 kecamatan selalu tampil, klik kecamatan menampilkan desa, filter tahun/bulan jalan, tidak ada tombol edit.
- Sheet lama berubah nama jadi `Data_Produktivitas_Kec_Arsip`, isinya utuh.
- Excel: sheet per komoditas per tahun + sheet Sarana, rata-rata cocok dengan tampilan web.
- Tampilan HP (lebar ±360px): tabel 12 bulan × 3 input tidak memaksa scroll horizontal halaman.
