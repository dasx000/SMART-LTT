import type { Metadata } from "next";
import Link from "next/link";
import { Carrot, Eye, Leaf, Wheat, X } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, formatAngka } from "@/lib/format";
import { KOMODITAS, ambilTargetDesa, daftarDesa, daftarKecamatan, type Komoditas } from "@/lib/data";
import { angkaParam, teksParam, urlDengan, type CariParam } from "@/lib/param";

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
 * Target Komoditas Bulanan (aplikasi lama). Aturan baru (keputusan §25 no. 3):
 * Target Kecamatan diisi Admin BPP, Target Kabupaten = jumlah target kecamatan, Target Desa diisi PPL/BPP.
 * Komoditas (?komoditas=) dan detail bulan (?bulan=) lewat URL.
 */
async function Isi({ searchParams }: { searchParams: CariParam }) {
  await wajibRole("admin_kab");
  const q = await searchParams;
  const kom = ((KOMODITAS as string[]).includes(teksParam(q, "komoditas") ?? "") ? teksParam(q, "komoditas") : "Padi") as Komoditas;
  const detail = angkaParam(q, "bulan", 1, 12, 0);

  const s = await supabaseServer();
  const [kecs, desa, { data: tk }] = await Promise.all([
    daftarKecamatan(s),
    daftarDesa(s),
    s.from("target_kecamatan").select("bulan, kecamatan_id, target_tanam").eq("komoditas", kom),
  ]);
  const td = await ambilTargetDesa(s, desa.map((d) => d.id), { komoditas: kom });
  const kecDesa = new Map(desa.map((d) => [d.id, d.kecamatan_id]));

  const bulanan = NAMA_BULAN.map((_, i) => {
    const b = i + 1;
    const kec = (tk ?? []).filter((t) => t.bulan === b);
    const totKec = kec.reduce((a, t) => a + (Number(t.target_tanam) || 0), 0);
    const totDesa = td.filter((t) => t.bulan === b).reduce((a, t) => a + t.tanam, 0);
    return { b, totKec, terisi: kec.filter((t) => Number(t.target_tanam) > 0).length, totDesa };
  });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Target Komoditas Bulanan</h2>
          <p className="text-[11px] text-gray-500">Target tanam per komoditas untuk setiap bulan (kabupaten = jumlah target kecamatan)</p>
        </div>
        <div className="flex gap-1">
          {KOMODITAS.map((k) => (
            <Link
              key={k}
              href={urlDengan("/kab/target", {}, { komoditas: k === "Padi" ? null : k })}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${kom === k ? "bg-green-600 text-white shadow" : "text-gray-500 hover:text-green-600"}`}
            >
              {IKON[k]} {k}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-green-700 text-[11px] font-bold text-white uppercase">
                <th className="p-3 text-left">Bulan</th>
                <th className="p-3 text-center">Target Kabupaten</th>
                <th className="p-3 text-center">Target Kecamatan</th>
                <th className="p-3 text-center">Target Desa</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bulanan.map((x) => {
                const kurang = x.totKec - x.totDesa;
                return (
                  <tr key={x.b} className={detail === x.b ? "bg-green-50" : "hover:bg-gray-50"}>
                    <td className="p-3">
                      <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-xs font-bold text-green-700">{x.b}</span>
                      <span className="font-semibold text-gray-700">{NAMA_BULAN[x.b - 1]}</span>
                    </td>
                    <td className="p-3 text-center font-bold text-gray-800">{x.totKec ? `${formatAngka(x.totKec)} Ha` : "—"}</td>
                    <td className="p-3 text-center">
                      <p className="font-bold text-gray-800">{x.totKec ? `${formatAngka(x.totKec)} Ha` : "—"}</p>
                      <p className="text-[10px] text-gray-400">{x.terisi} / {kecs.length} kecamatan</p>
                    </td>
                    <td className="p-3 text-center">
                      <p className="font-bold text-gray-800">{x.totDesa ? `${formatAngka(x.totDesa)} Ha` : "—"}</p>
                      {x.totKec > 0 && kurang > 0 && <p className="text-[10px] font-semibold text-orange-500">Kekurangan {formatAngka(kurang)} Ha</p>}
                    </td>
                    <td className="p-3 text-center">
                      <Link
                        href={urlDengan("/kab/target", q, { bulan: detail === x.b ? null : x.b })}
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
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">Detail {kom} — {NAMA_BULAN[detail - 1]}</h3>
            <Link href={urlDengan("/kab/target", q, { bulan: null })} scroll={false} className="rounded-full p-1 text-gray-400 hover:bg-gray-100" aria-label="Tutup">
              <X size={16} />
            </Link>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-2.5 text-left">Kecamatan</th>
                <th className="p-2.5 text-right">Target Kecamatan (BPP)</th>
                <th className="p-2.5 text-right">Jumlah Target Desa</th>
                <th className="p-2.5 text-right">Desa Terisi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kecs.map((k) => {
                const t = Number((tk ?? []).find((x) => x.bulan === detail && x.kecamatan_id === k.id)?.target_tanam) || 0;
                const d = td.filter((x) => x.bulan === detail && kecDesa.get(x.desaId) === k.id);
                return (
                  <tr key={k.id}>
                    <td className="p-2.5 font-semibold text-gray-700">{k.nama}</td>
                    <td className="p-2.5 text-right">{t ? formatAngka(t) : "—"}</td>
                    <td className="p-2.5 text-right">{formatAngka(d.reduce((a, x) => a + x.tanam, 0))}</td>
                    <td className="p-2.5 text-right text-gray-500">{d.length} / {desa.filter((x) => x.kecamatan_id === k.id).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
