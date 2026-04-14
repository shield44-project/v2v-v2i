import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getModuleBySlug } from "@/app/modules";
import { canAccessModule, isAdminEmail } from "@/app/module-access";
import ModuleInteractivePanel from "@/app/_components/module-interactive-panel";
import UserSessionPill from "@/app/_components/user-session-pill";

type ModulePageProps = {
  slug: string;
};

export default async function ModulePage({ slug }: ModulePageProps) {
  const moduleInfo = getModuleBySlug(slug);
  if (!moduleInfo) {
    notFound();
  }

  const session = await auth();
  const email = session?.user?.email ?? null;
  const isAdminUser = isAdminEmail(email);

  if (!canAccessModule(moduleInfo.slug, email)) {
    redirect(session?.user ? "/dashboard" : "/signin");
  }

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-6xl px-6 py-8">
      {/* header */}
      <header className="animate-fade-in mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">V2X Connect</p>
          <h1 className="text-gradient mt-2 text-2xl font-bold">{moduleInfo.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary" href="/">Main Index</Link>
          {session?.user && <Link className="btn-secondary" href="/dashboard">Dashboard</Link>}
          <UserSessionPill />
        </div>
      </header>

      {/* module info card */}
      <section
        className="hero-glow scanline-wrap animate-fade-in-up rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-xl"
        style={{ animationDelay: "60ms" }}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{moduleInfo.badge}</p>
        <p className="mt-4 max-w-3xl text-zinc-300">{moduleInfo.description}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {moduleInfo.highlights.map((highlight, i) => (
            <span
              key={highlight}
              className="animate-fade-in-up rounded-full border border-zinc-700 bg-black px-3 py-1 text-xs text-zinc-300 transition hover:border-zinc-500"
              style={{ animationDelay: `${120 + i * 45}ms` }}
            >
              {highlight}
            </span>
          ))}
        </div>
        <a className="btn-primary mt-8 inline-flex cursor-pointer" href="#module-live-tools">
          {moduleInfo.primaryAction}
        </a>
      </section>

      <div id="module-live-tools">
        <ModuleInteractivePanel
          slug={moduleInfo.slug}
          title={moduleInfo.title}
          isAdminUser={isAdminUser}
        />
      </div>
    </main>
  );
}
