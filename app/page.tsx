import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { BERANDA_ROLE, getPenggunaOpsional } from "@/lib/auth";
import { supabaseSiap } from "@/lib/env";

// "/" → arahkan ke beranda sesuai role, atau ke /login.
export default function Beranda() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-muted">Memuat…</p>}>
      <Arahkan />
    </Suspense>
  );
}

async function Arahkan() {
  // Selalu diputuskan saat request (bukan saat build), apa pun isi env saat build.
  await connection();
  if (!supabaseSiap()) redirect("/login");
  const u = await getPenggunaOpsional();
  redirect(u ? BERANDA_ROLE[u.role] : "/login");
  return null;
}
