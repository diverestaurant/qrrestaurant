export default function CustomerLoading() {
  return <div className="min-h-screen bg-background" aria-busy="true" aria-live="polite" role="status"><div className="border-b bg-surface"><div className="mx-auto max-w-7xl px-5 py-5 sm:px-8"><div className="h-4 w-36 animate-pulse rounded-full bg-line" /></div></div><div className="mx-auto max-w-3xl px-5 py-8"><p className="text-sm font-semibold text-brand">Loading the current menu…</p><div className="mt-6 space-y-4">{[0, 1, 2].map((item) => <div className="h-32 animate-pulse rounded-3xl border bg-surface" key={item} />)}</div></div></div>;
}
