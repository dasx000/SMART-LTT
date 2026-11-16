import type { Metadata } from "next";
import Link from "next/link";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka } from "@/lib/format";
import { KOMODITAS, daftarDesa } from "@/lib/data";
import { JudulHalaman, Kartu, Kosong, pilihanTahun } from "@/components/ui";
import { angkaParam, type CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Target Kecamatan — SMART LTT" };

export default function HalamanTargetKecamatan({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="BPP" role={["admin_bpp"]} gaya="bpp">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

/**
 * Target kecamatan = jumlah target desa yang diisi PPL (view v_target_kecamatan, migrasi 0015),
 * dibandingkan dengan Target Provinsi (diisi Admin Kab). Hanya-baca.
 */
async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("admin_bpp");
  if (!p.kecamatanId) return <Kosong teks="Akun Anda belum terikat ke kecamatan. Hubungi Admin Kabupaten." />;

  const kini = bulanTahunWIB();
  const tahun = angkaParam(await searchParams, "tahun", 2000, 2100, kini.tahun);
  const s = await supabaseServer();
  const [{ data }, { data: dataProv }, desa] = await Promise.all([
    s
      .from("v_target_kecamatan")
      .select("bulan, komoditas, target_tanam, target_panen, jumlah_desa_terisi")
      .eq("kecamatan_id", p.kecamatanId)
      .eq("tahun", tahun),
    s.from("target_provinsi").select("bulan, komoditas, target_tanam").eq("kecamatan_id", p.kecamatanId).eq("tahun", tahun),
    daftarDesa(s, p.kecamatanId),
  ]);
  const prov = (b: number, k: string) => Number((dataProv ?? []).find((x) => x.bulan === b && x.komoditas === k)?.target_tanam) || 0;
  const target = (data ?? []).map((t) => ({
    ...t,
    target_tanam: Number(t.target_tanam) || 0,
    target_panen: Number(t.target_panen) || 0,
    jumlah_desa_terisi: Number(t.jumlah_desa_terisi) || 0,
  }));
  const bulanKini = tahun === kini.tahun ? kini.bulan : 0;
  const tautan = (b: number, k: string) => `/bpp/target?tahun=${tahun}&bulan=${b}&komoditas=${encodeURIComponent(k)}`;

  return (
    <div className="space-y-5">
      <JudulHalaman
        judul="Target Kecamatan"
        sub="Otomatis = jumlah target desa yang diisi masing-masing PPL. Pembanding: Target Provinsi (ditetapkan provinsi, diisi Admin Kab)."
        aksi={
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {pilihanTahun(tahun).map((t) => (
              <Link
                key={t}
                href={`/bpp/target-kecamatan?tahun=${t}`}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${tahun === t ? "bg-white text-green-700 shadow" : "text-gray-500 hover:text-green-600"}`}
              >
                {t}
              </Link>
            ))}
          </div>
        }
      />
      <Kartu judul={`Rekap Target Kecamatan ${tahun}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-3">Bulan</th>
                {KOMODITAS.map((k) => (
                  <th key={k} className="p-3 text-right">{k} (Tanam / Panen)</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {NAMA_BULAN.map((n, i) => (
                <tr key={n} className={i + 1 === bulanKini ? "bg-green-50" : "hover:bg-gray-50"}>
                  <td className="p-3 font-semibold text-gray-800">{n}</td>
                  {KOMODITAS.map((k) => {
                    const t = target.find((x) => x.bulan === i + 1 && x.komoditas === k);
                    return (
                      <td key={k} className="p-3 text-right">
                        <Link href={tautan(i + 1, k)} className="hover:text-green-700 hover:underline">
                          {t ? `${formatAngka(t.target_tanam)} / ${formatAngka(t.target_panen)}` : "–"}
                        </Link>
                        <p className="text-[10px] text-gray-400">{t ? t.jumlah_desa_terisi : 0} / {desa.length} desa</p>
                        {prov(i + 1, k) > 0 && <p className="text-[10px] font-semibold text-blue-600">Prov: {formatAngka(prov(i + 1, k))}</p>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">Angka = target tanam / panen jumlah desa. <b>Prov</b> = Target Provinsi (tanam). Klik angka untuk rincian per desa dan PPL.</p>
      </Kartu>
    </div>
  );
}
