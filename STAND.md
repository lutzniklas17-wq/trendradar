# Stand TrendRadar

_Zuletzt aktualisiert: 26.11.2026 (Datensammler)_

## Ziel
Private Recherche-Website für E-Commerce: Trend Spy, Ad Spy, Google Trends, Startup Spy, Future Radar, globale Suche, Dashboard und Watchlist, mit automatischer täglicher Recherche. Nur echte, nachvollziehbare Daten.

## Stack
Next.js 16 (App Router, `src/proxy.ts`), React 19, Tailwind 4, Supabase (Auth + Postgres mit RLS nur für den Besitzer), Vitest. Deploy auf Vercel, tägliche Recherche später in GitHub Actions.

## Entscheidungen
- Login nur für eine E-Mail (`ALLOWED_EMAIL`) plus Tabelle `app_owner`; RLS über `is_owner()`.
- Datenquellen: DataForSEO für Google Trends, Meta Ad Library API, CJdropshipping API, Product Hunt, Hacker News, Claude-Websuche. Alibaba, DHgate, Temu: nur Suchlinks und manuelle Erfassung.
- Rechner: Verkaufspreis brutto, leere Felder = 0 und markiert; keine automatische Währungsumrechnung.
- Analyse: Fakt ohne Quelle wird zur Einschätzung herabgestuft; Kriterien ohne Daten bleiben unbewertet.
- Logos nur von Simple Icons (CC0), wo lesbar; sonst Kürzel.

## Erledigt
- Phase 2 (auf `main`): Grundgerüst, Login, Schema `0001_init.sql`, Profit-Rechner.
- Phase 3a (PR #1, gemergt): Produktseite mit Tabs, Lieferanten- und Verkaufskanäle, Angebote erfassen, Rechner speichern, Trend Spy mit Duplikatprüfung, Watchlist, Suche, Migration `0002_products.sql`.

- Phase 3b (PR #2, gemergt): Google Trends über DataForSEO Live, Zwischenspeicher 24 h in `trend_series`, Tageslimit `DATAFORSEO_DAILY_LIMIT` (Standard 30), Seite `/google-trends` mit Kurve, Link von der Produktseite. Ohne Key: ehrlicher Hinweis, keine Beispieldaten. Keine neue Migration.

- Phase 3c (PR #4, gemergt): Meta Ad Spy über Ad Library API (`ads_archive`, v26.0, Felder laut Doku). Suche nach Begriff, EU-Land, Status, Plattform; Paging per Cursor; Treffer in `advertisers`/`ads` gespeichert; Signale „lange Laufzeit“ (ab 30 Tagen) und „mehrere Anzeigen pro Seite“. Ohne Token: Hinweis plus Browser-Links zur Ad Library (auch Schweiz). `ad_snapshot_url` enthält das Token, deshalb nur öffentlicher Link `facebook.com/ads/library/?id=`. Link „Ad Spy“ auf der Produktseite. Keine neue Migration.

- Phase 3c ist PR #4, gemergt.
- Phase 3d (PR #5, gemergt): Shop Spy `/shop-spy` und `/shop-spy/[id]`. Shop = Facebook-Seite; zählt alle aktiven EU-Anzeigen per `search_page_ids` (alle 27 EU-Länder, 100 pro Seite, max. 10 Seiten → sonst „mind. 1000“), Domain aus `ad_creative_link_captions` (keine echte Landingpage-URL in der API), ein Snapshot pro Shop und Zürcher Tag. Signal „skaliert“ (verdoppelt und +5 ggü. ≥7 Tage) bzw. „stark rückläufig“. „Shop verfolgen“-Knopf im Ad Spy. Täglicher Lauf: Vercel Cron `vercel.json` → `/api/cron/shops` (braucht `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY`, Proxy lässt `/api/cron` ohne Login durch). Migration `0003_shops.sql`.

- Phase 4a (Branch `claude/project-thread-w60asi`, PR offen): Datensammler `/sammler`. Vercel Cron `/api/cron/collect?job=ads|producthunt|rss` (gemeinsame Prüfung in `src/lib/cron.ts`). Anzeigen-Stichwörter (`ad_watch_terms`, max. 3×100 aktive Anzeigen pro Stichwort/Land, Abbruch bei Limit/Token/240 s) → `ad_sightings` (Anzeige aktiv gesehen pro Tag/Land) und `ad_term_hits`; auch manuelle Ad-Spy-Suchen mit Status „Aktiv“ schreiben Sichtungen. Product Hunt v2 (`PRODUCTHUNT_TOKEN`, Konsum-Themen-Filter ohne KI) → Startup Spy. RSS/Atom-Feeds (`feeds`, Stichwortfilter). Duplikate: gleiche `source_url` oder `find_similar_items` ≥ 0.8 im selben Bereich. Protokoll in `research_runs.job`. Migration `0004_collectors.sql`.
- Phase 4b (gleicher Branch): Ad Spy Rangliste `/ad-spy/rangliste` über RPC `ad_rank_advertisers` und `ad_rank_ads` (Migration `0005_ad_rankings.sql`, mit lokalem Postgres 16 getestet). Sortierungen: aktiv jetzt, neu 7 Tage, längste Laufzeit, neueste; Filter Zeitraum (2/7/30 Tage), Land, Plattform, Stichwort; Drill-down pro Werbetreibendem; Links zu Shop Spy/„Shop verfolgen“ und Ad Library. Live-Suche hat „Täglich sammeln“. Umschalter `src/components/ads/ad-spy-nav.tsx`, Logik `src/lib/ads/rankings.ts`.
- Phase 4c (gleicher Branch): Verknüpfungen in `src/lib/links.ts`. Produktseite Tab „Anzeigen & Trends“ (`src/components/product/market-section.tsx`): Stichwörter des Produkts täglich sammeln (`ad_watch_terms.item_id`), Werbetreibende und längste Anzeigen aus `ad_term_hits` plus Namenssuche im gespeicherten Anzeigentext, Links zu Rangliste/Shop Spy/Ad Library, letzter Google-Trends-Abruf. Shop-Detail: „Alle aktiven Anzeigen“, verknüpfte Produkte, häufigste Anzeigentitel. Shop-Zählung speichert jetzt auch die Anzeigen (Sichtung mit Land „EU“).
- Recherche 26.11.2026: Reddit API braucht Freigabe (neue Zugänge laut Sekundärquellen seit 31.10.2026 zu), daher nicht gebaut. Shopify `/products.json` ist keine offizielle API (Shopify-Mitarbeiter: wollen es einschränken), daher nicht gebaut. Product Hunt v2: Developer Token, nicht kommerziell, 6250 Komplexitätspunkte/15 min.

## Verbindliche Anforderungen (Nutzer, 26.11.2026)
- **Strikt E-Commerce.** Alles (Trend, Startup, Future Radar, Produkte) muss für Online-Shops/Dropshipping relevant sein. Branchen wie Öl, Industrie, B2B-Software, Finanzen herausfiltern.
- **Startup Spy:** nur kleine, gerade gestartete E-Commerce-/D2C-Marken. Filter „Startup / Small Business / gerade gestartet“ (z. B. Gründungs- oder Launch-Datum, Grösse); keine Grosskonzerne.
- **Produktseite:** oben KI-kuratierte „Top-Hits“ (mit Begründung, Fakt/Signal/Einschätzung getrennt), darunter eine grosse durchsuchbare Lieferanten-Bibliothek (CJdropshipping, AliExpress usw.). Ehrlich: Den ganzen AliExpress-Katalog zu kopieren ist per API weder erlaubt noch möglich. Realistisch: Live-Suche über offizielle APIs (CJ, AliExpress Affiliate/Dropshipping API nach Zulassung) plus gespeicherte Treffer. Irrelevantes (z. B. Steine, Ersatzteile, Rohmaterial) per Kategorie-Filter und KI-Einstufung ausblenden.
- **Tägliches automatisches Update** für Produkte, Startups und Shops. Kosten tief halten: Haiku für Routine (Sortieren, Kategorisieren, Duplikate), stärkeres Modell nur für angeklickte Analysen, Batch-API (50 % günstiger) nachts, Caching, Tageslimit. Ziel ca. 3–10 USD/Monat. Kostenrahmen grundsätzlich zugestimmt; `ANTHROPIC_API_KEY` fehlt noch.
- Zahlen (z. B. Anzahl Anzeigen) kommen aus APIs, nicht aus der KI.

## Wichtige Dateien
- `src/lib/profit.ts`, `offers.ts`, `platforms.ts`, `assessment.ts` (Logik, mit Tests)
- `src/app/(app)/produkt/[id]/page.tsx`, `src/app/(app)/produkt/actions.ts`
- `src/components/product/*`, `src/components/profit/profit-calculator.tsx`
- `src/lib/trends/dataforseo.ts` (Anfrage/Antwort, Tests), `src/lib/trends/service.ts` (Cache, Limit, Abruf, Tests)
- `src/lib/ads/meta.ts` (Anfrage/Antwort/Signale, Tests), `src/lib/ads/service.ts` (Abruf, Speichern, Tests), `src/app/(app)/ad-spy/page.tsx`
- `src/lib/shops/shops.ts` (Seiten-ID, Domain, Zusammenfassung, Trend, Tests), `src/lib/shops/service.ts` (Zählen, Snapshot, Tests), `src/app/(app)/shop-spy/*`, `src/app/api/cron/shops/route.ts`, `vercel.json`
- `src/app/(app)/google-trends/page.tsx`, `src/components/trends/trend-chart.tsx`
- `supabase/migrations/*`

## Offene Punkte
- Nutzer: PR Phase 3d mergen, Migration 0003 ausführen, `CRON_SECRET` und `SUPABASE_SERVICE_ROLE_KEY` in Vercel setzen (README „Shop Spy“). Meta-Token einrichten (README „Meta Ad Spy“), DataForSEO-Konto eröffnen (README „Google Trends“). Supabase und Vercel sind laut Nutzer eingerichtet (26.11.2026); prüfen, ob Migrationen 0001 und 0002 gelaufen sind.
- Meta: Zugangsschritte (Identitätsbestätigung, App, Token) nicht gegen die offizielle Seite geprüft (facebook.com/ads/library/api blockiert automatischen Abruf). Paging (`paging.cursors.after`, `limit`) nach Graph-API-Standard, mit echtem Token testen.
- Shop Spy: `search_page_ids` ohne `search_terms` und mehrere Länder in `ad_reached_countries` laut Doku zulässig, aber noch nicht mit echtem Token getestet. Hobby-Plan: Funktion max. 300 s, darum max. 40 Shops pro Lauf.
- Konten mit Kosten erst nach Zustimmung: Anthropic API, CJdropshipping. Meta-API ist kostenlos.

## Nächster Schritt
Mit echtem Meta-Token prüfen (Ad Spy und Shop Spy). Danach in dieser Reihenfolge: CJdropshipping-API als Lieferanten-Bibliothek mit Relevanzfilter, KI-Grundlage (Haiku, Batch, Cache, Tageslimit) mit täglichem Lauf in GitHub Actions, Top-Hits auf der Produktseite, Startup Spy mit E-Commerce- und „gerade gestartet“-Filter, Dashboard.
