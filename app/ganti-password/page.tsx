import type { Metadata } from "next";
import { KerangkaHalaman } from "@/components/kerangka-halaman";

export const metadata: Metadata = { title: "Ganti Password" };

import { FormGantiPassword } from "./form-ganti-password";

// Ganti password sendiri — TIDAK wajib (keputusan user 16 Nov 2026). Dibuka dari menu "Ubah Password".
export default function HalamanGantiPassword() {
  return (
    <KerangkaHalaman judul="Ganti Password" role={["penyuluh", "admin_bpp", "admin_kab", "viewer"]} panel={{ judul: "Ubah Password", kembali: "/profil" }}>
      <FormGantiPassword />
    </KerangkaHalaman>
  );
}
