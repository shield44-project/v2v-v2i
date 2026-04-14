import Link from "next/link";
import { auth } from "@/auth";
import AdminDashboard from "@/app/_components/admin-dashboard";
import { isAdminEmail } from "@/app/module-access";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";

  if (!session?.user) {
    redirect("/signin");
  }
  if (!isAdminEmail(email)) {
    redirect("/dashboard");
  }

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
        isInitiallyAdmin
      />
    </main>
  );
}
