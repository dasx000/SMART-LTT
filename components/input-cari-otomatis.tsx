"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { useTopLoader } from "nextjs-toploader";

/**
 * <input> pencarian yang mengirim form induknya sendiri setelah pengguna berhenti mengetik
 * (jeda `jeda` ms), supaya tidak memanggil server di setiap huruf. Enter tetap langsung mengirim.
 */
export function InputCariOtomatis({ jeda = 500, ...props }: ComponentProps<"input"> & { jeda?: number }) {
  const loader = useTopLoader();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (
    <input
      {...props}
      onChange={(e) => {
        const form = e.currentTarget.form;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          loader.start();
          form?.requestSubmit();
        }, jeda);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && timer.current) clearTimeout(timer.current);
      }}
    />
  );
}
