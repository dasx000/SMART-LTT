import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { daftarDesa, daftarKecamatan } from "@/lib/data";
import { daftarAnggota } from "@/lib/pengguna";
import { KelolaPengguna } from "@/components/kelola-pengguna";
import { JudulHalaman } from "@/components/ui";

export const metadata: Metadata = { title: "Pengguna — SMART LTT" };

export default function HalamanPenggunaKab() {
  return (
    <KerangkaHalaman judul="SMART LTT · Pengguna" role={["admin_kab"]}>
      <Isi />
    </KerangkaHalaman>
  );
}

async function Isi() {
  const p = await wajibRole("admin_kab");
  const s = await supabaseServer();
  const [kecamatan, desa, pengguna] = await Promise.all([daftarKecamatan(s), daftarDesa(s), daftarAnggota()]);
  return (
    <>
      <JudulHalaman judul="Manajemen Pengguna" sub="Akun bersama project CWS: nama & password juga berlaku di aplikasi lain. Hapus = nonaktifkan." />
      <KelolaPengguna
        mode="kab"
        pengguna={pengguna.map((u) => ({ ...u, email: undefined }))}
        desa={desa}
        kecamatan={kecamatan}
        kecamatanSaya={p.kecamatanId}
        idSaya={p.id}
      />
    </>
  );
}
