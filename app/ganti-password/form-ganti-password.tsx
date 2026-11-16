"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { gantiPasswordAction, type HasilGanti } from "./actions";

const kelasInput =
  "w-full rounded-lg border border-gray-300 py-3 pr-10 pl-4 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200";

export function FormGantiPassword() {
  const [hasil, aksi, sedangProses] = useActionState<HasilGanti, FormData>(gantiPasswordAction, null);
  const [lihat, setLihat] = useState(false);

  if (hasil?.sukses) {
    return (
      <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
        {hasil.pesan}
      </p>
    );
  }

  const tipe = lihat ? "text" : "password";
  return (
    <form action={aksi} className="space-y-4">
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
        Tidak wajib. Akun ini dipakai bersama aplikasi lain, jadi password baru juga berlaku di sana.
      </p>

      <Isian label="Password lama" name="lama" type={tipe} autoComplete="current-password" />
      <Isian label="Password baru (min. 6 karakter)" name="baru" type={tipe} autoComplete="new-password" minLength={6} />
      <Isian label="Ulangi password baru" name="ulang" type={tipe} autoComplete="new-password" minLength={6} />

      <button
        type="button"
        onClick={() => setLihat((v) => !v)}
        className="flex items-center gap-2 text-sm text-gray-600 active:scale-95"
        aria-pressed={lihat}
      >
        {lihat ? <EyeOff size={16} /> : <Eye size={16} />}
        {lihat ? "Sembunyikan password" : "Tampilkan password"}
      </button>

      {hasil && !hasil.sukses && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {hasil.pesan}
        </p>
      )}

      <button
        type="submit"
        disabled={sedangProses}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-bold text-white transition hover:bg-green-700 disabled:opacity-70"
      >
        {sedangProses ? "Menyimpan..." : "Simpan Password Baru"}
        {sedangProses && <LoaderCircle size={16} className="animate-spin" />}
      </button>
    </form>
  );
}

function Isian({ label, name, ...rest }: { label: string; name: string; type: string; autoComplete: string; minLength?: number }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-semibold text-gray-700">
        {label}
      </label>
      <input id={name} name={name} required maxLength={72} className={kelasInput} {...rest} />
    </div>
  );
}
