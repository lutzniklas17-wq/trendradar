-- TrendRadar Phase 4a: tägliche Datensammler (Anzeigen-Stichwörter, Product Hunt, RSS-Feeds)

-- Stichwörter, nach denen der tägliche Lauf aktive Meta-Anzeigen sammelt. Daraus entsteht die
-- eigene Rangliste („meiste aktive Anzeigen“), denn die Meta-API liefert keine globale Rangliste.
create table ad_watch_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null check (char_length(term) between 1 and 100),
  country text not null default 'DE' check (country ~ '^[A-Z]{2}$'),
  active boolean not null default true,
  item_id uuid references items(id) on delete set null,   -- optional: Stichwort gehört zu einem Produkt
  created_at timestamptz not null default now(),
  last_run_at timestamptz,
  last_count integer,
  last_error text,
  unique (term, country)
);

-- An welchem Tag eine Anzeige in welchem Land als aktiv gesehen wurde (Grundlage für „jetzt aktiv“).
create table ad_sightings (
  ad_id uuid not null references ads(id) on delete cascade,
  day date not null,
  country text not null check (country ~ '^[A-Z]{2}$'),
  primary key (ad_id, day, country)
);
create index ad_sightings_day_idx on ad_sightings (day desc, country);

-- Welches Stichwort eine Anzeige gefunden hat (Verknüpfung Produkt ↔ Anzeigen).
create table ad_term_hits (
  ad_id uuid not null references ads(id) on delete cascade,
  term_id uuid not null references ad_watch_terms(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  primary key (ad_id, term_id)
);
create index ad_term_hits_term_idx on ad_term_hits (term_id);

alter table ads add column first_seen_at timestamptz not null default now();
create index ads_advertiser_idx on ads (advertiser_id);

-- RSS- oder Atom-Feeds, die täglich gelesen werden. Nur Feeds, deren Anbieter das Abonnieren vorsehen.
create table feeds (
  id uuid primary key default gen_random_uuid(),
  url text not null unique check (url ~ '^https://'),
  name text not null,
  area item_area not null default 'future_radar',
  keywords text[] not null default '{}',   -- leer = alle Einträge; sonst nur Einträge mit einem dieser Wörter
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_run_at timestamptz,
  last_count integer,
  last_error text
);

-- Jeder Lauf hat einen Typ (ads, producthunt, rss, shops) für das Protokoll.
alter table research_runs add column job text;
create index research_runs_job_idx on research_runs (job, started_at desc);

-- Schnelle Duplikatprüfung über die Originalquelle.
create index items_source_url_idx on items (source_url) where source_url is not null;

insert into sources (id, name, kind, homepage_url) values
  ('rss', 'RSS-Feeds', 'rss', null)
on conflict (id) do nothing;

do $$
declare t text;
begin
  foreach t in array array['ad_watch_terms', 'ad_sightings', 'ad_term_hits', 'feeds'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all to authenticated using (is_owner()) with check (is_owner())', t || '_owner', t);
  end loop;
end $$;
