"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { angkaIsian, formatAngka, parseDesimal } from "@/lib/format";
import { gagal, memuat, sukses } from "@/lib/swal";
import { simpanTargetPmAasAction } from "./actions";

type Baris = { id: number; nama: string; nilai: number };

/** Form "Set Target" PM AAS per kecamatan — dibuka lewat URL (?set=1). Total kabupaten = jumlah kecamatan. */
export function FormTargetPmAas({ tahun, bulan, judulPeriode, baris, kembali }: { tahun: number; bulan: number; judulPeriode: string; baris: Baris[]; kembali: string }) {
  const router = useRouter();
  const [proses, mulai] = useTransition();
  const [isi, setIsi] = useState<Record<number, string>>(() => Object.fromEntries(baris.map((b) => [b.id, angkaIsian(b.nilai)])));
  const total = baris.reduce((a, b) => a + (parseDesimal(isi[b.id] ?? "") || 0), 0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("tahun", String(tahun));
        fd.set("bulan", String(bulan));
        mulai(async () => {
          memuat("Menyimpan target...");
          const r = await simpanTargetPmAasAction(fd);
          if (r.sukses) {
            await sukses("Berhasil!", r.pesan);
            router.replace(kembali, { scroll: false });
          } else await gagal("Gagal", r.pesan);
        });
      }}
      className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/50 p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Target (Kesanggupan) Tanam PM AAS per Kecamatan</h3>
          <p className="text-[11px] text-gray-500">Periode {judulPeriode} · kosongkan bila kecamatan tidak punya target.</p>
        </div>
        <p className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm">Total Kabupaten: {formatAngka(total)} Ha</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {baris.map((b) => (
          <label key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs font-semibold text-gray-700">
            <span className="truncate">{b.nama}</span>
            <span className="flex items-center gap-1">
              <input
                name={`kec_${b.id}`}
                inputMode="decimal"
                autoComplete="off"
                value={isi[b.id] ?? ""}
                onChange={(e) => setIsi((x) => ({ ...x, [b.id]: e.target.value }))}
                placeholder="0"
                className="w-24 rounded-md border border-gray-200 px-2 py-1 text-right text-sm outline-none focus:border-green-500"
              />
              <span className="text-[10px] text-gray-400">Ha</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Link href={kembali} scroll={false} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-500">
          Batal
        </Link>
        <button type="submit" disabled={proses} className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
          Simpan
        </button>
      </div>
    </form>
  );
}
