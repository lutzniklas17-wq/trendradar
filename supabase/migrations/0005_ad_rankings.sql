-- TrendRadar Phase 4b: eigene Rangliste im Ad Spy aus den gesammelten Daten (ad_sightings).
-- Die Meta-API liefert keine globale Rangliste. „Jetzt aktiv“ heisst hier: in den letzten p_days Tagen
-- (Zürcher Kalendertage) bei einer Sammel-Abfrage oder Suche als aktiv gesehen.
-- security invoker: Row Level Security der Tabellen gilt weiterhin.

create function ad_rank_advertisers(
  p_days integer default 2,
  p_country text default null,
  p_platform text default null,
  p_term_id uuid default null,
  p_sort text default 'active',
  p_limit integer default 50
)
returns table (
  advertiser_id uuid,
  page_id text,
  name text,
  active_ads bigint,
  new_ads bigint,
  longest_days integer,
  newest_start timestamptz,
  countries text[],
  platforms text[],
  tracked_shop_id uuid
)
language sql stable security invoker set search_path = public
as $fn$
  with seen as (
    select s.ad_id, array_agg(distinct s.country) as countries
    from ad_sightings s
    where s.day >= (now() at time zone 'Europe/Zurich')::date - (greatest(p_days, 1) - 1)
      and (p_country is null or s.country = p_country)
    group by s.ad_id
  ),
  a as (
    select ads.*, seen.countries as seen_countries
    from ads join seen on seen.ad_id = ads.id
    where ads.advertiser_id is not null
      and (p_platform is null or p_platform = any (ads.publisher_platforms))
      and (p_term_id is null or exists (select 1 from ad_term_hits h where h.ad_id = ads.id and h.term_id = p_term_id))
  ),
  g as (
    select a.advertiser_id,
           count(*) as active_ads,
           count(*) filter (where a.started_at >= now() - interval '7 days') as new_ads,
           max(extract(day from now() - a.started_at))::integer as longest_days,
           max(a.started_at) as newest_start,
           (select array_agg(distinct c) from a a2, unnest(a2.seen_countries) c where a2.advertiser_id = a.advertiser_id) as countries,
           (select array_agg(distinct p) from a a3, unnest(a3.publisher_platforms) p where a3.advertiser_id = a.advertiser_id) as platforms
    from a
    group by a.advertiser_id
  )
  select g.advertiser_id, adv.external_id, adv.name, g.active_ads, g.new_ads, g.longest_days, g.newest_start,
         g.countries, g.platforms, ts.id
  from g
  join advertisers adv on adv.id = g.advertiser_id
  left join tracked_shops ts on ts.platform = adv.platform and ts.page_id = adv.external_id
  order by
    case when p_sort = 'longest' then g.longest_days end desc nulls last,
    case when p_sort = 'newest' then extract(epoch from g.newest_start) end desc nulls last,
    case when p_sort = 'new' then g.new_ads end desc,
    g.active_ads desc, g.longest_days desc nulls last
  limit least(greatest(p_limit, 1), 200)
$fn$;

create function ad_rank_ads(
  p_days integer default 2,
  p_country text default null,
  p_platform text default null,
  p_term_id uuid default null,
  p_advertiser_id uuid default null,
  p_sort text default 'longest',
  p_limit integer default 50
)
returns table (
  id uuid,
  external_id text,
  advertiser_id uuid,
  advertiser_name text,
  page_id text,
  body text,
  title text,
  snapshot_url text,
  publisher_platforms text[],
  started_at timestamptz,
  eu_reach bigint,
  running_days integer,
  countries text[],
  last_seen date
)
language sql stable security invoker set search_path = public
as $fn$
  with seen as (
    select s.ad_id, array_agg(distinct s.country) as countries, max(s.day) as last_seen
    from ad_sightings s
    where s.day >= (now() at time zone 'Europe/Zurich')::date - (greatest(p_days, 1) - 1)
      and (p_country is null or s.country = p_country)
    group by s.ad_id
  )
  select ads.id, ads.external_id, ads.advertiser_id, adv.name, adv.external_id, ads.body, ads.title, ads.snapshot_url,
         ads.publisher_platforms, ads.started_at, ads.eu_reach,
         extract(day from now() - ads.started_at)::integer, seen.countries, seen.last_seen
  from ads
  join seen on seen.ad_id = ads.id
  left join advertisers adv on adv.id = ads.advertiser_id
  where (p_platform is null or p_platform = any (ads.publisher_platforms))
    and (p_term_id is null or exists (select 1 from ad_term_hits h where h.ad_id = ads.id and h.term_id = p_term_id))
    and (p_advertiser_id is null or ads.advertiser_id = p_advertiser_id)
  order by
    case when p_sort = 'longest' then ads.started_at end asc nulls last,
    case when p_sort = 'newest' then ads.started_at end desc nulls last,
    case when p_sort = 'reach' then ads.eu_reach end desc nulls last,
    ads.started_at asc nulls last
  limit least(greatest(p_limit, 1), 200)
$fn$;
