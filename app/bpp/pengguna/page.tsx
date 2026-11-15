import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { daftarDesa, daftarKecamatan } from "@/lib/data";
import { daftarAnggota } from "@/lib/pengguna";
import { KelolaPengguna } from "@/components/kelola-pengguna";
import { JudulHalaman, Kosong } from "@/components/ui";

export const metadata: Metadata = { title: "Kelola PPL — SMART LTT" };

export default function HalamanPenggunaBpp() {
  return (
    <KerangkaHalaman judul="SMART LTT · Kelola PPL" role={["admin_bpp"]}>
      <Isi />
    </KerangkaHalaman>
  );
}

async function Isi() {
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
      <JudulHalaman judul="Kelola PPL" sub="Penyuluh di kecamatan Anda. Akun baru otomatis role Penyuluh." />
      <KelolaPengguna
        mode="bpp"
        pengguna={pengguna.map((u) => ({ ...u, email: undefined }))}
        desa={desa}
        kecamatan={kecamatan}
        kecamatanSaya={p.kecamatanId}
        idSaya={p.id}
      />
    </>
  );
}
