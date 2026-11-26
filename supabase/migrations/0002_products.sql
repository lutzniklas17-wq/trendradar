-- TrendRadar Phase 3: Produktseite, Duplikaterkennung und Suche

-- Ähnliche Einträge finden (Duplikaterkennung und globale Suche).
-- security invoker: Row Level Security der Tabelle items gilt weiterhin.
create function find_similar_items(q text, max_results integer default 20, min_score real default 0.3)
returns table (id uuid, name text, type item_type, area item_area, category text, similarity real, word_score real)
language sql stable security invoker set search_path = public
as $fn$
  with query as (select lower(regexp_replace(q, '[^[:alnum:] ]', '', 'g')) as nq)
  select i.id, i.name, i.type, i.area, i.category,
         similarity(i.normalized_name, query.nq) as similarity,      -- ganzer Name ähnlich: Duplikat-Kandidat
         word_similarity(query.nq, i.normalized_name) as word_score  -- Begriff kommt im Namen vor: Suchtreffer
  from items i, query
  where greatest(similarity(i.normalized_name, query.nq), word_similarity(query.nq, i.normalized_name)) >= min_score
  order by greatest(similarity(i.normalized_name, query.nq), word_similarity(query.nq, i.normalized_name)) desc,
           i.last_seen_at desc
  limit least(greatest(max_results, 1), 100)
$fn$;

-- Angebote: Titel beim Lieferanten, eigene Notiz und Zeitpunkt der letzten Änderung.
alter table product_offers
  add column title text,
  add column note text,
  add column updated_at timestamptz not null default now();
create index product_offers_item_idx on product_offers (item_id, role);

-- Profit-Rechner: gespeicherte Währung.
alter table profit_scenarios add column currency text not null default 'CHF';
