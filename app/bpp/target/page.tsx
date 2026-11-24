import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Carrot, Eye, Leaf, Wheat } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka } from "@/lib/format";
import { KOMODITAS, ambilTargetDesa, daftarDesa, daftarKecamatan, type Komoditas } from "@/lib/data";
import { Kosong, pilihanTahun } from "@/components/ui";
import { angkaParam, teksParam, urlDengan, type CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Target Komoditas — SMART LTT" };

export default function HalamanTargetBpp({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Target Komoditas" role={["admin_bpp"]} gaya="bpp">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

const IKON: Record<Komoditas, React.ReactNode> = { Padi: <Wheat size={14} />, Jagung: <Leaf size={14} />, "Ubi Kayu": <Carrot size={14} /> };

/**
 * Target Komoditas Bulanan — Admin BPP, hanya kecamatannya sendiri (tampilan meniru /kab/target).
 * - Target Provinsi = target kecamatan dari provinsi (diisi Admin Kab, hanya-baca di sini).
 * - Target Desa     = jumlah target desa yang diisi PPL / BPP.
 * Detail bulan = /bpp/target/<bulan>. Tautan lama `/bpp/target?bulan=` diarahkan ke detail bulan.
 */
async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("admin_bpp");
  if (!p.kecamatanId) return <Kosong teks="Akun Anda belum terikat ke kecamatan. Hubungi Admin Kabupaten." />;
  const q = await searchParams;
  const kini = bulanTahunWIB();
  const tahun = angkaParam(q, "tahun", 2000, 2100, kini.tahun);
  const kom = ((KOMODITAS as string[]).includes(teksParam(q, "komoditas") ?? "") ? teksParam(q, "komoditas") : "Padi") as Komoditas;

  // Kompatibilitas tautan lama (?bulan=) → halaman detail bulan
  const bulanLama = angkaParam(q, "bulan", 1, 12, 0);
  if (bulanLama) redirect(urlDengan(`/bpp/target/${bulanLama}`, q, { bulan: null, komoditas: kom === "Padi" ? null : kom }));

  const s = await supabaseServer();
  const [kecs, desa, { data: tp, error }] = await Promise.all([
    daftarKecamatan(s),
    daftarDesa(s, p.kecamatanId),
    s.from("target_provinsi").select("bulan, target_tanam").eq("tahun", tahun).eq("komoditas", kom).eq("kecamatan_id", p.kecamatanId),
  ]);
  if (error) throw new Error(error.message);
  const td = await ambilTargetDesa(s, desa.map((d) => d.id), { tahun, komoditas: kom });
  const namaKec = kecs.find((k) => k.id === p.kecamatanId)?.nama ?? "";

  const bulanan = NAMA_BULAN.map((_, i) => {
    const b = i + 1;
    const pr = (tp ?? []).find((t) => t.bulan === b);
    const d = td.filter((t) => t.bulan === b);
    return {
      b,
      prov: pr ? Number(pr.target_tanam) || 0 : null,
      desa: d.reduce((a, t) => a + t.tanam, 0),
      desaTerisi: d.length,
    };
  });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Target Komoditas Bulanan {tahun}</h2>
          <p className="text-[11px] text-gray-500">
            Kec. {namaKec} · <b>Target Provinsi</b> ditetapkan Admin Kab · <b>Target Desa</b> diisi PPL, dijumlahkan ke kecamatan
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {pilihanTahun(tahun).map((t) => (
              <Link
                key={t}
                href={urlDengan("/bpp/target", q, { tahun: t === kini.tahun ? null : t })}
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
                href={urlDengan("/bpp/target", q, { komoditas: k === "Padi" ? null : k })}
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
                const selisih = x.prov == null ? null : x.desa - x.prov;
                return (
                  <tr key={x.b} className={tahun === kini.tahun && x.b === kini.bulan ? "bg-green-50/60" : "hover:bg-gray-50"}>
                    <td className="p-3">
                      <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-xs font-bold text-green-700">{x.b}</span>
                      <span className="font-semibold text-gray-700">{NAMA_BULAN[x.b - 1]}</span>
                    </td>
                    <td className="p-3 text-center">
                      <p className="font-bold text-blue-700">{x.prov == null ? "—" : `${formatAngka(x.prov)} Ha`}</p>
                      <p className="text-[10px] text-gray-400">{x.prov == null ? "belum diset Admin Kab" : `Kec. ${namaKec}`}</p>
                    </td>
                    <td className="p-3 text-center">
                      <p className="font-bold text-gray-800">{x.desa ? `${formatAngka(x.desa)} Ha` : "—"}</p>
                      <p className="text-[10px] text-gray-400">{x.desaTerisi} / {desa.length} desa</p>
                    </td>
                    <td className="p-3 text-center text-xs font-semibold">
                      {selisih != null && x.prov! > 0 ? (
                        <span className={selisih < 0 ? "text-orange-500" : "text-green-600"}>
                          {selisih < 0 ? `Kurang ${formatAngka(-selisih)} Ha` : selisih > 0 ? `Lebih ${formatAngka(selisih)} Ha` : "Sesuai"}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <Link
                        href={urlDengan(`/bpp/target/${x.b}`, { tahun: String(tahun), komoditas: kom === "Padi" ? undefined : kom }, {})}
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
    </>
  );
}
