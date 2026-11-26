import Link from "next/link";
import { Goal, TriangleAlert } from "lucide-react";
import { NAMA_BULAN, formatAngka } from "@/lib/format";
import type { ReactNode } from "react";
import { LEGENDA, levelPersen, warnaSelisih } from "@/lib/warna-persen";
import { SelCapaianPpl, StatusTarget } from "@/components/tabel-realisasi-ppl";
import type { DesaRealisasi, PplRealisasi, RekapRealisasiPpl } from "@/lib/realisasi-ppl";

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

/**
 * Kartu ringkasan.
 * - Akun PPL (`saya`): Target isian, Realisasi, Capaian, Status target sendiri.
 * - Kab/BPP: Target Provinsi, Realisasi, Capaian vs provinsi, Isian PPL vs Provinsi.
 */
export function RingkasanRealisasi({ d, lingkup, saya, komoditas = "Padi", pmAas = false }: { d: RekapRealisasiPpl; lingkup: string; saya?: PplRealisasi | null; komoditas?: string; pmAas?: boolean }) {
  if (!saya) return <RingkasanProvinsi d={d} lingkup={lingkup} komoditas={komoditas} />;
  const kom = komoditas.toLowerCase();
  const cap = d.capaian;
  const lv = cap == null ? null : levelPersen(cap);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kotak label={`Target Tanam${pmAas ? " PM-AAS" : ""} · ${lingkup}`} nilai={formatAngka(d.target)} satuan="Ha" ket={pmAas ? "Jumlah target PM-AAS desa" : `Jumlah target desa ${kom}`} />
      <Kotak label={`Realisasi Tanam${pmAas ? " PM-AAS" : ""}`} nilai={formatAngka(d.realisasi)} satuan="Ha" ket={pmAas ? "Padi metode PM-AAS, semua jenis LTT" : `${komoditas} semua jenis LTT`} />
      <Kotak
        label="Capaian"
        nilai={cap == null ? "–" : `${formatAngka(cap)}%`}
        ket={cap == null ? "Target belum diisi" : lv!.arti}
        kelas={cap == null ? "border-transparent bg-gray-100 text-gray-500" : `border-transparent ${lv!.kelas}`}
        warnaLabel="opacity-85"
        warnaKet="font-bold opacity-85"
      />
      <Kotak label={`Status Target${pmAas ? " PM-AAS" : ""} Anda`} nilai={`${saya.terisi}/${saya.desa.length}`} satuan="desa" ket={`Desa binaan yang sudah ada target${pmAas ? " PM-AAS" : "nya"}`} />
    </div>
  );
}

function RingkasanProvinsi({ d, lingkup, komoditas }: { d: RekapRealisasiPpl; lingkup: string; komoditas: string }) {
  const cap = d.capaianProv;
  const lv = cap == null ? null : levelPersen(cap);
  const sel = d.targetProv == null ? null : d.target - d.targetProv;
  const w = sel == null ? null : warnaSelisih(sel);
  const persenIsi = d.targetProv ? Math.min(100, (d.target / d.targetProv) * 100) : 0;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kotak
        label={`Target Provinsi · ${lingkup}`}
        nilai={d.targetProv == null ? "–" : formatAngka(d.targetProv)}
        satuan={d.targetProv == null ? undefined : "Ha"}
        ket={d.targetProv == null ? "Belum diisi Admin Kab" : `Target tanam ${komoditas.toLowerCase()} dari provinsi`}
      />
      <Kotak label="Realisasi Tanam" nilai={formatAngka(d.realisasi)} satuan="Ha" ket={`${komoditas} semua jenis LTT`} />
      <Kotak
        label="Capaian vs Provinsi"
        nilai={cap == null ? "–" : `${formatAngka(cap)}%`}
        ket={cap == null ? "Target provinsi belum diisi" : lv!.arti}
        kelas={cap == null ? "border-transparent bg-gray-100 text-gray-500" : `border-transparent ${lv!.kelas}`}
        warnaLabel="opacity-85"
        warnaKet="font-bold opacity-85"
      />
      <Kotak label="Isian PPL vs Provinsi" nilai={formatAngka(d.target)} satuan="Ha" ket={`${d.sudahIsi}/${d.jumlahPpl} PPL sudah isi target · ${d.lengkap} lengkap`}>
        {w && (
          <p className={`text-[11px] font-extrabold ${w.kelas}`}>
            {Math.abs(sel!) < 0.005 ? "Sesuai target provinsi" : `${sel! < 0 ? "Kurang" : "Lebih"} ${formatAngka(Math.abs(sel!))} Ha dari provinsi`}
          </p>
        )}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full bg-orange-600" style={{ width: `${persenIsi}%` }} />
        </div>
      </Kotak>
    </div>
  );
}

/** `selisih` = tampilkan juga arti warna selisih isian PPL vs provinsi (Kab/BPP). */
export function LegendaRealisasi({ selisih = false }: { selisih?: boolean }) {
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
      {selisih && (
        <span>
          Selisih isian PPL vs provinsi: <b className="text-red-600">kurang</b> · <b className="text-green-700">sesuai</b> · <b className="text-blue-600">lebih</b>
        </span>
      )}
    </div>
  );
}

/** Alert PPL yang belum / baru sebagian mengisi target komoditas bulan itu, dengan tombol Isi Target. */
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

/**
 * Tabel rincian desa milik satu PPL (tampilan akun penyuluh).
 * `aksi` (opsional) = isi tambahan di bawah nama desa, mis. tombol Isi Target PM-AAS.
 */
export function TabelDesaSaya({ p, aksi }: { p: PplRealisasi; aksi?: (d: DesaRealisasi) => ReactNode }) {
  // Muat di layar HP (±320px) tanpa geser samping: tanpa min-width, padding rapat
  const td = "border border-gray-100 px-1.5 py-2 sm:p-2.5";
  const angka = `${td} text-right tabular-nums whitespace-nowrap`;
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-50 text-[9px] leading-tight font-extrabold text-gray-500 uppercase sm:text-[10px] sm:tracking-wide">
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
                {d.target == null && <span className="block text-[10px] font-extrabold text-red-600">Target kosong</span>}
                {aksi?.(d)}
              </td>
              <td className={angka}>{d.target == null ? <span className="text-gray-300">–</span> : formatAngka(d.target)}</td>
              <td className={angka}>{formatAngka(d.realisasi)}</td>
              <SelCapaianPpl p={d.capaian} tebal={false} rapat />
            </tr>
          ))}
          <tr className="bg-yellow-100 font-extrabold">
            <td className={td}>
              TOTAL
              <div className="mt-0.5"><StatusTarget terisi={p.terisi} jumlah={p.desa.length} nol={p.terisi > 0 && Math.abs(p.target) < 0.005} /></div>
            </td>
            <td className={angka}>{p.terisi ? formatAngka(p.target) : <span className="text-gray-300">–</span>}</td>
            <td className={angka}>{formatAngka(p.realisasi)}</td>
            <SelCapaianPpl p={p.capaian} rapat />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
