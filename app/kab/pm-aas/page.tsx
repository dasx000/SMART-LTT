import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Goal, Info, RotateCw, Sprout, Wheat } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka } from "@/lib/format";
import { ambilTargetPmAas, kodePeriode, periodeDariParam, ringkasanWilayah } from "@/lib/data";
import { Gauge } from "@/components/grafik";
import { teksParam, urlDengan, type CariParam } from "@/lib/param";
import { FormTargetPmAas } from "./form-target";

export const metadata: Metadata = { title: "LTT PM AAS — SMART LTT" };

export default function HalamanPmAas({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="LTT PM AAS" role={["admin_kab", "viewer"]} gaya="kab">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

/** Dashboard LTT PM AAS (Padi) — tampilan aplikasi lama, Server Component (gauge SVG). */
async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("admin_kab", "viewer");
  const q = await searchParams;
  const per = periodeDariParam(teksParam(q, "periode"), bulanTahunWIB());
  const s = await supabaseServer();
  const [r, target] = await Promise.all([ringkasanWilayah(s, per.tahun, per.bulan), ambilTargetPmAas(s, per.tahun, per.bulan)]);
  const pct = target > 0 ? (r.pmAas.tanam / target) * 100 : 0;
  const sisa = target - r.pmAas.tanam;
  const bolehSet = p.role === "admin_kab";
  const bukaSet = bolehSet && teksParam(q, "set") === "1";

  // Rincian per metode penanaman (baris padi PM AAS)
  const perMetode = new Map<string, { tanam: number; panen: number }>();
  for (const l of r.laporan) {
    if (l.komoditas !== "Padi" || !l.metode?.toUpperCase().includes("PM AAS")) continue;
    const m = perMetode.get(l.metode) ?? { tanam: 0, panen: 0 };
    m.tanam += l.tanam;
    m.panen += l.panen;
    perMetode.set(l.metode, m);
  }

  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-3 border-b border-gray-200 pb-3 sm:flex-row sm:items-center">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
          <Sprout className="text-green-600" size={20} /> Dashboard LTT PM AAS (Padi)
        </h2>
        <form method="get" className="flex items-center gap-2">
          <CalendarDays size={16} className="text-green-600" />
          <select name="periode" defaultValue={kodePeriode(per)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm outline-none">
            {per.pilihan.slice(0, 5).map((x) => (
              <option key={kodePeriode(x)} value={kodePeriode(x)}>{NAMA_BULAN[x.bulan - 1]} {x.tahun}</option>
            ))}
          </select>
          <button type="submit" title="Tampilkan" className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-600 hover:bg-blue-600 hover:text-white">
            <RotateCw size={14} />
          </button>
        </form>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { label: "Total Tanam", n: r.pmAas.tanam, ikon: <Sprout size={18} />, warna: "bg-green-50 text-green-600" },
          { label: "Total Panen", n: r.pmAas.panen, ikon: <Wheat size={18} />, warna: "bg-yellow-50 text-yellow-600" },
        ].map((k) => (
          <div key={k.label} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">{k.label}</p>
              <p className="text-2xl font-bold text-gray-800">
                {formatAngka(k.n)} <span className="text-xs font-normal text-gray-500">Ha</span>
              </p>
            </div>
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${k.warna}`}>{k.ikon}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-sm font-bold text-gray-800">Capaian Target Kabupaten</h3>
            {bolehSet && (
              <Link href={urlDengan("/kab/pm-aas", q, { set: bukaSet ? null : "1" })} scroll={false} className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-600">
                <Goal size={12} /> Set Target
              </Link>
            )}
          </div>
          {bukaSet && <FormTargetPmAas tahun={per.tahun} bulan={per.bulan} nilai={target} kembali={urlDengan("/kab/pm-aas", q, { set: null })} />}
          <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
            <div className="flex justify-center">
              <Gauge persen={pct} label="Target Tercapai" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                <Goal size={16} className="text-blue-600" />
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Target Tanam</p>
                  <p className="text-sm font-bold text-gray-800">{formatAngka(target)} Ha</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50/50 p-3">
                <Sprout size={16} className="text-green-600" />
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Realisasi Tanam</p>
                  <p className="text-sm font-bold text-gray-800">{formatAngka(r.pmAas.tanam)} Ha</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-[11px] font-bold text-yellow-700">
                <Info size={12} /> {target <= 0 ? "Target belum diatur" : sisa >= 0 ? `Sisa Target: ${formatAngka(sisa)} Ha` : `Melampaui: ${formatAngka(-sisa)} Ha`}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 border-b border-gray-100 pb-3 text-sm font-bold text-gray-800">Rincian Per Metode Penanaman</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-2.5 text-left">Metode Penanaman</th>
                <th className="p-2.5 text-right">Luas Tanam (Ha)</th>
                <th className="p-2.5 text-right">Luas Panen (Ha)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {perMetode.size === 0 ? (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-gray-400">Belum ada data PM AAS.</td>
                </tr>
              ) : (
                [...perMetode].sort((a, b) => b[1].tanam - a[1].tanam).map(([m, v]) => (
                  <tr key={m}>
                    <td className="p-2.5 text-gray-700">{m}</td>
                    <td className="p-2.5 text-right font-bold text-green-600">{formatAngka(v.tanam)}</td>
                    <td className="p-2.5 text-right font-bold text-amber-600">{formatAngka(v.panen)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800">Rekapitulasi Luas Tambah Tanam (LTT) PM AAS</h3>
        <p className="mb-4 text-[11px] text-gray-400">Periode: {NAMA_BULAN[per.bulan - 1]} {per.tahun}</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-[11px] font-bold text-gray-600 uppercase">
                <th rowSpan={2} className="border border-gray-100 bg-gray-50 p-2">No</th>
                <th rowSpan={2} className="border border-gray-100 bg-gray-50 p-2 text-left">Kecamatan</th>
                <th colSpan={2} className="border border-gray-100 bg-green-50 p-2">PM AAS (Padi)</th>
              </tr>
              <tr className="text-[10px] font-bold text-gray-400 uppercase">
                <th className="border border-gray-100 p-2">Tanam (Ha)</th>
                <th className="border border-gray-100 p-2">Panen (Ha)</th>
              </tr>
            </thead>
            <tbody>
              {r.baris.map((b, i) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="border border-gray-100 p-2 text-center text-gray-500">{i + 1}</td>
                  <td className="border border-gray-100 p-2 font-semibold text-gray-700">{b.nama}</td>
                  <td className={`border border-gray-100 p-2 text-right ${b.pmAas.tanam ? "font-bold" : "text-gray-300"}`}>{formatAngka(b.pmAas.tanam)}</td>
                  <td className={`border border-gray-100 p-2 text-right ${b.pmAas.panen ? "font-bold" : "text-gray-300"}`}>{formatAngka(b.pmAas.panen)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-yellow-50 font-bold text-yellow-800">
                <td colSpan={2} className="border border-gray-100 p-2 text-center uppercase">Jumlah</td>
                <td className="border border-gray-100 p-2 text-right">{formatAngka(r.pmAas.tanam)}</td>
                <td className="border border-gray-100 p-2 text-right">{formatAngka(r.pmAas.panen)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
