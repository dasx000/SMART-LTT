import type { Metadata } from "next";
import { Download, ShieldAlert } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { formatAngka, formatTanggalJam } from "@/lib/format";
import { PengingatBackup } from "@/components/pengingat-backup";

export const metadata: Metadata = { title: "Backup Data — SMART LTT" };

export default function HalamanBackup() {
  return (
    <KerangkaHalaman judul="Backup Data" role={["admin_kab"]} gaya="kab">
      <Isi />
    </KerangkaHalaman>
  );
}

const ukuranTeks = (b: number) => (b >= 1_048_576 ? `${(b / 1_048_576).toFixed(2)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Backup manual: tombol unduh file .json.gz (lihat /api/backup) + riwayat 20 unduhan terakhir. */
async function Isi() {
  await wajibRole("admin_kab");
  const s = await supabaseServer();
  const { data, error } = await s
    .from("riwayat_backup")
    .select("id, waktu, nama, jumlah_baris, ukuran_byte")
    .order("waktu", { ascending: false })
    .limit(20);
  const riwayat = error ? [] : (data ?? []);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Backup Data</h2>
        <p className="text-[11px] text-gray-500">Unduh salinan seluruh data SMART LTT ke perangkat Anda</p>
      </div>

      <PengingatBackup />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        {/* <a> biasa (bukan <Link>): tidak di-prefetch, jadi backup hanya dibuat saat tombol ditekan. */}
        <a
          href="/api/backup"
          download
          className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 active:scale-95"
        >
          <Download size={16} /> Unduh Backup Sekarang
        </a>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-gray-600">
          <li>Format <b>.json.gz</b> (terkompresi, sekitar 0,5 MB). Bisa dibuka dengan 7-Zip/WinRAR bila perlu dilihat.</li>
          <li>Isi: wilayah, jenis LTT, pengguna (nama, NIP, email, WA, desa binaan), laporan LTT, target, PM AAS, produktivitas, sarana, dan log.</li>
          <li><b>Password tidak ikut</b> (juga tidak dalam bentuk hash), begitu pula kunci API. Setelah pemulihan total, password pengguna perlu di-reset.</li>
          <li>Disarankan unduh minimal <b>seminggu sekali</b>, lalu simpan juga di Google Drive pribadi.</li>
        </ul>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          File berisi data pribadi pegawai (NIP, email, nomor WA). Simpan di tempat aman dan jangan dibagikan ke grup.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <p className="border-b border-gray-100 px-5 py-3 text-sm font-bold text-gray-800">Riwayat Unduh Backup</p>
        {riwayat.length === 0 ? (
          <p className="px-5 py-6 text-center text-xs text-gray-500">{error ? "Riwayat belum tersedia (migrasi 0013 belum dijalankan)." : "Belum ada riwayat."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-left text-[10px] font-bold text-gray-500 uppercase">
                  <th className="px-5 py-2">Waktu</th>
                  <th className="px-5 py-2">Oleh</th>
                  <th className="px-5 py-2 text-right">Baris</th>
                  <th className="px-5 py-2 text-right">Ukuran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {riwayat.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-2 whitespace-nowrap">{formatTanggalJam(r.waktu)}</td>
                    <td className="px-5 py-2">{r.nama ?? "-"}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{formatAngka(r.jumlah_baris)}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{ukuranTeks(r.ukuran_byte)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
