import type { Metadata } from "next";
import Link from "next/link";
import Form from "next/form";
import { CalendarDays, Goal, Info, Sprout, Wheat } from "lucide-react";
import { SelectOtomatis } from "@/components/select-otomatis";
import { TombolMuatUlang } from "@/components/tombol-muat-ulang";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka } from "@/lib/format";
import { ambilTargetPmAasRinci, kodePeriode, periodeDariParam, ringkasanWilayah } from "@/lib/data";
import { Gauge } from "@/components/grafik";
import { teksParam, urlDengan, type CariParam } from "@/lib/param";
import { KotakLegendaPersen, levelPersen } from "@/components/tabel-ltt-provinsi";
import { FormTargetPmAas } from "./form-target";

export const metadata: Metadata = { title: "LTT PM AAS — SMART LTT" };

export default function HalamanPmAas({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="LTT PM AAS" role={["admin_kab", "viewer"]} gaya="kab">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

/** Sel Capaian % berwarna (<60 merah, 60–84,99 kuning, ≥85 hijau); tanpa target → "-" abu. */
function SelCapaian({ realisasi, t, tebal }: { realisasi: number; t: number; tebal?: boolean }) {
  if (t <= 0) return <td className="border border-gray-100 bg-gray-50 p-2 text-center text-gray-400">-</td>;
  const p = (realisasi / t) * 100;
  return <td className={`border border-gray-100 p-2 text-right ${tebal ? "font-extrabold" : "font-bold"} ${levelPersen(p).kelas}`}>{formatAngka(p)}%</td>;
}

/** Dashboard LTT PM AAS (Padi) — tampilan aplikasi lama, Server Component (gauge SVG). */
async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("admin_kab", "viewer");
  const q = await searchParams;
  const per = periodeDariParam(teksParam(q, "periode"), bulanTahunWIB());
  const s = await supabaseServer();
  const [r, tgt] = await Promise.all([ringkasanWilayah(s, per.tahun, per.bulan), ambilTargetPmAasRinci(s, per.tahun, per.bulan)]);
  const target = tgt.total;
  const adaTargetKec = tgt.perKec.size > 0;
  // Kecamatan tanpa target, tanam, dan panen PM AAS tidak ditampilkan di rekap.
  const barisRekap = r.baris.filter((b) => (tgt.perKec.get(b.id) ?? 0) > 0 || b.pmAas.tanam > 0 || b.pmAas.panen > 0);
  const judulPeriode = `${NAMA_BULAN[per.bulan - 1]} ${per.tahun}`;
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
        <Form action="/kab/pm-aas" scroll={false} className="flex items-center gap-2">
          <CalendarDays size={16} className="text-green-600" />
          <SelectOtomatis key={kodePeriode(per)} name="periode" defaultValue={kodePeriode(per)} className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm outline-none">
            {per.pilihan.slice(0, 5).map((x) => (
              <option key={kodePeriode(x)} value={kodePeriode(x)}>{NAMA_BULAN[x.bulan - 1]} {x.tahun}</option>
            ))}
          </SelectOtomatis>
          <TombolMuatUlang className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-600 hover:bg-blue-600 hover:text-white" />
        </Form>
      </div>

      {bukaSet && (
        <FormTargetPmAas
          tahun={per.tahun}
          bulan={per.bulan}
          judulPeriode={judulPeriode}
          baris={r.kecs.map((k) => ({ id: k.id, nama: k.nama, nilai: tgt.perKec.get(k.id) ?? 0 }))}
          kembali={urlDengan("/kab/pm-aas", q, { set: null })}
        />
      )}

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
                  {target > 0 && <p className="text-[10px] text-gray-400">{adaTargetKec ? `Jumlah ${tgt.perKec.size} kecamatan` : "Target kabupaten (tanpa rincian kecamatan)"}</p>}
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
        <p className="mb-4 text-[11px] text-gray-400">Periode: {judulPeriode}</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-[11px] font-bold text-gray-600 uppercase">
                <th rowSpan={2} className="border border-gray-100 bg-gray-50 p-2">No</th>
                <th rowSpan={2} className="sticky left-0 z-10 shadow-[2px_0_0_0_#f3f4f6] border border-gray-100 bg-gray-50 p-2 text-left">Kecamatan</th>
                <th colSpan={4} className="border border-gray-100 bg-green-50 p-2">PM AAS (Padi)</th>
              </tr>
              <tr className="text-[10px] font-bold text-gray-400 uppercase">
                <th className="border border-gray-100 p-2">Target (Ha)</th>
                <th className="border border-gray-100 p-2">Tanam (Ha)</th>
                <th className="border border-gray-100 p-2">Capaian</th>
                <th className="border border-gray-100 p-2">Panen (Ha)</th>
              </tr>
            </thead>
            <tbody>
              {barisRekap.length === 0 && (
                <tr>
                  <td colSpan={6} className="border border-gray-100 p-4 text-center text-gray-400">Belum ada target maupun realisasi PM AAS.</td>
                </tr>
              )}
              {barisRekap.map((b, i) => (
                <tr key={b.id} className="group hover:bg-gray-50">
                  <td className="border border-gray-100 p-2 text-center text-gray-500">{i + 1}</td>
                  <td className="sticky left-0 z-10 shadow-[2px_0_0_0_#f3f4f6] border border-gray-100 bg-white p-2 font-semibold whitespace-nowrap text-gray-700 group-hover:bg-gray-50">{b.nama}</td>
                  <td className={`border border-gray-100 p-2 text-right ${tgt.perKec.get(b.id) ? "font-bold text-blue-700" : "text-gray-300"}`}>{formatAngka(tgt.perKec.get(b.id) ?? 0)}</td>
                  <td className={`border border-gray-100 p-2 text-right ${b.pmAas.tanam ? "font-bold" : "text-gray-300"}`}>{formatAngka(b.pmAas.tanam)}</td>
                  <SelCapaian realisasi={b.pmAas.tanam} t={tgt.perKec.get(b.id) ?? 0} />
                  <td className={`border border-gray-100 p-2 text-right ${b.pmAas.panen ? "font-bold" : "text-gray-300"}`}>{formatAngka(b.pmAas.panen)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-yellow-50 font-bold text-yellow-800">
                <td className="border border-gray-100 p-2" />
                <td className="sticky left-0 z-10 shadow-[2px_0_0_0_#f3f4f6] border border-gray-100 bg-yellow-50 p-2 text-left uppercase">Jumlah</td>
                <td className="border border-gray-100 p-2 text-right">{formatAngka(target)}</td>
                <td className="border border-gray-100 p-2 text-right">{formatAngka(r.pmAas.tanam)}</td>
                <SelCapaian realisasi={r.pmAas.tanam} t={target} tebal />
                <td className="border border-gray-100 p-2 text-right">{formatAngka(r.pmAas.panen)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Legenda */}
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3 text-[11px] text-gray-600">
          <p className="mb-2 font-bold text-gray-700">Keterangan</p>
          <KotakLegendaPersen />
          <ul className="list-disc space-y-0.5 pl-4">
            <li><b>Capaian</b> = Tanam PM AAS ÷ Target (kesanggupan) tanam kecamatan bulan {judulPeriode} × 100%.</li>
            <li>Kecamatan yang target, tanam, dan panen PM AAS-nya 0 tidak ditampilkan{r.baris.length > barisRekap.length ? ` (${r.baris.length - barisRekap.length} kecamatan)` : ""}.</li>
            <li>Baris <b>Jumlah</b>: target kabupaten = jumlah target seluruh kecamatan.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
