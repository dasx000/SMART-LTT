import { ClipboardCheck, Droplets, Fan, Sun, Warehouse } from "lucide-react";
import type { ReactNode } from "react";
import { KOLOM_SARANA } from "@/lib/data";
import { formatAngka } from "@/lib/format";

type Kunci = (typeof KOLOM_SARANA)[number]["kunci"];

export type BarisSaranaKec = {
  id: number;
  nama: string;
  jumlahDesa: number;
  desaTerisi: number;
  /** Jumlah unit per jenis sarana di kecamatan ini. */
  unit: Record<Kunci, number>;
  /** Jumlah desa yang punya ≥ 1 unit, per jenis sarana. */
  desaPunya: Record<Kunci, number>;
};

/** Identitas tiap jenis sarana: warna batang (sama di kartu & grafik) + ikon. */
const GAYA: Record<Kunci, { warna: string; latar: string; ikon: ReactNode }> = {
  gudang_gabah: {
    warna: "#b45309",
    latar: "bg-amber-50 text-amber-700",
    ikon: <Warehouse size={18} />,
  },
  embung: {
    warna: "#0284c7",
    latar: "bg-sky-50 text-sky-600",
    ikon: <Droplets size={18} />,
  },
  lantai_jemur: {
    warna: "#7c3aed",
    latar: "bg-violet-50 text-violet-600",
    ikon: <Sun size={18} />,
  },
  mesin_pengering: {
    warna: "#059669",
    latar: "bg-emerald-50 text-emerald-600",
    ikon: <Fan size={18} />,
  },
};

const persen = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

/** Baris grafik batang horizontal (CSS): label kiri, batang, nilai kanan. Tooltip = atribut title. */
function Batang({
  label,
  nilai,
  maks,
  warna,
  teks,
  judul,
}: {
  label: string;
  nilai: number;
  maks: number;
  warna: string;
  teks: string;
  judul: string;
}) {
  const lebar =
    maks > 0 ? Math.max(nilai > 0 ? 2 : 0, (nilai / maks) * 100) : 0;
  return (
    <div
      title={judul}
      className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 rounded px-1 py-1 text-xs hover:bg-gray-50"
    >
      <span className="truncate text-gray-600">{label}</span>
      <span className="h-3 rounded-r bg-gray-100">
        <span
          className="block h-3 rounded-r"
          style={{ width: `${lebar}%`, background: warna }}
        />
      </span>
      <span className="min-w-[4.5rem] text-right font-semibold text-gray-700 tabular-nums">
        {teks}
      </span>
    </div>
  );
}

/** Infografis Sarana Desa (Admin Kab): kartu total, kelengkapan pengisian, sebaran per kecamatan. */
export function InfografisSarana({ baris }: { baris: BarisSaranaKec[] }) {
  const totalDesa = baris.reduce((a, b) => a + b.jumlahDesa, 0);
  const totalTerisi = baris.reduce((a, b) => a + b.desaTerisi, 0);
  const pctTerisi = persen(totalTerisi, totalDesa);
  const kecLengkap = [...baris].sort(
    (a, b) =>
      persen(b.desaTerisi, b.jumlahDesa) - persen(a.desaTerisi, a.jumlahDesa) ||
      a.nama.localeCompare(b.nama),
  );
  const belumSama = baris.filter((b) => b.desaTerisi === 0).length;

  return (
    <div className="mb-6 space-y-4">
      {/* Kartu ringkas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {KOLOM_SARANA.map((c) => {
          const total = baris.reduce((a, b) => a + b.unit[c.kunci], 0);
          const desa = baris.reduce((a, b) => a + b.desaPunya[c.kunci], 0);
          const g = GAYA[c.kunci];
          return (
            <div
              key={c.kunci}
              className="flex items-start justify-between gap-2 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">
                  {c.label}
                </p>
                <p className="text-2xl font-bold text-gray-800">
                  {formatAngka(total)}{" "}
                  <span className="text-xs font-normal text-gray-500">
                    unit
                  </span>
                </p>
                <p className="text-[10px] text-gray-500">di {desa} desa</p>
              </div>
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${g.latar}`}
              >
                {g.ikon}
              </div>
            </div>
          );
        })}
        <div className="col-span-2 rounded-xl border border-orange-100 bg-white p-4 shadow-sm lg:col-span-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">
                Kelengkapan Data
              </p>
              <p className="text-2xl font-bold text-gray-800">
                {formatAngka(pctTerisi, 1)}
                <span className="text-sm">%</span>
              </p>
              <p className="text-[10px] text-gray-500">
                {totalTerisi} dari {totalDesa} desa terisi
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-500">
              <ClipboardCheck size={18} />
            </div>
          </div>
          <div className="mt-2 h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-orange-500"
              style={{ width: `${Math.min(100, pctTerisi)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Kelengkapan pengisian per kecamatan */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800">
            Kelengkapan Pengisian per Kecamatan
          </h3>
          <p className="mb-3 text-[11px] text-gray-400">
            % desa yang sudah diisi PPL
            {belumSama > 0
              ? ` · ${belumSama} kecamatan belum mengisi sama sekali`
              : ""}
          </p>
          <div className="space-y-0.5">
            {kecLengkap.map((b) => {
              const p = persen(b.desaTerisi, b.jumlahDesa);
              return (
                <Batang
                  key={b.id}
                  label={b.nama}
                  nilai={p}
                  maks={100}
                  warna="#f97316"
                  teks={`${b.desaTerisi}/${b.jumlahDesa} · ${formatAngka(p, 0)}%`}
                  judul={`${b.nama}: ${b.desaTerisi} dari ${b.jumlahDesa} desa terisi (${formatAngka(p, 1)}%)`}
                />
              );
            })}
          </div>
        </div>

        {/* Sebaran unit per kecamatan — satu panel per jenis sarana */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800">
            Sebaran Sarana per Kecamatan
          </h3>
          <p className="mb-3 text-[11px] text-gray-400">
            Jumlah unit; hanya kecamatan yang memiliki sarana tersebut
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {KOLOM_SARANA.map((c) => {
              const g = GAYA[c.kunci];
              const ada = baris
                .filter((b) => b.unit[c.kunci] > 0)
                .sort(
                  (a, b) =>
                    b.unit[c.kunci] - a.unit[c.kunci] ||
                    a.nama.localeCompare(b.nama),
                );
              const maks = Math.max(0, ...ada.map((b) => b.unit[c.kunci]));
              return (
                <div
                  key={c.kunci}
                  className="overflow-hidden rounded-xl border border-gray-200"
                  style={{ borderTop: `3px solid ${g.warna}` }}
                >
                  <p
                    className={`flex items-center justify-between gap-1.5 px-3 py-2 text-[11px] font-bold uppercase ${g.latar}`}
                  >
                    <span className="flex items-center gap-1.5 [&>svg]:size-3.5">
                      {g.ikon} {c.label}
                    </span>
                    <span className="text-[10px] font-semibold normal-case opacity-80">
                      {ada.length} kec.
                    </span>
                  </p>
                  <div className="p-2">
                    {ada.length === 0 ? (
                      <p className="rounded-lg bg-gray-50 px-2 py-3 text-center text-[11px] text-gray-400">
                        Belum ada data
                      </p>
                    ) : (
                      ada.map((b) => (
                        <Batang
                          key={b.id}
                          label={b.nama}
                          nilai={b.unit[c.kunci]}
                          maks={maks}
                          warna={g.warna}
                          teks={`${formatAngka(b.unit[c.kunci])} unit`}
                          judul={`${c.label} — ${b.nama}: ${formatAngka(b.unit[c.kunci])} unit di ${b.desaPunya[c.kunci]} desa`}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
