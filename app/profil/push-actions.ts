"use server";

import { z } from "zod";
import { bacaPengguna } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { kirimKePengguna, pushAktif } from "@/lib/push";
import { sakelarNotifPpl } from "@/lib/pengaturan";

export type HasilPush = { sukses: boolean; pesan: string };

const skemaLangganan = z.object({
  endpoint: z.url().max(1000).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Notifikasi saat ini hanya untuk PPL (keputusan user 16 Nov 2026). */
async function pplSesi() {
  const p = await bacaPengguna();
  if (!p || (p.role !== "penyuluh" && p.role !== "admin_bpp")) return null;
  return p;
}

/**
 * Simpan langganan push perangkat ini untuk user sesi.
 * Endpoint unik per browser: bila perangkat dipakai bergantian, langganan pindah ke user yang terakhir login.
 */
export async function simpanLanggananAction(sub: unknown, userAgent: string): Promise<HasilPush> {
  const p = await pplSesi();
  if (!p) return { sukses: false, pesan: "Notifikasi hanya untuk akun PPL." };
  if (!(await sakelarNotifPpl()).aktif) return { sukses: false, pesan: "Notifikasi sedang dinonaktifkan oleh Admin Kabupaten." };
  const cek = skemaLangganan.safeParse(sub);
  if (!cek.success) return { sukses: false, pesan: "Data langganan dari browser tidak valid." };

  const { error } = await supabaseAdmin()
    .from("push_langganan")
    .upsert(
      {
        user_id: p.id,
        endpoint: cek.data.endpoint,
        p256dh: cek.data.keys.p256dh,
        auth: cek.data.keys.auth,
        user_agent: String(userAgent).slice(0, 300),
      },
      { onConflict: "endpoint" },
    );
  if (error) return { sukses: false, pesan: `Gagal menyimpan: ${error.message}` };
  return { sukses: true, pesan: "Notifikasi aktif di perangkat ini." };
}

/** Hapus langganan perangkat ini (hanya milik user sesi). */
export async function hapusLanggananAction(endpoint: string): Promise<HasilPush> {
  const p = await bacaPengguna();
  if (!p) return { sukses: false, pesan: "Sesi Anda berakhir. Silakan login ulang." };
  const { error } = await supabaseAdmin().from("push_langganan").delete().eq("endpoint", String(endpoint)).eq("user_id", p.id);
  if (error) return { sukses: false, pesan: `Gagal: ${error.message}` };
  return { sukses: true, pesan: "Notifikasi dimatikan di perangkat ini." };
}

/** Kirim notifikasi uji ke semua perangkat milik user sesi. */
export async function kirimUjiAction(): Promise<HasilPush> {
  const p = await pplSesi();
  if (!p) return { sukses: false, pesan: "Notifikasi hanya untuk akun PPL." };
  if (!pushAktif()) return { sukses: false, pesan: "Server belum dikonfigurasi untuk notifikasi." };
  if (!(await sakelarNotifPpl()).aktif) return { sukses: false, pesan: "Notifikasi sedang dinonaktifkan oleh Admin Kabupaten." };
  try {
    const h = await kirimKePengguna([p.id], { title: "SMART LTT", body: "Notifikasi uji berhasil. Pengingat target akan muncul seperti ini.", url: "/ppl", tag: "uji" });
    if (h.terkirim === 0) return { sukses: false, pesan: "Tidak ada perangkat aktif. Coba matikan lalu aktifkan lagi." };
    return { sukses: true, pesan: `Terkirim ke ${h.terkirim} perangkat.` };
  } catch (e) {
    return { sukses: false, pesan: e instanceof Error ? e.message : "Gagal mengirim." };
  }
}
