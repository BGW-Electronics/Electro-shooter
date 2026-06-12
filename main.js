"use strict";
/* ============================================================
   NEON SWARM — main.js
   input · render · HUD · overlays · upgrade UI · loop · boot
   ============================================================ */

/* ---------------- input ---------------- */
const keys = {};
let stick = null; // touch joystick {id, ox, oy, dx, dy}

function inputMove() {
  let mx = ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0);
  let my = ((keys.KeyS || keys.ArrowDown) ? 1 : 0) - ((keys.KeyW || keys.ArrowUp) ? 1 : 0);
  if (stick) {
    const m = Math.hypot(stick.dx, stick.dy);
    if (m > 10) { mx = stick.dx / m; my = stick.dy / m; }
  }
  const m = Math.hypot(mx, my);
  if (m > 1) { mx /= m; my /= m; }
  return { x: mx, y: my };
}

addEventListener("keydown", e => {
  /* typing in the leaderboard name field must not trigger game hotkeys (R = restart!) */
  if (e.target && e.target.tagName === "INPUT") { if (e.code === "Escape") e.target.blur(); return; }
  AudioSys.init(); AudioSys.resume();
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  const m = state.mode;
  if (e.code === "KeyM") { updateMuteBtn(AudioSys.toggleMute()); return; }
  if (m === "menu") {
    if (e.code === "Enter" || e.code === "Space") startGame();
  } else if (m === "playing") {
    if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") tryDash();
    else if (e.code === "KeyP" || e.code === "Escape") setPause(true);
  } else if (m === "paused") {
    if (["KeyP", "Escape", "Enter", "Space"].includes(e.code)) setPause(false);
  } else if (m === "upgrade") {
    if (e.code === "Digit1" || e.code === "Numpad1") chooseUpgrade(0);
    else if (e.code === "Digit2" || e.code === "Numpad2") chooseUpgrade(1);
    else if (e.code === "Digit3" || e.code === "Numpad3") chooseUpgrade(2);
  } else if (m === "over") {
    if (["KeyR", "Enter", "Space"].includes(e.code)) startGame();
  } else if (m === "win") {
    if (e.code === "Enter" || e.code === "Space") continueRun();
    else if (e.code === "KeyR") startGame();
  }
});
addEventListener("keyup", e => { keys[e.code] = false; });

canvas.addEventListener("pointerdown", e => {
  AudioSys.init(); AudioSys.resume();
  if (state.mode !== "playing") return;
  if (!stick) stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
  else tryDash();
});
addEventListener("pointermove", e => {
  if (stick && e.pointerId === stick.id) {
    stick.dx = clamp(e.clientX - stick.ox, -70, 70);
    stick.dy = clamp(e.clientY - stick.oy, -70, 70);
  }
});
addEventListener("pointerup", e => { if (stick && e.pointerId === stick.id) stick = null; });
addEventListener("pointercancel", e => { if (stick && e.pointerId === stick.id) stick = null; });
addEventListener("contextmenu", e => e.preventDefault());
addEventListener("blur", () => { if (state && state.mode === "playing") setPause(true); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state && state.mode === "playing") setPause(true);
});

/* ---------------- DOM glue ---------------- */
const $ = id => document.getElementById(id);
const menuEl = $("menu"), levelupEl = $("levelup"), pauseEl = $("pause"), overEl = $("over"), winEl = $("win");
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }
function hideAll() { [menuEl, levelupEl, pauseEl, overEl, winEl].forEach(hide); }

function updateMuteBtn(muted) { $("muteBtn").textContent = muted ? "🔇" : "🔊"; }
$("muteBtn").onclick = e => { AudioSys.init(); updateMuteBtn(AudioSys.toggleMute()); e.currentTarget.blur(); };
$("startBtn").onclick = e => { AudioSys.init(); startGame(); e.currentTarget.blur(); };
$("restartBtn").onclick = e => { startGame(); e.currentTarget.blur(); };
$("restartBtn2").onclick = e => { startGame(); e.currentTarget.blur(); };
$("continueBtn").onclick = e => { continueRun(); e.currentTarget.blur(); };
$("resumeBtn").onclick = e => { setPause(false); e.currentTarget.blur(); };

function startGame() { hideAll(); newGame(); }

function setPause(b) {
  if (b && state.mode === "playing") { state.mode = "paused"; show(pauseEl); }
  else if (!b && state.mode === "paused") { state.mode = "playing"; hide(pauseEl); }
}

function continueRun() {
  if (state.mode !== "win") return;
  hide(winEl);
  state.mode = "playing";
  state.player.ifr = 2;
  announce("HYPER MODE — THE SWARM ACCELERATES");
}

function statRow(k, v, cls) { return `<span>${k}</span><b class="${cls || ""}">${v}</b>`; }

function fillStats(el) {
  const sc = Math.floor(state.score);
  const nb = sc > bestData.score;
  el.innerHTML =
    statRow("TIME SURVIVED", fmtTime(state.time)) +
    statRow("LEVEL", state.level) +
    statRow("KILLS", state.kills) +
    statRow("SCORE", sc.toLocaleString()) +
    statRow("BEST", (nb ? sc : bestData.score).toLocaleString() + (nb ? " ★ NEW" : ""), nb ? "nb" : "");
  if (nb) { bestData = { score: sc, time: state.time }; saveBest(bestData); }
}

function gameOver() {
  state.mode = "over";
  sfx("gameover");
  fillStats($("overStats"));
  show(overEl);
  if (typeof lbOnGameOver === "function") lbOnGameOver();
}

function winGame() {
  state.mode = "win";
  sfx("win");
  fillStats($("winStats"));
  show(winEl);
}

/* ---------------- upgrade UI ---------------- */
function rollUpgrades() {
  const opts = [];
  for (const k in WEAPON_DEFS) if (state.weapons[k].lvl < 5) opts.push({ kind: "w", key: k });
  for (const k in PASSIVE_DEFS) if (state.passives[k] < 5) opts.push({ kind: "p", key: k });
  shuffle(opts);
  const picked = opts.slice(0, 3);
  while (picked.length < 3) picked.push({ kind: "heal" });
  state.upgradeOpts = picked;
}

function pipsHTML(lvl, max) { return "◆".repeat(lvl) + "◇".repeat(max - lvl); }

function renderCards() {
  const wrap = $("cards");
  wrap.innerHTML = "";
  state.upgradeOpts.forEach((o, i) => {
    const d = document.createElement("div");
    d.className = "card";
    let icon, name, info, pips, color;
    if (o.kind === "w") {
      const def = WEAPON_DEFS[o.key], lvl = state.weapons[o.key].lvl;
      icon = def.icon; name = def.name; color = def.css; info = def.desc[lvl];
      pips = lvl === 0 ? `<div class="new">NEW WEAPON</div>` : `<div class="pips">${pipsHTML(lvl + 1, 5)}</div>`;
    } else if (o.kind === "p") {
      const def = PASSIVE_DEFS[o.key], lvl = state.passives[o.key];
      icon = def.icon; name = def.name; color = def.css; info = def.desc;
      pips = `<div class="pips">${pipsHTML(lvl + 1, 5)}</div>`;
    } else {
      icon = "✚"; name = "Field Repair"; color = "#ff5e9a"; info = "Restore 40 HP";
      pips = `<div class="pips">∞</div>`;
    }
    d.innerHTML = `<div class="key">${i + 1}</div><div class="ic" style="color:${color}">${icon}</div><h3>${name}</h3>${pips}<p>${info}</p>`;
    d.onclick = () => chooseUpgrade(i);
    wrap.appendChild(d);
  });
}

function openUpgrades() {
  state.mode = "upgrade";
  sfx("levelup");
  rollUpgrades();
  renderCards();
  show(levelupEl);
}

function chooseUpgrade(i) {
  if (state.mode !== "upgrade" || !state.upgradeOpts || !state.upgradeOpts[i]) return;
  const o = state.upgradeOpts[i];
  const p = state.player;
  if (o.kind === "w") {
    const w = state.weapons[o.key];
    if (w.lvl === 0) w.cd = 0.3;
    w.lvl++;
  } else if (o.kind === "p") {
    state.passives[o.key]++;
    if (o.key === "vitality") { p.maxhp += 20; p.hp = Math.min(p.maxhp, p.hp + 20); }
  } else {
    p.hp = Math.min(p.maxhp, p.hp + 40);
  }
  sfx("pick");
  state.pendingUps--;
  if (state.pendingUps > 0) { rollUpgrades(); renderCards(); }
  else { hide(levelupEl); state.mode = "playing"; }
}

/* ---------------- render ---------------- */
function drawShape(x, y, r, sides, rot) {
  ctx.beginPath();
  if (!sides) ctx.arc(x, y, r, 0, TAU);
  else {
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * TAU;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  ctx.fill();
}

function strokeBolt(b) {
  ctx.beginPath();
  for (let i = 0; i < b.pts.length - 1; i++) {
    const a = b.pts[i], c = b.pts[i + 1];
    const d = Math.hypot(c.x - a.x, c.y - a.y);
    const steps = Math.max(2, Math.ceil(d / 26));
    ctx.moveTo(a.x, a.y);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const nx = -(c.y - a.y) / Math.max(1, d), ny = (c.x - a.x) / Math.max(1, d);
      const j = rand(-9, 9);
      ctx.lineTo(lerp(a.x, c.x, t) + nx * j, lerp(a.y, c.y, t) + ny * j);
    }
    ctx.lineTo(c.x, c.y);
  }
  ctx.stroke();
}

function drawStars(cam) {
  const layers = [
    [0.25, 160, 0.10, 1.5, "rgba(120,200,255,"],
    [0.5, 120, 0.06, 2.2, "rgba(160,255,240,"],
  ];
  for (const [f, cell, dens, sz, colp] of layers) {
    const ox = cam.x * f, oy = cam.y * f;
    const cx0 = Math.floor((ox - W / 2) / cell) - 1, cx1 = Math.floor((ox + W / 2) / cell) + 1;
    const cy0 = Math.floor((oy - H / 2) / cell) - 1, cy1 = Math.floor((oy + H / 2) / cell) + 1;
    for (let ix = cx0; ix <= cx1; ix++) {
      for (let iy = cy0; iy <= cy1; iy++) {
        const h = hash2(ix, iy);
        if (h < dens) {
          const px = ix * cell - ox + W / 2 + hash2(ix + 71, iy) * cell;
          const py = iy * cell - oy + H / 2 + hash2(ix, iy + 37) * cell;
          ctx.fillStyle = colp + (0.2 + (h / dens) * 0.5) + ")";
          ctx.fillRect(px, py, sz, sz);
        }
      }
    }
  }
}

function drawGrid(cam) {
  const gs = 90;
  ctx.strokeStyle = "rgba(0,230,255,0.055)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const x0 = Math.floor((cam.x - W / 2) / gs) * gs, x1 = cam.x + W / 2 + gs;
  const y0 = Math.floor((cam.y - H / 2) / gs) * gs, y1 = cam.y + H / 2 + gs;
  for (let x = x0; x <= x1; x += gs) { ctx.moveTo(x, cam.y - H / 2 - gs); ctx.lineTo(x, y1); }
  for (let y = y0; y <= y1; y += gs) { ctx.moveTo(cam.x - W / 2 - gs, y); ctx.lineTo(x1, y); }
  ctx.stroke();
}

function render() {
  const cam = state.cam, p = state.player;
  ctx.fillStyle = "#04060d";
  ctx.fillRect(0, 0, W, H);
  drawStars(cam);

  let sx = 0, sy = 0;
  if (state.shake > 0) {
    const m = state.shakeMag * Math.min(1, state.shake * 3);
    sx = rand(-m, m); sy = rand(-m, m);
  }
  ctx.save();
  ctx.translate(W / 2 - cam.x + sx, H / 2 - cam.y + sy);
  drawGrid(cam);

  /* ===== glow pass ===== */
  ctx.globalCompositeOperation = "lighter";

  for (const n of state.novas) {
    const a = 1 - n.r / n.maxR;
    ctx.strokeStyle = `rgba(0,255,217,${0.5 * a})`;
    ctx.lineWidth = 16;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU); ctx.stroke();
  }
  for (const g of state.gems) drawGlow(g.x, g.y, 5 + Math.min(6, g.val * 1.5), "0,255,170", 0.7);
  for (const u of state.pickups) drawGlow(u.x, u.y, 10, u.kind === "heart" ? "255,90,150" : "255,230,80", 0.8);
  for (const e of state.enemies) drawGlow(e.x, e.y, e.r * 1.5, e.col, e.elite || e.boss ? 0.85 : 0.55);
  for (const b of state.bullets) drawGlow(b.x, b.y, 6, "140,220,255", 0.8);
  for (const b of state.ebullets) drawGlow(b.x, b.y, 7, "255,70,160", 0.85);
  for (const m of state.missiles) drawGlow(m.x, m.y, 6, "255,170,80", 0.85);
  if (state.bladePos) for (const b of state.bladePos) drawGlow(b.x, b.y, 9, "255,90,210", 0.8);
  drawGlow(p.x, p.y, p.r * (p.dashT > 0 ? 3 : 2), "0,255,217", 0.9);
  for (const q of state.parts) drawGlow(q.x, q.y, q.size * 2.2, q.col, Math.max(0, q.life / q.ml) * 0.85);
  for (const b of state.bolts) {
    ctx.strokeStyle = `rgba(120,230,255,${(b.t / 0.18) * 0.7})`;
    ctx.lineWidth = 5;
    strokeBolt(b);
  }

  /* ===== core pass ===== */
  ctx.globalCompositeOperation = "source-over";

  for (const g of state.gems) {
    const r = 4 + Math.min(6, g.val * 0.8);
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.ph + state.time * 2);
    ctx.fillStyle = g.val >= 3 ? "#ffe27a" : "#a7ffe3";
    ctx.fillRect(-r / 2, -r / 2, r, r);
    ctx.restore();
  }
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const u of state.pickups) {
    const bob = Math.sin(state.time * 4 + u.ph) * 3;
    ctx.font = "700 16px 'Segoe UI'";
    ctx.fillStyle = u.kind === "heart" ? "#ff7eb0" : "#ffe75e";
    ctx.fillText(u.kind === "heart" ? "✚" : "☢", u.x, u.y + bob);
  }

  for (const e of state.enemies) {
    ctx.fillStyle = `rgba(${e.col},0.92)`;
    drawShape(e.x, e.y, e.r, e.shape, e.rot);
    if (e.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, e.flash * 9)})`;
      drawShape(e.x, e.y, e.r, e.shape, e.rot);
    }
    if (e.elite) {
      ctx.strokeStyle = "rgba(255,210,80,0.85)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 6 + Math.sin(state.time * 5) * 2, 0, TAU);
      ctx.stroke();
    }
    if (e.boss) {
      ctx.fillStyle = "rgba(255,120,160,0.9)";
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 0.45 + Math.sin(state.time * 6) * 3, 0, TAU);
      ctx.fill();
      if (e.bstate === "tele") {
        ctx.strokeStyle = `rgba(255,60,60,${0.4 + 0.4 * Math.sin(state.time * 25)})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 18, 0, TAU);
        ctx.stroke();
      }
    }
  }

  ctx.fillStyle = "#eaf6ff";
  for (const b of state.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, TAU); ctx.fill(); }
  ctx.fillStyle = "#ffd7ec";
  for (const b of state.ebullets) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55, 0, TAU); ctx.fill(); }

  for (const m of state.missiles) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.ang);
    ctx.fillStyle = "#ffc89a";
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.lineTo(-5, -4); ctx.lineTo(-5, 4);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  if (state.bladePos) {
    for (const b of state.bladePos) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a + state.time * 4);
      ctx.fillStyle = "#ffc4ec";
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
  }

  for (const b of state.bolts) {
    ctx.strokeStyle = `rgba(255,255,255,${(b.t / 0.18) * 0.9})`;
    ctx.lineWidth = 1.5;
    strokeBolt(b);
  }

  /* player */
  const blink = p.ifr > 0 && p.dashT <= 0 && Math.floor(state.time * 18) % 2 === 0;
  ctx.globalAlpha = blink ? 0.4 : 1;
  ctx.fillStyle = "#eafffb";
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.85, 0, TAU); ctx.fill();
  const fa = p.face || p.moveAng;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(fa) * (p.r + 7), p.y + Math.sin(fa) * (p.r + 7));
  ctx.lineTo(p.x + Math.cos(fa + 2.5) * (p.r - 1), p.y + Math.sin(fa + 2.5) * (p.r - 1));
  ctx.lineTo(p.x + Math.cos(fa - 2.5) * (p.r - 1), p.y + Math.sin(fa - 2.5) * (p.r - 1));
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(0,255,217,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 3, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;

  /* damage texts */
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const t of state.texts) {
    const a = clamp(t.t / 0.5, 0, 1);
    ctx.font = t.crit ? "800 16px 'Segoe UI'" : "600 12px 'Segoe UI'";
    ctx.fillStyle = t.col ? t.col : (t.crit ? `rgba(255,210,90,${a})` : `rgba(190,240,255,${a})`);
    if (t.col) ctx.globalAlpha = a;
    ctx.fillText(t.txt, t.x, t.y);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  if (state.mode !== "menu") drawHUD();
  drawOverlayFX();
}

/* ---------------- HUD ---------------- */
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hudBar(x, y, w, h, frac, col) {
  ctx.fillStyle = "rgba(10,20,30,0.75)";
  rr(x, y, w, h, h / 2); ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = col;
    rr(x + 1.5, y + 1.5, Math.max(h - 3, (w - 3) * clamp(frac, 0, 1)), h - 3, (h - 3) / 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  rr(x, y, w, h, h / 2); ctx.stroke();
}

function drawHUD() {
  const p = state.player;
  /* HP + XP */
  hudBar(16, 16, 232, 15, p.hp / p.maxhp, p.hp / p.maxhp > 0.35 ? "rgba(90,255,170,0.9)" : "rgba(255,80,110,0.95)");
  ctx.font = "700 11px 'Segoe UI'";
  ctx.fillStyle = "#dffaff";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(Math.ceil(p.hp) + " / " + p.maxhp, 16 + 116, 16 + 8);
  hudBar(16, 36, 232, 9, state.xp / state.xpNeed, "rgba(0,255,217,0.9)");
  ctx.textAlign = "left";
  ctx.font = "700 13px 'Segoe UI'";
  ctx.fillStyle = "#9ff5ff";
  ctx.fillText("LV " + state.level, 16, 58);

  /* weapon chips */
  ctx.font = "600 14px 'Segoe UI'";
  let wx = 16;
  for (const k in WEAPON_DEFS) {
    const lvl = state.weapons[k].lvl;
    if (lvl <= 0) continue;
    ctx.fillStyle = WEAPON_DEFS[k].css;
    ctx.fillText(WEAPON_DEFS[k].icon + " " + lvl, wx, H - 22);
    wx += 52;
  }

  /* timer */
  ctx.textAlign = "center";
  ctx.font = "800 30px 'Segoe UI'";
  ctx.shadowColor = "rgba(0,255,217,0.8)"; ctx.shadowBlur = 14;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(fmtTime(state.time), W / 2, 32);
  ctx.shadowBlur = 0;

  /* boss bar */
  if (state.boss) {
    const bw = Math.min(440, W - 280), bx = (W - bw) / 2, by = 56;
    ctx.font = "700 12px 'Segoe UI'";
    ctx.fillStyle = "#ff9db4";
    ctx.fillText("OVERMIND", W / 2, by + 2);
    hudBar(bx, by + 10, bw, 11, state.boss.hp / state.boss.maxhp, "rgba(255,60,90,0.95)");
  }

  /* score block */
  ctx.textAlign = "right";
  ctx.font = "800 20px 'Segoe UI'";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(Math.floor(state.score).toLocaleString(), W - 16, 26);
  ctx.font = "600 12px 'Segoe UI'";
  ctx.fillStyle = "#8fd0e0";
  ctx.fillText("KILLS " + state.kills, W - 16, 46);
  ctx.fillText("BEST " + Math.max(bestData.score, Math.floor(state.score)).toLocaleString(), W - 16, 62);

  /* dash indicator */
  const cx = W - 60, cy = H - 52, R = 19;
  const frac = 1 - clamp(state.player.dashCd / 2.1, 0, 1);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  ctx.strokeStyle = frac >= 1 ? "rgba(0,255,217,0.95)" : "rgba(0,255,217,0.45)";
  ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = "700 9px 'Segoe UI'";
  ctx.fillStyle = frac >= 1 ? "#bffff2" : "#6fa8a0";
  ctx.fillText("DASH", cx, cy);

  /* announce */
  if (state.announce) {
    const a = clamp(state.announce.t / 0.5, 0, 1) * clamp((3.2 - state.announce.t) / 0.3, 0, 1);
    ctx.font = "800 26px 'Segoe UI'";
    ctx.shadowColor = "rgba(255,45,149,0.9)"; ctx.shadowBlur = 18;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillText(state.announce.txt, W / 2, H * 0.22);
    ctx.shadowBlur = 0;
  }

  /* touch joystick */
  if (stick) {
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(stick.ox, stick.oy, 46, 0, TAU); ctx.stroke();
    ctx.fillStyle = "rgba(0,255,217,0.4)";
    ctx.beginPath(); ctx.arc(stick.ox + stick.dx * 0.6, stick.oy + stick.dy * 0.6, 18, 0, TAU); ctx.fill();
  }
}

function drawOverlayFX() {
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, state.flash)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (state.hurtT > 0 && vigHurt) {
    ctx.globalAlpha = clamp(state.hurtT * 1.6, 0, 0.9);
    ctx.drawImage(vigHurt, 0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  const p = state.player;
  if (state.mode !== "menu" && p.hp / p.maxhp < 0.3 && vigHurt) {
    ctx.globalAlpha = 0.22 + 0.12 * Math.sin(state.time * 6);
    ctx.drawImage(vigHurt, 0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (vigDark) ctx.drawImage(vigDark, 0, 0, W, H);
}

/* ---------------- loop ---------------- */
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000;
  lastT = now;
  dt = Math.min(dt, 0.05);
  if (state.mode === "playing") update(dt);
  else if (state.mode === "menu") { state.cam.x += 18 * dt; state.cam.y += 6 * dt; }
  render();
}

/* ---------------- boot ---------------- */
resize();
newGame();
state.mode = "menu";
$("menuBest").textContent = bestData.score > 0
  ? "best score " + bestData.score.toLocaleString() + " · best time " + fmtTime(bestData.time)
  : "no runs yet — good luck";
updateMuteBtn(false);
requestAnimationFrame(frame);

/* debug handle (used by automated tests) */
window.__NS = {
  get state() { return state; },
  startGame, gainXP, spawnEnemy, spawnBoss, damagePlayer, openUpgrades, chooseUpgrade, doNuke,
};
