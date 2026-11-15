import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { DaftarLaporan } from "@/components/laporan/daftar-laporan";
import { FormEditLaporan } from "@/components/laporan/form-edit-laporan";
import { muatHalamanLaporan } from "@/components/laporan/muat-laporan";
import type { CariParam } from "@/lib/param";
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
  const { daftar, edit } = await muatHalamanLaporan("/kab/laporan", await searchParams, null);
  return (
    <>
      <DaftarLaporan {...daftar} aksiHapus={hapusLaporanKabAction} />
      {edit && <FormEditLaporan lengkap aksi={editLaporanKabAction} {...edit} />}
    </>
  );
}
