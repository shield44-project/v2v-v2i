import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

const roleCards = [
  {
    title: "Control Center",
    description: "Monitor live V2X health and emergency routing state.",
  },
  {
    title: "Emergency Vehicle",
    description: "Track response units and dispatch metadata securely.",
  },
  {
    title: "Smart Signal",
    description: "Coordinate signal preemption with authenticated controls.",
  },
  {
    title: "Civilian Vehicle Nodes",
    description: "Observe safe-distance telemetry with role-based visibility.",
  },
];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-950/70 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Authenticated</p>
          <h1 className="mt-2 text-3xl font-bold text-white">V2X Operations Dashboard</h1>
          <p className="mt-2 text-slate-300">
            Signed in as {session.user.email ?? session.user.name ?? "Google user"}
          </p>
        </div>
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
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {roleCards.map((card) => (
          <article
            key={card.title}
            className="rounded-xl border border-slate-700 bg-slate-900/70 p-5"
          >
            <h2 className="text-xl font-semibold text-white">{card.title}</h2>
            <p className="mt-2 text-slate-300">{card.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
