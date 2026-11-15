"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { login, type HasilLogin } from "./actions";

const kelasInput =
  "w-full rounded-lg border border-gray-300 py-3 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200";

export function FormLogin() {
  const [hasil, aksi, sedangProses] = useActionState<HasilLogin, FormData>(login, null);
  const [lihat, setLihat] = useState(false);

  return (
    <form action={aksi}>
      <div className="mb-4">
        <label htmlFor="nip" className="mb-1 block text-sm font-semibold text-gray-700">
          NIP (Nomor Induk Pegawai)
        </label>
        <input
          id="nip"
          name="nip"
          inputMode="numeric"
          autoComplete="username"
          placeholder="Masukkan NIP Anda"
          required
          className={`${kelasInput} px-4`}
        />
      </div>

      <div className="mb-6">
        <label htmlFor="password" className="mb-1 block text-sm font-semibold text-gray-700">
          Password Rahasia
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={lihat ? "text" : "password"}
            autoComplete="current-password"
            placeholder="******"
            required
            className={`${kelasInput} pr-10 pl-4`}
          />
          <button
            type="button"
            onClick={() => setLihat((v) => !v)}
            aria-label={lihat ? "Sembunyikan password" : "Tampilkan password"}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 active:scale-95"
          >
            {lihat ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {hasil?.pesan && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {hasil.pesan}
        </p>
      )}

      <button
        type="submit"
        disabled={sedangProses}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-bold text-white transition hover:bg-green-700 disabled:opacity-70"
      >
        {sedangProses ? "Memeriksa..." : "Masuk Sekarang"}
        {sedangProses && <LoaderCircle size={16} className="animate-spin" />}
      </button>
    </form>
  );
}
