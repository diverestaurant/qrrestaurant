"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { PrintButton } from "@/ui/staff/PrintButton";

export function PrintableQrEntry({ entryPath, label, version }: { entryPath: string; label: string; version: number }) {
  const [qr, setQr] = useState<{ image: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const absoluteUrl = new URL(entryPath, window.location.origin).toString();
    void QRCode.toDataURL(absoluteUrl, { errorCorrectionLevel: "H", margin: 2, width: 420, color: { dark: "#17211B", light: "#FFFFFF" } })
      .then((value) => { if (active) setQr({ image: value, url: absoluteUrl }); })
      .catch(() => { if (active) setError("The QR image could not be generated. Rotate again before printing."); });
    return () => { active = false; };
  }, [entryPath]);

  return <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950" data-print-root role="status">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">One-time Table Entry QR for {label}</p><p className="mt-1 text-xs">Credential version {version} · rotating again revokes this print.</p></div>{qr && <PrintButton label="Print Table QR" />}</div>
    {error && <p className="mt-3 text-sm" role="alert">{error}</p>}
    {qr && <div className="mt-5 grid items-center gap-5 sm:grid-cols-[220px_1fr]"><Image alt={`Table Entry QR for ${label}`} className="mx-auto size-[220px] rounded-xl bg-white" height={220} src={qr.image} unoptimized width={220} /><div><p className="text-3xl font-semibold">{label}</p><p className="mt-3 break-all font-mono text-xs">{qr.url}</p><p className="mt-4 text-sm leading-6">Scan to open the public menu. A rotating Session Join Code is still required before this device can see or change the current table Session.</p></div></div>}
  </div>;
}
