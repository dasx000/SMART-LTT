import { kirimPengingatTargetPadi } from "@/lib/pengingat-target";
import { pushAktif } from "@/lib/push";
import { sakelarNotifPpl } from "@/lib/pengaturan";

/**
 * GET /api/cron/pengingat-target — dipanggil Vercel Cron (lihat vercel.json), setiap hari 07.00 WIB.
 * Vercel mengirim header `Authorization: Bearer <CRON_SECRET>`; selain itu ditolak.
 * Mengirim push ke PPL yang target desa Padi bulan berjalan belum lengkap.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const rahasia = process.env.CRON_SECRET;
  if (!rahasia || request.headers.get("authorization") !== `Bearer ${rahasia}`) {
    return Response.json({ ok: false, pesan: "Tidak berhak." }, { status: 401 });
  }
  if (!pushAktif()) return Response.json({ ok: false, pesan: "Kunci VAPID belum diisi." }, { status: 500 });

  try {
    // Dimatikan Admin Kab (/kab/notifikasi) → tidak mengirim apa pun
    if (!(await sakelarNotifPpl()).aktif) return Response.json({ ok: true, dilewati: "Notifikasi PPL dinonaktifkan Admin Kab." });
    const hasil = await kirimPengingatTargetPadi();
    return Response.json({ ok: true, ...hasil });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
