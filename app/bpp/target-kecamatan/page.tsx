import type { Metadata } from "next";
import Link from "next/link";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka } from "@/lib/format";
import { KOMODITAS, type Komoditas } from "@/lib/data";
import { JudulHalaman, Kartu, Kosong } from "@/components/ui";
import { angkaParam, teksParam, type CariParam } from "@/lib/param";
import { FormTargetKecamatan } from "./form";

export const metadata: Metadata = { title: "Target Kecamatan — SMART LTT" };

export default function HalamanTargetKecamatan({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="BPP" role={["admin_bpp"]} gaya="bpp">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("admin_bpp");
  if (!p.kecamatanId) return <Kosong teks="Akun Anda belum terikat ke kecamatan. Hubungi Admin Kabupaten." />;
  const q = await searchParams;
  const bulan = angkaParam(q, "bulan", 1, 12, bulanTahunWIB().bulan);
  const kom = ((KOMODITAS as string[]).includes(teksParam(q, "komoditas") ?? "") ? teksParam(q, "komoditas") : "Padi") as Komoditas;

  const s = await supabaseServer();
  const { data } = await s
    .from("target_kecamatan")
    .select("bulan, komoditas, target_tanam, target_panen")
    .eq("kecamatan_id", p.kecamatanId)
    .order("bulan");
  const target = (data ?? []).map((t) => ({ ...t, target_tanam: Number(t.target_tanam) || 0, target_panen: Number(t.target_panen) || 0 }));
  const kini = target.find((t) => t.bulan === bulan && t.komoditas === kom);
  const tautan = (b: number, k: string) => `/bpp/target-kecamatan?bulan=${b}&komoditas=${encodeURIComponent(k)}`;

  return (
    <div className="space-y-5">
      <JudulHalaman judul="Target Kecamatan" sub="Diisi Admin BPP per bulan (tanpa tahun). Target kabupaten = jumlah target kecamatan." />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Kartu judul={`Atur Target — ${NAMA_BULAN[bulan - 1]}`} className="md:col-span-1">
          {/* Pilihan bulan & komoditas = URL (GET) */}
          <form method="get" className="mb-4 space-y-3">
            <label className="block text-xs font-semibold text-gray-700">
              Bulan
              <select name="bulan" defaultValue={bulan} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
                {NAMA_BULAN.map((n, i) => (
                  <option key={n} value={i + 1}>{n}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-gray-700">
              Komoditas
              <select name="komoditas" defaultValue={kom} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
                {KOMODITAS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="w-full rounded-xl border border-gray-200 bg-white py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
              Pilih
            </button>
          </form>
          <FormTargetKecamatan bulan={bulan} komoditas={kom} tanam={kini?.target_tanam ?? 0} panen={kini?.target_panen ?? 0} />
        </Kartu>

        <Kartu judul="Daftar Target Kecamatan" className="md:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                  <th className="p-3">Bulan</th>
                  {KOMODITAS.map((k) => (
                    <th key={k} className="p-3 text-right">{k} (T / P)</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {NAMA_BULAN.map((n, i) => (
                  <tr key={n} className={i + 1 === bulan ? "bg-green-50" : "hover:bg-gray-50"}>
                    <td className="p-3 font-semibold text-gray-800">{n}</td>
                    {KOMODITAS.map((k) => {
                      const t = target.find((x) => x.bulan === i + 1 && x.komoditas === k);
                      return (
                        <td key={k} className="p-3 text-right">
                          <Link href={tautan(i + 1, k)} className="hover:text-green-700 hover:underline">
                            {t ? `${formatAngka(t.target_tanam)} / ${formatAngka(t.target_panen)}` : "–"}
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">Klik angka untuk mengubah target bulan & komoditas itu.</p>
        </Kartu>
      </div>
    </div>
  );
}
