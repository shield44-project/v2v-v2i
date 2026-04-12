# V2X Connect — Vercel Admin Management Guide (No Firebase)
**Version 1.0 | Next.js + Auth.js + Vercel**

This is the Vercel-first replacement for the old Firebase-style admin workflow.
It explains exactly what to do from your end to implement and operate admin management.

---

## 1) Target stack (what this guide uses)

- **Hosting/Runtime:** Vercel
- **Auth:** Auth.js (`next-auth`) with Google OAuth (already present in this repo)
- **Database:** Vercel Postgres (for users/admins/invites/bans/events/config)
- **Session strategy:** JWT (already configured in `web/auth.ts`)

---

## 2) What you already have in this repo

- Google sign-in route at: `web/app/api/auth/[...nextauth]/route.ts`
- Auth config in: `web/auth.ts`
- Protected dashboard route in: `web/app/dashboard/page.tsx`
- Admin and admin-preview routes in:
  - `web/app/admin/page.tsx`
  - `web/app/admin-preview/page.tsx`

---

## 3) What you must do on your end (required)

## Step A — Create Vercel project
1. Push this repository to GitHub.
2. In Vercel, click **Add New → Project**.
3. Import this repo.
4. Set Root Directory to `web`.
5. Deploy once.

## Step B — Configure Google OAuth
1. Open Google Cloud Console → APIs & Services → Credentials.
2. Create OAuth Client ID (Web app).
3. Add redirect URLs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-vercel-domain>/api/auth/callback/google`
4. Copy client ID and secret.

## Step C — Add Vercel env vars
In Vercel Project → Settings → Environment Variables, add:

- `AUTH_SECRET` (generate strong random 32+ byte secret)
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_URL=https://<your-vercel-domain>` (preferred for Auth.js v5)
- `NEXTAUTH_URL=https://<your-vercel-domain>` (legacy compatibility)
- `SUPER_ADMIN_EMAIL=kstejas2718@gmail.com`
- `NEXT_PUBLIC_SUPPORT_EMAIL=kstejas2718@gmail.com`

For local `.env.local` in `web/` add same keys with localhost URL.

## Step D — Provision Vercel Postgres
1. Vercel Dashboard → Storage → **Create Database** → Postgres.
2. Connect it to this project.
3. Vercel will inject connection env vars automatically.

---

## 4) Database schema (Vercel Postgres)

Run this SQL in the Vercel Postgres SQL console:

```sql
create table if not exists users (
  id text primary key,
  email text unique not null,
  name text,
  image text,
  role text not null default 'user',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  last_seen timestamptz
);

create table if not exists admins (
  user_id text primary key references users(id) on delete cascade,
  email text not null,
  is_super_admin boolean not null default false,
  added_by text,
  added_at timestamptz not null default now()
);

create table if not exists pending_admins (
  id bigserial primary key,
  email text unique not null,
  added_by text,
  added_at timestamptz not null default now()
);

create table if not exists banned_users (
  user_id text primary key references users(id) on delete cascade,
  email text not null,
  reason text,
  banned_by text,
  banned_at timestamptz not null default now()
);

create table if not exists events (
  id bigserial primary key,
  type text not null,
  message text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_role on users(role);
create index if not exists idx_users_status on users(status);
```

---

## 5) Role model and behavior

- **super_admin:** full control, cannot be removed/banned from UI
- **admin:** can manage users/admins/bans
- **user:** normal authenticated user
- **banned:** blocked access

Recommended super admin configuration:
- Set `SUPER_ADMIN_EMAIL=kstejas2718@gmail.com` in Vercel env vars (and local `.env.local`)
- Read this value server-side; do not hardcode privileged emails in source files

---

## 6) Required server actions / API behavior

Implement these server-side operations in Next.js route handlers or server actions:

1. **On successful sign-in**
   - Upsert `users` record.
   - If email matches super admin email, upsert into `admins` with `is_super_admin=true`.
   - If user email exists in `pending_admins`, promote to `admins` and delete pending row.

2. **Admin guard checks**
   - Verify session user exists.
   - Verify user exists in `admins` and not in `banned_users`.

3. **Add admin invite**
   - Insert into `pending_admins(email, added_by)` if not already admin.

4. **Remove admin**
   - Delete from `admins` for non-super-admin target.

5. **Ban / unban**
   - Ban: insert into `banned_users`, set `users.status='banned'`.
   - Unban: delete from `banned_users`, set `users.status='active'`.

6. **Admin preview**
   - Return read-only counts and health metrics only (no mutating actions).

---

## 7) Auth.js callback expectations

In your Auth.js callbacks:

- `signIn`: deny login if user is in `banned_users`.
- `jwt`: include role/admin flags in token.
- `session`: expose role/admin flags for UI guards.

This keeps `/admin` secure and `/admin-preview` read-only.

---

## 8) Real-time strategy on Vercel (instead of Firebase listeners)

Choose one of these:

1. **Polling (simple):** refresh admin tables every 2–5s on admin page.
2. **SSE (recommended):** stream updates from a route handler.
3. **Pusher/Ably:** managed realtime channel for events.

For minimal change, start with polling and move to SSE later.

---

## 9) Performance checklist (Vercel)

- Keep admin reads paginated (limit/offset or cursor).
- Use DB indexes (included above).
- Batch writes in transactions for promote/ban flows.
- Cache read-only admin-preview responses for short TTL.
- Avoid client-side heavy loops; keep update interval >= 1s unless needed.

---

## 10) Security checklist

- All admin mutations must be server-side only.
- Never trust role from client payload; always verify from DB.
- Protect against CSRF for form mutations (Auth.js + same-site cookies).
- Validate/sanitize email inputs for invite flow.
- Log all admin actions into `events`.

---

## 11) Support issue email intake

- The app includes a global **Report Issue** button.
- It opens a prefilled email to `NEXT_PUBLIC_SUPPORT_EMAIL`.
- The email body includes path, UTC time, and browser details to help triage breakages quickly.

---

## 12) Deployment checklist

- [ ] Vercel project created with root directory = `web`
- [ ] Google OAuth redirect URL added for production domain
- [ ] All auth env vars configured in Vercel
- [ ] Vercel Postgres created and connected
- [ ] SQL schema executed
- [ ] Super admin seeded on first login
- [ ] Admin invite flow tested
- [ ] Ban/unban tested
- [ ] `/admin` protected and `/admin-preview` read-only
- [ ] `npm run lint` and `npm run build` pass locally

---

## 13) Troubleshooting

### `Missing auth secret`
- Set `AUTH_SECRET` in Vercel and local `.env.local`.

### Google callback errors
- Check redirect URL matches exactly:
  `https://<domain>/api/auth/callback/google`

### User not promoted from invite
- Confirm email is identical in Google account and `pending_admins`.

### Admin route accessible to non-admin
- Re-check server-side guard against `admins` and `banned_users`.

### Slow admin page
- Add pagination and verify indexes exist.

---

## 14) Recommended next implementation files

Create these in `web/`:

- `app/api/admin/users/route.ts`
- `app/api/admin/invites/route.ts`
- `app/api/admin/roles/route.ts`
- `app/api/admin/ban/route.ts`
- `lib/db.ts` (Vercel Postgres client)
- `lib/admin-guard.ts` (reusable permission checks)

---

## 15) Summary

You can fully replace Firebase admin management with Vercel by:
1) keeping Auth.js for sign-in,
2) storing users/admin roles in Vercel Postgres,
3) enforcing server-side role checks on all admin actions,
4) adding polling/SSE for near real-time admin updates.

This keeps your existing Next.js routes and Vercel deployment flow intact.
