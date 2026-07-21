export default function Loading() {
  return <div className="min-h-screen bg-background" aria-busy="true" aria-live="polite" role="status">
    <div className="border-b bg-surface"><div className="mx-auto max-w-7xl px-5 py-5 sm:px-8"><div className="h-4 w-40 animate-pulse rounded-full bg-line" /></div></div>
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><p className="sr-only">Loading the latest committed restaurant data…</p><div className="h-5 w-32 animate-pulse rounded-full bg-line" /><div className="mt-4 h-10 max-w-xl animate-pulse rounded-2xl bg-line" /><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <div className="h-40 animate-pulse rounded-3xl border bg-surface" key={item} />)}</div></div>
  </div>;
}
