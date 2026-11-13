# Plan: Migrasi SMART LTT ke Next.js + Vercel + Supabase

> Status: **RANCANGAN — keputusan utama sudah diambil (§11)**. Belum ada kode yang diubah. Kode GAS lama tetap jalan sampai cutover (Fase 7).
> **Jangan push ke GitHub dulu** sampai ada keputusan baru.
> Plan lama "Produktivitas & Sarana per Desa" ada di git (`git show 7fc650a:plan.md`). Fiturnya ikut dimigrasi (lihat §4, §6).

---

## 1. Kondisi Sekarang (yang akan dimigrasi)

| Bagian | Isi sekarang | Catatan |
|---|---|---|
| Backend | Google Apps Script: `Code.gs` (routing, `doGet`/`doPost`), `Database.gs` (~6.300 baris, ±120 fungsi), `LoaderTuyul.gs` (kode bookmarklet) | Semua dipanggil via `google.script.run` |
| Frontend | `Index.html`, `File_HTML_Login/PPL/BPP/Admin.html`, `File_Javascript.html` (~9.300 baris, 1 file), `File_CSS.html` | Tailwind CDN + SweetAlert2 + ApexCharts + ExcelJS (CDN) |
| Database | Google Sheets (±20 sheet): `Data_User`, `Data_LTT`, `Data_LTT_Padi`, `Data_LTT_<bulan>` (arsip), `Ringkasan_Harian`, `Data_Geografi`, `Jenis_LTT`, `Target_*` (8 sheet), `Logs_Sinkron`, `Data_Produktivitas_Desa`, `Data_Sarana_Desa` | Tanggal kadang teks, kadang Date (lihat `parseTanggalEPusluh_`) |
| Auth | NIP + password **plaintext** di `Data_User`, sesi disimpan di `localStorage` (`user_eLTT`) | Server banyak percaya data role/kecamatan dari client |
| Role | `Penyuluh`, `Admin_BPP` (koordinator kecamatan), `Admin_Kab`, `Dinas` | |
| Integrasi | (1) Bookmarklet e-Pusluh `?action=target` / `?action=eltt` → `doPost` aksi `sinkron_padi` & `import_target_epusluh`; (2) Webhook VPS `http://103.245.38.96:3000` (`/webhook/saran`, `/deteksi-ltt`) | `mode: 'no-cors'`, tanpa token |
| Otomasi | Trigger `arsipBulanan` (tgl 1, 01:00), `backupDatabaseHarian` (copy spreadsheet ke Drive) | |
| Cache | `CacheService` (HTML 6 jam, target, user, dashboard) | Sumber beberapa bug (lihat `issue.md`) |

**Masalah utama yang ingin diselesaikan dengan migrasi:**
1. Lambat (cold start GAS, baca seluruh sheet tiap request, butuh cache berlapis).
2. Batas kuota & eksekusi GAS (6 menit, LockService global).
3. Keamanan: password plaintext, otorisasi berbasis data client, endpoint `doPost` terbuka.
4. Kode frontend 1 file 9.000+ baris, sulit dirawat.
5. Integritas data: tanggal campur teks/Date, tidak ada constraint/foreign key, arsip terpecah per sheet.

---

## 2. Stack Target

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 16 (App Router) + TypeScript** | Server Components + Server Actions menggantikan `google.script.run` |
| Hosting | **Vercel Hobby (gratis)** + **domain sendiri** | Untuk sementara deploy lewat **Vercel CLI** dari laptop (`vercel` / `vercel --prod`) karena repo belum di-push ke GitHub |
| Styling | **Tailwind CSS v4 + shadcn/ui** | Kelas Tailwind lama bisa banyak dipakai ulang; komponen tabel/dialog/form siap pakai |
| Database | **Supabase Postgres** | Relasional, constraint, index, view, RLS |
| Auth | **Supabase Auth** (login NIP + password) | Password ter-hash (bcrypt), sesi cookie via `@supabase/ssr` |
| Akses data | `@supabase/supabase-js` + tipe hasil `supabase gen types` | Satu jalur, RLS tetap berlaku. (Alternatif Drizzle hanya jika butuh query kompleks; default: SQL view + RPC) |
| Validasi | **Zod** | Semua input Server Action & Route Handler |
| Form | `react-hook-form` + `@hookform/resolvers/zod` | Form LTT, target, produktivitas |
| Tabel | `@tanstack/react-table` (via shadcn Data Table) | Rekap/antrean verifikasi dengan sort/filter |
| Grafik | `react-apexcharts` (tetap ApexCharts) | Konfigurasi grafik lama bisa dipindah hampir 1:1 |
| Notifikasi & konfirmasi | **SweetAlert2** (`sweetalert2` + `sweetalert2-react-content`) | Keputusan user: tetap pakai SweetAlert2. Semua `Swal.fire(...)` lama bisa dipindah hampir 1:1; dipanggil hanya dari Client Component (`'use client'`) |
| Loading antar halaman | **Progress bar garis di atas layar (gaya YouTube)** via `nextjs-toploader` (berbasis NProgress) | Dipasang sekali di `app/layout.tsx`, otomatis jalan saat pindah route. Warna disamakan tema (hijau). Untuk aksi dalam halaman (simpan, muat tabel) tetap pakai skeleton/spinner + SweetAlert2 loading |
| Excel | `exceljs` (di-load dinamis di client) | Sama seperti sekarang |
| Tanggal | `date-fns` + `date-fns-tz` (zona `Asia/Jakarta`) | |
| Monitoring | Vercel Analytics + Sentry (opsional) | |
| Package manager | `npm` | pnpm tidak terpasang di laptop |

---

## 2b. Prinsip: Jangan Pindahkan Akal-akalan GAS

> Kode lama penuh siasat untuk mengakali batasan Apps Script (eksekusi maks 6 menit, baca seluruh sheet tiap request, tidak ada index/transaksi, cache terbatas). Di stack baru siasat itu **dibuang**, bukan diterjemahkan. Aturan: **tiap fungsi lama ditulis ulang dari tujuannya, bukan dari barisnya.**

| Siasat lama (karena batasan GAS) | Kenapa dulu perlu | Cara benar di stack baru |
|---|---|---|
| Baca seluruh sheet `getDataRange().getValues()` lalu saring di JS | Sheets tidak punya `WHERE` | `SELECT … WHERE … ` dengan index; server hanya ambil baris yang dibutuhkan, paginasi untuk daftar panjang |
| Tabel pivot `Ringkasan_Harian` dirawat manual (`upsertRingkasan_`, `rekalkulasiRingkasan`) + bug sinkron | Agregasi ribuan baris tiap request terlalu lambat | `GROUP BY` / view SQL dihitung saat diminta; tidak ada tabel turunan yang bisa tidak sinkron |
| Sheet arsip per bulan `Data_LTT_<bulan>` + trigger `arsipBulanan` | Sheet besar makin lambat | Satu tabel + index `(tanggal_lapor)`; "arsip" hanyalah `WHERE tanggal < …` |
| `Target_Kecamatan` hasil rebuild (`rebuildTargetKecamatan`, `hitungUlangTargetKecamatan`) | Tidak bisa `SUM … GROUP BY` | View `v_target_kecamatan = SUM(target_desa)`; selalu benar, tidak perlu tombol hitung ulang |
| Cache berlapis `CacheService` (HTML 6 jam, `CODE_VERSION`, cache target, cache user+password) + fungsi `invalidate*`, `clearAllAppCaches` | Tiap request GAS lambat (cold start + baca sheet) | Query Postgres berindeks sudah milidetik. Cache hanya untuk data master (kecamatan/desa/jenis) via `unstable_cache` + `revalidateTag` saat ada perubahan. Tidak ada cache password |
| Format lebar 12 bulan per baris (produktivitas) agar `setValues` sedikit | Tiap tulis ke Sheets mahal | Format panjang 1 baris = 1 bulan; `UPSERT … ON CONFLICT` 36 baris sekali kirim |
| `LockService` global untuk tiap simpan | Sheets tidak punya transaksi | Transaksi Postgres + `UNIQUE` constraint; tidak ada antrean global |
| ID buatan sendiri `_nextId_` (max + 1), `ID_Laporan` teks | Tidak ada auto-increment | `bigserial` / `identity`; `id_lama` disimpan hanya untuk jejak ETL |
| Cocokkan nama desa/kecamatan dengan `bersihNama_`, `_normNama_`, `lookupKecamatanFromDesa_` di setiap request | Tidak ada relasi antar sheet | Foreign key `desa_id`; pencocokan nama hanya **sekali** saat ETL |
| Tanggal campur teks/Date + `parseTanggalEPusluh_` + nama bulan manual | Sel Sheets bebas isi | Kolom `timestamptz`; parsing teks hanya di ETL dan endpoint e-Pusluh |
| Verifikasi massal = loop baris per baris | Tidak ada `UPDATE … WHERE id IN` | Satu `UPDATE … WHERE id = ANY($1)` dalam satu transaksi |
| Sesi di `localStorage` (`user_eLTT`), role/kecamatan dikirim client ke server | GAS tidak punya sesi | Cookie sesi Supabase (`@supabase/ssr`); server ambil profil dari sesi; RLS sebagai pagar kedua |
| Semua HTML role dikirim sekaligus (`getAppResources`) + 1 file JS 9.300 baris + "client-side caching menu" | Hanya satu halaman, tanpa router | Route per halaman (App Router): kode dan data dimuat per halaman otomatis, prefetch saat link terlihat, Server Components kirim HTML jadi |
| Loading penuh layar tiap klik menu | Tiap `google.script.run` 1–3 detik | Streaming + `loading.tsx` + progress bar atas; `useTransition` untuk form; data master sudah ada di halaman |
| Bookmarklet `fetch(..., mode:'no-cors')` tanpa tahu hasilnya | `doPost` GAS tidak kirim header CORS | Route Handler dengan CORS benar; bookmarklet tahu sukses/gagal dan jumlah baris |
| Backup = copy spreadsheet ke Drive | Satu-satunya cara | `pg_dump` terenkripsi (§7b) |
| Logika rekap kabupaten ±300 baris JS per fungsi (`getDashboardKab`, `getDashboardTarget`) | Semua harus dihitung di Apps Script | Satu RPC/view SQL per rekap; Next.js hanya menampilkan |
| Ekspor Excel: server kirim semua data mentah, browser susun | Hanya bisa begitu | Tetap di browser (ExcelJS), tapi data sudah ter-agregasi dari SQL; untuk file besar bisa Route Handler streaming |

**Peningkatan yang masuk v1 (murah dikerjakan):**
- **Pencarian & filter di server** (nama desa, status, rentang tanggal) dengan paginasi, bukan saring di browser.
- **Audit trail** sederhana: tabel `log_perubahan` (siapa mengubah apa, kapan) via trigger Postgres — gratis, menggantikan kolom `Waktu_Update` yang tersebar.
- **Validasi dua sisi** dengan skema Zod yang sama di form dan Server Action.

**Ditunda ke v1.1 (keputusan D):** Supabase Realtime di antrean verifikasi, PWA installable, notifikasi WA via bot saat laporan diverifikasi/ditolak, mode offline PPL, grafik tren multi-tahun.

---

## 2c. Ringan untuk HP Penyuluh

> Target: halaman PPL terbuka cepat di HP kelas menengah dengan sinyal 3G/4G lemah. Aturan di bawah **wajib**, dicek tiap fase.

**Anggaran (budget)**
- ~~JS halaman PPL < 150 KB gzip~~ → **direvisi (Fase 1, diukur):** runtime Next 16 + React sendiri ±144 KB gzip dan tidak bisa dihindari. Anggaran baru: **JS milik aplikasi (di luar runtime) < 60 KB gzip per halaman PPL, total < 220 KB gzip.** Ukuran halaman login saat Fase 1: 181 KB total (±37 KB milik aplikasi). Pembanding aplikasi lama: ±330 KB gzip (JS 360 KB mentah + Tailwind CDN + ApexCharts) di setiap pembukaan, tanpa cache ber-hash.
- Lighthouse Mobile: Performance **≥ 90**, LCP < 2,5 detik pada *throttling* 4G lambat.
- Dicek dengan `@next/bundle-analyzer` sebelum tiap fase ditutup.

**Cara mencapainya**
| Aturan | Penerapan |
|---|---|
| Server Components sebagai default | Halaman, tabel, kartu angka dirender di server → HP hanya terima HTML. `'use client'` hanya untuk form, dialog, grafik |
| Pustaka berat dimuat saat dibutuhkan saja | `ApexCharts` (±150 KB) hanya di halaman dashboard via `next/dynamic`, bukan di layout. `ExcelJS` (±300 KB) baru diunduh saat tombol "Unduh Excel" ditekan. Halaman input PPL **tidak memuat keduanya** |
| Grafik di HP PPL dibatasi | Halaman PPL pakai angka/kartu & tabel; grafik tren hanya di BPP/Kab, atau grafik ringan (sparkline SVG) |
| Tailwind di-*build*, bukan CDN | Hanya kelas yang terpakai yang dikirim (±10 KB), bukan seluruh Tailwind (±300 KB) seperti sekarang |
| Font sistem | Tidak unduh font; pakai `font-sans` sistem HP. Jika ingin 1 font, lewat `next/font` dengan subset latin |
| Ikon per-ikon | `lucide-react` (tree-shaken), bukan Font Awesome CDN utuh |
| Gambar dioptimasi | Logo jadi SVG/WebP kecil lewat `next/image`; tidak ada gambar dari Google Drive link |
| Data dikirim secukupnya | Paginasi 20–50 baris, kolom yang perlu saja, agregasi di SQL. Tidak ada "kirim semua lalu saring di browser" |
| Navigasi terasa instan | `<Link>` prefetch saat terlihat; progress bar atas; `loading.tsx` skeleton |
| Form hemat kuota | Server Action kirim hanya field form; respons kecil; `useTransition` agar tombol tidak dobel-klik |
| Tanpa polling | Tidak ada `setInterval` ambil data. (Realtime ditunda ke v1.1) |
| Cache browser | Aset statis ber-hash di CDN Vercel (cache setahun); HTML halaman dinamis tidak di-cache |
| PWA | Ditunda ke v1.1 |
| Layout HP dulu | Desain mobile-first, navigasi bawah (bottom nav) untuk PPL, target sentuh ≥ 44 px, tidak ada tabel lebar yang harus di-*zoom* (pakai kartu di HP, tabel di desktop) |

---

## 3. Arsitektur

```
Browser (PPL / BPP / Admin Kab / Dinas)
   │  cookie sesi Supabase
   ▼
Vercel ─ Next.js App Router
   ├─ app/(auth)/login              → Server Action login
   ├─ app/(app)/ppl/...             → halaman PPL
   ├─ app/(app)/bpp/...             → halaman koordinator BPP
   ├─ app/(app)/kab/...             → halaman Admin Kab / Dinas
   ├─ Server Actions                → semua tulis data (submit, edit, verifikasi, target, user)
   ├─ app/api/epusluh/*             → endpoint bookmarklet (token + CORS)
   ├─ app/api/tuyul/[nama]/route.ts → sajikan kode bookmarklet (JS)
   └─ app/api/cron/*                → Vercel Cron (backup, refresh rekap)
   │
   ▼
Supabase
   ├─ Postgres (tabel + view + fungsi RPC + RLS)
   └─ Auth (users ↔ tabel profiles)
   │
   └─▶ VPS webhook (saran, deteksi LTT) dipanggil dari server Next.js
```

Prinsip:
- **Satu jalur data (keputusan user):** browser **hanya** bicara ke Next.js (Server Component untuk baca, Server Action untuk tulis). Next.js yang bicara ke Supabase dengan sesi user. **Tidak ada** query Supabase dari browser, `anon key` tidak dipakai untuk akses data di client. RLS tetap dipasang sebagai pagar kedua.
- **Spreadsheet tidak dibutuhkan lagi** setelah migrasi: tidak ada orang/alat yang membukanya langsung. Setelah cutover spreadsheet hanya arsip beku. Yang dibutuhkan user adalah **tombol unduh Excel** (§6b), tidak boleh hilang satu pun.
- **Server tidak percaya client.** Role, kecamatan, desa binaan selalu diambil dari `profiles` berdasarkan sesi, bukan dari parameter.
- **RLS aktif di semua tabel** sebagai pagar kedua; Server Action tetap cek role sendiri.
- `service_role` key **hanya** dipakai di Route Handler bookmarklet, cron, dan skrip migrasi. Tidak pernah ke browser.
- Tidak ada lagi sheet arsip per bulan: satu tabel + index `(tanggal)`. Arsip = query `WHERE`.
- `Ringkasan_Harian` diganti **SQL view** (atau materialized view jika lambat).

---

## 4. Skema Database (Supabase)

> Nama tabel bahasa Indonesia, snake_case. Semua tabel punya `created_at`, `updated_at` (`timestamptz`, default `now()`).

### 4a. Referensi wilayah & master
```sql
kecamatan (id serial pk, kode text unique, nama text unique)
desa      (id serial pk, kode text unique, kecamatan_id int fk, nama text,
           unique(kecamatan_id, nama))
jenis_ltt (id serial pk, nama text, komoditas komoditas_enum)
-- enum
komoditas_enum = ('Padi','Jagung','Ubi Kayu')
role_enum      = ('Penyuluh','Admin_BPP','Admin_Kab','Dinas')
status_verif   = ('Menunggu','Diverifikasi BPP','Diverifikasi Kab', ...)  -- cek nilai riil di sheet saat ETL
```

### 4b. User
```sql
profiles (id uuid pk = auth.users.id, nip text unique, nama text, role role_enum,
          kecamatan_id int fk null, whatsapp text, aktif bool default true,
          wajib_ganti_password bool default true)
profil_desa_binaan (profile_id uuid fk, desa_id int fk, pk(profile_id, desa_id))
```
- `Desa_Binaan` (teks dipisah koma) dipecah ke tabel relasi.
- Login NIP: Supabase Auth butuh email → pakai email sintetis `{nip}@ltt.local` (tidak pernah ditampilkan). Form login tetap minta NIP.

### 4c. Laporan LTT
```sql
laporan_ltt (
  id bigserial pk, id_lama text unique,            -- ID_Laporan dari sheet
  tanggal_lapor timestamptz, pelapor_id uuid fk null, nama_pelapor text, nip_pelapor text,
  desa_id int fk, komoditas komoditas_enum, jenis_ltt_id int fk,
  target_tanam numeric, target_panen numeric, luas_bera numeric,
  realisasi_olah numeric, realisasi_tanam numeric, realisasi_panen numeric,
  keterangan text, status status_verif,
  waktu_verif_bpp timestamptz, waktu_verif_kab timestamptz,
  sumber text  -- 'manual' | 'epusluh'
)
index (tanggal_lapor), (desa_id, komoditas, tanggal_lapor), (status)
```
- `Data_LTT` (Jagung/Ubi Kayu manual) + `Data_LTT_Padi` (sinkron e-Pusluh) + **semua sheet arsip** `Data_LTT_*` / `Data_LTT_Padi_*` → satu tabel ini.
- `logs_sinkron (id, waktu, jumlah, ringkasan jsonb, pengirim text)`.

### 4d. Ringkasan (pengganti `Ringkasan_Harian`)
```sql
create view v_ringkasan_harian as
select date(tanggal_lapor at time zone 'Asia/Jakarta') tanggal, komoditas, jenis_ltt_id,
       sum(realisasi_tanam) total_tanam, sum(realisasi_panen) total_panen
from laporan_ltt group by 1,2,3;
```
- Plus view/RPC rekap: per desa, per kecamatan, per kabupaten, per bulan → menggantikan `getDashboardKab`, `getDashboardBPP`, `getRekapPadiLengkap`, `getRekapPalawijaLengkap`, `getRekapBulananPPL`, `getRekapHarianPPL`, `getLaporanLTT`.
- Jika view terlalu lambat: materialized view + `refresh` via cron / trigger.

### 4e. Target
Sekarang tersebar di 8 sheet (`Target_Bulanan`, `Target_Detail_Jenis`, `Target_Desa_Padi/Jagung/UbiKayu`, `Target_Kecamatan`, `Target_Kecamatan_Provinsi`, `Target_Kabupaten`, `Target_PmAas_Kabupaten`). Dinormalisasi jadi:
```sql
target_desa (id, tahun int, bulan int, desa_id fk, komoditas, jenis_ltt_id fk null,
             target_tanam numeric, target_panen numeric,
             ip_eksisting numeric, luas_baku numeric, luas_standing_crop numeric,
             pembuat text, unique(tahun,bulan,desa_id,komoditas,jenis_ltt_id))
target_kecamatan_provinsi (tahun, bulan, kecamatan_id, komoditas, target_tanam, pembuat)
target_kabupaten          (tahun, bulan, komoditas, target_tanam, target_panen, pembuat)
target_pmaas_kabupaten    (tahun, bulan, target_tanam)
view v_target_kecamatan = sum(target_desa) group by kecamatan   -- ganti Target_Kecamatan (hasil rebuild)
```
- Kolom padi per jenis (`LTT_Reguler`, `Padi_Gogo`, `CSR`, `Rehab_Bencana`, `Panen_*`) → baris per `jenis_ltt_id` (format panjang).
- **Keputusan:** `Target_Bulanan` + `Target_Detail_Jenis` **masih dipakai** → dimigrasi. Saat Fase 2 perlu dipetakan dulu: baris `Level_Wilayah` = desa/kecamatan/kabupaten masuk ke `target_desa` / `target_kecamatan_provinsi` / `target_kabupaten`, dan `Target_Detail_Jenis` menjadi baris per `jenis_ltt_id`. Jika ada tumpang tindih dengan `Target_Desa_*`, data `Target_Desa_*` (V3) yang menang; selisih dicatat di laporan ETL.

### 4f. Produktivitas & sarana (fitur plan sebelumnya)
```sql
produktivitas_desa (tahun, bulan 1-12, desa_id fk, komoditas, nilai numeric check (nilai between 0 and 100),
                    penginput_id uuid fk, pk(tahun,bulan,desa_id,komoditas))
sarana_desa (desa_id pk fk, gudang_gabah int, embung int, lantai_jemur int, mesin_pengering int
             check (>= 0), penginput_id uuid fk)
```
- Format panjang (1 baris = 1 bulan). Rumus rata-rata (desa > 0 → kecamatan, kecamatan > 0 → kabupaten) dibuat sebagai SQL function, uji dengan contoh di plan lama (hasil kabupaten **6,25**).

### 4g. RLS (ringkas)
| Tabel | Penyuluh | Admin_BPP | Admin_Kab / Dinas |
|---|---|---|---|
| `laporan_ltt` | baca/tulis desa binaan sendiri | baca kecamatannya, verifikasi/edit kecamatannya | baca semua; Admin_Kab verifikasi |
| `target_*` | baca desanya | baca kecamatannya | Admin_Kab tulis, Dinas baca |
| `produktivitas_desa`, `sarana_desa` | tulis desa binaan | tulis desa binaan + baca kecamatan | baca semua |
| `profiles` | baca diri sendiri, ubah nama/WA/password | baca & kelola PPL kecamatannya | Admin_Kab kelola semua |
| master wilayah | baca | baca | Admin_Kab tulis |

Helper SQL: `auth_role()`, `auth_kecamatan_id()`, `is_desa_binaan(desa_id)` (`security definer`, `stable`).

---

## 5. Struktur Folder Proyek Baru

> **Keputusan:** proyek Next.js dibuat **langsung di root folder ini**. Folder ini hasil clone, jadi file Apps Script (`*.gs`, `File_*.html`, `Index.html`, `appsscript.json`, `.clasp*`, `v222/`) boleh dihapus.
> Aman: `.clasp.json` di sini menunjuk `rootDir: d:\CODING\LTT` (folder lain), jadi GAS production tidak terpengaruh.
> Sebelum dihapus: pindahkan dulu ke `_gas_lama/` (tetap dilacak git) selama pengembangan sebagai rujukan logika, dan buat tag git `gas-final`. Hapus permanen setelah cutover stabil.

```
/  (root repo)
├─ app/
│  ├─ (auth)/login/page.tsx
│  ├─ (app)/layout.tsx            # cek sesi + navigasi sesuai role
│  ├─ (app)/ppl/                  # input LTT, laporan hari ini, rekap, produktivitas, sarana, profil
│  ├─ (app)/bpp/                  # dashboard kecamatan, verifikasi, kelola PPL, target per PPL
│  ├─ (app)/kab/                  # dashboard kab, antrean, rekap padi/palawija, target, PM AAS, user, logs sinkron
│  ├─ api/epusluh/sinkron-padi/route.ts
│  ├─ api/epusluh/import-target/route.ts
│  ├─ api/tuyul/[nama]/route.ts
│  └─ api/cron/backup/route.ts
├─ components/ui/                 # shadcn
├─ components/                    # komponen domain (FormLTT, TabelRekap, GrafikTren, dll.)
├─ lib/supabase/{server,client,admin}.ts
├─ lib/auth.ts                    # getSessionProfile(), requireRole()
├─ lib/validasi/                  # skema Zod
├─ lib/format.ts                  # angka koma, tanggal WIB, nama bulan
├─ server/actions/                # Server Actions per domain
├─ supabase/migrations/*.sql      # skema + RLS + view (versi via Supabase CLI)
├─ supabase/seed.sql
├─ scripts/etl/                   # skrip migrasi data Sheets → Supabase
└─ tests/                         # Vitest (unit) + Playwright (alur utama)
```

---

## 6. Pemetaan Fungsi GAS → Next.js

| GAS (sekarang) | Next.js (baru) |
|---|---|
| `prosesLogin` | Server Action `login(nip, password)` → `supabase.auth.signInWithPassword` |
| `updateProfilUser`, `updateWhatsAppUser` | Server Action `ubahProfil` |
| `submitLaporan`, `editLaporan`, `getLaporanPPLHariIni`, `cekStatusPadiHarian` | `server/actions/laporan.ts` + halaman `/ppl` |
| `getRekapBulananPPL`, `getRekapHarianPPL` | RPC `rekap_ppl_bulanan/harian` |
| `getDashboardBPP`, `editLaporanBPP`, `prosesVerifikasiMassal`, `getDaftarPPLbyKecamatan`, `resetPasswordPPL`, `updateDataPPL`, `ambilTargetPerPPL` | halaman `/bpp` + actions |
| `getDashboardKab`, `getAntreanKabupaten`, `getRekapPadiLengkap`, `getRekapPalawijaLengkap`, `getLaporanLTT`, `getTanggalTersediaRekap` | halaman `/kab` + view/RPC |
| `getDashboardTarget`, `ambilTargetBulanan`, `simpanTargetBulanan`, `simpanBulkTargetDesa`, `hapusTargetBulanan`, `rebuildTargetKecamatan`, `hitungUlangTargetKecamatan` | `server/actions/target.ts`; rebuild diganti view (tidak perlu dihitung ulang) |
| `getDashboardPmAas`, `simpanTargetPmAasKabupaten` | `/kab/pm-aas` |
| `getDaftarUser`, `simpanDataUser`, `hapusDataUser` | `/kab/pengguna` (pakai `supabase.auth.admin` di server) |
| `getDaftarKecamatan`, `getDaftarDesabyKecamatan`, `getSemuaGeografi`, `getKecamatanLaporan`, `getDesaLaporan`, `getJenisLTT` | query master (cache `unstable_cache`/`revalidateTag`) |
| `getProduktivitasDesa`, `simpanProduktivitasDesa`, `getSaranaDesa`, `simpanSaranaDesa`, `getRekap*Produktivitas/Sarana*`, `getProduktivitasSaranaExport` | `/ppl/produktivitas`, `/ppl/sarana`, `/bpp|kab/produktivitas` |
| `doPost` aksi `sinkron_padi` → `terimaSinkronPadi` | `POST /api/epusluh/sinkron-padi` (upsert by `id_lama`, satu transaksi via RPC) |
| `doPost` aksi `import_target_epusluh` → `importTargetEpusluh` | `POST /api/epusluh/import-target` |
| `doGet ?action=target/eltt` (`LoaderTuyul.gs`) | `GET /api/tuyul/target`, `/api/tuyul/eltt` (`Content-Type: application/javascript`) |
| `getLogsSinkron` | `/kab/logs-sinkron` |
| `kirimSaranWebhook` | Server Action `kirimSaran` → `fetch` ke VPS (URL di env) |
| `arsipBulanan`, `pindahKeArsip_` | **Dihapus** (tidak perlu arsip di Postgres) |
| `backupDatabaseHarian` | Cron `pg_dump` harian 00:00 WIB → Google Drive (lihat §7b) |
| `rekalkulasiRingkasan`, `rebuiltPadiRingkasan_`, `upsertRingkasan_` | **Dihapus** (view) |
| `CacheService`, `clearAllAppCaches`, `invalidate*`, `CODE_VERSION` | **Dihapus**; pakai cache Next.js + `revalidatePath/Tag` |
| `migrasiTargetKeV2/V3`, `testWebhook`, `setupApp`, `setupTriggers` | Tidak dimigrasi |

---

## 6b. Tombol Unduh Excel (wajib ada semua, dari aplikasi lama)

| Role | Tombol lama | Isi | Halaman baru |
|---|---|---|---|
| PPL | `downloadRekapExcel` | Rekap LTT harian/bulanan desa binaan | `/ppl/rekap` |
| PPL | `unduhExcelProduktivitas` | Produktivitas + sarana desa binaan | `/ppl/produktivitas` |
| BPP | `unduhExcelLaporanBPP` | Laporan LTT kecamatan (filter tanggal/komoditas) | `/bpp/laporan` |
| BPP | (rekap produktivitas kecamatan, dari plan sebelumnya) | Produktivitas + sarana per desa se-kecamatan | `/bpp/produktivitas` |
| Kab | `unduhExcelRekapLTT` | Rekap padi & palawija lengkap | `/kab/rekap` |
| Kab | `unduhExcelTargetVsRealisasi` | Target vs realisasi per kecamatan/desa | `/kab/target` |
| Kab | `unduhExcelKecamatan` | Dashboard kecamatan (detail per desa) | `/kab/dashboard` |
| Kab | `unduhExcelLaporan` | Daftar laporan LTT (filter) | `/kab/laporan` |
| Kab | `unduhExcelProduktivitas` | Produktivitas + sarana se-kabupaten | `/kab/produktivitas` |

Aturan: satu util `lib/excel.ts` (ExcelJS, dimuat dinamis saat tombol ditekan), format kolom/lebar/header tebal/angka koma seragam, nama file `SMART-LTT_<jenis>_<wilayah>_<periode>.xlsx`. Data yang diunduh = data yang tampil (filter sama), diambil dari SQL yang sama agar tidak beda angka. Tambahan baru: **Admin Kab bisa unduh semua tabel mentah** (`/kab/ekspor`) sebagai pengganti "buka spreadsheet".

---

## 7. Integrasi e-Pusluh (cron VPS → endpoint sinkron padi)

> **Revisi setelah audit:** bookmarklet (`LoaderTuyul.gs`, `/api/tuyul/*`, impor target e-Pusluh) **dihapus**. Data padi masuk otomatis dari bot VPS (`DASBOT/scripts/run_tarik_data.py`, cron 11:30/12:30/13:30/22:30 WIB) — lihat `docs/logika-bisnis.md` §25.

- Satu endpoint: **`POST /api/epusluh/sinkron-padi`** (pengganti `doPost aksi=sinkron_padi`).
  - Wajib header **`Authorization: Bearer <EPUSLUH_INGEST_TOKEN>`** (env Vercel; disimpan juga di `.env` DASBOT).
  - Server ke server → **tanpa CORS**.
  - Body sama dengan sekarang (`data` 18 kolom termasuk metode penanaman, `logData`; `dataVPS` diabaikan). Validasi Zod, batasi ukuran body.
  - Aturan **timpa per tanggal** dalam satu transaksi (RPC), catat `logs_sinkron`, balas JSON `{status, inserted}` agar skrip tahu sukses/gagal.
- Perubahan di repo DASBOT (saat cutover): ganti `GAS_URL` → URL Vercel + header token di `run_tarik_data.py` (cek juga `downloader-ltt.js`).
- Selama masa transisi, endpoint GAS lama **tetap aktif**; bisa kirim ke dua tujuan sekaligus selama uji paralel (Fase 7).

### 7a. VPS (bot WA + webhook) — tetap dipakai
- Webhook `/webhook/saran` dan `/deteksi-ltt` di VPS tetap dipanggil, sekarang dari server Next.js (Server Action), URL di env `VPS_WEBHOOK_URL`.
- Tambah header rahasia `X-Webhook-Secret` (env `VPS_WEBHOOK_SECRET`) dan cek di sisi VPS.
- Jika bot WA perlu membaca data LTT, bot memanggil endpoint Next.js `/api/bot/*` dengan token, atau langsung ke Supabase dengan key khusus. Hindari bot memegang `service_role`.

### 7b. Backup harian ke Google Drive (pengganti backup Supabase Pro)
- Jadwal **00:00 WIB** tiap hari.
- Langkah: `pg_dump` (skema + data) → `gzip` → enkripsi (`gpg --symmetric`, password di env) → unggah ke folder Drive `Backup_eLTT` dengan `rclone` (login OAuth akun Google sendiri) → hapus backup > 30 hari.
- **Dijalankan dari cron VPS** (keputusan §11). Dikerjakan **paling akhir** (Fase 8), setelah aplikasi stabil.
- Persiapan sekali di VPS: pasang `postgresql-client`, `rclone`, `gnupg`; connection string Supabase (*Session pooler*, port 5432) + password enkripsi disimpan di `/root/.ltt-backup.env` (`chmod 600`); `rclone config` Google Drive (login lewat laptop, token ditempel ke VPS).
- Skrip `/root/ltt-backup.sh` (±30 baris): tiap langkah dicek; jika gagal → panggil endpoint bot WA untuk kirim pesan ke admin. Jadwal `crontab`: `0 0 * * *` jika zona VPS WIB, `0 17 * * *` jika UTC (cek `timedatectl`).
- Skrip `ltt-restore.sh`: unduh dari Drive → `gpg -d` → `gunzip` → `psql` ke project Supabase tujuan.
- Skrip juga menulis "backup sukses + waktu" ke tabel kecil `status_sistem` di Supabase; halaman Admin Kab menampilkan "Backup terakhir: …" supaya ketahuan jika VPS mati.
- Uji pulihkan ke project Supabase uji sekali di awal, lalu tiap bulan.

---

## 8. Strategi Migrasi Data (ETL)

1. **Ekspor**: skrip Node `scripts/etl/ekspor.ts` baca semua sheet via Google Sheets API (service account, read-only) → simpan JSON mentah per sheet di folder lokal (tidak di-commit).
2. **Transformasi** (`transform.ts`):
   - Normalisasi nama kecamatan/desa (trim, huruf kecil untuk pencocokan) → `desa_id`. Desa yang tidak cocok dicatat ke `laporan_etl.csv` untuk diperbaiki manual.
   - Tanggal: pakai logika `parseTanggalEPusluh_` (termasuk teks "Agustus 1, 2026", dd/mm/yyyy, Date). Semua disimpan `timestamptz` WIB. Ini sekaligus memperbaiki bug Agu/Ags di `issue.md`.
   - Angka desimal koma → numeric.
   - Komoditas kosong di `Data_LTT` → isi berdasarkan `jenis_ltt` (perbaiki bug fallback di `issue.md`).
   - Target lebar (kolom per jenis) → baris panjang.
3. **Muat**: insert batch via `service_role` dengan urutan: wilayah → jenis_ltt → user → laporan → target → produktivitas/sarana → logs.
4. **User**: untuk tiap baris `Data_User` → `auth.admin.createUser({ email: nip@ltt.local, password: <password lama>, email_confirm: true })` + insert `profiles`. Password lama ter-hash otomatis oleh Supabase; `wajib_ganti_password = true` sehingga user diminta ganti saat login pertama.
5. **Verifikasi**: skrip `cek.ts` bandingkan total per komoditas × bulan × kecamatan antara Sheets dan Supabase (jumlah baris, sum tanam, sum panen, sum target). Selisih harus 0.
6. **Cakupan: semua data historis** (keputusan §11), termasuk semua sheet arsip `Data_LTT_*` / `Data_LTT_Padi_*`, digabung ke satu tabel `laporan_ltt`. Tidak ada lagi sheet/tabel baru tiap ganti bulan.
7. Skrip ETL **bisa dijalankan ulang** (idempoten via `id_lama` / unique key) → dipakai lagi saat cutover untuk delta terakhir.

---

## 9. Tahapan Kerja

### Fase 0 — Persiapan (½ hari)
- [ ] Putuskan pertanyaan terbuka di §11.
- [ ] Buat project Supabase Free (region **Singapore** `ap-southeast-1`) dan project Vercel Hobby (deploy via CLI, belum terhubung GitHub).
- [ ] Pakai URL `*.vercel.app` dulu; domain sendiri menyusul (tinggal tambah record DNS di Vercel).
- [ ] Buat service account Google (Cloud Console) → unduh `credentials.json` (masuk `.gitignore`) → bagikan spreadsheet ke email service account sebagai *Viewer*.
- [x] Pindahkan file GAS ke `_gas_lama/` (tetap dilacak git sebagai rujukan) + tag `gas-final`.
- [ ] Siapkan env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `EPUSLUH_INGEST_TOKEN`, `VPS_WEBHOOK_URL`, `VPS_WEBHOOK_SECRET`, `CRON_SECRET`.
- [ ] **Ekspor awal (keputusan C):** skrip `scripts/etl/ekspor.ts` tarik semua sheet → JSON lokal (`data_lama/`, di `.gitignore`) + `laporan-isi-data.md`: jumlah baris per sheet, nilai unik status/komoditas/jenis, desa yang tidak cocok dengan `Data_Geografi`, tanggal berformat teks, sel kosong. Skema §4 direvisi berdasarkan laporan ini.

### Fase 0.5 — Audit logika (1–2 hari) *(keputusan A)*
- [x] Baca seluruh `Database.gs`, `Code.gs`, `LoaderTuyul.gs`, dan bagian terkait di `File_Javascript.html`.
- [x] Tulis `docs/logika-bisnis.md` dalam bahasa biasa, per fitur: input apa, aturan validasi, rumus (capaian %, PM AAS, pemetaan kolom padi per jenis, rata-rata produktivitas, status verifikasi & alurnya, batas "hari ini"/bulan berjalan, aturan e-Pusluh upsert), siapa boleh apa.
- [x] Catat juga **perilaku aneh/bug** yang ditemukan → daftar keputusan di `docs/logika-bisnis.md` §24 (16 pertanyaan).
- [ ] **User mengoreksi** dokumen ini. Setelah disetujui, dokumen jadi acuan SQL dan daftar kasus uji "angka lama = angka baru".

### Fase 1 — Fondasi (1–2 hari) — **SELESAI 13 Nov 2026** (belum terhubung Supabase)
- [x] `create-next-app` → ternyata **Next.js 16.4.6** + React 19.3, TS, Tailwind v4, ESLint, `cacheComponents` & `partialPrefetching` aktif. Pakai **npm** (pnpm tidak terpasang). shadcn ditunda: dipasang per komponen saat dibutuhkan (Fase 3.5) agar JS tetap kecil.
- [x] `@supabase/ssr`: `lib/supabase/server.ts` (atas nama user), `lib/supabase/admin.ts` (service role, server saja). **Tidak ada client browser** (satu jalur data). `proxy.ts` (nama baru `middleware.ts` di Next 16) hanya menyegarkan token.
- [x] `lib/auth.ts` = Data Access Layer: `getPenggunaOpsional` (`use cache: private`), `getPengguna`, `wajibRole`. Halaman role dijaga di dalam `<Suspense>` (aturan Next 16).
- [x] Login NIP + password (`app/(auth)/login`) via Server Action + Zod; email sintetis `NIP@AUTH_EMAIL_DOMAIN`; pesan galat sama untuk NIP/password salah. Logout.
- [x] Kerangka halaman `/ppl`, `/bpp`, `/kab`, `/ganti-password` (isi menyusul), header aplikasi, skeleton, `error.tsx`, `not-found.tsx` berbahasa Indonesia.
- [x] Tema warna hijau (token CSS), font sistem, header keamanan (`X-Frame-Options`, HSTS, dll.).
- [x] Progress bar atas `nextjs-toploader` di root layout.
- [x] SweetAlert2 + `lib/swal.ts` (dimuat saat pertama dipakai).
- [x] `lib/format.ts` (angka koma, tanggal WIB via `Intl`, nama bulan) — tanpa date-fns.
- [x] `.env.example`, `.gitignore` (rahasia, `data_lama/`, `credentials.json`).
- [ ] Logo asli (sekarang ikon sementara) — butuh file logo dari user.
- Hasil uji: `npm run build` & `npm run lint` bersih; `/login` statis, halaman role partial-prerender; JS `/login` 181 KB gzip (runtime ±144 KB).

**Anggapan sementara (bisa diubah sebelum Fase 2):** PPL boleh edit laporannya sendiri **kapan saja** (tercatat di `log_perubahan`); target desa tetap ada dan target kecamatan diisi **bebas** oleh Admin BPP (tidak dijumlah dari desa), isinya mengikuti format target desa.

### Fase 2 — Skema & RLS (1–2 hari)
- [ ] Migration SQL §4 di `supabase/migrations`.
- [ ] Fungsi helper RLS + policy semua tabel.
- [ ] View & RPC rekap.
- [ ] Tes RLS (login sebagai tiap role, pastikan tidak bisa baca/tulis di luar wilayah).

### Fase 3 — ETL & data uji (1–2 hari)
- [ ] Skrip ekspor/transform/muat/cek (§8).
- [ ] Jalankan ke Supabase **staging**; perbaiki data yang gagal cocok.

### Fase 3.5 — Irisan tipis ujung ke ujung (2–3 hari) *(keputusan B)*
- [ ] Login NIP + paksa ganti password pertama kali.
- [ ] PPL: input 1 laporan LTT (Jagung/Ubi Kayu) + daftar laporan hari ini.
- [ ] BPP: antrean verifikasi + verifikasi massal.
- [ ] Kab: dashboard ringkas (total tanam/panen hari ini & bulan ini per komoditas).
- [ ] Deploy ke Vercel (staging), **2–3 PPL + 1 koordinator BPP mencoba di HP sendiri**; catat keluhan (kecepatan, alur, tampilan).
- [ ] Ukur anggaran §2c (bundle, Lighthouse) di irisan ini; perbaiki sebelum melebar.
- [ ] Baru lanjut Fase 4–6, dengan pola yang sudah terbukti.

### Fase 4 — Fitur PPL (2 hari)
- [ ] Edit laporan LTT, status padi harian.
- [ ] Rekap harian/bulanan PPL, target per desa.
- [ ] Produktivitas per desa (tabel 12 bulan × 3 komoditas) & sarana desa.
- [ ] Profil (nama, WA, password), kirim saran.

### Fase 5 — Fitur BPP (2 hari)
- [ ] Dashboard kecamatan + grafik.
- [ ] Verifikasi massal, edit laporan BPP.
- [ ] Kelola PPL (reset password, ubah data), target per PPL.
- [ ] Rekap produktivitas/sarana kecamatan + unduh Excel.

### Fase 6 — Fitur Admin Kab / Dinas (3–4 hari)
- [ ] Dashboard kabupaten (tren, capaian vs target, status count).
- [ ] Antrean verifikasi kabupaten.
- [ ] Rekap padi & palawija lengkap + ekspor Excel, laporan LTT.
- [ ] Manajemen target (form, bulk desa, hapus), PM AAS.
- [ ] Manajemen user, master wilayah, logs sinkron.
- [ ] Rekap produktivitas/sarana kabupaten.
- [ ] Endpoint e-Pusluh + bookmarklet baru (§7).

### Fase 7 — Uji paralel & cutover (1–2 minggu kalender)
- [ ] **Uji paralel**: aplikasi baru di URL Vercel, data disalin ulang dari Sheets tiap hari (ETL delta). Beberapa PPL + 1 BPP + Admin Kab mencoba, bandingkan angka dashboard lama vs baru.
- [ ] Playwright untuk alur utama: login → input LTT → verifikasi BPP → verifikasi Kab → muncul di rekap.
- [ ] **Hari cutover** (pilih awal bulan, setelah rekap bulan lalu selesai):
  1. Umumkan ke grup PPL, bekukan input di GAS (tampilkan banner "pindah ke alamat baru").
  2. Jalankan ETL delta terakhir + `cek.ts`.
  3. Arahkan bookmarklet ke endpoint Vercel.
  4. GAS `doGet` diganti redirect ke URL baru.
  5. Kirim ke semua user: alamat baru + cara login (NIP + password lama, lalu ganti).
- [ ] Spreadsheet lama dijadikan **read-only arsip**, jangan dihapus minimal 3 bulan.

### Fase 8 — Pasca migrasi
- [ ] **Backup harian dari VPS ke Google Drive** + uji pulihkan (§7b).
- [ ] Hubungkan domain sendiri; setting HTTPS/secret webhook VPS (§7a).
- [ ] Pantau error (Vercel logs / Sentry) 2 minggu pertama.
- [ ] Hapus kode GAS dari branch utama setelah stabil (tetap ada di git history / tag `gas-final`).
- [ ] Update `README.md`.

**Estimasi total kerja: ±4 minggu** (termasuk Fase 0.5 dan 3.5; paruh waktu lebih lama), di luar masa uji paralel.

---

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Data lama kotor (nama desa beda ejaan, tanggal teks) | ETL mencatat semua baris gagal cocok; perbaikan manual sebelum cutover; `cek.ts` wajib selisih 0 |
| PPL bingung alamat & cara login baru | Login tetap NIP + password lama; redirect dari URL GAS; panduan singkat bergambar di grup |
| Supabase Free: project di-*pause* setelah 7 hari tanpa aktivitas, tanpa backup otomatis, batas DB 500 MB | Dipakai harian (aman dari pause; libur panjang → cron ping ringan dari VPS); backup sendiri ke Drive (§7b); ribuan–ratusan ribu baris LTT masih jauh di bawah 500 MB |
| Vercel Hobby: batas durasi fungsi & kuota bulanan | Query berat dipindah ke SQL (view/RPC), bukan diolah di fungsi; ekspor Excel dibuat di browser; pantau kuota di dashboard Vercel |
| Bookmarklet e-Pusluh gagal karena CORS/CSP situs e-Pusluh | Uji di Fase 6 lebih awal; cadangan: bookmarklet membuka tab ke halaman kita dan kirim via `postMessage`/form POST |
| Webhook VPS masih `http://` tanpa auth | Tetap bisa dipanggil dari server Vercel; tambahkan shared secret header, idealnya pindah ke HTTPS |
| Logika rekap kompleks (`getDashboardKab` ~280 baris, target V3) salah diterjemahkan | Tulis unit test berdasarkan output fungsi GAS lama untuk bulan yang sama (snapshot) sebelum menulis ulang |
| Zona waktu (WIB) bergeser di server UTC | Simpan `timestamptz`, konversi ke `Asia/Jakarta` di SQL (`at time zone`) dan di UI; tidak pakai `new Date()` lokal untuk batas hari |

---

## 11. Keputusan & Pertanyaan Terbuka

### Sudah diputuskan (13 Nov 2026)
| # | Topik | Keputusan |
|---|---|---|
| 1 | Paket | **Gratis**: Supabase Free + Vercel Hobby. Backup dibuat sendiri ke Google Drive (§7b) |
| 2 | Domain | **Domain sendiri** |
| 3 | Lokasi kode | **Langsung di root folder ini**; file GAS boleh dihapus (dipindah ke `_gas_lama/` dulu). **Belum push ke GitHub** |
| 4 | Penyimpanan | Satu tabel per jenis data, **tidak ada sheet/tabel baru per bulan**. Dengan index, ribuan–ratusan ribu baris tetap cepat |
| 5 | Data historis | **Migrasi semua** sejak awal |
| 6 | VPS (bot WA + webhook) | **Tetap dipakai** (§7a) |

| 7 | Domain | **Pakai `*.vercel.app` dulu**, domain sendiri menyusul |
| 8 | Backup | Dijalankan dari **cron VPS** (§7b). **Dikerjakan paling akhir** setelah aplikasi jalan |
| 9 | Akses data lama (ETL) | **Service account** Google diberi akses *Viewer* ke spreadsheet; cadangan: unduh `.xlsx` manual |
| 10 | `Target_Bulanan` / `Target_Detail_Jenis` | **Tidak dimigrasi** (tidak dipakai aplikasi lama; audit §17a) |
| 11 | Role Dinas | **Hanya melihat Dashboard + LTT PM AAS** (seperti aplikasi lama) |
| 12 | Login | **NIP + password** saja, tanpa OTP |
| 13 | Ekspor | **Tombol unduh Excel** saja, tidak ada sinkron ke Google Sheets |
| 14 | VPS (HTTPS, akses bot ke data baru) | **Disetting belakangan** |
| 15 | Notifikasi/dialog | **Tetap SweetAlert2** (bukan sonner/AlertDialog) |
| 16 | Animasi loading | **Progress bar garis atas gaya YouTube** (`nextjs-toploader`) untuk pindah halaman; skeleton untuk isi tabel/dashboard |
| 17 | Jalur data | **Semua lewat Next.js** (Server Component / Server Action). Browser tidak pernah query Supabase langsung |
| 18 | Spreadsheet | **Tidak dibutuhkan lagi** setelah migrasi; tidak ada yang membukanya manual. Pengganti: tombol unduh Excel di tiap halaman (§6b) + ekspor tabel mentah untuk Admin Kab |

| 19 | Audit logika | **Ya** → Fase 0.5: semua rumus/aturan GAS ditulis ke `docs/logika-bisnis.md`, dikoreksi user sebelum SQL ditulis |
| 20 | Urutan kerja | **Irisan tipis dulu** (login → PPL input → BPP verifikasi → dashboard Kab), dicoba 2–3 PPL di HP, baru dilebarkan |
| 21 | Ekspor data awal | **Ya** → tarik semua sheet ke JSON + laporan isi data **sebelum** skema difinalkan |
| 22 | Fitur tambahan | **Realtime & PWA ditunda ke v1.1**; audit trail (`log_perubahan`) tetap di v1 |

| 23 | Hasil audit logika | Lihat **`docs/logika-bisnis.md` §25** — terpenting: **fitur verifikasi dihapus**, **bookmarklet e-Pusluh dihapus**, target **tanpa tahun**, target kecamatan diisi Admin BPP dan **kabupaten = jumlah kecamatan**, warna capaian 60/85 |

> ⚠️ Karena keputusan 23, bagian plan yang menyebut verifikasi (§4c status, §4g RLS, Fase 3.5, Fase 5–6), bookmarklet/endpoint e-Pusluh (§7, §6 baris `doPost`/`doGet`), dan `target_kecamatan_provinsi` akan direvisi setelah pertanyaan lanjutan §26 dijawab.

### Masih terbuka
- **Pertanyaan lanjutan audit** (`docs/logika-bisnis.md` §26): sumber data padi tanpa bookmarklet, detail target kecamatan, aturan edit laporan tanpa verifikasi.
- **E. Tanggal cutover** — usulan 1 Januari 2027 (3–4 minggu kerja + 2 minggu uji paralel; awal tahun = target & rekap bersih). Menunggu keputusan.


---

## 12. Hal yang Sebelumnya Ketinggalan (sudah dimasukkan)

| # | Hal | Keputusan / rencana |
|---|---|---|
| 1 | **Lingkungan staging vs production** | Supabase Free boleh 2 project → `ltt-staging` dan `ltt-prod`. Vercel: *preview* (staging) dan *production*. ETL & uji coba selalu ke staging dulu |
| 2 | **Lupa password** | Tidak ada email user → tetap seperti sekarang: PPL minta reset ke koordinator BPP, BPP ke Admin Kab. Password sementara + wajib ganti saat login |
| 3 | **Pembatasan percobaan login** | Supabase Auth sudah membatasi; tambah penundaan 1–2 detik setelah 5 kali gagal per NIP (tabel `percobaan_login`) |
| 4 | **Lama sesi** | Sesi 7 hari dengan refresh otomatis; PPL tidak harus login tiap hari (sama seperti `localStorage` sekarang), tapi bisa dicabut dari server (nonaktifkan user) |
| 5 | **Halaman error** | `error.tsx`, `not-found.tsx`, halaman "tidak punya akses"; pesan dalam bahasa Indonesia, tidak menampilkan stack trace |
| 6 | **Anti kirim ganda** | Tombol simpan dinonaktifkan saat proses + `UNIQUE` di DB (mis. 1 laporan per desa/komoditas/jenis/tanggal) agar refresh/dobel klik tidak buat duplikat |
| 7 | **Hapus data** | Laporan & user **tidak dihapus fisik**: kolom `dihapus_pada` (soft delete), agar rekap lama tidak berubah diam-diam |
| 8 | **Jejak perubahan** | Tabel `log_perubahan` via trigger untuk `laporan_ltt`, `target_*`, `profiles` (siapa, kapan, nilai lama → baru) |
| 9 | **Master data** | Admin Kab bisa kelola kecamatan/desa/jenis LTT lewat halaman, bukan edit sheet |
| 10 | **Keamanan header** | CSP, `X-Frame-Options`, HSTS di `next.config` (`headers()`); HTTPS otomatis dari Vercel |
| 11 | **Rahasia & konfigurasi** | `.env.local` (tidak di-commit) + `.env.example`; `credentials.json` service account di `.gitignore`; key `service_role` hanya di server |
| 12 | **Batas paket gratis dipantau** | Supabase: 500 MB DB, 5 GB egress/bulan, pause 7 hari idle. Vercel: 100 GB bandwidth. Cek bulanan; cron ping dari VPS saat libur panjang |
| 13 | **Data uji** | `supabase/seed.sql`: 2 kecamatan, 6 desa, 1 akun tiap role, beberapa laporan & target — untuk pengembangan dan Playwright |
| 14 | **Panduan pengguna** | Satu halaman "Bantuan" di aplikasi + PDF singkat bergambar untuk grup WA saat cutover |
| 15 | **Angka & tanggal** | Tampilan koma desimal (`1.234,56`), tanggal `13 Nov 2026`, semua WIB; satu util `lib/format.ts`, tidak ada format manual tersebar |
| 16 | **Zona waktu "hari ini"** | Batas hari untuk "laporan hari ini" dihitung WIB di SQL (`at time zone 'Asia/Jakarta'`), bukan di server UTC |
| 17 | **Bookmarklet versi** | Kode bookmarklet disajikan dari server, jadi tiap perbaikan langsung berlaku tanpa PPL pasang ulang (sama seperti `?action=` sekarang) |
| 18 | **Rencana mundur (rollback)** | Sampai 1 bulan setelah cutover, GAS + spreadsheet masih bisa diaktifkan kembali: matikan redirect, umumkan. Data yang masuk ke Supabase selama itu diekspor Excel |
| 19 | **Dokumentasi teknis** | `README.md` baru: cara jalan lokal, env, migrasi DB, deploy, ETL, backup/restore |

---

## 13. Definisi Selesai

- Semua fitur di §6 jalan di Vercel untuk 4 role, diuji di HP.
- Tidak ada siasat GAS dari §2b yang ikut terbawa (tidak ada tabel turunan manual, cache berlapis, loop baris, pencocokan nama di runtime).
- Halaman utama tiap role tampil < 1 detik di HP dengan sinyal normal; pindah halaman terasa instan (prefetch).
- Anggaran §2c terpenuhi: JS milik aplikasi < 60 KB gzip per halaman PPL (total < 220 KB), Lighthouse Mobile ≥ 90.
- Staging dan production terpisah; seed data uji jalan; Playwright alur utama lulus.
- `cek.ts` menunjukkan total Sheets = Supabase untuk semua komoditas/bulan/kecamatan.
- Tidak ada password plaintext; RLS lulus uji per role.
- Bookmarklet e-Pusluh mengirim ke endpoint baru dan tercatat di logs sinkron.
- Backup harian berjalan dan pernah diuji restore satu kali.
- GAS lama redirect ke aplikasi baru; spreadsheet lama read-only.
