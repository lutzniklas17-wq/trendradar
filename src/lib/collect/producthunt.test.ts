import { describe, expect, it, vi } from "vitest";
import { buildPostsRequest, fetchRecentPosts, isEcommerceRelevant, parsePostsResponse, toDiscovery } from "./producthunt";

const node = (id: string, topics: string[], extra: Record<string, unknown> = {}) => ({
  node: {
    id,
    name: `Produkt ${id}`,
    tagline: "Kurzbeschrieb",
    url: `https://www.producthunt.com/posts/p-${id}`,
    website: "https://www.producthunt.com/r/abc",
    votesCount: 42,
    createdAt: "2026-11-25T08:00:00Z",
    thumbnail: { url: "https://ph-files.imgix.net/x.png" },
    topics: { edges: topics.map((name) => ({ node: { name } })) },
    ...extra,
  },
});

const page = (edges: unknown[], endCursor: string | null) => ({
  data: { posts: { pageInfo: { hasNextPage: Boolean(endCursor), endCursor }, edges } },
});

describe("Product Hunt", () => {
  it("baut die Anfrage mit Datum und Cursor", () => {
    const req = buildPostsRequest(new Date("2026-11-25T00:00:00Z"), "abc");
    expect(req.variables).toEqual({ postedAfter: "2026-11-25T00:00:00.000Z", first: 50, after: "abc" });
    expect(req.query).toContain("order: NEWEST");
  });

  it("liest Posts und Cursor aus", () => {
    const res = parsePostsResponse(page([node("1", ["Hardware"]), { node: { id: "2" } }], "c1"));
    expect(res.posts).toHaveLength(1);
    expect(res.posts[0]).toMatchObject({ id: "1", votesCount: 42, topics: ["Hardware"], thumbnail: "https://ph-files.imgix.net/x.png" });
    expect(res.nextCursor).toBe("c1");
  });

  it("wirft bei GraphQL-Fehlern", () => {
    expect(() => parsePostsResponse({ errors: [{ message: "x" }] })).toThrow(/abgelehnt/);
  });

  it("filtert auf Konsumprodukte ohne Software-Themen", () => {
    expect(isEcommerceRelevant({ topics: ["Hardware", "Health & Fitness"] })).toBe(true);
    expect(isEcommerceRelevant({ topics: ["E-Commerce", "SaaS"] })).toBe(false);
    expect(isEcommerceRelevant({ topics: ["Developer Tools"] })).toBe(false);
    expect(isEcommerceRelevant({ topics: [] })).toBe(false);
  });

  it("macht eine Entdeckung mit Quelle und Stimmen als Signal", () => {
    const [post] = parsePostsResponse(page([node("1", ["Pets"])], null)).posts;
    expect(toDiscovery(post)).toMatchObject({
      area: "startup_spy",
      sourceId: "product_hunt",
      sourceUrl: "https://www.producthunt.com/posts/p-1",
      category: "Pets",
      signal: { metric: "producthunt_votes", value: 42 },
    });
  });

  it("folgt dem Cursor und sendet das Token nur im Header", async () => {
    const bodies = [page([node("1", ["Home"])], "c1"), page([node("2", ["Home"])], null)];
    const f = vi.fn(async () => new Response(JSON.stringify(bodies.shift()))) as unknown as typeof fetch;
    const posts = await fetchRecentPosts("TOKEN", new Date(), f);
    expect(posts.map((p) => p.id)).toEqual(["1", "2"]);
    const calls = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    expect((calls[0][1].headers as Record<string, string>).Authorization).toBe("Bearer TOKEN");
    expect(String(calls[1][1].body)).toContain('"after":"c1"');
  });

  it("meldet ein ungültiges Token", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
    await expect(fetchRecentPosts("x", new Date(), f)).rejects.toThrow(/Token/);
  });
});
