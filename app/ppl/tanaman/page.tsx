import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, Hourglass, Info, LeafyGreen, NotebookPen, Wheat } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { desaBinaanSaya } from "@/lib/data";
import { NAMA_BULAN_PENDEK, formatAngka } from "@/lib/format";
import { teksParam, type CariParam } from "@/lib/param";
import {
  BATAS_TAMPIL_HARI,
  LABEL_JENIS,
  UMUR_PANEN,
  type JenisTanam,
  type KomoditasPantau,
  type Petak,
  type StatusPantau,
} from "./hitung";
import { muatPantau } from "./data";

export const metadata: Metadata = { title: "Pantau Tanaman — SMART LTT" };

const EPUSLUH_LTT = "https://dev.epusluh.id/ltt/list"; // laporan Padi diinput di e-Pusluh (sama dgn /ppl/lapor/padi)

const FILTER: { slug: string; label: string; kom: KomoditasPantau | null }[] = [
  { slug: "", label: "Semua", kom: null },
  { slug: "padi", label: "Padi", kom: "Padi" },
  { slug: "jagung", label: "Jagung", kom: "Jagung" },
];

/**
 * /ppl/tanaman[?komoditas=padi|jagung] — perkiraan panen dari laporan tanam di desa binaan,
 * untuk mengingatkan yang sudah lewat waktu tapi panennya belum dilaporkan. Server Component, baca saja.
 */
export default function HalamanPantauTanaman({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman
      judul="Pantau Tanaman"
      role={["penyuluh", "admin_bpp"]}
      panel={{
        judul: "Pantau Tanaman",
        sub: "Perkiraan panen dari laporan tanam. Ini hanya pengingat, jika tidak sesuai abaikan saja.",
      }}
    >
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("penyuluh", "admin_bpp");
  const q = await searchParams;
  const filter = FILTER.find((f) => f.slug === (teksParam(q, "komoditas") ?? "")) ?? FILTER[0];

  const s = await supabaseServer();
  const desa = await desaBinaanSaya(s, p.id);
  const namaDesa = new Map(desa.map((d) => [d.id, d.nama]));

  if (desa.length === 0) {
    return <Kosong>Belum ada desa binaan. Hubungi admin BPP untuk mengatur WKPP Anda.</Kosong>;
  }

  const desaIds = desa.map((d) => d.id);
  const semua = await muatPantau(s, desaIds);
  const petak = filter.kom ? semua.filter((x) => x.komoditas === filter.kom) : semua;
  const per = (st: StatusPantau) => petak.filter((x) => x.status === st);
  const lewat = per("lewat");
  const masa = per("masa");
  const belum = per("belum");

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Ringkas label="Lewat waktu" isi={lewat} warna="border-red-200 bg-red-50 text-red-700" ikon="🔴" />
        <Ringkas label="Masa panen" isi={masa} warna="border-green-200 bg-green-50 text-green-700" ikon="🟢" />
        <Ringkas label="Belum masa" isi={belum} warna="border-gray-200 bg-gray-50 text-gray-600" ikon="⏳" />
      </div>

      <div className="mt-4 flex gap-2">
        {FILTER.map((f) => {
          const aktif = f.slug === filter.slug;
          return (
            <Link
              key={f.slug}
              href={f.slug ? `/ppl/tanaman?komoditas=${f.slug}` : "/ppl/tanaman"}
              replace
              scroll={false}
              className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-bold transition active:scale-95 ${
                aktif ? "bg-green-600 text-white shadow-sm" : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {f.kom === "Padi" && <Wheat size={14} />}
              {f.kom === "Jagung" && <LeafyGreen size={14} />}
              {f.label}
            </Link>
          );
        })}
      </div>

      {petak.length === 0 ? (
        <Kosong>Tidak ada tanaman yang menunggu laporan panen. Semua laporan tanam sudah dipasangkan dengan laporan panen.</Kosong>
      ) : (
        <div className="mt-6 space-y-6">
          {lewat.length > 0 && (
            <Kelompok judul="🔴 Lewat waktu — belum lapor panen" warna="text-red-700">
              {gabung(lewat).map((g) => (
                <Kartu key={g.kunci} g={g} desa={namaDesa.get(g.desaId) ?? "-"} />
              ))}
            </Kelompok>
          )}
          {masa.length > 0 && (
            <Kelompok judul="🟢 Sedang masa panen" warna="text-green-700">
              {gabung(masa).map((g) => (
                <Kartu key={g.kunci} g={g} desa={namaDesa.get(g.desaId) ?? "-"} />
              ))}
            </Kelompok>
          )}
          {belum.length > 0 && (
            <Kelompok judul="⏳ Belum masa panen" warna="text-gray-600">
              {gabung(belum).map((g) => (
                <Kartu key={g.kunci} g={g} desa={namaDesa.get(g.desaId) ?? "-"} />
              ))}
            </Kelompok>
          )}
        </div>
      )}

      <div className="mt-8 flex gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-500">
        <Info size={14} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-gray-600">Masa panen ideal · status &quot;lewat waktu&quot; setelah:</p>
          <ul className="mt-0.5">
            {(Object.keys(UMUR_PANEN) as JenisTanam[]).map((j) => {
              const u = UMUR_PANEN[j];
              return (
                <li key={j}>
                  {LABEL_JENIS[j]}
                  {j === "Reguler" && " (tanam pindah)"}
                  {j === "PM AAS" && " (tabela)"}: {u.mulai}–{u.akhirIdeal} {u.satuan} · lewat &gt; {u.lewat} {u.satuan}
                </li>
              );
            })}
          </ul>
          <p className="mt-1">
            Dihitung dari tanggal laporan tanam; laporan panen dipasangkan ke laporan tanam paling lama di desa yang sama dengan jenis
            LTT dan metode yang sama. Kartu hilang setelah panennya dilaporkan (Padi: setelah data e-Pusluh tersinkron), atau
            otomatis setelah lebih dari {BATAS_TAMPIL_HARI} hari sejak tanam.
          </p>
        </div>
      </div>
    </>
  );
}

/** Satu kartu tampilan = gabungan tanggal tanam per desa × jenis LTT × metode × status (hitungan tetap per tanggal). */
type Grup = {
  kunci: string;
  desaId: number;
  komoditas: Petak["komoditas"];
  jenis: JenisTanam;
  jenisLtt: string;
  metode: string;
  status: StatusPantau;
  petak: Petak[]; // urut tanggal tanam (lama → baru)
};

function gabung(list: Petak[]): Grup[] {
  const m = new Map<string, Grup>();
  for (const x of list) {
    const k = `${x.desaId}|${x.komoditas}|${x.jenisLtt}|${x.metode}|${x.status}`;
    const g = m.get(k);
    if (g) g.petak.push(x);
    else m.set(k, { kunci: k, desaId: x.desaId, komoditas: x.komoditas, jenis: x.jenis, jenisLtt: x.jenisLtt, metode: x.metode, status: x.status, petak: [x] });
  }
  const hasil = [...m.values()];
  for (const g of hasil) g.petak.sort((a, b) => a.tanggalTanam.localeCompare(b.tanggalTanam));
  // tanam paling lama lebih dulu
  return hasil.sort((a, b) => a.petak[0].tanggalTanam.localeCompare(b.petak[0].tanggalTanam) || a.desaId - b.desaId);
}

function tgl(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${NAMA_BULAN_PENDEK[m - 1]} ${y}`;
}

function tglPendek(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${NAMA_BULAN_PENDEK[m - 1]}`;
}

function Ringkas({ label, isi, warna, ikon }: { label: string; isi: Petak[]; warna: string; ikon: string }) {
  const luas = isi.reduce((a, x) => a + x.sisa, 0);
  const jmlDesa = new Set(isi.map((x) => x.desaId)).size;
  return (
    <div className={`rounded-2xl border px-2.5 py-3 ${warna}`}>
      <p className="text-[9px] leading-tight font-bold tracking-tight whitespace-nowrap uppercase">
        {ikon} {label}
      </p>
      <p className="mt-1 text-base leading-tight font-extrabold">{formatAngka(luas)} ha</p>
      <p className="text-[10px] font-semibold opacity-80">{jmlDesa} desa</p>
    </div>
  );
}

function Kelompok({ judul, warna, children }: { judul: string; warna: string; children: ReactNode }) {
  return (
    <section>
      <h3 className={`mb-2 text-[11px] font-extrabold tracking-wide uppercase ${warna}`}>{judul}</h3>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function rentangTgl(a: string, b: string): string {
  return a === b ? tgl(a) : `${a.slice(0, 4) === b.slice(0, 4) ? tglPendek(a) : tgl(a)} – ${tgl(b)}`;
}

function rentangAngka(a: number, b: number): string {
  return a === b ? `${a}` : `${a}–${b}`;
}

function Kartu({ g, desa }: { g: Grup; desa: string }) {
  const padi = g.komoditas === "Padi";
  const garis =
    g.status === "lewat" ? "border-red-200 bg-white" : g.status === "masa" ? "border-green-200 bg-white" : "border-gray-200 bg-white";
  const satuan = UMUR_PANEN[g.jenis].satuan;
  const awal = g.petak[0];
  const akhir = g.petak[g.petak.length - 1];
  const sisa = g.petak.reduce((a, x) => a + x.sisa, 0);
  const hstMin = Math.min(...g.petak.map((x) => x.hst));
  const hstMaks = Math.max(...g.petak.map((x) => x.hst));

  return (
    <details className={`group rounded-2xl border shadow-sm ${garis}`}>
      <summary className="flex cursor-pointer list-none items-start gap-3 p-3.5 [&::-webkit-details-marker]:hidden">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
            padi ? "border-blue-200 bg-blue-100 text-blue-600" : "border-yellow-200 bg-yellow-100 text-yellow-600"
          }`}
        >
          {padi ? <Wheat size={20} /> : <LeafyGreen size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-800">
            {LABEL_JENIS[g.jenis]} · Desa {desa}
          </p>
          <p className={`text-xs font-bold ${g.status === "lewat" ? "text-red-600" : g.status === "masa" ? "text-green-700" : "text-gray-600"}`}>
            {formatAngka(sisa)} ha {g.status === "lewat" ? "belum dilapor panen" : g.status === "masa" ? "dalam masa panen" : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Tanam {rentangTgl(awal.tanggalTanam, akhir.tanggalTanam)} ·{" "}
            <b className="font-bold text-gray-700">
              {rentangAngka(hstMin, hstMaks)} {satuan}
            </b>
          </p>
          <p className="text-[11px] text-gray-500">
            {g.status === "belum" ? (
              <>Perkiraan panen mulai {tgl(awal.mulaiPanen)}</>
            ) : (
              <>Masa panen: {rentangTgl(awal.mulaiPanen, akhir.akhirIdeal)}</>
            )}
          </p>
        </div>
        <ChevronDown size={18} className="mt-1 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="border-t border-gray-100 px-3.5 pt-3 pb-3.5 text-xs text-gray-600">
        {padi && (
          <>
            <Rincian label="Jenis LTT" nilai={g.jenisLtt} />
            <Rincian label="Metode tanam" nilai={g.metode === "PM AAS" ? "PM AAS (tabela)" : "Regular"} />
            <div className="my-1.5 border-t border-dashed border-gray-200" />
          </>
        )}
        {g.petak.map((x) => {
          const panen = x.panen.reduce((a, p) => a + p.luas, 0);
          return (
            <div key={x.tanggalTanam} className="py-0.5">
              <Rincian label={`Tanam ${tgl(x.tanggalTanam)} (${x.hst} ${satuan})`} nilai={`${formatAngka(x.sisa)} ha`} />
              {panen > 0 && (
                <p className="pl-2 text-[10px] text-gray-400">
                  dari {formatAngka(x.luasTanam)} ha, {formatAngka(panen)} ha sudah dilapor panen
                </p>
              )}
            </div>
          );
        })}
        <Rincian label={g.status === "lewat" ? "Total belum dilapor panen" : "Total"} nilai={`${formatAngka(sisa)} ha`} tebal />
        {g.status === "belum" && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
            <Hourglass size={12} /> Belum waktunya panen.
          </p>
        )}
      </div>

      {g.status !== "belum" && (
        <div className="flex flex-wrap items-center gap-2 px-3.5 pb-3.5">
          {padi ? (
            <a
              href={EPUSLUH_LTT}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-green-600 px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-green-700 active:scale-95"
            >
              <NotebookPen size={14} /> Lapor Panen di e-Pusluh <ExternalLink size={12} />
            </a>
          ) : (
            <Link
              href="/ppl/lapor/jagung?form=baru"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-green-600 px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-green-700 active:scale-95"
            >
              <NotebookPen size={14} /> Lapor Panen
            </Link>
          )}
        </div>
      )}
    </details>
  );
}

function Rincian({ label, nilai, kecil, tebal }: { label: string; nilai: string; kecil?: boolean; tebal?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-0.5 ${kecil ? "pl-2 text-[11px] text-gray-500" : ""} ${tebal ? "mt-1 border-t border-gray-100 pt-1.5 font-bold text-gray-800" : ""}`}>
      <span>{label}</span>
      <span className="shrink-0">{nilai}</span>
    </div>
  );
}

function Kosong({ children }: { children: ReactNode }) {
  return <p className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">{children}</p>;
}
