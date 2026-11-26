-- TrendRadar Phase 4d: Daily News, Favoriten für Shops und Inbox (Änderungsprotokoll pro Lauf)

-- Feeds sind entweder Entdeckungs-Feeds (landen als Einträge in einem Bereich) oder News-Feeds (Daily News).
alter table feeds add column kind text not null default 'discoveries' check (kind in ('discoveries', 'news'));

-- News: nur Titel, Bild und Anrisstext aus dem offiziellen Feed plus Link zum Originalartikel (keine kopierten Volltexte).
create table news_articles (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid references feeds(id) on delete set null,
  source_name text not null,
  title text not null,
  url text not null unique check (url ~ '^https?://'),
  image_url text check (image_url is null or image_url ~ '^https://'),
  excerpt text,
  published_at timestamptz,
  fetched_at timestamptz not null default now()
);
create index news_articles_fetched_idx on news_articles (fetched_at desc);

-- Favoriten: Shops markieren (Produkte und andere Einträge nutzen die bestehende Tabelle watchlist).
alter table tracked_shops add column favorite boolean not null default false;

-- Inbox: ein Eintrag pro Lauf, aber nur wenn sich wirklich etwas geändert hat.
-- changes: [{ "kind": "added" | "changed" | "removed", "label": text, "detail": text?, "href": text?, "favorite": bool? }]
create table inbox_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job text not null,
  title text not null,
  changes jsonb not null default '[]'::jsonb,
  read_at timestamptz
);
create index inbox_entries_created_idx on inbox_entries (created_at desc);

do $$
declare t text;
begin
  foreach t in array array['news_articles', 'inbox_entries'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all to authenticated using (is_owner()) with check (is_owner())', t || '_owner', t);
  end loop;
end $$;
