# Wunsch-Checkliste TrendRadar

_Abgleich vom 27.11.2026: alle Wünsche von Niklas aus Projektchat und Threads (26.–27.11.2026), geprüft gegen den Code auf `main` (Stand PR #16)._

Zeichen: ✅ erledigt · 🟡 teilweise · ❌ fehlt · ⛔ nicht machbar (Grund steht dabei)

**Regel für alle Threads:** Neue Wünsche sofort hier eintragen. Vor jedem „fertig“ diese Liste prüfen.

## Was als Nächstes gebaut werden sollte (Reihenfolge)
1. KI-Analyse und Bewertung auf der Produkt-Detailseite (Seite ist da, aber leer)
2. Filter nach Kategorie auf „Produkte“ (Beauty, Fitness, Pet …), dazu „steigend/fallend“
3. Globale Suche über alle Bereiche (heute sucht sie nur einen Teil)
4. Google Trends: verwandte und steigende Suchbegriffe, Vergleich nach Regionen
5. Produkte nebeneinander vergleichen (auch gemerkte)
6. Future Radar: Themen automatisch finden und mit KI einschätzen

## Was Niklas noch einrichten muss (sonst bleiben Seiten leer)
- Meta-Token (Ad Spy, Shop Spy, Startup Spy, Rangliste)
- DataForSEO-Konto (Google Trends)
- Anthropic-Key (KI-Einstufung, Top-Hits-Begründung, später Analyse)
- AliExpress: App auf openservice.aliexpress.com freigeben lassen, dann 3 Schlüssel in Vercel

## Grundlagen
- ✅ Private Website online, Login nur für Niklas, keine Registrierung, keine Zahlungen
- ✅ API-Schlüssel nur auf dem Server
- ✅ Tägliche automatische Läufe (Produkte, Anzeigen, Startups, Product Hunt, RSS, News, Shops, KI)
- ✅ Nur echte Daten mit Quelle; Fakt, Signal und Einschätzung getrennt
- ✅ Strikt E-Commerce: Öl, Industrie, Finanzen, B2B-Software usw. werden aussortiert
- 🟡 Viele Quellen laufen erst, wenn die Schlüssel oben eingetragen sind

## Produkte (höchste Priorität)
- ✅ Grosse Suche über mehrere Plattformen, jedes Produkt zeigt seine Herkunft, Filter nach Plattform. **Ehrlich:** Der Wunsch „Suche über AliExpress und die anderen“ stand schon am 26.11. um 13:40 im Chat. Die erste Bibliothek (PR #10) kannte nur CJ und zeigte die Herkunft nicht. Der Filter kam erst am Abend (PR #15/#16).
- ✅ Top-Hits oben mit Begründung, darunter die grosse Bibliothek
- ✅ Unsinn wie Steine, Ersatzteile, Rohstoffe wird aussortiert (Regeln; KI kommt mit Key dazu)
- ✅ Merken-Knopf, gemerkte Produkte bleiben nach Updates
- ✅ Wachstum pro Produkt wird täglich gemessen (zählt für Top-Hits)
- 🟡 AliExpress ist eingebaut, aber noch nicht mit echten Schlüsseln getestet
- ❌ Filter nach Kategorie (Beauty, Skincare, Fitness, Pet, Küche …). Die Kategorie wird gespeichert, es gibt aber keinen Filter.
- ❌ Filter „steigend / fallend“
- ❌ Filter nach Land oder Markt (Trend Spy)
- ❌ Produkte nebeneinander vergleichen, auch aus der Merkliste
- ⛔ Alibaba, DHgate, Temu, Spocket, Zendrop, AutoDS: keine offene API, darum nur Links
- ⛔ Echte Verkaufszahlen: gibt es legal nirgends
- ⛔ Den ganzen AliExpress-Katalog kopieren: nicht erlaubt; die Bibliothek wächst mit jeder Suche

## Produkt-Detailseite
- ✅ Tabs: Übersicht, Lieferanten, Verkaufskanäle, Rechner, Analyse, Bewertung, Anzeigen & Trends
- ✅ Einkaufsquellen und Verkaufskanäle getrennt, Logos wo frei erlaubt (sonst Kürzel)
- ✅ Profit-Rechner mit allen gewünschten Feldern, Break-even-Preis, max. Werbekosten, Break-even-ROAS, Gewinn bei 100/500/1000 Bestellungen, 3 Szenarien, alles sofort neu berechnet
- 🟡 Preis, Versand, Lieferzeit, MOQ, Bewertung pro Plattform: bei CJ kommt der Preis automatisch, den Rest trägst du selbst ein
- 🟡 Klick aufs Logo öffnet die Produktseite: AliExpress ja, CJ über die Artikelnummer-Suche, die anderen nur eine Suche
- ❌ Ausführliche Beschreibung und Analyse (Problem, Nutzen, Zielgruppe, Hooks, Konkurrenz, Risiken, kurz- oder langfristig) und Bewertung nach Kriterien: Die Anzeige ist gebaut, aber nichts füllt sie. Braucht Anthropic-Key plus Code.
- ❌ Detailseite und Rechner im neuen Minea-Stil

## Ad Spy und Shop Spy
- ✅ Facebook und Instagram über die offizielle Meta-API: Suche nach Begriff, Land, Plattform, Status
- ✅ Rangliste „meiste aktive Anzeigen jetzt“, längste Laufzeit, neueste, Filter
- ✅ Anzeigen als Karten, Analyse-Seite mit Shop-Infos, Tabs „dieser Shop“ und „andere Shops“
- ✅ Shop Spy: wie viele Anzeigen ein Shop hat, Verlauf, Signal „skaliert“
- ✅ Verknüpfung Produkt → Anzeigen → Shop → Google Trends
- 🟡 Video abspielen: über die offizielle Meta-Vorschau eingebaut, ohne Token nicht getestet
- 🟡 Landingpage: nur die Domain, die genaue Adresse gibt Meta nicht heraus
- 🟡 Varianten desselben Produkts: nur über gleiches Stichwort („ähnliche Anzeigen“)
- 🟡 Rangliste zählt nur, was TrendRadar selbst sammelt (je mehr Stichwörter, desto besser)
- ⛔ TikTok-Anzeigen: keine erlaubte Schnittstelle für ein privates Tool (nur Link zur TikTok-Bibliothek)
- ⛔ CTA-Text, Werbeausgaben, Umsatz, Besucher: liefert Meta nicht

## Google Trends
- ✅ Suchinteresse im Zeitverlauf, bis 5 Begriffe vergleichen, Land und Zeitraum wählbar, Diagramm
- ❌ Verwandte und steigende Suchbegriffe, aufkommende Themen
- ❌ Vergleich nach Regionen (Karte/Liste)
- ❌ Automatisch „stark steigende Suchanfragen“ auf der Startseite (läuft heute nur, wenn du selbst suchst)

## Startup Spy
- ✅ Nur kleine E-Commerce- und D2C-Marken, Filter Startup / Small Business / gestartet in 30, 90, 180 Tagen
- ✅ Quellen: neue Werbetreibende aus Meta, Product Hunt, RSS-Feeds; Duplikate werden zusammengeführt
- 🟡 Standort, Gründungsjahr, Branche: nur wenn die Quelle es liefert, oft leer
- ❌ Schweizer Neueintragungen (SHAB): Schnittstelle existiert, noch nicht gebaut und getestet
- ⛔ Kickstarter, Indiegogo: keine offene API, Scraping verboten

## Future Radar
- 🟡 Du trägst Themen ein; die Seite zählt News, Anzeigen und Einträge und trennt Fakt, Signal und Einschätzung (nach Regeln)
- ❌ Neue Themen automatisch finden
- ❌ Einschätzung mit KI nach Innovationsgrad, Bedürfnis, Wettbewerb, Zielgruppe usw.

## Globale Suche
- 🟡 Sucht nur in gespeicherten Einträgen (Trend Spy, Startups, Radar)
- ❌ Bibliothek, Anzeigen, Shops, News und Google Trends fehlen in der Suche; es gibt keine Ansicht „alles zu einem Begriff“

## Startseite, Favoriten, Inbox, News
- ✅ Startseite mit „Top 10 des Tages“ und „Neu seit gestern“
- ✅ Favoriten für Produkte und Shops, bleiben nach Updates
- ✅ Inbox: neu, geändert, entfernt, nur bei echten Änderungen
- ✅ Daily News als Kacheln mit Bild, Titel, Anriss und Link zum Original
- ✅ Datensammler zeigt, wann jede Quelle zuletzt lief
- 🟡 Feeds von 20 Minuten, Blick usw. musst du selbst eintragen (Adressen nicht geprüft)
- ❌ Eigene KI-Kurzfassung der News (braucht Anthropic-Key)
- ⛔ Ganze Artikel kopieren: Urheberrecht

## Design
- ✅ Ruhig und clean, kein Neon, eine Farbe (Indigo), Aufbau wie Minea (Startseite, Anzeigen, Shops, Produkte)
- ✅ Filter auf den Listen, hell/dunkel, Handy
- 🟡 Die meisten Seiten noch nicht mit echten Daten im Browser angeschaut
- ⛔ Minea-Code oder -Bilder kopieren: fremdes geschütztes Werk; nachgebaut nach Screenshots

## Kosten
- ✅ Günstiges KI-Modell für Routine, Tageslimit und Monatsgrenze (5 USD)
- 🟡 Batch-API nachts: bewusst weggelassen, die Ersparnis wäre nur Cents
- ❌ Stärkeres Modell nur für angeklickte Analysen (kommt mit der Produkt-Analyse)

## Besprochen, nicht gebaut
- Später als Abo verkaufen wie Minea: Rat war, zuerst privat fertig bauen (Daten-Lizenzen, Recht, Aufwand)
- chrome-devtools-mcp: nur auf deinem eigenen PC sinnvoll, hier nicht installierbar
