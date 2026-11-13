# SMART LTT

Pelaporan Luas Tambah Tanam (LTT) Padi, Jagung, dan Ubi Kayu — Kabupaten Way Kanan.
Versi baru berbasis Next.js + Supabase, pengganti aplikasi Google Apps Script lama.

- Repo: <https://github.com/dasx000/SMART-LTT>
- Repo lama (Apps Script): `dasx000/LTT` — kodenya juga disimpan di [`_gas_lama/`](_gas_lama/) dan tag git `gas-final`.
- Rencana migrasi: [plan.md](plan.md)
- Aturan bisnis hasil audit aplikasi lama: [docs/logika-bisnis.md](docs/logika-bisnis.md)
- Kondisi data lama: [docs/laporan-isi-data.md](docs/laporan-isi-data.md)

> **Status:** pengembangan (Fase 1 selesai: fondasi, login, kerangka halaman). Aplikasi lama masih dipakai sampai cutover.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth) · Zod · SweetAlert2 · Vercel

## Supabase dipakai bersama

Project Supabase ini juga dipakai aplikasi lain (CWS, TANIKU, ...). **Satu akun bisa masuk ke semua aplikasi.**

| Schema | Isi |
|---|---|
| `core` | Bersama: `core.profiles` (nama, NIP, email), `core.apps`, `core.memberships` (role per aplikasi) |
| `ltt` | Khusus SMART LTT: wilayah, anggota, laporan, target, produktivitas, sarana |

Role SMART LTT disimpan di `core.memberships` dengan `app_slug = 'ltt'`: `Penyuluh`, `Admin_BPP`, `Admin_Kab`, `Dinas`.
Jangan mengubah tabel schema `core`, `cws`, atau `taniku` dari proyek ini.

## Menjalankan di laptop

1. Pasang dependensi:
   ```bash
   npm install
   ```
2. Salin `.env.example` → `.env.local`, lalu isi nilai Supabase (termasuk `SUPABASE_SERVICE_ROLE_KEY`).
3. Jalankan SQL di Supabase → **SQL Editor**, berurutan:
   - [`supabase/migrations/0001_ltt_auth.sql`](supabase/migrations/0001_ltt_auth.sql)
4. Supabase → **Settings → API → Exposed schemas** → tambahkan `ltt`.
5. Jalankan:
   ```bash
   npm run dev   # http://localhost:3000
   ```

Perintah lain: `npm run build` (build produksi + cek TypeScript), `npm run lint`.

## Struktur

```
app/                 halaman (login, ppl, bpp, kab) — Server Components & Server Actions
components/          komponen bersama (kerangka halaman, header)
lib/auth.ts          satu-satunya tempat membaca sesi & role (Data Access Layer)
lib/supabase/        client Supabase: server.ts (atas nama user), admin.ts (service role, server saja)
lib/format.ts        format angka koma & tanggal WIB
lib/swal.ts          helper SweetAlert2
proxy.ts             menyegarkan token sesi (nama baru middleware di Next 16)
supabase/migrations/ SQL skema `ltt` (dijalankan manual di SQL Editor)
scripts/etl/         skrip baca/migrasi data spreadsheet lama
docs/                dokumentasi
_gas_lama/           kode Apps Script lama (rujukan, jangan diubah)
```

## Integrasi

- **Data padi** masuk otomatis dari bot VPS (`DASBOT/scripts/run_tarik_data.py`, jadwal 11:30, 12:30, 13:30, 22:30 WIB) ke endpoint `POST /api/epusluh/sinkron-padi` dengan token `EPUSLUH_INGEST_TOKEN`.
- **Saran pengguna** diteruskan ke webhook VPS (`VPS_WEBHOOK_URL`).

## Aturan penting

- Browser **tidak pernah** query Supabase langsung. Semua data lewat Server Component / Server Action.
- Setiap Server Action wajib memeriksa ulang user & role (`lib/auth.ts`), jangan percaya data dari browser.
- `SUPABASE_SERVICE_ROLE_KEY` hanya untuk server.
- **Jangan commit**: `.env.local`, `credentials.json`, file ekspor spreadsheet (`*.xlsx`, `*.csv`) — semuanya berisi data rahasia/pribadi dan sudah ada di `.gitignore`.
