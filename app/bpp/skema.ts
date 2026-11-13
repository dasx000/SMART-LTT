import { z } from "zod";

export const skemaTargetKecamatan = z.object({
  bulan: z.coerce.number().int().min(1, "Bulan harus antara 1-12.").max(12, "Bulan harus antara 1-12."),
  komoditas: z.enum(["Padi", "Jagung", "Ubi Kayu"]),
  targetTanam: z.coerce.number().min(0, "Target tanam tidak boleh negatif."),
  targetPanen: z.coerce.number().min(0, "Target panen tidak boleh negatif."),
});

export type InputTargetKecamatan = z.infer<typeof skemaTargetKecamatan>;

export const skemaEditLaporanBpp = z.object({
  id: z.coerce.number().int().positive(),
  desaId: z.coerce.number().int().positive("Desa wajib dipilih."),
  realisasiTanam: z.coerce.number().min(0, "Luas tanam minimal 0."),
  realisasiPanen: z.coerce.number().min(0, "Luas panen minimal 0."),
  keterangan: z.string().trim().max(500, "Keterangan maksimal 500 karakter.").optional().default(""),
});

export type InputEditLaporanBpp = z.infer<typeof skemaEditLaporanBpp>;

