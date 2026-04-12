# V2X Connect Environment Setup Guide

## Quick Start

1. **Copy the template:**
   ```bash
   cp .env.example .env.local
   ```

2. **Get Firebase credentials:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project `v2v-v2i-project`
   - Click **Project Settings** (gear icon)
   - Copy all values from "Your web app" section
   - Paste into `.env.local`

3. **Set your email:**
   ```bash
   NEXT_PUBLIC_SUPER_ADMIN_EMAIL="your-email@gmail.com"
   ```
   This email will be automatically promoted to super admin on first login.

4. **Set base URL:**
   ```bash
   # Development:
   NEXT_PUBLIC_BASE_URL="http://localhost:3000"
   
   # Production (Vercel):
   NEXT_PUBLIC_BASE_URL="https://your-app.vercel.app"
   ```

5. **Run locally:**
   ```bash
   npm install
   npm run dev
   ```

## Environment Variables Reference

| Variable | Required | Where Used | Notes |
|----------|----------|-----------|-------|
| `NEXT_PUBLIC_FIREBASE_*` | ✅ Yes | Client-side React | Public Firebase config |
| `NEXT_PUBLIC_SUPER_ADMIN_EMAIL` | ✅ Yes | firebase-config.js | Super admin seed email |
| `NEXT_PUBLIC_DEMO_ADMIN_*` | ❌ Optional | login page | Fallback if Auth disabled |
| `NEXT_PUBLIC_BASE_URL` | ✅ Yes | OAuth redirects | Must match Firebase authorized domain |
| `NODE_ENV` | ✅ Yes | Next.js build | Auto: dev=development, prod=production |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | ❌ Optional | OAuth page | If using explicit client ID |
| `NEXT_PUBLIC_DEFAULT_RANGE_*` | ❌ Optional | Control page | Overridden by Firebase config |
| `NEXT_PUBLIC_GPS_*` | ❌ Optional | Role pages | Geolocation settings |

## Firebase Authorized Domains

Add your deployment URLs to Firebase Console → Authentication → Authorized domains:

- `localhost:3000` (development)
- `your-app.vercel.app` (Vercel production)
- `your-custom-domain.com` (if using custom domain)
- `v2v-v2i-6f64c.web.app` (Firebase Hosting, if used)

Without these, Google sign-in will fail on that domain.

## Security Notes

- ✅ **NEVER commit** `.env.local` (add to `.gitignore`)
- ✅ **DO commit** `.env.example` (shows template, no secrets)
- ✅ `NEXT_PUBLIC_*` variables are exposed to browser (Firebase keys are intentionally public)
- ✅ Vercel automatically loads `.env.local` from your Git repo or Environment tab

## Common Issues

**"Firebase initialization error"**
- Check all `NEXT_PUBLIC_FIREBASE_*` values match your project exactly

**"Google sign-in fails on production"**
- Add your production URL to Firebase authorized domains
- Verify `NEXT_PUBLIC_BASE_URL` matches your deployment URL

**"Demo admin fails"**
- Demo is only fallback if Firebase Auth not fully configured
- Use Google sign-in for production

## To Use Environment Variables in Code

The variables are automatically available in Next.js via `process.env`:

```javascript
// ✅ In client components (with NEXT_PUBLIC_ prefix):
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

// ✅ In server components (all variables):
const nodeEnv = process.env.NODE_ENV;
```
