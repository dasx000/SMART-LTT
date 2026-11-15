import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, CircleCheck, Download, Goal, Info, RotateCw, Sprout, Wheat } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka } from "@/lib/format";
import {
  KATEGORI, ambilTargetPmAas, kodePeriode, periodeDariParam, realisasiKategoriPerKecamatan, rekapDinas, ringkasanWilayah,
  targetKategoriPerKecamatan, type Kategori,
} from "@/lib/data";
import { Donut, Gauge, warnaCapaian } from "@/components/grafik";
import { TabDashboardKab } from "@/components/tab-dashboard-kab";
import { teksParam, urlDengan, type CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Smart Dashboard — SMART LTT" };

export default function HalamanKab({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Smart Dashboard" role={["admin_kab", "viewer"]} gaya="kab">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

const PILIH_CAPAIAN = ["Padi", "Jagung", "Ubi Kayu", "PM-AAS"] as const;

/**
 * Smart Dashboard — tampilan aplikasi lama (File_HTML_Admin.html), Server Component penuh:
 * angka, gauge, dan donut dirender di server (SVG), tidak ada JS/ApexCharts di browser.
 * Pilihan (periode, komoditas capaian, sisi & kategori target) ada di URL.
 */
async function Isi({ searchParams }: { searchParams: CariParam }) {
  await wajibRole("admin_kab", "viewer");
  const q = await searchParams;
  const per = periodeDariParam(teksParam(q, "periode"), bulanTahunWIB());
  const capaian = (PILIH_CAPAIAN as readonly string[]).includes(teksParam(q, "capaian") ?? "") ? (teksParam(q, "capaian") as (typeof PILIH_CAPAIAN)[number]) : "Padi";
  const sisi = teksParam(q, "sisi") === "panen" ? "panen" : "tanam";
  const kat = (KATEGORI.find((k) => k.kunci === teksParam(q, "kategori"))?.kunci ?? "LTTReguler") as Kategori;

  const s = await supabaseServer();
  const [r, targetKat, targetPmAas] = await Promise.all([
    ringkasanWilayah(s, per.tahun, per.bulan),
    targetKategoriPerKecamatan(s, per.bulan),
    ambilTargetPmAas(s, per.tahun, per.bulan),
  ]);
  const dinas = rekapDinas(r.kecs, r.laporan);
  const realKat = realisasiKategoriPerKecamatan(r.laporan);

  // Capaian kabupaten (gauge)
  const tgt = capaian === "PM-AAS" ? targetPmAas : r.target[capaian].tanam;
  const real = capaian === "PM-AAS" ? r.pmAas.tanam : r.total[capaian].tanam;
  const pct = tgt > 0 ? (real / tgt) * 100 : real > 0 ? 100 : 0;
  const sisa = tgt - real;
  const lnk = (ubah: Record<string, string | null>) => urlDengan("/kab", q, ubah);
  const qsUnduh = `bulan=${per.bulan}&tahun=${per.tahun}`;

  const kartu = (label: string, nilai: number, panen = false) => (
    <div className="flex items-center rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:p-5">
      <div className={`mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:mr-3 sm:h-10 sm:w-10 ${panen ? "bg-yellow-50 text-yellow-600" : "bg-blue-50 text-blue-600"}`}>
        {panen ? <Wheat size={18} /> : <Sprout size={18} />}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase sm:text-xs">{label}</p>
        <h3 className="text-base font-bold text-gray-800 sm:text-xl">{formatAngka(nilai)} Ha</h3>
      </div>
    </div>
  );

  return (
    <>
      <TabDashboardKab
        aktif="/kab"
        kanan={
          <form method="get" className="flex shrink-0 items-center gap-2">
            {capaian !== "Padi" && <input type="hidden" name="capaian" value={capaian} />}
            <CalendarDays size={16} className="text-green-600" />
            <select name="periode" defaultValue={kodePeriode(per)} className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm outline-none focus:border-green-500">
              {per.pilihan.slice(0, 5).map((p) => (
                <option key={kodePeriode(p)} value={kodePeriode(p)}>
                  {NAMA_BULAN[p.bulan - 1]} {p.tahun}
                </option>
              ))}
            </select>
            <button type="submit" title="Tampilkan" className="flex items-center rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs font-bold text-blue-600 shadow-sm transition hover:bg-blue-600 hover:text-white">
              <RotateCw size={14} />
            </button>
          </form>
        }
      />

      {/* KPI 8 kartu */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-6 lg:grid-cols-4">
        {kartu("Tanam Padi", r.total.Padi.tanam)}
        {kartu("Panen Padi", r.total.Padi.panen, true)}
        {kartu("Tanam Jagung", r.total.Jagung.tanam)}
        {kartu("Panen Jagung", r.total.Jagung.panen, true)}
        {kartu("Tanam Ubi Kayu", r.total["Ubi Kayu"].tanam)}
        {kartu("Panen Ubi Kayu", r.total["Ubi Kayu"].panen, true)}
        {kartu("Tanam PM-AAS", r.pmAas.tanam)}
        {kartu("Panen PM-AAS", r.pmAas.panen, true)}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:mb-8 lg:grid-cols-3">
        {/* Capaian target kabupaten */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Capaian Target Kabupaten</h3>
              <p className="text-[10px] text-gray-400">Total akumulasi luas tanam bulan ini</p>
            </div>
            <div className="flex rounded-lg border border-gray-100 bg-gray-50 p-1">
              {PILIH_CAPAIAN.map((c) => (
                <Link
                  key={c}
                  href={lnk({ capaian: c === "Padi" ? null : c })}
                  scroll={false}
                  className={`rounded-md px-3 py-1 text-xs font-bold transition ${capaian === c ? "bg-green-600 text-white shadow-sm" : "text-gray-500 hover:text-green-600"}`}
                >
                  {c}
                </Link>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
            <div className="flex justify-center">
              <Gauge persen={pct} />
            </div>
            <div className="space-y-3">
              <Kotak ikon={<Goal size={16} />} warna="border-blue-100 bg-blue-50/50 text-blue-600" label="Target Tanam" nilai={`${formatAngka(tgt)} Ha`} />
              <Kotak ikon={<Sprout size={16} />} warna="border-green-100 bg-green-50/50 text-green-600" label="Realisasi Tanam" nilai={`${formatAngka(real)} Ha`} />
              {sisa > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-[11px] font-bold text-yellow-700">
                  <Info size={12} /> Sisa Target: {formatAngka(sisa)} Ha
                </span>
              ) : sisa < 0 && tgt > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[11px] font-bold text-green-700">
                  <CircleCheck size={12} /> Melampaui: {formatAngka(-sisa)} Ha
                </span>
              ) : (
                tgt > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">
                    <CircleCheck size={12} /> Target Tercapai
                  </span>
                )
              )}
            </div>
          </div>
        </div>

        {/* Komposisi */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-gray-800">Komposisi Komoditas (Bulan Ini)</h3>
          <Donut
            data={[
              { label: "Padi", nilai: r.total.Padi.tanam, warna: "#3b82f6" },
              { label: "Jagung", nilai: r.total.Jagung.tanam, warna: "#eab308" },
              { label: "Ubi Kayu", nilai: r.total["Ubi Kayu"].tanam, warna: "#f97316" },
            ]}
          />
        </div>
      </div>

      {/* Rekap LTT format Dinas */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-800">Rekapitulasi Luas Tambah Tanam (LTT)</h3>
            <p className="text-[11px] text-gray-400">Periode: {NAMA_BULAN[per.bulan - 1]} {per.tahun}</p>
          </div>
          <a href={`/api/unduh/rekap-dinas?${qsUnduh}`} className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-xs font-bold text-white hover:bg-green-800">
            <Download size={14} /> Unduh Excel
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="text-[11px] font-bold text-gray-600 uppercase">
                <th rowSpan={2} className="border border-gray-100 bg-gray-50 p-2">No</th>
                <th rowSpan={2} className="border border-gray-100 bg-gray-50 p-2 text-left">Kecamatan</th>
                {[
                  ["Padi Reguler", "bg-green-50"],
                  ["Padi Gogo", "bg-gray-50"],
                  ["Jagung", "bg-yellow-50/60"],
                  ["Kedelai", "bg-gray-50"],
                  ["Ubi Kayu", "bg-orange-50/60"],
                ].map(([g, w]) => (
                  <th key={g} colSpan={2} className={`border border-gray-100 p-2 ${w}`}>{g}</th>
                ))}
              </tr>
              <tr className="text-[10px] font-bold text-gray-400 uppercase">
                {Array.from({ length: 5 }).flatMap((_, i) => [
                  <th key={`t${i}`} className="border border-gray-100 p-2">Tanam (Ha)</th>,
                  <th key={`p${i}`} className="border border-gray-100 p-2">Panen (Ha)</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {dinas.map((b, i) => (
                <tr key={b.kecamatan} className="hover:bg-gray-50">
                  <td className="border border-gray-100 p-2 text-center text-gray-500">{i + 1}</td>
                  <td className="border border-gray-100 p-2 font-semibold text-gray-700">{b.kecamatan}</td>
                  {[b.padiReguler, b.padiGogo, b.jagung, b.kedelai, b.ubiKayu].flatMap((t, j) => [
                    <Sel key={`t${j}`} n={t.tanam} />,
                    <Sel key={`p${j}`} n={t.panen} />,
                  ])}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-yellow-50 font-bold text-yellow-800">
                <td colSpan={2} className="border border-gray-100 p-2 text-center uppercase">Jumlah</td>
                {(["padiReguler", "padiGogo", "jagung", "kedelai", "ubiKayu"] as const).flatMap((k) => [
                  <td key={`t${k}`} className="border border-gray-100 p-2 text-right">{formatAngka(dinas.reduce((a, b) => a + b[k].tanam, 0))}</td>,
                  <td key={`p${k}`} className="border border-gray-100 p-2 text-right">{formatAngka(dinas.reduce((a, b) => a + b[k].panen, 0))}</td>,
                ])}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Target vs realisasi per kecamatan */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-800">Target vs Realisasi per Kecamatan</h3>
            <p className="text-[11px] text-gray-400">Sumber: realisasi bulan terpilih</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-gray-100 p-0.5">
              {(["tanam", "panen"] as const).map((x) => (
                <Link
                  key={x}
                  href={lnk({ sisi: x === "tanam" ? null : x })}
                  scroll={false}
                  className={`rounded-md px-3 py-1 text-xs font-bold capitalize ${sisi === x ? "bg-green-600 text-white" : "text-gray-500"}`}
                >
                  {x}
                </Link>
              ))}
            </div>
            {KATEGORI.map((k) => (
              <Link
                key={k.kunci}
                href={lnk({ kategori: k.kunci === "LTTReguler" ? null : k.kunci })}
                scroll={false}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold ${kat === k.kunci ? "border-green-600 bg-green-600 text-white" : "border-gray-200 text-gray-500 hover:border-green-400"}`}
              >
                {k.label}
              </Link>
            ))}
            <a href={`/api/unduh/target-realisasi?${qsUnduh}&kategori=${kat}&sisi=${sisi}`} className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-xs font-bold text-white hover:bg-green-800">
              <Download size={14} /> Unduh Excel
            </a>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-3 text-left">Kecamatan</th>
                <th className="p-3 text-center">Target (Ha)</th>
                <th className="p-3 text-center">Realisasi (Ha)</th>
                <th className="p-3 text-left">Capaian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {r.kecs.map((k) => {
                const t = targetKat.get(k.id)?.[kat][sisi] ?? 0;
                const v = realKat.get(k.id)?.[kat][sisi] ?? 0;
                return <BarisCapaian key={k.id} nama={k.nama} target={t} realisasi={v} />;
              })}
              {(() => {
                const t = r.kecs.reduce((a, k) => a + (targetKat.get(k.id)?.[kat][sisi] ?? 0), 0);
                const v = r.kecs.reduce((a, k) => a + (realKat.get(k.id)?.[kat][sisi] ?? 0), 0);
                return <BarisCapaian nama="Total Kabupaten" target={t} realisasi={v} total />;
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Kotak({ ikon, warna, label, nilai }: { ikon: ReactNode; warna: string; label: string; nilai: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${warna}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70">{ikon}</div>
      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase">{label}</p>
        <p className="text-sm font-bold text-gray-800">{nilai}</p>
      </div>
    </div>
  );
}

function Sel({ n }: { n: number }) {
  return <td className={`border border-gray-100 p-2 text-right ${n ? "font-bold text-gray-800" : "text-gray-300"}`}>{formatAngka(n)}</td>;
}

function BarisCapaian({ nama, target, realisasi, total }: { nama: string; target: number; realisasi: number; total?: boolean }) {
  const p = target > 0 ? Math.round((realisasi / target) * 100) : 0;
  const w = warnaCapaian(p);
  return (
    <tr className={total ? "bg-green-50 font-bold" : "hover:bg-gray-50"}>
      <td className={`p-3 ${total ? "text-gray-800" : "font-semibold text-gray-700"}`}>{nama}</td>
      <td className="p-3 text-center text-gray-700">{target > 0 ? formatAngka(target) : "-"}</td>
      <td className="p-3 text-center font-bold" style={{ color: target > 0 ? w : "#374151" }}>{formatAngka(realisasi)}</td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, p)}%`, background: w }} />
          </div>
          <span className="w-12 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold" style={{ background: `${w}22`, color: w }}>
            {target > 0 ? `${p}%` : "-"}
          </span>
        </div>
      </td>
    </tr>
  );
}
