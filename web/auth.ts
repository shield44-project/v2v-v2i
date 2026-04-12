import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const googleClientId = process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET;
const hasGoogleOAuth = Boolean(googleClientId && googleClientSecret);
const EIGHT_HOURS_IN_SECONDS = 8 * 60 * 60;

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
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/signin",
  },
});
