import { describe, expect, it } from "vitest";
import { compactChanges, countChanges, shopChange, type Change } from "./inbox";

describe("Inbox", () => {
  it("meldet Shop-Änderungen nur, wenn sie wirklich etwas bedeuten", () => {
    expect(shopChange(null, 10, false)).toBeNull();
    expect(shopChange(10, 10, true)).toBeNull();
    expect(shopChange(10, 11, false)).toBeNull();
    expect(shopChange(10, 11, true)).toBe("changed");
    expect(shopChange(10, 14, false)).toBe("changed");
    expect(shopChange(40, 44, false)).toBeNull();
    expect(shopChange(5, 0, false)).toBe("removed");
  });

  it("kürzt lange Listen und behält Favoriten vorne", () => {
    const many: Change[] = Array.from({ length: 10 }, (_, i) => ({ kind: "added", label: `A${i}` }));
    many.push({ kind: "changed", label: "Fav", favorite: true });
    const out = compactChanges(many, 4);
    expect(out.map((c) => c.label)).toEqual(["Fav", "A0", "A1", "… und 8 weitere Änderungen"]);
  });
});

describe("countChanges", () => {
  it("zählt Änderungen über alle Einträge nach Art", () => {
    const entries = [
      { changes: [{ kind: "added", label: "a" }, { kind: "removed", label: "b" }] as Change[] },
      { changes: [{ kind: "added", label: "c" }] as Change[] },
    ];
    expect(countChanges(entries)).toEqual({ added: 2, changed: 0, removed: 1 });
    expect(countChanges([])).toEqual({ added: 0, changed: 0, removed: 0 });
  });
});
