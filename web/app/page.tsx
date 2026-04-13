import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { moduleDefinitions } from "@/app/modules";
import UserSessionPill from "@/app/_components/user-session-pill";

const appNodes = moduleDefinitions;

export default async function Home() {
  const session = await auth();

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-6xl px-6 py-8">
      {/* header */}
      <header className="animate-fade-in mb-10 flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">V2X Connect</p>
          <h2 className="mt-2 text-xl font-bold text-zinc-100 sm:text-2xl">
            Emergency Vehicle Clearance System
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="status-badge hidden sm:inline-flex">
            <span className="status-badge-dot" />
            System Online
          </span>
          {session?.user && <Link className="btn-secondary" href="/dashboard">Dashboard</Link>}
          <UserSessionPill />
        </div>
      </header>

      {/* hero */}
      <section
        className="hero-glow hero-immersive scanline-wrap animate-fade-in-up rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl"
        style={{ animationDelay: "60ms" }}
      >
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Real-time V2V · V2I · GPS · AI Guidance
            </p>
            <h1 className="text-gradient mt-3 text-3xl font-bold sm:text-5xl">
              Main Platform Index
            </h1>
            <p className="mt-4 max-w-3xl text-zinc-300">
              Monitor emergency operations, route coordination, and authenticated
              access from one main website entry point.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              {session?.user ? (
                <Link className="btn-primary micro-interaction" href="/dashboard">Open Dashboard</Link>
              ) : (
                <Link className="btn-primary micro-interaction" href="/signin">Sign in</Link>
              )}
            </div>
          </div>
          <div className="animate-fade-in-up hidden lg:block">
            <Image
              src="/ai-orb.svg"
              alt="AI V2X guidance visual"
              width={180}
              height={180}
              priority
              className="rounded-2xl border border-cyan-500/20 bg-black/30"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-100 lg:hidden">
          <Image src="/ai-orb.svg" alt="" aria-hidden width={36} height={36} className="rounded-md border border-cyan-500/20" />
          <span>AI copilot is active on module pages for risk scoring and yield recommendations.</span>
        </div>
        <div className="mt-8 rounded-xl border border-zinc-800 bg-black p-4 text-sm text-zinc-300">
          <strong className="text-zinc-200">Status:</strong>{" "}
          {session?.user ? (
            <span className="acc-good">
              Signed in as {session.user.email ?? session.user.name}
            </span>
          ) : (
            <span className="text-zinc-400">Not signed in</span>
          )}
        </div>
      </section>

      {/* module grid */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {appNodes.map((node, i) => (
          <Link
            key={node.slug}
            href={`/${node.slug}`}
            className="card-glow animate-fade-in-up rounded-xl border border-zinc-800 bg-zinc-950 p-5"
            style={{ animationDelay: `${120 + i * 55}ms` }}
          >
            <h3 className="text-xl font-semibold text-zinc-100">{node.title}</h3>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-500">{node.badge}</p>
            <p className="mt-3 text-zinc-300">{node.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
