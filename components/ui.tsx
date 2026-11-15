import type { ReactNode } from "react";
import { Download } from "lucide-react";

/** Komponen tampilan kecil tanpa JS (Server Component) — dipakai halaman-halaman fitur. */

export function JudulHalaman({ judul, sub, aksi }: { judul: string; sub?: string; aksi?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-black tracking-tight text-foreground">{judul}</h1>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {aksi}
    </div>
  );
}

export function Kartu({ judul, aksi, children, className = "" }: { judul?: string; aksi?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-surface p-4 shadow-xs ${className}`}>
      {(judul || aksi) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {judul && <h2 className="text-sm font-bold text-foreground">{judul}</h2>}
          {aksi}
        </div>
      )}
      {children}
    </section>
  );
}

/** Tombol unduh = tautan biasa ke /api/unduh/... (file dibuat di server, tanpa JS di HP). */
export function TombolUnduh({ href, label = "Unduh Excel" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-strong active:scale-95"
    >
      <Download className="h-4 w-4" aria-hidden /> {label}
    </a>
  );
}

export const kelasInput =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-hidden";
export const kelasTombol =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-strong active:scale-95 disabled:opacity-60";
export const kelasTombolGaris =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold text-foreground transition hover:border-primary/60 active:scale-95 disabled:opacity-60";

/** Form filter GET (tanpa JS): submit → URL baru → halaman dirender ulang di server. */
export function FormFilter({ children }: { children: ReactNode }) {
  return (
    <form method="get" className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-surface p-3">
      {children}
      <button type="submit" className={kelasTombol}>
        Tampilkan
      </button>
    </form>
  );
}

export function Pilihan({ label, name, nilai, opsi }: { label: string; name: string; nilai: string | number; opsi: { v: string | number; t: string }[] }) {
  return (
    <label className="flex min-w-32 flex-col gap-1 text-[11px] font-semibold text-muted">
      {label}
      <select name={name} defaultValue={String(nilai)} className={kelasInput}>
        {opsi.map((o) => (
          <option key={String(o.v)} value={String(o.v)}>
            {o.t}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Tanggal({ label, name, nilai, min, max }: { label: string; name: string; nilai: string; min?: string; max?: string }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted">
      {label}
      <input type="date" name={name} defaultValue={nilai} min={min} max={max} className={kelasInput} />
    </label>
  );
}

/** Tabel sederhana yang bisa digeser horizontal di HP. */
export function Tabel({ kepala, children, kaki }: { kepala: ReactNode[]; children: ReactNode; kaki?: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-max border-collapse text-xs">
        <thead>
          <tr className="bg-primary text-white">
            {kepala.map((k, i) => (
              <th key={i} className="border border-primary-strong/40 px-2 py-2 text-center font-bold whitespace-nowrap">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr:nth-child(even)]:bg-background">{children}</tbody>
        {kaki && <tfoot className="bg-primary-soft font-bold text-primary-strong">{kaki}</tfoot>}
      </table>
    </div>
  );
}

export const sel = "border border-border px-2 py-1.5 whitespace-nowrap";
export const selAngka = `${sel} text-right tabular-nums`;

export function Kosong({ teks }: { teks: string }) {
  return <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">{teks}</p>;
}

/** Warna capaian (keputusan §25 no. 14): < 60 merah, 60–84 kuning, ≥ 85 hijau. */
export function Persen({ realisasi, target }: { realisasi: number; target: number }) {
  if (!(target > 0)) return <span className="text-muted">—</span>;
  const p = Math.round((realisasi / target) * 100);
  const w = p >= 85 ? "text-primary" : p >= 60 ? "text-warning" : "text-danger";
  return <span className={`font-bold ${w}`}>{p}%</span>;
}
