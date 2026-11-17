import type { Metadata } from "next";
import { SelectOtomatis } from "@/components/select-otomatis";
import Form from "next/form";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { TombolMuatUlang } from "@/components/tombol-muat-ulang";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { formatTanggalJam } from "@/lib/format";
import { angkaParam, urlDengan, type CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Log Sinkronisasi — SMART LTT" };

export default function HalamanLogs({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Log Sinkronisasi" role={["admin_kab"]} gaya="kab">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

type Ket = {
  id_sync?: string | null;
  desa_tidak_cocok?: string[];
  tanggal_tidak_terbaca?: number;
  contoh_tanggal_tidak_terbaca?: string[];
  id_tidak_valid?: number;
} | null;
const tglPanjang = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });

/** Log Sinkronisasi e-Pusluh (aplikasi lama) — halaman & jumlah baris lewat URL. */
async function Isi({ searchParams }: { searchParams: CariParam }) {
  await wajibRole("admin_kab");
  const q = await searchParams;
  const per = [10, 25, 50].includes(angkaParam(q, "per", 1, 50, 10)) ? angkaParam(q, "per", 1, 50, 10) : 10;
  const hal = angkaParam(q, "hal", 1, 100000, 1);
  const s = await supabaseServer();
  const { data, count, error } = await s
    .from("logs_sinkron")
    .select("id, waktu, total_tarik, data_berisi, data_nihil, tanggal_laporan, status, keterangan", { count: "exact" })
    .order("waktu", { ascending: false })
    .range((hal - 1) * per, hal * per - 1);
  const total = count ?? 0;
  const jmlHal = Math.max(1, Math.ceil(total / per));
  const baris = error ? [] : (data ?? []);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Log Sinkronisasi e-Pusluh</h2>
          <p className="text-[11px] text-gray-500">Pantau aktivitas penarikan data padi otomatis</p>
        </div>
        <TombolMuatUlang href="/kab/logs" label="Refresh" className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-600" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase">
                <th className="p-3 text-left">Waktu Sinkronisasi</th>
                <th className="p-3 text-left">ID Sync</th>
                <th className="p-3 text-left">Tanggal Laporan</th>
                <th className="p-3 text-right">Total Tarik</th>
                <th className="p-3 text-right">Data Berisi</th>
                <th className="p-3 text-right">Data Nihil</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {baris.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    {error ? `Gagal memuat log: ${error.message}` : "Belum ada log. Log muncul setelah bot VPS diarahkan ke aplikasi baru."}
                  </td>
                </tr>
              ) : (
                baris.map((l) => {
                  const k = l.keterangan as Ket;
                  const ok = l.status === "Sukses";
                  const sebagian = l.status.startsWith("Sukses") && !ok;
                  return (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="p-3 font-bold text-gray-700">{formatTanggalJam(l.waktu)}</td>
                      <td className="p-3 font-mono text-[10px] text-gray-400">{k?.id_sync ?? "-"}</td>
                      <td className="p-3 font-semibold text-blue-600">{l.tanggal_laporan ? tglPanjang.format(new Date(l.tanggal_laporan)) : "-"}</td>
                      <td className="p-3 text-right font-bold text-gray-800">{l.total_tarik}</td>
                      <td className="p-3 text-right font-bold text-green-600">{l.data_berisi}</td>
                      <td className="p-3 text-right text-gray-400">{l.data_nihil}</td>
                      <td className="p-3 text-center" title={(k?.desa_tidak_cocok ?? []).join("; ")}>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            ok ? "bg-green-50 text-green-600" : sebagian ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-600"
                          }`}
                        >
                          {ok ? <Check size={10} /> : <TriangleAlert size={10} />} {ok ? "Sukses" : sebagian ? "Sebagian" : "Gagal"}
                        </span>
                        {!ok && (
                          <div className="mt-1 max-w-[16rem] space-y-0.5 text-left text-[10px] text-gray-500">
                            {(k?.tanggal_tidak_terbaca ?? 0) > 0 && (
                              <p className="text-red-600">
                                {k?.tanggal_tidak_terbaca} waktu tak terbaca
                                {k?.contoh_tanggal_tidak_terbaca?.length ? `: ${k.contoh_tanggal_tidak_terbaca.map((t) => `"${t}"`).join(", ")}` : ""}
                              </p>
                            )}
                            {(k?.desa_tidak_cocok?.length ?? 0) > 0 && <p>Desa tak dikenal: {k?.desa_tidak_cocok?.join("; ")}</p>}
                            {(k?.id_tidak_valid ?? 0) > 0 && <p>{k?.id_tidak_valid} baris tanpa ID e-Pusluh</p>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 p-3 text-xs text-gray-500">
          <Form action="/kab/logs" scroll={false} className="flex items-center gap-2">
            Baris
            <SelectOtomatis name="per" defaultValue={String(per)} className="rounded-lg border border-gray-200 px-2 py-1 font-bold">
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </SelectOtomatis>
          </Form>
          <span>
            Menampilkan {baris.length ? (hal - 1) * per + 1 : 0} - {(hal - 1) * per + baris.length} dari {total} log
          </span>
          <nav className="flex gap-1" aria-label="Halaman">
            {hal > 1 && (
              <Link href={urlDengan("/kab/logs", q, { hal: hal - 1 })} className="rounded-lg border border-gray-200 p-1.5" aria-label="Sebelumnya">
                <ChevronLeft size={14} />
              </Link>
            )}
            {hal < jmlHal && (
              <Link href={urlDengan("/kab/logs", q, { hal: hal + 1 })} className="rounded-lg border border-gray-200 p-1.5" aria-label="Berikutnya">
                <ChevronRight size={14} />
              </Link>
            )}
          </nav>
        </div>
      </div>
    </>
  );
}
