"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { urlDengan } from "@/lib/param";

/**
 * Link yang memakai parameter URL saat ini (termasuk filter yang diubah di browser lewat replaceState)
 * + perubahan `ubah`. Mis. tombol "Tambah" → ?edit=baru tanpa kehilangan filter.
 */
export function TautanUrlKini({
  dasar, ubah, className, title, children,
}: {
  dasar: string;
  ubah: Record<string, string | number | null>;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const sp = useSearchParams();
  return (
    <Link href={urlDengan(dasar, Object.fromEntries(sp.entries()), ubah)} scroll={false} title={title} className={className}>
      {children}
    </Link>
  );
}
