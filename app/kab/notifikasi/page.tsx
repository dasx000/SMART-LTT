import type { Metadata } from "next";
import { Info } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatAngka, formatTanggalJam } from "@/lib/format";
import { sakelarNotifPpl } from "@/lib/pengaturan";
import { pushAktif } from "@/lib/push";
import { SakelarNotifikasi } from "./sakelar";

export const metadata: Metadata = { title: "Notifikasi — SMART LTT" };

export default function HalamanNotifikasi() {
  return (
    <KerangkaHalaman judul="Notifikasi" role={["admin_kab"]} gaya="kab">
      <Isi />
    </KerangkaHalaman>
  );
}

/** On/off notifikasi push ke PPL + ringkasan perangkat yang berlangganan. */
async function Isi() {
  await wajibRole("admin_kab");
  const s = await supabaseServer();
  const sakelar = await sakelarNotifPpl(s);

  // Jumlah langganan (tabel hanya bisa dibaca service role; halaman ini sudah dikunci ke Admin Kab)
  const { data: lgn, error } = await supabaseAdmin().from("push_langganan").select("user_id, terakhir_kirim");
  const perangkat = lgn?.length ?? 0;
  const ppl = new Set((lgn ?? []).map((r) => r.user_id)).size;
  const terakhir = (lgn ?? []).map((r) => r.terakhir_kirim as string | null).filter(Boolean).sort().at(-1) ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Notifikasi</h2>
        <p className="text-[11px] text-gray-500">Push notifikasi ke HP/laptop PPL yang sudah mengizinkan notifikasi</p>
      </div>

      {!pushAktif() && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">
          Kunci VAPID belum diisi di server (Environment Variables Vercel). Notifikasi belum bisa dikirim.
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <SakelarNotifikasi awal={sakelar.aktif} />
          {sakelar.updatedAt && <p className="mt-4 text-[11px] text-gray-400">Terakhir diubah {formatTanggalJam(sakelar.updatedAt)}</p>}
          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-gray-600">
            <li><b>Pengingat Target Padi</b>: setiap hari ± 07.00 WIB ke PPL yang desa binaannya belum punya target Padi bulan berjalan. Berhenti sendiri bila semua desa sudah terisi.</li>
            <li>Saat <b>NONAKTIF</b>: jadwal harian tidak mengirim apa pun, tombol &ldquo;Aktifkan Notifikasi&rdquo; di akun PPL disembunyikan. Langganan PPL tetap disimpan, jadi saat diaktifkan lagi PPL tidak perlu mengizinkan ulang.</li>
            <li>PPL tetap bisa mematikan notifikasi di perangkatnya sendiri lewat menu Profil.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-bold text-gray-800">Langganan</p>
          {error ? (
            <p className="text-xs text-gray-500">Belum tersedia (migrasi 0016 belum dijalankan).</p>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-cyan-50 p-3">
                <dt className="text-[10px] font-bold text-cyan-700 uppercase">PPL berlangganan</dt>
                <dd className="text-xl font-bold text-gray-800">{formatAngka(ppl)}</dd>
              </div>
              <div className="rounded-xl bg-cyan-50 p-3">
                <dt className="text-[10px] font-bold text-cyan-700 uppercase">Perangkat</dt>
                <dd className="text-xl font-bold text-gray-800">{formatAngka(perangkat)}</dd>
              </div>
            </dl>
          )}
          <p className="mt-3 flex items-start gap-2 text-[11px] text-gray-500">
            <Info size={13} className="mt-0.5 shrink-0" />
            {terakhir ? `Notifikasi terakhir terkirim ${formatTanggalJam(terakhir)}.` : "Belum ada notifikasi yang terkirim."}
          </p>
        </div>
      </div>
    </div>
  );
}
