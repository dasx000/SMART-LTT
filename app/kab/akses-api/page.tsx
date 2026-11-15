import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Plus } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatTanggalJam } from "@/lib/format";
import { DAFTAR_IZIN, IZIN } from "@/lib/api";
import { teksParam, urlDengan, type CariParam } from "@/lib/param";
import { buatKunciAction, cabutKunciAction } from "./actions";
import { FormKunci, TombolCabut } from "./form-kunci";

export const metadata: Metadata = { title: "Akses API — SMART LTT" };

export default function HalamanAksesApi({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Akses API" role={["admin_kab"]} gaya="kab">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

const DASAR = "/kab/akses-api";

const ENDPOINT = [
  { m: "GET", jalur: "/api/v1/pengguna", izin: "pengguna:baca", ket: "Semua PPL/BPP/Admin: NIP, nama, desa binaan, no WA, role (format ppl.json) + geography. Opsi: role, kecamatan, nip, aktif=semua" },
  { m: "GET", jalur: "/api/v1/wilayah", izin: "wilayah:baca", ket: "Kecamatan & desa dengan kode Kemendagri (format master_desa.json)" },
  { m: "GET", jalur: "/api/v1/laporan", izin: "laporan:baca", ket: "Laporan LTT. Opsi: dari, sampai (YYYY-MM-DD, maks. 92 hari), komoditas, kecamatan, desa, sumber, nip, halaman, per (maks. 1000)" },
  { m: "POST", jalur: "/api/v1/laporan", izin: "laporan:tulis", ket: "Kirim laporan Jagung/Ubi Kayu: { nip, desa, komoditas, realisasi_tanam, realisasi_panen, keterangan?, id_kirim? }" },
];

async function Isi({ searchParams }: { searchParams: CariParam }) {
  await wajibRole("admin_kab");
  const q = await searchParams;
  const a = supabaseAdmin();
  const [{ data: klien, error }, { data: log }] = await Promise.all([
    a.from("api_klien").select("id, nama, awalan, izin, aktif, created_at, terakhir_dipakai, dicabut_pada").order("aktif", { ascending: false }).order("created_at", { ascending: false }),
    a.from("api_log").select("id, waktu, metode, jalur, status, durasi_ms, klien:klien_id(nama)").order("waktu", { ascending: false }).limit(20),
  ]);
  const kembali = urlDengan(DASAR, q, { buat: null });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800"><KeyRound size={20} className="text-green-600" /> Akses API</h2>
          <p className="text-[11px] text-gray-500">Kunci untuk aplikasi luar (bot, dll.). Satu kunci per klien, izin seperlunya, bisa dicabut kapan saja.</p>
        </div>
        <Link href={urlDengan(DASAR, q, { buat: "1" })} scroll={false} className="flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-green-700">
          <Plus size={16} /> Buat Kunci
        </Link>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-3 text-left">Klien</th>
                <th className="p-3 text-left">Kunci</th>
                <th className="p-3 text-left">Izin</th>
                <th className="p-3 text-left">Terakhir Dipakai</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {error ? (
                <tr><td colSpan={6} className="p-6 text-center text-red-500">Gagal memuat: {error.message}{error.code === "42P01" ? " (jalankan migrasi 0010)" : ""}</td></tr>
              ) : !klien?.length ? (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">Belum ada kunci. Klik &quot;Buat Kunci&quot; untuk bot atau aplikasi luar.</td></tr>
              ) : (
                klien.map((k) => (
                  <tr key={k.id} className={k.aktif ? "hover:bg-gray-50" : "bg-gray-50/60 text-gray-400"}>
                    <td className="p-3">
                      <p className={`text-sm font-bold ${k.aktif ? "text-gray-800" : "text-gray-400"}`}>{k.nama}</p>
                      <p className="text-[10px] text-gray-400">Dibuat {formatTanggalJam(k.created_at)}</p>
                    </td>
                    <td className="p-3 font-mono text-[11px]">{k.awalan}…</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {(k.izin as string[]).map((z) => (
                          <span key={z} className="rounded bg-green-50 px-1.5 py-0.5 font-mono text-[10px] text-green-700">{z}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">{k.terakhir_dipakai ? formatTanggalJam(k.terakhir_dipakai) : "Belum pernah"}</td>
                    <td className="p-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${k.aktif ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {k.aktif ? "Aktif" : "Dicabut"}
                      </span>
                    </td>
                    <td className="p-3 text-center">{k.aktif && <TombolCabut id={k.id} nama={k.nama} aksi={cabutKunciAction} />}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-bold text-gray-800">Endpoint Tersedia</h3>
        <p className="mb-3 text-[11px] text-gray-500">
          Header: <code className="rounded bg-gray-100 px-1">Authorization: Bearer &lt;kunci&gt;</code>. Balasan JSON:{" "}
          <code className="rounded bg-gray-100 px-1">{`{ "status": "success", ... }`}</code> atau{" "}
          <code className="rounded bg-gray-100 px-1">{`{ "status": "error", "pesan": "..." }`}</code>.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <tbody className="divide-y divide-gray-100">
              {ENDPOINT.map((e) => (
                <tr key={e.m + e.jalur}>
                  <td className="w-14 p-2.5"><span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${e.m === "GET" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{e.m}</span></td>
                  <td className="p-2.5 font-mono text-gray-800">{e.jalur}</td>
                  <td className="p-2.5 font-mono text-[10px] text-green-700">{e.izin}</td>
                  <td className="p-2.5 text-gray-500">{e.ket}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-gray-800">20 Panggilan Terakhir</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase">
                <th className="p-2 text-left">Waktu</th>
                <th className="p-2 text-left">Klien</th>
                <th className="p-2 text-left">Permintaan</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2 text-right">Durasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!log?.length ? (
                <tr><td colSpan={5} className="p-4 text-center text-gray-400">Belum ada panggilan.</td></tr>
              ) : (
                log.map((l) => (
                  <tr key={l.id}>
                    <td className="p-2 text-gray-600">{formatTanggalJam(l.waktu)}</td>
                    <td className="p-2 font-semibold text-gray-700">{(l.klien as unknown as { nama: string } | null)?.nama ?? "-"}</td>
                    <td className="max-w-xs truncate p-2 font-mono text-[11px] text-gray-500" title={l.jalur}>{l.metode} {l.jalur}</td>
                    <td className="p-2 text-center">
                      <span className={`rounded px-1.5 py-0.5 font-bold ${l.status < 300 ? "bg-green-50 text-green-700" : l.status < 500 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}>{l.status}</span>
                    </td>
                    <td className="p-2 text-right text-gray-500">{l.durasi_ms ?? "-"} ms</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {teksParam(q, "buat") === "1" && (
        <FormKunci aksi={buatKunciAction} izin={DAFTAR_IZIN.map((k) => ({ kode: k, label: IZIN[k] }))} kembali={kembali} />
      )}
    </>
  );
}
