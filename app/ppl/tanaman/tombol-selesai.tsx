"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { tandaiSelesaiAction, type KartuDitandai } from "./actions";

/** Tombol "Tandai Selesai" + konfirmasi di dalam kartu (bukan pop-up browser). */
export function TombolSelesai({ kartu }: { kartu: KartuDitandai }) {
  const [tanya, setTanya] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [proses, mulai] = useTransition();

  if (!tanya) {
    return (
      <button
        type="button"
        onClick={() => {
          setGalat(null);
          setTanya(true);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50 active:scale-95"
      >
        <Check size={14} /> Tandai Selesai
      </button>
    );
  }

  return (
    <div className="mt-1 w-full rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-bold text-amber-900">Hilangkan kartu ini?</p>
      <p className="mt-0.5 text-[11px] leading-snug text-amber-800">
        Ini hanya menghilangkan kartu dari Pantau Tanaman. Data laporan LTT Anda tetap aman.
      </p>
      {galat && <p className="mt-1.5 text-[11px] font-semibold text-red-600">{galat}</p>}
      <div className="mt-2.5 flex justify-end gap-2">
        <button
          type="button"
          disabled={proses}
          onClick={() => setTanya(false)}
          className="h-8 rounded-lg border border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 transition hover:bg-gray-50 active:scale-95 disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="button"
          disabled={proses}
          onClick={() =>
            mulai(async () => {
              const r = await tandaiSelesaiAction(kartu).catch(() => ({ sukses: false, pesan: "Gagal menyimpan. Coba lagi." }));
              if (!r.sukses) setGalat(r.pesan);
            })
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-bold text-white transition hover:bg-amber-700 active:scale-95 disabled:opacity-60"
        >
          {proses && <Loader2 size={12} className="animate-spin" />} Ya, hilangkan
        </button>
      </div>
    </div>
  );
}
