import { describe, expect, it } from "vitest";
import { suggestTopics, terms, tokenize } from "./suggest";

const now = new Date("2026-11-27T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe("tokenize/terms", () => {
  it("entfernt Füllwörter, Zahlen und Satzzeichen", () => {
    expect(tokenize("Die neue Pilzkaffee-Marke startet 2026 in der Schweiz!")).toEqual(["pilzkaffee-marke", "startet", "schweiz"]);
  });
  it("bildet Wortpaare und zählt jedes nur einmal pro Titel", () => {
    expect(terms("mushroom coffee mushroom coffee")).toEqual(["mushroom", "coffee", "mushroom coffee", "coffee mushroom"]);
  });
});

describe("suggestTopics", () => {
  it("schlägt Wortpaare vor, die diese Woche stark zunehmen", () => {
    const entries = [
      { title: "Mushroom coffee brand raises seed", date: ago(1) },
      { title: "Why mushroom coffee is everywhere", date: ago(2) },
      { title: "New mushroom coffee pods", date: ago(3) },
      { title: "Collagen gummies for pets", date: ago(9) },
    ];
    const s = suggestTopics({ entries, rising: [], existing: [] }, now);
    expect(s[0]).toMatchObject({ term: "mushroom coffee", source: "entries" });
    expect(s[0].reason).toContain("Vorwoche nie");
    // Einzelwörter des Paars werden nicht zusätzlich vorgeschlagen.
    expect(s.map((x) => x.term)).not.toContain("mushroom");
  });
  it("ignoriert Begriffe, die nicht zunehmen oder zu selten sind", () => {
    const entries = [
      ...[1, 2, 3].map((d) => ({ title: "posture corrector", date: ago(d) })),
      ...[8, 9, 10].map((d) => ({ title: "posture corrector", date: ago(d) })),
      { title: "ice bath", date: ago(1) },
    ];
    expect(suggestTopics({ entries, rising: [], existing: [] }, now)).toEqual([]);
  });
  it("nimmt steigende Google-Suchanfragen ab +100 % und Durchbrüche", () => {
    const rising = [
      { label: "Red Light Mask", value: 250, keyword: "led maske", fetchedAt: ago(1) },
      { label: "led maske test", value: 40, keyword: "led maske", fetchedAt: ago(1) },
      { label: "led maske kaufen", value: null, keyword: "led maske", fetchedAt: ago(1) },
    ];
    const s = suggestTopics({ entries: [], rising, existing: [] }, now);
    expect(s.map((x) => x.term)).toEqual(["led maske kaufen", "red light mask"]);
    expect(s[0].reason).toContain("Durchbruch");
  });
  it("lässt beobachtete Themen weg (ganze Wörter)", () => {
    const rising = [
      { label: "pilzkaffee kaufen", value: 300, keyword: "x", fetchedAt: ago(1) },
      { label: "ledermaske", value: 300, keyword: "x", fetchedAt: ago(1) },
    ];
    const s = suggestTopics({ entries: [], rising, existing: ["Pilzkaffee", "led"] }, now);
    expect(s.map((x) => x.term)).toEqual(["ledermaske"]);
  });
});
