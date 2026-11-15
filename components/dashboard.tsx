import type { ReactNode } from "react";
import { Carrot, Sparkles, Sprout, Wheat } from "lucide-react";
import { NAMA_BULAN, formatAngka } from "@/lib/format";
import { kodePeriode } from "@/lib/data";

/** Komponen dashboard tanpa JS (Server Component). Ambang capaian: < 60 merah, 60–84 kuning, ≥ 85 hijau. */

export const persen = (r: number, t: number) => (t > 0 ? Math.round((r / t) * 100) : 0);
export const warnaBadge = (p: number) =>
  p >= 85 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : p >= 60 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-rose-700 bg-rose-50 border-rose-200";
const warnaBar = (p: number) => (p >= 85 ? "bg-emerald-600" : p >= 60 ? "bg-amber-500" : "bg-rose-500");

export const IKON_KOM: Record<string, { ikon: ReactNode; warna: string; garis: string }> = {
  Padi: { ikon: <Wheat className="h-5 w-5" />, warna: "bg-blue-100 text-blue-600", garis: "border-blue-200" },
  Jagung: { ikon: <Sprout className="h-5 w-5" />, warna: "bg-amber-100 text-amber-600", garis: "border-amber-200" },
  "Ubi Kayu": { ikon: <Carrot className="h-5 w-5" />, warna: "bg-orange-100 text-orange-600", garis: "border-orange-200" },
  "PM AAS": { ikon: <Sparkles className="h-5 w-5" />, warna: "bg-emerald-100 text-emerald-700", garis: "border-emerald-200" },
};

export function KartuCapaian({
  label, tanam, panen, target, sub,
}: {
  label: string;
  tanam: number;
  panen: number;
  /** null = tanpa target (PM AAS) */
  target: number | null;
  sub?: string;
}) {
  const g = IKON_KOM[label];
  const p = target === null ? 100 : persen(tanam, target);
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${g.garis}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${g.warna}`}>{g.ikon}</div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase">{label}</p>
            {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
          </div>
        </div>
        {target !== null ? (
          <span className={`rounded-xl border px-2.5 py-1 text-xs font-bold ${warnaBadge(p)}`}>{p}%</span>
        ) : (
          <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">Alsintan</span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-xl font-bold text-gray-800">{formatAngka(tanam)}</span>
        <span className="text-xs text-gray-500">{target !== null ? `/ ${formatAngka(target)} Ha` : "Ha"}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full ${target === null ? "bg-emerald-600" : warnaBar(p)}`} style={{ width: `${Math.min(100, p)}%` }} />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Panen: <strong className="text-amber-700">{formatAngka(panen)} Ha</strong>
      </p>
    </div>
  );
}

/** Pilihan periode (GET → URL). */
export function PilihPeriode({ nilai, pilihan, tersembunyi }: { nilai: { tahun: number; bulan: number }; pilihan: { tahun: number; bulan: number }[]; tersembunyi?: Record<string, string> }) {
  return (
    <form method="get" className="flex items-center gap-2">
      {Object.entries(tersembunyi ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <select
        name="periode"
        defaultValue={kodePeriode(nilai)}
        className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm outline-none focus:border-green-500"
      >
        {pilihan.map((p) => (
          <option key={kodePeriode(p)} value={kodePeriode(p)}>
            {NAMA_BULAN[p.bulan - 1]} {p.tahun}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700">
        Tampilkan
      </button>
    </form>
  );
}
