# Stand TrendRadar

_Zuletzt aktualisiert: 27.11.2026 (Abgleich aller Nutzerwünsche mit dem Code, siehe Wunsch-Checkliste)_

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

- Phase 3c ist als PR #4 gemergt, Phase 3d als PR #5.
- Phase 3d (PR #5, gemergt): Shop Spy `/shop-spy` und `/shop-spy/[id]`. Shop = Facebook-Seite; zählt alle aktiven EU-Anzeigen per `search_page_ids` (alle 27 EU-Länder, 100 pro Seite, max. 10 Seiten → sonst „mind. 1000“), Domain aus `ad_creative_link_captions` (keine echte Landingpage-URL in der API), ein Snapshot pro Shop und Zürcher Tag. Signal „skaliert“ (verdoppelt und +5 ggü. ≥7 Tage) bzw. „stark rückläufig“. „Shop verfolgen“-Knopf im Ad Spy. Täglicher Lauf: Vercel Cron `vercel.json` → `/api/cron/shops` (braucht `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY`, Proxy lässt `/api/cron` ohne Login durch). Migration `0003_shops.sql`.

- Design-System (PR #6, gemergt): ruhige neutrale Palette mit einem Indigo-Akzent, Geist bis max. 500, neue Bausteine `ui/field.tsx`, `ui/filter-bar.tsx`, `ui/submit-button.tsx`, `Notice` in `ui/card.tsx`. Filter (URL-Parameter, ohne Neuladen) auf Trend Spy, Watchlist, Suche, Shop Spy; Logik `src/lib/list-filters.ts` mit Tests. Alle Server-Action-Knöpfe zeigen Ladezustand. Design-Regeln stehen in `CLAUDE.md`. Ad Spy bewusst nicht angefasst (paralleler Thread baut dort Filter „meiste Anzeigen“); er erbt nur die neuen Farben.
- Phase 4a (PR #7, gemergt, Phasen 4a–4d in einem PR): Datensammler `/sammler`. Vercel Cron `/api/cron/collect?job=ads|producthunt|rss` (gemeinsame Prüfung in `src/lib/cron.ts`). Anzeigen-Stichwörter (`ad_watch_terms`, max. 3×100 aktive Anzeigen pro Stichwort/Land, Abbruch bei Limit/Token/240 s) → `ad_sightings` (Anzeige aktiv gesehen pro Tag/Land) und `ad_term_hits`; auch manuelle Ad-Spy-Suchen mit Status „Aktiv“ schreiben Sichtungen. Product Hunt v2 (`PRODUCTHUNT_TOKEN`, Konsum-Themen-Filter ohne KI) → Startup Spy. RSS/Atom-Feeds (`feeds`, Stichwortfilter). Duplikate: gleiche `source_url` oder `find_similar_items` ≥ 0.8 im selben Bereich. Protokoll in `research_runs.job`. Migration `0004_collectors.sql`.
- Phase 4b (gleicher Branch): Ad Spy Rangliste `/ad-spy/rangliste` über RPC `ad_rank_advertisers` und `ad_rank_ads` (Migration `0005_ad_rankings.sql`, mit lokalem Postgres 16 getestet). Sortierungen: aktiv jetzt, neu 7 Tage, längste Laufzeit, neueste; Filter Zeitraum (2/7/30 Tage), Land, Plattform, Stichwort; Drill-down pro Werbetreibendem; Links zu Shop Spy/„Shop verfolgen“ und Ad Library. Live-Suche hat „Täglich sammeln“. Umschalter `src/components/ads/ad-spy-nav.tsx`, Logik `src/lib/ads/rankings.ts`.
- Phase 4c (gleicher Branch): Verknüpfungen in `src/lib/links.ts`. Produktseite Tab „Anzeigen & Trends“ (`src/components/product/market-section.tsx`): Stichwörter des Produkts täglich sammeln (`ad_watch_terms.item_id`), Werbetreibende und längste Anzeigen aus `ad_term_hits` plus Namenssuche im gespeicherten Anzeigentext, Links zu Rangliste/Shop Spy/Ad Library, letzter Google-Trends-Abruf. Shop-Detail: „Alle aktiven Anzeigen“, verknüpfte Produkte, häufigste Anzeigentitel. Shop-Zählung speichert jetzt auch die Anzeigen (Sichtung mit Land „EU“).
- Phase 4d (gleicher Branch, Migration `0006_news_inbox.sql`, mit Postgres 16 getestet): Daily News `/news` + `/news/[id]` (Feeds mit `kind='news'`, Tabelle `news_articles`: Titel, Bild aus media:content/enclosure/img, Anrisstext, Link; keine Volltexte; Vorschläge = Google-News-RSS-Suchen in `src/lib/news.ts`, Format nicht live getestet, kein Netz in der Sandbox). Inbox `/inbox` (`inbox_entries`, `src/lib/inbox.ts`): Einträge nur bei Änderungen aus Anzeigen-Sammellauf (neue/beendete Anzeigen, neue Werbetreibende), Product Hunt, RSS, Shops (`shopChange`). Favoriten: `tracked_shops.favorite` + Stern (`FavoriteShopButton`), Watchlist heisst jetzt „Favoriten“. Startup Spy und Future Radar listen gesammelte Einträge (`src/components/areas/area-items.tsx`). Rangliste nutzt `FilterBar`.
- Phase 5a (PR #8, gemergt, Migration `0007_startup_spy.sql`, mit Postgres 16 getestet):
  - E-Commerce-Filter nach Regeln `src/lib/startups/relevance.ts` (Ausschluss Öl/Gas, Bergbau, Industrie, Chemie, Pharma, Finanzen, Krypto, Immobilien, B2B-Software, Beratung, Personal, Rüstung, Logistik; kurze Begriffe nur als ganzes Wort). Gilt für Product Hunt, alle RSS-Feeds und neue Werbetreibende. `items.relevance` + `relevance_reason`.
  - Neue Quelle „Neue Werbetreibende“ (`src/lib/startups/new-advertisers.ts`, RPC `new_advertisers`, Job `startups`, Cron 03:40 UTC): älteste bekannte Anzeige ≤ 60 Tage, ≤ 15 bekannte Anzeigen, eigene Shop-Domain (`ads.domain` neu, Plattformen/Marktplätze ausgeschlossen) → Startup Spy, `stage='small_business'`. Product Hunt → `stage='startup'`, `launched_at` = Launch.
  - Duplikate zusätzlich über gleiche Website-Domain im selben Bereich (`websiteHost`).
  - Startup Spy (`src/components/startups/startup-list.tsx`): Filter Art, „Gestartet ≤ 30/90/180 Tage“, Relevanz, Quelle, Sortierung (`filterStartups`).
  - Future Radar: Tabelle `radar_topics`, RPC `radar_topic_stats` (News 7 T/Vorwoche, Anzeigen über gleichnamiges Stichwort, Einträge 30 T). Fakt / Signal / Einschätzung getrennt; Einschätzung nach Regeln in `src/lib/radar/assess.ts` (min. 3 Treffer, 14 Tage Verlauf). Radar-Filter nutzen eigene URL-Parameter (`einschaetzung`, `reihenfolge`).
  - Abwärtskompatibel: Ohne Migration 0007 speichern Anzeigen und Einträge ohne die neuen Spalten.
- Phase 6a (Branch `claude/project-thread-ybhadj`, PR offen, Migration `0008_product_library.sql`, mit Postgres 16 getestet):
  - Seite `/produkte` (Navigation „Produkte“ direkt nach Dashboard): Live-Suche bei CJ, Top-Hits, Bibliothek mit `FilterBar` (Relevanz, Preis, Sortierung, Gratisversand, Ausgeblendete, Begriff `begriff`, Seiten à 48), Karten mit grossem Bild (`src/components/library/product-card.tsx`), „Übernehmen“ legt Produkt (Trend Spy) + CJ-Angebot an, „Ausblenden“, Links zu AliExpress/Alibaba/Temu (nur Links).
  - CJdropshipping API 2.0 (`src/lib/library/cj.ts`, `service.ts`): `POST /authentication/getAccessToken` mit `apiKey` (Token 180 Tage, in `provider_tokens`), `GET /product/listV2` (`keyWord`, `orderBy=1` = Übernahmen, `productFlag` 0 Trend/1 neu, Antwort `data.content[].productList[]`), Header `CJ-Access-Token`, 1 Anfrage/s, Tageslimit `CJ_DAILY_LIMIT` (Standard 300, CJ-Grenze 1000) über `api_usage` + RPC `bump_api_usage`. Produkt-URL = CJ-Suche nach SKU (Detail-URL-Format nicht dokumentiert). Nicht mit echtem Key getestet.
  - Tabellen `supplier_products` (u. a. `listed_count` = CJ `listedNum`, `relevance`, `ai_*`), `supplier_product_snapshots` (1 pro Tag → Wachstum), `library_terms`, `api_usage`, `provider_tokens`; RPC `ad_counts_by_term`.
  - Regel-Filter `src/lib/library/relevance.ts`: Steine/Rohstoffe, Ersatzteile, Elektronikbauteile, Werkstatt/Industrie, Grosshandel → ausgeschlossen (mit Grund); „stone“ bei Schmuck/Deko/Gua Sha erlaubt; ohne Bild oder < 0.50 USD → unklar.
  - Top-Hits `src/lib/library/top-hits.ts`: Fakt (Übernahmen), Signale (+Übernahmen in 5–10 Tagen, neu bei CJ ≤ 30 Tage, Meta-Anzeigen zum gleichen Stichwort), Einschätzung (KI-Note). Ohne Signal kein Top-Hit; 12 Plätze.
  - Täglich: Cron `job=library` 02:30 UTC (CJ Trend + Neu + Begriffe, max. 60 Abfragen, 240 s), `job=ai` 05:30 UTC.
  - KI (`src/lib/ai/`): `@anthropic-ai/sdk`, Modell `claude-haiku-5-5` (0.10/0.50 USD pro Mio. Tokens), `messages.parse` mit Zod-Schema, effort low, 20 Produkte pro Anfrage, max. 100 pro Tag, Budget `AI_MONTHLY_BUDGET_USD` (Standard 5) / 30 pro Tag, Kosten in `api_usage`. Ohne `ANTHROPIC_API_KEY` aus. Entscheidung: keine Batch-API, weil die Ersparnis bei diesem Volumen Cents sind und Batch einen zweiten Abhol-Lauf braucht; Caching greift erst ab ca. 1–4k Tokens Prefix, der Systemprompt ist kürzer.
  - Datensammler-Seite: Karten „Produkt-Bibliothek“ und „KI-Bewertung“ mit „Jetzt …“-Knopf.
  - Anleitung für Nutzer: Projektdateien `anleitungen/cj-und-claude-zugang.md`.
  - Startseite (auf Basis PR 11, Branch hrpdjy in PR 10 gemergt): oben `src/components/home/whats-new.tsx` mit Kacheln „Neu seit gestern“ (Bibliothek, Startups, ungelesene Inbox, News; `src/lib/home/whats-new.ts`) und 4 Top-Hits (`loadTopHits` in `src/lib/library/load.ts`, auch von `/produkte` genutzt). Navigation: „Produkte“ = `/produkte`, „Trend Spy“ = `/trend-spy`, beide in „Entdecken“. Produktliste als Zeilen baut der Layout-Thread (PR 11) nach dem Merge.
- Layout Minea-Stil Teil 1 (Branch `claude/project-thread-hrpdjy`, PR offen, keine Migration). Vorlage: Screenshots in Projektdateien `design/minea/`. Eigener Look nach Design-Regeln, keine Minea-Farben/Texte.
  - Sidebar in Gruppen „Entdecken / Recherche / Werkzeuge“ (`src/lib/navigation.ts`, `group`, `match`, `isNavActive`). „Dashboard“ heisst „Start“, Ad Spy öffnet die Anzeigen-Ansicht.
  - Startseite `/`: „Top 10 des Tages“ mit Tagesauswahl (10 Tage, URL `tag`, `ansicht`), Tabs Anzeigen (an dem Tag aktiv gesehen, nach EU-Reichweite), Shops (Shop-Zählung des Tages), Produkte (an dem Tag aufgenommen, Anzeigen über Produkt-Stichwörter). Logik `src/lib/ads/feed.ts` mit Tests.
  - Anzeigen-Karte `src/components/ads/ad-card.tsx` (Werbetreibender mit laufend/bekannt, Laufzeit, Start → heute, Länder, Reichweite, Plattformen, Vorschau, Shop-Domain, „Anzeige analysieren“). Rangliste „Einzelne Anzeigen“ nutzt das Kartenraster, Schnellwahl-Chips inkl. „Grösste EU-Reichweite“.
  - Video/Bild: Meta liefert keine Mediendateien. Vorschau = offizielle Meta-Seite `render_ad` (wie `ad_snapshot_url`) im iframe über `/api/ads/[id]/vorschau` (nur für Besitzer, leitet mit Token weiter). **Entscheidung geändert:** Das Token erscheint dabei im Browser des Besitzers. Nicht mit echtem Token getestet; ob Meta die Einbettung erlaubt, ist offen. Fallback-Link zur Ad Library.
  - Anzeigen-Detail `/ad-spy/anzeige/[id]`: grosse Vorschau, Fakten, Stichwörter, Shop-Info (aktive EU-Anzeigen aus Shop-Zählung, bekannte Anzeigen, Summe EU-Reichweite, älteste bekannte Anzeige, Ausgaben „nicht verfügbar“), „Shop verfolgen“, Tabs „Anzeigen dieses Shops“ / „Ähnliche Anzeigen anderer Shops“ (gleiches Stichwort).
  - TikTok-Tab `/ad-spy/tiktok`: ehrlich „nicht verfügbar“ (Commercial Content API nur Forschung/EU), Link zur offiziellen Bibliothek.
  - Repo design-system-extractor nicht genutzt: zieht Farben/Schriften einer Seite; Minea-Look soll nicht übernommen werden und die App braucht Login.
  - Nicht machbar ohne Erfinden: CTA-Text, Ziel-URL, Ausgaben, Seiten-Erstelldatum, Umsatz, Besucherzahlen, Produktbilder aus Anzeigen.
- Layout Minea-Stil Teil 2 (gleicher Branch/PR #11):
  - `FilterBar` hat `groups` (aufklappbares Panel „Weitere Filter“ in Gruppen, offen wenn ein Gruppenfilter aktiv ist). Neu `src/components/ui/quick-chips.tsx` (Schnellfilter-Chips). Rangliste und Shop Spy nutzen beides.
  - Live-Suche zeigt gespeicherte Treffer als Anzeigen-Karten (`AdLookup.ids` = Meta-ID → interne ID), nicht gespeicherte als Zeile.
  - Shop Spy: Tabelle ersetzt durch `src/components/shops/shop-row.tsx` (Verlaufslinie 60 Tage über `src/lib/sparkline.ts`, Kennzahlen). `src/lib/shops/list-href.ts` für Chips.
  - `src/components/library/product-row.tsx`: Produktzeile (Bild | Titel, Datum, Einkaufspreis, Link | Lieferant: von Shops übernommen, Gratisversand, Video | Anzeigen). Startseite-Tab Produkte nutzt sie. **Abgesprochen mit Produkte-Thread (PR #10):** Darstellung der Produktliste gehört diesem Thread; `/produkte` wird erst nach Merge von #10 auf Zeilen umgestellt. Reihenfolge: PR #11 vor PR #10 mergen (PR #10 enthält #11 bereits).
  - Navigation: Trend Spy heisst wieder „Trend Spy“; „Produkte“ ist `/produkte` aus PR #10.
- Layout Minea-Stil Teil 3 (Branch `claude/project-thread-hrpdjy`, keine Migration, enthält den Plattform-Stand von PR #15):
  - Neu `src/components/layout/browse-header.tsx` (Icon, Titel mit Akzentwort, Untertitel, Aktion) auf Produkte, Anzeigen (Live/Rangliste/TikTok) und Shop Spy.
  - Neu `src/components/ui/filter-panel.tsx`: Filter in Gruppen-Spalten, jede Auswahl als Popover-Liste aus Links (nur eine offen, Klick daneben/Escape schliesst). Ersetzt `FilterBar` auf `/produkte` und der Rangliste.
  - `QuickChips` als Pillen mit farbigem Punkt (`var(--chart-n)`).
  - `/produkte`: oben grosse Suche = Live-Suche bei den Plattformen (Begriff + Plattform-Auswahl, darunter Lager und „täglich“), Top-Hits als Karussell nur ohne Suche, Schnellfilter, Filterpanel mit Gruppe „Herkunft“ (Plattform), Produktzeilen. Ohne verbundene Plattform: grosse Suche filtert die gespeicherten Produkte (`filter`).
  - `product-row.tsx`: Plattform-Logo + „von {Plattform}“ verlinkt, Beliebtheit je Plattform (`popularity`/`popularityHint` aus `librarySource`), Merken-Knopf unten rechts.
  - Design-Regeln in `CLAUDE.md` angepasst (font-semibold für Seitentitel/Produkttitel/Preise, rounded-xl Zeilen, Pillen nur für Schnellfilter, Nutzer bestätigt Indigo).
- Quellen geprüft 26.11.2026: Kickstarter/Indiegogo ohne offene API (nur Links). SHAB-API (amtsblattportal.ch, Neueintragungen HR01) existiert, Doku per robots gesperrt und kein Netz in der Sandbox → nicht gebaut, erst mit echtem Test.
- Recherche 26.11.2026: Reddit API braucht Freigabe (neue Zugänge laut Sekundärquellen seit 31.10.2026 zu), daher nicht gebaut. Shopify `/products.json` ist keine offizielle API (Shopify-Mitarbeiter: wollen es einschränken), daher nicht gebaut. Product Hunt v2: Developer Token, nicht kommerziell, 6250 Komplexitätspunkte/15 min.

- Mehrere Plattformen in der Bibliothek (Branch `claude/project-thread-ybhadj`, PR #14, keine Migration):
  - `src/lib/library/sources.ts`: `LIBRARY_SOURCES` (cj, aliexpress) mit Name, Beliebtheits-Text, gemeinsame Typen `SupplierProduct`/`SupplierPage`/`SupplierError` (CjError und AeError erben davon).
  - `supplier_products.platform` + `currency` pro Produkt. **Entscheidung:** `listed_count` = Beliebtheit laut Plattform (CJ: Übernahmen durch Shops, AliExpress: `lastest_volume` = Verkäufe der letzten Zeit), Texte je Plattform (`librarySource(p).popularity`). Spart eine Migration.
  - AliExpress Affiliate API `src/lib/library/aliexpress.ts`: `aliexpress.affiliate.product.query` über `https://api-sg.aliexpress.com/sync`, HMAC-SHA256-Signatur (Grossbuchstaben), Antwort `aliexpress_affiliate_product_query_response.resp_result.result.products(.product)[]`, 405 = keine Treffer. Aus Erinnerung und inoffiziellen SDKs, offizielle Doku nicht abrufbar; **mit echten Schlüsseln prüfen** (evtl. sign_method md5 nötig). Env `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`, `ALIEXPRESS_TRACKING_ID`, `ALIEXPRESS_DAILY_LIMIT` (300). Produkt-URL = öffentliche Seite `aliexpress.com/item/{id}.html`, kein Partnerlink.
  - Suche `/produkte`: Feld `plattform` ("" = alle verbundenen); Filter URL-Parameter `plattform` (`LIBRARY_PLATFORMS`). Täglicher Lauf fragt Begriffe bei jeder verbundenen Plattform ab; Limit/Zugangsfehler stoppt nur diese Plattform.
  - Nutzer hat den AliExpress-Antrag am 26.11.2026 gestellt (Anleitung `anleitungen/aliexpress-api-antrag.md`).
  - Aufteilung mit Layout-Thread: Daten/Logik hier, Darstellung (product-row, product-card, filter-bar, Markup von `/produkte`) dort.
- Weitere Quellen geprüft 26.11.2026: eBay Browse API (kostenlos, offiziell) wäre als Verkaufspreis-Vergleich möglich, nicht als Lieferant. Spocket, Zendrop, AutoDS: keine öffentliche Produkt-API. Temu, Alibaba, DHgate: keine offene Such-API, bleiben Links.

- Thread „Ad Spy und Google Trends lebendiger machen“ (27.11.2026, Branch `claude/project-thread-s833hs`). Auftrag: Seite wirkt „trocken, ohne Gefühl“; Ziel Minea-Gefühl (grosse Bilder/Videos, Kennzahlen, Kurven, Mini-Verläufe, Einschätzungen), clean, Indigo. AliExpress zurückgestellt (Konto wird später eröffnet). Plan in kleinen PRs: (1) Google Trends, (2) Ad Spy, (3) Shop/Startup Spy, (4) Future Radar automatisch.
  - PR 1 Google Trends: `src/lib/trends/insights.ts` (+Tests): zweite DataForSEO-Aufgabe nur für den ersten Begriff mit `google_trends_map`, `google_trends_queries_list`, `google_trends_topics_list` (Doku: Listen nur mit 1 Begriff). Werte können Text sein („Breakout“ → null → „Durchbruch“). Feldnamen aus der Doku-Tabelle, **kein Beispiel-JSON in der Doku, mit echtem Konto prüfen**. Zwischenspeicher in `trend_series` mit `time_range = "insights:<zeitraum>"` (keine Migration), gleiches Tageslimit (zählt Aufgaben). `trendVerdict`: letztes vs. erstes Viertel, ±15 %/±50 % → steigt stark/steigt/stabil/fällt/fällt stark. `getRecentTrends` → Karten „Zuletzt abgefragt“. Neu `src/components/ui/sparkline.tsx`, `src/components/trends/insights.tsx` (KeywordStat, RelatedList, RegionList). Seite `/google-trends` mit BrowseHeader, grosser Suche, Zeitraum-Chips.
  - Kosten: DataForSEO 0.011 USD pro Live-Aufgabe, Suche = 2 Aufgaben; 1 USD Startguthaben, Mindesteinzahlung 50 USD. Niklas wählte am 27.11. „erst gratis testen“.
  - Teil 2 Ad Spy (gleicher Branch/PR #18, nur ein Branch erlaubt): `src/lib/ads/verdict.ts` (+Tests) `adSignals` (laufend: ≤7 T „neu“, ≥30 T „bewährt“, ≥90 T „Dauerläufer“; ≥10 laufende Anzeigen der Seite „Shop skaliert“) als Badges in `ad-card.tsx`; `summarizeAds` → Kennzahl-Kacheln (`src/components/ui/stat-tile.tsx`) über den Live-Treffern in `/ad-spy`. Ehrlich: Karten-Layout war schon Minea-nah; lebendig wird Ad Spy erst mit Meta-Token und funktionierender Vorschau (render_ad im iframe, ungetestet).
  - Meta-Token: von hier nicht prüfbar (kein Vercel-Zugang); Niklas prüft auf `/sammler` („META_ACCESS_TOKEN fehlt“).

## Wunsch-Checkliste (Abgleich 27.11.2026)
Vollständige Liste aller Wünsche von Niklas mit Status: `docs/wunsch-checkliste.md`. **Jeder Thread trägt neue Wünsche dort ein und prüft die Liste vor „fertig“.**

Offen (❌ fehlt, 🟡 teilweise), Reihenfolge = Empfehlung:
1. ❌ KI-Analyse und Bewertung auf der Produkt-Detailseite (`analysis-section.tsx`/`rating-section.tsx` lesen `assessments`, nichts schreibt hinein).
2. ❌ Kategorie-Filter und „steigend/fallend“ auf `/produkte` (`supplier_products.category` existiert, `LibraryFilters` hat kein Feld); ❌ Land-Filter im Trend Spy.
3. 🟡 Globale Suche `/suche` sucht nur `items` per `find_similar_items`; Bibliothek, Anzeigen, Shops, News, Google Trends fehlen.
4. ❌ Google Trends nur `google_trends_graph`; verwandte/steigende Begriffe und Regionen fehlen; kein automatischer Lauf für „stark steigende Suchanfragen“.
5. ❌ Produkte vergleichen (auch Merkliste).
6. 🟡 Future Radar nur mit eigenen Themen und Regeln; automatische Themen und KI-Einschätzung fehlen.
7. ❌ Produkt-Detailseite und Rechner im Minea-Stil; ❌ KI-Kurzfassung News; ❌ SHAB-Neueintragungen; 🟡 Lieferdaten pro Plattform (Versand, Lieferzeit, MOQ) nur manuell.
- Nicht machbar (mit Grund in der Liste): TikTok-Anzeigen, Kickstarter/Indiegogo, Alibaba/DHgate/Temu/Spocket-APIs, echte Verkaufszahlen, CTA/Ausgaben/Umsatz aus Meta, ganzer AliExpress-Katalog, Minea-Code kopieren.
- Ehrlich festgehalten: „Suche über AliExpress und andere“ war ab 26.11. 13:40 gewünscht; PR #10 baute nur CJ ohne Herkunft, Herkunft + Plattform-Filter kamen erst mit PR #15/#16.

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
- Nutzer (PR Phase 6a): Migration 0008 vor dem Merge ausführen; CJ-Konto + `CJ_API_KEY`; optional `ANTHROPIC_API_KEY` (Kosten zugestimmt, Key fehlt). Seite `/produkte` nur mit Testdaten-Vorschau geprüft (hell/dunkel/390 px), nicht mit echter Supabase.
- Bibliothek: Produkte, die aus den Top-50 eines Begriffs fallen, bekommen keinen neuen Messpunkt (Wachstum nur für Produkte, die täglich wieder gefunden werden). AliExpress erst nach API-Freigabe.
- Nutzer (PR Phase 5a): Migration 0007 vor dem Merge ausführen. Startup Spy füllt sich erst mit Anzeigen-Stichwörtern + Meta-Token (oder Product-Hunt-Token); Future Radar braucht News-Feeds und eigene Themen. Seiten nicht im Browser geprüft (kein Supabase in der Sandbox).
- Design: Ad-Spy-Rangliste nutzt `FilterBar`, Live-Suche `inputClass`. Produktseite und Rechner später feiner überarbeiten. Neue Seiten (News, Inbox, Sammler, Rangliste) nicht im Browser geprüft (ohne Supabase-Zugang in der Sandbox nicht renderbar).
- Nutzer (PR Phase 4): Migrationen 0004, 0005, 0006 ausführen; optional `PRODUCTHUNT_TOKEN`; Stichwörter unter „Datensammler“ und News-Feeds unter „Daily News“ eintragen.
- Nutzer: Migration 0003 ausführen (falls noch nicht), `CRON_SECRET` und `SUPABASE_SERVICE_ROLE_KEY` in Vercel setzen (README „Shop Spy“). Meta-Token einrichten (README „Meta Ad Spy“), DataForSEO-Konto eröffnen (README „Google Trends“). Supabase und Vercel sind laut Nutzer eingerichtet (26.11.2026); prüfen, ob Migrationen 0001 und 0002 gelaufen sind.
- Meta: Zugangsschritte (Identitätsbestätigung, App, Token) nicht gegen die offizielle Seite geprüft (facebook.com/ads/library/api blockiert automatischen Abruf). Paging (`paging.cursors.after`, `limit`) nach Graph-API-Standard, mit echtem Token testen.
- Shop Spy: `search_page_ids` ohne `search_terms` und mehrere Länder in `ad_reached_countries` laut Doku zulässig, aber noch nicht mit echtem Token getestet. Hobby-Plan: Funktion max. 300 s, darum max. 40 Shops pro Lauf.
- Konten mit Kosten erst nach Zustimmung: Anthropic API, CJdropshipping. Meta-API ist kostenlos.

## Nächster Schritt
PRs #10–#17 sind gemergt. Thread „lebendiger machen“: nach PR 1 (Google Trends) folgt PR 2 Ad Spy (grössere Karten, Kennzahlen, Vorschau). Danach Punkte 1–6 der Wunsch-Checkliste (oben), erst nach Freigabe durch Niklas. Parallel mit echten Schlüsseln prüfen: CJ (läuft), AliExpress (wartet auf App-Freigabe), Meta-Vorschau, DataForSEO, Anthropic.
