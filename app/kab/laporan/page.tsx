import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { DaftarLaporan } from "@/components/laporan/daftar-laporan";
import { FormEditLaporan } from "@/components/laporan/form-edit-laporan";
import { FormImpor } from "@/components/laporan/form-impor";
import { muatHalamanLaporan } from "@/components/laporan/muat-laporan";
import { teksParam, urlDengan, type CariParam } from "@/lib/param";
import { imporEpusluhAction } from "./impor-actions";
import { editLaporanKabAction, hapusLaporanKabAction } from "../actions";

export const metadata: Metadata = { title: "Laporan LTT — SMART LTT" };

export default function HalamanLaporanKab({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Laporan LTT" role={["admin_kab"]} gaya="kab">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

async function Isi({ searchParams }: { searchParams: CariParam }) {
  await wajibRole("admin_kab");
  const q = await searchParams;
  const { daftar, edit } = await muatHalamanLaporan("/kab/laporan", q, null);
  const bukaImpor = teksParam(q, "impor") === "1";
  return (
    <>
      <DaftarLaporan {...daftar} impor={urlDengan("/kab/laporan", q, { impor: "1", edit: null })} aksiHapus={hapusLaporanKabAction} />
      {edit && <FormEditLaporan lengkap aksi={editLaporanKabAction} {...edit} />}
      {bukaImpor && <FormImpor aksi={imporEpusluhAction} kembali={urlDengan("/kab/laporan", q, { impor: null })} />}
    </>
  );
}
