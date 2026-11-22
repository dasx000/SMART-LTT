import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Form from "next/form";
import { ArrowLeft, Building2, Carrot, ChevronLeft, ChevronRight, Home, Landmark, Leaf, MapPinned, Trophy, Wheat } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka } from "@/lib/format";
import { KOMODITAS, ambilTargetDesa, daftarDesa, daftarKecamatan, jenisPadi, type Komoditas } from "@/lib/data";
import { SelectOtomatis } from "@/components/select-otomatis";
import { DaftarTargetDesa } from "@/components/target-desa/daftar-target-desa";
import { barisTargetDesa } from "@/components/target-desa/data";
import { angkaParam, teksParam, urlDengan, type CariParam } from "@/lib/param";
import { FormTargetProvinsi } from "../form-provinsi";

export const metadata: Metadata = { title: "Detail Target Bulanan — SMART LTT" };

type Props = { params: Promise<{ bulan: string }>; searchParams: CariParam };

const IKON: Record<Komoditas, React.ReactNode> = { Padi: <Wheat size={14} />, Jagung: <Leaf size={14} />, "Ubi Kayu": <Carrot size={14} /> };

export default function HalamanDetailTargetBulan(props: Props) {
  return (
    <KerangkaHalaman judul="Target Komoditas" role={["admin_kab"]} gaya="kab">
      <Isi {...props} />
    </KerangkaHalaman>
  );
}

type Tab = "kab" | "kec" | "desa";
const TAB: { k: Tab; t: string; ikon: React.ReactNode }[] = [
  { k: "kab", t: "Kabupaten", ikon: <Building2 size={14} /> },
  { k: "kec", t: "Kecamatan", ikon: <MapPinned size={14} /> },
  { k: "desa", t: "Desa/Kelurahan", ikon: <Home size={14} /> },
];

/**
 * Detail target satu bulan, 3 tab (?tab=):
 *  - kab  : ringkasan + peringkat pengisian per kecamatan
 *  - kec  : Target Provinsi vs Σ Target Desa per kecamatan · ?set=1 → form Set Target Provinsi
 *  - desa : daftar semua desa (filter ?kec=), Buat/Ubah/Hapus target desa oleh Admin Kab (migrasi 0019)
 * URL: /kab/target/<bulan>?tahun=&komoditas=&tab=&kec=
 */
async function Isi({ params, searchParams }: Props) {
  const pengguna = await wajibRole("admin_kab");
  const bulan = Number((await params).bulan);
  if (!Number.isInteger(bulan) || bulan < 1 || bulan > 12) notFound();
  const q = await searchParams;
  const tahun = angkaParam(q, "tahun", 2000, 2100, bulanTahunWIB().tahun);
  const kom = ((KOMODITAS as string[]).includes(teksParam(q, "komoditas") ?? "") ? teksParam(q, "komoditas") : "Padi") as Komoditas;
  const bukaSet = teksParam(q, "set") === "1";
  const tabQ = teksParam(q, "tab");
  const tab: Tab = tabQ === "kec" || tabQ === "desa" || tabQ === "kab" ? tabQ : bukaSet ? "kec" : "kab";
  const kecPilih = angkaParam(q, "kec", 1, 1_000_000, 0);
  const dasar = `/kab/target/${bulan}`;

  const s = await supabaseServer();
  const [kecs, desa, { data: tp }] = await Promise.all([
    daftarKecamatan(s),
    daftarDesa(s),
    s.from("target_provinsi").select("kecamatan_id, target_tanam, target_panen").eq("tahun", tahun).eq("bulan", bulan).eq("komoditas", kom),
  ]);
  const td = await ambilTargetDesa(s, desa.map((d) => d.id), { tahun, bulan, komoditas: kom });
  const kecDesa = new Map(desa.map((d) => [d.id, d.kecamatan_id]));
  const prov = new Map((tp ?? []).map((t) => [t.kecamatan_id, { tanam: Number(t.target_tanam) || 0, panen: Number(t.target_panen) || 0 }]));

  const baris = kecs.map((k) => {
    const p = prov.get(k.id);
    const d = td.filter((x) => kecDesa.get(x.desaId) === k.id);
    return {
      id: k.id,
      nama: k.nama,
      prov: p,
      desaTanam: d.reduce((a, x) => a + x.tanam, 0),
      desaPanen: d.reduce((a, x) => a + x.panen, 0),
      desaTerisi: d.length,
      desaTotal: desa.filter((x) => x.kecamatan_id === k.id).length,
    };
  });
  const totProv = baris.reduce((a, b) => a + (b.prov?.tanam ?? 0), 0);
  const totProvPanen = baris.reduce((a, b) => a + (b.prov?.panen ?? 0), 0);
  const totDesa = baris.reduce((a, b) => a + b.desaTanam, 0);
  const totDesaPanen = baris.reduce((a, b) => a + b.desaPanen, 0);
  const selisih = totDesa - totProv;

  // Peringkat kerajinan: % desa yang sudah mengisi target (isi 0 tetap dihitung), lalu jumlah desa terisi.
  const peringkat = baris
    .filter((b) => b.desaTotal > 0)
    .map((b) => ({ ...b, persen: (b.desaTerisi / b.desaTotal) * 100 }))
    .sort((a, b) => b.persen - a.persen || b.desaTerisi - a.desaTerisi || a.nama.localeCompare(b.nama));
  const lengkap = peringkat.filter((b) => b.persen >= 100).length;
  const belumSama = peringkat.filter((b) => b.desaTerisi === 0).length;
  const warnaBar = (p: number) => (p >= 100 ? "bg-green-500" : p >= 50 ? "bg-amber-400" : p > 0 ? "bg-red-400" : "bg-gray-200");
  const MEDALI = ["bg-yellow-400 text-white", "bg-gray-300 text-white", "bg-orange-300 text-white"];

  // Navigasi bulan sebelum/sesudah (lintas tahun)
  const geser = (n: number) => {
    const d = new Date(Date.UTC(tahun, bulan - 1 + n, 1));
    return urlDengan(`/kab/target/${d.getUTCMonth() + 1}`, q, { tahun: d.getUTCFullYear(), set: null });
  };
  const judulPeriode = `${NAMA_BULAN[bulan - 1]} ${tahun}`;

  // Tab Desa: data per desa hanya dimuat saat tab dibuka
  const kecTerpilih = kecs.find((k) => k.id === kecPilih) ?? null;
  const [jenis, barisDesa] =
    tab === "desa"
      ? await Promise.all([
          jenisPadi(s),
          barisTargetDesa(s, { tahun, bulan, kom, kecs, desa: kecTerpilih ? desa.filter((d) => d.kecamatan_id === kecTerpilih.id) : desa }),
        ])
      : [[], []];
  const kuota = Object.fromEntries([...prov].map(([id, v]) => [id, v.tanam]));

  return (
    <>
      <Link href={urlDengan("/kab/target", q, { set: null })} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-green-700">
        <ArrowLeft size={14} /> Target Komoditas {tahun}
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={geser(-1)} className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 hover:text-green-700" aria-label="Bulan sebelumnya">
            <ChevronLeft size={16} />
          </Link>
          <h2 className="text-xl font-bold text-gray-800">Target {kom} — {judulPeriode}</h2>
          <Link href={geser(1)} className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 hover:text-green-700" aria-label="Bulan berikutnya">
            <ChevronRight size={16} />
          </Link>
        </div>
        <div className="flex gap-1">
          {KOMODITAS.map((k) => (
            <Link
              key={k}
              href={urlDengan(dasar, q, { komoditas: k === "Padi" ? null : k, set: null })}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${kom === k ? "bg-green-600 text-white shadow" : "text-gray-500 hover:text-green-600"}`}
            >
              {IKON[k]} {k}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold text-gray-500 uppercase">Target Provinsi</p>
          <p className="text-xl font-bold text-blue-700">{formatAngka(totProv)} <span className="text-xs font-normal text-gray-500">Ha tanam</span></p>
          <p className="text-[11px] text-gray-400">{prov.size} / {kecs.length} kecamatan · panen {formatAngka(totProvPanen)} Ha</p>
          {!bukaSet && (
            <Link
              href={urlDengan(dasar, q, { tab: "kec", set: "1" })}
              scroll={false}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
            >
              <Landmark size={14} /> {prov.size > 0 ? "Ubah Target Provinsi" : "Set Target Provinsi"}
            </Link>
          )}
          {prov.size === 0 && <p className="mt-1 text-center text-[10px] font-semibold text-red-500">Belum diset bulan ini</p>}
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold text-gray-500 uppercase">Target Desa (Σ PPL)</p>
          <p className="text-xl font-bold text-gray-800">{formatAngka(totDesa)} <span className="text-xs font-normal text-gray-500">Ha tanam</span></p>
          <p className="text-[11px] text-gray-400">{td.length} / {desa.length} desa · panen {formatAngka(totDesaPanen)} Ha</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold text-gray-500 uppercase">Selisih (Desa − Provinsi)</p>
          <p className={`text-xl font-bold ${totProv <= 0 ? "text-gray-300" : selisih < 0 ? "text-orange-500" : "text-green-600"}`}>
            {totProv <= 0 ? "—" : selisih === 0 ? "Sesuai" : `${selisih < 0 ? "Kurang" : "Lebih"} ${formatAngka(Math.abs(selisih))} Ha`}
          </p>
          <p className="text-[11px] text-gray-400">target tanam</p>
        </div>
      </div>

      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 shadow-sm">
        {TAB.map((t) => (
          <Link
            key={t.k}
            href={urlDengan(dasar, q, { tab: t.k === "kab" ? null : t.k, set: null })}
            scroll={false}
            aria-current={tab === t.k ? "page" : undefined}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold whitespace-nowrap ${tab === t.k ? "bg-green-600 text-white shadow" : "text-gray-500 hover:bg-gray-50 hover:text-green-700"}`}
          >
            {t.ikon} {t.t}
          </Link>
        ))}
      </nav>

      {tab === "desa" && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Target {kom} per Desa/Kelurahan</h3>
              <p className="text-[11px] text-gray-500">Admin Kab dapat membuat, mengubah, dan menghapus target desa. PPL tetap bisa mengisi dari menunya.</p>
            </div>
            <Form action={dasar} scroll={false} className="w-full sm:w-auto">
              <input type="hidden" name="tahun" value={tahun} />
              {kom !== "Padi" && <input type="hidden" name="komoditas" value={kom} />}
              <input type="hidden" name="tab" value="desa" />
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-gray-500">
                Kecamatan
                <SelectOtomatis name="kec" defaultValue={kecTerpilih?.id ?? ""} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium sm:w-56">
                  <option value="">Semua kecamatan</option>
                  {baris.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama} ({k.desaTerisi}/{k.desaTotal})
                    </option>
                  ))}
                </SelectOtomatis>
              </label>
            </Form>
          </div>
          <DaftarTargetDesa
            baris={barisDesa}
            jenis={jenis}
            tahun={tahun}
            bulan={bulan}
            kom={kom}
            kuota={kuota}
            namaCakupan={kecTerpilih ? `Kec. ${kecTerpilih.nama}` : "Kabupaten"}
            tampilKecamatan={!kecTerpilih}
            penggunaId={pengguna.id}
          />
        </div>
      )}

      {tab === "kab" && peringkat.length > 0 && (
        <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800">
                <Trophy size={16} className="text-yellow-500" /> Peringkat Pengisian Target Desa
              </h3>
              <p className="text-[11px] text-gray-500">Urut % desa yang sudah mengisi target {kom} {judulPeriode} (isi 0 dihitung sudah isi)</p>
            </div>
            <div className="flex gap-2 text-[11px] font-bold">
              <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-700">{lengkap} kecamatan lengkap</span>
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-600">{belumSama} belum mulai</span>
            </div>
          </div>
          {/* columns: urutan turun ke bawah dulu (1, 2, 3 … di kolom kiri, lanjut ke kolom kanan) */}
          <ol className="gap-x-8 lg:columns-2">
            {peringkat.map((b, i) => (
              <li key={b.id} className="mb-2.5 flex break-inside-avoid items-center gap-3">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${b.desaTerisi > 0 && i < 3 ? MEDALI[i] : "bg-gray-100 text-gray-500"}`}>
                  {i + 1}
                </span>
                <span className="w-32 shrink-0 truncate text-xs font-semibold text-gray-700 sm:w-40" title={b.nama}>{b.nama}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <span className={`block h-full rounded-full ${warnaBar(b.persen)}`} style={{ width: `${Math.max(b.persen, b.persen > 0 ? 3 : 0)}%` }} />
                </span>
                <span className="w-24 shrink-0 text-right text-[11px] tabular-nums">
                  <b className={b.persen >= 100 ? "text-green-600" : b.persen > 0 ? "text-gray-800" : "text-gray-400"}>{formatAngka(b.persen, 0)}%</b>
                  <span className="text-gray-400"> · {b.desaTerisi}/{b.desaTotal}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-100 pt-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-full bg-green-500" /> 100% lengkap</span>
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-full bg-amber-400" /> 50–99%</span>
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-full bg-red-400" /> &lt; 50%</span>
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-full bg-gray-200" /> belum ada desa mengisi</span>
          </div>
        </div>
      )}

      {tab === "kec" && (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-800">{bukaSet ? "Set Target Provinsi per Kecamatan" : "Rincian per Kecamatan"}</h3>
          {!bukaSet && (
            <Link
              href={urlDengan(dasar, q, { tab: "kec", set: "1" })}
              scroll={false}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md ring-2 ring-blue-200 hover:bg-blue-700"
            >
              <Landmark size={14} /> {prov.size > 0 ? "Ubah Target Provinsi" : "Set Target Provinsi"}
            </Link>
          )}
        </div>

        {bukaSet ? (
          <FormTargetProvinsi
            key={`${tahun}-${bulan}-${kom}`}
            tahun={tahun}
            bulan={bulan}
            komoditas={kom}
            judul={`${kom} · ${judulPeriode}`}
            baris={baris.map((b) => ({ id: b.id, nama: b.nama, tanam: b.prov?.tanam ?? 0, panen: b.prov?.panen ?? 0 }))}
            kembali={urlDengan(dasar, q, { tab: "kec", set: null })}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                  <th rowSpan={2} className="p-2.5 text-left">Kecamatan</th>
                  <th colSpan={2} className="p-2.5 text-center text-blue-600">Target Provinsi (Ha)</th>
                  <th colSpan={2} className="p-2.5 text-center">Target Desa Σ PPL (Ha)</th>
                  <th rowSpan={2} className="p-2.5 text-right">Selisih Tanam</th>
                  <th rowSpan={2} className="p-2.5 text-right">Desa Terisi</th>
                </tr>
                <tr className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                  <th className="p-2 text-right">Tanam</th>
                  <th className="p-2 text-right">Panen</th>
                  <th className="p-2 text-right">Tanam</th>
                  <th className="p-2 text-right">Panen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {baris.map((b) => {
                  const sel = b.desaTanam - (b.prov?.tanam ?? 0);
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="p-2.5 font-semibold text-gray-700">{b.nama}</td>
                      <td className="p-2.5 text-right font-semibold text-blue-700">{b.prov ? formatAngka(b.prov.tanam) : "—"}</td>
                      <td className="p-2.5 text-right text-blue-700">{b.prov ? formatAngka(b.prov.panen) : "—"}</td>
                      <td className="p-2.5 text-right font-semibold">{b.desaTerisi ? formatAngka(b.desaTanam) : "—"}</td>
                      <td className="p-2.5 text-right">{b.desaTerisi ? formatAngka(b.desaPanen) : "—"}</td>
                      <td className={`p-2.5 text-right font-semibold ${!b.prov ? "text-gray-300" : sel < 0 ? "text-orange-500" : "text-green-600"}`}>
                        {!b.prov ? "—" : sel === 0 ? "Sesuai" : `${sel > 0 ? "+" : "−"}${formatAngka(Math.abs(sel))}`}
                      </td>
                      <td className={`p-2.5 text-right ${b.desaTerisi < b.desaTotal ? "text-red-500" : "text-gray-500"}`}>{b.desaTerisi} / {b.desaTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-yellow-50 font-bold text-yellow-800">
                  <td className="p-2.5">JUMLAH KABUPATEN</td>
                  <td className="p-2.5 text-right">{formatAngka(totProv)}</td>
                  <td className="p-2.5 text-right">{formatAngka(totProvPanen)}</td>
                  <td className="p-2.5 text-right">{formatAngka(totDesa)}</td>
                  <td className="p-2.5 text-right">{formatAngka(totDesaPanen)}</td>
                  <td className="p-2.5 text-right">{totProv > 0 ? `${selisih > 0 ? "+" : selisih < 0 ? "−" : ""}${formatAngka(Math.abs(selisih))}` : "—"}</td>
                  <td className="p-2.5 text-right">{td.length} / {desa.length}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      )}
    </>
  );
}
