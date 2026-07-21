import Link from "next/link";

export default function NotFound() {
  return <main className="flex min-h-screen items-center justify-center bg-background px-5"><section className="w-full max-w-xl rounded-3xl border bg-surface p-7 shadow-sm"><p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">Entry unavailable</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">This table link is not active.</h1><p className="mt-4 leading-7 text-muted">Ask restaurant staff for the current table QR. Old or rotated tokens cannot open a table Session.</p><Link className="mt-6 inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold" href="/">Return to DIVE</Link></section></main>;
}
