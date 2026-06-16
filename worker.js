/* ============================================================
   BGW ELECTRO SHOOTER — worker.js
   Cloudflare Worker entry point (used by `wrangler deploy`).
   • /api/scores  → leaderboard API (GET top 100 / POST a score)
   • everything else → static game files served from the repo root
   The API logic lives in functions/api/scores.js and is reused as-is.
   Every response is hardened with security headers (CSP etc.).
   ============================================================ */

import { onRequestGet, onRequestPost } from "./functions/api/scores.js";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; " +
    "connect-src 'self'; " +
    "font-src 'self'; " +
    "object-src 'none'; " +
    "base-uri 'none'; " +
    "form-action 'none'; " +
    "frame-ancestors 'self'",
};

function harden(resp) {
  const h = new Headers(resp.headers);
  for (const k in SECURITY_HEADERS) h.set(k, SECURITY_HEADERS[k]);
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/scores") {
      if (request.method === "GET")  return harden(await onRequestGet({ request, env }));
      if (request.method === "POST") return harden(await onRequestPost({ request, env }));
      return harden(new Response("Method Not Allowed", { status: 405, headers: { "Allow": "GET, POST" } }));
    }

    return harden(await env.ASSETS.fetch(request));
  },
};
