/* Cloudflare Pages Function — /api/plays
   GET  → { today, month } counts of runs started (UTC day/month buckets),
          served from the Cache API so the DB is hit roughly once per minute,
          not once per page load.
   POST → record one "start pressed" ping for today, throttled per IP.
   Requires D1 binding named "DB" (see schema.sql) */

function bad(msg, code = 400) {
  return Response.json({ ok: false, error: msg }, { status: code });
}

async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join("");
}

const CACHE_TTL = 60; // seconds — counts don't need to be live

export async function onRequestGet({ request, env }) {
  if (!env.DB) return bad("no DB binding", 500);

  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const day = new Date().toISOString().slice(0, 10);   // 'YYYY-MM-DD' UTC
  const monthPrefix = day.slice(0, 7) + "%";            // 'YYYY-MM%'
  const [today, month] = await Promise.all([
    env.DB.prepare("SELECT count FROM plays WHERE day = ?1").bind(day).first("count"),
    env.DB.prepare("SELECT SUM(count) AS c FROM plays WHERE day LIKE ?1").bind(monthPrefix).first("c"),
  ]);

  const resp = Response.json(
    { today: today || 0, month: month || 0 },
    { headers: { "Cache-Control": `public, max-age=${CACHE_TTL}` } }
  );
  await cache.put(request, resp.clone());
  return resp;
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return bad("no DB binding", 500);

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const salt = env.IP_SALT || "neon-swarm";
  const iph = await sha256(salt + "|" + ip);

  const now = Date.now();
  const last = await env.DB.prepare("SELECT at FROM play_pings WHERE ip_hash = ?1").bind(iph).first("at");
  /* 3s throttle — absorbs double-clicks/double-fires without blocking genuine restarts */
  if (!last || now - last > 3000) {
    const day = new Date().toISOString().slice(0, 10);
    await env.DB.prepare(
      "INSERT INTO plays (day, count) VALUES (?1, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1"
    ).bind(day).run();
  }
  await env.DB.prepare(
    "INSERT INTO play_pings (ip_hash, at) VALUES (?1, ?2) ON CONFLICT(ip_hash) DO UPDATE SET at = excluded.at"
  ).bind(iph, now).run();

  return Response.json({ ok: true });
}
