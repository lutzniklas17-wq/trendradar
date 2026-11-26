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
