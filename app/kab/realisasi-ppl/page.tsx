import type { Metadata } from "next";
import Form from "next/form";
import { CalendarDays, UserRoundCheck } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { SelectOtomatis } from "@/components/select-otomatis";
import { TombolUnduh } from "@/components/tombol-unduh";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB } from "@/lib/format";
import { daftarKecamatan, kodePeriode, periodeDariParam } from "@/lib/data";
import { angkaParam, teksParam, type CariParam } from "@/lib/param";
import { rekapRealisasiPpl } from "@/lib/realisasi-ppl";
import { LegendaRealisasi, RingkasanRealisasi, teksPeriodeRealisasi } from "@/components/realisasi-ppl";
import { TabelRealisasiPpl } from "@/components/tabel-realisasi-ppl";
import { Kosong } from "@/components/ui";

export const metadata: Metadata = { title: "Realisasi per PPL — SMART LTT" };

export default function HalamanRealisasiPplKab({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Realisasi per PPL" role={["admin_kab", "viewer"]} gaya="kab">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

const kelasPilih = "cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm outline-none";

/** Realisasi LTT Padi per PPL — Admin Kab & Viewer: semua kecamatan, bisa difilter, bisa diunduh. */
async function Isi({ searchParams }: { searchParams: CariParam }) {
  await wajibRole("admin_kab", "viewer");
  const q = await searchParams;
  const per = periodeDariParam(teksParam(q, "periode"), bulanTahunWIB());
  const s = await supabaseServer();
  const kecs = await daftarKecamatan(s);
  const kecId = angkaParam(q, "kecamatan", 1, 1_000_000, 0);
  const kecPilih = kecs.find((k) => k.id === kecId) ?? null;
  const d = await rekapRealisasiPpl(s, { tahun: per.tahun, bulan: per.bulan, kecamatanId: kecPilih?.id ?? null });
  const unduh = `/api/unduh/realisasi-ppl?tahun=${per.tahun}&bulan=${per.bulan}${kecPilih ? `&kecamatan=${kecPilih.id}` : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 border-b border-gray-200 pb-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <UserRoundCheck className="text-green-600" size={20} /> Realisasi LTT Padi per PPL
          </h2>
          <p className="text-xs text-gray-500">Padi semua jenis LTT · Kumulatif {teksPeriodeRealisasi(d)} · Kecamatan: isian PPL kurang terbesar dulu, lalu capaian terendah · PPL urut dari pengisian target terendah, lalu capaian terendah</p>
        </div>
        <Form action="/kab/realisasi-ppl" scroll={false} className="flex flex-wrap items-center gap-2">
          <CalendarDays size={16} className="text-green-600" />
          <SelectOtomatis key={kodePeriode(per)} name="periode" defaultValue={kodePeriode(per)} aria-label="Periode" className={kelasPilih}>
            {per.pilihan.slice(0, 6).map((x) => (
              <option key={kodePeriode(x)} value={kodePeriode(x)}>{NAMA_BULAN[x.bulan - 1]} {x.tahun}</option>
            ))}
          </SelectOtomatis>
          <SelectOtomatis key={`k${kecPilih?.id ?? 0}`} name="kecamatan" defaultValue={kecPilih?.id ?? ""} aria-label="Kecamatan" className={kelasPilih}>
            <option value="">Semua Kecamatan</option>
            {kecs.map((k) => (
              <option key={k.id} value={k.id}>{k.nama}</option>
            ))}
          </SelectOtomatis>
          <TombolUnduh href={unduh} />
        </Form>
      </div>

      <RingkasanRealisasi d={d} lingkup={kecPilih ? `Kec. ${kecPilih.nama}` : "Kabupaten"} />
      <LegendaRealisasi selisih />

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {d.kec.length === 0 ? (
          <Kosong teks="Belum ada PPL aktif dengan desa binaan." />
        ) : (
          <TabelRealisasiPpl kec={d.kec} total={kecPilih ? null : { target: d.target, targetProv: d.targetProv, realisasi: d.realisasi, capaianProv: d.capaianProv, sudahIsi: d.sudahIsi, jumlahPpl: d.jumlahPpl }} peringkat={!kecPilih} />
        )}
        <p className="border-t border-gray-100 px-4 py-3 text-[11px] leading-relaxed text-gray-500">
          Baris kabupaten & kecamatan: <b>Provinsi</b> = target dari provinsi (dasar capaian), <b>Isian PPL</b> = jumlah target desa yang diisi PPL beserta selisihnya terhadap provinsi.
          Baris PPL & desa: capaian dihitung terhadap target isian PPL sendiri. Realisasi desa yang belum ada target tetap dihitung. Klik nama PPL untuk melihat rincian per desa.
        </p>
      </div>
    </div>
  );
}
