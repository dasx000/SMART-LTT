import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KerangkaHalaman, KepalaPanel } from "@/components/kerangka-halaman";
import { AlurCariOpt } from "@/components/cari-opt/alur-cari-opt";
import { LABEL_KATEGORI, kategoriValid } from "../jenis";
import { KeteranganSumber } from "../sumber";

export const metadata: Metadata = { title: "Cari OPT — SMART LTT" };

type Props = { params: Promise<{ kategori: string }> };

const WARNA: Record<string, string> = { hama: "text-red-600", penyakit: "text-violet-600", gulma: "text-emerald-700" };

/** /ppl/opt/{hama|penyakit|gulma} — alur pencarian (cari komoditas atau nama OPT → bahan aktif & produk). */
export default function HalamanKategoriOpt(props: Props) {
  return (
    <KerangkaHalaman judul="Cari OPT" role={["penyuluh", "admin_bpp"]} gaya="ppl">
      <div className="px-5 pt-6 pb-20">
        <Isi {...props} />
      </div>
    </KerangkaHalaman>
  );
}

async function Isi({ params }: Props) {
  const { kategori } = await params;
  if (!kategoriValid(kategori)) notFound();
  const label = LABEL_KATEGORI[kategori];

  return (
    <>
      <KepalaPanel judul={`Cari ${label}`} sub="Ketik komoditas atau nama OPT" kembali="/ppl/opt" warna={WARNA[kategori]} />
      <AlurCariOpt kategori={kategori} />
      <KeteranganSumber />
    </>
  );
}
