"use client";

import { useTransition } from "react";
import { formatAngka } from "@/lib/format";
import { gagal, memuat, sukses } from "@/lib/swal";
import { simpanTargetKecamatanAction } from "../actions";

const kelasIn = "w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-medium outline-none focus:border-green-500";

/** Isian target satu (bulan, komoditas) — pilihan bulan & komoditas ada di URL. */
export function FormTargetKecamatan({ bulan, komoditas, tanam, panen }: { bulan: number; komoditas: string; tanam: number; panen: number }) {
  const [proses, mulai] = useTransition();
  return (
    <form
      key={`${bulan}-${komoditas}`}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("bulan", String(bulan));
        fd.set("komoditas", komoditas);
        mulai(async () => {
          memuat("Menyimpan target kecamatan...");
          const r = await simpanTargetKecamatanAction(fd);
          if (r.sukses) await sukses("Berhasil!", r.pesan);
          else await gagal("Gagal Menyimpan Target", r.pesan);
        });
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-gray-700">
          Target Tanam (Ha)
          <input name="targetTanam" inputMode="decimal" autoComplete="off" defaultValue={tanam ? formatAngka(tanam) : ""} placeholder="0,00" required className={`${kelasIn} mt-1`} />
        </label>
        <label className="text-xs font-semibold text-gray-700">
          Target Panen (Ha)
          <input name="targetPanen" inputMode="decimal" autoComplete="off" defaultValue={panen ? formatAngka(panen) : ""} placeholder="0,00" required className={`${kelasIn} mt-1`} />
        </label>
      </div>
      <button type="submit" disabled={proses} className="w-full rounded-xl bg-green-600 py-3 text-xs font-bold text-white shadow-md hover:bg-green-700 disabled:opacity-50">
        {proses ? "Menyimpan..." : "Simpan Target"}
      </button>
    </form>
  );
}
