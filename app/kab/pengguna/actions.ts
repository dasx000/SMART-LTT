"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { wajibRole, type Pengguna, type Role } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { HasilAksi } from "@/app/ppl/target/actions";

/**
 * Kelola pengguna (logika-bisnis §14).
 * - admin_kab: semua pengguna, semua role, semua kecamatan.
 * - admin_bpp: hanya penyuluh/admin_bpp DI KECAMATANNYA; akun baru selalu role penyuluh;
 *   tidak bisa mengubah role/kecamatan; desa binaan harus di kecamatannya.
 * Memakai service role (auth admin + core.*) — karena itu SEMUA cakupan diperiksa di sini.
 * Hapus = nonaktifkan (soft delete). Password tidak pernah ditampilkan.
 */

const ROLE: [Role, ...Role[]] = ["penyuluh", "admin_bpp", "admin_kab", "viewer"];
const nip = z.string().trim().regex(/^[0-9A-Za-z.-]{3,30}$/, "NIP hanya angka/huruf, 3–30 karakter.");
const nama = z.string().trim().min(2, "Nama minimal 2 karakter.").max(100);
const wa = z.string().trim().max(20).regex(/^[0-9+ -]*$/, "Nomor WhatsApp tidak valid.").optional().default("");
const password = z.string().min(6, "Password minimal 6 karakter.").max(72);
const desaIds = z.array(z.number().int().positive()).max(100).default([]);

async function pemanggil() {
  return wajibRole("admin_bpp", "admin_kab");
}

function bolehKelola(p: Pengguna, target: { role: Role; kecamatanId: number | null }) {
  if (p.role === "admin_kab") return true;
  return target.kecamatanId === p.kecamatanId && (target.role === "penyuluh" || target.role === "admin_bpp");
}

async function desaDiKecamatan(ids: number[], kecamatanId: number | null): Promise<boolean> {
  if (ids.length === 0) return true;
  if (!kecamatanId) return false;
  const { data } = await supabaseAdmin().from("desa").select("id").in("id", ids).eq("kecamatan_id", kecamatanId);
  return (data?.length ?? 0) === new Set(ids).size;
}

async function dataTarget(id: string) {
  const a = supabaseAdmin();
  const [{ data: ang }, { data: mem }] = await Promise.all([
    a.from("anggota").select("kecamatan_id").eq("user_id", id).maybeSingle(),
    a.schema("core").from("memberships").select("role").eq("user_id", id).eq("app_slug", "ltt").maybeSingle(),
  ]);
  if (!ang || !mem) return null;
  return { role: mem.role as Role, kecamatanId: ang.kecamatan_id as number | null };
}

async function gantiDesaBinaan(userId: string, ids: number[]) {
  const a = supabaseAdmin();
  const { error: e1 } = await a.from("anggota_desa").delete().eq("user_id", userId);
  if (e1) throw new Error(e1.message);
  if (ids.length) {
    const { error: e2 } = await a.from("anggota_desa").insert([...new Set(ids)].map((desa_id) => ({ user_id: userId, desa_id })));
    if (e2) throw new Error(e2.message);
  }
}

function selesai(): void {
  revalidatePath("/kab/pengguna");
  revalidatePath("/bpp/pengguna");
  revalidatePath("/bpp/target");
}

// ─── Tambah ───────────────────────────────────────────────────────────────────
const skemaTambah = z.object({
  nip, nama, whatsapp: wa, password,
  role: z.enum(ROLE).default("penyuluh"),
  kecamatanId: z.number().int().positive().nullable().default(null),
  desaIds,
});

export async function tambahPenggunaAction(input: z.input<typeof skemaTambah>): Promise<HasilAksi> {
  const p = await pemanggil();
  const cek = skemaTambah.safeParse(input);
  if (!cek.success) return { sukses: false, pesan: cek.error.issues[0]?.message ?? "Isian tidak valid." };
  const d = cek.data;
  // BPP: role & kecamatan dikunci
  const role: Role = p.role === "admin_bpp" ? "penyuluh" : d.role;
  const kecamatanId = p.role === "admin_bpp" ? p.kecamatanId : d.kecamatanId;
  if ((role === "penyuluh" || role === "admin_bpp") && !kecamatanId) return { sukses: false, pesan: "Kecamatan wajib dipilih untuk PPL/BPP." };
  if (!(await desaDiKecamatan(d.desaIds, kecamatanId))) return { sukses: false, pesan: "Desa binaan harus berada di kecamatan pengguna." };

  const a = supabaseAdmin();
  try {
    const { data: ada } = await a.schema("core").from("profiles").select("id").eq("nip", d.nip).maybeSingle();
    let userId = ada?.id as string | undefined;
    let pesanAkun = "";

    if (userId) {
      const { data: m } = await a.schema("core").from("memberships").select("role").eq("user_id", userId).eq("app_slug", "ltt").maybeSingle();
      if (m) return { sukses: false, pesan: "NIP ini sudah terdaftar di SMART LTT." };
      pesanAkun = " Akun ini sudah dipakai di aplikasi lain, jadi login memakai password yang sudah ada (password baru diabaikan).";
    } else {
      const email = `${d.nip.toLowerCase()}@${env().AUTH_EMAIL_DOMAIN}`;
      const { data: dibuat, error } = await a.auth.admin.createUser({ email, password: d.password, email_confirm: true });
      if (error || !dibuat.user) return { sukses: false, pesan: `Gagal membuat akun: ${error?.message ?? "-"}` };
      userId = dibuat.user.id;
      const { error: ep } = await a.schema("core").from("profiles").upsert({ id: userId, email, nama: d.nama, nip: d.nip }, { onConflict: "id" });
      if (ep) throw new Error(ep.message);
    }

    const { error: em } = await a.schema("core").from("memberships").insert({ user_id: userId, app_slug: "ltt", role });
    if (em) throw new Error(em.message);
    const { error: ea } = await a.from("anggota").upsert(
      { user_id: userId, kecamatan_id: kecamatanId, whatsapp: d.whatsapp || null, aktif: true, wajib_ganti_password: !pesanAkun },
      { onConflict: "user_id" },
    );
    if (ea) throw new Error(ea.message);
    await gantiDesaBinaan(userId, d.desaIds);
    selesai();
    return { sukses: true, pesan: `${d.nama} ditambahkan. Login dengan NIP ${d.nip}.${pesanAkun}` };
  } catch (e) {
    return { sukses: false, pesan: `Gagal menyimpan: ${e instanceof Error ? e.message : "kesalahan"}` };
  }
}

// ─── Ubah ─────────────────────────────────────────────────────────────────────
const skemaUbah = z.object({
  id: z.uuid(),
  nama, whatsapp: wa,
  aktif: z.boolean(),
  role: z.enum(ROLE).optional(),
  kecamatanId: z.number().int().positive().nullable().optional(),
  desaIds,
});

export async function ubahPenggunaAction(input: z.input<typeof skemaUbah>): Promise<HasilAksi> {
  const p = await pemanggil();
  const cek = skemaUbah.safeParse(input);
  if (!cek.success) return { sukses: false, pesan: cek.error.issues[0]?.message ?? "Isian tidak valid." };
  const d = cek.data;
  const t = await dataTarget(d.id);
  if (!t) return { sukses: false, pesan: "Pengguna tidak ditemukan." };
  if (!bolehKelola(p, t)) return { sukses: false, pesan: "Anda tidak berhak mengubah pengguna ini." };
  if (d.id === p.id && !d.aktif) return { sukses: false, pesan: "Tidak bisa menonaktifkan akun sendiri." };

  // BPP tidak boleh mengubah nama / role / kecamatan
  const role = p.role === "admin_kab" && d.role ? d.role : t.role;
  const kecamatanId = p.role === "admin_kab" && d.kecamatanId !== undefined ? d.kecamatanId : t.kecamatanId;
  if (d.id === p.id && role !== p.role) return { sukses: false, pesan: "Tidak bisa mengubah role akun sendiri." };
  if (!(await desaDiKecamatan(d.desaIds, kecamatanId))) return { sukses: false, pesan: "Desa binaan harus berada di kecamatan pengguna." };

  const a = supabaseAdmin();
  try {
    // Nama hanya boleh diubah Admin Kabupaten
    if (p.role === "admin_kab") {
      const { error: ep } = await a.schema("core").from("profiles").update({ nama: d.nama }).eq("id", d.id);
      if (ep) throw new Error(ep.message);
    }
    if (role !== t.role) {
      const { error } = await a.schema("core").from("memberships").update({ role }).eq("user_id", d.id).eq("app_slug", "ltt");
      if (error) throw new Error(error.message);
    }
    const { error: ea } = await a
      .from("anggota")
      .update({ kecamatan_id: kecamatanId, whatsapp: d.whatsapp || null, aktif: d.aktif })
      .eq("user_id", d.id);
    if (ea) throw new Error(ea.message);
    await gantiDesaBinaan(d.id, d.desaIds);
    selesai();
    return { sukses: true, pesan: `Data ${d.nama} tersimpan.` };
  } catch (e) {
    return { sukses: false, pesan: `Gagal menyimpan: ${e instanceof Error ? e.message : "kesalahan"}` };
  }
}

// ─── Reset password ───────────────────────────────────────────────────────────
const skemaReset = z.object({ id: z.uuid(), password });

export async function resetPasswordAction(input: z.input<typeof skemaReset>): Promise<HasilAksi> {
  const p = await pemanggil();
  const cek = skemaReset.safeParse(input);
  if (!cek.success) return { sukses: false, pesan: cek.error.issues[0]?.message ?? "Isian tidak valid." };
  const t = await dataTarget(cek.data.id);
  if (!t) return { sukses: false, pesan: "Pengguna tidak ditemukan." };
  if (!bolehKelola(p, t)) return { sukses: false, pesan: "Anda tidak berhak mereset password pengguna ini." };

  const a = supabaseAdmin();
  const { error } = await a.auth.admin.updateUserById(cek.data.id, { password: cek.data.password });
  if (error) return { sukses: false, pesan: `Gagal reset: ${error.message}` };
  await a.from("anggota").update({ wajib_ganti_password: true }).eq("user_id", cek.data.id);
  selesai();
  return { sukses: true, pesan: "Password direset. Berlaku juga di aplikasi lain (akun bersama CWS)." };
}
