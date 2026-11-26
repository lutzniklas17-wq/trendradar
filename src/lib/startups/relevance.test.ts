import { describe, expect, it } from "vitest";
import { classifyRelevance } from "@/lib/startups/relevance";

describe("classifyRelevance", () => {
  it("schliesst Öl, Finanzen und B2B-Software aus", () => {
    expect(classifyRelevance(["Neue Erdöl-Pipeline in Texas"]).relevance).toBe("excluded");
    expect(classifyRelevance(["Fintech startup raises seed round"]).relevance).toBe("excluded");
    expect(classifyRelevance(["The SaaS for invoices"]).relevance).toBe("excluded");
    expect(classifyRelevance(["Oil & Gas analytics"]).reason).toContain("Öl und Gas");
  });

  it("lässt Pflegeöle und Konsumprodukte durch", () => {
    expect(classifyRelevance(["Bartöl aus der Schweiz", "Neue Kollektion"]).relevance).toBe("ecommerce");
    expect(classifyRelevance(["Skincare brand for sensitive skin"]).relevance).toBe("ecommerce");
    expect(classifyRelevance(["Hundeleine mit Licht", "für Hunde"]).relevance).toBe("ecommerce");
  });

  it("vergleicht kurze Begriffe nur als ganzes Wort", () => {
    // „marke“ darf nicht „Marketing“ treffen, „bank“ nicht „Sitzbank“.
    expect(classifyRelevance(["Marketing-Agentur Zürich"]).relevance).toBe("unclear");
    expect(classifyRelevance(["Sitzbank aus Eiche, jetzt kaufen"]).relevance).toBe("ecommerce");
  });

  it("wertet eine eigene Shop-Domain als Hinweis", () => {
    expect(classifyRelevance(["Muster GmbH"]).relevance).toBe("unclear");
    expect(classifyRelevance(["Muster GmbH"], { hasShopDomain: true }).relevance).toBe("ecommerce");
    expect(classifyRelevance(["Muster Bank"], { hasShopDomain: true }).relevance).toBe("excluded");
  });
});
