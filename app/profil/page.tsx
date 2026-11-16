import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Lock, LockKeyhole } from "lucide-react";
import { getPengguna } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { daftarKecamatan, desaBinaanSaya } from "@/lib/data";
import { FormWhatsApp } from "./form-whatsapp";
import { PengaturanNotifikasi } from "@/components/pengaturan-notifikasi";
import { sakelarNotifPpl } from "@/lib/pengaturan";

export const metadata: Metadata = { title: "Profil Saya" };

const LABEL_ROLE = { penyuluh: "Penyuluh", admin_bpp: "Koordinator BPP", admin_kab: "Admin Kabupaten", viewer: "Viewer" } as const;

// Profil sendiri: nama, NIP, kecamatan, desa binaan hanya ditampilkan (dikunci, diubah Admin Kab).
// Yang bisa diubah: nomor WhatsApp, dan password lewat /ganti-password.
export default function HalamanProfil() {
  return (
    <KerangkaHalaman judul="Profil Saya" role={["penyuluh", "admin_bpp", "admin_kab", "viewer"]} panel={{ judul: "Profil Saya", kembali: "/" }}>
      <Isi />
    </KerangkaHalaman>
  );
}

async function Isi() {
  const p = await getPengguna();
  const s = await supabaseServer();
  const [kecs, desa, { data: ang }, notif] = await Promise.all([
    daftarKecamatan(s),
    desaBinaanSaya(s, p.id),
    s.from("anggota").select("whatsapp").eq("user_id", p.id).maybeSingle(),
    sakelarNotifPpl(s),
  ]);
  const namaKec = kecs.find((k) => k.id === p.kecamatanId)?.nama;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <dl className="space-y-3 text-sm">
          <Baris label="Nama" nilai={p.nama} />
          <Baris label="NIP" nilai={p.nip} />
          <Baris label="Peran" nilai={LABEL_ROLE[p.role]} />
          {namaKec && <Baris label="Kecamatan" nilai={namaKec} />}
          {desa.length > 0 && <Baris label="Desa binaan" nilai={desa.map((d) => d.nama).join(", ")} />}
        </dl>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
          <Lock size={12} /> Data di atas hanya bisa diubah oleh Admin Kabupaten.
        </p>
      </section>

      <FormWhatsApp awal={ang?.whatsapp ?? ""} />

      {(p.role === "penyuluh" || p.role === "admin_bpp") && <PengaturanNotifikasi dimatikanAdmin={!notif.aktif} />}

      <Link
        href="/ganti-password"
        className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-[0.99]"
      >
        <span className="flex items-center gap-2"><LockKeyhole size={16} className="text-amber-600" /> Ubah Password</span>
        <ChevronRight size={16} className="text-gray-400" />
      </Link>
    </div>
  );
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-800">{nilai}</dd>
    </div>
  );
}
