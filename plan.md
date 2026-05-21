# Rencana Implementasi: Modul Target LTT Komoditas

Dokumen ini berisi panduan tingkat tinggi (High-Level) untuk mengembangkan fitur Target LTT per Komoditas. Rencana ini disusun agar mudah dieksekusi oleh programmer junior maupun LLM di masa mendatang.

## 1. Arsitektur Database (Praktik Terbaik & Fleksibel)
Struktur database harus dirancang agar mudah menerima input manual maupun tarikan data massal dari e-Pusluh.

*   **Tabel `Target_Bulanan` (Tabel Induk)**
    *   **Kunci Unik (Primary Key):** Kombinasi dari `Bulan` (1-12) + `Kode_Geografi` + `Komoditas`.
    *   **Kolom Utama:** `Bulan`, `Level_Wilayah` (Kab/Kec/Desa), `Kode_Geografi` (Relasi ke DB Geografi), `Komoditas` (Enum/Relasi: Padi, Jagung, Ubi Kayu).
    *   **Kolom Nilai:** `Total_Target` (Ha).
    *   **Kolom Audit:** `Pembuat_Target`, `Waktu_Update`.
*   **Tabel `Target_Detail_Jenis` (Tabel Relasi)**
    *   Berisi detail pemecahan target berdasarkan jenis LTT (contoh: Padi memiliki 6 jenis LTT).
    *   **Kolom:** `ID_Target_Bulanan` (Relasi ke tabel induk), `Kode_Jenis_LTT` (Relasi ke DB Jenis LTT), `Luas_Target`.
*   **Tabel `Target_Meta_Desa` (Khusus Atribut Desa)**
    *   Menyimpan data spesifik form desa.
    *   **Kolom:** `ID_Target_Bulanan`, `IP_Eksisting`, `Luas_Baku_Sawah`, `Luas_Standing_Crop`.

## 2. Struktur Komoditas & Jenis LTT
Sistem harus mengakomodasi 3 komoditas utama secara dinamis:
1.  **PADI:** Memiliki pemecahan form detail ke dalam **6 Jenis LTT** yang berbeda (berdasarkan referensi DB Jenis LTT).
2.  **JAGUNG:** Struktur standar (akumulasi target langsung/jenis spesifik).
3.  **UBI KAYU:** Struktur standar.

*Panduan Eksekusi:* Pada UI Form Input tingkat Desa, jika komoditas "Padi" yang dipilih pada filter, sediakan opsi penambahan baris dinamis (Dynamic Field) hingga 6 jenis LTT yang berbeda sesuai jenisnya.

## 3. Logika Sinkronisasi (Aturan "Patokan Nilai Tertinggi")
Ketiga level target (Kabupaten, Kecamatan, Desa) harus saling berkesinambungan. Gunakan logika *Trigger* atau logika simpan berjenjang:

*   **Bottom-Up Rollup (Desa -> Kecamatan -> Kabupaten):**
    Jika total *Target Desa* dalam satu kecamatan melebihi *Target Kecamatan* saat ini, maka *Target Kecamatan* harus otomatis ter-update (naik) mengikuti total nilai sinkronisasi dari desa. Demikian juga berjenjang hingga ke Kabupaten.
*   **Top-Down Validation (Kabupaten -> Kecamatan -> Desa):**
    Jika *Target Kabupaten* atau *Target Kecamatan* lebih besar daripada total kumulatif elemen di bawahnya, sistem tidak memaksa overwrite otomatis, melainkan **menampilkan indikator selisih** di UI (misal: "Kekurangan Target Sebesar X Ha").

## 4. Desain Antarmuka & Alur UX
*   **Halaman Induk (List Bulan):**
    *   Selalu tampilkan *hardcoded* 12 baris (Januari s.d. Desember), tidak peduli tahun berapa.
    *   Letakkan *Dropdown Filter Komoditas* di bagian atas (Padi, Jagung, Ubi Kayu). Saat komoditas berubah, tabel target akan me-load ulang data sesuai komoditas terpilih.
*   **Sistem Tab Navigasi:**
    *   Sediakan 3 tab: **Target LTT Kab/Kota**, **Target LTT Kecamatan**, **Target LTT Desa/Kelurahan**.
*   **Tabel Detail Target (Per Bulan):**
    *   Tampilkan list geografi, `Target (Ha)`, dan `Pembuat Target`.
    *   Tampilkan indikator status (misal: "15/15 Target Sesuai" atau peringatan kekurangan).
*   **Formulir Input (CRUD) untuk Level Desa:**
    *   Pilih *Desa/Kelurahan* dari dropdown referensi DB Geografi.
    *   Sediakan *Dynamic Field* untuk `Jenis LTT` (Dropdown ambil dari DB Jenis LTT) & `Target (Ha)`. Terdapat tombol "Tambahkan jenis LTT" (khususnya untuk Padi yang bisa memiliki hingga 6 jenis).
    *   Input field tambahan: Target Total LTT (Otomatis kalkulasi akumulasi baris di atasnya), IP Eksisting, Luas Baku Sawah Desa, dan Luas Standing Crop Desa.

## 5. Manajemen Hak Akses (Role-Based Access Control)
*   **Admin Provinsi / Kabupaten:** Memiliki akses Penuh (*Full CRUD*) pada semua level (Kabupaten, Kecamatan, Desa).
*   **Admin BPP (Kecamatan):** Terkunci dan hanya dapat *CRUD* pada data Target Kecamatan miliknya sendiri dan Target Desa di dalam wilayah kerjanya.
*   **Penyuluh (PPL):** Terkunci dan hanya dapat melakukan Ubah (*Edit*) data Target **khusus pada Desa Binaannya sendiri**. Tidak diperbolehkan mengedit target desa lain.

## 6. Instruksi Penulisan Kode (Untuk Eksekutor)
*   **Pisahkan Layering (MVC):** Logika sinkronisasi dan perhitungan (Rollup/Top-Down selisih) pisahkan dari fungsi UI agar bisa dipanggil juga lewat Endpoint API.
*   **Normalisasi Geografi:** Selalu simpan referensi menggunakan Kode/ID Geografi resmi, bukan sekadar string nama desa. Hal ini sangat penting untuk kelancaran sinkronisasi data tembakan *bookmarklet* e-Pusluh di masa depan.
*   **Komponen UI Modular:** Gunakan komponen UI yang dapat digunakan berulang (Reusable) untuk *Dynamic Input Jenis LTT* pada formulir modal.
