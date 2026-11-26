-- Phase 5a: Startup Spy mit echten Daten.
-- Neue Felder für Einträge (Art, Start-Datum laut Quelle, E-Commerce-Relevanz nach Regeln),
-- Shop-Domain pro Anzeige und eine Abfrage „Werbetreibende, die erst seit kurzem werben“.

-- Art des Eintrags: Startup (Produktlaunch) oder Small Business (neuer Shop / neue Firma).
alter table items add column if not exists stage text check (stage in ('startup', 'small_business'));
-- Start laut Quelle: Launch-Datum (Product Hunt) oder Start der ältesten bekannten Anzeige (Meta).
alter table items add column if not exists launched_at timestamptz;
-- E-Commerce-Relevanz nach festen Regeln (Einschätzung, keine Tatsache) und die Begründung dazu.
alter table items add column if not exists relevance text not null default 'unclear' check (relevance in ('ecommerce', 'unclear', 'excluded'));
alter table items add column if not exists relevance_reason text;
create index if not exists items_area_launched_idx on items (area, launched_at desc);

-- Domain aus dem Link-Text der Anzeige (ad_creative_link_captions), z. B. „meinshop.ch“.
alter table ads add column if not exists domain text;

insert into sources (id, name, kind, homepage_url) values
  ('meta_new_advertisers', 'Neue Werbetreibende (Meta Ad Library)', 'api', 'https://www.facebook.com/ads/library/')
on conflict (id) do nothing;

-- Werbetreibende, deren älteste bekannte Anzeige höchstens p_days Tage alt ist und die wenige Anzeigen haben.
-- „Bekannt“ heisst: in den eigenen, gesammelten Daten. Ältere Anzeigen, die nie gesammelt wurden, fehlen.
-- security invoker: Row Level Security der Tabellen gilt weiterhin.
create or replace function new_advertisers(p_days int default 60, p_max_ads int default 15, p_limit int default 200)
returns table (
  advertiser_id uuid,
  page_id text,
  name text,
  first_start timestamptz,
  known_ads bigint,
  domain text,
  sample_text text
)
language sql stable security invoker set search_path = public
as $$
  select adv.id,
         adv.external_id,
         adv.name,
         min(a.started_at) as first_start,
         count(*) as known_ads,
         mode() within group (order by a.domain) filter (where a.domain is not null) as domain,
         left(string_agg(distinct nullif(concat_ws(' ', a.title, a.body), ''), ' | '), 1500) as sample_text
  from advertisers adv
  join ads a on a.advertiser_id = adv.id
  where adv.platform = 'meta' and a.started_at is not null
  group by adv.id, adv.external_id, adv.name
  having min(a.started_at) >= now() - make_interval(days => greatest(p_days, 1))
     and count(*) <= greatest(p_max_ads, 1)
  order by min(a.started_at) desc
  limit least(greatest(p_limit, 1), 500);
$$;

-- ---------- Future Radar: Themen beobachten ----------
-- Eigene Themen (z. B. „Pilzkaffee“). Zahlen kommen aus den eigenen, gesammelten Daten (News, Anzeigen, Einträge).
create table if not exists radar_topics (
  id uuid primary key default gen_random_uuid(),
  term text not null unique check (char_length(term) between 2 and 60),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);
alter table radar_topics enable row level security;
drop policy if exists radar_topics_owner on radar_topics;
create policy radar_topics_owner on radar_topics for all to authenticated using (is_owner()) with check (is_owner());

-- Fakten pro Thema: Treffer in News (7 Tage / Vorwoche), neue Anzeigen der passenden Anzeigen-Stichwörter
-- (Start in 7 Tagen / Vorwoche), gerade aktive Anzeigen, neue Einträge (30 Tage). Ausgeschlossene Branchen zählen nicht.
create or replace function radar_topic_stats()
returns table (
  topic_id uuid,
  term text,
  note text,
  created_at timestamptz,
  news_7d bigint,
  news_prev_7d bigint,
  items_30d bigint,
  ads_active bigint,
  ads_new_7d bigint,
  ads_new_prev_7d bigint,
  has_ad_term boolean,
  news_since timestamptz
)
language sql stable security invoker set search_path = public
as $$
  with t as (
    select r.*, '%' || replace(replace(replace(r.term, '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
    from radar_topics r
  ),
  hits as (
    select t.id as topic_id, h.ad_id
    from t
    join ad_watch_terms w on lower(w.term) = lower(t.term)
    join ad_term_hits h on h.term_id = w.id
    group by t.id, h.ad_id
  )
  select t.id, t.term, t.note, t.created_at,
    (select count(*) from news_articles n
      where coalesce(n.published_at, n.fetched_at) >= now() - interval '7 days'
        and (n.title || ' ' || coalesce(n.excerpt, '')) ilike t.pat),
    (select count(*) from news_articles n
      where coalesce(n.published_at, n.fetched_at) >= now() - interval '14 days'
        and coalesce(n.published_at, n.fetched_at) < now() - interval '7 days'
        and (n.title || ' ' || coalesce(n.excerpt, '')) ilike t.pat),
    (select count(*) from items i
      where i.first_discovered_at >= now() - interval '30 days' and i.relevance <> 'excluded'
        and (i.name || ' ' || coalesce(i.description, '')) ilike t.pat),
    (select count(distinct s.ad_id) from hits h join ad_sightings s on s.ad_id = h.ad_id
      where h.topic_id = t.id and s.day >= current_date - 1),
    (select count(*) from hits h join ads a on a.id = h.ad_id
      where h.topic_id = t.id and a.started_at >= now() - interval '7 days'),
    (select count(*) from hits h join ads a on a.id = h.ad_id
      where h.topic_id = t.id and a.started_at >= now() - interval '14 days' and a.started_at < now() - interval '7 days'),
    exists (select 1 from ad_watch_terms w where lower(w.term) = lower(t.term)),
    (select min(coalesce(n.published_at, n.fetched_at)) from news_articles n)
  from t
  order by t.term;
$$;
