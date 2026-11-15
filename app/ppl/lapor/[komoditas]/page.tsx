import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, ClipboardList, CloudDownload, Pencil, PlusCircle } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman, KepalaPanel } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { awalHariWIB, formatAngka } from "@/lib/format";
import { desaBinaanSaya, type Komoditas } from "@/lib/data";
import { TombolHapus } from "@/components/laporan/tombol-hapus";
import { angkaParam, teksParam, type CariParam } from "@/lib/param";
import { hapusLaporanAction } from "../../actions";
import { FormLaporan } from "./form-laporan";

export const metadata: Metadata = { title: "Lapor LTT — SMART LTT" };

const SLUG: Record<string, Komoditas> = { padi: "Padi", jagung: "Jagung", "ubi-kayu": "Ubi Kayu" };
const jam = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });

type Props = { params: Promise<{ komoditas: string }>; searchParams: CariParam };

/**
 * /ppl/lapor/<komoditas>            → laporan hari ini
 * /ppl/lapor/<komoditas>?form=baru  → form laporan baru
 * /ppl/lapor/<komoditas>?edit=<id>  → form edit
 * Semua keadaan ada di URL (bisa di-refresh, tombol kembali HP bekerja wajar), dirender di server.
 */
export default function HalamanLapor(props: Props) {
  return (
    <KerangkaHalaman judul="Lapor" role={["penyuluh", "admin_bpp"]} gaya="ppl">
      <div className="px-5 pt-6 pb-20">
        <Isi {...props} />
      </div>
    </KerangkaHalaman>
  );
}

async function Isi({ params, searchParams }: Props) {
  const p = await wajibRole("penyuluh", "admin_bpp");
  const { komoditas: slug } = await params;
  const kom = SLUG[slug];
  if (!kom) notFound();
  const q = await searchParams;
  const dasar = `/ppl/lapor/${slug}`;
  const isPadi = kom === "Padi";
  const baru = !isPadi && teksParam(q, "form") === "baru";
  const editId = isPadi ? 0 : angkaParam(q, "edit", 1, Number.MAX_SAFE_INTEGER, 0);

  const s = await supabaseServer();
  const desa = await desaBinaanSaya(s, p.id);
  const { data } = desa.length
    ? await s
        .from("laporan_ltt")
        .select("id, desa_id, luas_bera, realisasi_olah, realisasi_tanam, realisasi_panen, keterangan, tanggal_lapor, sumber, pelapor_id, desa:desa_id(nama), jenis:jenis_ltt_id(nama)")
        .eq("komoditas", kom)
        .in("desa_id", desa.map((d) => d.id))
        .gte("tanggal_lapor", awalHariWIB())
        .is("dihapus_pada", null)
        .order("tanggal_lapor", { ascending: false })
    : { data: [] };

  const laporan = (data ?? [])
    .map((l) => ({
      id: l.id as number,
      desaId: l.desa_id as number,
      desa: (l.desa as unknown as { nama: string } | null)?.nama ?? "-",
      jenis: (l.jenis as unknown as { nama: string } | null)?.nama ?? null,
      bera: Number(l.luas_bera) || 0,
      olah: Number(l.realisasi_olah) || 0,
      tanam: Number(l.realisasi_tanam) || 0,
      panen: Number(l.realisasi_panen) || 0,
      keterangan: l.keterangan as string | null,
      waktu: l.tanggal_lapor as string,
      sync: l.sumber === "epusluh",
      milikSaya: l.pelapor_id === p.id,
    }))
    // Padi: hanya baris yang punya nilai (aturan lama)
    .filter((l) => !isPadi || l.bera + l.olah + l.tanam + l.panen > 0);

  // ── Form baru / edit ──
  const edit = editId ? laporan.find((l) => l.id === editId && !l.sync) : undefined;
  if (baru || edit) {
    return (
      <>
        <KepalaPanel judul={edit ? `Edit ${kom}` : `Form ${kom}`} kembali={dasar} />
        <FormLaporan
          komoditas={kom as "Jagung" | "Ubi Kayu"}
          desa={desa.map((d) => ({ id: d.id, nama: d.nama }))}
          kembali={dasar}
          awal={edit ? { id: edit.id, desaId: edit.desaId, tanam: edit.tanam, panen: edit.panen, keterangan: edit.keterangan } : undefined}
        />
      </>
    );
  }

  // ── Daftar laporan hari ini ──
  return (
    <>
      <KepalaPanel judul={kom} />
      {!isPadi && (
        <>
          <Link
            href={`${dasar}?form=baru`}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-green-200 bg-green-50 py-4 font-bold text-green-600 transition hover:bg-green-100 active:scale-95"
          >
            <PlusCircle size={18} /> Input Laporan Baru
          </Link>
          <p className="mb-6 text-center text-[11px] font-semibold text-red-500">Apabila nilai 0 semua, tidak perlu mengisi</p>
        </>
      )}

      <h3 className="mb-3 px-1 text-xs font-bold tracking-widest text-gray-400 uppercase">Laporan Hari Ini</h3>
      <div className="space-y-3">
        {laporan.length === 0 ? (
          <div className="rounded-2xl border-2 border-dotted border-gray-200 bg-gray-50 p-8 text-center">
            <ClipboardList className="mx-auto mb-3 text-gray-300" size={40} />
            <p className="text-xs font-bold tracking-wider text-gray-400 uppercase">
              {isPadi ? "Data padi muncul setelah pukul 12.00" : `Belum ada laporan ${kom} hari ini`}
            </p>
            {isPadi && (
              <p className="mt-1 text-[10px] text-gray-400">Hanya menampilkan data dengan nilai bera, olah lahan, tanam/panen. Ditarik otomatis dari e-Pusluh.</p>
            )}
          </div>
        ) : (
          laporan.map((l) => (
            <div key={l.id} className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-md">
              <div className="absolute top-0 bottom-0 left-0 w-1 bg-green-500" />
              <div className="pl-2">
                <div className="mb-1 flex items-start justify-between">
                  <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">{l.sync ? "Hasil Sync" : `${jam.format(new Date(l.waktu))} WIB`}</p>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-green-100 bg-green-50 px-2 py-0.5 text-[8px] font-bold tracking-tighter text-green-600 uppercase">
                    {l.sync ? <CloudDownload size={10} /> : <CircleCheck size={10} />}
                    {l.sync ? l.jenis || "Tersinkron" : "Terkirim"}
                  </span>
                </div>
                <h4 className="text-base font-bold text-gray-800">Desa {l.desa}</h4>
                {l.keterangan && <p className="mt-0.5 text-[11px] text-gray-500 italic">{l.keterangan}</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-1.5">
                      <span className="text-[9px] font-bold text-blue-400 uppercase">Tanam</span>
                      <span className="text-sm font-black text-blue-700">{formatAngka(l.tanam)}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-1.5">
                      <span className="text-[9px] font-bold text-orange-400 uppercase">Panen</span>
                      <span className="text-sm font-black text-orange-700">{formatAngka(l.panen)}</span>
                    </div>
                  </div>
                  {!l.sync && (p.role === "admin_bpp" || l.milikSaya) && (
                    <div className="flex gap-1.5">
                      <Link
                        href={`${dasar}?edit=${l.id}`}
                        className="flex items-center gap-1 rounded-xl bg-green-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-green-700"
                      >
                        <Pencil size={12} /> Edit
                      </Link>
                      <TombolHapus id={l.id} aksi={hapusLaporanAction} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
