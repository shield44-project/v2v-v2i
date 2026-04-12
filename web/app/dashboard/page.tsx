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
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Authenticated</p>
          <h1 className="mt-2 text-3xl font-bold text-zinc-100">V2X Operations Dashboard</h1>
          <p className="mt-2 text-zinc-300">
            Signed in as {session.user.email ?? session.user.name ?? "Google user"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="btn-secondary" href="/">
            Main Index
          </Link>
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

      <section className="grid gap-4 sm:grid-cols-2">
        {moduleDefinitions.map((moduleItem) => (
          <Link
            key={moduleItem.slug}
            href={`/${moduleItem.slug}`}
            className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 transition hover:border-zinc-500 hover:bg-black"
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
