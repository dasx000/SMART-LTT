# Dokumentasi & Ringkasan Elemen LCS (Like, Comment, Share) Diseminasi

## 1. Informasi Umum
* **URL Endpoint**: `https://dev.epusluh.id/lcs/list`
* **Sistem / Platform**: ePusluh (Elektronik Pusat Penyuluhan Pertanian)
* **Modul**: LCS (Like, Comment, Share) Diseminasi Informasi dan Materi Pembangunan Pertanian
* **Tujuan Halaman**: Memfasilitasi penyuluh/petugas untuk melihat instruksi diseminasi media sosial (seperti TikTok) dan melaporkan bukti pelaksanaan kegiatan LCS.

---

## 2. Struktur Tampilan (UI Shell & Layout)
* **Layout Container**: Mobile-first responsive view (`max-w-md`, `h-dvh`, `overflow-x-hidden`).
* **Header App Bar**: Tombol navigasi kembali ke `/home` dan judul halaman *"Laporan Diseminasi"*.
* **Alert Banner**: Banner pemberitahuan bertema biru (`data-slot="alert"`) menjelaskan fungsi halaman.
* **Bottom Navigation Sticky**: Footer navigasi yang selalu menempel di bagian bawah layar:
  * `/home` (Home)
  * `/ltt/list` (LTT)
  * `/pupuk/list` (Pupuk)
  * `/gkp/list` (GKP)
  * `/jagung/list` (Jagung)
  * `/akun` (Akun)

---

## 3. Komponen Daftar Tugas (Task Item Cards)
Setiap kartu tugas diseminasi pada antarmuka memuat struktur berikut:
* **Header Kartu**: Informasi Platform & Tanggal (contoh: `TikTok: 30-07-2026`).
* **Judul & Target Konten**: 
  * `445 (Tiktok: bppsdmp) Gerakan Tanam Serempak Tahun 2026`
  * `444 (Tiktok: masdarsudaryono) BGN Serap Panen`
  * `443 (Tiktok: andi.amran.sulaiman) Inovasi Teknologi Pertanian ITS Surabaya: Dukungan Mentan Amran`
* **Teks Instruksi**: Teks berwarna merah miring (`text-red-500 italic`):
  > *"Instruksi: Berikan 1 kali LIKE, 3 kali COMMENT dan SHARE sebanyak-banyaknya. COMMENT yg diberikan positif dengan bahasa yang baik dan sopan."*
* **Badge Status**: `Sudah Lapor` (`data-slot="badge"`).
* **Tombol Aksi**:
  * **Lapor**: Membuka modal dialog form pelaporan.
  * **Buka Konten**: Menuju ke tautan media sosial asal konten.

---

## 4. Modal Dialog Pelaporan ("Lapor")
Saat tombol **"Lapor"** diklik, modal `role="dialog"` berbasis Radix UI / Shadcn UI terbuka:
* **Judul Modal**: `Laporan Diseminasi`
* **Form Items (Wajib / Required Checkboxes)**:
  1. `id="evidence_like"` : Checkbox *"Sudah Like *"
  2. `id="evidence_comment"` : Checkbox *"Sudah Komentar *"
  3. `id="evidence_share"` : Checkbox *"Sudah Share *"
* **Tombol Footer**:
  * **Batal** (`type="button"` / Secondary button) – Menutup modal.
  * **Simpan** (`type="submit"` / Primary button) – Mengirimkan data laporan ke server.

---

## 5. Estimasi Skema Data (JSON Payload / Data Model)

```json
{
  "id": 445,
  "platform": "TikTok",
  "tanggal": "30-07-2026",
  "akunTarget": "bppsdmp",
  "judulKonten": "Gerakan Tanam Serempak Tahun 2026",
  "instruksi": "Berikan 1 kali LIKE, 3 kali COMMENT dan SHARE sebanyak-banyaknya. COMMENT yg diberikan positif dengan bahasa yang baik dan sopan.",
  "status": "Sudah Lapor",
  "buktiLaporan": {
    "evidence_like": true,
    "evidence_comment": true,
    "evidence_share": true
  }
}
```
