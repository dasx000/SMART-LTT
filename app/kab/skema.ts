import { z } from "zod";
import { angkaHa } from "@/lib/validasi";

export const skemaEditLaporanKab = z.object({
  id: z.coerce.number().int().positive(),
  desaId: z.coerce.number().int().positive("Desa wajib dipilih."),
  realisasiTanam: angkaHa("Luas tanam"),
  realisasiPanen: angkaHa("Luas panen"),
  luasBera: angkaHa("Luas bera"),
  realisasiOlah: angkaHa("Olah lahan"),
  metodePenanaman: z.enum(["Regular", "PM AAS"]).nullable().optional(),
  keterangan: z.string().trim().max(500, "Keterangan maksimal 500 karakter.").optional().default(""),
});

export type InputEditLaporanKab = z.infer<typeof skemaEditLaporanKab>;

