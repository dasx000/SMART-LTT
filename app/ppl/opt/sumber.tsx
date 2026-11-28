import "server-only";
import { Info } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";

const fmtTanggal = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

/** Keterangan sumber data OPT + tanggal snapshot (dibaca dari taniku.meta). */
export async function KeteranganSumber() {
  let tanggal: string | null = null;
  try {
    const s = await supabaseServer();
    const { data } = await s.schema("taniku").from("meta").select("value").eq("key", "tanggal_tarik_data").maybeSingle();
    const v = data?.value as string | undefined;
    if (v && !Number.isNaN(Date.parse(v))) tanggal = fmtTanggal.format(new Date(v));
  } catch {
    // Keterangan saja — gagal membaca tidak boleh menggagalkan halaman.
  }

  return (
    <div className="mt-8 flex gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-500">
      <Info size={14} className="mt-0.5 shrink-0" />
      <p>
        Sumber: Daftar Pestisida Terdaftar Kementan (ap-simpel.pertanian.go.id)
        {tanggal ? `, data per ${tanggal}` : ""}. Pastikan dosis & cara pakai sesuai label kemasan, dan utamakan
        pengendalian terpadu (PHT).
      </p>
    </div>
  );
}
