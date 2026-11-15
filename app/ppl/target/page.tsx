import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { bulanTahunWIB } from "@/lib/format";
import { ambilTargetDesa, desaBinaanSaya, jenisPadi } from "@/lib/data";
import { FormTarget } from "@/components/form-target";
import { JudulHalaman, Kosong } from "@/components/ui";

export const metadata: Metadata = { title: "Target Desa — SMART LTT" };

export default function HalamanTargetPpl() {
  return (
    <KerangkaHalaman judul="SMART LTT · Target" role={["penyuluh", "admin_bpp"]}>
      <Isi />
    </KerangkaHalaman>
  );
}

async function Isi() {
  const p = await wajibRole("penyuluh", "admin_bpp");
  const s = await supabaseServer();
  const desa = await desaBinaanSaya(s, p.id);
  const [jenis, target] = await Promise.all([jenisPadi(s), ambilTargetDesa(s, desa.map((d) => d.id))]);

  return (
    <>
      <JudulHalaman judul="Target Desa Binaan" sub="Target berlaku per bulan (tanpa tahun) — mengisi ulang akan menimpa." />
      {desa.length === 0 ? (
        <Kosong teks="Belum ada desa binaan. Hubungi Admin BPP." />
      ) : (
        <FormTarget desa={desa} jenis={jenis} target={target} bulanAwal={bulanTahunWIB().bulan} />
      )}
    </>
  );
}
