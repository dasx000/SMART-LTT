"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTopLoader } from "nextjs-toploader";
import { RotateCw } from "lucide-react";

/**
 * Tombol muat ulang: ikon berputar selama data dimuat (+ bilah muat di atas).
 * Tanpa `href` → muat ulang halaman ini (filter tetap). Dengan `href` → pindah ke URL itu (mis. reset filter).
 */
export function TombolMuatUlang({
  href,
  label,
  className,
  ukuran = 14,
  title = "Muat ulang",
}: {
  href?: string;
  label?: string;
  className?: string;
  ukuran?: number;
  title?: string;
}) {
  const router = useRouter();
  const loader = useTopLoader();
  const [pending, startTransition] = useTransition();
  // Putar minimal sebentar supaya terlihat walau data cepat dimuat.
  const [minimal, setMinimal] = useState(false);
  const berputar = pending || minimal;

  useEffect(() => {
    if (!minimal) return;
    const t = setTimeout(() => setMinimal(false), 600);
    return () => clearTimeout(t);
  }, [minimal]);

  // Selesaikan bilah muat hanya untuk aksi tombol ini sendiri.
  const aktif = useRef(false);
  useEffect(() => {
    if (aktif.current && !pending && !minimal) {
      aktif.current = false;
      loader.done();
    }
  });

  return (
    <button
      type="button"
      title={title}
      aria-busy={berputar}
      disabled={berputar}
      onClick={() => {
        aktif.current = true;
        setMinimal(true);
        loader.start();
        startTransition(() => {
          if (href) router.push(href, { scroll: false });
          else router.refresh();
        });
      }}
      className={`disabled:cursor-wait ${className ?? ""}`}
    >
      <RotateCw size={ukuran} className={berputar ? "animate-spin" : ""} />
      {label}
    </button>
  );
}
