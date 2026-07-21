import Link from "next/link";

const roleCards = [
  { href: "/order/demo", eyebrow: "Customer", title: "Order from your table", detail: "Browse a live-safe demo menu, keep the cart honest, and see the session boundary." },
  { href: "/kds", eyebrow: "Kitchen", title: "Keep the pass clear", detail: "A high-density queue with station ownership, timers, and reconnect-safe states." },
  { href: "/waiter", eyebrow: "Waiter", title: "Move the floor forward", detail: "Table status, service requests, session handoff, and manual order fallback." },
  { href: "/cashier", eyebrow: "Cashier", title: "Close with confidence", detail: "Authoritative bill snapshot, multi-tender payment states, and receipt recovery." },
  { href: "/admin", eyebrow: "Admin", title: "Shape the operation", detail: "Menu, people, branch, audit, and report controls in a separate shell." },
];

export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:py-24">
        <div>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-brand uppercase shadow-sm">
            <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
            DIVE / secure ordering
          </div>
          <h1 className="max-w-3xl text-5xl leading-[0.98] font-semibold tracking-[-0.06em] text-foreground sm:text-7xl">
            The calm layer between a table and a full restaurant.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-muted">
            A secure, session-first ordering workspace for customers, kitchen, floor, cashier, and admin — designed to stay clear when the network gets noisy.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link className="rounded-full bg-brand px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-strong" href="/order/demo">
              Open customer demo
            </Link>
            <Link className="rounded-full border bg-white px-5 py-3 font-semibold text-foreground transition hover:bg-brand-soft" href="/kds">
              Preview KDS shell
            </Link>
          </div>
        </div>
        <div className="rounded-[2rem] border bg-[#123c37] p-6 text-white shadow-xl shadow-[#123c37]/15 sm:p-8">
          <p className="text-sm font-semibold tracking-[0.16em] text-[#a7e8db] uppercase">Golden Path</p>
          <div className="mt-7 space-y-5">
            {["Static QR → public menu", "Waiter opens Session → Join Code", "Customer order → Kitchen queue", "Serve → multi-tender → receipt", "Close → old grant revoked"].map((step, index) => (
              <div className="flex items-center gap-4" key={step}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#2e776d] text-sm font-semibold">{index + 1}</span>
                <span className="text-sm text-[#e7fbf6]">{step}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 border-t border-white/15 pt-5 text-xs leading-5 text-[#b9d6d0]">
            Synthetic fixture only. No real customer data or payment is used in this environment.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:pb-24">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.12em] text-brand uppercase">Role surfaces</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Five focused apps. One source of truth.</h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-muted">Visual foundation is contract-preserving GREEN work. Permissions and financial truth stay server-side.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {roleCards.map((card) => (
            <Link className="group rounded-3xl border bg-surface p-5 shadow-sm transition hover:-translate-y-1 hover:border-brand/50 hover:shadow-md" href={card.href} key={card.eyebrow}>
              <p className="text-xs font-semibold tracking-[0.13em] text-brand uppercase">{card.eyebrow}</p>
              <h3 className="mt-8 text-xl leading-tight font-semibold tracking-tight">{card.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{card.detail}</p>
              <span className="mt-6 inline-flex text-sm font-semibold text-brand transition group-hover:translate-x-1">Open surface →</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
