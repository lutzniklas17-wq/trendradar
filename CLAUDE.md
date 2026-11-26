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
