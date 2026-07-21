"use client";

export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return <button className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white" data-no-print onClick={() => window.print()}>{label}</button>;
}
