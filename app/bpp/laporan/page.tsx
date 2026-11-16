import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { DaftarLaporan } from "@/components/laporan/daftar-laporan";
import { FormEditLaporan } from "@/components/laporan/form-edit-laporan";
import { muatHalamanLaporan } from "@/components/laporan/muat-laporan";
import { Kosong } from "@/components/ui";
import type { CariParam } from "@/lib/param";
import { editLaporanBppAction } from "../actions";

export const metadata: Metadata = { title: "Laporan LTT — SMART LTT" };

export default function HalamanLaporanBpp({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="BPP" role={["admin_bpp"]} gaya="bpp">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("admin_bpp");
  if (!p.kecamatanId) return <Kosong teks="Akun Anda belum terikat ke kecamatan. Hubungi Admin Kabupaten." />;
  // BPP dikunci ke kecamatannya sendiri
  const { daftar, edit } = await muatHalamanLaporan("/bpp/laporan", await searchParams, p.kecamatanId);
  return (
    <>
      {/* Admin BPP hanya boleh mengubah laporan, tidak menghapus. */}
      <DaftarLaporan {...daftar} />
      {edit && <FormEditLaporan lengkap={false} aksi={editLaporanBppAction} {...edit} />}
    </>
  );
}
