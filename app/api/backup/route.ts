import { bacaPengguna } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tanggalIsoWIB } from "@/lib/format";
import { TABEL_BACKUP, VERSI_BACKUP, type TabelBackup } from "@/lib/backup";

/**
 * GET /api/backup — unduh backup data SMART LTT (.json.gz). HANYA Admin Kab.
 *
 * Isi: {"versi":1,"dibuat":"…","oleh":"…","tabel":{"ltt.kecamatan":[…],…},"dilewati":[…]}
 * Dibaca dengan service role (melewati RLS) — karena itu role diperiksa di sini, tanpa cache.
 * Dikirim bertahap (stream + gzip) per tabel per 1000 baris: hemat memori dan tidak terkena
 * batas ukuran respons Vercel. Setelah selesai, dicatat di ltt.riwayat_backup.
 */
export const maxDuration = 120;

const HALAMAN = 1000;

const teksErr = (pesan: string, status: number) =>
  new Response(pesan, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET() {
  const p = await bacaPengguna();
  if (!p) return teksErr("Silakan login terlebih dahulu.", 401);
  if (p.role !== "admin_kab") return teksErr("Hanya Admin Kabupaten yang boleh mengunduh backup.", 403);

  const a = supabaseAdmin();

  // Anggota SMART LTT → batasi core.profiles ke mereka saja (project dipakai aplikasi lain).
  const { data: mem, error: eMem } = await a.schema("core").from("memberships").select("user_id").eq("app_slug", "ltt");
  if (eMem) return teksErr(`Gagal membaca data: ${eMem.message}`, 500);
  const idAnggota = (mem ?? []).map((m) => m.user_id as string);

  async function halaman(t: TabelBackup, dari: number) {
    let q = a.schema(t.skema).from(t.nama).select("*");
    if (t.skema === "core" && t.nama === "memberships") q = q.eq("app_slug", "ltt");
    if (t.skema === "core" && t.nama === "profiles") q = q.in("id", idAnggota.length ? idAnggota : ["00000000-0000-0000-0000-000000000000"]);
    for (const kol of t.urut.split(",")) q = q.order(kol, { ascending: true });
    return q.range(dari, dari + HALAMAN - 1);
  }

  const enc = new TextEncoder();
  let jumlahBaris = 0;
  let ukuran = 0;

  const json = new ReadableStream<Uint8Array>({
    async start(c) {
      const tulis = (s: string) => c.enqueue(enc.encode(s));
      const dilewati: string[] = [];
      try {
        tulis(`{"versi":${VERSI_BACKUP},"dibuat":${JSON.stringify(new Date().toISOString())},"oleh":${JSON.stringify(p.nama)},"tabel":{`);
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
        c.error(e); // unduhan terputus → browser menandai gagal, file tidak utuh
      }
    },
  });

  // Hitung ukuran file terkompresi; catat riwayat setelah seluruh file terkirim.
  const hitung = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, c) {
      ukuran += chunk.byteLength;
      c.enqueue(chunk);
    },
    async flush() {
      const { error } = await a.from("riwayat_backup").insert({ pengguna_id: p.id, nama: p.nama, jumlah_baris: jumlahBaris, ukuran_byte: ukuran });
      if (error) console.error("[backup] gagal mencatat riwayat:", error.message);
    },
  });

  // Tipe bawaan CompressionStream (BufferSource) tidak cocok persis dengan Uint8Array di TS — isinya sama.
  const gzip = new CompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>;
  const body = json.pipeThrough(gzip).pipeThrough(hitung);
  const nama = `SMART-LTT-backup-${tanggalIsoWIB(new Date())}.json.gz`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${nama}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
