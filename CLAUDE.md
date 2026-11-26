# TrendRadar: Arbeitsregeln für Claude

@AGENTS.md

## Kontext sparen (Context Compactor)

- **STAND.md zuerst:** Zu Beginn jedes Threads `STAND.md` als Erstes lesen. Nach jeder fertigen Teilaufgabe aktualisieren: Ziel, Entscheidungen, geänderte Dateien, offene Probleme, nächster Schritt.
- **Sparsam lesen:** Erst suchen (grep/glob), dann nur die relevanten Zeilen lesen. Logs und Befehlsausgaben filtern (`tail`, `grep`). Nie `node_modules`, Lockfiles (`package-lock.json`) oder Build-Ordner (`.next`) lesen.
- **Langer Thread:** `STAND.md` aktualisieren und dem Nutzer sagen, dass er einen neuen Thread starten soll. Kein `/compact`.

## Projektregeln

- Private Ein-Personen-Website. Keine erfundenen Zahlen; Fakt, Signal und Einschätzung klar trennen; Originalquelle angeben.
- Kein unzulässiges Scraping, nur offizielle APIs oder Links. API-Keys nur serverseitig.
- Käufe, neue Konten und kostenpflichtige Dienste erst nach Zustimmung des Nutzers.
- Antworten auf Deutsch (Schweizer Schreibweise, „ss“ statt „ß“).
- Arbeit auf Feature-Branches mit Pull Request. Vor dem Push: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Design-Regeln (verbindlich, seit 26.11.2026)

Ziel: ruhig, clean, hochwertig wie Linear oder Stripe. Kein „KI-Look“. Aufbau der Entdecken-Seiten (Produkte, Anzeigen, Shops) eng an Minea angelehnt (Screenshots in den Projektdateien `design/minea/`): `BrowseHeader`, grosse Suche, `QuickChips`, `FilterPanel`, breite Zeilen bzw. Karten. Eigene Farbe (Indigo, vom Nutzer am 26.11. bestätigt), eigene Texte, kein fremder Code und keine fremden Logos.

- **Farben nur über Tokens** aus `src/app/globals.css` (`bg-surface`, `text-muted`, `border-border`, `text-accent` …). Keine Hex-Werte, keine Tailwind-Standardfarben (`bg-blue-500`), keine Verläufe, keine Neon- oder Glow-Effekte. Ein einziger gedämpfter Akzent (Indigo), sparsam: Primär-Button, aktiver Zustand, Links, Fokus, erste Diagrammlinie. Diagramme nutzen `var(--chart-1…5)`.
- **Typografie:** Geist. Normal `font-medium` (500); `font-semibold` (600) nur für Seitentitel der Entdecken-Seiten (`BrowseHeader`, `text-2xl`), Produkttitel, Preise und Spaltentitel in Zeilen. Kein `font-bold`. Kartentitel `text-sm`, Beschriftungen `text-[13px] text-muted`, Zahlen `tabular-nums`. Grossbuchstaben nur als kleine Gruppenlabels im `FilterPanel`.
- **Form:** Karten `rounded-lg border shadow-xs`, Produktzeilen und Filterpanel `rounded-xl`, Eingaben und Buttons `rounded-md` (grosse Suche `h-12 rounded-xl`), Badges `rounded`. Pillen nur für Schnellfilter (`QuickChips`, Punkte in `var(--chart-n)`). Abstände im 4er-Raster; Karteninhalt `px-5`, Seitentitel `mb-8`.
- **Bausteine statt eigener Klassen:** `Button`/`buttonClass`, `SubmitButton` (für jede Server Action, zeigt Ladezustand), `Field`/`Input`/`Select`/`inputClass`, `Card`/`CardHeader`/`Notice`, `Badge`, `EmptyState`, `FilterBar`.
- **Jede Liste bekommt eine `FilterBar` oder ein `FilterPanel`** (Filter in der URL, Logik in `src/lib/list-filters.ts` mit Tests). Leere Ergebnisse zeigen „Keine Einträge für diese Filter“ mit Zurücksetzen.
- **Keine toten Knöpfe:** Jeder Button hat eine Aktion oder ist mit Begründung (`title`) deaktiviert. Keine `href="#"`.
- Bewegung nur dezent (`transition-colors duration-150`), `prefers-reduced-motion` wird respektiert. Hell- und Dunkelmodus und 390 px Breite prüfen.
