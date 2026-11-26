import { describe, expect, it } from "vitest";
import { cleanText, matchesKeywords, parseFeed, parseKeywords } from "./rss";

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Shop News</title>
<item><title><![CDATA[Neue <b>LED-Maske</b> &amp; mehr]]></title><link>https://example.com/a</link>
<pubDate>Tue, 24 Nov 2026 08:00:00 GMT</pubDate><description>&lt;p&gt;Gadget &#8211; Launch&lt;/p&gt;</description></item>
<item><title>Ohne Link</title></item>
<item><title>Böser Link</title><link>javascript:alert(1)</link></item>
</channel></rss>`;

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Hundebett Launch</title>
<link rel="self" href="https://example.com/self"/><link rel="alternate" href="https://example.com/b"/>
<updated>2026-11-25T10:00:00Z</updated><summary>Neues Haustier-Produkt</summary></entry></feed>`;

describe("parseFeed", () => {
  it("liest RSS 2.0, entfernt HTML und überspringt Einträge ohne gültigen Link", () => {
    const entries = parseFeed(RSS);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      title: "Neue LED-Maske & mehr",
      link: "https://example.com/a",
      publishedAt: "2026-11-24T08:00:00.000Z",
      summary: "Gadget – Launch",
    });
  });

  it("liest Atom und nimmt den alternate-Link", () => {
    const [e] = parseFeed(ATOM);
    expect(e.link).toBe("https://example.com/b");
    expect(e.publishedAt).toBe("2026-11-25T10:00:00.000Z");
    expect(e.summary).toBe("Neues Haustier-Produkt");
  });
});

describe("Stichwörter", () => {
  it("ohne Stichwörter passt alles, sonst Titel oder Zusammenfassung", () => {
    const e = { title: "Hundebett Launch", link: "https://x.ch", publishedAt: null, summary: "für Haustiere" };
    expect(matchesKeywords(e, [])).toBe(true);
    expect(matchesKeywords(e, ["haustier"])).toBe(true);
    expect(matchesKeywords(e, ["auto"])).toBe(false);
  });

  it("parseKeywords trennt, kürzt und entfernt Duplikate", () => {
    expect(parseKeywords("Launch, gadget\nlaunch, x")).toEqual(["launch", "gadget"]);
  });

  it("cleanText ist robust bei leerem Input", () => {
    expect(cleanText(null)).toBe("");
  });
});
