/** searchParams halaman (Next 16: Promise). Dibaca di dalam komponen ber-Suspense. */
export type CariParam = Promise<Record<string, string | string[] | undefined>>;

export function teksParam(q: Record<string, string | string[] | undefined>, kunci: string): string | null {
  const v = q[kunci];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : null;
}

export function angkaParam(
  q: Record<string, string | string[] | undefined>,
  kunci: string,
  min: number,
  max: number,
  bawaan: number,
): number {
  const n = Number(teksParam(q, kunci));
  return Number.isInteger(n) && n >= min && n <= max ? n : bawaan;
}

/** URL baru dari parameter sekarang + perubahan (null = hapus). Untuk tautan filter, halaman, ?edit=. */
export function urlDengan(
  dasar: string,
  q: Record<string, string | string[] | undefined>,
  ubah: Record<string, string | number | null>,
): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) u.set(k, s);
  }
  for (const [k, v] of Object.entries(ubah)) {
    if (v === null || v === "") u.delete(k);
    else u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `${dasar}?${s}` : dasar;
}
