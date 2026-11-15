import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { daftarDesa, daftarKecamatan } from "@/lib/data";
import { daftarAnggota } from "@/lib/pengguna";
import { DaftarPengguna } from "@/components/daftar-pengguna";
import type { CariParam } from "@/lib/param";
import { Kosong } from "@/components/ui";

export const metadata: Metadata = { title: "Kelola PPL — SMART LTT" };

export default function HalamanPenggunaBpp({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="BPP" role={["admin_bpp"]} gaya="bpp">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("admin_bpp");
  if (!p.kecamatanId) return <Kosong teks="Akun Anda belum terikat ke kecamatan. Hubungi Admin Kabupaten." />;
  const s = await supabaseServer();
  const [kecamatan, desa, pengguna] = await Promise.all([
    daftarKecamatan(s),
    daftarDesa(s, p.kecamatanId),
    daftarAnggota({ kecamatanId: p.kecamatanId, role: ["penyuluh", "admin_bpp"] }),
  ]);
  return (
    <>
      <DaftarPengguna
        dasar="/bpp/pengguna"
        q={await searchParams}
        mode="bpp"
        pengguna={pengguna}
        desa={desa}
        kecamatan={kecamatan}
        kecamatanSaya={p.kecamatanId}
        idSaya={p.id}
      />
    </>
  );
}
