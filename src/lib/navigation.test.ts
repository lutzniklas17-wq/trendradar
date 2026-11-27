import { describe, expect, it } from "vitest";
import { isNavActive, matchesNav, NAV_GROUPS, NAV_ITEMS } from "./navigation";

describe("isNavActive", () => {
  it("Start ist nur auf / aktiv", () => {
    expect(isNavActive("/", { href: "/" })).toBe(true);
    expect(isNavActive("/produkte", { href: "/" })).toBe(false);
  });
  it("Bereich mit match deckt Unterseiten ab", () => {
    const ads = { href: "/ad-spy/rangliste", match: "/ad-spy" };
    expect(isNavActive("/ad-spy", ads)).toBe(true);
    expect(isNavActive("/ad-spy/anzeige/1", ads)).toBe(true);
    expect(isNavActive("/ad-spyx", ads)).toBe(false);
  });
});

describe("matchesNav", () => {
  const item = { label: "Shops", description: "Aktive Anzeigen pro Shop und Verlauf" };
  it("leerer Begriff passt immer", () => expect(matchesNav(item, "  ")).toBe(true));
  it("sucht in Name und Beschreibung, ohne Gross-/Kleinschreibung", () => {
    expect(matchesNav(item, "SHO")).toBe(true);
    expect(matchesNav(item, "verlauf")).toBe(true);
    expect(matchesNav(item, "trends")).toBe(false);
  });
});

describe("NAV_ITEMS", () => {
  it("jeder Eintrag gehört zu einer bekannten Gruppe und hat eine eindeutige Adresse", () => {
    for (const i of NAV_ITEMS) expect(NAV_GROUPS).toContain(i.group);
    expect(new Set(NAV_ITEMS.map((i) => i.href)).size).toBe(NAV_ITEMS.length);
  });
});
