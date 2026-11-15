import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Goal, Inbox, Target, UserCheck, Users, Warehouse } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, awalHariWIB, bulanTahunWIB, formatAngka } from "@/lib/format";
import { KOMODITAS, daftarDesa, daftarKecamatan, periodeDariParam, ringkasanWilayah } from "@/lib/data";
import { daftarAnggota } from "@/lib/pengguna";
import { KartuCapaian, PilihPeriode } from "@/components/dashboard";
import { JudulHalaman, Kosong } from "@/components/ui";
import { teksParam, type CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Dashboard BPP — SMART LTT" };

export default function HalamanBPP({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="BPP" role={["admin_bpp"]} gaya="bpp">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

const MENU = [
  { href: "/bpp/target-kecamatan", label: <>Target<br />Kecamatan</>, ikon: <Goal />, warna: "bg-blue-50 text-blue-600 group-hover:bg-blue-100" },
  { href: "/bpp/target", label: <>Target<br />Desa PPL</>, ikon: <Target />, warna: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100" },
  { href: "/bpp/pengguna", label: <>Manajemen<br />Akun PPL</>, ikon: <Users />, warna: "bg-purple-50 text-purple-600 group-hover:bg-purple-100" },
  { href: "/bpp/produktivitas", label: <>Produktivitas<br />& Sarana</>, ikon: <Warehouse />, warna: "bg-lime-50 text-lime-700 group-hover:bg-lime-100" },
];

// Server Component penuh — tidak ada JS dashboard di browser.
async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("admin_bpp");
  if (!p.kecamatanId) return <Kosong teks="Akun Anda belum terikat ke kecamatan. Hubungi Admin Kabupaten." />;
  const per = periodeDariParam(teksParam(await searchParams, "periode"), bulanTahunWIB());
  const s = await supabaseServer();

  const [kecs, desa, ppl, r] = await Promise.all([
    daftarKecamatan(s),
    daftarDesa(s, p.kecamatanId),
    daftarAnggota({ kecamatanId: p.kecamatanId, role: ["penyuluh", "admin_bpp"] }),
    ringkasanWilayah(s, per.tahun, per.bulan, p.kecamatanId),
  ]);
  const namaKec = kecs.find((k) => k.id === p.kecamatanId)?.nama ?? "";

  // Laporan hari ini (WIB) di kecamatan + siapa saja PPL yang sudah lapor (input manual)
  const { data: hariIni } = await s
    .from("laporan_ltt")
    .select("pelapor_id, sumber")
    .in("desa_id", desa.map((d) => d.id))
    .gte("tanggal_lapor", awalHariWIB())
    .is("dihapus_pada", null)
    .limit(5000);
  const aktif = ppl.filter((u) => u.aktif);
  const sudah = new Set((hariIni ?? []).map((l) => l.pelapor_id).filter(Boolean));
  const belum = aktif.filter((u) => !sudah.has(u.id));

  return (
    <div className="space-y-6">
      <JudulHalaman
        judul={`Menu Utama BPP · ${namaKec}`}
        sub={`Bulan ${NAMA_BULAN[per.bulan - 1]} ${per.tahun}`}
        aksi={<PilihPeriode nilai={per} pilihan={per.pilihan.slice(0, 5)} />}
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border-l-4 border-blue-500 bg-white p-5 shadow-sm">
          <div>
            <p className="mb-1 text-xs font-bold text-gray-500 uppercase">Laporan Hari Ini</p>
            <p className="text-2xl font-bold text-gray-800">
              {(hariIni ?? []).length} <span className="text-sm font-normal text-gray-500">Data</span>
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500"><Inbox /></div>
        </div>
        <div className="rounded-xl border-l-4 border-green-500 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-xs font-bold text-gray-500 uppercase">Sudah Lapor Hari Ini</p>
              <p className="text-2xl font-bold text-gray-800">
                {aktif.length - belum.length} / {aktif.length} <span className="text-sm font-normal text-gray-500">Orang</span>
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-500"><UserCheck /></div>
          </div>
          {belum.length > 0 && (
            <p className="mt-2 text-[11px] text-red-600">
              <b>Belum lapor:</b> {belum.map((u) => u.nama).join(", ")}
            </p>
          )}
        </div>
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
            <p className="text-xs text-gray-500">Capaian tanam & panen per desa bulan terpilih</p>
          </div>
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-bold text-gray-500">{r.baris.length} Desa</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-3">Nama Desa</th>
                <th className="p-3 text-right">Tanam Padi</th>
                <th className="p-3 text-right">Tanam Jagung</th>
                <th className="p-3 text-right">Tanam Ubi Kayu</th>
                <th className="p-3 text-right">Total Tanam</th>
                <th className="p-3 text-right">Total Panen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {r.baris.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold text-gray-800">{b.nama}</td>
                  {KOMODITAS.map((k) => (
                    <td key={k} className="p-3 text-right">{formatAngka(b.tanam[k])} Ha</td>
                  ))}
                  <td className="p-3 text-right font-bold text-green-700">{formatAngka(KOMODITAS.reduce((a, k) => a + b.tanam[k], 0))} Ha</td>
                  <td className="p-3 text-right font-bold text-amber-700">{formatAngka(b.panen)} Ha</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
