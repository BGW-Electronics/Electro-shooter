# BGW Electro Shooter

An endless grid-defense survival game for **BGW Electronics** (Vampire Survivors style). You're an energy core defending the power grid — a field of solar panels — against a swarm of rogue electronic components. No dependencies, no build step, no assets — pure HTML5 canvas + WebAudio.

## Run it

**Easiest:** double-click `index.html` — it runs straight from disk in any modern browser.

**Or with a local server** (only needed if your browser blocks local files):

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
# then open http://localhost:8123/
```

## How to play

| Input | Action |
|---|---|
| `WASD` / arrow keys | Move |
| `SPACE` / `SHIFT` | Dash (brief invulnerability, 2s cooldown) |
| `P` / `ESC` | Pause |
| `M` | Mute |
| `1` `2` `3` | Pick upgrade on level-up |
| Touch | Drag to move, tap with a second finger to dash |

Your defenses fire automatically. Destroy the rogue components, vacuum up the charge they drop, and pick one of three upgrades each level.

- **Weapons (5, each up to lvl 5):** Arc Emitter, Coil Rotors, EMP Pulse (also wipes enemy shots), Tesla Arc, Ion Seekers.
- **Passives (6):** Voltage Boost, Overclock, Swift Circuits, Capacitor Bank (max HP), Magnetic Field (pickup range), Trickle Charge (regen).
- **Enemies (rogue components):** Resistors, Diodes (0:40), Transformers (1:30), Transistors that split into Electrons (2:20), ranged Actuators (3:20), plus gold-ringed **overcharged** units every minute.
- **Boss:** THE OVERLOAD arrives at **5:00** — radial bursts and telegraphed charges. Purge it to win, then keep going: the grid stays endless and a stronger Overload rebuilds every 4 minutes.
- Pickups: green **battery** recharges HP, yellow **EMP** clears the screen. Best score is saved locally.

## Global leaderboard

All-time top-100, no login — just enter a name on the game-over screen. Powered by a single
API handler (`functions/api/scores.js`) + a D1 (SQLite) database. The UI hides itself
automatically when the API isn't reachable, so local play keeps working unchanged.

Server-side guardrails: name sanitized to 16 chars, score/time validated for plausibility,
max 5 submissions per IP per 10 minutes (IP stored only as a salted hash). Note: with no
login, a determined cheater can still forge scores — acceptable for a casual arcade board.

## Publish on Cloudflare (free)

This deploys as a **Cloudflare Worker with static assets** (`worker.js` serves the API and
falls back to the static game files). Free tier covers everything: hosting, a
`*.workers.dev` subdomain, 100k requests/day, and D1 100k writes/day.

**Connect the GitHub repo (no local tools needed):**

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → pick the repo.
   Build command: *(leave empty)*. Deploy command: `npx wrangler deploy` (the default).
3. Make sure `name` in `wrangler.toml` matches the Worker's name shown in the dashboard
   (edit either to match). Push — the game goes live at `https://<name>.<subdomain>.workers.dev`.
   The leaderboard shows "offline" until you do the next part.

**Turn the leaderboard on:**

4. Dashboard → **Storage & Databases → D1 → Create database** → name it `neon-swarm-db`.
5. Open it → **Console** → paste the contents of `schema.sql` → run.
6. In `wrangler.toml`, paste the database's id into `database_id` and **uncomment** the four
   `[[d1_databases]]` lines. Commit + push. Done — global scores now save.

**Local CLI deploy instead (needs Node.js):**

```powershell
npm i -g wrangler
wrangler login
wrangler d1 create neon-swarm-db        # paste the returned id into wrangler.toml, uncomment the block
wrangler d1 execute neon-swarm-db --remote --file schema.sql
wrangler deploy
```

## Files

- `index.html` — page, styles, menus
- `core.js` — utilities, audio synth, data tables, game state
- `game.js` — combat, spawning, weapons, enemies, boss AI
- `main.js` — input, rendering, HUD, upgrade UI, game loop
- `leaderboard.js` — leaderboard client (fetch/submit, degrades gracefully offline)
- `worker.js` — Cloudflare Worker entry point (routes API + serves static assets)
- `functions/api/scores.js` — leaderboard API logic: GET top 100 / POST score
- `schema.sql` — D1 table + indexes
- `wrangler.toml` — Cloudflare deploy config (Worker name, assets, D1 binding)
- `.assetsignore` — keeps server-side files from being served publicly
- `serve.ps1` — optional tiny static server for local play (no Node/Python required)
