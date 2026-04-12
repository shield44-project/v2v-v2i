# V2X Connect (Next.js + TypeScript + Vercel Google Sign-In)

This repository now ships a refactored web app in `./web` using:

- Next.js (App Router)
- TypeScript
- Auth.js (`next-auth`) with Google OAuth
- Vercel-ready deployment flow

Firebase auth/runtime files have been removed from the active app path.

## 1) Your setup steps (required)

### A. Create Google OAuth credentials
1. Open Google Cloud Console → APIs & Services → Credentials.
2. Create an **OAuth Client ID** (Web application).
3. Add these authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-vercel-domain>/api/auth/callback/google`
   - This callback path is handled automatically by Auth.js in this project.
4. Copy:
   - Client ID
   - Client Secret

### B. Set environment variables
In `./web`, create `.env.local` manually and add:

- `AUTH_SECRET` (or `NEXTAUTH_SECRET`)
- `AUTH_GOOGLE_ID` (or `GOOGLE_CLIENT_ID`)
- `AUTH_GOOGLE_SECRET` (or `GOOGLE_CLIENT_SECRET`)
- `AUTH_URL` (`http://localhost:3000` locally, preferred)
- `NEXTAUTH_URL` (`http://localhost:3000` locally, legacy compatibility)
- `NEXT_PUBLIC_SUPPORT_EMAIL` (email that receives "Report Issue" messages)

### C. Configure Vercel project variables
In Vercel Project Settings → Environment Variables, add:
- `AUTH_SECRET` (or `NEXTAUTH_SECRET`)
- `AUTH_GOOGLE_ID` (or `GOOGLE_CLIENT_ID`)
- `AUTH_GOOGLE_SECRET` (or `GOOGLE_CLIENT_SECRET`)
- `AUTH_URL=https://<your-vercel-domain>` (preferred)
- `NEXTAUTH_URL=https://<your-vercel-domain>` (legacy compatibility)
- `NEXT_PUBLIC_SUPPORT_EMAIL=<your-support-email>`

## 2) Local run

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:3000`.

## 3) Verification checklist

- Home page loads.
- `/signin` opens Google consent.
- After Google login, user lands on `/dashboard`.
- `/dashboard` is inaccessible when signed out (redirects to `/signin`).
- Sign out returns to `/`.

## 4) Security baseline included

- Server-side route protection in `app/dashboard/page.tsx` (`auth()` + redirect) and signed-in redirect logic in `app/signin/page.tsx`.
- Encrypted Auth.js sessions (JWT strategy).
- Security headers via Next config:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` hardening
- `Strict-Transport-Security`
- No Firebase client keys in active runtime.

## 5) Root markdown note

Several root-level markdown files describe legacy static HTML (`*.html`) flows from earlier iterations.
The actively deployed website is the Next.js app in `./web`.

For current map work tracking and next map implementation steps, use:
- `MAPS_TODO.md`

For a full ADMIN_GUIDE-style setup on Vercel (without Firebase), use:
- `VERCEL_ADMIN_GUIDE.md`

## 6) Support issue email flow

- A global **Report Issue** button is shown in the app.
- Clicking it opens a prefilled email with page path, timestamp, and browser context.
- Configure recipient with `NEXT_PUBLIC_SUPPORT_EMAIL` (required to enable the button).
