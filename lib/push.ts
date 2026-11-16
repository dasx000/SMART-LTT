import "server-only";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type IsiPush = { title: string; body: string; url?: string; tag?: string };

type Langganan = { id: number; user_id: string; endpoint: string; p256dh: string; auth: string };

let siap = false;

/** true jika kunci VAPID sudah diisi di env. */
export function pushAktif(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function setel() {
  if (siap) return;
  if (!pushAktif()) throw new Error("Kunci VAPID (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) belum diisi.");
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@smartltt.local",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  siap = true;
}

/**
 * Kirim satu notifikasi ke SEMUA perangkat milik user-user tersebut.
 * Langganan yang sudah kedaluwarsa (404/410 dari layanan push) dihapus otomatis.
 * Pemanggil WAJIB sudah memeriksa hak akses — fungsi ini memakai service role.
 */
export async function kirimKePengguna(userIds: string[], isi: IsiPush | ((userId: string) => IsiPush)) {
  setel();
  const hasil = { terkirim: 0, gagal: 0, dihapus: 0 };
  if (userIds.length === 0) return hasil;

  const a = supabaseAdmin();
  const langganan: Langganan[] = [];
  for (let i = 0; i < userIds.length; i += 200) {
    const { data, error } = await a
      .from("push_langganan")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", userIds.slice(i, i + 200));
    if (error) throw new Error(error.message);
    langganan.push(...((data ?? []) as Langganan[]));
  }

  const kedaluwarsa: number[] = [];
  const berhasil: number[] = [];
  // Dikirim per kelompok 20 agar tidak membanjiri layanan push / habis waktu fungsi.
  for (let i = 0; i < langganan.length; i += 20) {
    await Promise.all(
      langganan.slice(i, i + 20).map(async (l) => {
        const payload = typeof isi === "function" ? isi(l.user_id) : isi;
        try {
          await webpush.sendNotification(
            { endpoint: l.endpoint, keys: { p256dh: l.p256dh, auth: l.auth } },
            JSON.stringify(payload),
            { TTL: 60 * 60 * 12, urgency: "normal" },
          );
          hasil.terkirim++;
          berhasil.push(l.id);
        } catch (e) {
          const kode = (e as { statusCode?: number }).statusCode;
          if (kode === 404 || kode === 410) kedaluwarsa.push(l.id);
          else hasil.gagal++;
        }
      }),
    );
  }

  if (kedaluwarsa.length) {
    await a.from("push_langganan").delete().in("id", kedaluwarsa);
    hasil.dihapus = kedaluwarsa.length;
  }
  if (berhasil.length) {
    await a.from("push_langganan").update({ terakhir_kirim: new Date().toISOString() }).in("id", berhasil);
  }
  return hasil;
}
