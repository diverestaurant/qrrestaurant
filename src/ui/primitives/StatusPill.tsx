type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const tones: Record<StatusTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-sky-100 text-sky-800",
};

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{label}</span>;
}
