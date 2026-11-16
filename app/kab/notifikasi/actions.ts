"use server";

import { revalidatePath } from "next/cache";
import { wajibRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { KUNCI_NOTIF_PPL, sakelarNotifPpl } from "@/lib/pengaturan";
import { kirimPengingatTargetPadi } from "@/lib/pengingat-target";
import { pushAktif } from "@/lib/push";

export type HasilNotif = { sukses: boolean; pesan: string };

/** On/off notifikasi PPL — hanya Admin Kab (RLS ltt.pengaturan memeriksa ulang). */
export async function setelNotifPplAction(aktif: boolean): Promise<HasilNotif> {
  const p = await wajibRole("admin_kab");
  const s = await supabaseServer();
  const { error } = await s
    .from("pengaturan")
    .upsert({ kunci: KUNCI_NOTIF_PPL, nilai: { aktif: Boolean(aktif) }, diubah_oleh: p.id }, { onConflict: "kunci" });
  if (error) return { sukses: false, pesan: `Gagal menyimpan: ${error.message}` };

  revalidatePath("/kab/notifikasi");
  revalidatePath("/ppl");
  revalidatePath("/profil");
  return { sukses: true, pesan: aktif ? "Notifikasi PPL diaktifkan." : "Notifikasi PPL dinonaktifkan. Tidak ada notifikasi yang dikirim ke PPL." };
}

/** Kirim pengingat target Padi sekarang (tanpa menunggu jadwal 07.00 WIB). */
export async function kirimPengingatSekarangAction(): Promise<HasilNotif> {
  await wajibRole("admin_kab");
  if (!pushAktif()) return { sukses: false, pesan: "Kunci VAPID belum diisi di server." };
  if (!(await sakelarNotifPpl()).aktif) return { sukses: false, pesan: "Notifikasi PPL sedang nonaktif. Aktifkan dulu." };
  try {
    const h = await kirimPengingatTargetPadi();
    if (h.ppl === 0) return { sukses: true, pesan: "Tidak ada PPL berlangganan yang target Padinya belum lengkap. Tidak ada yang dikirim." };
    return { sukses: true, pesan: `Dikirim ke ${h.ppl} PPL (${h.terkirim} perangkat${h.gagal ? `, ${h.gagal} gagal` : ""}${h.dihapus ? `, ${h.dihapus} langganan kedaluwarsa dihapus` : ""}).` };
  } catch (e) {
    return { sukses: false, pesan: e instanceof Error ? e.message : "Gagal mengirim." };
  }
}
