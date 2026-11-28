import "server-only";
import Form from "next/form";
import { CircleCheck, ClipboardList, Clock, Info } from "lucide-react";
import type { Pengguna } from "@/lib/auth";
import { KepalaPanel } from "@/components/kerangka-halaman";
import { TanggalOtomatis } from "@/components/tanggal-otomatis";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ambilSemua } from "@/lib/supabase/ambil-semua";
import { desaBinaanSaya } from "@/lib/data";
import { NAMA_BULAN_PENDEK, formatAngka, tanggalIsoWIB } from "@/lib/format";
import { teksParam } from "@/lib/param";

/**
 * /ppl/lapor/padi[?dari=YYYY-MM-DD&sampai=YYYY-MM-DD] — laporan Padi desa binaan hasil sinkron e-Pusluh.
 * HANYA DILIHAT: input & perbaikan Padi dilakukan di e-Pusluh (lewat Koordinator Penyuluh).
 */

const MAKS_HARI = 31;
const HARI = 86_400_000;

const jamWIB = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
const kelasInput =
  "h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700 outline-none focus:border-green-500";

function isoValid(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

function geserHari(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * HARI).toISOString().slice(0, 10);
}

function selisihHari(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / HARI);
}

function tglPanjang(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${NAMA_BULAN_PENDEK[m - 1]} ${y}`;
}

/** Rentang dari–sampai yang aman: maks. hari ini, dari ≤ sampai, maks. 31 hari. */
function rentang(q: Record<string, string | string[] | undefined>, hariIni: string) {
  let sampai = teksParam(q, "sampai");
  let dari = teksParam(q, "dari");
  if (!isoValid(sampai) || sampai > hariIni) sampai = hariIni;
  if (!isoValid(dari) || dari > hariIni) dari = sampai;
  if (dari > sampai) [dari, sampai] = [sampai, dari];
  if (selisihHari(dari, sampai) > MAKS_HARI - 1) dari = geserHari(sampai, -(MAKS_HARI - 1));
  return { dari, sampai };
}

const WARNA_STATUS: { cocok: RegExp; kelas: string }[] = [
  { cocok: /kab/i, kelas: "border-green-200 bg-green-50 text-green-700" },
  { cocok: /bpp|verifikasi/i, kelas: "border-blue-200 bg-blue-50 text-blue-700" },
  { cocok: /tolak|revisi|kembali/i, kelas: "border-red-200 bg-red-50 text-red-700" },
  { cocok: /ajukan/i, kelas: "border-amber-200 bg-amber-50 text-amber-700" },
];

function kelasStatus(st: string): string {
  return WARNA_STATUS.find((w) => w.cocok.test(st))?.kelas ?? "border-gray-200 bg-gray-50 text-gray-600";
}

/** Waktu sinkron e-Pusluh terakhir yang sukses. logs_sinkron tidak bisa dibaca PPL (RLS) → baca di server, hanya jamnya. */
async function sinkronTerakhir(): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin()
      .from("logs_sinkron")
      .select("waktu")
      .like("status", "Sukses%")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data?.waktu as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function LaporanPadi({ pengguna, q }: { pengguna: Pengguna; q: Record<string, string | string[] | undefined> }) {
  const hariIni = tanggalIsoWIB();
  const { dari, sampai } = rentang(q, hariIni);

  const s = await supabaseServer();
  const desa = await desaBinaanSaya(s, pengguna.id);
  const [sinkron, data] = await Promise.all([
    sinkronTerakhir(),
    desa.length
      ? ambilSemua<{
          id: number;
          desa_id: number;
          tanggal_lapor: string;
          luas_bera: number;
          realisasi_olah: number;
          realisasi_tanam: number;
          realisasi_panen: number;
          metode_penanaman: string | null;
          keterangan: string | null;
          status_epusluh: string | null;
          jenis: unknown;
        }>((a, b) =>
          s
            .from("laporan_ltt")
            .select(
              "id, desa_id, tanggal_lapor, luas_bera, realisasi_olah, realisasi_tanam, realisasi_panen, metode_penanaman, keterangan, status_epusluh, jenis:jenis_ltt_id(nama)",
            )
            .eq("komoditas", "Padi")
            .in("desa_id", desa.map((d) => d.id))
            .gte("tanggal_lapor", `${dari}T00:00:00+07:00`)
            .lt("tanggal_lapor", `${geserHari(sampai, 1)}T00:00:00+07:00`)
            .is("dihapus_pada", null)
            .order("tanggal_lapor", { ascending: false })
            .order("id")
            .range(a, b),
        )
      : Promise.resolve([]),
  ]);

  const namaDesa = new Map(desa.map((d) => [d.id, d.nama]));
  const laporan = data
    .map((l) => {
      const rel = (Array.isArray(l.jenis) ? l.jenis[0] : l.jenis) as { nama?: string } | null | undefined;
      return {
        id: l.id,
        tanggal: tanggalIsoWIB(l.tanggal_lapor),
        jam: jamWIB.format(new Date(l.tanggal_lapor)),
        desa: namaDesa.get(l.desa_id) ?? "-",
        jenis: rel?.nama ?? null,
        metode: l.metode_penanaman,
        status: l.status_epusluh,
        bera: Number(l.luas_bera) || 0,
        olah: Number(l.realisasi_olah) || 0,
        tanam: Number(l.realisasi_tanam) || 0,
        panen: Number(l.realisasi_panen) || 0,
        keterangan: l.keterangan,
      };
    })
    // Padi: hanya baris yang punya nilai (aturan lama)
    .filter((l) => l.bera + l.olah + l.tanam + l.panen > 0);

  const perTanggal = new Map<string, typeof laporan>();
  for (const l of laporan) {
    const g = perTanggal.get(l.tanggal);
    if (g) g.push(l);
    else perTanggal.set(l.tanggal, [l]);
  }

  const sinkronHariIni = sinkron !== null && tanggalIsoWIB(sinkron) === hariIni;

  return (
    <>
      <KepalaPanel judul="Padi" />

      {/* Status sinkron e-Pusluh + catatan, satu kotak */}
      <div className={`overflow-hidden rounded-2xl border ${sinkronHariIni ? "border-green-200" : "border-amber-200"}`}>
        <div className={`flex items-center gap-3 px-4 py-3 ${sinkronHariIni ? "bg-green-50" : "bg-amber-50"}`}>
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              sinkronHariIni ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
            }`}
          >
            {sinkronHariIni ? <CircleCheck size={18} /> : <Clock size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-[11px] font-semibold ${sinkronHariIni ? "text-green-700" : "text-amber-700"}`}>
              {sinkronHariIni ? "Sinkron e-Pusluh hari ini" : "Data hari ini belum disinkronkan"}
            </p>
            {sinkron && (
              <p className={`text-base leading-tight font-extrabold ${sinkronHariIni ? "text-green-900" : "text-amber-900"}`}>
                {sinkronHariIni
                  ? `${jamWIB.format(new Date(sinkron))} WIB`
                  : `Terakhir ${tglPanjang(tanggalIsoWIB(sinkron))}, ${jamWIB.format(new Date(sinkron))} WIB`}
              </p>
            )}
          </div>
        </div>
        <p className="flex items-center gap-2 border-t border-gray-100 bg-white px-4 py-2 text-[11px] text-gray-600">
          <Info size={13} className="shrink-0 text-gray-400" />
          Jika ada salah input, hubungi Koordinator Penyuluh
        </p>
      </div>

      {/* Filter rentang tanggal */}
      <div className="mt-5 border-t border-gray-200" />
      <Form action="/ppl/lapor/padi" className="mt-4 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-gray-500">Dari</span>
          <TanggalOtomatis name="dari" defaultValue={dari} max={hariIni} className={kelasInput} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-gray-500">Sampai</span>
          <TanggalOtomatis name="sampai" defaultValue={sampai} max={hariIni} className={kelasInput} />
        </label>
      </Form>
      <p className="mt-1 px-1 text-[10px] text-gray-400">Maksimal {MAKS_HARI} hari.</p>

      <div className="mt-5 space-y-5">
        {laporan.length === 0 ? (
          <div className="rounded-2xl border-2 border-dotted border-gray-200 bg-gray-50 p-8 text-center">
            <ClipboardList className="mx-auto mb-3 text-gray-300" size={40} />
            <p className="text-xs font-bold tracking-wider text-gray-400 uppercase">
              Belum ada laporan padi {dari === sampai ? (dari === hariIni ? "hari ini" : tglPanjang(dari)) : "di rentang ini"}
            </p>
            <p className="mt-1 text-[10px] text-gray-400">
              Hanya menampilkan data dengan nilai bera, olah lahan, tanam/panen. Ditarik otomatis dari e-Pusluh.
            </p>
          </div>
        ) : (
          [...perTanggal.entries()].map(([tgl, isi]) => (
            <section key={tgl}>
              <h3 className="mb-2 px-1 text-xs font-bold tracking-widest text-gray-400 uppercase">
                {tgl === hariIni ? "Hari ini" : tglPanjang(tgl)} · {isi.length} laporan
              </h3>
              <div className="space-y-2.5">
                {isi.map((l) => (
                  <div key={l.id} className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-green-500" />
                    <div className="pl-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-base font-bold text-gray-800">Desa {l.desa}</h4>
                        {l.status && (
                          <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${kelasStatus(l.status)}`}>
                            {l.status}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        {[l.jenis, l.metode, `${l.jam} WIB`].filter(Boolean).join(" · ")}
                      </p>
                      {l.keterangan && <p className="mt-1 text-[11px] text-gray-500 italic">{l.keterangan}</p>}
                      <div className="mt-3 grid grid-cols-4 gap-1.5">
                        <Angka label="Bera" nilai={l.bera} warna="border-gray-200 bg-gray-50 text-gray-700" />
                        <Angka label="Olah" nilai={l.olah} warna="border-amber-100 bg-amber-50 text-amber-700" />
                        <Angka label="Tanam" nilai={l.tanam} warna="border-blue-100 bg-blue-50 text-blue-700" />
                        <Angka label="Panen" nilai={l.panen} warna="border-orange-100 bg-orange-50 text-orange-700" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}

function Angka({ label, nilai, warna }: { label: string; nilai: number; warna: string }) {
  return (
    <div className={`rounded-xl border px-2 py-1.5 text-center ${warna}`}>
      <p className="text-[9px] font-bold uppercase opacity-70">{label}</p>
      <p className="text-sm font-black">{formatAngka(nilai)}</p>
    </div>
  );
}
