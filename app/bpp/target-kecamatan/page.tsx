import { redirect } from "next/navigation";
import { angkaParam, type CariParam } from "@/lib/param";

/** Menu lama "Target Kecamatan" sudah digabung ke "Target Komoditas" (/bpp/target), 24 Nov 2026. */
export default async function HalamanTargetKecamatanLama({ searchParams }: { searchParams: CariParam }) {
  const tahun = angkaParam(await searchParams, "tahun", 2000, 2100, 0);
  redirect(tahun ? `/bpp/target?tahun=${tahun}` : "/bpp/target");
}
