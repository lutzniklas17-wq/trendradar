# Stand TrendRadar

_Zuletzt aktualisiert: 26.11.2026_

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

- Phase 3c (Branch `claude/project-thread-ut0jrj`, PR offen): Meta Ad Spy über Ad Library API (`ads_archive`, v26.0, Felder laut Doku). Suche nach Begriff, EU-Land, Status, Plattform; Paging per Cursor; Treffer in `advertisers`/`ads` gespeichert; Signale „lange Laufzeit“ (ab 30 Tagen) und „mehrere Anzeigen pro Seite“. Ohne Token: Hinweis plus Browser-Links zur Ad Library (auch Schweiz). `ad_snapshot_url` enthält das Token, deshalb nur öffentlicher Link `facebook.com/ads/library/?id=`. Link „Ad Spy“ auf der Produktseite. Keine neue Migration.

## Wichtige Dateien
- `src/lib/profit.ts`, `offers.ts`, `platforms.ts`, `assessment.ts` (Logik, mit Tests)
- `src/app/(app)/produkt/[id]/page.tsx`, `src/app/(app)/produkt/actions.ts`
- `src/components/product/*`, `src/components/profit/profit-calculator.tsx`
- `src/lib/trends/dataforseo.ts` (Anfrage/Antwort, Tests), `src/lib/trends/service.ts` (Cache, Limit, Abruf, Tests)
- `src/lib/ads/meta.ts` (Anfrage/Antwort/Signale, Tests), `src/lib/ads/service.ts` (Abruf, Speichern, Tests), `src/app/(app)/ad-spy/page.tsx`
- `src/app/(app)/google-trends/page.tsx`, `src/components/trends/trend-chart.tsx`
- `supabase/migrations/*`

## Offene Punkte
- Nutzer: PR Phase 3c mergen (PR #3 wird damit automatisch erledigt), Meta-Token einrichten (README „Meta Ad Spy“), DataForSEO-Konto eröffnen (README „Google Trends“). Supabase und Vercel sind laut Nutzer eingerichtet (26.11.2026); prüfen, ob Migrationen 0001 und 0002 gelaufen sind.
- Meta: Zugangsschritte (Identitätsbestätigung, App, Token) nicht gegen die offizielle Seite geprüft (facebook.com/ads/library/api blockiert automatischen Abruf). Paging (`paging.cursors.after`, `limit`) nach Graph-API-Standard, mit echtem Token testen.
- Konten mit Kosten erst nach Zustimmung: Anthropic API, CJdropshipping. Meta-API ist kostenlos.

## Nächster Schritt
Mit echten Zugängen prüfen, ob DataForSEO und Meta wie erwartet ausgelesen werden. Danach: CJdropshipping-API für Angebote, KI-Analyse, Dashboard, tägliche Recherche (GitHub Actions) inkl. gespeicherter Ad-Suchen.
