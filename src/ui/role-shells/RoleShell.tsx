import Link from "next/link";
import type { ReactNode } from "react";
import { LiveStatus } from "@/ui/recovery/LiveStatus";

type RoleShellProps = { role: string; title: string; description: string; freshness?: string; children: ReactNode };

export function RoleShell({ role, title, description, freshness = "Local fixture · synced just now", children }: RoleShellProps) {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="text-sm font-bold tracking-[0.14em] text-brand uppercase">DIVE / {role}</Link>
          <div className="flex flex-wrap items-center justify-end gap-3"><span className="text-xs text-muted">{freshness}</span><LiveStatus /></div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
        <div className="mb-8 max-w-2xl"><p className="text-sm font-semibold tracking-[0.12em] text-brand uppercase">{role} workspace</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">{title}</h1><p className="mt-3 leading-7 text-muted">{description}</p></div>
        {children}
      </div>
    </main>
  );
}
