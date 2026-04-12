import Link from "next/link";
import { auth } from "@/auth";

const appNodes = [
  {
    title: "Control Center",
    description: "Live map dashboard with node activity and event visibility.",
  },
  {
    title: "Emergency Vehicle",
    description: "Broadcasts emergency approach state for priority handling.",
  },
  {
    title: "Traffic Signal",
    description: "Handles signal preemption when emergency traffic is nearby.",
  },
  {
    title: "Civilian Vehicles",
    description: "Receive alerts and coordinated guidance in active zones.",
  },
];

export default async function Home() {
  const session = await auth();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-8">
      <header className="mb-10 flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">V2X Connect</p>
          <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl">
            Emergency Vehicle Clearance System
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {session?.user ? (
            <Link className="btn-secondary" href="/dashboard">
              Dashboard
            </Link>
          ) : (
            <Link className="btn-secondary" href="/signin">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-8 shadow-2xl backdrop-blur">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
          Real-time V2V · V2I · GPS
        </p>
        <h2 className="mt-3 text-3xl font-bold text-white sm:text-5xl">
          Main Platform Index
        </h2>
        <p className="mt-4 max-w-3xl text-slate-300">
          Monitor emergency operations, route coordination, and authenticated
          access from one main website entry point.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          {session?.user ? (
            <Link className="btn-primary" href="/dashboard">
              Open Dashboard
            </Link>
          ) : (
            <Link className="btn-primary" href="/signin">
              Sign in
            </Link>
          )}
        </div>
        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-300">
          <strong>Status:</strong>{" "}
          {session?.user
            ? `Signed in as ${session.user.email ?? session.user.name}`
            : "Not signed in"}
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {appNodes.map((node) => (
          <article key={node.title} className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
            <h3 className="text-xl font-semibold text-white">{node.title}</h3>
            <p className="mt-2 text-slate-300">{node.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
