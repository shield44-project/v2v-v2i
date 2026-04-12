import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

export default async function SignInPage() {
  const session = await auth();
  const hasGoogleClientId = Boolean(
    process.env.AUTH_GOOGLE_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  );
  const hasGoogleClientSecret = Boolean(
    process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET,
  );
  const hasAuthSecret = Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET);
  const isGoogleConfigured = Boolean(
    hasGoogleClientId && hasGoogleClientSecret && hasAuthSecret,
  );

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-6">
      {/* background radial glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(0,229,255,0.05) 0%, transparent 70%)",
        }}
      />

      <section className="hero-glow scanline-wrap animate-fade-in-up relative z-10 w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center shadow-2xl">
        <span className="status-badge mx-auto">
          <span className="status-badge-dot" />
          Secure Access
        </span>
        <h1 className="text-gradient mt-4 text-3xl font-bold">Sign in to V2X Connect</h1>
        <p className="mt-3 text-zinc-400">
          Use your Google account. Sessions are encrypted and protected by Auth.js.
        </p>

        {!isGoogleConfigured && (
          <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            Configure Google OAuth and auth secrets before signing in:{" "}
            AUTH_GOOGLE_ID (or GOOGLE_CLIENT_ID), AUTH_GOOGLE_SECRET (or
            GOOGLE_CLIENT_SECRET), and AUTH_SECRET (or NEXTAUTH_SECRET), in
            your deployment or local environment.
          </p>
        )}

        <form
          className="mt-8"
          action={async () => {
            "use server";
            if (!isGoogleConfigured) return;
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button
            className="btn-primary w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={!isGoogleConfigured}
          >
            Continue with Google
          </button>
        </form>
      </section>
    </main>
  );
}
