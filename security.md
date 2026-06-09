# Laporan Analisis Keamanan & Ide Solusi Web SMART LTT

Dokumen ini memuat temuan kerentanan (vulnerability) pada source code Web App LTT berbasis Google Apps Script beserta **ide solusi** konkrit untuk memperbaikinya.

---

## 1. Broken Access Control pada `google.script.run` (Tingkat: KRITIS)

**Temuan:**
Semua fungsi backend (seperti `submitLaporan`, `editLaporan`, `prosesVerifikasiMassal`) diekspos secara otomatis ke sisi klien. Fungsi-fungsi ini saat ini tidak melakukan validasi apakah pemanggilnya benar-benar pengguna yang telah terautentikasi. Siapapun bisa mengirim data dari *Developer Tools* (Console).

**Ide Solusi (Penerapan Session Token):**
Jangan hanya mengandalkan frontend untuk menyimpan `userAktif`. 
1. **Saat Login:** Di `Database.gs`, fungsi `prosesLogin` harus menghasilkan `sessionToken` (misalnya string acak / UUID). Simpan token ini ke dalam `CacheService` dengan durasi tertentu (misal 6 jam) dan kaitkan dengan NIP pengguna. Kirim `sessionToken` ini kembali ke sisi klien.
2. **Saat Klien Memanggil Fungsi:** Klien harus selalu menyertakan `sessionToken` saat memanggil fungsi krusial.
3. **Validasi di Backend:** Di setiap awal fungsi `submitLaporan` atau `editLaporan`, periksa apakah `sessionToken` yang dikirimkan valid dan ada di `CacheService`.

**Contoh Kode Solusi:**
```javascript
// Di sisi Server (Database.gs)
function submitLaporan(sessionToken, formData) {
  var cache = CacheService.getScriptCache();
  var userDataStr = cache.get('SESSION_' + sessionToken);
  
  if (!userDataStr) {
    return { status: 'error', message: 'Sesi tidak valid atau telah habis. Silakan login kembali.' };
  }
  
  // Jika valid, lanjutkan proses simpan data...
}
```

---

## 2. Endpoint API Publik Tidak Terproteksi pada `doPost` (Tingkat: KRITIS)

**Temuan:**
Fungsi `doPost(e)` menerima request eksternal (misal untuk `sinkron_padi` dan `import_target_epusluh`) tanpa memverifikasi sumber atau memvalidasi kredensial. Endpoint ini terbuka sepenuhnya.

**Ide Solusi (API Key / Bearer Token):**
Wajibkan sistem VPS atau pihak eksternal yang mengirim request untuk menyertakan sebuah *API Key* rahasia.

**Contoh Kode Solusi:**
```javascript
// Di sisi Server (Code.gs)
const SECRET_API_KEY = "GANTI_DENGAN_KODE_RAHASIA_YANG_PANJANG_DAN_RUMIT";

function doPost(e) {
  try {
    var request = JSON.parse(e.postData.contents);
    
    // Validasi API Key
    if (request.apiKey !== SECRET_API_KEY) {
       return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unauthorized' }))
           .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Jika valid, lanjutkan eksekusi
    if (request.aksi === 'sinkron_padi') { ... }
  } catch(err) { ... }
}
```

---

## 3. Penyimpanan Password dalam "Plain Text" (Tingkat: TINGGI)

**Temuan:**
Fungsi `prosesLogin` mencocokkan input password langsung dengan isi sel spreadsheet `data[i][3].toString() === password.toString()`. Menyimpan password asli di dalam database sangat berbahaya.

**Ide Solusi (Password Hashing):**
Ubah password di Google Sheet menjadi nilai *Hash* (misalnya SHA-256). Saat user login, input dari frontend di-hash terlebih dahulu menggunakan algoritma yang sama, lalu dibandingkan.

**Contoh Kode Solusi:**
```javascript
// Fungsi untuk melakukan hashing string menjadi SHA-256 Hex
function hashPassword(password) {
  var signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  var hexString = signature.map(function(byte) {
      var v = (byte < 0) ? 256 + byte : byte;
      return ("0" + v.toString(16)).slice(-2);
  }).join("");
  return hexString;
}

// Di dalam prosesLogin()
function prosesLogin(nip, password) {
  var hashedInput = hashPassword(password);
  // ... ambil data dari sheet
  // Asumsikan data[i][3] sekarang berisi string hash, bukan teks asli
  if (data[i][3] === hashedInput && data[i][7] === 'Aktif') {
     // Sukses login
  }
}
```

---

## 4. Otorisasi Lemah di Sisi Klien (Tingkat: MENENGAH)

**Temuan:**
Aplikasi menganggap user adalah "Admin" hanya dengan melihat objek `localStorage.getItem('user_eLTT')`. Hacker bisa memalsukan `localStorage` dan membuka UI Dashboard Admin.

**Ide Solusi:**
Data rahasia admin yang di-load dari server (misalnya daftar data laporan seluruh kabupaten) hanya boleh dikembalikan oleh `google.script.run` jika `sessionToken` yang dikirim benar-benar milik user dengan level/Role "Admin". Jika hacker mengubah `localStorage` secara lokal, mereka mungkin bisa melihat halaman Admin, namun halamannya akan kosong karena backend menolak memberikan data.

---

## 5. Ketiadaan Rate Limiting (Tingkat: TINGGI)

**Temuan:**
Fungsi seperti `prosesLogin()` dan fungsi pengubah data tidak membatasi seberapa sering permintaan dikirim oleh klien dalam waktu singkat. 

**Ide Solusi (Rate Limiting via CacheService):**
Gunakan `CacheService` untuk mencatat berapa kali permintaan gagal atau dilakukan oleh suatu NIP secara beruntun. Jika melewati batas (misal: lebih dari 5x gagal dalam 10 menit), tolak sementara. Ini akan mencegah eksploitasi dan menjaga batas kuota limit harian Google.

**Contoh Kode Solusi:**
```javascript
// Di dalam prosesLogin()
function prosesLogin(nip, password) {
  var cache = CacheService.getScriptCache();
  var limitKey = 'ATTEMPT_' + nip;
  var attempts = cache.get(limitKey) ? parseInt(cache.get(limitKey)) : 0;
  
  // Blokir sementara jika sudah 5 kali gagal
  if (attempts >= 5) {
    return { status: 'error', message: 'Terlalu banyak percobaan. Coba lagi dalam 10 menit.' };
  }
  
  // Jika logika pengecekan salah:
  // cache.put(limitKey, (attempts + 1).toString(), 600); // 600 detik = 10 menit
}
```
