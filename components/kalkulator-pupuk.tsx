"use client";

import { useState } from "react";
import { FlaskConical, Info } from "lucide-react";
import { KOMODITAS_PUPUK, hitungTotalPerJenis } from "@/app/ppl/pupuk/data";
import { formatAngka, parseDesimal } from "@/lib/format";

/** Kalkulator Pupuk (porting dari TANIKU pupuk-calculator.tsx), tema SMART LTT. Hitung di browser, tanpa data server. */

const kelasInput =
  "h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-800 outline-none focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20";

const AWAL = KOMODITAS_PUPUK.find((k) => k.id === "padi") ?? KOMODITAS_PUPUK[0];

export function KalkulatorPupuk() {
  const [komoditasId, setKomoditasId] = useState(AWAL.id);
  const [luasTeks, setLuasTeks] = useState("1");

  const kom = KOMODITAS_PUPUK.find((k) => k.id === komoditasId) ?? AWAL;
  const luasMentah = parseDesimal(luasTeks);
  const luas = Number.isFinite(luasMentah) && luasMentah > 0 ? luasMentah : 0;
  const kg = (n: number) => `${formatAngka(n, 1)} kg`;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-gray-600">Komoditas</span>
          <select value={komoditasId} onChange={(e) => setKomoditasId(e.target.value)} className={kelasInput}>
            {KOMODITAS_PUPUK.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-gray-600">Luas lahan (ha)</span>
          <input
            type="text"
            inputMode="decimal"
            value={luasTeks}
            onChange={(e) => setLuasTeks(e.target.value)}
            placeholder="Contoh: 0,5"
            className={kelasInput}
          />
        </label>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-bold text-gray-800">Dosis Pupuk {kom.nama}</h3>
          <p className="text-xs text-gray-500">Untuk luas lahan {formatAngka(luas)} ha</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center">
            <thead className="bg-green-700">
              <tr>
                <th className="p-2 text-left text-[10px] font-bold tracking-wider text-white uppercase">Waktu</th>
                {kom.jenisPupuk.map((j) => (
                  <th key={j} className="p-2 text-[10px] font-bold tracking-wider text-white uppercase">
                    {j}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kom.jadwal.map((r, i) => (
                <tr key={r.waktu} className={i % 2 ? "bg-green-50/60" : "bg-white"}>
                  <td className="p-2 text-left text-[11px] font-semibold text-gray-800">
                    {r.waktu}
                    {r.keterangan && <span className="block text-[10px] font-normal text-gray-500">{r.keterangan}</span>}
                  </td>
                  {kom.jenisPupuk.map((j) => {
                    const d = r.dosisPerHaKg[j];
                    return (
                      <td key={j} className="p-2 text-[11px] text-gray-700">
                        {d == null ? <span className="text-gray-300">—</span> : kg(d * luas)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-green-200 bg-green-50">
                <td className="p-2 text-left text-[11px] font-extrabold text-green-800">Jumlah</td>
                {kom.jenisPupuk.map((j) => (
                  <td key={j} className="p-2 text-[11px] font-extrabold text-green-800">
                    {kg(hitungTotalPerJenis(kom, j) * luas)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-gray-800">Total Kebutuhan Pupuk</h3>
        <div className="space-y-2">
          {kom.jenisPupuk.map((j) => (
            <div key={j} className="flex items-center justify-between rounded-xl border border-green-100 bg-green-50 px-4 py-3">
              <span className="flex items-center gap-3 text-sm font-semibold text-gray-800">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <FlaskConical size={16} />
                </span>
                {j}
              </span>
              <span className="text-sm font-extrabold text-green-800">{kg(hitungTotalPerJenis(kom, j) * luas)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="flex gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-500">
        <Info size={14} className="mt-0.5 shrink-0" />
        <p>Sumber: panduan dosis pupuk bersubsidi PT Pupuk Indonesia. HST = hari setelah tanam.</p>
      </div>
    </div>
  );
}
