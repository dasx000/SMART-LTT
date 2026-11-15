import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { ModalForm } from "@/components/master/modal-form";
import { Bidang, Catatan, KepalaMaster, kelasIn } from "@/components/master/ui-master";
import { teksParam, urlDengan, type CariParam } from "@/lib/param";
import { simpanKecamatanAction } from "../actions";

export const metadata: Metadata = { title: "Master Kecamatan — SMART LTT" };

export default function HalamanMasterKecamatan({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Master Kecamatan" role={["admin_kab"]} gaya="kab">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

const DASAR = "/kab/master/kecamatan";

async function Isi({ searchParams }: { searchParams: CariParam }) {
  await wajibRole("admin_kab");
  const q = await searchParams;
  const s = await supabaseServer();
  const [{ data: kecs, error }, { data: desa }] = await Promise.all([
    s.from("kecamatan").select("id, kode, nama").order("kode"),
    s.from("desa").select("kecamatan_id").limit(5000),
  ]);
  const jmlDesa = new Map<number, number>();
  for (const d of desa ?? []) jmlDesa.set(d.kecamatan_id, (jmlDesa.get(d.kecamatan_id) ?? 0) + 1);

  const edit = teksParam(q, "edit");
  const dipilih = edit && edit !== "baru" ? kecs?.find((k) => String(k.id) === edit) : undefined;
  const kembali = urlDengan(DASAR, q, { edit: null });

  return (
    <>
      <KepalaMaster
        judul="Kecamatan"
        sub="Wilayah kerja BPP. Kode mengikuti Kemendagri dan dipakai untuk mencocokkan data impor."
        tambah={urlDengan(DASAR, q, { edit: "baru" })}
        label="Tambah Kecamatan"
      />
      <Catatan>
        Data wilayah tidak bisa dihapus karena dipakai laporan, target, dan akun. Kode kecamatan hanya bisa diganti selama kecamatan
        itu belum punya desa.
      </Catatan>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-3 text-left">No</th>
                <th className="p-3 text-left">Kode</th>
                <th className="p-3 text-left">Nama Kecamatan</th>
                <th className="p-3 text-center">Jumlah Desa</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {error ? (
                <tr><td colSpan={5} className="p-6 text-center text-red-500">Gagal memuat: {error.message}</td></tr>
              ) : (
                (kecs ?? []).map((k, i) => (
                  <tr key={k.id} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-400">{i + 1}</td>
                    <td className="p-3 font-mono text-xs text-gray-500">{k.kode}</td>
                    <td className="p-3 font-semibold text-gray-800">{k.nama}</td>
                    <td className="p-3 text-center">
                      <Link href={`/kab/master/desa?kecamatan=${k.id}`} className="font-bold text-green-700 hover:underline">
                        {jmlDesa.get(k.id) ?? 0}
                      </Link>
                    </td>
                    <td className="p-3 text-center">
                      <Link href={urlDengan(DASAR, q, { edit: k.id })} scroll={false} title="Ubah" className="inline-flex rounded-lg bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100">
                        <Pencil size={14} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-gray-100 p-3 text-xs text-gray-500">{kecs?.length ?? 0} kecamatan</p>
      </div>

      {(edit === "baru" || dipilih) && (
        <ModalForm key={edit} judul={dipilih ? `Ubah Kecamatan ${dipilih.nama}` : "Tambah Kecamatan"} aksi={simpanKecamatanAction} kembali={kembali}>
          {dipilih && <input type="hidden" name="id" value={dipilih.id} />}
          <Bidang label="Kode Kemendagri" wajib bantuan="6 angka, mis. 180801 (18 = Lampung, 08 = Way Kanan, 01 = kecamatan).">
            <input name="kode" defaultValue={dipilih?.kode ?? "1808"} required inputMode="numeric" pattern="\d{6}" maxLength={6} className={kelasIn} />
          </Bidang>
          <Bidang label="Nama Kecamatan" wajib bantuan="Tulis persis seperti di e-Pusluh agar data impor dan bot cocok.">
            <input name="nama" defaultValue={dipilih?.nama ?? ""} required maxLength={80} className={kelasIn} />
          </Bidang>
        </ModalForm>
      )}
    </>
  );
}
