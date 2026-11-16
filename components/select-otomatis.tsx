"use client";

import type { ComponentProps } from "react";
import { useTopLoader } from "nextjs-toploader";

/** <select> yang langsung mengirim form induknya saat pilihan berubah (filter GET), dengan bilah muat. */
export function SelectOtomatis(props: ComponentProps<"select">) {
  const loader = useTopLoader();
  return (
    <select
      {...props}
      onChange={(e) => {
        loader.start();
        e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
