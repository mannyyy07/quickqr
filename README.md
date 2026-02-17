# QuickQR

QuickQR is a lightweight web app to generate QR codes from links, download them as PNG/SVG, and track anonymous usage analytics.

Live app:
- `https://quickqr-live.vercel.app`

## Features
- Generate QR code from any valid URL
- Download QR as `PNG` or `SVG`
- One-click `+ New` reset flow
- Dark/light mode
- Admin analytics dashboard at `/admin`

## Tech Stack
- `Next.js` (App Router, TypeScript)
- `Supabase` (Postgres analytics storage)
- `Vercel` (hosting + deployments)

## Local Development
1. Install dependencies:
```bash
npm install
```
2. Create env file:
```bash
cp .env.example .env.local
```
3. Fill required variables in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_DASHBOARD_KEY` (optional, recommended)
4. Start the app:
```bash
npm run dev
```

## Database Setup
Run the SQL in `supabase/schema.sql` inside Supabase SQL Editor.

## Admin Dashboard
- URL: `/admin`
- Protected URL (if key set): `/admin?key=YOUR_ADMIN_DASHBOARD_KEY`

## Deploy
1. Push to GitHub.
2. Connect the repo in Vercel.
3. Add the same environment variables in Vercel Project Settings.
4. Deploy.
