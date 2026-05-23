import { getRecommendations } from "./solver.ts";

const PORT = 3000;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // API Route: Calculate solver recommendations
    if (url.pathname === "/api/solve" && req.method === "POST") {
      try {
        const body = await req.json();
        const guesses = body.guesses || [];
        
        // Return top 30 recommendations
        const result = getRecommendations(guesses, 30);
        return new Response(JSON.stringify(result), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }



    // CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    // Serve static files from the 'public' directory
    let filepath = url.pathname;
    if (filepath === "/") {
      filepath = "/index.html";
    }

    try {
      const file = Bun.file(`./public${filepath}`);
      if (await file.exists()) {
        return new Response(file);
      }
    } catch (e) {
      // Fail through to index or 404
    }

    // Return a sleek 404 response
    return new Response("Not Found", { status: 404 });
  }
});

console.log(`🚀 WRDL-SLVR server is running at http://localhost:${server.port}`);
