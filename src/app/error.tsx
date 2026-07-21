"use client";

import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep the digest useful for local/hosted logs without rendering internals.
    console.error("DIVE route boundary", { digest: error.digest, name: error.name });
  }, [error]);

  return <main className="flex min-h-screen items-center justify-center bg-background px-5"><section className="w-full max-w-xl rounded-3xl border bg-surface p-7 shadow-sm" role="alert"><p className="text-xs font-semibold tracking-[0.12em] text-danger uppercase">Unable to load committed data</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">This workspace needs a fresh read.</h1><p className="mt-4 leading-7 text-muted">No command was assumed to have failed or succeeded. Check the connection, then retry to resync from the database.</p>{error.digest && <p className="mt-3 font-mono text-xs text-muted">Reference: {error.digest}</p>}<button className="mt-6 min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white" onClick={reset}>Retry authoritative read</button></section></main>;
}
