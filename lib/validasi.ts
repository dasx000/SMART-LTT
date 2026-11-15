import { z } from "zod";
import { parseDesimal } from "@/lib/format";

/**
 * Angka luas (Ha) dari form: menerima "1,5", "1.5", "1.234,5", kosong (= 0).
 * `z.coerce.number()` biasa menolak koma, padahal HP berbahasa Indonesia memakai koma.
 */
export const angkaHa = (label: string, maks = 100_000) =>
  z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? parseDesimal(v) : 0),
    z
      .number({ error: `${label} harus berupa angka.` })
      .refine(Number.isFinite, `${label} harus berupa angka.`)
      .min(0, `${label} tidak boleh negatif.`)
      .max(maks, `${label} terlalu besar.`),
  );
