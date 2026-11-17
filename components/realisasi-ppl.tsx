import Link from "next/link";
import { Goal, TriangleAlert } from "lucide-react";
import { NAMA_BULAN, formatAngka } from "@/lib/format";
import type { ReactNode } from "react";
import { LEGENDA, levelPersen } from "@/lib/warna-persen";
import { SelCapaianPpl, StatusTarget } from "@/components/tabel-realisasi-ppl";
import type { PplRealisasi, RekapRealisasiPpl } from "@/lib/realisasi-ppl";

/** "1 s.d. 17 November 2026" — periode data realisasi. */
export function teksPeriodeRealisasi(d: RekapRealisasiPpl) {
  return `1 s.d. ${Number(d.sampai.slice(8, 10))} ${NAMA_BULAN[d.bulan - 1]} ${d.tahun}`;
}

function Kotak({ label, nilai, satuan, ket, kelas = "border-gray-100 bg-white", warnaLabel = "text-gray-400", warnaKet = "text-gray-500", children }: {
  label: string; nilai: string; satuan?: string; ket?: string; kelas?: string; warnaLabel?: string; warnaKet?: string; children?: ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${kelas}`}>
      <p className={`text-[10px] font-extrabold tracking-wide uppercase ${warnaLabel}`}>{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">
        {nilai} {satuan && <span className="text-xs font-medium opacity-70">{satuan}</span>}
      </p>
      {children}
      {ket && <p className={`mt-0.5 text-[11px] ${warnaKet}`}>{ket}</p>}
    </div>
  );
}

/** Kartu ringkasan: Target (jumlah target desa), Realisasi, Capaian (berwarna), Status isi target. */
export function RingkasanRealisasi({ d, lingkup, saya }: { d: RekapRealisasiPpl; lingkup: string; saya?: PplRealisasi | null }) {
  const cap = d.capaian;
  const lv = cap == null ? null : levelPersen(cap);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kotak label={`Target Tanam · ${lingkup}`} nilai={formatAngka(d.target)} satuan="Ha" ket="Jumlah target desa padi" />
      <Kotak label="Realisasi Tanam" nilai={formatAngka(d.realisasi)} satuan="Ha" ket="Padi semua jenis LTT" />
      <Kotak
        label="Capaian"
        nilai={cap == null ? "–" : `${formatAngka(cap)}%`}
        ket={cap == null ? "Target belum diisi" : lv!.arti}
        kelas={cap == null ? "border-transparent bg-gray-100 text-gray-500" : `border-transparent ${lv!.kelas}`}
        warnaLabel="opacity-85"
        warnaKet="font-bold opacity-85"
      />
      {saya ? (
        <Kotak label="Status Target Anda" nilai={`${saya.terisi}/${saya.desa.length}`} satuan="desa" ket="Desa binaan yang sudah ada targetnya" />
      ) : (
        <Kotak label="Sudah Isi Target" nilai={`${d.sudahIsi}/${d.jumlahPpl}`} satuan="PPL" ket={`${d.lengkap} PPL lengkap semua desa`}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full bg-orange-600" style={{ width: `${d.jumlahPpl ? (d.sudahIsi / d.jumlahPpl) * 100 : 0}%` }} />
          </div>
        </Kotak>
      )}
    </div>
  );
}

export function LegendaRealisasi() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-gray-700">
      {LEGENDA.map((l) => (
        <span key={l.label} className="flex items-center gap-1.5">
          <span className={`inline-block h-4 w-8 rounded ${l.kelas}`} />
          <b>{l.label}</b> {l.arti}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-8 rounded border border-gray-200 bg-gray-100" />
        <b>–</b> Belum isi target
      </span>
    </div>
  );
}

/** Alert PPL yang belum / baru sebagian mengisi target padi bulan itu, dengan tombol Isi Target. */
export function AlertTargetPpl({ p, href }: { p: PplRealisasi; href: string }) {
  const kosong = p.desa.filter((d) => d.target == null).map((d) => d.nama);
  if (kosong.length === 0) return null;
  const belum = p.terisi === 0;
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-3.5 ${belum ? "border-red-200 bg-red-50 text-red-800" : "border-orange-200 bg-orange-50 text-orange-800"}`}>
      <TriangleAlert size={22} className="shrink-0" aria-hidden />
      <div className="min-w-[180px] flex-1">
        <p className="text-sm font-bold">{belum ? "Anda belum mengisi target bulan ini" : `Target ${kosong.length} desa binaan Anda belum diisi`}</p>
        <p className="text-xs">
          {belum ? "Capaian Anda belum bisa dihitung." : "Capaian Anda dihitung tanpa target desa tersebut."} Desa yang belum ada target: {kosong.join(", ")}.
        </p>
      </div>
      <Link
        href={href}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-extrabold text-white transition active:scale-95 ${belum ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"}`}
      >
        <Goal size={14} aria-hidden /> Isi Target
      </Link>
    </div>
  );
}

/** Tabel rincian desa milik satu PPL (tampilan akun penyuluh). */
export function TabelDesaSaya({ p }: { p: PplRealisasi }) {
  const td = "border border-gray-100 p-2.5";
  const angka = `${td} text-right tabular-nums`;
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full min-w-[420px] border-collapse text-xs">
        <thead>
          <tr className="bg-gray-50 text-[10px] font-extrabold tracking-wide text-gray-500 uppercase">
            <th className={`${td} text-left`}>Desa Binaan</th>
            <th className={`${td} text-right`}>Target (Ha)</th>
            <th className={`${td} text-right`}>Realisasi (Ha)</th>
            <th className={`${td} text-right`}>Capaian</th>
          </tr>
        </thead>
        <tbody>
          {p.desa.map((d) => (
            <tr key={d.id}>
              <td className={td}>
                <p className="font-bold text-gray-800">{d.nama}</p>
                {d.target == null && <span className="text-[10px] font-extrabold text-red-600">Target kosong</span>}
              </td>
              <td className={angka}>{d.target == null ? <span className="text-gray-300">–</span> : formatAngka(d.target)}</td>
              <td className={angka}>{formatAngka(d.realisasi)}</td>
              <SelCapaianPpl p={d.capaian} tebal={false} />
            </tr>
          ))}
          <tr className="bg-yellow-100 font-extrabold">
            <td className={td}>
              TOTAL <StatusTarget terisi={p.terisi} jumlah={p.desa.length} />
            </td>
            <td className={angka}>{p.terisi ? formatAngka(p.target) : <span className="text-gray-300">–</span>}</td>
            <td className={angka}>{formatAngka(p.realisasi)}</td>
            <SelCapaianPpl p={p.capaian} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
