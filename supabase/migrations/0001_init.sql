-- TrendRadar: Grundschema
-- Private Ein-Personen-Nutzung. Zugriff nur für angemeldete Nutzer (Registrierung in Supabase abschalten).

create extension if not exists pg_trgm;

-- Herkunft von Daten: jede Entdeckung und jedes Signal verweist auf eine Quelle.
create table sources (
  id text primary key,                 -- z. B. 'dataforseo_trends', 'meta_ad_library', 'cj_dropshipping'
  name text not null,
  kind text not null check (kind in ('api', 'rss', 'websearch', 'manual')),
  homepage_url text,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text
);

create type item_area as enum ('trend_spy', 'ad_spy', 'startup_spy', 'future_radar');
create type item_type as enum ('product', 'brand', 'startup', 'ad', 'topic');

-- Eine Entdeckung: Produkt, Marke, Start-up, Anzeige oder Thema.
create table items (
  id uuid primary key default gen_random_uuid(),
  type item_type not null,
  area item_area not null,
  name text not null,
  normalized_name text generated always as (lower(regexp_replace(name, '[^[:alnum:] ]', '', 'g'))) stored,
  category text,
  country text,                        -- ISO-3166-1 alpha-2, z. B. 'CH'
  description text,
  image_url text,
  website_url text,
  source_id text references sources(id),
  source_url text,                     -- Originalquelle der Entdeckung
  first_discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_new boolean not null default true,
  created_at timestamptz not null default now()
);
create index items_area_idx on items (area, first_discovered_at desc);
create index items_name_trgm_idx on items using gin (normalized_name gin_trgm_ops);
create index items_search_idx on items using gin (
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, ''))
);

-- Messwerte über Zeit (z. B. Suchinteresse, Anzahl aktiver Anzeigen, Product-Hunt-Stimmen).
create table signals (
  id bigint generated always as identity primary key,
  item_id uuid not null references items(id) on delete cascade,
  source_id text not null references sources(id),
  metric text not null,
  value numeric not null,
  unit text,
  observed_at timestamptz not null default now(),
  source_url text
);
create index signals_item_idx on signals (item_id, metric, observed_at desc);

create table keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null unique,
  category text,
  is_seed boolean not null default false   -- Startbegriffe je Kategorie für die tägliche Recherche
);

create table item_keywords (
  item_id uuid not null references items(id) on delete cascade,
  keyword_id uuid not null references keywords(id) on delete cascade,
  confirmed boolean not null default false,
  primary key (item_id, keyword_id)
);

-- Zwischengespeicherte Google-Trends-Antworten (relative Werte 0–100, keine absoluten Suchvolumen).
create table trend_series (
  id uuid primary key default gen_random_uuid(),
  keywords text[] not null,
  geo text not null default '',
  time_range text not null,
  source_id text not null references sources(id),
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
create index trend_series_lookup_idx on trend_series (keywords, geo, time_range, fetched_at desc);

create table advertisers (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('meta', 'tiktok')),
  external_id text not null,
  name text not null,
  unique (platform, external_id)
);

create table ads (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('meta', 'tiktok')),
  external_id text not null,
  advertiser_id uuid references advertisers(id),
  item_id uuid references items(id) on delete set null,
  body text,
  title text,
  landing_url text,
  snapshot_url text,                    -- Link zur Ad Library, keine kopierten Medien
  publisher_platforms text[],
  countries text[],
  started_at timestamptz,
  stopped_at timestamptz,
  eu_reach bigint,
  fetched_at timestamptz not null default now(),
  unique (platform, external_id)
);
create index ads_started_idx on ads (started_at);

-- Lieferanten- und Verkaufskanal-Angebote zu einem Produkt.
create table product_offers (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  platform text not null,               -- 'cj', 'aliexpress', 'alibaba', 'dhgate', 'temu'
  role text not null check (role in ('supplier', 'price_reference')),
  url text not null,
  is_search_link boolean not null default false,
  match_status text not null default 'candidate' check (match_status in ('candidate', 'confirmed', 'rejected')),
  price numeric,
  currency text,
  shipping_cost numeric,
  shipping_days text,
  destination_country text,
  moq integer,
  supplier_rating numeric,
  data_origin text not null check (data_origin in ('api', 'manual')),
  fetched_at timestamptz not null default now()
);

-- KI-Einschätzungen. Jede Aussage ist als Fakt, Signal oder Einschätzung markiert (siehe claims).
create table assessments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  model text not null,
  summary text,
  scores jsonb,                         -- { trend: {score: 1-5 | null, reason, basis}, ... }
  claims jsonb,                         -- [{ kind: 'fact'|'signal'|'assessment', text, source_url? }]
  verdict text,
  created_at timestamptz not null default now()
);

create table profit_scenarios (
  item_id uuid primary key references items(id) on delete cascade,
  inputs jsonb not null,
  scenarios jsonb not null,
  updated_at timestamptz not null default now()
);

create table watchlist (
  item_id uuid primary key references items(id) on delete cascade,
  note text,
  added_at timestamptz not null default now()
);

-- Protokoll jedes Recherchelaufs inkl. Kosten.
create table research_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  new_items integer not null default 0,
  web_searches integer not null default 0,
  estimated_cost_usd numeric not null default 0,
  log jsonb
);

-- Besitzer: nur dieses eine Konto darf Daten lesen und schreiben, auch falls die Registrierung
-- versehentlich offen ist. Nach dem ersten Login einmalig eintragen (siehe README).
create table app_owner (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table app_owner enable row level security;
create policy app_owner_self on app_owner for select to authenticated using (user_id = auth.uid());

create function is_owner() returns boolean
  language sql stable security definer set search_path = public
  as $fn$ select exists (select 1 from app_owner where user_id = auth.uid()) $fn$;

-- Row Level Security: nur der Besitzer. Der Recherchelauf nutzt den Service-Role-Key und umgeht RLS.
do $$
declare t text;
begin
  foreach t in array array[
    'sources','items','signals','keywords','item_keywords','trend_series','advertisers','ads',
    'product_offers','assessments','profit_scenarios','watchlist','research_runs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all to authenticated using (is_owner()) with check (is_owner())', t || '_owner', t);
  end loop;
end $$;

insert into sources (id, name, kind, homepage_url) values
  ('dataforseo_trends', 'Google Trends via DataForSEO', 'api', 'https://dataforseo.com'),
  ('meta_ad_library', 'Meta Ad Library', 'api', 'https://www.facebook.com/ads/library/'),
  ('product_hunt', 'Product Hunt', 'api', 'https://www.producthunt.com'),
  ('hacker_news', 'Hacker News', 'api', 'https://news.ycombinator.com'),
  ('claude_websearch', 'Claude Websuche', 'websearch', null),
  ('cj_dropshipping', 'CJdropshipping', 'api', 'https://cjdropshipping.com'),
  ('manual', 'Eigene Eingabe', 'manual', null);
