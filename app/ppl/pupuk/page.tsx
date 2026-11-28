import type { Metadata } from "next";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { KalkulatorPupuk } from "@/components/kalkulator-pupuk";

export const metadata: Metadata = { title: "Kalkulator Pupuk — SMART LTT" };

/** /ppl/pupuk — hitung kebutuhan pupuk bersubsidi per fase dari luas lahan (porting dari TANIKU). */
export default function HalamanKalkulatorPupuk() {
  return (
    <KerangkaHalaman
      judul="Kalkulator Pupuk"
      role={["penyuluh", "admin_bpp"]}
      panel={{ judul: "Kalkulator Pupuk", sub: "Dosis pupuk bersubsidi sesuai luas lahan" }}
    >
      <KalkulatorPupuk />
    </KerangkaHalaman>
  );
}
