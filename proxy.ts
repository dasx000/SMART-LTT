import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 "proxy" (dulu middleware): HANYA menyegarkan token sesi Supabase
 * sebelum halaman dirender. Otorisasi (siapa boleh apa) TIDAK di sini, tapi di
 * lib/auth.ts + RLS, sesuai panduan Next 16.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Memicu refresh token bila perlu. Jangan taruh logika lain di antara
  // createServerClient dan baris ini.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  // Lewati aset statis & endpoint server-ke-server (bot VPS pakai token sendiri).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/epusluh|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
