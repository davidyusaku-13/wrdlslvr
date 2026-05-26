import { handleSolveRequest } from "./solve_handler.ts";

const PORT = parseInt(process.env.PORT || "3000", 10);

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Delegate API requests to the shared handler
    if (url.pathname === "/api/solve" || req.method === "OPTIONS") {
      return handleSolveRequest(req);
    }

    // Serve static files from the 'public' directory
    let filepath = url.pathname;
    if (filepath === "/") {
      filepath = "/index.html";
    }

    const file = Bun.file(`./public${filepath}`);
    return new Response(file);
  },
});

console.log(`WRDL-SLVR server running at http://localhost:${PORT}`);
