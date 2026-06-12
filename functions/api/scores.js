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
  const { results } = await env.DB.prepare(
    "SELECT name, score, time FROM scores ORDER BY score DESC, id ASC LIMIT 100"
  ).all();
  return Response.json({ scores: results }, { headers: { "Cache-Control": "no-store" } });
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
  /* plausibility: passive 6/s + realistic kill income stays far below 600/s */
  if (score > time * 600 + 10000) return bad("score implausible for time");

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const iph = await sha256("neon-swarm|" + ip);
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM scores WHERE ip_hash = ?1 AND created_at > datetime('now', '-10 minutes')"
  ).bind(iph).first("c");
  if (recent >= 5) return bad("rate limited — try later", 429);

  await env.DB.prepare(
    "INSERT INTO scores (name, score, time, ip_hash) VALUES (?1, ?2, ?3, ?4)"
  ).bind(name, score, time, iph).run();

  const better = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM scores WHERE score > ?1"
  ).bind(score).first("c");

  return Response.json({ ok: true, rank: better + 1 });
}
