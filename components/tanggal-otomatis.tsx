"use client";

import type { ComponentProps } from "react";
import { useTopLoader } from "nextjs-toploader";

/** <input type="date"> yang langsung mengirim form induknya saat tanggal lengkap dipilih (filter GET), dengan bilah muat. */
export function TanggalOtomatis(props: Omit<ComponentProps<"input">, "type">) {
  const loader = useTopLoader();
  return (
    <input
      {...props}
      type="date"
      onChange={(e) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(e.currentTarget.value)) return;
        loader.start();
        e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
