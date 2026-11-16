"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { simpanWhatsAppAction, type HasilProfil } from "./actions";

export function FormWhatsApp({ awal }: { awal: string }) {
  const [hasil, aksi, sedangProses] = useActionState<HasilProfil, FormData>(simpanWhatsAppAction, null);

  return (
    <form action={aksi} className="space-y-3">
      <div>
        <label htmlFor="whatsapp" className="mb-1 block text-sm font-semibold text-gray-700">
          Nomor WhatsApp
        </label>
        <input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={awal}
          maxLength={20}
          pattern="[0-9+ \-]*"
          placeholder="08xxxxxxxxxx"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200"
        />
      </div>

      {hasil && (
        <p
          role={hasil.sukses ? "status" : "alert"}
          className={`rounded-lg px-4 py-3 text-sm font-medium ${hasil.sukses ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}
        >
          {hasil.pesan}
        </p>
      )}

      <button
        type="submit"
        disabled={sedangProses}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-bold text-white transition hover:bg-green-700 disabled:opacity-70"
      >
        {sedangProses ? "Menyimpan..." : "Simpan Nomor WA"}
        {sedangProses && <LoaderCircle size={16} className="animate-spin" />}
      </button>
    </form>
  );
}
