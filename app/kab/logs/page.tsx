import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { formatTanggal, formatTanggalJam } from "@/lib/format";
import { JudulHalaman, Kartu, Kosong, Tabel, sel, selAngka } from "@/components/ui";

export const metadata: Metadata = { title: "Log Sinkron — SMART LTT" };

export default function HalamanLogs() {
  return (
    <KerangkaHalaman judul="SMART LTT · Log Sinkron" role={["admin_kab"]}>
      <Isi />
    </KerangkaHalaman>
  );
}

type Ket = {
  disimpan?: number;
  dihapus_lama?: number;
  desa_tidak_cocok?: string[];
  tanggal_tidak_terbaca?: number;
  id_sync?: string | null;
} | null;

async function Isi() {
  await wajibRole("admin_kab");
  const s = await supabaseServer();
  const { data, error } = await s
    .from("logs_sinkron")
    .select("id, waktu, total_tarik, data_berisi, data_nihil, tanggal_laporan, status, keterangan")
    .order("waktu", { ascending: false })
    .limit(200);

  return (
    <>
      <JudulHalaman judul="Log Sinkron e-Pusluh" sub="Data padi dari bot VPS (11:30, 12:30, 13:30, 22:30 WIB). 200 log terakhir." />
      <Kartu>
        {error ? (
          <Kosong teks={`Gagal memuat log: ${error.message}`} />
        ) : !data || data.length === 0 ? (
          <Kosong teks="Belum ada log sinkron. Log muncul setelah bot VPS diarahkan ke aplikasi baru." />
        ) : (
          <Tabel kepala={["Waktu", "Tgl Laporan", "Status", "Ditarik", "Berisi", "Nihil", "Disimpan", "Catatan"]}>
            {data.map((l) => {
              const k = l.keterangan as Ket;
              const tak = k?.desa_tidak_cocok ?? [];
              const ok = l.status.startsWith("Sukses");
              return (
                <tr key={l.id}>
                  <td className={sel}>{formatTanggalJam(l.waktu)}</td>
                  <td className={sel}>{l.tanggal_laporan ? formatTanggal(l.tanggal_laporan) : "-"}</td>
                  <td className={`${sel} font-bold ${ok ? (l.status === "Sukses" ? "text-primary" : "text-warning") : "text-danger"}`}>{l.status}</td>
                  <td className={selAngka}>{l.total_tarik}</td>
                  <td className={selAngka}>{l.data_berisi}</td>
                  <td className={selAngka}>{l.data_nihil}</td>
                  <td className={selAngka}>{k?.disimpan ?? "-"}</td>
                  <td className={`${sel} max-w-72 whitespace-normal text-[11px] text-muted`}>
                    {tak.length > 0 && <div>Desa tak cocok: {tak.join("; ")}</div>}
                    {(k?.tanggal_tidak_terbaca ?? 0) > 0 && <div>Tanggal tak terbaca: {k?.tanggal_tidak_terbaca}</div>}
                  </td>
                </tr>
              );
            })}
          </Tabel>
        )}
      </Kartu>
    </>
  );
}
