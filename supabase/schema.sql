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
