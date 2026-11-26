import { describe, expect, it } from "vitest";
import { filterNews, NEWS_SUGGESTIONS, splitSource, timeAgo } from "./news";

describe("News", () => {
  it("Vorschläge sind https-Feeds von Google News", () => {
    for (const s of NEWS_SUGGESTIONS) expect(s.url.startsWith("https://news.google.com/rss/search?q=")).toBe(true);
  });

  it("timeAgo", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    expect(timeAgo("2026-11-26T11:30:00Z", now)).toBe("vor 30 Min.");
    expect(timeAgo("2026-11-26T09:00:00Z", now)).toBe("vor 3 Std.");
    expect(timeAgo("2026-11-25T10:00:00Z", now)).toBe("gestern");
    expect(timeAgo(null, now)).toBe("");
  });

  it("splitSource trennt die Quelle vom Titel", () => {
    expect(splitSource("Teenager gründet Onlineshop - Blick")).toEqual({ title: "Teenager gründet Onlineshop", source: "Blick" });
    expect(splitSource("Ohne Quelle")).toEqual({ title: "Ohne Quelle", source: null });
  });
});

describe("filterNews", () => {
  const a = (title: string, date: string, source_name = "Feed A") => ({ title, excerpt: null, publisher: "Blick", source_name, date });
  it("filtert nach Text, Feed und Zeitraum", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    const list = [a("Onlineshop Rekord", "2026-11-26T08:00:00Z"), a("Alt", "2026-11-20T08:00:00Z"), a("Anderer Feed", "2026-11-26T08:00:00Z", "Feed B")];
    expect(filterNews(list, { text: "rekord", source: "", days: 0 }, now)).toHaveLength(1);
    expect(filterNews(list, { text: "", source: "", days: 1 }, now)).toHaveLength(2);
    expect(filterNews(list, { text: "", source: "Feed B", days: 0 }, now).map((x) => x.title)).toEqual(["Anderer Feed"]);
  });
});
