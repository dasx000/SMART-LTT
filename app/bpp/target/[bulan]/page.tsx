import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Carrot, ChevronLeft, ChevronRight, FileSpreadsheet, Home, Leaf, Users, Wheat } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka } from "@/lib/format";
import { KOMODITAS, ambilTargetDesa, daftarDesa, daftarKecamatan, jenisPadi, type Komoditas } from "@/lib/data";
import { daftarAnggota } from "@/lib/pengguna";
import { TombolUnduh } from "@/components/tombol-unduh";
import { Kosong } from "@/components/ui";
import { DaftarTargetDesa } from "@/components/target-desa/daftar-target-desa";
import { barisTargetDesa } from "@/components/target-desa/data";
import { angkaParam, teksParam, urlDengan, type CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Detail Target Bulanan — SMART LTT" };

type Props = { params: Promise<{ bulan: string }>; searchParams: CariParam };

const IKON: Record<Komoditas, React.ReactNode> = { Padi: <Wheat size={14} />, Jagung: <Leaf size={14} />, "Ubi Kayu": <Carrot size={14} /> };

export default function HalamanDetailTargetBulanBpp(props: Props) {
  return (
    <KerangkaHalaman judul="Target Komoditas" role={["admin_bpp"]} gaya="bpp">
      <Isi {...props} />
    </KerangkaHalaman>
  );
}

type Tab = "ppl" | "desa";
const TAB: { k: Tab; t: string; ikon: React.ReactNode }[] = [
  { k: "ppl", t: "PPL", ikon: <Users size={14} /> },
  { k: "desa", t: "Desa/Kelurahan", ikon: <Home size={14} /> },
];

/**
 * Detail target satu bulan — Admin BPP, kecamatannya sendiri (tampilan meniru /kab/target/<bulan>).
 *  - ppl  : rekap target per PPL (jumlah target desa binaannya)
 *  - desa : daftar desa, Buat/Ubah/Hapus target desa oleh Admin BPP
 * Target Provinsi hanya-baca (diisi Admin Kab). URL: /bpp/target/<bulan>?tahun=&komoditas=&tab=
 */
async function Isi({ params, searchParams }: Props) {
  const p = await wajibRole("admin_bpp");
  if (!p.kecamatanId) return <Kosong teks="Akun Anda belum terikat ke kecamatan. Hubungi Admin Kabupaten." />;
  const bulan = Number((await params).bulan);
  if (!Number.isInteger(bulan) || bulan < 1 || bulan > 12) notFound();
  const q = await searchParams;
  const tahun = angkaParam(q, "tahun", 2000, 2100, bulanTahunWIB().tahun);
  const kom = ((KOMODITAS as string[]).includes(teksParam(q, "komoditas") ?? "") ? teksParam(q, "komoditas") : "Padi") as Komoditas;
  const tab: Tab = teksParam(q, "tab") === "desa" ? "desa" : "ppl";
  const dasar = `/bpp/target/${bulan}`;

  const s = await supabaseServer();
  const [kecs, desa, ppl, { data: tp, error }] = await Promise.all([
    daftarKecamatan(s),
    daftarDesa(s, p.kecamatanId),
    daftarAnggota({ kecamatanId: p.kecamatanId, role: ["penyuluh", "admin_bpp"] }),
    s.from("target_provinsi").select("target_tanam, target_panen").eq("tahun", tahun).eq("bulan", bulan).eq("komoditas", kom).eq("kecamatan_id", p.kecamatanId).maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  const td = await ambilTargetDesa(s, desa.map((d) => d.id), { tahun, bulan, komoditas: kom });
  const namaKec = kecs.find((k) => k.id === p.kecamatanId)?.nama ?? "";
  const prov = tp ? { tanam: Number(tp.target_tanam) || 0, panen: Number(tp.target_panen) || 0 } : null;

  const totDesa = td.reduce((a, x) => a + x.tanam, 0);
  const totDesaPanen = td.reduce((a, x) => a + x.panen, 0);
  const selisih = prov ? totDesa - prov.tanam : null;

  // Target per PPL = jumlah target desa binaannya
  const ringkas = ppl
    .filter((u) => u.aktif && u.desaIds.length > 0)
    .map((u) => {
      const t = td.filter((x) => u.desaIds.includes(x.desaId));
      return { id: u.id, nama: u.nama, jmlDesa: u.desaIds.length, terisi: t.length, tanam: t.reduce((a, x) => a + x.tanam, 0), panen: t.reduce((a, x) => a + x.panen, 0) };
    })
    .sort((a, b) => a.terisi / a.jmlDesa - b.terisi / b.jmlDesa || a.nama.localeCompare(b.nama, "id"));
  const pplLengkap = ringkas.filter((r) => r.terisi >= r.jmlDesa).length;
  const pplBelum = ringkas.filter((r) => r.terisi === 0).length;

  // Navigasi bulan sebelum/sesudah (lintas tahun)
  const geser = (n: number) => {
    const d = new Date(Date.UTC(tahun, bulan - 1 + n, 1));
    return urlDengan(`/bpp/target/${d.getUTCMonth() + 1}`, q, { tahun: d.getUTCFullYear() });
  };
  const judulPeriode = `${NAMA_BULAN[bulan - 1]} ${tahun}`;

  // Tab Desa: data per desa hanya dimuat saat tab dibuka
  const [jenis, barisDesa] = tab === "desa" ? await Promise.all([jenisPadi(s), barisTargetDesa(s, { tahun, bulan, kom, kecs, desa })]) : [[], []];

  return (
    <>
      <Link href={urlDengan("/bpp/target", q, { tab: null })} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-green-700">
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
              href={urlDengan(dasar, q, { komoditas: k === "Padi" ? null : k })}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${kom === k ? "bg-green-600 text-white shadow" : "text-gray-500 hover:text-green-600"}`}
            >
              {IKON[k]} {k}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold text-gray-500 uppercase">Target Provinsi · Kec. {namaKec}</p>
          <p className="text-xl font-bold text-blue-700">
            {prov ? formatAngka(prov.tanam) : "—"} {prov && <span className="text-xs font-normal text-gray-500">Ha tanam</span>}
          </p>
          {prov ? (
            <p className="text-[11px] text-gray-400">panen {formatAngka(prov.panen)} Ha · ditetapkan Admin Kab</p>
          ) : (
            <p className="text-[11px] font-semibold text-red-500">Belum diset Admin Kab bulan ini</p>
          )}
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold text-gray-500 uppercase">Target Desa (Σ PPL)</p>
          <p className="text-xl font-bold text-gray-800">{formatAngka(totDesa)} <span className="text-xs font-normal text-gray-500">Ha tanam</span></p>
          <p className="text-[11px] text-gray-400">{td.length} / {desa.length} desa · panen {formatAngka(totDesaPanen)} Ha</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold text-gray-500 uppercase">Selisih (Desa − Provinsi)</p>
          <p className={`text-xl font-bold ${selisih == null || !prov?.tanam ? "text-gray-300" : selisih < 0 ? "text-orange-500" : "text-green-600"}`}>
            {selisih == null || !prov?.tanam ? "—" : selisih === 0 ? "Sesuai" : `${selisih < 0 ? "Kurang" : "Lebih"} ${formatAngka(Math.abs(selisih))} Ha`}
          </p>
          <p className="text-[11px] text-gray-400">target tanam</p>
        </div>
      </div>

      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 shadow-sm">
        {TAB.map((t) => (
          <Link
            key={t.k}
            href={urlDengan(dasar, q, { tab: t.k === "ppl" ? null : t.k })}
            scroll={false}
            aria-current={tab === t.k ? "page" : undefined}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold whitespace-nowrap ${tab === t.k ? "bg-green-600 text-white shadow" : "text-gray-500 hover:bg-gray-50 hover:text-green-700"}`}
          >
            {t.ikon} {t.t}
          </Link>
        ))}
      </nav>

      {tab === "ppl" && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Rekap Target per PPL</h3>
              <p className="text-[11px] text-gray-500">Target PPL = jumlah target desa binaannya · urut dari pengisian terendah (isi 0 dihitung sudah isi)</p>
            </div>
            <div className="flex gap-2 text-[11px] font-bold">
              <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-700">{pplLengkap} PPL lengkap</span>
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-600">{pplBelum} belum mulai</span>
            </div>
          </div>
          {ringkas.length === 0 ? (
            <Kosong teks="Belum ada PPL aktif dengan desa binaan di kecamatan ini." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                    <th className="p-2.5 text-left">Nama PPL</th>
                    <th className="p-2.5 text-right">Desa Terisi</th>
                    <th className="p-2.5 text-right">Target Tanam (Ha)</th>
                    <th className="p-2.5 text-right">Target Panen (Ha)</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ringkas.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="p-2.5 font-semibold text-gray-700">{r.nama}</td>
                      <td className={`p-2.5 text-right ${r.terisi < r.jmlDesa ? "text-red-500" : "text-gray-500"}`}>{r.terisi} / {r.jmlDesa}</td>
                      <td className="p-2.5 text-right font-semibold">{r.terisi ? formatAngka(r.tanam) : "—"}</td>
                      <td className="p-2.5 text-right">{r.terisi ? formatAngka(r.panen) : "—"}</td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                            r.terisi === 0 ? "bg-red-100 text-red-700" : r.terisi < r.jmlDesa ? "bg-orange-50 text-orange-700" : "bg-green-100 text-green-800"
                          }`}
                        >
                          {r.terisi === 0 ? "Belum isi" : r.terisi < r.jmlDesa ? "Belum lengkap" : "Lengkap"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-yellow-50 font-bold text-yellow-800">
                    <td className="p-2.5">JUMLAH KEC. {namaKec.toUpperCase()}</td>
                    <td className="p-2.5 text-right">{td.length} / {desa.length}</td>
                    <td className="p-2.5 text-right">{formatAngka(totDesa)}</td>
                    <td className="p-2.5 text-right">{formatAngka(totDesaPanen)}</td>
                    <td className="p-2.5"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "desa" && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Target {kom} per Desa/Kelurahan</h3>
              <p className="text-[11px] text-gray-500">Admin BPP dapat membuat, mengubah, dan menghapus target desa. PPL tetap bisa mengisi dari menunya.</p>
            </div>
            <TombolUnduh
              href={urlDengan("/api/unduh/target-desa", {}, { tahun, bulan, komoditas: kom })}
              ikon={<FileSpreadsheet size={14} />}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-green-700"
            />
          </div>
          <DaftarTargetDesa
            baris={barisDesa}
            jenis={jenis}
            tahun={tahun}
            bulan={bulan}
            kom={kom}
            kuota={{ [p.kecamatanId]: prov?.tanam ?? 0 }}
            namaCakupan={`Kec. ${namaKec}`}
            tampilKecamatan={false}
            penggunaId={p.id}
          />
        </div>
      )}
    </>
  );
}
