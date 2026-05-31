# Rekomendasi & Analisis VPS untuk Aplikasi Next.js + PostgreSQL

Dokumen ini berisi panduan spesifikasi, analisis beban, estimasi kapasitas, dan strategi deployment aplikasi web SMART LTT menggunakan VPS kelas entry-level.

---

## 🖥️ Spesifikasi VPS Minimum (Rekomendasi)

Untuk aplikasi SMART LTT dengan skala harian **100 hingga 10.000 PPL (Penyuluh)**, spesifikasi VPS tipe *General Purpose* berikut adalah pilihan yang paling ekonomis dan optimal (*sweet spot*):

* **CPU:** 2 vCPU (Intel XEON atau setara)
* **RAM:** 2 GB
* **Storage:** 40 GB SSD / NVMe
* **Bandwidth:** Unmetered
* **Sistem Operasi:** Linux Ubuntu Server (20.04 LTS / 22.04 LTS)
* **Estimasi Biaya:** Kisaran **Rp 100.000 - Rp 150.000 / bulan**

---

## 📊 Analisis Konsumsi Resource (Next.js + PostgreSQL)

Jika Anda menjalankan server Next.js (Node.js) dan database PostgreSQL pada satu VPS 2GB RAM yang sama, berikut estimasi penggunaan memorinya:

| Komponen | Konsumsi RAM (Idle) | Konsumsi RAM (Under Load) | Keterangan |
| :--- | :--- | :--- | :--- |
| **Sistem Operasi (Ubuntu)** | ~300 MB | ~400 MB | Runtime dasar OS Linux |
| **Next.js (Node.js)** | ~100 MB | ~250 MB | Menangani routing, API, & rendering |
| **PostgreSQL Database** | ~100 MB | ~300 MB | Manajemen query & penyimpanan relasional |
| **Sisa RAM Bebas (Buffer)**| **~1.5 GB** | **~1.0 GB** | Ruang aman untuk lonjakan traffic mendadak |

> [!NOTE]
> Dengan sisa RAM bebas sekitar **1 GB**, server berada dalam zona yang sangat aman dari risiko kehabisan memori (*Out Of Memory* / OOM).

---

## 📈 Simulasi Traffic & Kapasitas Server

Banyak orang menyamakan **Daily Active Users (DAU)** dengan **Concurrent Users (CCU)**. Padahal keduanya sangat berbeda:
* **DAU (10.000 PPL):** Jumlah total pengguna unik yang mengakses aplikasi dalam rentang waktu 24 jam.
* **CCU (Concurrent):** Jumlah pengguna yang menekan tombol atau mengirim request pada **detik yang sama**.

### Estimasi Beban Request per Detik (RPS)
* **Total User:** 10.000 PPL aktif per hari.
* **Skenario Aktivitas:** Setiap user rata-rata mengakses/mengirim data **10 kali** dalam jam kerja efektif (8 jam = 28.800 detik).
* **Rata-rata Traffic:** 
  $$\frac{100.000 \text{ total request}}{28.800 \text{ detik}} \approx 3.47 \text{ Request per Detik (RPS)}$$
* **Peak Traffic (Jam Sibuk - Skenario Terburuk):** 
  Misalkan terjadi lonjakan di mana 30% user mengirim data bersamaan dalam waktu 1 jam:
  $$\frac{30.000 \text{ request}}{3.600 \text{ detik}} \approx 8.33 \text{ Request per Detik (RPS)}$$

> [!TIP]
> Server Next.js yang terhubung ke PostgreSQL lokal di SSD dapat dengan mudah melayani **200 hingga 500+ RPS**. Beban puncak sebesar **8.33 RPS** hanya akan menggunakan kurang dari **10% dari performa CPU** VPS Anda.

---

## 💾 Estimasi Kapasitas Penyimpanan (40 GB SSD)

Data laporan pertanian SMART LTT didominasi oleh data teks terstruktur. 
* Rata-rata ukuran 1 baris data laporan (JSON/Teks) adalah sekitar **1 KB - 2 KB**.
* Jika aplikasi mengumpulkan **1.000.000 (Satu Juta) laporan**, total ukuran database PostgreSQL Anda hanya berkisar **1 GB hingga 2 GB**.
* Dengan kapasitas **40 GB SSD**, ruang penyimpanan Anda tidak akan habis bahkan dalam waktu bertahun-tahun penggunaan aktif.

---

## 🛠️ Strategi Arsitektur Deployment

Ada dua opsi arsitektur deployment yang bisa dipilih sesuai kebutuhan manajemen dan tingkat keamanan data:

### Opsi A: Monolitik (Semuanya di VPS Sendiri)
Next.js dan database PostgreSQL diinstal bersama di dalam satu VPS yang sama.
* **Kelebihan:** 
  * Hemat biaya (cukup membayar 1 VPS saja).
  * Latensi database sangat rendah (<1ms) karena query diproses secara lokal (*localhost*).
* **Kekurangan:** 
  * Anda harus melakukan setup backup database secara berkala secara manual (misalnya menggunakan cron job untuk membackup data ke Google Drive/Dropbox).
  * Jika VPS mati/rusak, database ikut tidak bisa diakses sampai VPS pulih.

### Opsi B: Hybrid (Aplikasi di VPS + Database di Managed Cloud) - *Sangat Direkomendasikan*
Aplikasi Next.js berjalan di VPS Rp 100rb Anda, sedangkan database PostgreSQL di-host secara terpisah menggunakan penyedia Cloud Database (seperti **Supabase** atau **Neon.tech**).
* **Kelebihan:**
  * **Sangat Aman:** Penyedia cloud menyediakan fitur *automatic backup* harian dan restorasi data dengan 1 klik.
  * **Lebih Ringan:** RAM VPS 2GB sepenuhnya digunakan untuk Next.js saja, tidak terbagi dengan PostgreSQL.
  * **Gratis/Murah:** Skema gratis (*free tier*) dari Supabase atau Neon sudah sangat besar dan cukup untuk skala ribuan user SMART LTT.

---

## 🚨 Tips Penting: Penanganan Unggah Gambar/Foto
Jika aplikasi menyertakan fitur unggah foto laporan lapangan (misal: bukti tanaman, hama, atau dokumen dengan ukuran 2MB - 5MB per file):

> [!WARNING]
> **JANGAN** pernah melakukan *upload* foto langsung melewati memori server Next.js di VPS Anda. Proses buffering file besar akan memblokir *event loop* dan menghabiskan RAM VPS dengan cepat (mirip seperti masalah bot WhatsApp Baileys).

### Solusi Terbaik (Direct Upload menggunakan Presigned URL):
1. **Minta Izin:** Aplikasi di handphone PPL mengirim request kecil ke Next.js meminta izin untuk upload foto.
2. **Generasi Link:** Next.js mengembalikan **Presigned URL** (link khusus yang sah untuk waktu terbatas) dari layanan Cloud Storage seperti **Google Cloud Storage (GCS)**, **AWS S3**, atau **Cloudflare R2**.
3. **Upload Langsung:** Handphone PPL mengunggah foto tersebut **langsung** ke server Google/AWS/Cloudflare menggunakan Presigned URL tersebut.
4. **Simpan Link:** Setelah upload selesai, handphone PPL mengirimkan teks berisi *URL link gambar* tersebut ke database PostgreSQL melalui Next.js.

Dengan metode ini, VPS 2GB Anda tetap ringan karena tidak pernah memproses file gambar besar secara langsung, melainkan hanya menyimpan string teks alamat fotonya saja.
