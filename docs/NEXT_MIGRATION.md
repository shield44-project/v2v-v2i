# Next.js Migration Notes

## Goal

Move the existing static multi-page V2V/V2I stack into a Next.js runtime without breaking existing behavior.

## Migration Strategy Implemented

1. Added Next.js app shell and route pages.
2. Copied legacy HTML/JS assets into `public/`.
3. Created route wrappers that host each legacy module.
4. Added `/legacy/*` rewrites for direct raw-page access.

## Current State

- Next.js handles app routing.
- Login and user portal are now native React pages in App Router.
- Legacy modules still execute their original JS and Firebase logic.
- Existing IDs, inline scripts, and geolocation/map code remain intact.

## Native Pages Completed

- `app/login/page.js`
- `app/user-portal/page.js`
- `app/admin/page.js`
- `app/control/page.js`
- `app/emergency/page.js`
- `app/signal/page.js`
- `app/vehicle1/page.js`
- `app/vehicle2/page.js`
- `app/admin-preview/page.js`
- Shared Firebase script bridge: `app/components/LegacyFirebaseScripts.js`
- Shared role node page: `app/components/RoleNodePage.js`

Legacy iframe wrapper component has been removed since all major routes are now native App Router pages.

## Stability Improvements Added

- Native role pages now keep GPS watchers stable without unnecessary re-initialization.
- Offline-aware realtime writes: latest payload is queued and auto-synced on reconnect.
- Network and last-sync status indicators were added to role node screens.
- Control range inputs now enforce minimum valid values before writing config.

These pages reuse existing `firebase-config.js` globals for compatibility while moving UI and navigation into Next.js components.

## Legacy Fallback

- Legacy snapshots are available under `archive/legacy/*` as `.md` files.
- Fallback route aliases are available under `/legacy/*`.

## Why This Approach

A direct full React rewrite of all pages would be high-risk because the original codebase has:
- heavy inline script logic,
- many direct DOM mutations,
- global state on `window`,
- strict script load order dependencies.

This approach provides immediate Next.js adoption with low regression risk.

## Recommended Next Steps

1. Extract auth/session logic from `firebase-config.js` into Next-friendly modules.
2. Move one module at a time from legacy HTML to React components.
3. Replace direct DOM writes with React state/hooks.
4. Introduce TypeScript interfaces for Firebase payloads.
