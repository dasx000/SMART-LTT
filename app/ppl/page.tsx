import type { Metadata } from "next";
import { KerangkaHalaman } from "@/components/kerangka-halaman";

export const metadata: Metadata = { title: "Penyuluh" };

export default function HalamanPPL() {
  return (
    <KerangkaHalaman judul="SMART LTT" role={["Penyuluh", "Admin_BPP"]}>
      <Segera teks="Input laporan LTT, rekap, target, produktivitas, dan sarana desa." />
    </KerangkaHalaman>
  );
}

function Segera({ teks }: { teks: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
      Halaman Penyuluh sedang dibangun. <br />
      {teks}
    </div>
  );
}
