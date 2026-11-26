-- TrendRadar Phase 3d: Shop Spy (aktive Anzeigen pro Shop über Zeit)

-- Verfolgte Werbetreibende (Facebook-Seiten). Ein Shop = eine Seite in der Meta Ad Library.
create table tracked_shops (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'meta' check (platform in ('meta')),
  page_id text not null check (page_id ~ '^[0-9]{5,25}$'),
  name text not null,
  note text,
  created_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_error text,
  unique (platform, page_id)
);

-- Ein Snapshot pro Shop und Kalendertag (Zürcher Zeit). Nur Anzeigen, die in der EU ausgespielt werden.
create table shop_snapshots (
  shop_id uuid not null references tracked_shops(id) on delete cascade,
  day date not null,
  active_ads integer not null check (active_ads >= 0),
  capped boolean not null default false,        -- Zähllimit erreicht: Zahl ist ein Mindestwert
  domains jsonb not null default '{}'::jsonb,   -- aktive Anzeigen je Domain aus der Link-Beschriftung; "" = ohne Domain
  new_ads integer,                              -- aktive Anzeigen, die in den letzten 7 Tagen gestartet sind
  longest_days integer,                         -- längste Laufzeit einer aktiven Anzeige
  checked_at timestamptz not null default now(),
  primary key (shop_id, day)
);

alter table tracked_shops enable row level security;
alter table shop_snapshots enable row level security;
create policy tracked_shops_owner on tracked_shops for all to authenticated using (is_owner()) with check (is_owner());
create policy shop_snapshots_owner on shop_snapshots for all to authenticated using (is_owner()) with check (is_owner());
