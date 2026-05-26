import { getRecommendations } from "./solver.ts";
import type { Guess } from "./solver.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const JSON_HEADERS = {
  "Content-Type": "application/json",
  ...CORS_HEADERS,
};

// In-memory result cache (lives for duration of Worker isolate).
// Caches results for rapid tile toggling within a session.
const resultCache = new Map<string, { result: unknown; timestamp: number }>();
const CACHE_TTL_MS = 5_000;
const MAX_CACHE = 100;

function getCacheKey(guesses: Guess[]): string {
  // Fast: only serialize word+feedback pairs
  let key = "";
  for (const g of guesses) {
    key += g.word + g.feedback;
  }
  return key;
}

/**
 * Shared handler for /api/solve requests.
 * Used by both the Bun dev server and the Cloudflare Worker.
 */
export async function handleSolveRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  if (url.pathname !== "/api/solve" || request.method !== "POST") {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const body = (await request.json()) as { guesses?: Guess[] };
    const guesses = body.guesses ?? [];

    // Check cache
    const cacheKey = getCacheKey(guesses);
    const cached = resultCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return new Response(JSON.stringify(cached.result), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    const result = getRecommendations(guesses, 30);

    // Store in cache
    resultCache.set(cacheKey, { result, timestamp: Date.now() });
    if (resultCache.size > MAX_CACHE) {
      // Evict a single stale entry (lazy eviction)
      const oldest = resultCache.entries().next().value;
      if (oldest) resultCache.delete(oldest[0]);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }
}
