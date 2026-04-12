# Vercel Deployment Guide

## 1. Prerequisites

- GitHub repository connected to Vercel
- Node.js 20+ locally (for pre-deploy verification)
- Firebase project configured

## 2. Firebase Auth Domain Setup (Required)

Because this app uses Firebase Auth in the browser, add your Vercel domain to Firebase authorized domains.

1. Open Firebase Console
2. Go to Authentication -> Settings -> Authorized domains
3. Add:
   - `<your-project>.vercel.app`
   - Your custom production domain (if any)

Without this, Google sign-in can fail with auth domain errors.

If you see `auth/unauthorized-domain`, this is the fix:

- Firebase Console -> Authentication -> Settings -> Authorized domains
- Add the exact Vercel host serving your app (for example `v2v-v2i-project.vercel.app`)
- Add your custom domain host too, if configured
- Do not include protocol (`https://`) or path

## 3. Deploy on Vercel

### Option A: Vercel Dashboard

1. Import the GitHub repo in Vercel
2. Framework preset: Next.js
3. Build command: `npm run build`
4. Output: default Next.js
5. Deploy

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel
vercel --prod
```

## 4. Post-Deploy Validation

Validate these routes:

- `/`
- `/login`
- `/user-portal`
- `/admin`
- `/admin-preview`
- `/control`
- `/emergency`
- `/signal`
- `/vehicle1`
- `/vehicle2`

## 5. Caching and Service Worker Notes

This repo sets headers in `next.config.mjs` to support Vercel hosting:

- `sw.js` is forced no-cache for safe service worker updates

## 6. If Migrating from Firebase Hosting

`firebase.json` can remain in the repo for historical fallback, but Vercel deployment uses Next.js config and `vercel.json`.

If you also want to publish the static bundle on Firebase Hosting site target:

1. Put static assets in the deploy directory (`public/`).
2. From the app root, run:

```bash
firebase deploy --only hosting:v2v-v2i-6f64c
```

## 7. Troubleshooting

### Google sign-in popup blocked or auth-domain issue

- Ensure your Vercel domain is in Firebase authorized domains
- Check browser popup permissions

### Google auth unauthorized domain on Vercel

- Verify the deployed host in Vercel dashboard
- Add that host in Firebase Authorized domains
- Hard refresh after saving Firebase settings

### Service worker stale behavior

- Hard refresh once
- Confirm `/sw.js` response has no-cache headers
