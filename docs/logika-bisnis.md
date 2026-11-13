# Logika Bisnis SMART LTT (hasil audit kode GAS)

> **Status: DRAF LENGKAP — menunggu koreksi user (Fase 0.5).** Sumber: `Database.gs`, `Code.gs`, `LoaderTuyul.gs`, `File_Javascript.html`, `File_HTML_Admin.html` per 13 Nov 2026.
> **Cara membaca:** langsung ke **§24** untuk daftar pertanyaan. Bagian 1–23 adalah rincian aturan per fitur.
> Tujuan: semua aturan & rumus yang selama ini hanya ada di kode ditulis dalam bahasa biasa, untuk dikoreksi user, lalu jadi acuan SQL & uji "angka lama = angka baru".
> Tanda: ⚠️ = perilaku aneh / bug / celah yang perlu diputuskan (pertahankan atau perbaiki). ❓ = perlu konfirmasi user.

---

## 1. Pengguna & Login

**Sheet `Data_User`** — kolom: `ID_User, Nama_Penyuluh, NIP, Password, Role, Nama_Kecamatan, Desa_Binaan, Status_Aktif, WhatsApp` (kolom I ditambahkan belakangan).

- Role: `Penyuluh`, `Admin_BPP`, `Admin_Kab`, `Dinas`.
- `Desa_Binaan`: teks dipisah koma (bisa lebih dari satu desa).
- Login: cari baris dengan NIP sama persis → bandingkan password (teks biasa) → harus `Status_Aktif = 'Aktif'`.
  - Pesan: "NIP tidak terdaftar." / "Password salah." / "Akun Anda nonaktif, silakan hubungi admin."
- Data sesi yang dikirim ke browser: `id, nama, nip, role, kecamatan, desa, whatsapp`, disimpan di `localStorage` `user_eLTT`.
- ⚠️ Password disimpan & dibandingkan sebagai teks biasa; disalin ke cache 6 jam.
- ⚠️ Setelah login, server **tidak pernah** mengecek ulang siapa pemanggilnya: nama, NIP, role, kecamatan, desa dikirim dari browser di setiap aksi.

**Baru:** login NIP + password (hash), sesi cookie, role & wilayah diambil dari DB.

---

## 2. Laporan LTT Palawija (Jagung & Ubi Kayu) — input PPL

**Sheet `Data_LTT`** — kolom: `ID_Laporan, Waktu_Lapor, Pelapor, Nama_Kecamatan, Nama_Desa, Komoditas, Jenis_LTT, Target_Tanam_Bln_Ini, Target_Panen_Bln_Ini, Luas_Lahan_Bera, Realisasi_Olah_Lahan, Realisasi_Luas_Tanam, Realisasi_Luas_Panen, Keterangan, Status_Verifikasi, Waktu_Verifikasi_BPP, Waktu_Verifikasi_Kab, NIP_Pelapor`.

### 2a. Kirim laporan (`submitLaporan`)

- ID: `LTT-<milidetik>-<Komoditas>`. Waktu lapor = saat kirim (server).
- Semua isian (pelapor, kecamatan, desa, komoditas, jenis, target, bera, olah, tanam, panen, keterangan, NIP) **diambil dari form apa adanya**.
- Status awal: **`Menunggu`**.
- Tidak ada batasan jumlah laporan per hari/desa (boleh banyak laporan sehari).
- ⚠️ Tidak ada validasi server: angka negatif, desa di luar binaan, komoditas sembarang tetap tersimpan.

### 2b. Edit laporan oleh PPL (`editLaporan`)

- Hanya jika status masih **`Menunggu`**.
- Yang bisa diubah: **desa, luas tanam, luas panen, keterangan** (kosong → `-`). Kolom lain tetap.
- ⚠️ Tidak dicek apakah laporan itu milik PPL tersebut.

### 2c. Laporan hari ini (`getLaporanPPLHariIni`)

- Tampilkan laporan Data_LTT yang: tanggal (WIB) = hari ini, **nama pelapor cocok** (setelah dibersihkan), desa termasuk desa binaan, komoditas sama.
- "Nama dibersihkan" (`bersihNama_`): huruf kecil, buang gelar (`S.P`, `S.ST`, `S.T`, `M.Si`, `H.`, `M.Pd`, `SE`, `SH`, `Ak`, `Pt`, `dr`, `drh`, `Ir`), buang semua selain huruf a–z.
- Urut jam terbaru dulu. Isi: id, desa, tanam, panen, status, jam.
- ⚠️ Dicocokkan **berdasarkan nama**, bukan NIP. **Baru:** cocokkan `pelapor_id`.

---

## 3. Verifikasi Laporan Palawija

- Alur status: **`Menunggu` → `Terverifikasi BPP` → `Terverifikasi Kabupaten`**.
- `prosesVerifikasiMassal(ids, role)`: role `Admin_Kab` → status `Terverifikasi Kabupaten` + isi `Waktu_Verifikasi_Kab`; role lain → `Terverifikasi BPP` + isi `Waktu_Verifikasi_BPP`.
- Hanya berlaku untuk `Data_LTT` (palawija). **Padi tidak diverifikasi di aplikasi** (sumbernya e-Pusluh).
- ⚠️ Role diambil dari parameter browser; server tidak mengecek status sebelumnya (Kab bisa memverifikasi laporan yang masih `Menunggu`, ❓ apakah boleh?).
- ❓ Tidak ditemukan status "Ditolak". Apakah memang tidak ada penolakan?

---

## 4. Data Padi dari e-Pusluh (sinkron bookmarklet)

**Sheet `Data_LTT_Padi`** — kolom sama dengan Data_LTT kolom A–Q, ditambah kolom R `Metode_Penanaman` (bukan NIP).

### 4a. Terima sinkron (`terimaSinkronPadi(dataArray, logData)`, `doPost aksi=sinkron_padi`)

- `dataArray` = baris jadi (18 kolom) yang disusun bookmarklet dari tabel e-Pusluh.
- **Sheet tujuan** ditentukan dari `logData.tanggalLaporan` (format "Agustus 1, 2026"): jika bukan bulan berjalan → langsung ke sheet arsip `Data_LTT_Padi_YYYY_MM`.
- **Aturan timpa per tanggal:** semua baris lama yang tanggalnya sama dengan tanggal-tanggal di data baru **dihapus**, lalu data baru dimasukkan. (Satu kali tarik = gambaran lengkap tanggal itu dari e-Pusluh.)
- Lalu `Ringkasan_Harian` padi dihitung ulang untuk tanggal tersebut.
- **Log** (`Logs_Sinkron`): `ID_Sync, Waktu_Sinkron, Total_Tarik, Data_Berisi, Data_Nihil, Tanggal_Laporan, Status` (`Sukses (Injeksi)` / `Sukses (Tanpa LogData)` / `Error: …`).
- ⚠️ Pemetaan nama bulan pakai 3 huruf awal (`Jan…Des`, termasuk `Agu/Ags/Aug`, `Okt/Oct`, `Dec`). Lihat `issue.md` (bug Agustus).
- **Baru:** upsert per (tanggal, desa, jenis LTT …) dalam satu transaksi: hapus baris tanggal yang sama lalu insert — aturan "timpa per tanggal" dipertahankan.

### 4b. Status padi hari ini (`cekStatusPadiHarian`)

- PPL melihat baris padi hari ini (WIB) untuk desa binaannya: desa, jenis LTT (kosong → "Padi"), tanam, panen. Status `sudah` / `belum`.

### 4c. Log sinkron (`getLogsSinkron`) — daftar log, terbaru dulu.

---

## 5. Target PM AAS (Kabupaten)

- **Sheet `Target_PmAas_Kabupaten`**: `Tahun, Bulan (1–12), Target_Tanam_Ha`. Satu baris per tahun+bulan (upsert).
- **Realisasi PM AAS** = jumlah luas tanam & panen baris **padi** (bulan itu) yang kolom `Metode_Penanaman` **mengandung teks "PM AAS"** (huruf besar/kecil bebas).
- Hasil: total tanam, total panen, target, **% capaian = total tanam ÷ target × 100** (0 jika target 0), rincian per metode (urut tanam terbesar), rekap per kecamatan (urut nama). Dibulatkan 2 desimal.

---

## 6. Dashboard Kabupaten (`getDashboardKab`)

Parameter: tanggal tertentu **atau** bulan+tahun (default bulan berjalan).

- **Padi**: dari `Ringkasan_Harian` (komoditas Padi); jika bulan itu kosong → hitung langsung dari sheet padi (bulan berjalan/arsip).
- **Jagung & Ubi Kayu**: langsung dari `Data_LTT` (atau arsip bulan itu). Komoditas dikenali: `jagung`, `ubi kayu`/`ubi_kayu`; lainnya diabaikan.
- **Semua status dihitung** (realisasi tidak menunggu verifikasi).
- Keluaran:
  - Total tanam & panen per komoditas (`komposisiTanam/Panen`), total semua komoditas.
  - Rincian padi per jenis LTT (tanam/panen).
  - **Tren 7 hari** luas tanam per komoditas: 7 hari berakhir hari ini (bulan berjalan) atau hari terakhir bulan (bulan lalu). Label `dd/MM`.
  - **% terverifikasi** = laporan palawija bulan itu berstatus `Terverifikasi Kabupaten` ÷ semua laporan palawija bulan itu, dibulatkan.
  - **Menunggu verifikasi Kab** = jumlah laporan palawija berstatus `Terverifikasi BPP` (⚠️ tanpa filter bulan di sheet itu).
- Tombol "refresh paksa" menghitung ulang `Ringkasan_Harian` dari nol.

## 7. Antrean Verifikasi Kabupaten (`getAntreanKabupaten(komoditas, tanggal)`)

- Data: bulan berjalan (Data_LTT + Data_LTT_Padi), **padi dilewati**. Filter komoditas wajib (Jagung / Ubi Kayu); tanggal opsional.
- Kecamatan yang tampil: hanya yang punya Penyuluh/Admin_BPP **aktif**.
- Per kecamatan: total laporan, `belumBPP` (Menunggu), `siapVerif` (Terverifikasi BPP, beserta daftar ID), `sudahKab`, total tanam & panen.
- ⚠️ Hanya bulan berjalan; laporan bulan lalu yang belum diverifikasi tidak muncul lagi setelah arsip tanggal 1.

## 8. Dashboard BPP (`getDashboardBPP(kecamatan)`)

- Data bulan berjalan (palawija + padi), hanya kecamatan itu.
- **Laporan hari ini** = semua baris (padi + palawija) bertanggal hari ini.
- **PPL sudah lapor** = nama pelapor unik dari laporan **palawija** hari ini. **PPL belum lapor** = PPL/Admin_BPP aktif di kecamatan yang namanya tidak ada di daftar itu.
  - ⚠️ Dicocokkan **berdasarkan nama persis**, bukan NIP. Typo nama → dianggap belum lapor.
- **Antrean menunggu** = laporan berstatus `Menunggu` **hari ini saja** (kolom: id, tanggal, pelapor, desa, komoditas, tanam, panen, keterangan).
  - ❓ Laporan `Menunggu` dari hari sebelumnya tidak muncul di antrean BPP. Disengaja?

## 9. Edit laporan oleh BPP (`editLaporanBPP`)

- Mencari ID di **semua** sheet `Data_LTT*` (aktif + arsip, palawija + padi).
- Bisa diubah: luas bera, olah lahan, luas tanam, luas panen, keterangan, **metode penanaman** (kolom R — di sheet padi ini `Metode_Penanaman`; ⚠️ di sheet palawija kolom R = `NIP_Pelapor`, jadi bisa tertimpa).
- **Tidak dicek status** (BPP bisa edit laporan yang sudah terverifikasi Kab) dan tidak dicek kecamatan.
- ⚠️ Komoditas kosong dianggap `Padi` saat mengoreksi ringkasan (bug di `issue.md`).
- ⚠️ Data padi hasil edit BPP akan **tertimpa** saat sinkron e-Pusluh berikutnya untuk tanggal yang sama.

## 10. Target per PPL (`ambilTargetPerPPL(bulan, komoditas, kecamatan)`)

- Untuk tiap PPL/Admin_BPP aktif di kecamatan: target tanam & panen = **jumlah target desa-desa binaannya** (bulan & komoditas itu). Pencocokan nama desa: huruf kecil + trim.

## 11. Parsing tanggal (`parseTanggalEPusluh_`)

Urutan coba:

1. Objek Date → ambil tanggalnya saja (zona waktu spreadsheet).
2. `a/b/yyyy` atau `a-b-yyyy`: jika b > 12 → format bulan/hari (AS); jika a > 12 → hari/bulan; jika keduanya ≤ 12 → **hari/bulan** (Indonesia).
3. Parser tanggal bawaan JavaScript.
4. `"Mei 6, 2026"`: 3 huruf pertama nama bulan → `Jan Feb Mar Apr Mei Jun Jul Agt Sep Okt Nov Des`. ⚠️ `Agu`/`Ags` tidak dikenali di sini (lihat `issue.md`), tapi biasanya sudah tertangkap langkah 3.

**Baru:** dipakai hanya di ETL & endpoint e-Pusluh; DB menyimpan `timestamptz`.

## 12. Rekap Padi (`getRekapPadiLengkap(tglMulai, tglAkhir, jenisLTT)`)

- Sumber: semua sheet padi (aktif + arsip), rentang tanggal inklusif.
- **Bagian harian**: daftar baris (pelapor, kecamatan, desa, jenis, bera, olah, tanam, panen, keterangan), urut kecamatan lalu desa; total bera/olah/tanam/panen; daftar jenis LTT yang ada.
- **Breakdown per jenis** dihitung **sebelum** filter jenis (selalu semua jenis).
- **Bagian kecamatan**: untuk **semua kecamatan** (dari `Data_Geografi`, cadangan 15 nama tetap), baris per (kecamatan, jenis) dengan tanam & panen; kecamatan tanpa data → satu baris `-`, 0, 0.
- Jenis kosong → `LTT`.
- `getTanggalTersediaRekap`: daftar tanggal yang punya data padi + jumlah baris, terbaru dulu.
- **Daftar 15 kecamatan cadangan:** Bahuga, Banjit, Baradatu, Blambangan Umpu, Buay Bahuga, Bumi Agung, Gunung Labuhan, Kasui, Negara Batin, Negeri Agung, Negeri Besar, Pakuan Ratu, Rebang Tangkas, Umpu Semenguk, Way Tuba.

## 13. Rekap Palawija (`getRekapPalawijaLengkap(tglMulai, tglAkhir, komoditas)`)

- Sumber: semua sheet palawija (aktif + arsip), rentang tanggal, komoditas Jagung / Ubi Kayu (`ubi_kayu` disamakan).
- Hasil: total tanam & panen; per kecamatan (semua 15 kecamatan, kosong = 0).
- **Semua status dihitung** (tidak menunggu verifikasi).

## 14. Pengguna — kelola (Admin Kab & BPP)

- **Admin Kab** (`getDaftarUser`, `simpanDataUser`, `hapusDataUser`): lihat semua user **termasuk password** (⚠️), tambah/ubah semua kolom, hapus baris. NIP tidak boleh dobel. ID baru `USR-<milidetik>`.
- **BPP** (`getDaftarPPLbyKecamatan`, `resetPasswordPPL`, `updateDataPPL`): lihat Penyuluh & Admin_BPP di kecamatannya; reset password (min. 4 karakter) dan ubah **nama, desa binaan, status aktif** — hanya untuk role Penyuluh/Admin_BPP. ⚠️ Tidak dicek bahwa target sekecamatan dengan BPP pemanggil.
- **Profil sendiri** (`updateProfilUser`): wajib isi password lama; bisa ubah nama, password (min. 4 karakter, opsional), WhatsApp.
- `updateWhatsAppUser`: ubah nomor WA saja.
- ⚠️ Hapus user = hapus baris permanen. **Baru:** nonaktifkan (soft delete).

## 15. Arsip bulanan & Ringkasan_Harian (DIHAPUS di sistem baru)

- `arsipBulanan` (tgl 1, 01:00): pindahkan baris bulan lalu dari `Data_LTT` → `Data_LTT_YYYY_MM` dan `Data_LTT_Padi` → `Data_LTT_Padi_YYYY_MM`. Tidak jalan jika arsip sudah ada.
- `Ringkasan_Harian` (`Tanggal, Komoditas, Jenis_LTT, Total_Tanam, Total_Panen`): dijaga lewat tambah selisih setiap submit/edit, dan dihitung ulang untuk tanggal padi yang disinkron.
- **Baru:** keduanya diganti query `GROUP BY` langsung ke `laporan_ltt`. Tidak ada ketentuan bisnis yang hilang.
- `backupDatabaseHarian`: salinan spreadsheet ke folder Drive, simpan 7 terakhir.

## 16. Dashboard Target vs Realisasi (`getDashboardTarget`)

Parameter: bulan+tahun atau tanggal.

**Target per kecamatan** (dijumlahkan dari target desa bulan itu):
| Kategori | Sumber target tanam | Sumber target panen |
|---|---|---|
| LTT Reguler | `Target_Desa_Padi.LTT_Reguler` — **diganti** oleh `Target_Kecamatan_Provinsi` (padi) bila ada untuk kecamatan & bulan itu | `Panen_Reguler` |
| Padi Gogo | `Padi_Gogo` | `Panen_Padi_Gogo` |
| Oplah 2025 | `Oplah_2025` | `Panen_Oplah_2025` |
| Jagung | `Target_Desa_Jagung.Total_Target_Tanam` | `Total_Target_Panen` |
| Ubi Kayu | `Target_Desa_UbiKayu.Total_Target_Tanam` | `Total_Target_Panen` |

- ⚠️ **Oplah 2024, CSR, Rehab Bencana tidak ikut** di dashboard ini (target maupun realisasi). ❓ Disengaja?
- ⚠️ **Sheet target hanya menyimpan Bulan (1–12), tanpa tahun.** Target bulan Januari 2027 akan bercampur dengan Januari 2026. ❓ Perlu konfirmasi; **baru:** tambah kolom `tahun` (data lama dianggap tahun 2026 ❓).

**Realisasi per kecamatan** (bulan itu atau tanggal itu):

- Jagung/Ubi Kayu dari sheet palawija; padi dari sheet padi dengan pencocokan **teks jenis persis**: `LTT Reguler`, `LTT Padi Gogo`, `LTT Oplah 2025`.
  - ⚠️ Di `Jenis_LTT` awal tertulis `LTT  Oplah 2025` (dua spasi) dan `LTT Rehap Bencana` (typo). Teks jenis dari e-Pusluh harus dicek saat ETL.

**Target kabupaten** per komoditas dari `Target_Kabupaten` (bulan itu; `ubi kayu`/`ubi_kayu`/`ubikayu` disamakan).

Perhitungan persen capaian dilakukan di browser (lihat bagian frontend).

## 17. Target — penyimpanan & kelola (Admin Kab)

### 17a. Sheet yang benar-benar dipakai aplikasi

| Sheet                                        | Kunci baris                   | Isi                                                                                                                                                                                                                                                    |
| -------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Target_Desa_Padi`                           | Bulan + Kecamatan + Desa      | Tanam per jenis: `LTT_Reguler, Padi_Gogo, Oplah_2024, Oplah_2025, CSR, Rehab_Bencana`, `Total_Target_Tanam`; panen per jenis yang sama + `Total_Target_Panen`; `IP_Eksisting, Luas_Baku_Sawah, Luas_Standing_Crop` (selalu 0), `Pembuat, Waktu_Update` |
| `Target_Desa_Jagung` / `Target_Desa_UbiKayu` | Bulan + Kecamatan + Desa      | `Total_Target_Tanam, Total_Target_Panen, IP_Eksisting, Luas_Baku, Pembuat, Waktu_Update`                                                                                                                                                               |
| `Target_Kecamatan`                           | Bulan + Komoditas + Kecamatan | **Hasil hitungan otomatis** = jumlah target desa (tanam & panen). Ditulis ulang setiap target desa berubah                                                                                                                                             |
| `Target_Kecamatan_Provinsi`                  | Bulan + Komoditas + Kecamatan | Target tanam kecamatan dari provinsi. **Menimpa** angka hasil jumlah desa untuk kecamatan itu (di daftar target dan di dashboard: hanya kategori LTT Reguler padi)                                                                                     |
| `Target_Kabupaten`                           | Bulan + Komoditas             | `Total_Target_Tanam, Total_Target_Panen, Pembuat, Waktu_Update` (diisi manual Admin Kab, **bukan** jumlah kecamatan)                                                                                                                                   |
| `Target_PmAas_Kabupaten`                     | Tahun + Bulan                 | lihat §5                                                                                                                                                                                                                                               |

- ❗ **Temuan penting:** sheet **`Target_Bulanan` dan `Target_Detail_Jenis` tidak dipakai aplikasi lagi.** Satu-satunya yang membacanya adalah `migrasiTargetKeV2()` (fungsi pindah data sekali jalan ke format `Target_Desa_*`). ❓ Mohon konfirmasi: kalau setuju, kedua sheet ini **tidak dimigrasi** (cukup disimpan di arsip spreadsheet), karena isinya sudah ada di `Target_Desa_*`.
- ❗ **`Target_Kecamatan_Provinsi` tidak punya fungsi tulis di aplikasi** — selama ini diisi langsung di spreadsheet. Karena spreadsheet tidak dipakai lagi, **sistem baru perlu halaman input target provinsi per kecamatan** (Admin Kab). ❓
- ⚠️ Semua sheet target hanya punya **Bulan (1–12), tanpa Tahun** (kecuali PM AAS). Lihat §16.

### 17b. Lihat target (`ambilTargetBulanan({bulan, komoditas})`)

- Gabungan 3 level: desa, kecamatan (hasil jumlah, ditimpa target provinsi bila ada), kabupaten. `bulan = 0` = semua bulan.
- Padi: rincian per jenis hanya yang tanam > 0 atau panen > 0. Nama jenis yang dipakai: `LTT Reguler`, `LTT Padi Gogo`, `LTT Oplah 2024`, `LTT  Oplah 2025` (dua spasi), `LTT CSR`, `LTT Rehap Bencana`.

### 17c. Simpan target satu desa / kabupaten (`simpanTargetBulanan`)

- Level `Kecamatan` ditolak ("dihitung otomatis").
- Desa: kecamatan dari form, atau dicari dari nama desa di `Data_Geografi`. Upsert berdasarkan bulan + kecamatan + desa (huruf kecil).
- Padi: nilai per jenis dari rincian; nama jenis dikenali longgar (`LTT Reguler`; `Padi Gogo`; `Oplah 2024`; `Oplah 2025`; `CSR`; `Rehab/Rehap Bencana`, dengan/tanpa awalan `LTT`).
- ⚠️ **Total target padi diambil dari form, bukan dihitung dari jumlah rincian** → bisa tidak sama. ❓ Baru: total = jumlah rincian (dihitung DB)?
- Kabupaten: upsert per bulan + komoditas.
- Setiap simpan desa → `Target_Kecamatan` dihitung ulang.

### 17d. Simpan banyak desa (`simpanBulkTargetDesa(bulan, komoditas, data[], pembuat)`)

- Sama aturannya dengan 17c untuk banyak desa sekaligus. Desa tanpa nama → dicatat sebagai error, lanjut desa berikutnya. Hasil: jumlah tersimpan + daftar error.

### 17e. Hapus target (`hapusTargetBulanan(id)`)

- ID baru `Desa|bulan|kec|desa|kom` atau `Kabupaten|bulan|kom` → hapus baris itu. Ada juga dukungan ID format lama `bulan-level-geografi-kom` (sisa V1).

### 17f. Impor target dari e-Pusluh (`importTargetEpusluh`, bookmarklet `?action=target`)

- Input: bulan, komoditas, daftar `{namaKecamatan, namaDesa, targetHa}` hasil baca tabel e-Pusluh.
- **Untuk SETIAP desa di `Data_Geografi`**: target = angka dari e-Pusluh bila ada, **0 bila tidak ada** (desa yang tak ada di e-Pusluh ikut di-nol-kan).
- Padi: `LTT_Reguler = Total_Tanam = targetHa`, **semua jenis lain, semua panen, IP, luas baku di-nol-kan** (⚠️ menimpa isian manual). Palawija: `Total_Tanam = targetHa`, sisanya 0.
- Pembuat `ePusluh Import`. Lalu `Target_Kecamatan` dihitung ulang.

## 18. Laporan LTT — daftar & filter (`getLaporanLTT`)

- Filter: tanggal mulai/selesai, kecamatan, desa, komoditas, metode penanaman. **Tanpa filter tanggal → 30 hari terakhir.**
- Sumber: palawija (jika komoditas kosong/Jagung/Ubi Kayu) + padi (jika kosong/Padi).
- ⚠️ Sheet dipilih dari **bulan tanggal mulai** saja → rentang lintas bulan hanya membaca satu bulan. **Baru:** otomatis benar (satu tabel).
- Kolom: id, waktu (`yyyy-MM-dd HH:mm`), pelapor, kecamatan, desa, komoditas, jenis LTT (hanya padi), target tanam/panen, bera, olah, tanam, panen, keterangan, status (kosong → Menunggu), metode penanaman. Urut terbaru dulu.
- Dropdown: kecamatan = semua dari `Data_Geografi` (cadangan 15 nama); desa = desa yang **pernah muncul di laporan bulan berjalan** (⚠️ baru: dari master desa).

## 19. Rekap PPL (menu Rekap di PPL)

### 19a. Bulanan (`getRekapBulananPPL(nip, daftarBulan, tahun)`)

- Desa yang dihitung: **Penyuluh** = desa binaannya; **Admin_BPP** = **semua desa di kecamatannya** (dari `Data_Geografi`).
- Target per desa × bulan × komoditas dari `Target_Desa_*` (padi: total tanam, total panen, luas baku sawah, luas standing crop).
- Realisasi per desa × bulan × komoditas: setiap laporan (palawija & padi) di desa itu, **semua status**.
- Agregasi/persen dilakukan di browser (lihat frontend).

### 19b. Harian (`getRekapHarianPPL(nip, tanggal)`)

- Sama aturan desanya; realisasi tanam & panen per desa × komoditas pada satu tanggal.

## 20. Produktivitas & Sarana per Desa (fitur terbaru)

Aturan sesuai plan lama (sudah diimplementasikan di GAS):

- **Isi:** hanya `Penyuluh`/`Admin_BPP` aktif, untuk **desa binaan sendiri** (dicek di server dari NIP). Kecamatan diambil dari akun, bukan dari form.
- **Produktivitas** (ton/ha), per tahun × desa × komoditas (Padi, Jagung, Ubi Kayu) × 12 bulan. Kosong = 0. Desimal ≥ 0, koma/titik diterima, **maks 100 ton/ha** (cegah salah satuan kg/ha). Tahun 2000–2100.
- **Sarana** per desa (tanpa tahun): Gudang Gabah, Embung, Lantai Jemur, Mesin Pengering — bilangan bulat ≥ 0. **0 tetap disimpan** (beda dengan "belum diisi").
- **Rekap kecamatan** (BPP: kecamatannya; Kab/Dinas: pilih): semua desa (master + desa yang ada di data) dengan nilai bulan terpilih; **rata-rata kecamatan = rata-rata desa yang > 0** + jumlah desa terhitung.
- **Rekap kabupaten** (Kab/Dinas): rata-rata per kecamatan + **rata-rata kabupaten = rata-rata kecamatan yang > 0**. Contoh uji: Kec A (5; 6; 0) = 5,50; Kec B (7) = 7,00; Kab = **6,25**.
- **Sarana**: total per kecamatan & kabupaten, "desa terisi x / y".
- **Ekspor Excel**: rentang tahun; BPP otomatis hanya kecamatannya.
- Sheet lama `Data_Produktivitas` (per kecamatan) diarsipkan jadi `Data_Produktivitas_Kec_Arsip`. ❓ Ikut dimigrasi atau tidak?

## 21. Endpoint & keamanan lain (`Code.gs`)

- `doGet ?action=target` / `?action=eltt` → menyajikan kode bookmarklet.
- ⚠️ `doGet ?action=migrasi` → **siapa pun yang tahu URL bisa menjalankan `migrasiTargetKeV3()`**. Tidak dibawa ke sistem baru.
- `doPost` aksi `sinkron_padi`, `import_target_epusluh` — tanpa token.
- `kirimSaranWebhook(pesan, user)` → POST ke VPS `/webhook/saran` dengan `{timestamp, saran, pengguna:{id,nama,nip,role,kecamatan,desa}}`. Pesan kosong ditolak.

## 22. Bookmarklet e-Pusluh (`LoaderTuyul.gs`)

Kedua bookmarklet dijalankan admin di halaman e-Pusluh, membaca tabel di layar (kolom dikenali dari teks judul kolom), memuat SweetAlert2 + ExcelJS dari CDN.

### 22a. `eltt` — sinkron realisasi padi harian

- Kolom dibaca: waktu lapor, pelapor, kecamatan, desa, jenis LTT, tambah tanam, panen, bera, olah, keterangan, status. Angka: koma → titik.
- **Baris nihil** (tanam, panen, bera, olah semuanya 0) **tidak dikirim**.
- Baris yang dikirim: `[ID "SYNC-<ms>-<acak>", tanggal (teks e-Pusluh), pelapor, kec, desa, "Padi", jenis, 0, 0, bera, olah, tanam, panen, keterangan, status e-Pusluh, waktu, waktu]`. Bookmarklet tidak mengirim metode penanaman — **tapi sumber utama data padi adalah cron VPS yang mengirim metode penanaman** (lihat §25 koreksi).
- `logData`: idSync, waktu, total baris, berisi, nihil, tanggal laporan.
- ⚠️ Bookmarklet juga mengirim `dataVPS` (desa dengan jenis "LTT Reguler") "untuk Bot WA", **tetapi GAS mengabaikannya** — tidak pernah diteruskan ke VPS. ❓ Fitur ini sebenarnya diinginkan?
- Setelah kirim, bookmarklet membuat **Excel 5 sheet** di browser: Rekap Semua (tgl×kec×jenis), Rekap Ada Nilai, Data Mentah, Rekap Dinas (per kecamatan: Padi Sawah=LTT Reguler, Padi Gogo, Jagung, Kedelai, Ubi Kayu — saat ini hanya padi terisi), Kontrol & Deteksi Manual (desa unik yang lapor LTT Reguler vs **total desa master 227 — angka ditulis mati**).

### 22b. `target` — impor target padi dari e-Pusluh

- Baca kolom desa, kecamatan, target; bulan dari form/halaman e-Pusluh. Komoditas selalu **Padi**.
- Kirim ke `import_target_epusluh` (aturan di §17f), lalu tawarkan unduh Excel rekap target per kecamatan.

**Baru:** dua bookmarklet ini dipertahankan perilakunya (termasuk Excel-nya); hanya alamat kirim, token, dan pembacaan respons yang berubah. Total desa master diambil dari DB, bukan 227.

## 23. Frontend — aturan yang ada di browser

### 23a. Form laporan PPL (Jagung / Ubi Kayu)

- Isian **hanya**: desa (dropdown desa binaan), luas tanam, luas panen, keterangan. Desimal koma/titik.
- Otomatis: pelapor = nama akun, NIP, kecamatan akun, **jenis LTT = `LTT`**, target tanam/panen = 0, bera = 0, olah = 0.
- Menu Padi untuk PPL **hanya melihat** hasil sinkron e-Pusluh hari ini (tidak bisa input). Pesan kosong: "Data padi muncul setelah pukul 12.00".
- Tombol Edit hanya muncul untuk laporan berstatus `Menunggu`.

### 23b. Menu per role (Admin)

| Menu                                                           | Admin_Kab | Dinas                                            |
| -------------------------------------------------------------- | --------- | ------------------------------------------------ |
| Dashboard                                                      | ✅        | ✅                                               |
| LTT PM AAS                                                     | ✅        | ✅                                               |
| Laporan LTT                                                    | ✅        | ❌                                               |
| Produktivitas, Sarana                                          | ✅        | ❌ (server sebenarnya mengizinkan Dinas membaca) |
| Manajemen User, Target, Logs Sinkron, Verifikasi, Pemeliharaan | ✅        | ❌                                               |

- ❓ Keputusan sebelumnya: "Dinas hanya melihat semua halaman kabupaten". Sekarang Dinas **hanya** melihat Dashboard + PM AAS. Di sistem baru: Dinas boleh melihat juga Laporan LTT, Produktivitas, Sarana, Target (tanpa tombol ubah)?
- Admin_BPP punya tombol pindah tampilan **BPP ↔ PPL** (Admin_BPP juga penyuluh dengan desa binaan).
- Filter bulan dashboard: **5 bulan terakhir** (bulan ini + 4 sebelumnya).

### 23c. Capaian kabupaten (gauge di dashboard)

- Pilihan: Padi, Jagung, Ubi Kayu, PM-AAS.
- **Capaian % = realisasi tanam bulan itu ÷ target kabupaten (`Target_Kabupaten`) × 100.** PM-AAS: realisasi tanam PM AAS ÷ target PM AAS.
- Target 0 & realisasi > 0 → 100%. Gauge maksimal 100%.
- Warna: < 50% merah, < 80% kuning, ≥ 80% hijau. Teks: "Sisa Target: x Ha" / "Melampaui: x Ha" / "Target Tercapai".
- Kartu: tanam & panen per komoditas, tanam/panen PM AAS, % terverifikasi, jumlah menunggu verifikasi Kab, donut komposisi tanam, tren 7 hari.

### 23d. Tabel target vs realisasi per kecamatan (dashboard)

- Pilihan kategori: LTT Reguler, Padi Gogo, Oplah 2025, Jagung, Ubi Kayu; sisi tanam atau panen.
- **% = realisasi ÷ target × 100, dibulatkan**; target 0 → `-`. Baris total kabupaten = jumlah semua kecamatan.
- Warna: ≥ 85% hijau, ≥ 60% kuning, < 60% merah. ⚠️ Ambangnya **berbeda** dengan gauge (80/50). ❓ Disamakan?

### 23e. Tabel rekap LTT (format Dinas, dashboard)

- Kolom per kecamatan: **Padi Sawah = LTT Reguler saja**, Padi Gogo, Jagung, **Kedelai (selalu 0)**, Ubi Kayu — masing-masing tanam & panen; baris jumlah.
- Catatan di kode: "Oplah & Rehab Bencana diabaikan sesuai permintaan user".

### 23f. Halaman BPP

- Hanya `Admin_BPP`. Judul "BPP <KECAMATAN>". Menu: Dashboard, Verifikasi, Target, Manajemen PPL, Laporan LTT.
- **Dashboard**: laporan hari ini, menunggu verifikasi, "sudah lapor x / y orang", daftar nama PPL belum lapor (merah), tabel antrean hari ini (centang → "Sahkan?" → `Terverifikasi BPP`; tombol edit tanam/panen/keterangan per baris).
- **Laporan LTT BPP**: sama dengan Laporan LTT Kab tapi dikunci ke kecamatannya; bisa edit (tanam, panen, keterangan) — termasuk baris **padi**. Unduh Excel.
- **Target**: daftar PPL di kecamatan dengan total target desa binaannya per bulan & komoditas, status Sudah/Belum; BPP bisa **input/edit target untuk desa-desa PPL tersebut** (form yang sama dengan PPL, §23h).
- **Manajemen PPL**: tambah PPL (role otomatis `Penyuluh`, password min. 4), ubah nama/desa binaan (checklist desa dari master kecamatan), aktif/nonaktifkan, reset password, **hapus PPL**.
- Widget nomor WhatsApp BPP.

### 23g. Verifikasi Kabupaten

- Tabel per kecamatan (komoditas Jagung/Ubi Kayu, tanggal opsional): total laporan, belum diverifikasi BPP, siap verifikasi, sudah Kab, tanam, panen. Filter status & cari.
- Tombol **verifikasi per kecamatan** → semua laporan berstatus `Terverifikasi BPP` di kecamatan itu → `Terverifikasi Kabupaten`.

### 23h. Input target oleh PPL (& BPP untuk PPL-nya)

- Per bulan × komoditas, satu kartu per desa binaan.
- **Padi**: baris rincian (jenis LTT dari `Jenis_LTT` + luas tanam + luas panen, wajib); **total tanam & panen dihitung otomatis** = jumlah rincian (kolom terkunci). Default satu baris `LTT Reguler`.
- **Jagung / Ubi Kayu**: total tanam & total panen wajib.
- Luas baku opsional. IP selalu 0.
- ⚠️ Server tidak mengecek desa itu milik PPL/BPP pemanggil.

### 23i. Rekap PPL

- **Harian**: tanggal **hanya di bulan berjalan dan tidak boleh melebihi hari ini**. Tabel per komoditas: desa, tanam, panen, jumlah.
- **Bulanan**: pilihan **5 bulan terakhir**. Tabel per komoditas: No, Desa, Komoditas, Luas Baku Sawah (padi), kolom `0,00` (standing crop, selalu 0), Target Tanam, Realisasi Tanam, **% Tanam = realisasi ÷ target × 100** (target 0 → `—`), kolom `—`, Target Panen, Realisasi Panen, % Panen; baris JUMLAH (persen dari total).
- Unduh Excel dari tabel yang tampil.

### 23j. Edit laporan oleh Admin Kab (menu Laporan LTT)

- Bisa ubah **bera, olah, tanam, panen, metode penanaman** untuk baris padi maupun palawija. Inilah **satu-satunya cara metode penanaman (PM AAS) terisi**.
- ⚠️ Untuk baris palawija, metode ditulis ke kolom R yang di sheet palawija adalah `NIP_Pelapor` → NIP pelapor tertimpa. **Baru:** kolom terpisah.
- ⚠️ Edit Admin Kab/BPP pada baris padi hilang saat sinkron ulang e-Pusluh tanggal yang sama (§9).

### 23k. Ekspor Excel (format harus dipertahankan — rujukan fungsi lama)

| Tombol                                               | Fungsi lama (`File_Javascript.html`)                  |
| ---------------------------------------------------- | ----------------------------------------------------- |
| Rekap per kecamatan (padi/palawija, dashboard rekap) | `unduhExcelKecamatan`                                 |
| Target vs realisasi                                  | `unduhExcelTargetVsRealisasi`                         |
| Rekap LTT format Dinas                               | `unduhExcelRekapLTT`                                  |
| Laporan LTT Kab                                      | `unduhExcelLaporan`                                   |
| Laporan LTT BPP                                      | `unduhExcelLaporanBPP`                                |
| Rekap PPL bulanan / harian                           | `downloadRekapExcel` / `_downloadRekapHarianExcel`    |
| Produktivitas & sarana                               | `unduhExcelProduktivitas` → `_buatExcelProduktivitas` |

- Tata letak tiap file (judul, warna header, kolom, baris jumlah) disalin dari fungsi-fungsi tersebut saat Fase 4–6.

---

## 25. KEPUTUSAN USER (13 Nov 2026) — berlaku untuk sistem baru

> Ringkasan dari jawaban di §24. Jika bertentangan dengan bagian 1–23, **bagian ini yang berlaku**.

| # | Topik | Keputusan |
|---|---|---|
| 1 | Tahun pada target | **Tidak pakai tahun.** Target "sekali pakai": kunci = bulan (1–12) saja, ditimpa saat diisi ulang |
| 2 | `Target_Bulanan`, `Target_Detail_Jenis` | **Tidak dimigrasi** |
| 3 | Struktur target | Tiga level: **Desa** (diisi PPL / BPP, seperti sekarang), **Kecamatan diisi oleh Admin BPP** (menggantikan `Target_Kecamatan_Provinsi` yang diisi di spreadsheet), **Kabupaten = jumlah target kecamatan** (otomatis, tidak diisi manual lagi) |
| 4 | Total target padi | Ikuti aplikasi lama dulu |
| 5 | `Data_Produktivitas_Kec_Arsip` | Tidak dimigrasi |
| 6–9 | **Verifikasi** | **Fitur verifikasi dihapus seluruhnya** (tidak ada status Menunggu / Terverifikasi BPP / Kab / Ditolak, tidak ada halaman/antrean verifikasi BPP & Kab, tidak ada kartu "% terverifikasi" & "menunggu verifikasi") |
| 10 | Edit laporan oleh BPP/Kab | Boleh |
| 11 | Edit padi tertimpa sinkron | Biarkan seperti lama |
| 12 | Bookmarklet e-Pusluh | **Tidak ada lagi fitur bookmarklet** (`LoaderTuyul.gs`, `?action=target/eltt`, impor target dari e-Pusluh dihapus). **Data padi tetap masuk otomatis dari VPS** — lihat koreksi di bawah |

### Koreksi audit: sumber data padi = cron VPS (bukan bookmarklet)

Ditemukan di repo bot VPS `d:\CODING\DASBOT`:
- `scripts/run_tarik_data.py` login ke `2025.epusluh.id` (Playwright + 2Captcha), baca tabel `admin/laporan-ltts`, lalu `POST` ke GAS `doPost` aksi **`sinkron_padi`** (payload sama: `data`, `dataVPS`, `logData`).
- Dijadwalkan `node-cron` di `index.js`: **11:30, 12:30, 13:30, 22:30 WIB** setiap hari.
- Baris yang dikirim **18 kolom, termasuk `Metode_Penanaman`** (kolom R) → PM AAS terisi dari e-Pusluh. (Catatan §22a "metode tidak dikirim" hanya berlaku untuk bookmarklet lama.)
- `dataVPS` (desa LTT Reguler) dikirim skrip langsung ke bot sendiri `localhost:<PORT>/deteksi-ltt` untuk notifikasi WA — tidak lewat GAS, jadi fitur itu berjalan.
- Skrip juga membandingkan hasil tarikan dengan rekap Partisipasi Penyuluh e-Pusluh (validasi kelengkapan) dan melaporkan ke WA.

**Untuk sistem baru:**
- Endpoint **`POST /api/epusluh/sinkron-padi`** tetap dibuat (pengganti `doPost`), dengan **token** di header, aturan "timpa per tanggal" sama, 18 kolom termasuk metode penanaman.
- Di repo DASBOT cukup ubah `GAS_URL` → URL Vercel + tambah header token (perubahan kecil, dilakukan saat cutover). `downloader-ltt.js` di DASBOT juga mengarah ke GAS; dicek saat cutover apakah masih dipakai.
- Tidak perlu CORS (dipanggil server ke server).
- Impor target dari e-Pusluh **tidak ada** di VPS → hilang bersama bookmarklet; target diisi lewat aplikasi.
| 13 | Akses Dinas | Seperti lama: **Dashboard + LTT PM AAS saja** |
| 14 | Warna capaian | **Samakan ke ambang tabel kecamatan: < 60% merah, 60–84% kuning, ≥ 85% hijau** (gauge kabupaten ikut) |
| 15 | Kolom Kedelai | Tetap ditampilkan |
| 16 | Oplah 2024, CSR, Rehab Bencana | Seperti lama (tidak masuk dashboard target vs realisasi & rekap Dinas) |

## 26. Pertanyaan lanjutan (akibat keputusan §25)

_(dijawab di chat, lalu dicatat di sini)_

## 24. Ringkasan: hal yang perlu keputusan Anda

**Penting (mempengaruhi skema data):**

1. **Target tanpa tahun.** Semua target desa/kecamatan/kabupaten hanya punya bulan 1–12. Di sistem baru target diberi **tahun**. Data target lama dianggap **tahun 2026**? Dan mulai Januari 2027 target diisi baru? GAPERLU PAKAI TAHUN, TARGET INI SEKALI PAKAI SAJA
2. **`Target_Bulanan` & `Target_Detail_Jenis` tidak dipakai aplikasi** (hanya sumber migrasi lama ke `Target_Desa_*`). Boleh **tidak dimigrasi**? (Sebelumnya Anda jawab "masih dipakai" — mungkin yang dimaksud `Target_Desa_*`.) OKE TINGGALK SAJA TIDAK DIPAKAI DI APLIKASI LAMA
3. **Target provinsi per kecamatan** (`Target_Kecamatan_Provinsi`) selama ini diisi langsung di spreadsheet. Perlu **halaman input** untuk Admin Kab di sistem baru? PERLU,ADA TARGET DESA , TARGET KECAMATAN, KABUPATEN,TARGET KECAMTAN DI ISI OLEH ADMIN KEC, TARGET KABUPATEN ADALAH PENJUMLAHAN DARI TARGET KECAMTAN
4. **Total target padi**: ikut jumlah rincian per jenis (dihitung otomatis), bukan angka bebas? (Form PPL sudah begitu; form Admin Kab belum tentu.) IKUTIN APLIKASI LAMA DLU
5. **Sheet arsip `Data_Produktivitas_Kec_Arsip`** (produktivitas per kecamatan versi lama): ikut dimigrasi atau ditinggal? TINGGAL

**Alur kerja:** 6. Antrean BPP hanya menampilkan laporan `Menunggu` **hari ini**. Laporan kemarin yang belum diverifikasi hilang dari antrean. Sistem baru: tampilkan **semua yang masih Menunggu**? FITUR VEIRIFIKASI LAPORAN PPL INI BERISHKAN AJA, TIDAK PERLU DI KASIH, KARNA KITA TIDAK ADA VERIFIKASI DARI ADMINKECAMTAN MAPUN KAB 7. Antrean verifikasi Kab hanya **bulan berjalan**. Sistem baru: semua yang masih `Terverifikasi BPP`, berapa pun tanggalnya? HAPUS AJA FITUR VERIFIKASI 8. Kab boleh langsung memverifikasi laporan yang masih `Menunggu` (melewati BPP)? Atau wajib lewat BPP dulu? HAPUS FITUR VERIFIKASI 9. Tidak ada status **Ditolak**. Perlu ditambah (BPP/Kab bisa menolak dengan alasan, PPL bisa perbaiki)? TIDAK ADA 10. BPP/Kab boleh mengedit laporan yang **sudah terverifikasi Kab**? BISA EDIT, TAPI SKERNG FITUR VERIFIKASI TIDAK ADA 11. Edit BPP/Kab pada data **padi** akan tertimpa sinkron e-Pusluh berikutnya. Biarkan begitu (e-Pusluh sumber kebenaran), atau edit manual dikunci agar tidak tertimpa? Khususnya **metode penanaman (PM AAS)** — kalau tertimpa, angka PM AAS hilang. BIARKAN SEPRTI YG LAMA 12. Data `dataVPS` (desa LTT Reguler untuk bot WA) dikirim bookmarklet tapi tidak pernah diteruskan. Perlu diaktifkan di sistem baru? TIDAK ADA LAGI FITUR BOOKMARKLET

**Tampilan & hak akses:** 13. Dinas sekarang hanya melihat Dashboard + PM AAS. Di sistem baru boleh melihat Laporan LTT, Target, Produktivitas, Sarana juga (tanpa ubah)? BIAR SEPERTI YG LAMA 14. Ambang warna capaian: gauge kabupaten 50/80%, tabel kecamatan 60/85%. Disamakan? Pakai yang mana? SAMAKAN YG KECAMTAN ITU YG BENAR 15. Kolom **Kedelai** di rekap format Dinas selalu 0 (tidak ada input kedelai). Tetap ditampilkan? TETAP 16. Oplah 2024, CSR, Rehab Bencana tidak masuk dashboard target vs realisasi & rekap Dinas. Tetap begitu? BIARKAN SEPRTI YG LAMA DULU

**Perilaku lama yang akan otomatis diperbaiki (tidak perlu dijawab, kecuali keberatan):**

- Pencocokan laporan & "PPL sudah lapor" pakai **akun (ID)**, bukan nama.
- Server selalu mengecek role, kecamatan, desa binaan, dan status laporan.
- Laporan lintas bulan, arsip, cache, `Ringkasan_Harian` tidak ada lagi → angka selalu konsisten.
- Hapus user/laporan = nonaktif/soft delete.
- Endpoint `?action=migrasi` dihapus; endpoint e-Pusluh pakai token.
- Nama bulan "Agustus/Agu/Ags" dibaca benar; komoditas kosong tidak lagi dianggap Padi.
- Total desa master di Excel bookmarklet dari DB, bukan angka 227.
