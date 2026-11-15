import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { formatAngka } from "@/lib/format";
import { ModalForm } from "@/components/master/modal-form";
import { Bidang, Catatan, KepalaMaster, kelasIn } from "@/components/master/ui-master";
import { teksParam, urlDengan, type CariParam } from "@/lib/param";
import { simpanJenisLttAction } from "../actions";

export const metadata: Metadata = { title: "Master Jenis LTT — SMART LTT" };

export default function HalamanMasterJenis({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Master Jenis LTT" role={["admin_kab"]} gaya="kab">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

const DASAR = "/kab/master/jenis-ltt";

async function Isi({ searchParams }: { searchParams: CariParam }) {
  await wajibRole("admin_kab");
  const q = await searchParams;
  const s = await supabaseServer();
  const { data: jenis, error } = await s.from("jenis_ltt").select("id, nama, urutan, aktif").eq("komoditas", "Padi").order("urutan").order("nama");

  // Jumlah laporan per jenis (count di database, tanpa mengirim baris)
  const pakai = new Map<number, number>();
  await Promise.all(
    (jenis ?? []).map(async (j) => {
      const { count } = await s.from("laporan_ltt").select("id", { count: "exact", head: true }).eq("jenis_ltt_id", j.id).is("dihapus_pada", null);
      pakai.set(j.id, count ?? 0);
    }),
  );

  const edit = teksParam(q, "edit");
  const dipilih = edit && edit !== "baru" ? jenis?.find((j) => String(j.id) === edit) : undefined;
  const kembali = urlDengan(DASAR, q, { edit: null });
  const urutanBaru = Math.max(0, ...(jenis ?? []).filter((j) => j.urutan < 50).map((j) => j.urutan ?? 0)) + 1;

  return (
    <>
      <KepalaMaster
        judul="Jenis LTT Padi"
        sub="Jenis kegiatan LTT padi (Reguler, Gogo, Oplah, CSR, dst.) untuk laporan dan target desa."
        tambah={urlDengan(DASAR, q, { edit: "baru" })}
        label="Tambah Jenis"
      />
      <Catatan>
        Nama harus <b>persis sama dengan e-Pusluh</b>; jenis baru dari e-Pusluh juga otomatis terdaftar (urutan 50). Jenis yang sudah
        tidak dipakai cukup <b>dinonaktifkan</b>: laporan lamanya tetap tampil, tetapi tidak muncul lagi di form target. Mengganti nama
        jenis yang sudah dipakai dapat memengaruhi rekap kategori (Reguler, Padi Gogo, Oplah 2025). Jagung &amp; Ubi Kayu hanya punya
        satu jenis (&quot;LTT&quot;) dan tidak dikelola di sini.
      </Catatan>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-3 text-center">Urutan</th>
                <th className="p-3 text-left">Nama Jenis LTT</th>
                <th className="p-3 text-right">Dipakai Laporan</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {error ? (
                <tr><td colSpan={5} className="p-6 text-center text-red-500">Gagal memuat: {error.message}</td></tr>
              ) : (
                (jenis ?? []).map((j) => (
                  <tr key={j.id} className={j.aktif ? "hover:bg-gray-50" : "bg-gray-50/60 text-gray-400"}>
                    <td className="p-3 text-center text-gray-500">{j.urutan}</td>
                    <td className={`p-3 font-semibold ${j.aktif ? "text-gray-800" : "text-gray-400"}`}>{j.nama}</td>
                    <td className="p-3 text-right">{formatAngka(pakai.get(j.id) ?? 0)}</td>
                    <td className="p-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${j.aktif ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                        {j.aktif ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <Link href={urlDengan(DASAR, q, { edit: j.id })} scroll={false} title="Ubah" className="inline-flex rounded-lg bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100">
                        <Pencil size={14} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-gray-100 p-3 text-xs text-gray-500">
          {jenis?.length ?? 0} jenis · {(jenis ?? []).filter((j) => j.aktif).length} aktif
        </p>
      </div>

      {(edit === "baru" || dipilih) && (
        <ModalForm key={edit} judul={dipilih ? `Ubah ${dipilih.nama}` : "Tambah Jenis LTT Padi"} aksi={simpanJenisLttAction} kembali={kembali}>
          {dipilih && <input type="hidden" name="id" value={dipilih.id} />}
          <Bidang
            label="Nama Jenis LTT"
            wajib
            bantuan={dipilih && (pakai.get(dipilih.id) ?? 0) > 0 ? `Dipakai ${formatAngka(pakai.get(dipilih.id) ?? 0)} laporan — ganti nama hanya untuk memperbaiki ejaan.` : "Tulis persis seperti di e-Pusluh, mis. LTT CSR 2026."}
          >
            <input name="nama" defaultValue={dipilih?.nama ?? ""} required maxLength={80} className={kelasIn} />
          </Bidang>
          <Bidang label="Urutan Tampil" wajib bantuan="Angka kecil tampil lebih dulu di daftar dan form target.">
            <input name="urutan" type="number" min={0} max={999} defaultValue={dipilih?.urutan ?? urutanBaru} required className={kelasIn} />
          </Bidang>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input type="checkbox" name="aktif" defaultChecked={dipilih?.aktif ?? true} className="h-4 w-4 accent-green-600" /> Aktif
          </label>
        </ModalForm>
      )}
    </>
  );
}
