# V2V-V2I Project (Next.js Migration)

This repository now runs on Next.js while preserving the original V2X simulation modules.

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
- Kept legacy HTML/JS assets in `public/` to preserve behavior.
- Added legacy direct aliases under `/legacy/*` via rewrites.
- Converted all module routes to native React pages while keeping Firebase compatibility:
  - `/login`, `/user-portal`, `/admin`, `/admin-preview`, `/control`
  - `/emergency`, `/signal`, `/vehicle1`, `/vehicle2`

## Project Layout

- `app/`: Next.js App Router pages and shared UI wrappers.
- `public/`: Legacy HTML and browser scripts used by the original system.
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
- `http://localhost:3000/index.html` for direct legacy entry

## Deploy To Vercel

1. Push this repository to GitHub.
2. Import the repository in Vercel (Framework: Next.js).
3. Deploy with default Next.js settings.
4. In Firebase Console, add your Vercel domain to Auth authorized domains.

Required Firebase step:
- Add `<your-project>.vercel.app` in Firebase Authentication -> Settings -> Authorized domains.
- Add your custom domain too, if used.

Optional Firebase Hosting deploy (static target):

```bash
firebase deploy --only hosting:v2v-v2i-6f64c
```

## Important Notes

- Firebase and mapping logic remain in legacy scripts for compatibility.
- This is a safe migration layer. Full React-native refactor can happen incrementally.
- Native role routes include offline-aware sync indicators and reconnect flush for GPS updates.

## Documentation

See:
- `docs/NEXT_MIGRATION.md`
- `docs/ARCHITECTURE.md`
- `docs/VERCEL_DEPLOYMENT.md`
