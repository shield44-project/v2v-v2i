import { auth, signOut } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { moduleDefinitions } from "@/app/modules";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      {/* header */}
      <header
        className="animate-fade-in-up mb-8 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Authenticated</p>
            <span className="status-badge">
              <span className="status-badge-dot" />
              Online
            </span>
          </div>
          <h1 className="text-gradient mt-2 text-3xl font-bold">V2X Operations Dashboard</h1>
          <p className="mt-2 text-zinc-400 text-sm">
            Signed in as{" "}
            <span className="text-zinc-200 font-medium">
              {session.user.email ?? session.user.name ?? "Google user"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="btn-secondary" href="/">Main Index</Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="btn-secondary cursor-pointer" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* module grid */}
      <section className="grid gap-4 sm:grid-cols-2">
        {moduleDefinitions.map((moduleItem, i) => (
          <Link
            key={moduleItem.slug}
            href={`/${moduleItem.slug}`}
            className="card-glow animate-fade-in-up rounded-xl border border-zinc-800 bg-zinc-950 p-5"
            style={{ animationDelay: `${80 + i * 50}ms` }}
          >
            <h2 className="text-xl font-semibold text-zinc-100">{moduleItem.title}</h2>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
              {moduleItem.badge}
            </p>
            <p className="mt-2 text-zinc-300">{moduleItem.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
