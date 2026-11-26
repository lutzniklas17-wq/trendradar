import { describe, expect, it } from "vitest";
import { assessTopic, changeLabel, parseTopic, type TopicStats } from "@/lib/radar/assess";

const now = new Date("2026-11-26T12:00:00Z");
const s = (over: Partial<TopicStats> = {}): TopicStats => ({
  topic_id: "t",
  term: "Pilzkaffee",
  note: null,
  created_at: "2026-11-01T00:00:00Z",
  news_7d: 0,
  news_prev_7d: 0,
  items_30d: 0,
  ads_active: 0,
  ads_new_7d: 0,
  ads_new_prev_7d: 0,
  has_ad_term: false,
  news_since: "2026-10-27T00:00:00Z",
  ...over,
});

describe("assessTopic", () => {
  it("gibt ohne genug Treffer keine Einschätzung", () => {
    expect(assessTopic(s({ news_7d: 1, news_prev_7d: 1 }), now).outlook).toBe("too_little");
  });

  it("braucht zwei Wochen Verlauf für einen Vergleich", () => {
    const r = assessTopic(s({ news_7d: 8, news_prev_7d: 2, news_since: "2026-11-20T00:00:00Z" }), now);
    expect(r.outlook).toBe("too_little");
    expect(r.reason).toContain("6 Tage");
  });

  it("erkennt neu, steigend, rückläufig und stabil", () => {
    expect(assessTopic(s({ news_7d: 2, ads_new_7d: 2 }), now).outlook).toBe("emerging");
    expect(assessTopic(s({ news_7d: 7, news_prev_7d: 3 }), now).outlook).toBe("rising");
    expect(assessTopic(s({ news_7d: 1, news_prev_7d: 6 }), now).outlook).toBe("falling");
    expect(assessTopic(s({ news_7d: 4, news_prev_7d: 3 }), now).outlook).toBe("stable");
  });
});

describe("Hilfen", () => {
  it("changeLabel zeigt die Richtung", () => {
    expect(changeLabel(5, 2)).toBe("+3 ggü. Vorwoche");
    expect(changeLabel(1, 3)).toBe("−2 ggü. Vorwoche");
    expect(changeLabel(2, 2)).toBe("±0 ggü. Vorwoche");
  });

  it("parseTopic prüft die Länge", () => {
    expect(parseTopic("  Pilz   kaffee ")).toBe("Pilz kaffee");
    expect(parseTopic("x")).toBeNull();
  });
});
