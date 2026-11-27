-- TrendRadar Phase 7a: automatische Recherche.
-- Gemeinsame Themen-Basis (topics) mit täglichen Messpunkten, automatisch erzeugte Anzeigen-Stichwörter
-- und automatisch entdeckte Shops. Läuft nach 0001–0008 und kann gefahrlos mehrmals ausgeführt werden.

-- ---------- Themen: gemeinsame Basis für Trend Spy, Future Radar, Shop Spy und Startup Spy ----------
-- Ein Thema ist ein Produkt („neck fan“) oder eine Nische (Kategorie „Pet Supplies“).
-- origin = 'auto': vom täglichen Lauf aus echten Daten abgeleitet; 'manual': selbst eingetragen.
create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  normalized text not null unique,               -- klein geschrieben, Einzahl, ohne Sonderzeichen (Duplikatprüfung)
  kind text not null default 'product' check (kind in ('product', 'niche')),
  origin text not null default 'auto' check (origin in ('auto', 'manual')),
  status text not null default 'active' check (status in ('active', 'paused')),
  category text,
  image_url text,
  reason text,                                   -- Fakt: warum der Lauf das Thema angelegt hat
  source_ids text[] not null default '{}',       -- welche Quellen Hinweise geliefert haben
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists topics_seen_idx on topics (status, last_seen_at desc);

-- Ein Messwert pro Thema, Tag und Kennzahl (z. B. cj_products, cj_listed, ads_active, ads_new_7d).
create table if not exists topic_metrics (
  topic_id uuid not null references topics(id) on delete cascade,
  day date not null,
  metric text not null check (char_length(metric) between 2 and 40),
  value numeric not null,
  source_id text references sources(id),
  primary key (topic_id, metric, day)
);
create index if not exists topic_metrics_day_idx on topic_metrics (day desc);

-- Anzeigen-Stichwörter gehören optional zu einem Thema; automatisch angelegte sind markiert.
alter table ad_watch_terms add column if not exists topic_id uuid references topics(id) on delete set null;
alter table ad_watch_terms add column if not exists origin text not null default 'manual' check (origin in ('manual', 'auto'));

-- ---------- Shop Spy: automatisch entdeckte Shops ----------
alter table tracked_shops add column if not exists origin text not null default 'manual' check (origin in ('manual', 'auto'));
alter table tracked_shops add column if not exists active boolean not null default true;  -- false = wird nicht mehr täglich gezählt
alter table tracked_shops add column if not exists discovered_reason text;
alter table tracked_shops add column if not exists domain text;

-- Werbetreibende, deren Anzeigen in den letzten p_days Tagen als aktiv gesehen wurden und die noch nicht verfolgt werden.
-- „Gesehen“ heisst: bei einem eigenen Sammellauf oder einer Suche. security invoker: RLS gilt weiterhin.
create or replace function shop_candidates(p_days int default 3, p_min_ads int default 5, p_limit int default 100)
returns table (
  advertiser_id uuid,
  page_id text,
  name text,
  active_ads bigint,
  first_start timestamptz,
  domain text,
  terms text[],
  sample_text text
)
language sql stable security invoker set search_path = public
as $$
  with seen as (
    select distinct s.ad_id
    from ad_sightings s
    where s.day >= (now() at time zone 'Europe/Zurich')::date - (greatest(p_days, 1) - 1)
  )
  select adv.id,
         adv.external_id,
         adv.name,
         count(distinct a.id) as active_ads,
         min(a.started_at) as first_start,
         mode() within group (order by a.domain) filter (where a.domain is not null) as domain,
         (select array_agg(distinct w.term) from ad_term_hits h join ad_watch_terms w on w.id = h.term_id
           where h.ad_id in (select a2.id from ads a2 where a2.advertiser_id = adv.id)) as terms,
         left(string_agg(distinct nullif(concat_ws(' ', a.title, a.body), ''), ' | '), 1000) as sample_text
  from advertisers adv
  join ads a on a.advertiser_id = adv.id
  join seen on seen.ad_id = a.id
  where adv.platform = 'meta'
    and not exists (select 1 from tracked_shops t where t.platform = 'meta' and t.page_id = adv.external_id)
  group by adv.id, adv.external_id, adv.name
  having count(distinct a.id) >= greatest(p_min_ads, 1)
  order by count(distinct a.id) desc
  limit least(greatest(p_limit, 1), 500);
$$;

-- Anzeigen-Kennzahlen pro Thema über die zugehörigen Stichwörter (für die täglichen Messpunkte).
create or replace function topic_ad_stats()
returns table (topic_id uuid, ads_active bigint, ads_new_7d bigint, advertisers bigint)
language sql stable security invoker set search_path = public
as $$
  with hits as (
    select w.topic_id, h.ad_id
    from ad_watch_terms w join ad_term_hits h on h.term_id = w.id
    where w.topic_id is not null
    group by w.topic_id, h.ad_id
  ),
  active as (
    select distinct s.ad_id from ad_sightings s
    where s.day >= (now() at time zone 'Europe/Zurich')::date - 1
  )
  select hits.topic_id,
         count(*) filter (where hits.ad_id in (select ad_id from active)),
         count(*) filter (where a.started_at >= now() - interval '7 days'),
         count(distinct a.advertiser_id) filter (where hits.ad_id in (select ad_id from active))
  from hits join ads a on a.id = hits.ad_id
  group by hits.topic_id;
$$;

insert into sources (id, name, kind, homepage_url) values
  ('auto_topics', 'Automatische Themen (aus CJ-Trends)', 'api', null),
  ('shop_discovery', 'Automatische Shop-Entdeckung (aus gesammelten Anzeigen)', 'api', null),
  ('aliexpress', 'AliExpress Affiliate API', 'api', 'https://portals.aliexpress.com')
on conflict (id) do nothing;

do $$
declare t text;
begin
  foreach t in array array['topics', 'topic_metrics'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_owner', t);
    execute format('create policy %I on %I for all to authenticated using (is_owner()) with check (is_owner())', t || '_owner', t);
  end loop;
end $$;
