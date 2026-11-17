"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { formatAngka } from "@/lib/format";

export type KomoditasInfo = "Padi" | "Jagung" | "Ubi Kayu";

export type BarisProduktivitasKec = {
  id: number;
  nama: string;
  /** Rata-rata desa > 0 (ton/ha) per komoditas; 0 = belum ada data. */
  rata: Record<KomoditasInfo, number>;
  /** Jumlah desa yang mengisi (> 0) per komoditas. */
  desaIsi: Record<KomoditasInfo, number>;
};

const WARNA: Record<KomoditasInfo, { batang: string; aktif: string }> = {
  Padi: { batang: "#16a34a", aktif: "bg-green-600 text-white" },
  Jagung: { batang: "#ca8a04", aktif: "bg-yellow-600 text-white" },
  "Ubi Kayu": { batang: "#9a3412", aktif: "bg-orange-800 text-white" },
};

const MEDALI = ["bg-yellow-400 text-yellow-950", "bg-gray-300 text-gray-800", "bg-amber-600 text-white"];

/** Infografis peringkat produktivitas per kecamatan: tab per komoditas, batang horizontal terurut, garis rata-rata kabupaten. */
export function InfografisProduktivitas({
  baris,
  rataKab,
  komoditas,
  periode,
}: {
  baris: BarisProduktivitasKec[];
  /** Rata-rata kabupaten = rata-rata semua desa > 0, per komoditas. */
  rataKab: Record<KomoditasInfo, number>;
  komoditas: KomoditasInfo[];
  periode: string;
}) {
  const [kom, setKom] = useState<KomoditasInfo>(komoditas[0]);
  const ada = baris.filter((b) => b.rata[kom] > 0).sort((a, b) => b.rata[kom] - a.rata[kom] || a.nama.localeCompare(b.nama));
  const kosong = baris.filter((b) => !(b.rata[kom] > 0));
  const maks = Math.max(0, ...ada.map((b) => b.rata[kom]));
  const rk = rataKab[kom];
  const posRata = maks > 0 ? (rk / maks) * 100 : 0;
  const w = WARNA[kom];

  return (
    <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-gray-800">
            <Trophy size={16} className="text-yellow-500" /> Peringkat Produktivitas Kecamatan
          </h3>
          <p className="text-[11px] text-gray-400">
            {periode} · ton/ha · rata-rata kabupaten {rk > 0 ? <b className="text-gray-600">{formatAngka(rk)}</b> : "–"}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {komoditas.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKom(k)}
              className={`rounded-md px-3 py-1 text-xs font-bold transition ${k === kom ? WARNA[k].aktif : "text-gray-600 hover:bg-white"}`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {ada.length === 0 ? (
        <p className="rounded-lg bg-gray-50 px-2 py-6 text-center text-xs text-gray-400">Belum ada data {kom} pada periode ini.</p>
      ) : (
        <div className="space-y-0.5">
          {ada.map((b, i) => {
            const lebar = maks > 0 ? Math.max(2, (b.rata[kom] / maks) * 100) : 0;
            const diAtas = b.rata[kom] >= rk;
            return (
              <div
                key={b.id}
                title={`${b.nama}: ${formatAngka(b.rata[kom])} ton/ha (rata-rata ${b.desaIsi[kom]} desa)`}
                className="grid grid-cols-[1.75rem_6.5rem_1fr_4.5rem] items-center gap-2 rounded px-1 py-1 text-xs hover:bg-gray-50 sm:grid-cols-[1.75rem_9rem_1fr_7rem]"
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${i < 3 ? MEDALI[i] : "text-gray-400"}`}
                >
                  {i + 1}
                </span>
                <span className={`truncate ${i < 3 ? "font-bold text-gray-800" : "text-gray-600"}`}>{b.nama}</span>
                <span className="relative h-3.5 rounded-r bg-gray-100">
                  <span
                    className="block h-3.5 rounded-r"
                    style={{ width: `${lebar}%`, background: w.batang, opacity: diAtas ? 1 : 0.55 }}
                  />
                  {rk > 0 && (
                    <span
                      className="absolute -top-1 -bottom-1 w-0 border-l-2 border-dashed border-gray-500"
                      style={{ left: `${posRata}%` }}
                    />
                  )}
                </span>
                <span className="text-right font-semibold text-gray-700 tabular-nums">
                  {formatAngka(b.rata[kom])}
                  <span className="ml-1 hidden text-[10px] font-normal text-gray-400 sm:inline">({b.desaIsi[kom]} desa)</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-2 text-[10px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-0 border-l-2 border-dashed border-gray-500" /> rata-rata kabupaten
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: w.batang, opacity: 0.55 }} /> di bawah rata-rata
        </span>
        {kosong.length > 0 && (
          <span>
            Belum ada data: <span className="text-gray-400">{kosong.map((b) => b.nama).join(", ")}</span>
          </span>
        )}
      </div>
    </div>
  );
}
