# QuickQR

QuickQR lets users:
- Paste any link
- Generate a QR code instantly
- Download as PNG or SVG
- Store anonymous analytics events in Supabase

## Stack
- Next.js (App Router)
- Vercel (hosting)
- Supabase Postgres (analytics DB)

## Local Setup
1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and set values:

```bash
cp .env.example .env.local
```

3. Run dev server:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Supabase Table
Run this SQL in Supabase SQL Editor:

```sql
create extension if not exists pgcrypto;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null check (event_type in ('page_visit', 'qr_generated', 'qr_downloaded')),
  session_id text not null,
  payload jsonb not null default '{}'::jsonb,
  ip_hash text not null,
  user_agent text,
  referrer text
);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

create index if not exists analytics_events_event_type_idx
  on public.analytics_events (event_type);
```

## Environment Variables
`NEXT_PUBLIC_SUPABASE_URL`:
- Supabase project URL

`SUPABASE_SERVICE_ROLE_KEY`:
- Service role key (server-side only)
- Do not expose this key to client code

`ADMIN_DASHBOARD_KEY` (optional):
- If set, `/admin` requires `?key=YOUR_VALUE`

If these variables are missing, the app still works but analytics inserts are skipped.

## Admin Dashboard
- Route: `/admin`
- Shows event totals, 14-day trend, top domains, and recent events
- For production, set `ADMIN_DASHBOARD_KEY` and open `/admin?key=...`

## Deploy (Free)
1. Push this repo to GitHub.
2. Import into Vercel.
3. Add the two environment variables in Vercel Project Settings.
4. Deploy.
