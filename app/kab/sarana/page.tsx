import type { Metadata } from "next";
import { ChevronRight, FileSpreadsheet, Warehouse } from "lucide-react";
import { TombolMuatUlang } from "@/components/tombol-muat-ulang";
import { TombolUnduh } from "@/components/tombol-unduh";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { bulanTahunWIB } from "@/lib/format";
import { InfografisSarana, type BarisSaranaKec } from "@/components/infografis-sarana";
import { KOLOM_SARANA, ambilSarana, daftarDesa, daftarKecamatan } from "@/lib/data";

export const metadata: Metadata = { title: "Sarana Desa — SMART LTT" };

export default function HalamanSaranaKab() {
  return (
    <KerangkaHalaman judul="Sarana Desa" role={["admin_kab"]} gaya="kab">
      <Isi />
    </KerangkaHalaman>
  );
}

const kolom = "grid grid-cols-[1fr_repeat(5,4.5rem)] items-center gap-2 sm:grid-cols-[1fr_repeat(5,8rem)]";

/** Sarana Desa (aplikasi lama): jumlah unit per kecamatan, klik untuk melihat desa. Tanpa JS (<details>). */
async function Isi() {
  await wajibRole("admin_kab");
  const s = await supabaseServer();
  const [kecs, desa, sarana] = await Promise.all([daftarKecamatan(s), daftarDesa(s), ambilSarana(s)]);
  const tahun = bulanTahunWIB().tahun;
  const ringkas: BarisSaranaKec[] = kecs.map((kec) => {
    const dk = desa.filter((d) => d.kecamatan_id === kec.id);
    const isi = dk.flatMap((d) => sarana.get(d.id) ?? []);
    const unit = {} as BarisSaranaKec["unit"];
    const desaPunya = {} as BarisSaranaKec["desaPunya"];
    for (const c of KOLOM_SARANA) {
      unit[c.kunci] = isi.reduce((a, x) => a + (Number(x[c.kunci]) || 0), 0);
      desaPunya[c.kunci] = isi.filter((x) => (Number(x[c.kunci]) || 0) > 0).length;
    }
    return { id: kec.id, nama: kec.nama, jumlahDesa: dk.length, desaTerisi: isi.length, unit, desaPunya };
  });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 pb-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <Warehouse className="text-orange-500" size={20} /> Sarana Desa
          </h2>
          <p className="text-[11px] text-gray-500">Jumlah unit, diisi PPL per desa. Klik kecamatan untuk melihat desa.</p>
        </div>
        <div className="flex gap-2">
          <TombolMuatUlang href="/kab/sarana" label="Muat Ulang" className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600" />
          <TombolUnduh href={`/api/unduh/produktivitas?tahunDari=${tahun}&tahunSampai=${tahun}`} ikon={<FileSpreadsheet size={14} />} className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-bold text-white" />
        </div>
      </div>

      <InfografisSarana baris={ringkas} />

      <h3 className="mb-2 text-sm font-bold text-gray-800">Rincian per Kecamatan &amp; Desa</h3>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="min-w-[620px]">
          <div className={`${kolom} bg-gray-50 px-3 py-3 text-[11px] font-bold text-gray-500 uppercase`}>
            <span>Kecamatan</span>
            {KOLOM_SARANA.map((c) => (
              <span key={c.kunci} className="text-right">{c.label}</span>
            ))}
            <span className="text-right">Desa Terisi</span>
          </div>
          {kecs.map((kec) => {
            const dk = desa.filter((d) => d.kecamatan_id === kec.id);
            const isi = dk.map((d) => sarana.get(d.id)).filter((x) => x !== undefined);
            return (
              <details key={kec.id} className="group border-t border-gray-100">
                <summary className={`${kolom} cursor-pointer list-none px-3 py-3 text-sm hover:bg-gray-50`}>
                  <span className="flex items-center gap-1 text-gray-700">
                    <ChevronRight size={14} className="text-gray-400 transition group-open:rotate-90" /> {kec.nama}
                  </span>
                  {KOLOM_SARANA.map((c) => (
                    <span key={c.kunci} className="text-right text-gray-700">{isi.reduce((a, x) => a + (Number(x![c.kunci]) || 0), 0)}</span>
                  ))}
                  <span className="text-right font-bold text-orange-500">{isi.length} / {dk.length}</span>
                </summary>
                <div className="bg-gray-50/60 pb-2">
                  {dk.map((d) => {
                    const x = sarana.get(d.id);
                    return (
                      <div key={d.id} className={`${kolom} px-3 py-1.5 pl-9 text-xs text-gray-600`}>
                        <span>{d.nama}</span>
                        {KOLOM_SARANA.map((c) => (
                          <span key={c.kunci} className="text-right">{x ? x[c.kunci] : "–"}</span>
                        ))}
                        <span className={`text-right text-[10px] font-bold ${x ? "text-green-600" : "text-gray-400"}`}>{x ? "Terisi" : "Belum"}</span>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </>
  );
}
