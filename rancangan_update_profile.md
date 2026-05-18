# RANCANGAN TEKNIS: FITUR UPDATE PROFILE
**Sistem Laporan LTT — Google Apps Script & Google Sheets**

---

## RINGKASAN CEPAT (BACA INI DULU)

Fitur ini memberi kemampuan **PPL** dan **BPP (Admin Kecamatan)** untuk memperbarui **Nama Lengkap** dan **PIN** mereka sendiri tanpa bantuan Admin Kabupaten.

### Urutan Eksekusi (WAJIB berurutan)

| No | File | Aksi |
|---|---|---|
| **1** | `Database.gs` | Tambah 1 fungsi backend baru |
| **2** | `File_HTML_PPL.html` | Ubah tombol header + tambah panel overlay profil |
| **3** | `File_HTML_BPP.html` | Tambah tombol header + tambah modal profil |
| **4** | `File_Javascript.html` | Tambah 3 fungsi JavaScript baru |

> **ATURAN:** Jangan deploy/test sebelum ke-4 langkah selesai. Jika dipanggil, fungsi `bukaProfil()` akan error jika HTML belum ada.

---

## 1. STRUKTUR DATA (REFERENSI — JANGAN DIUBAH)

Sheet `Data_User` di Google Sheets:

| Kolom | Index JS | Nama Field | Akses di Fitur Profil |
|---|---|---|---|
| A | `[0]` | `ID_User` | Tersembunyi (dipakai sebagai key lookup) |
| B | `[1]` | `Nama_Penyuluh` | **DAPAT DIEDIT** |
| C | `[2]` | `NIP` | Read-Only (ditampilkan, tidak bisa diubah) |
| D | `[3]` | `PIN` | **DAPAT DIEDIT** (via form PIN baru) |
| E | `[4]` | `Role` | Read-Only |
| F | `[5]` | `Kecamatan` | Read-Only (ditampilkan, tidak bisa diubah) |
| G | `[6]` | `Desa_Binaan` | Read-Only (ditampilkan di PPL, tidak muncul di BPP) |
| H | `[7]` | `Status_Aktif` | Tersembunyi |

---

## LANGKAH 1 — Backend `Database.gs`

### Posisi: Tambahkan setelah fungsi `hapusDataUser` (sekitar baris 1124)

Cari baris ini sebagai penanda posisi:
```
// =========================================================================
// SISTEM ARSIP BULANAN
```

Sisipkan blok kode berikut DI ATAS baris tersebut:

```javascript
// =========================================================================
// FUNGSI UPDATE PROFIL MANDIRI (PPL & BPP)
// =========================================================================

function updateProfilUser(id, namaBaru, pinLama, pinBaru) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_User');
    var data  = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString() !== id.toString()) continue;

      var pinDiDB = data[i][3].toString();
      var nip     = data[i][2].toString();

      // Validasi PIN Lama
      if (pinLama.toString() !== pinDiDB) {
        return { status: 'error', message: 'PIN Aktif yang Anda masukkan salah.' };
      }

      // Tentukan PIN yang akan disimpan (PIN lama jika kolom PIN baru kosong)
      var pinFinal = pinDiDB;
      if (pinBaru && pinBaru.toString().trim() !== '') {
        if (pinBaru.toString().trim().length < 4) {
          return { status: 'error', message: 'PIN Baru minimal harus 4 karakter.' };
        }
        pinFinal = pinBaru.toString().trim();
      }

      // Tulis perubahan ke sheet
      sheet.getRange(i + 1, 2).setValue(namaBaru.trim()); // Kolom B: Nama
      sheet.getRange(i + 1, 4).setValue(pinFinal);         // Kolom D: PIN

      // Hapus cache lama & tulis cache baru agar sesi langsung pakai data terbaru
      var cache    = CacheService.getScriptCache();
      var cacheKey = 'USER_' + nip;
      cache.remove(cacheKey);
      var updatedUserData = {
        id: data[i][0], nama: namaBaru.trim(), nip: nip,
        role: data[i][4], kecamatan: data[i][5], desa: data[i][6]
      };
      cache.put(cacheKey, JSON.stringify({ pin: pinFinal, userData: updatedUserData }), 21600);

      return { status: 'success', message: 'Profil berhasil diperbarui!', data: updatedUserData };
    }

    return { status: 'error', message: 'Data akun tidak ditemukan.' };

  } catch (e) {
    return { status: 'error', message: 'Kesalahan sistem: ' + e.message };
  } finally {
    lock.releaseLock(); // Selalu buka lock, apapun hasilnya
  }
}
```

---

## LANGKAH 2 — UI PPL `File_HTML_PPL.html`

### 2a. Ganti Tombol Logout Header

**CARI** kode ini (baris ~12–16):
```html
<div class="w-12 h-12 bg-white rounded-full flex justify-center items-center shadow-lg cursor-pointer"
    onclick="logout()">
    <i class="fa-solid fa-right-from-bracket text-red-500"></i>
</div>
```

**GANTI SELURUHNYA dengan:**
```html
<div class="flex gap-2">
    <div class="w-12 h-12 bg-white rounded-full flex justify-center items-center shadow-lg cursor-pointer transition active:scale-95"
        onclick="bukaProfil()" title="Edit Profil Saya">
        <i class="fa-solid fa-user-gear text-green-600"></i>
    </div>
    <div class="w-12 h-12 bg-white rounded-full flex justify-center items-center shadow-lg cursor-pointer transition active:scale-95"
        onclick="logout()">
        <i class="fa-solid fa-right-from-bracket text-red-500"></i>
    </div>
</div>
```

---

### 2b. Tambah Panel Overlay Profil PPL

**POSISI:** Tambahkan tepat setelah tag penutup `</div>` dari `formArea` (setelah baris 196 di file asli).

Cari penanda ini:
```html
        </div>

    </div>
</div>
```
(Tiga baris penutup terakhir file)

Sisipkan blok HTML ini DI ATAS ketiga baris penutup tersebut:

```html
        <!-- ===== PANEL PROFIL PPL ===== -->
        <div id="profilArea" class="hidden px-5 pt-6 absolute top-0 bg-white w-full h-full z-30 overflow-y-auto pb-10">

            <div class="flex items-center mb-6 border-b pb-3">
                <button onclick="tutupProfil()"
                    class="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex justify-center items-center text-gray-600 mr-3 transition active:scale-95">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <h2 class="text-lg font-bold text-green-700 uppercase">Ubah Profil & PIN</h2>
            </div>

            <form id="formProfil" onsubmit="submitProfil(event)">
                <input type="hidden" id="profilId">

                <!-- Informasi Read-Only -->
                <div class="bg-gray-50 rounded-2xl p-4 mb-5 border border-gray-200">
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                        Informasi Akun (Hanya Dapat Diubah oleh Admin Kabupaten)
                    </p>
                    <div class="mb-3">
                        <label class="block text-xs font-bold text-gray-500 mb-1">NIP / Username</label>
                        <input type="text" id="profilNIP" readonly
                            class="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed">
                    </div>
                    <div class="mb-3">
                        <label class="block text-xs font-bold text-gray-500 mb-1">Kecamatan</label>
                        <input type="text" id="profilKecamatan" readonly
                            class="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Wilayah Binaan (WKPP)</label>
                        <input type="text" id="profilDesa" readonly
                            class="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed">
                    </div>
                </div>

                <!-- Nama Lengkap (Editable) -->
                <div class="mb-5">
                    <label class="block text-xs font-bold text-gray-600 mb-1">
                        Nama Lengkap <span class="text-red-500">*</span>
                    </label>
                    <input type="text" id="profilNama" required placeholder="Masukkan nama lengkap Anda"
                        class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition">
                </div>

                <!-- Section Ubah PIN -->
                <div class="bg-yellow-50 rounded-2xl p-4 mb-5 border border-yellow-200">
                    <p class="text-[10px] font-bold text-yellow-700 uppercase tracking-widest mb-3">
                        <i class="fa-solid fa-shield-halved mr-1"></i> Keamanan Akun
                    </p>
                    <div class="mb-3">
                        <label class="block text-xs font-bold text-gray-600 mb-1">
                            PIN Aktif Saat Ini <span class="text-red-500">*</span>
                        </label>
                        <input type="password" id="profilPinLama" required placeholder="Wajib diisi untuk konfirmasi identitas"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 transition">
                    </div>
                    <div class="mb-3">
                        <label class="block text-xs font-bold text-gray-600 mb-1">
                            PIN Baru <span class="text-gray-400 font-normal">(opsional — min. 4 karakter)</span>
                        </label>
                        <input type="password" id="profilPinBaru" placeholder="Kosongkan jika tidak ingin ganti PIN"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 transition">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 mb-1">Konfirmasi PIN Baru</label>
                        <input type="password" id="profilPinKonfirmasi" placeholder="Ulangi PIN baru di sini"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 transition">
                    </div>
                </div>

                <button type="submit" id="btnSimpanProfil"
                    class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 shadow-lg shadow-green-200 transition active:scale-95">
                    <i id="ikonSimpanProfil" class="fa-solid fa-floppy-disk"></i>
                    <span id="teksSimpanProfil">Simpan Perubahan</span>
                </button>
            </form>
        </div>
        <!-- ===== AKHIR PANEL PROFIL PPL ===== -->
```

---

## LANGKAH 3 — UI BPP `File_HTML_BPP.html`

### 3a. Tambah Tombol Profil di Header

**CARI** kode ini (baris ~22–25):
```html
<button onclick="logoutBPP()"
    class="bg-red-500 hover:bg-red-600 w-9 h-9 rounded-full flex justify-center items-center transition shadow">
    <i class="fa-solid fa-power-off text-white"></i>
</button>
```

**GANTI SELURUHNYA dengan:**
```html
<button onclick="bukaProfil()" title="Edit Profil Saya"
    class="bg-green-600 hover:bg-green-500 w-9 h-9 rounded-full flex justify-center items-center transition shadow">
    <i class="fa-solid fa-user-gear text-white"></i>
</button>
<button onclick="logoutBPP()"
    class="bg-red-500 hover:bg-red-600 w-9 h-9 rounded-full flex justify-center items-center transition shadow">
    <i class="fa-solid fa-power-off text-white"></i>
</button>
```

---

### 3b. Tambah Modal Profil BPP

**POSISI:** Tambahkan di baris paling akhir file (setelah semua konten `<main>`).

```html
<!-- ===== MODAL PROFIL BPP ===== -->
<div id="modalProfilBPP" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] hidden items-center justify-center">
    <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden mx-4">

        <div class="bg-green-700 px-6 py-4 flex justify-between items-center">
            <div class="flex items-center gap-3">
                <i class="fa-solid fa-user-gear text-white text-xl"></i>
                <h3 class="text-white font-bold text-lg">Ubah Profil & PIN</h3>
            </div>
            <button onclick="tutupProfil()"
                class="w-8 h-8 bg-green-600 hover:bg-green-500 rounded-full flex justify-center items-center text-white transition">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>

        <div class="p-6 overflow-y-auto max-h-[80vh]">
            <form id="formProfil" onsubmit="submitProfil(event)">
                <input type="hidden" id="profilId">

                <!-- Informasi Read-Only -->
                <div class="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100">
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                        Informasi Akun (Read-Only)
                    </p>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">NIP / Username</label>
                            <input type="text" id="profilNIP" readonly
                                class="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-500 cursor-not-allowed">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">Kecamatan</label>
                            <input type="text" id="profilKecamatan" readonly
                                class="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-500 cursor-not-allowed">
                        </div>
                    </div>
                </div>

                <!-- Nama Lengkap (Editable) -->
                <div class="mb-4">
                    <label class="block text-xs font-bold text-gray-600 mb-1">
                        Nama Lengkap <span class="text-red-500">*</span>
                    </label>
                    <input type="text" id="profilNama" required
                        class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition">
                </div>

                <!-- Section Ubah PIN -->
                <div class="bg-yellow-50 rounded-2xl p-4 mb-5 border border-yellow-200">
                    <p class="text-[10px] font-bold text-yellow-700 uppercase tracking-widest mb-3">
                        <i class="fa-solid fa-shield-halved mr-1"></i> Keamanan Akun
                    </p>
                    <div class="mb-3">
                        <label class="block text-xs font-bold text-gray-600 mb-1">
                            PIN Aktif Saat Ini <span class="text-red-500">*</span>
                        </label>
                        <input type="password" id="profilPinLama" required placeholder="Wajib diisi"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 transition">
                    </div>
                    <div class="mb-3">
                        <label class="block text-xs font-bold text-gray-600 mb-1">
                            PIN Baru <span class="text-gray-400 font-normal">(opsional, min. 4 karakter)</span>
                        </label>
                        <input type="password" id="profilPinBaru" placeholder="Kosongkan jika tidak diganti"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 transition">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 mb-1">Konfirmasi PIN Baru</label>
                        <input type="password" id="profilPinKonfirmasi" placeholder="Ulangi PIN baru"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 transition">
                    </div>
                </div>

                <div class="flex gap-3">
                    <button type="button" onclick="tutupProfil()"
                        class="flex-1 border border-gray-300 text-gray-600 font-bold py-2.5 rounded-xl hover:bg-gray-50 transition">
                        Batal
                    </button>
                    <button type="submit" id="btnSimpanProfil"
                        class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl flex justify-center items-center gap-2 transition">
                        <i id="ikonSimpanProfil" class="fa-solid fa-floppy-disk"></i>
                        <span id="teksSimpanProfil">Simpan</span>
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>
<!-- ===== AKHIR MODAL PROFIL BPP ===== -->
```

> **CATATAN PENTING:** ID elemen form (`profilId`, `profilNIP`, `profilNama`, dll.) disengaja sama persis di kedua file PPL dan BPP. Ini valid karena kedua halaman tidak pernah dimuat bersamaan di browser yang sama. Fungsi JavaScript Langkah 4 membaca ID yang sama di kedua halaman.

---

## LANGKAH 4 — JavaScript `File_Javascript.html`

### Posisi: Tambahkan tepat SEBELUM fungsi `logout()` (sekitar baris 1190)

Cari penanda posisi ini:
```javascript
    function logout() {
```

Sisipkan blok kode berikut DI ATAS baris tersebut:

```javascript
    // =========================================================================
    // FUNGSI UPDATE PROFIL MANDIRI (PPL & BPP)
    // =========================================================================

    function bukaProfil() {
        document.getElementById('profilId').value        = userAktif.id;
        document.getElementById('profilNIP').value       = userAktif.nip;
        document.getElementById('profilKecamatan').value = userAktif.kecamatan;
        document.getElementById('profilNama').value      = userAktif.nama;

        // Field desa hanya ada di halaman PPL, tidak ada di BPP
        const elDesa = document.getElementById('profilDesa');
        if (elDesa) elDesa.value = userAktif.desa;

        // Pastikan field PIN selalu kosong saat dibuka
        document.getElementById('profilPinLama').value       = '';
        document.getElementById('profilPinBaru').value       = '';
        document.getElementById('profilPinKonfirmasi').value = '';

        if (userAktif.role === 'PPL') {
            document.getElementById('profilArea').classList.remove('hidden');
        } else {
            // BPP: gunakan flex agar konten modal ter-center
            const modal = document.getElementById('modalProfilBPP');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    function tutupProfil() {
        document.getElementById('formProfil').reset();
        if (userAktif && userAktif.role === 'PPL') {
            document.getElementById('profilArea').classList.add('hidden');
        } else {
            const modal = document.getElementById('modalProfilBPP');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    function submitProfil(e) {
        e.preventDefault();

        const id         = document.getElementById('profilId').value;
        const nama       = document.getElementById('profilNama').value.trim();
        const pinLama    = document.getElementById('profilPinLama').value;
        const pinBaru    = document.getElementById('profilPinBaru').value;
        const pinKonfirm = document.getElementById('profilPinKonfirmasi').value;

        // --- Validasi sisi klien (sebelum hit server) ---
        if (!nama) {
            Swal.fire('Peringatan', 'Nama Lengkap tidak boleh kosong.', 'warning'); return;
        }
        if (!pinLama) {
            Swal.fire('Peringatan', 'PIN Aktif Saat Ini wajib diisi untuk konfirmasi.', 'warning'); return;
        }
        if (pinBaru && pinBaru.length < 4) {
            Swal.fire('Peringatan', 'PIN Baru minimal harus 4 karakter.', 'warning'); return;
        }
        if (pinBaru && pinBaru !== pinKonfirm) {
            Swal.fire('Peringatan', 'PIN Baru dan Konfirmasi PIN tidak cocok. Periksa kembali.', 'warning'); return;
        }

        // --- Aktifkan state Loading pada tombol ---
        const btnSimpan = document.getElementById('btnSimpanProfil');
        btnSimpan.disabled = true;
        document.getElementById('ikonSimpanProfil').className  = 'fa-solid fa-circle-notch fa-spin';
        document.getElementById('teksSimpanProfil').textContent = 'Menyimpan...';

        // --- Kirim ke backend Apps Script ---
        google.script.run
            .withSuccessHandler(function(res) {
                // Reset tombol ke normal
                btnSimpan.disabled = false;
                document.getElementById('ikonSimpanProfil').className  = 'fa-solid fa-floppy-disk';
                document.getElementById('teksSimpanProfil').textContent = 'Simpan Perubahan';

                if (res.status === 'success') {
                    // Sinkronkan data terbaru ke memori browser & localStorage
                    userAktif = res.data;
                    localStorage.setItem('user_eLTT', JSON.stringify(res.data));

                    // Perbarui tampilan nama di dashboard secara instan (tanpa reload)
                    if (userAktif.role === 'PPL') {
                        inisialisasiPPL();
                    } else {
                        inisialisasiBPP();
                    }

                    Swal.fire('Berhasil!', res.message, 'success').then(() => tutupProfil());
                } else {
                    Swal.fire('Gagal Menyimpan', res.message, 'error');
                }
            })
            .withFailureHandler(function(err) {
                // Reset tombol ke normal
                btnSimpan.disabled = false;
                document.getElementById('ikonSimpanProfil').className  = 'fa-solid fa-floppy-disk';
                document.getElementById('teksSimpanProfil').textContent = 'Simpan Perubahan';
                Swal.fire('Error Koneksi', 'Gagal menghubungi server: ' + err.message, 'error');
            })
            .updateProfilUser(id, nama, pinLama, pinBaru);
    }

```

---

## QA — CHECKLIST PENGUJIAN

Selesaikan semua 4 langkah implementasi sebelum menguji.

### A. Uji Navigasi & Tampilan UI

- [ ] **TC-01 [PPL]** — Login sebagai PPL → header menampilkan 2 ikon bulat (gir hijau + panah keluar merah) → klik gir → panel overlay profil terbuka mulus → field NIP, Kecamatan, WKPP, dan Nama terisi otomatis → klik panah kiri → panel tertutup, kembali ke halaman home
- [ ] **TC-02 [BPP]** — Login sebagai BPP → header menampilkan ikon gir hijau sebelum tombol power merah → klik gir → modal melayang di tengah layar dengan backdrop blur → klik ✕ atau Batal → modal tertutup
- [ ] **TC-03 [KEDUANYA]** — Buka profil → isi sebagian field → tutup profil → buka profil lagi → pastikan field PIN (Lama, Baru, Konfirmasi) **kosong** dan Nama kembali ke nilai asli (bukan input yang tadi diketik)

### B. Uji Validasi di Browser (Klien)

- [ ] **TC-04** — Kosongkan field Nama Lengkap → klik Simpan → muncul SweetAlert "Nama Lengkap tidak boleh kosong"
- [ ] **TC-05** — Kosongkan PIN Aktif Saat Ini → klik Simpan → muncul SweetAlert "PIN Aktif Saat Ini wajib diisi"
- [ ] **TC-06** — Isi PIN Baru `"123"` (3 karakter) → klik Simpan → muncul SweetAlert "minimal 4 karakter" → request ke server **TIDAK** dikirim
- [ ] **TC-07** — Isi PIN Baru `"1234"`, Konfirmasi `"1235"` → klik Simpan → muncul SweetAlert "tidak cocok" → request ke server **TIDAK** dikirim

### C. Uji Transaksi Backend (Server)

- [ ] **TC-08 [PIN SALAH]** — Isi nama baru yang valid + PIN Aktif **SALAH** → klik Simpan → tombol berubah jadi loading → muncul SweetAlert error "PIN Aktif yang Anda masukkan salah" → buka Google Sheets → pastikan baris user **TIDAK BERUBAH sama sekali**
- [ ] **TC-09 [GANTI NAMA SAJA]** — Isi nama baru + PIN Aktif **BENAR** + biarkan PIN Baru kosong → Simpan → SweetAlert sukses → nama di header dashboard **langsung berubah tanpa refresh halaman** → buka Google Sheets → Kolom B (Nama) **BERUBAH**, Kolom D (PIN) **TIDAK BERUBAH**
- [ ] **TC-10 [GANTI PIN]** — Ubah nama + isi PIN Baru yang valid → Simpan sukses → **Logout** → Login ulang menggunakan PIN **Baru** → berhasil masuk → Login dengan PIN **Lama** → harus **DITOLAK**
- [ ] **TC-11 [TIDAK ADA PERUBAHAN]** — Buka profil → isi PIN Aktif yang benar → langsung klik Simpan tanpa mengubah nama → SweetAlert sukses → data di Sheets tetap sama (nama tidak berubah karena memang tidak diubah)

---

## CATATAN TAMBAHAN UNTUK DEVELOPER

### Mengapa `id="profilNIP"` sama di dua file HTML?
Karena PPL dan BPP menggunakan halaman yang **berbeda** (dimuat secara terpisah). Tidak ada konflik karena browser tidak pernah memuat kedua file sekaligus. Satu set ID bisa dipakai di keduanya.

### Mengapa cek `if (elDesa)` di fungsi `bukaProfil`?
Elemen `profilDesa` hanya ada di HTML PPL. Saat fungsi yang sama dijalankan di halaman BPP, `getElementById('profilDesa')` akan mengembalikan `null`. Tanpa cek `if`, JavaScript akan error dan fungsi berhenti.

### Mengapa tidak pakai `inisialisasiPPL()` ulang untuk refresh nama?
Karena fungsi itu juga memanggil `jalankanLogikaWaktu()` yang mereset status UI (lock/unlock pelaporan). Memanggil ulang aman karena sudah dirancang idempotent — hasilnya sama meski dipanggil berkali-kali.

### Urutan update setelah sukses
```
1. server return { status: 'success', data: updatedUserData }
2. userAktif = res.data          ← update memori sesi
3. localStorage.setItem(...)     ← update storage browser  
4. inisialisasiPPL/BPP()         ← refresh tampilan nama di UI
5. SweetAlert sukses → tutupProfil()
```
