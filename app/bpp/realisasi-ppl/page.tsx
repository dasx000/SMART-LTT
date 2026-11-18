import type { Metadata } from "next";
import Form from "next/form";
import { CalendarDays, UserRoundCheck } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { SelectOtomatis } from "@/components/select-otomatis";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB } from "@/lib/format";
import { daftarKecamatan, kodePeriode, periodeDariParam } from "@/lib/data";
import { teksParam, type CariParam } from "@/lib/param";
import { rekapRealisasiPpl } from "@/lib/realisasi-ppl";
import { LegendaRealisasi, RingkasanRealisasi, teksPeriodeRealisasi } from "@/components/realisasi-ppl";
import { TabelRealisasiPpl } from "@/components/tabel-realisasi-ppl";
import { Kosong } from "@/components/ui";

export const metadata: Metadata = { title: "Realisasi per PPL — SMART LTT" };

export default function HalamanRealisasiPplBpp({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="BPP" role={["admin_bpp"]} gaya="bpp">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

/** Realisasi LTT Padi per PPL — Admin BPP: hanya kecamatannya sendiri, tanpa unduh. */
async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("admin_bpp");
  if (!p.kecamatanId) return <Kosong teks="Akun Anda belum terikat ke kecamatan. Hubungi Admin Kabupaten." />;
  const q = await searchParams;
  const per = periodeDariParam(teksParam(q, "periode"), bulanTahunWIB());
  const s = await supabaseServer();
  const [kecs, d] = await Promise.all([
    daftarKecamatan(s),
    rekapRealisasiPpl(s, { tahun: per.tahun, bulan: per.bulan, kecamatanId: p.kecamatanId }),
  ]);
  const namaKec = kecs.find((k) => k.id === p.kecamatanId)?.nama ?? "-";

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 border-b border-gray-200 pb-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <UserRoundCheck className="text-green-600" size={20} /> Realisasi LTT Padi per PPL
          </h2>
          <p className="text-xs text-gray-500">Kecamatan {namaKec} · Padi semua jenis LTT · Kumulatif {teksPeriodeRealisasi(d)} · Urut dari pengisian target terendah, lalu capaian terendah</p>
        </div>
        <Form action="/bpp/realisasi-ppl" scroll={false} className="flex items-center gap-2">
          <CalendarDays size={16} className="text-green-600" />
          <SelectOtomatis
            key={kodePeriode(per)}
            name="periode"
            defaultValue={kodePeriode(per)}
            aria-label="Periode"
            className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm outline-none"
          >
            {per.pilihan.slice(0, 6).map((x) => (
              <option key={kodePeriode(x)} value={kodePeriode(x)}>{NAMA_BULAN[x.bulan - 1]} {x.tahun}</option>
            ))}
          </SelectOtomatis>
        </Form>
      </div>

      <RingkasanRealisasi d={d} lingkup={`Kec. ${namaKec}`} />
      <LegendaRealisasi />

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {d.kec.length === 0 ? (
          <Kosong teks="Belum ada PPL aktif dengan desa binaan di kecamatan ini." />
        ) : (
          <TabelRealisasiPpl kec={d.kec} total={null} peringkat={false} />
        )}
        <p className="border-t border-gray-100 px-4 py-3 text-[11px] leading-relaxed text-gray-500">
          Target = jumlah target desa padi yang diisi PPL. PPL yang belum isi target ditaruh paling atas. Klik nama PPL untuk melihat rincian per desa.
        </p>
      </div>
    </div>
  );
}
