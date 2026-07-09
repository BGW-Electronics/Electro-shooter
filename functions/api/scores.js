/* Cloudflare Pages Function — /api/scores
   GET  → top 100 scores
   POST → submit {name, score, time} with validation + per-IP rate limit
   Requires D1 binding named "DB" (see schema.sql) */

const MAX_SCORE = 5_000_000;

function bad(msg, code = 400) {
  return Response.json({ ok: false, error: msg }, { status: code });
}

async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join("");
}

export async function onRequestGet({ env }) {
  if (!env.DB) return bad("no DB binding", 500);
  /* one row per name (their best run) so a single player can't fill the board */
  const { results } = await env.DB.prepare(
    "SELECT name, MAX(score) AS score, time FROM scores GROUP BY name ORDER BY score DESC LIMIT 100"
  ).all();
  /* brief cache to cut redundant DB reads; submitters bypass it with a cache-buster */
  return Response.json({ scores: results }, { headers: { "Cache-Control": "public, max-age=10" } });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return bad("no DB binding", 500);
  let b;
  try { b = await request.json(); } catch { return bad("bad json"); }

  let name = String(b.name || "").replace(/[^\w .\-]/g, "").trim().slice(0, 16);
  if (!name) name = "ANON";
  const score = Math.floor(Number(b.score));
  const time = Math.round(Math.max(0, Math.min(86400, Number(b.time) || 0)));

  if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) return bad("bad score");
  if (time < 10) return bad("run too short");
  /* plausibility: passive 6/s + kill income stays far below 600/s early on, but
     hyper mode (post ~15 min) spawns ~35 enemies/s with high-value Actuators
     dominating the pool — legit deep runs bank well over 1000/s, so the bound
     steepens after 900s instead of rejecting exactly the best players */
  const maxPlausible = 10000 + 600 * Math.min(time, 900) + 1800 * Math.max(0, time - 900);
  if (score > maxPlausible) return bad("score implausible for time");

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  /* secret salt (set `wrangler secret put IP_SALT`) makes the hash non-brute-forceable;
     falls back to a static salt so it still works before the secret is configured */
  const salt = env.IP_SALT || "neon-swarm";
  const iph = await sha256(salt + "|" + ip);
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM scores WHERE ip_hash = ?1 AND created_at > datetime('now', '-10 minutes')"
  ).bind(iph).first("c");
  if (recent >= 5) return bad("rate limited — try later", 429);

  await env.DB.prepare(
    "INSERT INTO scores (name, score, time, ip_hash) VALUES (?1, ?2, ?3, ?4)"
  ).bind(name, score, time, iph).run();

  /* DISTINCT name so the rank matches the deduped (best-per-name) board */
  const better = await env.DB.prepare(
    "SELECT COUNT(DISTINCT name) AS c FROM scores WHERE score > ?1"
  ).bind(score).first("c");

  return Response.json({ ok: true, rank: better + 1 });
}
