import { z } from "zod";

export const skemaLaporanLtt = z.object({
  desaId: z.coerce.number().int().positive("Desa wajib dipilih."),
  komoditas: z.enum(["Jagung", "Ubi Kayu"]),
  realisasiTanam: z.coerce.number().min(0, "Luas tanam minimal 0."),
  realisasiPanen: z.coerce.number().min(0, "Luas panen minimal 0."),
  keterangan: z.string().trim().max(500, "Keterangan maksimal 500 karakter.").optional().default(""),
});

export type InputLaporanLtt = z.infer<typeof skemaLaporanLtt>;

export const skemaEditLaporanLtt = z.object({
  id: z.coerce.number().int().positive(),
  desaId: z.coerce.number().int().positive("Desa wajib dipilih."),
  realisasiTanam: z.coerce.number().min(0, "Luas tanam minimal 0."),
  realisasiPanen: z.coerce.number().min(0, "Luas panen minimal 0."),
  keterangan: z.string().trim().max(500, "Keterangan maksimal 500 karakter.").optional().default(""),
});

export type InputEditLaporanLtt = z.infer<typeof skemaEditLaporanLtt>;

