import type { Metadata } from "next";
import Form from "next/form";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { SelectOtomatis } from "@/components/select-otomatis";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB } from "@/lib/format";
import { kodePeriode, periodeDariParam } from "@/lib/data";
import { teksParam, type CariParam } from "@/lib/param";
import { rekapRealisasiPpl } from "@/lib/realisasi-ppl";
import { AlertTargetPpl, LegendaRealisasi, RingkasanRealisasi, TabelDesaSaya, teksPeriodeRealisasi } from "@/components/realisasi-ppl";
import { Kosong } from "@/components/ui";

export const metadata: Metadata = { title: "Realisasi LTT Padi — SMART LTT" };

export default function HalamanRealisasiSaya({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Realisasi" role={["penyuluh", "admin_bpp"]} panel={{ judul: "Realisasi LTT Padi", sub: "Capaian LTT padi desa binaan terhadap target", warna: "text-green-700" }}>
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

/** Realisasi LTT Padi — akun penyuluh (dan Admin BPP mode PPL): hanya dirinya sendiri. */
async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("penyuluh", "admin_bpp");
  const q = await searchParams;
  const per = periodeDariParam(teksParam(q, "periode"), bulanTahunWIB());
  const s = await supabaseServer();
  const d = await rekapRealisasiPpl(s, { tahun: per.tahun, bulan: per.bulan, userId: p.id });
  const saya = d.kec[0]?.ppl[0] ?? null;

  return (
    <div className="space-y-4">
      <Form action="/ppl/realisasi" scroll={false} className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">Kumulatif {teksPeriodeRealisasi(d)}</p>
        <SelectOtomatis
          key={kodePeriode(per)}
          name="periode"
          defaultValue={kodePeriode(per)}
          aria-label="Periode"
          className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm outline-none"
        >
          {per.pilihan.slice(0, 6).map((x) => (
            <option key={kodePeriode(x)} value={kodePeriode(x)}>{NAMA_BULAN[x.bulan - 1]} {x.tahun}</option>
          ))}
        </SelectOtomatis>
      </Form>

      {!saya ? (
        <Kosong teks="Belum ada desa binaan. Hubungi Admin BPP." />
      ) : (
        <>
          <AlertTargetPpl p={saya} href={`/ppl/target?tahun=${per.tahun}&bulan=${per.bulan}&komoditas=Padi`} />
          <RingkasanRealisasi d={d} lingkup="Desa binaan Anda" saya={saya} />
          <TabelDesaSaya p={saya} />
          <LegendaRealisasi />
        </>
      )}
    </div>
  );
}
