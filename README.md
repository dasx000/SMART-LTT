# SMART LTT

Pelaporan Luas Tambah Tanam (LTT) Padi, Jagung, dan Ubi Kayu — versi Next.js + Supabase.
Pengganti aplikasi Google Apps Script lama (kodenya disimpan di `_gas_lama/`, tag git `gas-final`).

- Rencana migrasi: [plan.md](plan.md)
- Aturan bisnis hasil audit aplikasi lama: [docs/logika-bisnis.md](docs/logika-bisnis.md)

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth) · Zod · SweetAlert2 · Vercel

## Menjalankan di laptop

```bash
npm install
cp .env.example .env.local   # lalu isi nilai Supabase
npm run dev                  # http://localhost:3000
```

Perintah lain: `npm run build` (build produksi + cek TypeScript), `npm run lint`.

## Struktur

```
app/              halaman (login, ppl, bpp, kab) — Server Components & Server Actions
components/       komponen bersama (kerangka halaman, header)
lib/auth.ts       satu-satunya tempat membaca sesi & role (Data Access Layer)
lib/supabase/     client Supabase: server.ts (atas nama user), admin.ts (service role, server saja)
lib/format.ts     format angka koma & tanggal WIB
lib/swal.ts       helper SweetAlert2
proxy.ts          menyegarkan token sesi (nama baru middleware di Next 16)
docs/             dokumentasi
_gas_lama/        kode Apps Script lama (rujukan, jangan diubah)
```

## Aturan penting

- Browser **tidak pernah** query Supabase langsung. Semua data lewat Server Component / Server Action.
- Setiap Server Action wajib memeriksa ulang user & role (`lib/auth.ts`), jangan percaya data dari browser.
- `SUPABASE_SERVICE_ROLE_KEY` hanya untuk server. `.env.local` dan `credentials.json` tidak boleh di-commit.
