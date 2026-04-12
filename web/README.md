# Web App (Next.js + Auth.js)

This directory contains the active V2X web application built with Next.js and TypeScript.

- Google sign-in is implemented with Auth.js (`next-auth`)
- Authentication route handlers are already wired at `app/api/auth/[...nextauth]/route.ts`
- App modules are fully implemented as Next.js routes: `/control`, `/emergency`, `/signal`, `/vehicle1`, `/vehicle2`, `/admin`, `/admin-preview`, `/user-portal`
- See the repository root `README.md` for full setup and Vercel deployment steps
