import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { daftarDesa, daftarKecamatan } from "@/lib/data";
import { daftarAnggota } from "@/lib/pengguna";
import { DaftarPengguna } from "@/components/daftar-pengguna";
import type { CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Pengguna — SMART LTT" };

export default function HalamanPenggunaKab({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Manajemen Penyuluh" role={["admin_kab"]} gaya="kab">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("admin_kab");
  const s = await supabaseServer();
  const [kecamatan, desa, pengguna] = await Promise.all([daftarKecamatan(s), daftarDesa(s), daftarAnggota()]);
  return (
    <>
      <DaftarPengguna
        dasar="/kab/pengguna"
        q={await searchParams}
        mode="kab"
        pengguna={pengguna}
        desa={desa}
        kecamatan={kecamatan}
        kecamatanSaya={p.kecamatanId}
        idSaya={p.id}
      />
    </>
  );
}
