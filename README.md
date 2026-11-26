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

Die Seite „Google Trends“ fragt DataForSEO ab (Endpoint `google_trends/explore/live`, laut Preisseite 0.011 USD pro Abfrage).
Ohne Zugangsdaten zeigt sie keine Kurven und keine Beispieldaten.

1. Konto auf [app.dataforseo.com/register](https://app.dataforseo.com/register) eröffnen und E-Mail bestätigen.
2. Im Dashboard unter **API Access** den **API-Login** und das **API-Passwort** kopieren (nicht das Login-Passwort der Website).
3. In Vercel als `DATAFORSEO_LOGIN` und `DATAFORSEO_PASSWORD` eintragen, danach neu deployen.
4. Optional `DATAFORSEO_DAILY_LIMIT` setzen (Standard 30 neue Abfragen pro Tag, also höchstens rund 0.33 USD).

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
