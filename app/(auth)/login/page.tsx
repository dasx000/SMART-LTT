import type { Metadata } from "next";
import { Sprout } from "lucide-react";
import { FormLogin } from "./form-login";

export const metadata: Metadata = { title: "Masuk" };

// Halaman statis (tanpa baca sesi) → tampil instan dari CDN.
export default function HalamanLogin() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
            <Sprout size={30} aria-hidden />
          </div>
          <h1 className="text-2xl font-black tracking-tight">SMART LTT</h1>
          <p className="mt-1 text-sm text-muted">Pelaporan Luas Tambah Tanam</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <FormLogin />
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Lupa password? Hubungi koordinator BPP kecamatan Anda.
        </p>
      </div>
    </main>
  );
}
