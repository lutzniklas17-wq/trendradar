import { describe, expect, it } from "vitest";
import { sourceState } from "./source-status";

const now = new Date("2026-11-27T10:00:00Z");

describe("sourceState", () => {
  it("nicht verbunden geht vor", () => {
    expect(sourceState({ last_success_at: "2026-11-27T09:00:00Z", last_error_at: null }, false, now)).toBe("off");
  });
  it("noch nie gelaufen", () => {
    expect(sourceState(null, true, now)).toBe("never");
    expect(sourceState({ last_success_at: null, last_error_at: null }, true, now)).toBe("never");
  });
  it("Fehler nur, wenn neuer als der letzte Erfolg", () => {
    expect(sourceState({ last_success_at: "2026-11-27T09:00:00Z", last_error_at: "2026-11-27T08:00:00Z" }, true, now)).toBe("ok");
    expect(sourceState({ last_success_at: "2026-11-27T08:00:00Z", last_error_at: "2026-11-27T09:00:00Z" }, true, now)).toBe("error");
    expect(sourceState({ last_success_at: null, last_error_at: "2026-11-27T09:00:00Z" }, true, now)).toBe("error");
  });
  it("veraltet nach 48 Stunden", () => {
    expect(sourceState({ last_success_at: "2026-11-25T09:00:00Z", last_error_at: null }, true, now)).toBe("stale");
    expect(sourceState({ last_success_at: "2026-11-26T09:00:00Z", last_error_at: null }, true, now)).toBe("ok");
  });
});
