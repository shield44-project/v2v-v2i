import Link from "next/link";
import { auth } from "@/auth";
import { ADMIN_EMAILS_HARDCODED } from "@/lib/v2x/admin";
import AdminDashboard from "@/app/_components/admin-dashboard";

export default async function AdminPage() {
  const session = await auth();

  // If signed in via Google and email is in the hardcoded admin list,
  // pass isInitiallyAdmin=true so the dashboard unlocks without a password.
  const email = session?.user?.email ?? "";
  const isInitiallyAdmin = email
    ? ADMIN_EMAILS_HARDCODED.includes(email.toLowerCase())
    : false;

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-6xl px-6 py-8">
      {/* header */}
      <header className="animate-fade-in mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">V2X Connect</p>
          <h1 className="text-gradient mt-2 text-2xl font-bold">Admin Console</h1>
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

      <AdminDashboard
        currentUserEmail={email || "guest"}
        isInitiallyAdmin={isInitiallyAdmin}
      />
    </main>
  );
}
