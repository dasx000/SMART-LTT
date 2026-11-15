import type { Metadata } from "next";
import Link from "next/link";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman, KepalaPanel } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { bulanTahunWIB } from "@/lib/format";
import { KOMODITAS, ambilProduktivitas, ambilSarana, desaBinaanSaya, tahunProduktivitas, type Komoditas } from "@/lib/data";
import { Kosong, TombolUnduh } from "@/components/ui";
import { angkaParam, teksParam, type CariParam } from "@/lib/param";
import { KartuProd, KartuSarana } from "./form-produktivitas";

export const metadata: Metadata = { title: "Produktivitas — SMART LTT" };

/**
 * /ppl/produktivitas?tahun=2026&komoditas=Padi   → isian produktivitas
 * /ppl/produktivitas?tab=sarana                  → isian sarana desa
 * Hanya data tahun & komoditas terpilih yang dikirim ke browser.
 */
export default function HalamanProduktivitasPpl({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Produktivitas" role={["penyuluh", "admin_bpp"]} gaya="ppl">
      <div className="px-5 pt-6 pb-20">
        <Isi searchParams={searchParams} />
      </div>
    </KerangkaHalaman>
  );
}

async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("penyuluh", "admin_bpp");
  const q = await searchParams;
  const sarana = teksParam(q, "tab") === "sarana";
  const tahunIni = bulanTahunWIB().tahun;
  const tahun = angkaParam(q, "tahun", 2000, 2100, tahunIni);
  const kom = ((KOMODITAS as string[]).includes(teksParam(q, "komoditas") ?? "") ? teksParam(q, "komoditas") : "Padi") as Komoditas;

  const s = await supabaseServer();
  const desa = await desaBinaanSaya(s, p.id);
  const ids = desa.map((d) => d.id);

  const kepala = sarana ? (
    <KepalaPanel judul="Sarana Desa" sub="Desa binaan Anda" warna="text-orange-600" />
  ) : (
    <KepalaPanel judul="Produktivitas" sub="Desa binaan Anda — ton/ha" />
  );
  const tab = (
    <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1 text-xs font-bold">
      <Link href="/ppl/produktivitas" className={`flex-1 rounded-lg py-2 text-center transition ${!sarana ? "bg-green-600 text-white" : "text-gray-500 hover:bg-white"}`}>
        Produktivitas
      </Link>
      <Link href="/ppl/produktivitas?tab=sarana" className={`flex-1 rounded-lg py-2 text-center transition ${sarana ? "bg-orange-500 text-white" : "text-gray-500 hover:bg-white"}`}>
        Sarana
      </Link>
    </div>
  );

  if (desa.length === 0) {
    return (
      <>
        {kepala}
        <Kosong teks="Belum ada desa binaan. Hubungi Admin BPP." />
      </>
    );
  }

  if (sarana) {
    const data = await ambilSarana(s, ids);
    return (
      <>
        {kepala}
        {tab}
        <div className="space-y-3">
          {desa.map((d) => {
            const x = data.get(d.id);
            return (
              <KartuSarana
                key={d.id}
                desa={d}
                awal={x ? { desaId: d.id, gudang_gabah: x.gudang_gabah, embung: x.embung, lantai_jemur: x.lantai_jemur, mesin_pengering: x.mesin_pengering } : undefined}
              />
            );
          })}
        </div>
      </>
    );
  }

  const [nilai, daftarTahun] = await Promise.all([ambilProduktivitas(s, tahun, ids), tahunProduktivitas(s, tahunIni)]);
  const pilihanTahun = [...new Set([...daftarTahun, tahunIni - 1])].sort((a, b) => b - a);

  return (
    <>
      {kepala}
      {tab}
      <div className="mb-3 space-y-2 rounded-2xl border border-gray-200 bg-white p-3">
        <form method="get" className="flex items-end gap-2">
          <input type="hidden" name="komoditas" value={kom} />
          <label className="flex flex-1 flex-col gap-1 text-[11px] font-semibold text-gray-500">
            Tahun
            <select name="tahun" defaultValue={tahun} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium">
              {pilihanTahun.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white">
            Pilih
          </button>
          <TombolUnduh href={`/api/unduh/produktivitas?tahunDari=${tahun}&tahunSampai=${tahun}`} label="Excel" />
        </form>
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {KOMODITAS.map((k) => (
            <Link
              key={k}
              href={`/ppl/produktivitas?tahun=${tahun}&komoditas=${encodeURIComponent(k)}`}
              className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition-all ${kom === k ? "bg-green-600 text-white" : "text-gray-500 hover:bg-white"}`}
            >
              {k}
            </Link>
          ))}
        </div>
        <p className="text-[11px] text-gray-500">Satuan ton/ha (maks. 100). Kosong = 0.</p>
      </div>
      <div className="space-y-3">
        {desa.map((d) => (
          <KartuProd key={`${d.id}-${tahun}-${kom}`} desa={d} tahun={tahun} kom={kom} awal={nilai.get(`${d.id}|${kom}`)} />
        ))}
      </div>
    </>
  );
}
