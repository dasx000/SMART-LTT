import type { Metadata } from "next";
import { ChevronRight, FileSpreadsheet, Scale } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { TombolUnduh } from "@/components/tombol-unduh";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka } from "@/lib/format";
import { KOMODITAS, ambilProduktivitas, daftarDesa, daftarKecamatan, rataPositif, tahunProduktivitas } from "@/lib/data";
import { angkaParam, type CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Produktivitas — SMART LTT" };

export default function HalamanProduktivitasKab({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Produktivitas" role={["admin_kab"]} gaya="kab">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

const pilih = "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 outline-none";
const kolom = "grid grid-cols-[1fr_6rem_6rem_6rem] items-center gap-2 sm:grid-cols-[1fr_10rem_10rem_10rem]";

/** Produktivitas (aplikasi lama): baris kecamatan = rata-rata desa > 0, klik untuk melihat desa. Tanpa JS (<details>). */
async function Isi({ searchParams }: { searchParams: CariParam }) {
  await wajibRole("admin_kab");
  const q = await searchParams;
  const now = bulanTahunWIB();
  const tahun = angkaParam(q, "tahun", 2000, 2100, now.tahun);
  const bulan = angkaParam(q, "bulan", 1, 12, now.bulan);
  const s = await supabaseServer();
  const [kecs, desa, nilai, daftarTahun] = await Promise.all([daftarKecamatan(s), daftarDesa(s), ambilProduktivitas(s, tahun), tahunProduktivitas(s, now.tahun)]);
  const v = (desaId: number, k: string) => (nilai.get(`${desaId}|${k}`) ?? [])[bulan - 1] ?? 0;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 pb-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <Scale className="text-green-600" size={20} /> Produktivitas
          </h2>
          <p className="text-[11px] text-gray-500">Satuan ton/ha, diisi PPL per desa. Nilai kecamatan = rata-rata desa &gt; 0. Klik kecamatan untuk melihat desa.</p>
        </div>
        <form method="get" className="flex items-center gap-2">
          <select name="tahun" defaultValue={tahun} className={pilih}>
            {daftarTahun.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select name="bulan" defaultValue={bulan} className={pilih}>
            {NAMA_BULAN.map((n, i) => (
              <option key={n} value={i + 1}>{n}</option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white">Tampilkan</button>
          <TombolUnduh href={`/api/unduh/produktivitas?tahunDari=${tahun}&tahunSampai=${tahun}`} ikon={<FileSpreadsheet size={14} />} className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-bold text-white" />
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className={`${kolom} bg-gray-50 px-3 py-3 text-[11px] font-bold text-gray-500 uppercase`}>
          <span>Kecamatan</span>
          {KOMODITAS.map((k) => (
            <span key={k} className="text-right">{k}</span>
          ))}
        </div>
        {kecs.map((kec) => {
          const dk = desa.filter((d) => d.kecamatan_id === kec.id);
          return (
            <details key={kec.id} className="group border-t border-gray-100">
              <summary className={`${kolom} cursor-pointer list-none px-3 py-3 text-sm hover:bg-gray-50`}>
                <span className="flex items-center gap-1 text-gray-700">
                  <ChevronRight size={14} className="text-gray-400 transition group-open:rotate-90" /> {kec.nama}
                </span>
                {KOMODITAS.map((k) => {
                  const isi = dk.map((d) => v(d.id, k)).filter((x) => x > 0);
                  const rata = rataPositif(isi);
                  return (
                    <span key={k} className={`text-right ${rata ? "font-bold text-gray-800" : "text-gray-300"}`}>
                      {formatAngka(rata)}
                      {isi.length > 0 && <span className="ml-1 text-[10px] font-normal text-gray-400">({isi.length} desa)</span>}
                    </span>
                  );
                })}
              </summary>
              <div className="bg-gray-50/60 pb-2">
                {dk.map((d) => (
                  <div key={d.id} className={`${kolom} px-3 py-1.5 pl-9 text-xs text-gray-600`}>
                    <span>{d.nama}</span>
                    {KOMODITAS.map((k) => (
                      <span key={k} className={`text-right ${v(d.id, k) ? "font-semibold text-gray-700" : "text-gray-300"}`}>{formatAngka(v(d.id, k))}</span>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
