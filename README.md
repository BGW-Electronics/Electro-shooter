# NEON SWARM

An endless neon arena-survival browser game (Vampire Survivors style). No dependencies, no build step, no assets — pure HTML5 canvas + WebAudio.

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

Weapons fire automatically. Kill enemies, vacuum up the green XP gems, and pick one of three upgrades each level.

- **Weapons (5, each up to lvl 5):** Pulse Blaster, Orbit Blades, Nova Pulse (also wipes enemy bullets), Chain Lightning, Seeker Swarm missiles.
- **Passives (6):** damage, attack speed, move speed, max HP, pickup magnet, regeneration.
- **Enemies:** chasers, sprinters (0:40), tanks (1:30), splitters (2:20), ranged gunners (3:20), plus gold-ringed **elites** every minute.
- **Boss:** the OVERMIND arrives at **5:00** — radial bullet bursts and telegraphed charges. Kill it to win, then keep going: the game turns endless and a stronger one returns every 4 minutes.
- Pickups: ✚ heals, ☢ nukes the screen. Best score is saved locally.

## Global leaderboard

All-time top-100, no login — just enter a name on the game-over screen. Powered by a single
Cloudflare Pages Function (`functions/api/scores.js`) + a D1 (SQLite) database. The UI hides
itself automatically when the API isn't reachable, so local play keeps working unchanged.

Server-side guardrails: name sanitized to 16 chars, score/time validated for plausibility,
max 5 submissions per IP per 10 minutes (IP stored only as a salted hash). Note: with no
login, a determined cheater can still forge scores — acceptable for a casual arcade board.

## Publish on Cloudflare Pages (free)

Free tier covers everything here: static hosting, `*.pages.dev` subdomain, Functions
(100k requests/day) and D1 (100k writes/day).

**Option A — GitHub integration (no local tools needed):**

1. Push this folder to a GitHub repository.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the
   repo. Build command: *(none)*, output directory: `/`. Deploy.
3. Dashboard → **Storage & Databases → D1 → Create database** → name it `neon-swarm-db`.
4. Open the database → **Console** → paste the contents of `schema.sql` → run.
5. Pages project → **Settings → Bindings → Add → D1 database** → variable name `DB`,
   database `neon-swarm-db`.
6. Redeploy (Deployments → Retry / push any commit). Game is live at
   `https://<project>.pages.dev` with a working leaderboard.

**Option B — Wrangler CLI (needs Node.js):**

```powershell
npm i -g wrangler
wrangler login
wrangler d1 create neon-swarm-db        # paste the returned id into wrangler.toml
wrangler d1 execute neon-swarm-db --remote --file schema.sql
wrangler pages deploy .
```

The drag-and-drop dashboard upload does **not** deploy the `functions/` folder — use
Option A or B if you want the leaderboard (drag-and-drop still works for the game itself).

## Files

- `index.html` — page, styles, menus
- `core.js` — utilities, audio synth, data tables, game state
- `game.js` — combat, spawning, weapons, enemies, boss AI
- `main.js` — input, rendering, HUD, upgrade UI, game loop
- `leaderboard.js` — leaderboard client (fetch/submit, degrades gracefully offline)
- `functions/api/scores.js` — Cloudflare Pages Function: GET top 100 / POST score
- `schema.sql` — D1 table + indexes
- `wrangler.toml` — config for CLI deploys (Option B)
- `serve.ps1` — optional tiny static server for local play (no Node/Python required)
