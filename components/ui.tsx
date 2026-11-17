import type { ReactNode } from "react";
import Form from "next/form";
import Link from "next/link";
import { SelectOtomatis } from "@/components/select-otomatis";

/** Komponen tampilan kecil tanpa JS (Server Component) — dipakai halaman-halaman fitur. */

export function JudulHalaman({ judul, sub, aksi }: { judul: string; sub?: string; aksi?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-bold tracking-wide text-gray-700 uppercase">{judul}</h2>
        {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
      </div>
      {aksi}
    </div>
  );
}

export function Kartu({ judul, aksi, children, className = "" }: { judul?: string; aksi?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {(judul || aksi) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {judul && <h3 className="text-sm font-bold text-gray-800">{judul}</h3>}
          {aksi}
        </div>
      )}
      {children}
    </section>
  );
}

/** Tombol unduh Excel — file dirakit di browser (lihat components/tombol-unduh.tsx). */
export { TombolUnduh } from "@/components/tombol-unduh";

export const kelasInput =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-hidden";
export const kelasTombol =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-strong active:scale-95 disabled:opacity-60";
export const kelasTombolGaris =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold text-foreground transition hover:border-primary/60 active:scale-95 disabled:opacity-60";

/** Form filter GET (tanpa JS): submit → URL baru → halaman dirender ulang di server. */
export function FormFilter({ dasar, children }: { dasar: string; children: ReactNode }) {
  return (
    <Form action={dasar} scroll={false} className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-surface p-3">
      {children}
    </Form>
  );
}

export function Pilihan({ label, name, nilai, opsi }: { label: string; name: string; nilai: string | number; opsi: { v: string | number; t: string }[] }) {
  return (
    <label className="flex min-w-32 flex-col gap-1 text-[11px] font-semibold text-muted">
      {label}
      <SelectOtomatis name={name} defaultValue={String(nilai)} className={kelasInput}>
        {opsi.map((o) => (
          <option key={String(o.v)} value={String(o.v)}>
            {o.t}
          </option>
        ))}
      </SelectOtomatis>
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
          <tr className="bg-green-700 text-white">
            {kepala.map((k, i) => (
              <th key={i} className="border border-green-800/30 px-2 py-2 text-center font-bold whitespace-nowrap">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr:nth-child(even)]:bg-background">{children}</tbody>
        {kaki && <tfoot className="bg-green-50 font-bold text-gray-800">{kaki}</tfoot>}
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

/**
 * Pilihan tahun + bulan (GET) + komoditas (tautan) untuk halaman target — semuanya URL, tanpa JS.
 * `info` misalnya "Terisi 2 / 5 desa".
 */
export function PilihBulanKomoditas({
  dasar, tahun, bulan, kom, info,
}: {
  dasar: string;
  tahun: number;
  bulan: number;
  kom: string;
  info?: ReactNode;
}) {
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return (
    <div className="mb-3 space-y-2 rounded-2xl border border-gray-200 bg-white p-3">
      <Form action={dasar} scroll={false} className="flex items-end gap-2">
        <input type="hidden" name="komoditas" value={kom} />
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-gray-500">
          Tahun
          <SelectOtomatis name="tahun" defaultValue={tahun} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium">
            {pilihanTahun(tahun).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </SelectOtomatis>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[11px] font-semibold text-gray-500">
          Bulan
          <SelectOtomatis name="bulan" defaultValue={bulan} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium">
            {BULAN.map((n, i) => (
              <option key={n} value={i + 1}>{n}</option>
            ))}
          </SelectOtomatis>
        </label>
      </Form>
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {["Padi", "Jagung", "Ubi Kayu"].map((k) => (
          <Link
            key={k}
            href={`${dasar}?tahun=${tahun}&bulan=${bulan}&komoditas=${encodeURIComponent(k)}`}
            aria-current={kom === k ? "page" : undefined}
            className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition-all ${kom === k ? "bg-green-600 text-white" : "text-gray-500 hover:bg-white"}`}
          >
            {k}
          </Link>
        ))}
      </div>
      {info && <p className="text-right text-xs text-gray-500">{info}</p>}
    </div>
  );
}

/** Tahun pertama data target di aplikasi (data lama dimigrasikan sebagai 2026). */
const TAHUN_AWAL_TARGET = 2026;

/**
 * Pilihan tahun target: dari tahun pertama data (2026) s.d. tahun depan (tahun berjalan WIB + 1),
 * plus tahun terpilih. Bertambah otomatis tiap ganti tahun — mis. tahun 2028 → 2026, 2027, 2028, 2029.
 */
export function pilihanTahun(terpilih: number): number[] {
  const kini = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Jakarta", year: "numeric" }).format(new Date()));
  const awal = Math.min(TAHUN_AWAL_TARGET, kini - 1);
  const daftar = Array.from({ length: kini + 1 - awal + 1 }, (_, i) => awal + i);
  return [...new Set([...daftar, terpilih])].sort((a, b) => a - b);
}
