import type { Metadata } from "next";
import { KerangkaHalaman } from "@/components/kerangka-halaman";

export const metadata: Metadata = { title: "Ganti Password" };

// Wajib setelah login pertama (password lama hasil migrasi). Formnya dibuat di Fase 3.5.
export default function HalamanGantiPassword() {
  return (
    <KerangkaHalaman judul="Ganti Password" role={["Penyuluh", "Admin_BPP", "Admin_Kab", "Dinas"]}>
      <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
        Form ganti password sedang dibangun.
      </div>
    </KerangkaHalaman>
  );
}
