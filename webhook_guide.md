# Panduan Webhook Saran (SMART LTT -> Node.js)

Dokumen ini menjelaskan spesifikasi teknis webhook yang dikirimkan oleh aplikasi SMART LTT (Google Apps Script) saat pengguna (PPL/BPP) mengirimkan saran atau masukan. Gunakan dokumen ini sebagai referensi bagi Agen AI atau Pengembang di sisi server Node.js Anda untuk membuat endpoint penerima.

## 1. Detail Endpoint

* **Method:** `POST`
* **Content-Type:** `application/json`
* **URL Webhook default:** `http://103.245.38.96:3000/webhook/saran` (dapat disesuaikan di `Code.gs` baris 179)

---

## 2. Struktur Payload JSON

Payload dikirimkan dalam format JSON dengan struktur sebagai berikut:

```json
{
  "timestamp": "2026-06-08T09:15:30.000Z",
  "saran": "Tuliskan saran atau kendala yang dialami di sini...",
  "pengguna": {
    "id": "user_id_123",
    "nama": "Ahmad Penyuluh",
    "nip": "199001012020121001",
    "role": "Penyuluh",
    "kecamatan": "Kecamatan Sumber",
    "desa": "Desa Kebonagung, Desa Sidomulyo"
  }
}
```

### Penjelasan Field:
| Field | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `timestamp` | `String (ISO 8601)` | Waktu pengiriman saran dari Google Apps Script server. |
| `saran` | `String` | Teks masukan/saran/komplain dari pengguna. |
| `pengguna.id` | `String` | ID unik pengguna di database SMART LTT. |
| `pengguna.nama` | `String` | Nama lengkap pengguna yang mengirimkan saran. |
| `pengguna.nip` | `String` | NIP / Username yang digunakan untuk login. |
| `pengguna.role` | `String` | Peran/Role pengguna (`Penyuluh` atau `Admin_BPP`). |
| `pengguna.kecamatan` | `String` | Wilayah Kecamatan pengguna. |
| `pengguna.desa` | `String` | Daftar Wilayah Binaan (WKPP) / Desa dari pengguna (terpisah tanda koma). |

---

## 3. Template Endpoint Node.js (Express.js)

Berikut adalah contoh kode server Express.js yang siap disalin dan dijalankan untuk menangani request webhook saran ini:

```javascript
const express = require('express');
const app = express();

// Pastikan middleware JSON diaktifkan
app.use(express.json());

// Endpoint Penerima Webhook Saran
app.post('/webhook/saran', (req, res) => {
  try {
    const { timestamp, saran, pengguna } = req.body;

    // 1. Validasi sederhana
    if (!saran || saran.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Konten saran tidak boleh kosong'
      });
    }

    // 2. Logging data ke console server
    console.log(`\n========================================`);
    console.log(`[${timestamp}] SARAN BARU MASUK`);
    console.log(`========================================`);
    console.log(`Pengirim : ${pengguna.nama} (${pengguna.role})`);
    console.log(`NIP      : ${pengguna.nip}`);
    console.log(`Wilayah  : Kec. ${pengguna.kecamatan}, Desa: ${pengguna.desa}`);
    console.log(`Saran    : "${saran}"`);
    console.log(`========================================\n`);

    // 3. Aksi Lanjutan (TODO: Sesuaikan kebutuhan Anda)
    // - Menyimpan data saran ke database (MongoDB, MySQL, PostgreSQL, dll.)
    // - Meneruskan saran ke bot Telegram / WhatsApp Admin / Email
    // Contoh:
    // await db.saran.create({ timestamp, saran, ...pengguna });

    // 4. Kirim respons sukses ke Google Apps Script
    return res.status(200).json({
      status: 'success',
      message: 'Saran berhasil diterima di server Node.js'
    });

  } catch (error) {
    console.error('Terjadi kesalahan pada webhook:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan internal pada server'
    });
  }
});

// Jalankan server di port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server Webhook SMART LTT aktif di port ${PORT}`);
});
```

---

## 4. Respons Keberhasilan dan Error Handling

* **Status 200 (Success):** Kembalikan status HTTP `200` dengan objek JSON `{ "status": "success", "message": "..." }` jika pemrosesan sukses.
* **Status 400 (Bad Request):** Kembalikan status HTTP `400` jika data yang dikirim tidak lengkap.
* **Status 500 (Internal Server Error):** Jika terjadi crash di sisi Node.js. Namun, Google Apps Script diprogram dengan `muteHttpExceptions: true`, sehingga jika server Node.js Anda mengembalikan kode error 500 atau sedang mati, aplikasi utama SMART LTT di frontend **tidak akan crash**, melainkan hanya memunculkan notifikasi *"Gagal Mengirim"* yang bersahabat kepada pengguna.
