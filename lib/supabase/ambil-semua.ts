import "server-only";

/**
 * Supabase (PostgREST) membatasi 1.000 baris per permintaan. Laporan se-kabupaten per bulan
 * bisa > 3.000 baris, jadi ambil bertahap supaya total tidak terpotong diam-diam.
 * `buatQuery(dari, sampai)` harus mengembalikan query yang sudah diberi `.range(dari, sampai)`
 * dan diurutkan stabil (mis. `.order("id")`).
 */
export async function ambilSemua<T>(
  buatQuery: (dari: number, sampai: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  ukuran = 1000,
  batas = 50_000,
): Promise<T[]> {
  const hasil: T[] = [];
  for (let dari = 0; dari < batas; dari += ukuran) {
    const { data, error } = await buatQuery(dari, dari + ukuran - 1);
    if (error) throw new Error(error.message);
    const isi = data ?? [];
    hasil.push(...isi);
    if (isi.length < ukuran) break;
  }
  return hasil;
}
