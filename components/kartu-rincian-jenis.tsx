"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { formatAngka } from "@/lib/format";

/**
 * Kartu KPI yang bisa diklik → modal rincian luas per jenis LTT (LTT Reguler, Padi Gogo, Oplah 2025, …).
 * Jenis bernilai 0 tidak ditampilkan.
 */
export function KartuRincianJenis({
  label,
  nilai,
  ikon,
  warnaIkon,
  rincian,
  besar = false,
}: {
  label: string;
  nilai: number;
  ikon: ReactNode;
  warnaIkon: string;
  rincian: { jenis: string; nilai: number }[];
  besar?: boolean;
}) {
  const [buka, setBuka] = useState(false);
  const isi = rincian.filter((r) => r.nilai > 0).sort((a, b) => b.nilai - a.nilai);

  useEffect(() => {
    if (!buka) return;
    const tutup = (e: KeyboardEvent) => e.key === "Escape" && setBuka(false);
    window.addEventListener("keydown", tutup);
    return () => window.removeEventListener("keydown", tutup);
  }, [buka]);

  return (
    <>
      <button
        type="button"
        onClick={() => setBuka(true)}
        title="Lihat rincian per jenis LTT"
        className={`flex w-full cursor-pointer items-center rounded-xl border border-gray-100 bg-white text-left shadow-sm transition hover:border-green-300 hover:shadow-md ${besar ? "p-5" : "p-3 sm:p-5"}`}
      >
        <div className={`flex shrink-0 items-center justify-center rounded-lg ${warnaIkon} ${besar ? "mr-3 h-10 w-10" : "mr-2 h-8 w-8 sm:mr-3 sm:h-10 sm:w-10"}`}>{ikon}</div>
        <div className="min-w-0">
          <p className={`font-bold text-gray-400 uppercase ${besar ? "text-[10px]" : "text-[10px] sm:text-xs"}`}>{label}</p>
          <p className={`font-bold text-gray-800 ${besar ? "text-xl" : "text-base sm:text-xl"}`}>
            {formatAngka(nilai)} <span className={besar ? "text-xs font-normal text-gray-500" : ""}>Ha</span>
          </p>
        </div>
      </button>

      {buka && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setBuka(false)}>
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${warnaIkon}`}>{ikon}</div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{label}</p>
                  <p className="text-xl font-bold text-gray-800">
                    {formatAngka(nilai)} <span className="text-xs font-normal text-gray-500">Ha</span>
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setBuka(false)} aria-label="Tutup" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="mb-2 text-[10px] font-bold text-gray-400 uppercase">Rincian per Jenis LTT</p>
            {isi.length === 0 ? (
              <p className="text-xs text-gray-400">Belum ada data.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {isi.map((r) => (
                  <li key={r.jenis} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <span className="text-gray-600">{r.jenis}</span>
                    <span className="font-bold whitespace-nowrap text-gray-800">{formatAngka(r.nilai)} Ha</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
