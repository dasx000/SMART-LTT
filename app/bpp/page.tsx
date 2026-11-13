import type { Metadata } from "next";
import { KerangkaHalaman } from "@/components/kerangka-halaman";

export const metadata: Metadata = { title: "Koordinator BPP" };

export default function HalamanBPP() {
  return (
    <KerangkaHalaman judul="SMART LTT · BPP" role={["Admin_BPP"]}>
      <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
        Halaman Koordinator BPP sedang dibangun. <br />
        Dashboard kecamatan, laporan LTT, target, kelola PPL, produktivitas & sarana.
      </div>
    </KerangkaHalaman>
  );
}
