import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const googleClientId =
  process.env.AUTH_GOOGLE_ID ??
  process.env.GOOGLE_CLIENT_ID ??
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
const effectiveAuthSecret =
  authSecret ??
  (process.env.NODE_ENV !== "production" ? "local-demo-auth-secret" : undefined);
const hasGoogleOAuth = Boolean(googleClientId && googleClientSecret);
const EIGHT_HOURS_IN_SECONDS = 8 * 60 * 60;

if (process.env.VERCEL && !authSecret) {
  throw new Error(
    "Missing auth secret. Set AUTH_SECRET or NEXTAUTH_SECRET in the environment.",
  );
}

if (process.env.NODE_ENV === "development" && !process.env.VERCEL && !authSecret) {
  process.emitWarning(
    "AUTH_SECRET/NEXTAUTH_SECRET is not set. Using local demo fallback secret; configure a real secret for non-demo usage.",
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: EIGHT_HOURS_IN_SECONDS,
  },
  providers: hasGoogleOAuth
    ? [
        Google({
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
        }),
      ]
    : [],
  secret: effectiveAuthSecret,
  pages: {
    signIn: "/signin",
  },
});
