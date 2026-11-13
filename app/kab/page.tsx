import type { Metadata } from "next";
import { KerangkaHalaman } from "@/components/kerangka-halaman";

export const metadata: Metadata = { title: "Kabupaten" };

export default function HalamanKab() {
  return (
    <KerangkaHalaman judul="SMART LTT · Kabupaten" role={["Admin_Kab", "Dinas"]}>
      <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
        Halaman Kabupaten sedang dibangun. <br />
        Dashboard, LTT PM AAS, laporan, target, pengguna, logs sinkron, produktivitas & sarana.
      </div>
    </KerangkaHalaman>
  );
}
