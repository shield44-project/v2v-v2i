import Link from "next/link";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-16">
      <section className="w-full rounded-2xl border border-white/10 bg-slate-950/70 p-8 shadow-2xl backdrop-blur">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-cyan-300">
          V2X Connect
        </p>
        <h1 className="text-4xl font-bold text-white sm:text-5xl">
          Refactored for Next.js, TypeScript, and Vercel Google Sign-In
        </h1>
        <p className="mt-4 max-w-3xl text-slate-300">
          Firebase auth has been removed from the active application path. Use
          secure Google OAuth via Auth.js on Vercel and access a protected V2X
          dashboard.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          {session?.user ? (
            <Link className="btn-primary" href="/dashboard">
              Open Dashboard
            </Link>
          ) : (
            <Link className="btn-primary" href="/signin">
              Sign in with Google
            </Link>
          )}
          <a
            className="btn-secondary"
            href="https://vercel.com/docs/authentication/oauth/google"
            target="_blank"
            rel="noreferrer"
          >
            Google OAuth Setup
          </a>
        </div>
        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-300">
          <strong>Status:</strong>{" "}
          {session?.user
            ? `Signed in as ${session.user.email ?? session.user.name}`
            : "Not signed in"}
        </div>
      </section>
    </main>
  );
}
