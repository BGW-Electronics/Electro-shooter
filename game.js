"use strict";
/* ============================================================
   NEON SWARM — game.js
   combat · spawning · weapons · enemies · boss · player · update()
   ============================================================ */

/* ---------------- fx helpers ---------------- */
function addShake(mag, dur) {
  state.shakeMag = Math.max(state.shakeMag, mag);
  state.shake = Math.max(state.shake, dur);
}
function burst(x, y, col, n, spd, size, life) {
  spd = spd || 150; size = size || 3; life = life || 0.6;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), m = rand(0.25, 1) * spd;
    state.parts.push({
      x, y, vx: Math.cos(a) * m, vy: Math.sin(a) * m,
      life: rand(0.5, 1) * life, ml: life, size: rand(0.6, 1.2) * size, col,
    });
  }
  if (state.parts.length > 520) state.parts.splice(0, state.parts.length - 520);
}
function addText(val, x, y, crit, col) {
  if (state.texts.length > 90) return;
  state.texts.push({
    txt: typeof val === "number" ? String(Math.round(val)) : val,
    x: x + rand(-8, 8), y: y - 10, t: 0.8, crit: !!crit, col: col || null,
  });
}
function announce(txt) { state.announce = { txt, t: 3.2 }; }

/* ---------------- targeting ---------------- */
function nearestEnemy(x, y, maxD, exclude) {
  let best = null, bd = maxD * maxD;
  for (const e of state.enemies) {
    if (e.dead || (exclude && exclude.has(e))) continue;
    const d2 = dist2(x, y, e.x, e.y);
    if (d2 < bd) { bd = d2; best = e; }
  }
  return best;
}
function nearestEnemies(x, y, maxD, n) {
  const md2 = maxD * maxD, arr = [];
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d2 = dist2(x, y, e.x, e.y);
    if (d2 < md2) arr.push([d2, e]);
  }
  arr.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (let i = 0; i < Math.min(n, arr.length); i++) out.push(arr[i][1]);
  return out;
}

/* ---------------- damage / death ---------------- */
function hitEnemy(e, dmg, kx, ky) {
  if (e.dead) return;
  let crit = Math.random() < 0.1;
  dmg *= dmgMul();
  if (crit) dmg *= 2;
  e.hp -= dmg;
  e.flash = 0.08;
  if (kx || ky) { e.kb.x += kx; e.kb.y += ky; }
  addText(dmg, e.x, e.y, crit);
  sfx("hit");
  if (e.hp <= 0) killEnemy(e);
}

function dropGems(x, y, total) {
  while (total > 0) {
    const v = total > 6 ? 3 : 1;
    total -= v;
    state.gems.push({
      x: x + rand(-18, 18), y: y + rand(-18, 18),
      val: v, pull: false, ph: rand(0, TAU),
    });
  }
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  state.kills++;
  state.score += e.score;
  burst(e.x, e.y, e.col, e.boss ? 60 : (e.elite ? 26 : 10), e.boss ? 420 : 170, e.boss ? 6 : 3.2, e.boss ? 1.4 : 0.6);
  sfx(e.boss ? "bigboom" : "kill");

  if (e.boss) { onBossDeath(e); return; }

  dropGems(e.x, e.y, e.xp);
  if (e.type === "splitter") {
    for (let i = 0; i < 3; i++) {
      spawnEnemy("mini", false, { x: e.x + rand(-14, 14), y: e.y + rand(-14, 14) });
    }
  }
  if (e.elite) {
    state.pickups.push({ kind: "heart", x: e.x, y: e.y, ph: rand(0, TAU) });
    if (Math.random() < 0.3) state.pickups.push({ kind: "nuke", x: e.x + 24, y: e.y, ph: rand(0, TAU) });
    addShake(7, 0.3);
  } else {
    if (Math.random() < 0.03) state.pickups.push({ kind: "heart", x: e.x, y: e.y, ph: rand(0, TAU) });
    else if (Math.random() < 0.0035) state.pickups.push({ kind: "nuke", x: e.x, y: e.y, ph: rand(0, TAU) });
  }
}

function damagePlayer(d) {
  const p = state.player;
  if (p.ifr > 0 || p.dashT > 0 || state.mode !== "playing") return;
  p.hp -= d;
  p.ifr = 0.6;
  state.hurtT = 0.55;
  addShake(8, 0.3);
  burst(p.x, p.y, "255,60,80", 14, 220, 3.5, 0.5);
  addText("-" + Math.round(d), p.x, p.y - 16, false, "#ff5c7a");
  sfx("hurt");
  if (p.hp <= 0) { p.hp = 0; gameOver(); }
}

function doNuke() {
  state.flash = 0.9;
  addShake(20, 0.6);
  sfx("bigboom");
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (e.boss) hitEnemy(e, 300);
    else if (e.elite) hitEnemy(e, 600);
    else { e.hp = 0; killEnemy(e); }
  }
  for (const b of state.ebullets) b.life = 0;
}

function gainXP(v) {
  state.xp += v;
  while (state.xp >= state.xpNeed) {
    state.xp -= state.xpNeed;
    state.level++;
    state.xpNeed = xpNeedFor(state.level);
    state.pendingUps++;
  }
}

/* ---------------- spawning ---------------- */
function edgeSpawn(margin) {
  margin = margin || 60;
  const p = state.player, side = randi(0, 3);
  let x, y;
  if (side === 0)      { x = rand(p.x - W / 2 - margin, p.x + W / 2 + margin); y = p.y - H / 2 - margin; }
  else if (side === 1) { x = rand(p.x - W / 2 - margin, p.x + W / 2 + margin); y = p.y + H / 2 + margin; }
  else if (side === 2) { x = p.x - W / 2 - margin; y = rand(p.y - H / 2 - margin, p.y + H / 2 + margin); }
  else                 { x = p.x + W / 2 + margin; y = rand(p.y - H / 2 - margin, p.y + H / 2 + margin); }
  return { x, y };
}

function spawnEnemy(type, elite, pos) {
  const d = ETYPES[type];
  const t = state.time;
  const hpScale  = 1 + (t / 60) * 0.5 + Math.pow(t / 60, 1.5) * 0.12 + state.hyper * 0.8;
  const dmgScale = 1 + (t / 60) * 0.12 + state.hyper * 0.2;
  const sp = pos || edgeSpawn();
  const e = {
    type, x: sp.x, y: sp.y,
    r: d.r, hp: d.hp * hpScale, spd: rand(d.spd[0], d.spd[1]),
    dmg: d.dmg * dmgScale, xp: d.xp, score: d.score,
    col: d.col, shape: d.shape,
    flash: 0, hitcd: 0, elite: !!elite, dead: false,
    fireT: rand(1.2, 2.6), strafe: Math.random() < 0.5 ? 1 : -1,
    rot: rand(0, TAU), kb: { x: 0, y: 0 },
  };
  if (elite) {
    e.r *= 1.7; e.hp *= 9; e.dmg *= 1.6; e.spd *= 0.85;
    e.xp = 12; e.score *= 6;
  }
  e.maxhp = e.hp;
  state.enemies.push(e);
  return e;
}

function spawnBoss() {
  const mult = (1 + state.bossesKilled * 1.1) * (1 + state.time / 600);
  const sp = edgeSpawn(120);
  const b = {
    type: "boss", boss: true, x: sp.x, y: sp.y,
    r: 48, hp: 2400 * mult, maxhp: 2400 * mult,
    spd: 62, dmg: 26 * (1 + state.hyper * 0.2), xp: 0, score: 2500,
    col: "255,40,80", shape: 6,
    flash: 0, hitcd: 0, elite: false, dead: false,
    kb: { x: 0, y: 0 }, rot: 0, fireT: 0, strafe: 1,
    bstate: "chase", bt: 0, burstT: 3.5, chargeT: 7, cvx: 0, cvy: 0,
  };
  state.enemies.push(b);
  state.boss = b;
  announce("☠ OVERMIND ONLINE ☠");
  sfx("boss");
  addShake(10, 0.6);
}

function onBossDeath(b) {
  state.boss = null;
  state.bossesKilled++;
  state.hyper++;
  dropGems(b.x, b.y, 60);
  for (let i = 0; i < 3; i++) state.pickups.push({ kind: "heart", x: b.x + rand(-40, 40), y: b.y + rand(-40, 40), ph: rand(0, TAU) });
  state.flash = 0.8;
  addShake(24, 0.8);
  state.bossT = 240;
  if (!state.won) { state.won = true; winGame(); }
  else announce("☠ OVERMIND RE-DEFEATED — IT WILL RETURN ☠");
}

function pickType() {
  const t = state.time;
  const pool = [["chaser", 100]];
  if (t > 40)  pool.push(["speedy", 55 + t * 0.08]);
  if (t > 90)  pool.push(["tank", 30 + t * 0.05]);
  if (t > 140) pool.push(["splitter", 30]);
  if (t > 200) pool.push(["shooter", 28]);
  let total = 0;
  for (const p of pool) total += p[1];
  let r = Math.random() * total;
  for (const p of pool) { r -= p[1]; if (r <= 0) return p[0]; }
  return "chaser";
}

function director(dt) {
  const t = state.time;

  for (const [ut, key, msg] of UNLOCKS) {
    if (t >= ut && !state.announced[key]) { state.announced[key] = true; announce(msg); }
  }

  state.spawnT -= dt;
  let interval = clamp(1.15 - t * 0.0028 - state.hyper * 0.1, 0.16, 1.15);
  if (state.boss) interval *= 1.5;
  if (state.spawnT <= 0 && state.enemies.length < 240) {
    state.spawnT = interval;
    const type = pickType();
    spawnEnemy(type);
    if (t > 60 && Math.random() < 0.1) {
      const sp = edgeSpawn();
      for (let i = 0; i < 3; i++) spawnEnemy(type, false, { x: sp.x + rand(-50, 50), y: sp.y + rand(-50, 50) });
    }
  }

  state.eliteT -= dt;
  if (state.eliteT <= 0) {
    state.eliteT = Math.max(32, 60 - t * 0.04);
    spawnEnemy(pickType(), true);
    announce("⚠ ELITE SIGNATURE ⚠");
  }

  if (!state.boss) {
    state.bossT -= dt;
    if (state.bossT <= 0) { state.bossT = 9999; spawnBoss(); }
  }
}

/* ---------------- weapons ---------------- */
function updateWeapons(dt) {
  const p = state.player, rm = rateMul();

  /* pulse blaster */
  const wb = state.weapons.blaster;
  if (wb.lvl > 0) {
    wb.cd -= dt;
    if (wb.cd <= 0) {
      const s = BLASTER[wb.lvl - 1];
      const targets = nearestEnemies(p.x, p.y, 620, s.n);
      if (targets.length) {
        wb.cd = s.int / rm;
        for (let i = 0; i < s.n; i++) {
          const t = targets[i % targets.length];
          const extra = i >= targets.length ? rand(-0.18, 0.18) : rand(-0.03, 0.03);
          const a = Math.atan2(t.y - p.y, t.x - p.x) + extra;
          state.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 540, vy: Math.sin(a) * 540, dmg: s.dmg, life: 1.4 });
        }
        p.face = Math.atan2(targets[0].y - p.y, targets[0].x - p.x);
        sfx("shoot");
      } else wb.cd = 0.12;
    }
  }

  /* orbit blades */
  const wo = state.weapons.orbit;
  if (wo.lvl > 0) {
    const s = ORBIT[wo.lvl - 1];
    wo.ang = (wo.ang + dt * s.spd) % TAU;
    const blades = [];
    for (let i = 0; i < s.n; i++) {
      const a = wo.ang + (i * TAU) / s.n;
      blades.push({ x: p.x + Math.cos(a) * s.rad, y: p.y + Math.sin(a) * s.rad, a });
    }
    state.bladePos = blades;
    for (const e of state.enemies) {
      if (e.dead || e.hitcd > 0) continue;
      for (const b of blades) {
        const rr = e.r + 11;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          const d = Math.max(1, Math.hypot(e.x - p.x, e.y - p.y));
          hitEnemy(e, s.dmg, ((e.x - p.x) / d) * 130, ((e.y - p.y) / d) * 130);
          e.hitcd = 0.38;
          break;
        }
      }
    }
  } else state.bladePos = null;

  /* nova pulse */
  const wn = state.weapons.nova;
  if (wn.lvl > 0) {
    wn.cd -= dt;
    if (wn.cd <= 0) {
      const s = NOVA[wn.lvl - 1];
      wn.cd = s.int / rm;
      state.novas.push({ x: p.x, y: p.y, r: 10, maxR: s.r, dmg: s.dmg, hit: new Set() });
      sfx("nova");
    }
  }

  /* chain lightning */
  const wl = state.weapons.lightning;
  if (wl.lvl > 0) {
    wl.cd -= dt;
    if (wl.cd <= 0) {
      const s = LIGHTNING[wl.lvl - 1];
      let cur = nearestEnemy(p.x, p.y, 280, null);
      if (!cur) wl.cd = 0.25;
      else {
        wl.cd = s.int / rm;
        const hitset = new Set();
        const pts = [{ x: p.x, y: p.y }];
        for (let k = 0; k < s.chain && cur; k++) {
          hitset.add(cur);
          pts.push({ x: cur.x, y: cur.y });
          hitEnemy(cur, s.dmg);
          burst(cur.x, cur.y, "255,240,120", 4, 120, 2.5, 0.35);
          cur = nearestEnemy(pts[pts.length - 1].x, pts[pts.length - 1].y, 200, hitset);
        }
        state.bolts.push({ pts, t: 0.18 });
        sfx("zap");
      }
    }
  }

  /* seeker swarm */
  const wm = state.weapons.missile;
  if (wm.lvl > 0) {
    wm.cd -= dt;
    if (wm.cd <= 0) {
      const s = MISSILE[wm.lvl - 1];
      const targets = nearestEnemies(p.x, p.y, 800, s.n);
      if (!targets.length) wm.cd = 0.25;
      else {
        wm.cd = s.int / rm;
        for (let i = 0; i < s.n; i++) {
          const a = rand(0, TAU);
          state.missiles.push({
            x: p.x, y: p.y, ang: a, spd: 260,
            target: targets[i % targets.length],
            dmg: s.dmg, splash: s.r, life: 4, age: 0,
          });
        }
        sfx("missile");
      }
    }
  }
}

function explodeMissile(m) {
  burst(m.x, m.y, "255,160,70", 16, 240, 4, 0.55);
  addShake(3, 0.15);
  sfx("boom");
  for (const e of state.enemies) {
    if (e.dead) continue;
    const rr = m.splash + e.r;
    if (dist2(m.x, m.y, e.x, e.y) < rr * rr) hitEnemy(e, m.dmg);
  }
}

function updateMissiles(dt) {
  for (const m of state.missiles) {
    m.life -= dt; m.age += dt;
    if (m.life <= 0) { explodeMissile(m); m.dead = true; continue; }
    if (!m.target || m.target.dead) m.target = nearestEnemy(m.x, m.y, 900, null);
    m.spd = Math.min(560, 280 + m.age * 420);
    if (m.target) {
      const want = Math.atan2(m.target.y - m.y, m.target.x - m.x);
      let diff = want - m.ang;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      m.ang += clamp(diff, -5.5 * dt, 5.5 * dt);
    }
    m.x += Math.cos(m.ang) * m.spd * dt;
    m.y += Math.sin(m.ang) * m.spd * dt;
    if (Math.random() < 0.5) {
      state.parts.push({ x: m.x, y: m.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.25, ml: 0.25, size: 2, col: "255,170,80" });
    }
    if (m.target && !m.target.dead) {
      const rr = m.target.r + 10;
      if (dist2(m.x, m.y, m.target.x, m.target.y) < rr * rr) { explodeMissile(m); m.dead = true; }
    }
  }
  state.missiles = state.missiles.filter(m => !m.dead);
}

function updateBullets(dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    for (const e of state.enemies) {
      if (e.dead) continue;
      const rr = e.r + 4;
      if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
        const m = Math.max(1, Math.hypot(b.vx, b.vy));
        hitEnemy(e, b.dmg, (b.vx / m) * 90, (b.vy / m) * 90);
        burst(b.x, b.y, "140,220,255", 3, 120, 2, 0.3);
        b.dead = true;
        break;
      }
    }
  }
  state.bullets = state.bullets.filter(b => !b.dead);
}

function updateEBullets(dt) {
  const p = state.player;
  for (const b of state.ebullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    const rr = p.r + b.r;
    if (dist2(b.x, b.y, p.x, p.y) < rr * rr) { damagePlayer(b.dmg); b.dead = true; }
  }
  state.ebullets = state.ebullets.filter(b => !b.dead);
}

function updateNovas(dt) {
  for (const n of state.novas) {
    n.r += 430 * dt;
    if (n.r >= n.maxR) { n.dead = true; continue; }
    for (const e of state.enemies) {
      if (e.dead || n.hit.has(e)) continue;
      const d = Math.hypot(e.x - n.x, e.y - n.y);
      if (Math.abs(d - n.r) < e.r + 14) {
        n.hit.add(e);
        const dd = Math.max(1, d);
        hitEnemy(e, n.dmg, ((e.x - n.x) / dd) * 220, ((e.y - n.y) / dd) * 220);
      }
    }
    for (const b of state.ebullets) {
      const d = Math.hypot(b.x - n.x, b.y - n.y);
      if (Math.abs(d - n.r) < 16) { b.dead = true; burst(b.x, b.y, "120,255,220", 3, 100, 2, 0.3); }
    }
  }
  state.novas = state.novas.filter(n => !n.dead);
}

function updateBolts(dt) {
  for (const b of state.bolts) b.t -= dt;
  state.bolts = state.bolts.filter(b => b.t > 0);
}

/* ---------------- enemies ---------------- */
function bossAI(e, dt) {
  const p = state.player;
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.max(1, Math.hypot(dx, dy));
  if (e.bstate === "chase") {
    e.x += (dx / d) * e.spd * dt;
    e.y += (dy / d) * e.spd * dt;
    e.burstT -= dt;
    if (e.burstT <= 0) {
      e.burstT = 4.2;
      const n = 18;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rand(-0.05, 0.05);
        state.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 175, vy: Math.sin(a) * 175, r: 6, dmg: e.dmg * 0.55, life: 5 });
      }
      const aimed = Math.atan2(dy, dx);
      for (let i = -1; i <= 1; i++) {
        const a = aimed + i * 0.16;
        state.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, r: 6, dmg: e.dmg * 0.55, life: 5 });
      }
      sfx("boom");
    }
    e.chargeT -= dt;
    if (e.chargeT <= 0) { e.bstate = "tele"; e.bt = 0.8; }
  } else if (e.bstate === "tele") {
    e.bt -= dt;
    if (e.bt <= 0) {
      e.bstate = "charge"; e.bt = 0.75;
      e.cvx = (dx / d) * 470; e.cvy = (dy / d) * 470;
      sfx("dash");
    }
  } else { /* charge */
    e.x += e.cvx * dt; e.y += e.cvy * dt; e.bt -= dt;
    burst(e.x, e.y, e.col, 2, 60, 4, 0.4);
    if (e.bt <= 0) { e.bstate = "chase"; e.chargeT = 6.5; e.burstT = Math.min(e.burstT, 2.2); }
  }
}

function updateEnemies(dt) {
  const p = state.player, es = state.enemies;
  for (let i = 0; i < es.length; i++) {
    const e = es[i];
    if (e.dead) continue;
    e.flash -= dt; e.hitcd -= dt; e.rot += dt * 1.5;

    if (e.boss) {
      bossAI(e, dt);
    } else {
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.max(1, Math.hypot(dx, dy));
      let mvx = 0, mvy = 0;
      if (e.type === "shooter") {
        if (d > 300)      { mvx = (dx / d) * e.spd; mvy = (dy / d) * e.spd; }
        else if (d < 215) { mvx = -(dx / d) * e.spd; mvy = -(dy / d) * e.spd; }
        else              { mvx = (-dy / d) * e.spd * 0.6 * e.strafe; mvy = (dx / d) * e.spd * 0.6 * e.strafe; }
        e.fireT -= dt;
        if (e.fireT <= 0 && d < 560) {
          e.fireT = Math.max(1.2, 2.4 - state.time * 0.002);
          const a = Math.atan2(dy, dx) + rand(-0.06, 0.06);
          state.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, r: 5, dmg: e.dmg * 1.5, life: 4 });
        }
      } else {
        mvx = (dx / d) * e.spd; mvy = (dy / d) * e.spd;
      }
      e.x += (mvx + e.kb.x) * dt;
      e.y += (mvy + e.kb.y) * dt;
      const kdec = Math.exp(-8 * dt);
      e.kb.x *= kdec; e.kb.y *= kdec;

      /* cheap local separation */
      for (let k = 1; k <= 4; k++) {
        const o = es[(i + k) % es.length];
        if (o === e || o.dead || o.boss) continue;
        const ox = e.x - o.x, oy = e.y - o.y;
        const md = e.r + o.r;
        const d2v = ox * ox + oy * oy;
        if (d2v > 0.01 && d2v < md * md) {
          const dd = Math.sqrt(d2v), ov = (md - dd) * 0.5;
          e.x += (ox / dd) * ov * 0.6; e.y += (oy / dd) * ov * 0.6;
          o.x -= (ox / dd) * ov * 0.6; o.y -= (oy / dd) * ov * 0.6;
        }
      }
    }

    /* contact damage */
    const cr = e.r + p.r - 2;
    if (dist2(e.x, e.y, p.x, p.y) < cr * cr) damagePlayer(e.dmg);

    /* despawn if absurdly far (player kiting away) */
    if (!e.boss && dist2(e.x, e.y, p.x, p.y) > 2600 * 2600) e.dead = true;
  }
}

/* ---------------- player ---------------- */
function tryDash() {
  const p = state.player;
  if (state.mode !== "playing" || p.dashCd > 0) return;
  p.dashCd = 2.1;
  p.dashT = 0.18;
  p.ifr = Math.max(p.ifr, 0.32);
  const im = inputMove();
  if (im.x || im.y) { p.dashDx = im.x; p.dashDy = im.y; }
  else { p.dashDx = Math.cos(p.moveAng); p.dashDy = Math.sin(p.moveAng); }
  sfx("dash");
}

function updatePlayer(dt) {
  const p = state.player;
  p.ifr -= dt; p.dashCd -= dt;
  let sp = moveSpeed();
  let mx, my;
  if (p.dashT > 0) {
    p.dashT -= dt;
    sp *= 3.6;
    mx = p.dashDx; my = p.dashDy;
    burst(p.x, p.y, "0,255,217", 2, 30, 3, 0.35);
  } else {
    const im = inputMove();
    mx = im.x; my = im.y;
  }
  p.x += mx * sp * dt;
  p.y += my * sp * dt;
  if (mx || my) p.moveAng = Math.atan2(my, mx);
  if (regenRate() > 0) p.hp = Math.min(p.maxhp, p.hp + regenRate() * dt);

  const k = 1 - Math.exp(-10 * dt);
  state.cam.x += (p.x - state.cam.x) * k;
  state.cam.y += (p.y - state.cam.y) * k;
}

/* ---------------- gems / pickups ---------------- */
function updateGems(dt) {
  const p = state.player, mr = magnetR();
  for (const g of state.gems) {
    const dx = p.x - g.x, dy = p.y - g.y, d = Math.max(0.5, Math.hypot(dx, dy));
    if (d < mr) g.pull = true;
    if (g.pull) {
      const sp = Math.max(240, 760 - d * 1.4);
      g.x += (dx / d) * sp * dt;
      g.y += (dy / d) * sp * dt;
    }
    if (d < p.r + 10) {
      g.dead = true;
      gainXP(g.val);
      state.score += 2;
      sfx("gem");
    }
  }
  state.gems = state.gems.filter(g => !g.dead);
  if (state.gems.length > 320) {
    const cut = state.gems.splice(0, 40);
    let v = 0, x = 0, y = 0;
    for (const g of cut) { v += g.val; x += g.x; y += g.y; }
    state.gems.push({ x: x / cut.length, y: y / cut.length, val: v, pull: false, ph: 0 });
  }
}

function updatePickups(dt) {
  const p = state.player, mr = magnetR();
  for (const u of state.pickups) {
    const dx = p.x - u.x, dy = p.y - u.y, d = Math.max(0.5, Math.hypot(dx, dy));
    if (d < mr * 0.8) { u.x += (dx / d) * 300 * dt; u.y += (dy / d) * 300 * dt; }
    if (d < p.r + 13) {
      u.dead = true;
      if (u.kind === "heart") {
        p.hp = Math.min(p.maxhp, p.hp + 20);
        addText("+20", p.x, p.y - 20, false, "#ff7eb0");
        sfx("heart");
      } else if (u.kind === "nuke") {
        doNuke();
      }
    }
  }
  state.pickups = state.pickups.filter(u => !u.dead);
}

function updateParticles(dt) {
  for (const q of state.parts) {
    q.life -= dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    const dec = Math.exp(-3 * dt);
    q.vx *= dec; q.vy *= dec;
  }
  state.parts = state.parts.filter(q => q.life > 0);
}

function updateTexts(dt) {
  for (const t of state.texts) { t.t -= dt; t.y -= 42 * dt; }
  state.texts = state.texts.filter(t => t.t > 0);
}

/* ---------------- master update ---------------- */
function update(dt) {
  state.time += dt;
  state.score += dt * 6;

  updatePlayer(dt);
  director(dt);
  updateWeapons(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateEBullets(dt);
  updateMissiles(dt);
  updateNovas(dt);
  updateBolts(dt);
  updateGems(dt);
  updatePickups(dt);
  updateParticles(dt);
  updateTexts(dt);

  state.enemies = state.enemies.filter(e => !e.dead);

  if (state.shake > 0) state.shake -= dt; else state.shakeMag = 0;
  if (state.flash > 0) state.flash -= dt * 1.6;
  if (state.hurtT > 0) state.hurtT -= dt;
  if (state.announce) { state.announce.t -= dt; if (state.announce.t <= 0) state.announce = null; }

  if (state.pendingUps > 0 && state.mode === "playing") openUpgrades();
}
