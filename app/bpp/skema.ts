import { z } from "zod";
import { angkaHa } from "@/lib/validasi";

export const skemaTargetKecamatan = z.object({
  bulan: z.coerce.number().int().min(1, "Bulan harus antara 1-12.").max(12, "Bulan harus antara 1-12."),
  komoditas: z.enum(["Padi", "Jagung", "Ubi Kayu"]),
  targetTanam: angkaHa("Target tanam"),
  targetPanen: angkaHa("Target panen"),
});

export type InputTargetKecamatan = z.infer<typeof skemaTargetKecamatan>;

export const skemaEditLaporanBpp = z.object({
  id: z.coerce.number().int().positive(),
  desaId: z.coerce.number().int().positive("Desa wajib dipilih."),
  realisasiTanam: angkaHa("Luas tanam"),
  realisasiPanen: angkaHa("Luas panen"),
  keterangan: z.string().trim().max(500, "Keterangan maksimal 500 karakter.").optional().default(""),
});

export type InputEditLaporanBpp = z.infer<typeof skemaEditLaporanBpp>;

