# V2V-V2I Project (Next.js Migration)

This repository now runs as a Next.js-first project structure with archived legacy assets.

## What Changed

- Added a Next.js App Router shell.
- Added route pages for all simulation modules:
  - `/login`
  - `/admin`
  - `/admin-preview`
  - `/control`
  - `/user-portal`
  - `/emergency`
  - `/signal`
  - `/vehicle1`
  - `/vehicle2`
- Converted all module routes to native React pages while keeping Firebase compatibility:
  - `/login`, `/user-portal`, `/admin`, `/admin-preview`, `/control`
  - `/emergency`, `/signal`, `/vehicle1`, `/vehicle2`
- Archived legacy root/public HTML+JS into `archive/legacy/` for reference only.

## Project Layout

- `app/`: Next.js App Router pages and shared UI wrappers.
- `public/`: Active static runtime assets only (service worker and future static files).
- `archive/legacy/public-static/`: Previous public HTML/JS snapshots.
- `archive/legacy/root-snapshot/`: Previous root HTML/JS snapshots.
- `docs/`: Migration and architecture markdown documentation.

## Run Locally

Requirements:
- Node.js 20+ (npm included)

Environment note:
- If `npm` is missing on your machine, install Node.js first and rerun the commands.

Commands:

```bash
npm install
npm run dev
```

Open:
- `http://localhost:3000/` for Next.js home
- `http://localhost:3000/login` for module routes

## Deploy To Vercel

1. Push this repository to GitHub.
2. Import the repository in Vercel (Framework: Next.js).
3. Deploy with default Next.js settings.
4. In Firebase Console, add your Vercel domain to Auth authorized domains.

Required Firebase step:
- Add `v2x-v2i.vercel.app` in Firebase Authentication -> Settings -> Authorized domains.
- Add your custom domain too, if used.
- If you get `auth/unauthorized-domain`, add the exact deployed Vercel host and reload.

Optional Firebase Hosting deploy (static target):

```bash
firebase deploy --only hosting:v2v-v2i-6f64c
```

## Important Notes

- Firebase compatibility is initialized from Next modules.
- App routes and navigation are Next-native.
- Native role routes include offline-aware sync indicators and reconnect flush for GPS updates.

## Documentation

See:
- `docs/NEXT_MIGRATION.md`
- `docs/ARCHITECTURE.md`
- `docs/VERCEL_DEPLOYMENT.md`
