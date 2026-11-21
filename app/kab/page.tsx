import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Form from "next/form";
import { SelectOtomatis } from "@/components/select-otomatis";
import { CalendarDays, CircleCheck, Goal, Info, Sprout, Wheat } from "lucide-react";
import { TombolUnduh } from "@/components/tombol-unduh";
import { TombolMuatUlang } from "@/components/tombol-muat-ulang";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka } from "@/lib/format";
import {
  KOLOM_DINAS, ambilTargetPmAas, kodePeriode, padiPerJenis, periodeDariParam, rekapDinas, rekapProvinsiPadi, ringkasanWilayah,
} from "@/lib/data";
import { KartuRincianJenis } from "@/components/kartu-rincian-jenis";
import { TabelLttProvinsi } from "@/components/tabel-ltt-provinsi";
import { Donut, Gauge } from "@/components/grafik";
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
const KELAS_UNDUH = "flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-xs font-bold text-white hover:bg-green-800";
const WARNA_DINAS: Record<(typeof KOLOM_DINAS)[number]["kunci"], string> = {
  padiReguler: "bg-green-50",
  padiGogo: "bg-gray-50",
  oplah2026: "bg-emerald-50/60",
  jagung: "bg-yellow-50/60",
  ubiKayu: "bg-orange-50/60",
};

/**
 * Smart Dashboard — tampilan aplikasi lama (File_HTML_Admin.html), Server Component penuh:
 * angka, gauge, dan donut dirender di server (SVG), tidak ada JS/ApexCharts di browser.
 * Pilihan (periode, komoditas capaian) ada di URL.
 */
async function Isi({ searchParams }: { searchParams: CariParam }) {
  await wajibRole("admin_kab", "viewer");
  const q = await searchParams;
  const per = periodeDariParam(teksParam(q, "periode"), bulanTahunWIB());
  const capaian = (PILIH_CAPAIAN as readonly string[]).includes(teksParam(q, "capaian") ?? "") ? (teksParam(q, "capaian") as (typeof PILIH_CAPAIAN)[number]) : "Padi";

  const s = await supabaseServer();
  const [r, targetPmAas, prov] = await Promise.all([
    ringkasanWilayah(s, per.tahun, per.bulan),
    ambilTargetPmAas(s, per.tahun, per.bulan),
    rekapProvinsiPadi(s, per.tahun, per.bulan),
  ]);
  const dinas = rekapDinas(r.kecs, r.laporan);
  const padiJenis = padiPerJenis(r.laporan);

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
          <Form action="/kab" scroll={false} className="flex shrink-0 items-center gap-2">
            {capaian !== "Padi" && <input type="hidden" name="capaian" value={capaian} />}
            <CalendarDays size={16} className="text-green-600" />
            <SelectOtomatis key={kodePeriode(per)} name="periode" defaultValue={kodePeriode(per)} className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm outline-none focus:border-green-500">
              {per.pilihan.slice(0, 5).map((p) => (
                <option key={kodePeriode(p)} value={kodePeriode(p)}>
                  {NAMA_BULAN[p.bulan - 1]} {p.tahun}
                </option>
              ))}
            </SelectOtomatis>
            <TombolMuatUlang className="flex items-center rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs font-bold text-blue-600 shadow-sm transition hover:bg-blue-600 hover:text-white" />
          </Form>
        }
      />

      {/* KPI 8 kartu */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-6 lg:grid-cols-4">
        <KartuRincianJenis
          label="Tanam Padi"
          nilai={r.total.Padi.tanam}
          ikon={<Sprout size={18} />}
          warnaIkon="bg-blue-50 text-blue-600"
          rincian={padiJenis.map((j) => ({ jenis: j.jenis, nilai: j.tanam }))}
        />
        <KartuRincianJenis
          label="Panen Padi"
          nilai={r.total.Padi.panen}
          ikon={<Wheat size={18} />}
          warnaIkon="bg-yellow-50 text-yellow-600"
          rincian={padiJenis.map((j) => ({ jenis: j.jenis, nilai: j.panen }))}
        />
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
          <TombolUnduh href={`/api/unduh/rekap-dinas?${qsUnduh}`} className={KELAS_UNDUH} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="text-[11px] font-bold text-gray-600 uppercase">
                <th rowSpan={2} className="border border-gray-100 bg-gray-50 p-2">No</th>
                <th rowSpan={2} className="sticky left-0 z-10 border border-gray-100 bg-gray-50 p-2 text-left shadow-[2px_0_0_0_#f3f4f6]">Kecamatan</th>
                {KOLOM_DINAS.map((g) => (
                  <th key={g.kunci} colSpan={2} className={`border border-gray-100 p-2 ${WARNA_DINAS[g.kunci]}`}>{g.label}</th>
                ))}
              </tr>
              <tr className="text-[10px] font-bold text-gray-400 uppercase">
                {KOLOM_DINAS.flatMap((_, i) => [
                  <th key={`t${i}`} className="border border-gray-100 p-2">Tanam (Ha)</th>,
                  <th key={`p${i}`} className="border border-gray-100 p-2">Panen (Ha)</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {dinas.map((b, i) => (
                <tr key={b.kecamatan} className="group hover:bg-gray-50">
                  <td className="border border-gray-100 p-2 text-center text-gray-500">{i + 1}</td>
                  <td className="sticky left-0 z-10 border border-gray-100 bg-white p-2 font-semibold whitespace-nowrap text-gray-700 shadow-[2px_0_0_0_#f3f4f6] group-hover:bg-gray-50">{b.kecamatan}</td>
                  {KOLOM_DINAS.flatMap(({ kunci }) => [
                    <Sel key={`t${kunci}`} n={b[kunci].tanam} />,
                    <Sel key={`p${kunci}`} n={b[kunci].panen} />,
                  ])}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-yellow-50 font-bold text-yellow-800">
                <td className="border border-gray-100 p-2" />
                <td className="sticky left-0 z-10 border border-gray-100 bg-yellow-50 p-2 text-left uppercase shadow-[2px_0_0_0_#f3f4f6]">Jumlah</td>
                {KOLOM_DINAS.map((g) => g.kunci).flatMap((k) => [
                  <td key={`t${k}`} className="border border-gray-100 p-2 text-right">{formatAngka(dinas.reduce((a, b) => a + b[k].tanam, 0))}</td>,
                  <td key={`p${k}`} className="border border-gray-100 p-2 text-right">{formatAngka(dinas.reduce((a, b) => a + b[k].panen, 0))}</td>,
                ])}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* LTT Padi format Provinsi — bulan terpilih (1 s.d hari ini / akhir bulan) */}
      <TabelLttProvinsi data={prov} />
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
