import { describe, expect, it } from "vitest";
import { extractTopics, normalizeTopic, titlePhrases } from "./extract";

const p = (id: string, title: string, category: string | null = null, listedCount = 10) => ({ id, title, category, listedCount, imageUrl: `https://img/${id}.jpg` });

describe("normalizeTopic", () => {
  it("macht Einzahl und entfernt Sonderzeichen", () => {
    expect(normalizeTopic("Neck Fans")).toBe("neck fan");
    expect(normalizeTopic("Pet Supplies")).toBe("pet supply");
    expect(normalizeTopic("Phone Cases")).toBe("phone case");
    expect(normalizeTopic("Glasses")).toBe("glass");
    expect(normalizeTopic("Hair-Brush!")).toBe("hair brush");
  });
});

describe("titlePhrases", () => {
  it("ignoriert Füllwörter, Zahlen und Eigenschaftswörter am Ende", () => {
    const out = titlePhrases("2024 New Portable Neck Fan USB Rechargeable");
    expect(out).toContain("neck fan");
    expect(out).toContain("portable neck fan");
    expect(out).not.toContain("fan usb");
    expect(out).not.toContain("usb rechargeable");
    expect(out.some((x) => x.includes("new"))).toBe(false);
  });
});

describe("extractTopics", () => {
  it("braucht mindestens drei verschiedene Produkte", () => {
    const res = extractTopics([p("1", "Neck Fan Bladeless"), p("2", "Hanging Neck Fan"), p("3", "Dog Bed")]);
    expect(res).toEqual([]);
  });

  it("findet wiederkehrende Wortpaare und Kategorien, zählt jedes Produkt einmal", () => {
    const res = extractTopics([
      p("1", "Neck Fan Bladeless Neck Fan", "Fans", 5),
      p("2", "Hanging Neck Fan", "Fans", 7),
      p("3", "Mini Neck Fan Portable", "Fans", 8),
      p("4", "Dog Bed Washable", "Pet Beds"),
    ]);
    const fan = res.find((t) => t.normalized === "neck fan");
    expect(fan?.productIds).toHaveLength(3);
    expect(fan?.listedSum).toBe(20);
    expect(fan?.kind).toBe("product");
    expect(fan?.category).toBe("Fans");
    const niche = res.find((t) => t.kind === "niche");
    expect(niche?.name).toBe("Fans");
    expect(res.some((t) => t.normalized.includes("dog"))).toBe(false);
  });

  it("bevorzugt ein fast gleich häufiges Tripel", () => {
    const res = extractTopics([p("1", "Pet Hair Remover"), p("2", "Pet Hair Remover Roller"), p("3", "Reusable Pet Hair Remover")]);
    const names = res.map((t) => t.normalized);
    expect(names).toContain("pet hair remover");
    expect(names).not.toContain("hair remover");
  });
});
