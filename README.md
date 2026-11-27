# TrendRadar

Private E-Commerce Research- und Discovery-Plattform: Trend Spy, Ad Spy, Google Trends, Startup Spy,
Future Radar, Global Search, Watchlist und Profit-Rechner. Nur für eine Person, ohne öffentliche Registrierung.

Grundregeln im Code: keine erfundenen Zahlen, jede Angabe mit Quelle, Einschätzungen klar als solche markiert,
keine unzulässigen Scraping-Methoden.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS 4, lucide-react, Recharts
- Supabase (Postgres, Auth, Row Level Security)
- Hosting: Vercel (Hobby). Tägliche Recherche ab Phase 4 per GitHub Actions.

## Einrichtung

1. **Supabase-Projekt anlegen** (Region Europa).
2. **Schema einspielen:** Alle Dateien in `supabase/migrations/` der Reihe nach (0001, 0002, …) im Supabase SQL Editor ausführen. Bei Updates nur die neuen Dateien ausführen.
3. **Registrierung abschalten:** Authentication → Sign In / Providers → „Allow new users to sign up“ aus.
4. **Eigenes Konto anlegen:** Authentication → Users → „Add user“ mit E-Mail und starkem Passwort.
5. **Konto als Besitzer eintragen** (nur dieses Konto sieht Daten):
   ```sql
   insert into app_owner (user_id) select id from auth.users where email = 'deine@adresse.ch';
   ```
6. **Umgebungsvariablen** in Vercel (Project → Settings → Environment Variables) bzw. lokal in `.env.local`
   setzen, siehe `.env.example`.
7. **Vercel:** Repository importieren, Framework „Next.js“, deployen.

## Google Trends (DataForSEO)

Die Seite „Google Trends“ fragt DataForSEO ab (Endpoint `google_trends/explore/live`, laut Preisseite 0.011 USD pro Aufgabe).
Eine Suche braucht zwei Aufgaben: die Kurve und für den ersten Begriff Regionen, verwandte Suchanfragen und Themen (laut Doku nur mit einem Begriff möglich). Also rund 0.022 USD pro neuer Suche. Neue Konten bekommen 1 USD Startguthaben, die Mindesteinzahlung danach ist 50 USD (Stand 27.11.2026).
Ohne Zugangsdaten zeigt sie keine Kurven und keine Beispieldaten.

1. Konto auf [app.dataforseo.com/register](https://app.dataforseo.com/register) eröffnen und E-Mail bestätigen.
2. Im Dashboard unter **API Access** den **API-Login** und das **API-Passwort** kopieren (nicht das Login-Passwort der Website).
3. In Vercel als `DATAFORSEO_LOGIN` und `DATAFORSEO_PASSWORD` eintragen, danach neu deployen.
4. Optional `DATAFORSEO_DAILY_LIMIT` setzen (Standard 30 Aufgaben pro Tag, also höchstens rund 0.33 USD; eine Suche zählt zwei).

Jede Antwort wird in `trend_series` gespeichert. Dieselbe Abfrage (Begriffe, Region, Zeitraum) innerhalb von 24 Stunden
kommt aus dem Zwischenspeicher und kostet nichts.

## Meta Ad Spy (Meta Ad Library API)

Die Seite „Ad Spy“ sucht Anzeigen über die offizielle Meta Ad Library API (Endpoint `ads_archive`, kostenlos, Abfragelimit pro Stunde).
Ohne Token zeigt sie keine Anzeigen und keine Beispieldaten, nur Links zur Ad Library im Browser.

Grenzen laut Meta-Doku: Produktanzeigen gibt es nur, wenn sie in der EU ausgespielt wurden (die Schweiz fehlt). Ausgaben,
Impressionen und Umsatz liefert Meta nur für politische Anzeigen. Bilder und Videos kommen nicht über die API; jede Anzeige
hat einen Link zur Ad Library. Das `ad_snapshot_url` von Meta enthält das Token und wird deshalb nie verwendet.

1. Identität bei Meta bestätigen: [facebook.com/ID](https://www.facebook.com/ID) (Ausweis, kann einige Tage dauern).
2. Entwicklerkonto auf [developers.facebook.com](https://developers.facebook.com) eröffnen (mit dem gleichen Facebook-Konto).
3. Unter **Meine Apps** eine neue App anlegen (Typ ohne Produkte, z. B. „Andere“ / „Business“).
4. Im [Graph API Explorer](https://developers.facebook.com/tools/explorer/) die App wählen und ein **User Access Token** erzeugen.
5. Im [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/) auf **Access Token verlängern** klicken (gilt dann rund 60 Tage).
6. In Vercel als `META_ACCESS_TOKEN` eintragen, danach neu deployen. Optional `META_GRAPH_VERSION` (Standard `v26.0`).

Läuft das Token ab, zeigt die Seite „Token ungültig oder abgelaufen“; dann Schritte 4 bis 6 wiederholen.
Gefundene Anzeigen werden in `advertisers` und `ads` gespeichert (keine neue Migration nötig).

## Shop Spy (aktive Anzeigen pro Shop)

Die Seite „Shop Spy“ zählt für verfolgte Shops (Facebook-Seiten) alle aktiven Anzeigen über die Meta Ad Library API,
gruppiert sie nach Domain und speichert pro Tag einen Messpunkt. Daraus entsteht der Verlauf, z. B. „von 5 auf 40 Anzeigen in einer Woche“.
Shops fügst du im Ad Spy mit „Shop verfolgen“ hinzu oder auf der Seite mit einem Ad-Library-Link (`view_all_page_id=…`).

Grenzen: Gezählt werden nur Anzeigen, die in der EU laufen. Die Domain stammt aus der Link-Beschriftung der Anzeige, nicht aus der
echten Landingpage-URL (die liefert Meta nicht). Pro Zählung höchstens 1000 Anzeigen, darüber steht „mind.“.

Einrichtung:
1. Migration `supabase/migrations/0003_shops.sql` im Supabase SQL Editor ausführen.
2. Für das **tägliche automatische Zählen** in Vercel zusätzlich setzen:
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase → Project Settings → API Keys → `service_role` (geheim, nie mit `NEXT_PUBLIC_` beginnen).
   - `CRON_SECRET`: eine zufällige Zeichenkette mit mindestens 16 Zeichen (z. B. ein Passwort-Generator, 32 Zeichen).
3. Neu deployen. Vercel ruft dann `/api/cron/shops` einmal täglich auf (`vercel.json`, um 5 Uhr UTC; im kostenlosen Plan irgendwann in dieser Stunde)
   und schickt `CRON_SECRET` automatisch mit. Kontrolle: Vercel → Project → Settings → Cron Jobs.

Ohne diese zwei Variablen funktioniert der Shop Spy trotzdem, aber nur mit dem Knopf „jetzt zählen“.

## Ad Spy Rangliste (eigene Daten)

Unter Ad Spy → „Rangliste (eigene Daten)“: Werbetreibende nach **meisten aktiven Anzeigen jetzt**, meisten neuen Anzeigen (7 Tage),
längster Laufzeit oder neuester Anzeige; einzelne Anzeigen nach Laufzeit, Startdatum oder EU-Reichweite. Filter: Zeitraum, Land, Plattform, Stichwort.
Ehrlich: Meta liefert keine globale Rangliste. Gezählt wird nur, was TrendRadar selbst gesehen hat (täglicher Sammellauf über die Stichwörter
plus jede Live-Suche mit Status „Aktiv“). Je mehr passende Stichwörter, desto aussagekräftiger. Einrichtung: Migration `0005_ad_rankings.sql`.

## Datensammler (tägliche Bots)

Die Seite „Datensammler“ steuert die Bots, die jeden Tag automatisch laufen. Alle Quellen sind offiziell und kostenlos;
jeder Eintrag speichert Originalquelle und Entdeckungsdatum, Duplikate (gleiche Quelle oder sehr ähnlicher Name im selben Bereich) werden zusammengeführt.

| Bot | Quelle | Zeit (UTC) | Wohin |
| --- | --- | --- | --- |
| Anzeigen-Stichwörter | Meta Ad Library API, bis 300 aktive Anzeigen pro Stichwort und Land | 03:00 | Ad Spy, Rangliste |
| Product Hunt | Product Hunt API v2, Launches der letzten 36 h mit Konsum-Themen | 04:00 | Startup Spy |
| RSS-Feeds | eigene Liste von RSS/Atom-Feeds, optional mit Stichwortfilter | 04:30 | Trend Spy, Startup Spy oder Future Radar |
| News | eigene News-Feeds (RSS/Atom, z. B. Google-News-Suchen) | 04:45 | Daily News |
| Shops | Meta Ad Library API | 05:00 | Shop Spy |

Bewusst **nicht** dabei (Stand 26.11.2026): Reddit (neue API-Zugänge brauchen Freigabe durch Reddit), Kickstarter/Indiegogo, TikTok Creative Center,
Amazon (Nutzungsbedingungen verbieten automatisches Auslesen, nur Links), Shopify `/products.json` (keine offizielle API, Shopify will den Zugang einschränken).

Einrichtung:
1. Migration `supabase/migrations/0004_collectors.sql` im Supabase SQL Editor ausführen.
2. `CRON_SECRET` und `SUPABASE_SERVICE_ROLE_KEY` wie unter „Shop Spy“ setzen (falls noch nicht geschehen).
3. Optional Product Hunt: auf https://www.producthunt.com/v2/oauth/applications eine Anwendung anlegen (Redirect-URI z. B. `https://localhost`),
   dort den **Developer Token** kopieren und in Vercel als `PRODUCTHUNT_TOKEN` eintragen. Kostenlos, laut Product Hunt nur für nicht kommerzielle Nutzung.
4. Migrationen `0005_ad_rankings.sql` und `0006_news_inbox.sql` ausführen (Rangliste, News, Inbox, Shop-Favoriten).
5. Neu deployen. Unter Vercel → Settings → Cron Jobs erscheinen fünf tägliche Läufe.

**Daily News:** Kacheln mit Bild, Titel und Anrisstext aus dem Feed; Klick zeigt den Auszug und den Link zum Originalartikel.
Volltexte werden nicht kopiert (Urheberrecht), Bilder werden direkt vom Verlag geladen. Google-News-Feeds liefern meist keine Bilder.
News älter als 30 Tage werden automatisch gelöscht.

**Inbox:** Jeder Lauf schreibt nur dann einen Eintrag, wenn sich etwas geändert hat: neue Launches/Einträge, neue oder beendete Anzeigen
pro Stichwort, Shops mit deutlicher Veränderung (mind. 3 Anzeigen und 25 %) oder ohne aktive Anzeigen. Favorisierte Shops melden jede Veränderung.

**Favoriten:** Produkte über „Zur Watchlist“, Shops über den Stern. Die täglichen Läufe löschen nie etwas aus den Favoriten.

## Startup Spy (kleine, neue E-Commerce-Marken)

Migration `supabase/migrations/0007_startup_spy.sql` im Supabase SQL Editor ausführen, **bevor** der Code live geht.

Quellen, alle legal und kostenlos:

- **Neue Werbetreibende** (Meta Ad Library, aus deinen gesammelten Anzeigen): Seiten, deren älteste bekannte Anzeige höchstens 60 Tage alt ist, mit höchstens 15 Anzeigen und einer eigenen Shop-Domain. Täglich um ca. 04:40 (`/api/cron/collect?job=startups`), braucht keine zusätzliche API-Abfrage. Grenze: „bekannt“ heisst in deinen Daten; ältere, nie gesammelte Anzeigen fehlen.
- **Product Hunt** (`PRODUCTHUNT_TOKEN`): nur Launches mit Konsum-Themen.
- **RSS-Feeds** mit Bereich „Startup Spy“.

E-Commerce-Filter (`src/lib/startups/relevance.ts`): feste Regeln, keine KI. Öl und Gas, Bergbau, Industrie, Chemie, Pharma, Finanzen, Krypto, Immobilien, B2B-Software, Beratung, Personal, Rüstung, Logistik werden nicht gespeichert. Konsum-Begriffe oder eine eigene Shop-Domain ergeben „E-Commerce“, sonst „unklar“. Das ist eine Einschätzung und wird so angezeigt.

Nicht eingebaut, mit Grund: Kickstarter und Indiegogo haben keine offene API (Scraping verboten). Das Schweizer Handelsamtsblatt (SHAB) hat eine API für Neueintragungen, deren Doku liess sich hier aber nicht prüfen; folgt erst, wenn sie getestet ist.

## Future Radar (Themen beobachten)

Braucht ebenfalls Migration `0007_startup_spy.sql` (Tabelle `radar_topics`, Abfrage `radar_topic_stats`).

Unter „Future Radar“ eigene Themen eintragen (z. B. „Pilzkaffee“). Pro Thema getrennt angezeigt:

- **Fakten**: Treffer in deinen Daily News (7 Tage, Vorwoche), aktive und neue Anzeigen, wenn es ein gleichnamiges Anzeigen-Stichwort im Datensammler gibt, neue Einträge aus allen Bereichen (30 Tage). Alles aus den eigenen, gesammelten Daten.
- **Signal**: Veränderung gegenüber der Vorwoche.
- **Einschätzung**: feste Regeln, keine KI („neu aufgetaucht“, „steigend“, „stabil“, „rückläufig“, „zu wenig Daten“). Unter 3 Treffern oder mit weniger als 14 Tagen News-Verlauf gibt es keine Einschätzung. Logik: `src/lib/radar/assess.ts`.

Darunter bleiben die Einträge aus RSS-Feeds mit Bereich „Future Radar“. Eine KI-Bewertung folgt erst mit `ANTHROPIC_API_KEY`.

## Lokal entwickeln

```bash
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev
```

Prüfen: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Sicherheit

- Login nur für `ALLOWED_EMAIL`, geprüft im Proxy und nochmals serverseitig in jeder geschützten Seite.
- Row Level Security: Daten nur für das Konto in `app_owner`.
- API-Keys liegen nur als Server-Umgebungsvariablen bzw. GitHub-Secrets, nie im Browser.
- Seiten sind mit `noindex` markiert.

## Struktur

- `src/app/(app)/` – geschützte Seiten
- `src/app/login/` – Login und Logout
- `src/lib/profit.ts` – Rechenlogik des Profit-Rechners (mit Tests)
- `src/lib/supabase/` – Supabase-Clients und Sitzungs-Proxy
- `supabase/migrations/` – Datenbankschema

## Produkte (Top-Hits und Lieferanten-Bibliothek)

Seite `/produkte`. Oben Top-Hits nach Regeln aus echten Daten, darunter die Bibliothek aller gespeicherten Lieferanten-Produkte mit Filtern.

1. Migration `supabase/migrations/0008_product_library.sql` im Supabase SQL Editor ausführen.
2. Kostenloses Konto bei CJdropshipping eröffnen, API-Key erzeugen und in Vercel als `CJ_API_KEY` eintragen (Anleitung in den Projektdateien: `anleitungen/cj-und-claude-zugang.md`). Optional `CJ_DAILY_LIMIT` (Standard 300).
3. Täglicher Lauf: Vercel Cron `/api/cron/collect?job=library` (02:30 UTC). Holt die CJ-Trend- und Neuheitenliste und deine Suchbegriffe, sortiert nach Übernahmen durch Shops, und speichert einen Messpunkt pro Tag (daraus entsteht das Wachstum).
4. Optional KI-Bewertung: `ANTHROPIC_API_KEY` und `AI_MONTHLY_BUDGET_USD` (Standard 5) setzen. Cron `/api/cron/collect?job=ai` (05:30 UTC) bewertet neue Produkte mit Claude Haiku (relevant ja/nein, 1–5, kurze Begründung). Stoppt, sobald das Tagesbudget (Monatsbudget / 30) erreicht ist.

Grenzen: CJ erlaubt 1 Anfrage pro Sekunde und kostenlosen Konten 1000 pro Tag. AliExpress, Alibaba und Temu nur als Links, solange keine offizielle API freigegeben ist. Den ganzen Katalog eines Lieferanten zu kopieren ist weder erlaubt noch möglich; die Bibliothek wächst mit jeder Suche und jedem täglichen Lauf.
