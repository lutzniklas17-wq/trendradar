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
2. **Schema einspielen:** Inhalt von `supabase/migrations/0001_init.sql` im Supabase SQL Editor ausführen.
3. **Registrierung abschalten:** Authentication → Sign In / Providers → „Allow new users to sign up“ aus.
4. **Eigenes Konto anlegen:** Authentication → Users → „Add user“ mit E-Mail und starkem Passwort.
5. **Konto als Besitzer eintragen** (nur dieses Konto sieht Daten):
   ```sql
   insert into app_owner (user_id) select id from auth.users where email = 'deine@adresse.ch';
   ```
6. **Umgebungsvariablen** in Vercel (Project → Settings → Environment Variables) bzw. lokal in `.env.local`
   setzen, siehe `.env.example`.
7. **Vercel:** Repository importieren, Framework „Next.js“, deployen.

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
