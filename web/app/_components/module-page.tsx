import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getModuleBySlug } from "@/app/modules";

type ModulePageProps = {
  slug: string;
};

export default async function ModulePage({ slug }: ModulePageProps) {
  const moduleInfo = getModuleBySlug(slug);
  if (!moduleInfo) {
    notFound();
  }

  const session = await auth();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">V2X Connect</p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-100">{moduleInfo.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary" href="/">
            Main Index
          </Link>
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

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{moduleInfo.badge}</p>
        <p className="mt-4 max-w-3xl text-zinc-300">{moduleInfo.description}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {moduleInfo.highlights.map((highlight) => (
            <span
              key={highlight}
              className="rounded-full border border-zinc-700 bg-black px-3 py-1 text-xs text-zinc-300"
            >
              {highlight}
            </span>
          ))}
        </div>
        <button className="btn-primary mt-8 cursor-pointer" type="button">
          {moduleInfo.primaryAction}
        </button>
      </section>
    </main>
  );
}
