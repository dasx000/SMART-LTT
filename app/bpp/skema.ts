import { z } from "zod";
import { angkaHa } from "@/lib/validasi";

export const skemaEditLaporanBpp = z.object({
  id: z.coerce.number().int().positive(),
  desaId: z.coerce.number().int().positive("Desa wajib dipilih."),
  realisasiTanam: angkaHa("Luas tanam"),
  realisasiPanen: angkaHa("Luas panen"),
  jenisLttId: z.coerce.number().int().positive("Jenis LTT tidak valid.").optional(),
  keterangan: z.string().trim().max(500, "Keterangan maksimal 500 karakter.").optional().default(""),
});

export type InputEditLaporanBpp = z.infer<typeof skemaEditLaporanBpp>;

