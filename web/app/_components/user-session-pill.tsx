import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";

function initials(nameOrEmail?: string | null): string {
  if (!nameOrEmail) return "U";
  const parts = nameOrEmail.trim().split(/\s+/).slice(0, 2);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return nameOrEmail[0]?.toUpperCase() ?? "U";
}

export default async function UserSessionPill() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return <Link className="btn-secondary" href="/signin">Sign in</Link>;
  }

  const label = user.name ?? user.email ?? "Google user";

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-black/40 px-2 py-1 text-xs text-zinc-200">
        {user.image ? (
          <Image
            src={user.image}
            alt={label}
            width={24}
            height={24}
            className="h-6 w-6 rounded-full border border-zinc-600 object-cover"
          />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 font-semibold">
            {initials(label)}
          </span>
        )}
        <span className="hidden max-w-[120px] truncate sm:inline">{label}</span>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button className="btn-secondary cursor-pointer !px-3 !py-1.5 !text-xs" type="submit">
          Logout
        </button>
      </form>
    </div>
  );
}
