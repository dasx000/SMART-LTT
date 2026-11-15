import { z } from "zod";
import { angkaHa } from "@/lib/validasi";

export const skemaLaporanLtt = z.object({
  desaId: z.coerce.number().int().positive("Desa wajib dipilih."),
  komoditas: z.enum(["Jagung", "Ubi Kayu"]),
  realisasiTanam: angkaHa("Luas tanam"),
  realisasiPanen: angkaHa("Luas panen"),
  keterangan: z.string().trim().max(500, "Keterangan maksimal 500 karakter.").optional().default(""),
});

export type InputLaporanLtt = z.infer<typeof skemaLaporanLtt>;

export const skemaEditLaporanLtt = z.object({
  id: z.coerce.number().int().positive(),
  desaId: z.coerce.number().int().positive("Desa wajib dipilih."),
  realisasiTanam: angkaHa("Luas tanam"),
  realisasiPanen: angkaHa("Luas panen"),
  keterangan: z.string().trim().max(500, "Keterangan maksimal 500 karakter.").optional().default(""),
});

export type InputEditLaporanLtt = z.infer<typeof skemaEditLaporanLtt>;

