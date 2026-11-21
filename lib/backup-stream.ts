import { supabaseAdmin } from "@/lib/supabase/admin";
import { TABEL_BACKUP, VERSI_BACKUP, type TabelBackup } from "@/lib/backup";

/**
 * Pembuat stream backup (.json.gz) — dipakai bersama oleh /api/backup (cookie, Admin Kab)
 * dan /api/v1/backup (API key). Hanya server. Otorisasi dilakukan pemanggil.
 *
 * Isi: {"versi":1,"dibuat":"…","oleh":"…","tabel":{"ltt.kecamatan":[…],…},"dilewati":[…]}
 * Dibaca dengan service role (melewati RLS). Dikirim bertahap per tabel per 1000 baris
 * (stream + gzip) agar hemat memori dan tidak terkena batas ukuran respons Vercel.
 */
const HALAMAN = 1000;

export type CatatanBackup = { jumlahBaris: number; ukuranByte: number };

/**
 * @param oleh    teks yang ditulis di field "oleh" pada file backup
 * @param catat   dipanggil sekali setelah SELURUH file terkirim (tidak dipanggil bila stream gagal)
 * @throws bila daftar anggota gagal dibaca (sebelum stream dimulai)
 */
export async function buatStreamBackup(
  oleh: string,
  catat: (c: CatatanBackup) => Promise<void>,
): Promise<ReadableStream<Uint8Array>> {
  const a = supabaseAdmin();

  // Anggota SMART LTT → batasi core.profiles ke mereka saja (project dipakai aplikasi lain).
  const { data: mem, error: eMem } = await a.schema("core").from("memberships").select("user_id").eq("app_slug", "ltt");
  if (eMem) throw new Error(`Gagal membaca data: ${eMem.message}`);
  const idAnggota = (mem ?? []).map((m) => m.user_id as string);

  async function halaman(t: TabelBackup, dari: number) {
    let q = a.schema(t.skema).from(t.nama).select("*");
    if (t.skema === "core" && t.nama === "memberships") q = q.eq("app_slug", "ltt");
    if (t.skema === "core" && t.nama === "profiles")
      q = q.in("id", idAnggota.length ? idAnggota : ["00000000-0000-0000-0000-000000000000"]);
    for (const kol of t.urut.split(",")) q = q.order(kol, { ascending: true });
    return q.range(dari, dari + HALAMAN - 1);
  }

  const enc = new TextEncoder();
  let jumlahBaris = 0;
  let ukuranByte = 0;

  const json = new ReadableStream<Uint8Array>({
    async start(c) {
      const tulis = (s: string) => c.enqueue(enc.encode(s));
      const dilewati: string[] = [];
      try {
        tulis(`{"versi":${VERSI_BACKUP},"dibuat":${JSON.stringify(new Date().toISOString())},"oleh":${JSON.stringify(oleh)},"tabel":{`);
        let tabelPertama = true;
        for (const t of TABEL_BACKUP) {
          const namaPenuh = `${t.skema}.${t.nama}`;
          let dari = 0;
          let barisPertama = true;
          let mulai = false;
          for (;;) {
            const { data, error } = await halaman(t, dari);
            if (error) {
              // Tabel belum dibuat (migrasi belum dijalankan) → lewati, catat di file. Error lain → gagal.
              if (error.code === "PGRST205" || error.code === "42P01") { dilewati.push(namaPenuh); break; }
              throw new Error(`${namaPenuh}: ${error.message}`);
            }
            if (!mulai) {
              tulis(`${tabelPertama ? "" : ","}${JSON.stringify(namaPenuh)}:[`);
              tabelPertama = false;
              mulai = true;
            }
            for (const baris of data ?? []) {
              tulis((barisPertama ? "" : ",") + JSON.stringify(baris));
              barisPertama = false;
            }
            jumlahBaris += data?.length ?? 0;
            if (!data || data.length < HALAMAN) break;
            dari += HALAMAN;
          }
          if (mulai) tulis("]");
        }
        tulis(`},"dilewati":${JSON.stringify(dilewati)}}`);
        c.close();
      } catch (e) {
        console.error("[backup]", e);
        c.error(e); // unduhan terputus → klien menandai gagal, file tidak utuh
      }
    },
  });

  // Hitung ukuran file terkompresi; catat setelah seluruh file terkirim.
  const hitung = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, c) {
      ukuranByte += chunk.byteLength;
      c.enqueue(chunk);
    },
    async flush() {
      await catat({ jumlahBaris, ukuranByte });
    },
  });

  // Tipe bawaan CompressionStream (BufferSource) tidak cocok persis dengan Uint8Array di TS — isinya sama.
  const gzip = new CompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>;
  return json.pipeThrough(gzip).pipeThrough(hitung);
}

/** Header unduhan .json.gz (nama file memakai tanggal WIB). */
export const headerBackup = (tanggalIso: string) => ({
  "Content-Type": "application/gzip",
  "Content-Disposition": `attachment; filename="SMART-LTT-backup-${tanggalIso}.json.gz"`,
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
});
