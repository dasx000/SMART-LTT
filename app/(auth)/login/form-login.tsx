"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { login, type HasilLogin } from "./actions";

export function FormLogin() {
  const [hasil, aksi, sedangProses] = useActionState<HasilLogin, FormData>(login, null);
  const [lihat, setLihat] = useState(false);

  return (
    <form action={aksi} className="space-y-4">
      <div>
        <label htmlFor="nip" className="mb-1 block text-sm font-semibold">
          NIP / Username
        </label>
        <input
          id="nip"
          name="nip"
          inputMode="numeric"
          autoComplete="username"
          required
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-semibold">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={lihat ? "text" : "password"}
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 pr-12 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
          />
          <button
            type="button"
            onClick={() => setLihat((v) => !v)}
            aria-label={lihat ? "Sembunyikan password" : "Tampilkan password"}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted"
          >
            {lihat ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      {hasil?.pesan && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-danger">
          {hasil.pesan}
        </p>
      )}

      <button
        type="submit"
        disabled={sedangProses}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-white transition active:scale-[0.99] disabled:opacity-70"
      >
        {sedangProses && <LoaderCircle size={18} className="animate-spin" />}
        {sedangProses ? "Memeriksa..." : "Masuk"}
      </button>
    </form>
  );
}
