-- TrendRadar Phase 6a: Produkt-Bibliothek (Lieferanten-Produkte), Top-Hits, Vorbereitung KI-Bewertung
-- Läuft nach 0001–0007. Kann gefahrlos mehrmals ausgeführt werden.

-- Produkte bei Lieferanten (zuerst CJdropshipping über die offizielle API).
create table if not exists supplier_products (
  id uuid primary key default gen_random_uuid(),
  platform text not null,                     -- 'cj' (später z. B. 'aliexpress' nach API-Freigabe)
  external_id text not null,                  -- Produkt-ID beim Lieferanten
  sku text,
  title text not null,
  image_url text,
  price numeric,                              -- Verkaufspreis des Lieferanten an dich (Einkauf)
  currency text not null default 'USD',
  category text,                              -- unterste Kategorie
  category_path text,                         -- z. B. „Home & Garden / Kitchen / Gadgets“
  listed_count integer,                       -- CJ „listedNum“: so oft von Shops in ihren Shop übernommen
  inventory integer,
  free_shipping boolean,
  has_video boolean,
  supplier_name text,
  product_url text,
  listed_at timestamptz,                      -- seit wann beim Lieferanten (CJ „createAt“)
  search_terms text[] not null default '{}',  -- über welche Suchbegriffe gefunden
  relevance text not null default 'relevant' check (relevance in ('relevant', 'unclear', 'irrelevant')),
  relevance_reason text,
  hidden boolean not null default false,      -- von dir ausgeblendet
  item_id uuid references items(id) on delete set null, -- als Produkt übernommen
  -- KI-Bewertung (Einschätzung, nur wenn ANTHROPIC_API_KEY gesetzt ist)
  ai_relevant boolean,
  ai_score smallint check (ai_score between 1 and 5),
  ai_reason text,
  ai_model text,
  ai_reviewed_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (platform, external_id)
);
create index if not exists supplier_products_seen_idx on supplier_products (last_seen_at desc);
create index if not exists supplier_products_listed_idx on supplier_products (listed_count desc nulls last);
create index if not exists supplier_products_title_trgm_idx on supplier_products using gin (lower(title) gin_trgm_ops);

-- Ein Messpunkt pro Produkt und Zürcher Tag: daraus entsteht das Wachstum („+40 Shops in 7 Tagen“).
create table if not exists supplier_product_snapshots (
  product_id uuid not null references supplier_products(id) on delete cascade,
  day date not null,
  listed_count integer,
  price numeric,
  inventory integer,
  primary key (product_id, day)
);

-- Suchbegriffe, die jeden Tag automatisch in der Bibliothek gesucht werden.
create table if not exists library_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  active boolean not null default true,
  last_run_at timestamptz,
  last_count integer,
  last_error text,
  created_at timestamptz not null default now()
);

-- Verbrauch pro Anbieter und Tag (Abfragelimits und KI-Kosten).
create table if not exists api_usage (
  provider text not null,                     -- 'cj', 'anthropic'
  day date not null,
  calls integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cost_usd numeric not null default 0,
  primary key (provider, day)
);

-- Zwischengespeicherte Zugangstoken (CJ-Token gilt 180 Tage). Nur für den Besitzer lesbar.
create table if not exists provider_tokens (
  provider text primary key,
  access_token text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['supplier_products','supplier_product_snapshots','library_terms','api_usage','provider_tokens'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_owner', t);
    execute format('create policy %I on %I for all to authenticated using (is_owner()) with check (is_owner())', t || '_owner', t);
  end loop;
end $$;

-- Verbrauch atomar hochzählen und den neuen Tagesstand zurückgeben.
-- security invoker: es gelten die Rechte des Aufrufers (Besitzer oder täglicher Lauf).
create or replace function bump_api_usage(
  p_provider text, p_day date, p_calls int default 1,
  p_input bigint default 0, p_output bigint default 0, p_cost numeric default 0
) returns api_usage
language sql volatile security invoker set search_path = public
as $fn$
  insert into api_usage as u (provider, day, calls, input_tokens, output_tokens, cost_usd)
  values (p_provider, p_day, p_calls, p_input, p_output, p_cost)
  on conflict (provider, day) do update set
    calls = u.calls + excluded.calls,
    input_tokens = u.input_tokens + excluded.input_tokens,
    output_tokens = u.output_tokens + excluded.output_tokens,
    cost_usd = u.cost_usd + excluded.cost_usd
  returning u.*
$fn$;

-- Zahl der bekannten Meta-Anzeigen pro Anzeigen-Stichwort (für die Top-Hits).
create or replace function ad_counts_by_term()
returns table (term text, ads bigint)
language sql stable security invoker set search_path = public
as $fn$
  select lower(t.term), count(h.ad_id)
  from ad_watch_terms t join ad_term_hits h on h.term_id = t.id
  group by lower(t.term)
$fn$;

insert into sources (id, name, kind, homepage_url) values
  ('cj_dropshipping', 'CJdropshipping', 'api', 'https://cjdropshipping.com'),
  ('anthropic', 'KI-Bewertung (Claude)', 'api', 'https://www.anthropic.com')
on conflict (id) do nothing;
