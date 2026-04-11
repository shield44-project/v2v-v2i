# Architecture Overview

## Runtime Layers

1. Next.js App Router (`app/`)
- Hosts top-level routes and shared layout.
- Provides a stable migration control plane.
- Includes native React pages for login and role selection.
- Includes native React pages for login, role selection, admin, control, emergency, signal, vehicle1, and vehicle2.
- Includes native React pages for login, role selection, admin, admin-preview, control, emergency, signal, vehicle1, and vehicle2.

2. Legacy Simulation Layer (`public/*.html`, `public/*.js`)
- Contains existing V2V/V2I page logic.
- Uses Firebase Realtime Database and browser APIs.
- Retained as fallback compatibility layer under `/legacy/*` routes.

## Route Model

- Primary routes (Next pages):
  - `/login`, `/admin`, `/control`, `/user-portal`, `/emergency`, `/signal`, `/vehicle1`, `/vehicle2`, `/admin-preview`
- Legacy direct aliases:
  - `/legacy/login`, `/legacy/admin`, etc.

## Data and Integrations

- Firebase Auth + Realtime Database from legacy scripts.
- Leaflet and GPS tracking from legacy browser modules.
- Service worker remains available from `public/sw.js`.

## Incremental Refactor Path

1. Create shared client helpers for Firebase access.
2. Port login/auth flows to native React components. ✅
3. Port role pages (user portal/admin) next. User portal and admin ✅
4. Port control map and live tracking last. Basic control panel and role nodes are native ✅, advanced legacy map UI still available via `/legacy/control`
