import { z } from "zod";

export const skemaEditLaporanKab = z.object({
  id: z.coerce.number().int().positive(),
  desaId: z.coerce.number().int().positive("Desa wajib dipilih."),
  realisasiTanam: z.coerce.number().min(0, "Luas tanam minimal 0."),
  realisasiPanen: z.coerce.number().min(0, "Luas panen minimal 0."),
  luasBera: z.coerce.number().min(0).optional().default(0),
  realisasiOlah: z.coerce.number().min(0).optional().default(0),
  metodePenanaman: z.enum(["Regular", "PM AAS"]).nullable().optional(),
  keterangan: z.string().trim().max(500, "Keterangan maksimal 500 karakter.").optional().default(""),
});

export type InputEditLaporanKab = z.infer<typeof skemaEditLaporanKab>;

