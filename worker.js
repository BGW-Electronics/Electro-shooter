/* ============================================================
   NEON SWARM — worker.js
   Cloudflare Worker entry point (used by `wrangler deploy`).
   • /api/scores  → leaderboard API (GET top 100 / POST a score)
   • everything else → static game files served from the repo root
   The API logic lives in functions/api/scores.js and is reused as-is,
   so the same handlers work whether this is deployed as a Worker or
   as Cloudflare Pages.
   ============================================================ */

import { onRequestGet, onRequestPost } from "./functions/api/scores.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/scores") {
      if (request.method === "GET")  return onRequestGet({ request, env });
      if (request.method === "POST") return onRequestPost({ request, env });
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { "Allow": "GET, POST" },
      });
    }

    // Not an API route → serve the static asset (index.html, core.js, …).
    return env.ASSETS.fetch(request);
  },
};
