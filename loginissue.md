# Masalah Alert Login Salah Password (Terdeteksi NIP Tidak Terdaftar / Akun Nonaktif)

## 📌 Deskripsi Masalah
Ketika pengguna salah memasukkan password saat login, sistem terkadang menampilkan alert yang benar (`Password Salah`), tetapi di lain waktu justru menampilkan alert `"NIP tidak terdaftar atau akun nonaktif"`. Hal ini membingungkan pengguna karena NIP mereka sebenarnya terdaftar dan aktif.

---

## 🔍 Analisis Penyebab

### 1. Perilaku Cache (`CacheService`)
Pada file [Database.gs](file:///d:/CODING/LTT/Database.gs), fungsi `prosesLogin` memanfaatkan cache untuk mempercepat login pengguna yang baru saja berhasil masuk:
* Jika cache login masih aktif, sistem langsung membandingkan password dengan data di cache. Jika salah, cache dihapus dan alert `Password Salah` dimunculkan.
* Jika cache sudah kedaluwarsa atau belum pernah login, sistem terpaksa membaca data dari spreadsheet `Data_User` menggunakan perulangan (`for`).

### 2. Logika Validasi Spreadsheet yang Kurang Tepat
Ketika melakukan pengecekan ke spreadsheet, terdapat perulangan sebagai berikut:
```javascript
for (var i = 1; i < data.length; i++) {
  if (data[i][2].toString() === nip.toString()) { // Cek NIP
    if (
      data[i][3].toString() === password.toString() && // Cek Password
      data[i][7] === 'Aktif'                          // Cek Status
    ) {
      // Login sukses...
    }
  }
}
// Jika loop selesai tanpa memenuhi kriteria sukses di atas:
return { status: 'error', message: 'NIP tidak terdaftar atau akun nonaktif' };
```
**Analisis Logika:**
Jika NIP ditemukan tetapi password-nya salah atau status akunnya tidak `'Aktif'`, kondisi `if` di bagian dalam akan bernilai `false`. Karena tidak ada percabangan `else` untuk menangani kegagalan tersebut di dalam perulangan, sistem akan terus melanjutkan perulangan baris spreadsheet berikutnya sampai habis.
Setelah perulangan selesai, sistem langsung mengeksekusi baris pengembalian paling bawah: `NIP tidak terdaftar atau akun nonaktif`.

---

## 🛠️ Solusi Perbaikan

Ganti fungsi `prosesLogin` pada file [Database.gs](file:///d:/CODING/LTT/Database.gs) (sekitar baris 8–70) dengan kode di bawah ini untuk memisahkan validasi:

```javascript
function prosesLogin(nip, password) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'USER_' + nip;
  var cachedData = cache.get(cacheKey);

  // 1. Cek dari Cache jika ada session aktif sebelumnya
  if (cachedData) {
    var cached = JSON.parse(cachedData);
    var cachedPassword = (
      cached.password !== undefined
        ? cached.password
        : cached.pin !== undefined
          ? cached.pin
          : ''
    ).toString();
    if (cachedPassword === password.toString()) {
      return {
        status: 'success',
        data: cached.userData,
        url: ScriptApp.getService().getUrl(),
      };
    }
    cache.remove(cacheKey);
    return {
      status: 'error',
      message: 'Password Salah (Sistem telah menyegarkan data, silakan coba lagi)',
    };
  }

  // 2. Baca data dari Spreadsheet jika tidak ada di Cache
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_User');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    // Cari NIP yang cocok
    if (data[i][2].toString() === nip.toString()) {
      var dbPassword = data[i][3].toString();
      var dbStatus = data[i][7];

      // Verifikasi Password jika NIP ditemukan
      if (dbPassword === password.toString()) {
        // Verifikasi Status Akun
        if (dbStatus === 'Aktif') {
          var userData = {
            id: data[i][0],
            nama: data[i][1],
            nip: data[i][2].toString(),
            role: data[i][4],
            kecamatan: data[i][5],
            desa: data[i][6],
            whatsapp: data[i][8] || '',
          };
          var cacheEntry = {
            password: dbPassword,
            userData: userData,
          };
          cache.put(cacheKey, JSON.stringify(cacheEntry), 21600);
          return {
            status: 'success',
            data: userData,
            url: ScriptApp.getService().getUrl(),
          };
        } else {
          return { status: 'error', message: 'Akun Anda nonaktif, silakan hubungi admin.' };
        }
      } else {
        return { status: 'error', message: 'Password salah.' };
      }
    }
  }
  
  // Jika NIP tidak ditemukan di seluruh baris spreadsheet
  return { status: 'error', message: 'NIP tidak terdaftar.' };
}
```
