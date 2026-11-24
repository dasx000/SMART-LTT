import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList, Goal, MapPinned, Users, Warehouse } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka } from "@/lib/format";
import { KOMODITAS, daftarDesa, daftarKecamatan, periodeDariParam, ringkasanWilayah, type Komoditas, type RincianKom } from "@/lib/data";
import { daftarAnggota } from "@/lib/pengguna";
import { KartuCapaian, PilihPeriode } from "@/components/dashboard";
import { JudulHalaman, Kosong } from "@/components/ui";
import { TombolUnduh } from "@/components/tombol-unduh";
import { teksParam, urlDengan, type CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Dashboard BPP — SMART LTT" };

export default function HalamanBPP({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="BPP" role={["admin_bpp"]} gaya="bpp">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

const MENU = [
  { href: "/bpp/target", label: <>Target<br />Komoditas</>, ikon: <Goal />, warna: "bg-blue-50 text-blue-600 group-hover:bg-blue-100" },
  { href: "/bpp/pengguna", label: <>Manajemen<br />Akun PPL</>, ikon: <Users />, warna: "bg-purple-50 text-purple-600 group-hover:bg-purple-100" },
  { href: "/bpp/produktivitas", label: <>Produktivitas<br />& Sarana</>, ikon: <Warehouse />, warna: "bg-lime-50 text-lime-700 group-hover:bg-lime-100" },
];

// Server Component penuh — tidak ada JS dashboard di browser.
async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("admin_bpp");
  if (!p.kecamatanId) return <Kosong teks="Akun Anda belum terikat ke kecamatan. Hubungi Admin Kabupaten." />;
  const q = await searchParams;
  const per = periodeDariParam(teksParam(q, "periode"), bulanTahunWIB());
  // Filter komoditas tabel Rekapitulasi Desa (bawaan Padi) — tiap komoditas ditampilkan terpisah
  const kom = ((KOMODITAS as string[]).includes(teksParam(q, "komoditas") ?? "") ? teksParam(q, "komoditas") : "Padi") as Komoditas;
  const s = await supabaseServer();

  const [kecs, desa, ppl, r] = await Promise.all([
    daftarKecamatan(s),
    daftarDesa(s, p.kecamatanId),
    daftarAnggota({ kecamatanId: p.kecamatanId, role: ["penyuluh", "admin_bpp"] }),
    ringkasanWilayah(s, per.tahun, per.bulan, p.kecamatanId),
  ]);
  const namaKec = kecs.find((k) => k.id === p.kecamatanId)?.nama ?? "";

  const aktif = ppl.filter((u) => u.aktif);

  // Kampung yang belum mengisi target LTT PADI bulan berjalan (WIB) — hanya padi yang wajib.
  // Ada baris target_desa padi (termasuk nilai 0) = sudah isi.
  const { tahun: tahunKini, bulan: bulanKini } = bulanTahunWIB();
  const { data: tgtKini } = await s
    .from("target_desa")
    .select("desa_id")
    .eq("tahun", tahunKini)
    .eq("bulan", bulanKini)
    .eq("komoditas", "Padi")
    .in("desa_id", desa.map((d) => d.id));
  const sudahTarget = new Set((tgtKini ?? []).map((t) => t.desa_id));
  const belumTarget = desa.filter((d) => !sudahTarget.has(d.id));
  // Dikelompokkan per PPL supaya jelas siapa yang perlu diingatkan.
  const perPpl = aktif
    .map((u) => ({ nama: u.nama, kampung: belumTarget.filter((d) => u.desaIds.includes(d.id)).map((d) => d.nama) }))
    .filter((x) => x.kampung.length > 0)
    .sort((a, b) => b.kampung.length - a.kampung.length || a.nama.localeCompare(b.nama));
  const tanpaPpl = belumTarget.filter((d) => !aktif.some((u) => u.desaIds.includes(d.id))).map((d) => d.nama);
  if (tanpaPpl.length) perPpl.push({ nama: "Belum ada PPL", kampung: tanpaPpl });
  const pctTarget = desa.length ? ((desa.length - belumTarget.length) / desa.length) * 100 : 0;

  // Rekapitulasi Desa: satu komoditas, urut nama A–Z. Padi: + lahan bera & olah lahan.
  const isPadi = kom === "Padi";
  const kolomRekap: { k: keyof RincianKom; label: string }[] = [
    ...(isPadi ? [{ k: "bera" as const, label: "Lahan Bera" }, { k: "olah" as const, label: "Olah Lahan" }] : []),
    { k: "tanam", label: `Tanam ${kom}` },
    { k: "panen", label: `Panen ${kom}` },
  ];
  const barisRekap = [...r.baris].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  const jumlahRekap = (k: keyof RincianKom) => barisRekap.reduce((a, b) => a + b.kom[kom][k], 0);

  return (
    <div className="space-y-6">
      <JudulHalaman
        judul={`Menu Utama BPP · ${namaKec}`}
        sub={`Bulan ${NAMA_BULAN[per.bulan - 1]} ${per.tahun}`}
        aksi={<PilihPeriode dasar="/bpp" nilai={per} pilihan={per.pilihan.slice(0, 5)} tersembunyi={kom === "Padi" ? undefined : { komoditas: kom }} />}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {MENU.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:scale-105 active:scale-95"
          >
            <div className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl transition-colors ${m.warna}`}>{m.ikon}</div>
            <span className="text-center text-xs font-bold text-gray-700">{m.label}</span>
          </Link>
        ))}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${belumTarget.length ? "bg-red-50 text-red-500" : "bg-green-50 text-green-500"}`}>
              <MapPinned size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Target LTT Padi {NAMA_BULAN[bulanKini - 1]}</p>
              <p className="text-lg font-bold text-gray-800">
                {desa.length - belumTarget.length} / {desa.length} <span className="text-xs font-normal text-gray-500">kampung sudah isi</span>
              </p>
            </div>
          </div>
          <Link href={`/bpp/target/${bulanKini}?tahun=${tahunKini}&tab=desa`} className="flex items-center gap-1 rounded-lg bg-cyan-50 px-3 py-1.5 text-[11px] font-bold text-cyan-700 hover:bg-cyan-100">
            Isi Target <ArrowRight size={12} />
          </Link>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className={`h-full rounded-full ${pctTarget >= 100 ? "bg-green-500" : pctTarget >= 50 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${pctTarget}%` }} />
        </div>

        {perPpl.length === 0 ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-green-600">
            <CheckCircle2 size={14} /> Semua kampung sudah mengisi target padi bulan ini.
          </p>
        ) : (
          <div className="mt-3">
            <p className="mb-2 text-[10px] font-bold tracking-wide text-gray-400 uppercase">Belum isi target · per PPL</p>
            <ul className="divide-y divide-gray-100">
              {perPpl.map((x) => (
                <li key={x.nama} className="flex flex-col gap-1.5 py-2 sm:flex-row sm:items-start sm:gap-3">
                  <span className={`w-full shrink-0 text-xs font-semibold sm:w-56 ${x.nama === "Belum ada PPL" ? "text-gray-400 italic" : "text-gray-700"}`}>
                    {x.nama} <span className="font-normal text-gray-400">({x.kampung.length})</span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {x.kampung.map((k) => (
                      <span key={k} className="rounded-md border border-red-100 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">{k}</span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {KOMODITAS.map((k) => (
          <KartuCapaian key={k} label={k} sub={`Bulan ${NAMA_BULAN[per.bulan - 1]}`} tanam={r.total[k].tanam} panen={r.total[k].panen} target={r.target[k].tanam} />
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-gray-800"><ClipboardList size={16} /> Rekapitulasi Desa</h3>
            <p className="text-xs text-gray-500">Realisasi {kom.toLowerCase()} per desa bulan terpilih</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Komoditas">
              {KOMODITAS.map((k) => (
                <Link
                  key={k}
                  href={urlDengan("/bpp", q, { komoditas: k === "Padi" ? null : k })}
                  scroll={false}
                  aria-current={kom === k ? "true" : undefined}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold ${kom === k ? "bg-green-600 text-white shadow" : "text-gray-500 hover:text-green-600"}`}
                >
                  {k}
                </Link>
              ))}
            </div>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-bold text-gray-500">{r.baris.length} Desa</span>
            <TombolUnduh href={urlDengan("/api/unduh/rekap-desa", {}, { tahun: per.tahun, bulan: per.bulan, komoditas: kom })} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-3">Nama Desa</th>
                {kolomRekap.map((c) => (
                  <th key={c.k} className="p-3 text-right">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {barisRekap.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold text-gray-800">{b.nama}</td>
                  {kolomRekap.map((c) => (
                    <td
                      key={c.k}
                      className={`p-3 text-right tabular-nums ${c.k === "tanam" ? "font-bold text-green-700" : c.k === "panen" ? "font-bold text-amber-700" : ""}`}
                    >
                      {formatAngka(b.kom[kom][c.k])} Ha
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-yellow-50 font-bold text-yellow-800">
                <td className="p-3">JUMLAH</td>
                {kolomRekap.map((c) => (
                  <td key={c.k} className="p-3 text-right tabular-nums">{formatAngka(jumlahRekap(c.k))} Ha</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
