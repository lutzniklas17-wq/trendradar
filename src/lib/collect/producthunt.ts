import type { Discovery } from "@/lib/collect/discoveries";

// Product Hunt API v2 (GraphQL). Laut Doku: Bearer-Token (Developer Token aus dem API-Dashboard),
// nur lesend, keine kommerzielle Nutzung (private Nutzung ok), Limit 6250 Komplexitätspunkte pro 15 Minuten.
export const PH_ENDPOINT = "https://api.producthunt.com/v2/api/graphql";
export const PH_SOURCE_ID = "product_hunt";
export const PH_PAGE_SIZE = 50;
export const PH_MAX_PAGES = 4;

export type PhPost = {
  id: string;
  name: string;
  tagline: string | null;
  url: string;
  website: string | null;
  votesCount: number | null;
  createdAt: string | null;
  thumbnail: string | null;
  topics: string[];
};

const QUERY = `query Posts($after: String, $postedAfter: DateTime, $first: Int) {
  posts(order: NEWEST, postedAfter: $postedAfter, first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    edges { node {
      id name tagline url website votesCount createdAt
      thumbnail { url }
      topics(first: 10) { edges { node { name } } }
    } }
  }
}`;

/** GraphQL-Anfrage für alle Launches seit postedAfter (neueste zuerst). */
export function buildPostsRequest(postedAfter: Date, after?: string) {
  return { query: QUERY, variables: { postedAfter: postedAfter.toISOString(), first: PH_PAGE_SIZE, after: after ?? null } };
}

export class ProductHuntError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ProductHuntError";
  }
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Liest die GraphQL-Antwort aus. Wirft ProductHuntError bei Fehlern. */
export function parsePostsResponse(json: unknown): { posts: PhPost[]; nextCursor: string | null } {
  const body = (json ?? {}) as { data?: { posts?: unknown }; errors?: unknown };
  if (Array.isArray(body.errors) && body.errors.length) throw new ProductHuntError("Product Hunt hat die Anfrage abgelehnt.");
  const posts = body.data?.posts as
    | { pageInfo?: { hasNextPage?: unknown; endCursor?: unknown }; edges?: { node?: Record<string, unknown> }[] }
    | undefined;
  if (!posts || !Array.isArray(posts.edges)) throw new ProductHuntError("Unerwartete Antwort von Product Hunt.");

  const list: PhPost[] = [];
  for (const edge of posts.edges) {
    const n = edge?.node;
    const id = str(n?.id);
    const name = str(n?.name);
    const url = str(n?.url);
    if (!n || !id || !name || !url) continue;
    const topicEdges = ((n.topics as { edges?: { node?: { name?: unknown } }[] } | undefined)?.edges ?? []);
    list.push({
      id,
      name,
      url,
      tagline: str(n.tagline),
      website: str(n.website),
      votesCount: typeof n.votesCount === "number" ? n.votesCount : null,
      createdAt: str(n.createdAt),
      thumbnail: str((n.thumbnail as { url?: unknown } | undefined)?.url),
      topics: topicEdges.map((t) => str(t?.node?.name)).filter((t): t is string => t !== null),
    });
  }
  const end = str(posts.pageInfo?.endCursor);
  return { posts: list, nextCursor: posts.pageInfo?.hasNextPage === true && end ? end : null };
}

/** Themen, die auf ein physisches Konsumprodukt oder eine D2C-Marke hindeuten. */
const CONSUMER_TOPICS = [
  "hardware", "wearables", "fashion", "apparel", "home", "beauty", "skincare", "pets", "kids", "baby", "parenting",
  "food & drink", "food", "drinks", "outdoors", "sports", "fitness", "health & fitness", "gadgets", "kitchen",
  "shopping", "e-commerce", "jewelry", "accessories", "furniture", "toys", "travel gear", "consumer electronics",
  "smart home", "audio", "camping", "cycling", "sustainability",
];

/** Themen, die klar auf Software hindeuten (nicht verkaufbar als Produkt im Shop). */
const SOFTWARE_TOPICS = [
  "developer tools", "saas", "api", "chrome extensions", "no-code", "artificial intelligence", "productivity",
  "iphone", "android", "mac", "windows", "web app", "github", "open source", "marketing automation", "analytics",
  "crypto", "fintech", "design tools", "browser extensions", "task management",
];

const has = (topics: string[], list: string[]) => topics.some((t) => list.includes(t.toLowerCase()));

/**
 * Faustregel ohne KI: relevant, wenn ein Konsum-Thema vorkommt und kein klares Software-Thema.
 * Product Hunt ist überwiegend Software; physische Produkte sind dort selten. Das ist eine Einschätzung,
 * keine Garantie, und wird später durch die KI-Einstufung ergänzt.
 */
export function isEcommerceRelevant(post: Pick<PhPost, "topics">) {
  return has(post.topics, CONSUMER_TOPICS) && !has(post.topics, SOFTWARE_TOPICS);
}

export function toDiscovery(post: PhPost): Discovery {
  const category = post.topics.find((t) => CONSUMER_TOPICS.includes(t.toLowerCase())) ?? null;
  return {
    name: post.name,
    type: "startup",
    area: "startup_spy",
    sourceId: PH_SOURCE_ID,
    sourceUrl: post.url,
    description: post.tagline,
    category,
    websiteUrl: post.website,
    imageUrl: post.thumbnail,
    signal: post.votesCount !== null ? { metric: "producthunt_votes", value: post.votesCount, unit: "Stimmen" } : null,
  };
}

/** Holt die Launches der letzten Stunden (höchstens PH_MAX_PAGES Seiten). */
export async function fetchRecentPosts(token: string, since: Date, fetchImpl: typeof fetch = fetch) {
  const posts: PhPost[] = [];
  let after: string | undefined;
  for (let page = 0; page < PH_MAX_PAGES; page++) {
    const res = await fetchImpl(PH_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(buildPostsRequest(since, after)),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (res.status === 401) throw new ProductHuntError("Product-Hunt-Token ungültig.", 401);
    if (res.status === 429) throw new ProductHuntError("Product-Hunt-Abfragelimit erreicht.", 429);
    if (!res.ok) throw new ProductHuntError(`Product Hunt antwortet mit HTTP ${res.status}.`, res.status);
    const parsed = parsePostsResponse(await res.json());
    posts.push(...parsed.posts);
    if (!parsed.nextCursor) break;
    after = parsed.nextCursor;
  }
  return posts;
}
