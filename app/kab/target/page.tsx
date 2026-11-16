import type { Metadata } from "next";
import Link from "next/link";
import { Carrot, Eye, Landmark, Leaf, Wheat, X } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka } from "@/lib/format";
import { KOMODITAS, ambilTargetDesa, daftarDesa, daftarKecamatan, type Komoditas } from "@/lib/data";
import { pilihanTahun } from "@/components/ui";
import { angkaParam, teksParam, urlDengan, type CariParam } from "@/lib/param";
import { FormTargetProvinsi } from "./form-provinsi";

export const metadata: Metadata = { title: "Target Komoditas — SMART LTT" };

export default function HalamanTargetKab({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Target Komoditas" role={["admin_kab"]} gaya="kab">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

const IKON: Record<Komoditas, React.ReactNode> = { Padi: <Wheat size={14} />, Jagung: <Leaf size={14} />, "Ubi Kayu": <Carrot size={14} /> };

/**
 * Target Komoditas Bulanan (migrasi 0015), per tahun:
 * - Target Provinsi  = target tiap kecamatan yang ditetapkan provinsi, diisi Admin Kab (`target_provinsi`).
 * - Target Desa      = diisi PPL masing-masing; kecamatan = jumlah desa, kabupaten = jumlah kecamatan.
 * Tahun (?tahun=), komoditas (?komoditas=), detail bulan (?bulan=) dan form (?set=1) lewat URL.
 */
async function Isi({ searchParams }: { searchParams: CariParam }) {
  await wajibRole("admin_kab");
  const q = await searchParams;
  const kini = bulanTahunWIB();
  const tahun = angkaParam(q, "tahun", 2000, 2100, kini.tahun);
  const kom = ((KOMODITAS as string[]).includes(teksParam(q, "komoditas") ?? "") ? teksParam(q, "komoditas") : "Padi") as Komoditas;
  const detail = angkaParam(q, "bulan", 1, 12, 0);
  const bukaSet = detail > 0 && teksParam(q, "set") === "1";

  const s = await supabaseServer();
  const [kecs, desa, { data: tp }] = await Promise.all([
    daftarKecamatan(s),
    daftarDesa(s),
    s.from("target_provinsi").select("bulan, kecamatan_id, target_tanam, target_panen").eq("tahun", tahun).eq("komoditas", kom),
  ]);
  const td = await ambilTargetDesa(s, desa.map((d) => d.id), { tahun, komoditas: kom });
  const kecDesa = new Map(desa.map((d) => [d.id, d.kecamatan_id]));
  const prov = (tp ?? []).map((t) => ({ bulan: t.bulan, kecId: t.kecamatan_id, tanam: Number(t.target_tanam) || 0, panen: Number(t.target_panen) || 0 }));

  const bulanan = NAMA_BULAN.map((_, i) => {
    const b = i + 1;
    const p = prov.filter((t) => t.bulan === b);
    const d = td.filter((t) => t.bulan === b);
    return {
      b,
      prov: p.reduce((a, t) => a + t.tanam, 0),
      kecProv: p.length,
      desa: d.reduce((a, t) => a + t.tanam, 0),
      kecDesa: new Set(d.map((t) => kecDesa.get(t.desaId))).size,
      desaTerisi: d.length,
    };
  });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Target Komoditas Bulanan {tahun}</h2>
          <p className="text-[11px] text-gray-500">
            <b>Target Provinsi</b> diisi Admin Kab per kecamatan · <b>Target Desa</b> diisi PPL, dijumlahkan ke kecamatan & kabupaten
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {pilihanTahun(tahun).map((t) => (
              <Link
                key={t}
                href={urlDengan("/kab/target", q, { tahun: t === kini.tahun ? null : t, bulan: null, set: null })}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${tahun === t ? "bg-white text-green-700 shadow" : "text-gray-500 hover:text-green-600"}`}
              >
                {t}
              </Link>
            ))}
          </div>
          <div className="flex gap-1">
            {KOMODITAS.map((k) => (
              <Link
                key={k}
                href={urlDengan("/kab/target", q, { komoditas: k === "Padi" ? null : k, set: null })}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${kom === k ? "bg-green-600 text-white shadow" : "text-gray-500 hover:text-green-600"}`}
              >
                {IKON[k]} {k}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-green-700 text-[11px] font-bold text-white uppercase">
                <th className="p-3 text-left">Bulan</th>
                <th className="p-3 text-center">Target Provinsi</th>
                <th className="p-3 text-center">Target Desa (Σ PPL)</th>
                <th className="p-3 text-center">Selisih</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bulanan.map((x) => {
                const selisih = x.desa - x.prov;
                return (
                  <tr key={x.b} className={detail === x.b ? "bg-green-50" : "hover:bg-gray-50"}>
                    <td className="p-3">
                      <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-xs font-bold text-green-700">{x.b}</span>
                      <span className="font-semibold text-gray-700">{NAMA_BULAN[x.b - 1]}</span>
                    </td>
                    <td className="p-3 text-center">
                      <p className="font-bold text-blue-700">{x.prov ? `${formatAngka(x.prov)} Ha` : "—"}</p>
                      <p className="text-[10px] text-gray-400">{x.kecProv} / {kecs.length} kecamatan</p>
                    </td>
                    <td className="p-3 text-center">
                      <p className="font-bold text-gray-800">{x.desa ? `${formatAngka(x.desa)} Ha` : "—"}</p>
                      <p className="text-[10px] text-gray-400">{x.desaTerisi} / {desa.length} desa · {x.kecDesa} kec</p>
                    </td>
                    <td className="p-3 text-center text-xs font-semibold">
                      {x.prov > 0 ? (
                        <span className={selisih < 0 ? "text-orange-500" : "text-green-600"}>
                          {selisih < 0 ? `Kurang ${formatAngka(-selisih)} Ha` : selisih > 0 ? `Lebih ${formatAngka(selisih)} Ha` : "Sesuai"}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <Link
                        href={urlDengan("/kab/target", q, { bulan: detail === x.b ? null : x.b, set: null })}
                        scroll={false}
                        className="inline-flex items-center gap-1 rounded-lg border border-green-200 px-3 py-1 text-[11px] font-bold text-green-700 hover:bg-green-50"
                      >
                        <Eye size={12} /> Detail
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {detail > 0 && (
        <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-800">
              {bukaSet ? "Set Target Provinsi" : "Detail"} {kom} — {NAMA_BULAN[detail - 1]} {tahun}
            </h3>
            <div className="flex items-center gap-2">
              {!bukaSet && (
                <Link
                  href={urlDengan("/kab/target", q, { set: "1" })}
                  scroll={false}
                  className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-100"
                >
                  <Landmark size={12} /> Set Target Provinsi
                </Link>
              )}
              <Link href={urlDengan("/kab/target", q, { bulan: null, set: null })} scroll={false} className="rounded-full p-1 text-gray-400 hover:bg-gray-100" aria-label="Tutup">
                <X size={16} />
              </Link>
            </div>
          </div>

          {bukaSet ? (
            <FormTargetProvinsi
              key={`${tahun}-${detail}-${kom}`}
              tahun={tahun}
              bulan={detail}
              komoditas={kom}
              judul={`${kom} · ${NAMA_BULAN[detail - 1]} ${tahun}`}
              baris={kecs.map((k) => {
                const t = prov.find((x) => x.bulan === detail && x.kecId === k.id);
                return { id: k.id, nama: k.nama, tanam: t?.tanam ?? 0, panen: t?.panen ?? 0 };
              })}
              kembali={urlDengan("/kab/target", q, { set: null })}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                    <th rowSpan={2} className="p-2.5 text-left">Kecamatan</th>
                    <th colSpan={2} className="p-2.5 text-center text-blue-600">Target Provinsi (Ha)</th>
                    <th colSpan={2} className="p-2.5 text-center">Target Desa Σ PPL (Ha)</th>
                    <th rowSpan={2} className="p-2.5 text-right">Desa Terisi</th>
                  </tr>
                  <tr className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                    <th className="p-2 text-right">Tanam</th>
                    <th className="p-2 text-right">Panen</th>
                    <th className="p-2 text-right">Tanam</th>
                    <th className="p-2 text-right">Panen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {kecs.map((k) => {
                    const p = prov.find((x) => x.bulan === detail && x.kecId === k.id);
                    const d = td.filter((x) => x.bulan === detail && kecDesa.get(x.desaId) === k.id);
                    return (
                      <tr key={k.id}>
                        <td className="p-2.5 font-semibold text-gray-700">{k.nama}</td>
                        <td className="p-2.5 text-right font-semibold text-blue-700">{p ? formatAngka(p.tanam) : "—"}</td>
                        <td className="p-2.5 text-right text-blue-700">{p ? formatAngka(p.panen) : "—"}</td>
                        <td className="p-2.5 text-right font-semibold">{d.length ? formatAngka(d.reduce((a, x) => a + x.tanam, 0)) : "—"}</td>
                        <td className="p-2.5 text-right">{d.length ? formatAngka(d.reduce((a, x) => a + x.panen, 0)) : "—"}</td>
                        <td className="p-2.5 text-right text-gray-500">{d.length} / {desa.filter((x) => x.kecamatan_id === k.id).length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
