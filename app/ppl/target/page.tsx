import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { bulanTahunWIB } from "@/lib/format";
import { KOMODITAS, ambilTargetDesa, desaBinaanSaya, jenisPadi, type Komoditas } from "@/lib/data";
import { angkaParam, teksParam, type CariParam } from "@/lib/param";
import { FormTarget } from "@/components/form-target";
import { Kosong, PilihBulanKomoditas } from "@/components/ui";

export const metadata: Metadata = { title: "Target Desa — SMART LTT" };

export default function HalamanTargetPpl({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Target" role={["penyuluh", "admin_bpp"]} panel={{ judul: "Target Bulanan", sub: "Desa binaan — berlaku per bulan, mengisi ulang menimpa", warna: "text-cyan-700" }}>
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("penyuluh", "admin_bpp");
  const q = await searchParams;
  const kini = bulanTahunWIB();
  const tahun = angkaParam(q, "tahun", 2000, 2100, kini.tahun);
  const bulan = angkaParam(q, "bulan", 1, 12, kini.bulan);
  const kom = ((KOMODITAS as string[]).includes(teksParam(q, "komoditas") ?? "") ? teksParam(q, "komoditas") : "Padi") as Komoditas;
  const s = await supabaseServer();
  const desa = await desaBinaanSaya(s, p.id);
  const lalu = bulan === 1 ? { tahun: tahun - 1, bulan: 12 } : { tahun, bulan: bulan - 1 };
  const ids = desa.map((d) => d.id);
  const [jenis, semua, targetLalu] = await Promise.all([
    jenisPadi(s),
    ambilTargetDesa(s, ids, { tahun, bulan, komoditas: kom }),
    ambilTargetDesa(s, ids, { tahun: lalu.tahun, bulan: lalu.bulan, komoditas: kom }),
  ]);
  const target = semua;
  // Hanya untuk placeholder luas baku (tidak ikut tersimpan bila tidak diisi).
  const luasBakuLalu = Object.fromEntries(targetLalu.map((t) => [t.desaId, t.luasBaku]));

  return (
    <>
      {desa.length === 0 ? (
        <Kosong teks="Belum ada desa binaan. Hubungi Admin BPP." />
      ) : (
        <>
          <PilihBulanKomoditas dasar="/ppl/target" tahun={tahun} bulan={bulan} kom={kom} info={<>Terisi <b>{target.length}</b> / {desa.length} desa</>} />
          <FormTarget desa={desa} jenis={jenis} target={target} luasBakuLalu={luasBakuLalu} tahun={tahun} bulan={bulan} kom={kom} />
        </>
      )}
    </>
  );
}
