# V2X Connect — Current Codebase Summary (Adapted)

This summary is adapted to the **actual active codebase** in this repository.

## Active platform
- Runtime app: `web/` (Next.js 15 + TypeScript + App Router)
- Auth: Auth.js (`next-auth`) with Google sign-in
- Deploy target: Vercel
- Legacy Firebase/static HTML docs in root are historical references

## Working routes
- `/` main index
- `/signin` sign-in
- `/dashboard` authenticated module launcher
- `/control`, `/emergency`, `/signal`, `/vehicle1`, `/vehicle2`, `/admin`, `/admin-preview`, `/user-portal`

## What is now implemented
- Functional module pages with interactive tools:
  - GPS tracker initialization for **all 4 units**
  - Interactive dashboard tab
  - Live metric cards (accuracy/confidence/speed/bearing)
  - Street/satellite map switching
  - Admin/Admin-preview read-only review table with filter
- Global **Report Issue** button:
  - Opens prefilled support email with route + timestamp + browser info
  - Enabled via `NEXT_PUBLIC_SUPPORT_EMAIL`
- Custom app icon configured via `web/app/icon.svg` + metadata
- Map work tracking doc added: `MAPS_TODO.md`

## Documentation updates
- Added Vercel-first admin implementation guide:
  - `VERCEL_ADMIN_GUIDE.md`
- Root README updated with:
  - current active app notes
  - map TODO reference
  - support email setup
  - Auth.js v5 URL env guidance

## Required env vars (current)
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_URL` (preferred) / `NEXTAUTH_URL` (legacy compatibility)
- `SUPER_ADMIN_EMAIL=kstejas2718@gmail.com`
- `NEXT_PUBLIC_SUPPORT_EMAIL=<your support mailbox>`

## Validation status
- `npm run lint` ✅
- `npm run build` ✅
- CodeQL security scan: no alerts ✅

## Notes
- This summary reflects the current Next.js/Vercel implementation, not the older Firebase HTML architecture.
