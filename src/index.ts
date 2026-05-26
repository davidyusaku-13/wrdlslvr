import { handleSolveRequest } from "./solve_handler.ts";

export interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env, _ctx: unknown): Promise<Response> {
    const url = new URL(request.url);

    // Delegate API and CORS preflight requests to the shared handler
    if (url.pathname === "/api/solve" || request.method === "OPTIONS") {
      return handleSolveRequest(request);
    }

    // Fallback: Serve static assets mapped in wrangler.toml
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};
