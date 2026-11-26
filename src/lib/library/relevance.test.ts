import { describe, expect, it } from "vitest";
import { classifyProduct } from "./relevance";

const img = "https://x/a.jpg";

describe("classifyProduct", () => {
  it.each([
    ["Natural Raw Stone Gravel for Aquarium", "irrelevant"],
    ["Replacement Parts for Xiaomi Vacuum", "irrelevant"],
    ["10pcs Capacitor 100uF", "irrelevant"],
    ["Deep Groove Bearing 6202", "irrelevant"],
    ["Stainless Steel Screws M3 Set", "irrelevant"],
  ])("schliesst „%s“ aus", (title, expected) => {
    expect(classifyProduct({ title, imageUrl: img, price: 3 }).relevance).toBe(expected);
  });

  it.each(["Rose Quartz Gua Sha Stone", "Rhinestone Phone Case", "Pizza Stone for Oven", "Natural Stone Bracelet", "Smart Store Organizer", "Portable Neck Fan"])(
    "lässt „%s“ durch",
    (title) => {
      expect(classifyProduct({ title, imageUrl: img, price: 5 }).relevance).toBe("relevant");
    },
  );

  it("schliesst Teile-Kategorien aus und nennt den Grund", () => {
    const r = classifyProduct({ title: "Sensor", categoryPath: "Electronics / Electronic Components / Sensors", imageUrl: img, price: 2 });
    expect(r.relevance).toBe("irrelevant");
    expect(r.reason).toContain("Kategorie");
  });

  it("markiert fehlendes Bild und Kleinstpreise als unklar", () => {
    expect(classifyProduct({ title: "LED Lamp", imageUrl: null, price: 5 }).relevance).toBe("unclear");
    expect(classifyProduct({ title: "Hair Clip", imageUrl: img, price: 0.2 }).relevance).toBe("unclear");
  });
});
