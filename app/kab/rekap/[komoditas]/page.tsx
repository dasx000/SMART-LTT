import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileSpreadsheet, RotateCw, Sprout, Wheat } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { formatAngka, tanggalIsoWIB } from "@/lib/format";
import { ambilLaporan, daftarKecamatan, jenisPadi, rekapPerKecamatan, type Komoditas } from "@/lib/data";
import { TabDashboardKab } from "@/components/tab-dashboard-kab";
import { teksParam, urlDengan, type CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Rekap Harian — SMART LTT" };

const SLUG: Record<string, Komoditas> = { padi: "Padi", jagung: "Jagung", "ubi-kayu": "Ubi Kayu" };
type Props = { params: Promise<{ komoditas: string }>; searchParams: CariParam };
const tglOk = (v: string | null, def: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : def);

/** Tab Padi / Jagung / Ubi Kayu dashboard Kab (aplikasi lama): rekap per kecamatan rentang tanggal. */
export default function HalamanRekapKomoditas(props: Props) {
  return (
    <KerangkaHalaman judul="Smart Dashboard" role={["admin_kab", "viewer"]} gaya="kab">
      <Isi {...props} />
    </KerangkaHalaman>
  );
}

async function Isi({ params, searchParams }: Props) {
  await wajibRole("admin_kab", "viewer");
  const { komoditas: slug } = await params;
  const kom = SLUG[slug];
  if (!kom) notFound();
  const q = await searchParams;
  const hariIni = tanggalIsoWIB();
  const dari = tglOk(teksParam(q, "dari"), hariIni);
  const sampai = [tglOk(teksParam(q, "sampai"), dari), dari].sort()[1];
  const isPadi = kom === "Padi";
  const jenis = isPadi ? teksParam(q, "jenisLtt") : null;

  const s = await supabaseServer();
  const kecs = await daftarKecamatan(s);
  const akhir = new Date(`${sampai}T00:00:00+07:00`);
  akhir.setUTCDate(akhir.getUTCDate() + 1);
  const [daftarJenis, lap] = await Promise.all([
    isPadi ? jenisPadi(s) : Promise.resolve([]),
    ambilLaporan(s, { dari: `${dari}T00:00:00+07:00`, sampai: `${tanggalIsoWIB(akhir)}T00:00:00+07:00`, komoditas: kom }, kecs),
  ]);
  const r = rekapPerKecamatan(kecs, lap, kom, jenis);
  const unduh = urlDengan("/api/unduh/rekap-kecamatan", {}, { dari, sampai, komoditas: kom, jenisLtt: jenis });
  const kelasIn = "rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-green-500";

  return (
    <>
      <TabDashboardKab aktif={`/kab/rekap/${slug}`} />

      <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-lg font-bold text-gray-800">{isPadi ? "Rekap Padi Harian (e-Pusluh)" : `Rekap ${kom} Harian`}</h2>
          <p className="text-[11px] text-gray-500">Data harian laporan petugas lapangan.</p>
        </div>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="date" name="dari" defaultValue={dari} max={hariIni} className={kelasIn} />
          <span className="text-gray-400">-</span>
          <input type="date" name="sampai" defaultValue={sampai} max={hariIni} className={kelasIn} />
          {isPadi && (
            <select name="jenisLtt" defaultValue={jenis ?? ""} className={kelasIn}>
              <option value="">Semua Jenis LTT</option>
              {daftarJenis.map((j) => (
                <option key={j.id} value={j.nama}>{j.nama}</option>
              ))}
            </select>
          )}
          <a href={unduh} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
            <FileSpreadsheet size={14} /> Excel
          </a>
          <button type="submit" title="Tampilkan" className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50">
            <RotateCw size={14} />
          </button>
        </form>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { label: "Luas Tanam", n: r.totalTanam, ikon: <Sprout size={18} />, warna: "bg-blue-50 text-blue-600" },
          { label: "Luas Panen", n: r.totalPanen, ikon: <Wheat size={18} />, warna: "bg-yellow-50 text-yellow-600" },
        ].map((k) => (
          <div key={k.label} className="flex items-center rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className={`mr-3 flex h-10 w-10 items-center justify-center rounded-lg ${k.warna}`}>{k.ikon}</div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">{k.label}</p>
              <p className="text-xl font-bold text-gray-800">
                {formatAngka(k.n)} <span className="text-xs font-normal text-gray-500">Ha</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <h3 className="text-sm font-bold text-gray-800">Rekap per Kecamatan</h3>
          <p className="text-[11px] text-gray-400">Akumulasi seluruh desa dalam kecamatan</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-3 text-left">Kecamatan</th>
                {isPadi && <th className="p-3 text-left">Jenis LTT</th>}
                <th className="p-3 text-right">Tanam (Ha)</th>
                <th className="p-3 text-right">Panen (Ha)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {r.baris.map((b, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold text-gray-700">{b.kecamatan}</td>
                  {isPadi && <td className="p-3 text-gray-500">{b.jenis}</td>}
                  <td className={`p-3 text-right ${b.tanam ? "font-bold text-gray-800" : "text-gray-300"}`}>{formatAngka(b.tanam)}</td>
                  <td className={`p-3 text-right ${b.panen ? "font-bold text-gray-800" : "text-gray-300"}`}>{formatAngka(b.panen)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-green-50 font-bold text-gray-800">
                <td className="p-3" colSpan={isPadi ? 2 : 1}>TOTAL KABUPATEN</td>
                <td className="p-3 text-right">{formatAngka(r.totalTanam)}</td>
                <td className="p-3 text-right">{formatAngka(r.totalPanen)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
