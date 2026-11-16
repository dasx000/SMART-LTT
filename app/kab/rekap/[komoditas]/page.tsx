import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileSpreadsheet, Sprout, Wheat } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { formatAngka, tanggalIsoWIB } from "@/lib/format";
import { ambilLaporan, daftarKecamatan, jenisPadi, padiPerJenis, rekapPerKecamatan, type Komoditas } from "@/lib/data";
import { KartuRincianJenis } from "@/components/kartu-rincian-jenis";
import { FilterRentangTanggal } from "@/components/filter-rentang-tanggal";
import { TombolUnduh } from "@/components/tombol-unduh";
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
  // Validasi server: tidak melewati hari ini, dan dari ≤ sampai (URL bisa diketik manual).
  const batas = (v: string) => (v > hariIni ? hariIni : v);
  const dari = batas(tglOk(teksParam(q, "dari"), hariIni));
  const sampai = batas([tglOk(teksParam(q, "sampai"), dari), dari].sort()[1]);
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
  const padiJenis = isPadi ? padiPerJenis(jenis ? lap.filter((l) => l.jenis === jenis) : lap) : [];
  const unduh = urlDengan("/api/unduh/rekap-kecamatan", {}, { dari, sampai, komoditas: kom, jenisLtt: jenis });

  return (
    <>
      <TabDashboardKab aktif={`/kab/rekap/${slug}`} />

      <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-lg font-bold text-gray-800">{isPadi ? "Rekap Padi Harian (e-Pusluh)" : `Rekap ${kom} Harian`}</h2>
          <p className="text-[11px] text-gray-500">Data harian laporan petugas lapangan.</p>
        </div>
        <FilterRentangTanggal
          dari={dari}
          sampai={sampai}
          hariIni={hariIni}
          jenis={jenis}
          daftarJenis={isPadi ? daftarJenis.map((j) => j.nama) : undefined}
          sisipan={
            <TombolUnduh href={unduh} label="Excel" ikon={<FileSpreadsheet size={14} />} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700" />
          }
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {isPadi ? (
          <>
            <KartuRincianJenis
              besar
              label="Luas Tanam"
              nilai={r.totalTanam}
              ikon={<Sprout size={18} />}
              warnaIkon="bg-blue-50 text-blue-600"
              rincian={padiJenis.map((j) => ({ jenis: j.jenis, nilai: j.tanam }))}
            />
            <KartuRincianJenis
              besar
              label="Luas Panen"
              nilai={r.totalPanen}
              ikon={<Wheat size={18} />}
              warnaIkon="bg-yellow-50 text-yellow-600"
              rincian={padiJenis.map((j) => ({ jenis: j.jenis, nilai: j.panen }))}
            />
          </>
        ) : [
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
                {isPadi && <th className="p-3 text-left">Metode Penanaman</th>}
                <th className="p-3 text-right">Tanam (Ha)</th>
                <th className="p-3 text-right">Panen (Ha)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {r.baris.map((b, i) => {
                // Kecamatan dengan beberapa baris (jenis/metode berbeda) → nama ditulis sekali (rowspan).
                const awal = i === 0 || r.baris[i - 1].kecamatan !== b.kecamatan;
                const rentang = awal ? r.baris.slice(i).findIndex((x) => x.kecamatan !== b.kecamatan) : 0;
                const jml = rentang === -1 ? r.baris.length - i : rentang;
                return (
                <tr key={i} className={`hover:bg-gray-50 ${awal ? "border-t border-gray-200" : ""}`}>
                  {awal && (
                    <td rowSpan={jml} className="border-r border-gray-100 bg-white p-3 align-top font-semibold text-gray-700">{b.kecamatan}</td>
                  )}
                  {isPadi && <td className="p-3 text-gray-500">{b.jenis}</td>}
                  {isPadi && (
                    <td className="p-3">
                      {b.metode === "-" ? (
                        <span className="text-gray-300">-</span>
                      ) : (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            b.metode === "PM-AAS" ? "bg-violet-100 text-violet-700" : b.metode === "Reguler" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {b.metode}
                        </span>
                      )}
                    </td>
                  )}
                  <td className={`p-3 text-right ${b.tanam ? "font-bold text-gray-800" : "text-gray-300"}`}>{formatAngka(b.tanam)}</td>
                  <td className={`p-3 text-right ${b.panen ? "font-bold text-gray-800" : "text-gray-300"}`}>{formatAngka(b.panen)}</td>
                </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-green-50 font-bold text-gray-800">
                <td className="p-3" colSpan={isPadi ? 3 : 1}>TOTAL KABUPATEN</td>
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
