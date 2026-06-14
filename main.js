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
  if (tutOpen) { tutHandleKey(e); return; }
  if (arsenalOpen) { if (e.code === "Escape" || e.code === "Enter" || e.code === "Backspace") closeArsenal(); return; }
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
  if (state.mode !== "playing" || e.pointerType === "mouse") return;  // mouse uses keyboard, not the joystick
  if (!stick) stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
  /* dash is on its own button now — extra fingers no longer trigger it */
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

/* on-screen touch controls */
if (IS_MOBILE) document.body.classList.add("mobile");
$("dashBtn").addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); tryDash(); });
$("pauseBtn").addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); setPause(true); });
function updateDashBtn() {
  const b = $("dashBtn");
  if (!state.dashUnlocked) {
    const want = state.level < 10 ? "lockedLv" : "lockedBuy";
    if (b._cls !== want + curLang) { b.className = "mobctrl locked"; b.innerHTML = '»<span class="lbl">' + (state.level < 10 ? t("hudLv10") : t("hudBuy")) + '</span>'; b._cls = want + curLang; }
  } else if (state.player.dashCd > 0) {
    if (b._cls !== "cooling" + curLang) { b.className = "mobctrl cooling"; b.innerHTML = '»<span class="lbl">' + t("hudDash") + '</span>'; b._cls = "cooling" + curLang; }
  } else if (b._cls !== "ready" + curLang) { b.className = "mobctrl ready"; b.innerHTML = '»<span class="lbl">' + t("hudDash") + '</span>'; b._cls = "ready" + curLang; }
}

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
  announce(t("overdrive"));
}

function statRow(k, v, cls) { return `<span>${k}</span><b class="${cls || ""}">${v}</b>`; }

function fillStats(el) {
  const sc = Math.floor(state.score);
  const nb = sc > bestData.score;
  el.innerHTML =
    statRow(t("statUptime"), fmtTime(state.time)) +
    statRow(t("statLevel"), state.level) +
    statRow(t("statKills"), state.kills) +
    statRow(t("statScore"), sc.toLocaleString()) +
    statRow(t("statBest"), (nb ? sc : bestData.score).toLocaleString() + (nb ? t("statNew") : ""), nb ? "nb" : "");
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
/* Surge Dash unlocks at LV 10, then a cooldown cut is offered every 10 levels */
function dashCardAvailable() { return state.dashTaken < Math.min(6, Math.floor(state.level / 10)); }

function rollUpgrades() {
  const opts = [];
  for (const k in WEAPON_DEFS) if (state.weapons[k].lvl < 5) opts.push({ kind: "w", key: k });
  for (const k in PASSIVE_DEFS) if (state.passives[k] < 5) opts.push({ kind: "p", key: k });
  if (dashCardAvailable()) opts.push({ kind: "dash" });   // joins the pool randomly, like any other upgrade
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
      icon = def.icon; name = L(def.name); color = def.css; info = L(def.desc)[lvl];
      pips = lvl === 0 ? `<div class="new">${t("newWeapon")}</div>` : `<div class="pips">${pipsHTML(lvl + 1, 5)}</div>`;
    } else if (o.kind === "p") {
      const def = PASSIVE_DEFS[o.key], lvl = state.passives[o.key];
      icon = def.icon; name = L(def.name); color = def.css; info = L(def.desc);
      pips = `<div class="pips">${pipsHTML(lvl + 1, 5)}</div>`;
    } else if (o.kind === "dash") {
      icon = "»"; name = t("surgeDashName"); color = "#00ffd9";
      if (state.dashTaken === 0) {
        info = t("surgeDashUnlockDesc", state.dashCdMax);
        pips = `<div class="new" style="color:#00ffd9">${t("unlockPower")}</div>`;
      } else {
        const cur = state.dashCdMax, nxt = Math.max(2, cur - 1);
        info = t("surgeDashCutDesc");
        pips = `<div class="pips" style="color:#00ffd9">${cur}s → ${nxt}s</div>`;
      }
    } else {
      icon = "✚"; name = t("fieldRepairName"); color = "#ff5e9a"; info = t("fieldRepairDesc");
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
  } else if (o.kind === "dash") {
    state.dashTaken++;
    state.dashUnlocked = true;
    state.dashCdMax = Math.max(2, 8 - state.dashTaken);
    p.dashCd = 0;
    announce(state.dashTaken === 1 ? t("dashOnline") : t("dashCd", state.dashCdMax));
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

/* solar-panel field (replaces starfield + grid) — a repeating PV-cell pattern
   plus thicker aluminium panel frames every 6 cells */
const PANEL_CELL = 46, PANEL_BLOCK = PANEL_CELL * 6;
let panelPattern = null;
function makePanelTile() {
  const cell = PANEL_CELL, TH = themeColors();
  const c = document.createElement("canvas"); c.width = c.height = cell;
  const g = c.getContext("2d");
  const base = g.createLinearGradient(0, 0, cell, cell);
  base.addColorStop(0, TH.panelA); base.addColorStop(1, TH.panelB);
  g.fillStyle = base; g.fillRect(0, 0, cell, cell);
  g.fillStyle = TH.cell; g.fillRect(1.5, 1.5, cell - 3, cell - 3);
  g.strokeStyle = TH.cellBorder; g.lineWidth = 1;
  g.strokeRect(1.5, 1.5, cell - 3, cell - 3);
  g.strokeStyle = TH.busbar; g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cell / 3, 2); g.lineTo(cell / 3, cell - 2);
  g.moveTo(2 * cell / 3, 2); g.lineTo(2 * cell / 3, cell - 2);
  g.stroke();
  const sheen = g.createLinearGradient(0, 0, cell * 0.8, cell * 0.8);
  sheen.addColorStop(0, TH.sheen);
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = sheen; g.fillRect(1.5, 1.5, cell - 3, cell - 3);
  return c;
}
function drawSolarField(cam) {
  if (!panelPattern) panelPattern = ctx.createPattern(makePanelTile(), "repeat");
  const hw = viewHW() + 80, hh = viewHH() + 80;
  ctx.fillStyle = panelPattern;
  ctx.fillRect(cam.x - hw, cam.y - hh, hw * 2, hh * 2);
  const F = PANEL_BLOCK;
  const fx0 = Math.floor((cam.x - hw) / F) * F, fx1 = cam.x + hw;
  const fy0 = Math.floor((cam.y - hh) / F) * F, fy1 = cam.y + hh;
  ctx.beginPath();
  for (let x = fx0; x <= fx1; x += F) { ctx.moveTo(x, cam.y - hh); ctx.lineTo(x, fy1); }
  for (let y = fy0; y <= fy1; y += F) { ctx.moveTo(cam.x - hw, y); ctx.lineTo(fx1, y); }
  ctx.lineWidth = 3; ctx.strokeStyle = themeColors().frame; ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = themeColors().frameGlow; ctx.stroke();
}

/* battery (heal) + EMP (screen-clear) pickup icons */
function drawBattery(x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "#0a1f12"; ctx.strokeStyle = "#5effa0"; ctx.lineWidth = 2;
  rr(-8, -6, 15, 12, 2.5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#5effa0"; ctx.fillRect(7, -3, 2.5, 6);
  ctx.fillStyle = "#9dffc6";
  ctx.beginPath();
  ctx.moveTo(1.5, -4.5); ctx.lineTo(-3.5, 1); ctx.lineTo(-0.5, 1);
  ctx.lineTo(-2, 4.5); ctx.lineTo(3.5, -1); ctx.lineTo(0.5, -1); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawEMP(x, y, t) {
  ctx.save(); ctx.translate(x, y);
  const pulse = 1 + Math.sin(t * 6) * 0.14;
  ctx.strokeStyle = "#ffe75e"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 8.5 * pulse, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.arc(0, 0, 4.5 * pulse, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff6c2";
  ctx.beginPath();
  ctx.moveTo(2, -7); ctx.lineTo(-3, 1); ctx.lineTo(0, 1);
  ctx.lineTo(-2, 7); ctx.lineTo(4, -1); ctx.lineTo(1, -1); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* enemies drawn as recognisable electronic components, tinted by e.col */
function shade(col, f) {
  const p = col.split(",");
  return `rgb(${clamp(p[0] * f, 0, 255) | 0},${clamp(p[1] * f, 0, 255) | 0},${clamp(p[2] * f, 0, 255) | 0})`;
}
const LEAD = "#b9c6d6";
function drawEnemyIcon(e) {
  const s = e.r, main = `rgb(${e.col})`, dark = shade(e.col, 0.5), lite = shade(e.col, 1.45);
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.type !== "mini") ctx.rotate(Math.sin(e.rot) * 0.13);
  ctx.lineJoin = "round"; ctx.lineCap = "round";

  switch (e.type) {
    case "chaser": { /* resistor: banded body + axial leads */
      const w = s * 2.2, h = s * 1.0;
      ctx.strokeStyle = LEAD; ctx.lineWidth = Math.max(2, s * 0.18);
      ctx.beginPath(); ctx.moveTo(-w * 0.92, 0); ctx.lineTo(w * 0.92, 0); ctx.stroke();
      ctx.fillStyle = main; rr(-w / 2, -h / 2, w, h, h * 0.5); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = dark;
      for (const bx of [-w * 0.24, -w * 0.04, w * 0.18]) ctx.fillRect(bx - s * 0.07, -h / 2, s * 0.15, h);
      break;
    }
    case "speedy": { /* diode schematic: ▶| with leads */
      const w = s * 1.9;
      ctx.strokeStyle = LEAD; ctx.lineWidth = Math.max(2, s * 0.22);
      ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(w, 0); ctx.stroke();
      ctx.fillStyle = main;
      ctx.beginPath(); ctx.moveTo(-s * 0.9, -s * 0.95); ctx.lineTo(s * 0.75, 0); ctx.lineTo(-s * 0.9, s * 0.95); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = lite; ctx.lineWidth = Math.max(2.5, s * 0.3);
      ctx.beginPath(); ctx.moveTo(s * 0.75, -s * 1.0); ctx.lineTo(s * 0.75, s * 1.0); ctx.stroke();
      break;
    }
    case "tank": { /* transformer: two windings + iron core */
      ctx.fillStyle = main; ctx.strokeStyle = dark; ctx.lineWidth = 1.5;
      rr(-s * 0.95, -s * 0.82, s * 0.6, s * 1.64, s * 0.12); ctx.fill(); ctx.stroke();
      rr(s * 0.35, -s * 0.82, s * 0.6, s * 1.64, s * 0.12); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.5, s * 0.08);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(-s * 0.95, i * s * 0.42); ctx.lineTo(-s * 0.35, i * s * 0.42); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.35, i * s * 0.42); ctx.lineTo(s * 0.95, i * s * 0.42); ctx.stroke();
      }
      ctx.strokeStyle = lite; ctx.lineWidth = Math.max(3, s * 0.13);
      ctx.beginPath();
      ctx.moveTo(-s * 0.11, -s * 0.95); ctx.lineTo(-s * 0.11, s * 0.95);
      ctx.moveTo(s * 0.11, -s * 0.95); ctx.lineTo(s * 0.11, s * 0.95);
      ctx.stroke();
      break;
    }
    case "splitter": { /* transistor TO-92: D-body + 3 legs */
      ctx.strokeStyle = LEAD; ctx.lineWidth = Math.max(2, s * 0.12);
      for (const lx of [-s * 0.42, 0, s * 0.42]) { ctx.beginPath(); ctx.moveTo(lx, s * 0.25); ctx.lineTo(lx, s * 1.2); ctx.stroke(); }
      ctx.fillStyle = main; ctx.strokeStyle = dark; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-s * 0.9, s * 0.32); ctx.lineTo(s * 0.9, s * 0.32);
      ctx.arc(0, s * 0.32, s * 0.9, 0, Math.PI, true);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.5, s * 0.09);
      ctx.beginPath(); ctx.moveTo(-s * 0.55, s * 0.32); ctx.lineTo(s * 0.55, s * 0.32); ctx.stroke();
      break;
    }
    case "shooter": { /* actuator: solenoid coil + plunger */
      ctx.fillStyle = dark; rr(-s * 0.95, -s * 0.72, s * 1.5, s * 1.44, s * 0.22); ctx.fill();
      ctx.strokeStyle = main; ctx.lineWidth = Math.max(2, s * 0.16);
      for (let i = 0; i < 4; i++) { const x = -s * 0.72 + i * s * 0.38; ctx.beginPath(); ctx.moveTo(x, -s * 0.72); ctx.lineTo(x, s * 0.72); ctx.stroke(); }
      ctx.strokeStyle = "#cfd9e6"; ctx.lineWidth = Math.max(2.5, s * 0.26);
      ctx.beginPath(); ctx.moveTo(s * 0.55, 0); ctx.lineTo(s * 1.35, 0); ctx.stroke();
      ctx.fillStyle = lite; ctx.beginPath(); ctx.arc(s * 1.35, 0, s * 0.26, 0, TAU); ctx.fill();
      break;
    }
    default: { /* electron: charge dot with − */
      ctx.fillStyle = main; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = Math.max(1.4, s * 0.24);
      ctx.beginPath(); ctx.moveTo(-s * 0.5, 0); ctx.lineTo(s * 0.5, 0); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBossIcon(e) {
  const s = e.r, main = `rgb(${e.col})`, dark = shade(e.col, 0.5);
  ctx.save(); ctx.translate(e.x, e.y); ctx.lineJoin = "round";
  ctx.fillStyle = dark; drawShape(0, 0, s, 6, e.rot * 0.3);
  ctx.strokeStyle = main; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = `rgba(${e.col},0.92)`; drawShape(0, 0, s * 0.6, 6, -e.rot * 0.5);
  ctx.fillStyle = dark;
  for (let i = 0; i < 6; i++) { const a = e.rot * 0.3 + i * TAU / 6; ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.82, Math.sin(a) * s * 0.82, s * 0.08, 0, TAU); ctx.fill(); }
  const pc = 0.3 + Math.sin(state.time * 6) * 0.06;
  ctx.fillStyle = "#fff2b0"; ctx.beginPath(); ctx.arc(0, 0, s * pc, 0, TAU); ctx.fill();
  ctx.restore();
  if (e.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, e.flash * 9)})`; ctx.beginPath(); ctx.arc(e.x, e.y, s, 0, TAU); ctx.fill(); }
  if (e.bstate === "tele") {
    ctx.strokeStyle = `rgba(255,60,60,${0.4 + 0.4 * Math.sin(state.time * 25)})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(e.x, e.y, s + 18, 0, TAU); ctx.stroke();
  }
}

function render() {
  const cam = state.cam, p = state.player;
  ctx.fillStyle = themeColors().base;
  ctx.fillRect(0, 0, W, H);

  let sx = 0, sy = 0;
  if (state.shake > 0) {
    const m = state.shakeMag * Math.min(1, state.shake * 3);
    sx = rand(-m, m); sy = rand(-m, m);
  }
  ctx.save();
  ctx.translate(W / 2 + sx, H / 2 + sy);
  ctx.scale(ZOOM, ZOOM);
  ctx.translate(-cam.x, -cam.y);
  drawSolarField(cam);

  /* ===== glow pass ===== */
  ctx.globalCompositeOperation = "lighter";

  /* static fields */
  for (const f of state.fields) {
    const a = Math.min(1, f.life) * (0.5 + 0.18 * Math.sin(state.time * 14 + f.x));
    drawGlow(f.x, f.y, f.r * 0.55, "150,110,255", 0.22 * a);
    ctx.strokeStyle = `rgba(190,150,255,${0.5 * a})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
  }
  /* faraday aura */
  if (state.weapons.faraday.lvl > 0) {
    const fr = FARADAY[state.weapons.faraday.lvl - 1].r;
    ctx.strokeStyle = `rgba(134,247,255,${0.22 + 0.1 * Math.sin(state.time * 6)})`;
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.arc(p.x, p.y, fr, 0, TAU); ctx.stroke();
  }
  /* railgun beams */
  for (const b of state.beams) {
    const a = b.t / 0.16;
    ctx.strokeStyle = `rgba(255,120,150,${0.7 * a})`;
    ctx.lineWidth = b.w * 1.7 * a + 2;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
  }
  for (const n of state.novas) {
    const a = 1 - n.r / n.maxR;
    ctx.strokeStyle = `rgba(0,255,217,${0.5 * a})`;
    ctx.lineWidth = 16;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU); ctx.stroke();
  }
  for (const g of state.gems) drawGlow(g.x, g.y, 5 + Math.min(6, g.val * 1.5), "0,255,170", 0.7);
  for (const u of state.pickups) drawGlow(u.x, u.y, 11, u.kind === "heart" ? "90,255,160" : "255,230,80", 0.8);
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

  /* static field floor zones (under everything) */
  for (const f of state.fields) {
    const a = Math.min(1, f.life);
    ctx.fillStyle = `rgba(150,110,255,${0.10 * a})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(190,150,255,${(0.4 + 0.2 * Math.sin(state.time * 12 + f.y)) * a})`;
    ctx.lineWidth = 2; ctx.setLineDash([6, 7]); ctx.lineDashOffset = -state.time * 30;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r - 2, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  /* faraday aura floor ring */
  if (state.weapons.faraday.lvl > 0) {
    const fr = FARADAY[state.weapons.faraday.lvl - 1].r;
    ctx.fillStyle = "rgba(134,247,255,0.05)";
    ctx.beginPath(); ctx.arc(p.x, p.y, fr, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(134,247,255,${0.4 + 0.18 * Math.sin(state.time * 6)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, fr, 0, TAU); ctx.stroke();
  }

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
    const by = u.y + Math.sin(state.time * 4 + u.ph) * 3;
    if (u.kind === "heart") drawBattery(u.x, by);
    else drawEMP(u.x, by, state.time);
  }

  for (const e of state.enemies) {
    if (e.boss) { drawBossIcon(e); continue; }
    drawEnemyIcon(e);
    if (e.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, e.flash * 9)})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.92, 0, TAU); ctx.fill();
    }
    if (e.elite) {
      ctx.strokeStyle = "rgba(255,210,80,0.9)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 9 + Math.sin(state.time * 5) * 2, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 15, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(e.hp / e.maxhp, 0, 1));
      ctx.stroke();
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

  /* railgun beam core */
  for (const b of state.beams) {
    const a = b.t / 0.16;
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = Math.max(2, b.w * 0.5 * a);
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
  }

  /* player = the BGW logo (in front), with the turret barrel behind it */
  const blink = p.ifr > 0 && p.dashT <= 0 && Math.floor(state.time * 18) % 2 === 0;
  const fa = p.face || p.moveAng;
  const L = p.r * 4.2, recoil = p.muzzle > 0 ? -3 : 0;
  ctx.globalAlpha = blink ? 0.5 : 1;

  /* barrel turret BEHIND the logo (rotates toward nearest enemy, recoils when firing) */
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(fa);
  ctx.fillStyle = "#16313e";
  rr(recoil - 1, -4.5, L + 2, 9, 3.5); ctx.fill();
  ctx.fillStyle = "#bfe9ff";
  rr(recoil, -3, L, 6, 3); ctx.fill();
  ctx.fillStyle = p.muzzle > 0 ? "#ffffff" : "#00ffd9";
  rr(recoil + L - 4, -4, 6, 8, 2); ctx.fill();
  ctx.restore();

  /* logo body IN FRONT (a touch bigger) */
  if (logoCanvas) {
    const lw = p.r * 4.6, lh = lw * (logoCanvas.height / logoCanvas.width);
    ctx.drawImage(logoCanvas, p.x - lw / 2, p.y - lh / 2, lw, lh);
  } else {
    ctx.fillStyle = "#eafffb";
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.95, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* muzzle flash at the protruding barrel tip */
  if (p.muzzle > 0) {
    const tx = p.x + Math.cos(fa) * (L + 4), ty = p.y + Math.sin(fa) * (L + 4);
    drawGlow(tx, ty, 9, "200,242,255", p.muzzle / 0.07);
  }

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
    ctx.fillText(t("bossName"), W / 2, by + 2);
    hudBar(bx, by + 10, bw, 11, state.boss.hp / state.boss.maxhp, "rgba(255,60,90,0.95)");
  }

  /* score block (pushed down on touch to clear the corner buttons) */
  const sy0 = IS_MOBILE ? 64 : 26;
  ctx.textAlign = "right";
  ctx.font = "800 20px 'Segoe UI'";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(Math.floor(state.score).toLocaleString(), W - 16, sy0);
  ctx.font = "600 12px 'Segoe UI'";
  ctx.fillStyle = "#8fd0e0";
  ctx.fillText(t("statKills") + " " + state.kills, W - 16, sy0 + 20);
  ctx.fillText(t("statBest") + " " + Math.max(bestData.score, Math.floor(state.score)).toLocaleString(), W - 16, sy0 + 36);

  /* dash indicator — on mobile the on-screen DASH button replaces this ring */
  if (!IS_MOBILE) {
    const cx = W - 60, cy = H - 52, R = 19;
    ctx.textAlign = "center";
    if (state.dashUnlocked) {
      const frac = 1 - clamp(state.player.dashCd / state.dashCdMax, 0, 1);
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = frac >= 1 ? "rgba(0,255,217,0.95)" : "rgba(0,255,217,0.45)";
      ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
      ctx.font = "700 9px 'Segoe UI'";
      ctx.fillStyle = frac >= 1 ? "#bffff2" : "#6fa8a0";
      ctx.fillText(t("hudDash"), cx, cy);
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.font = "700 8px 'Segoe UI'";
      ctx.fillStyle = "#5a7a86";
      ctx.fillText(t("hudDash"), cx, cy - 4);
      ctx.fillText(state.level < 10 ? t("hudLv10") : t("hudBuy"), cx, cy + 6);
    }
  }

  /* announce — always centred on screen, font shrinks to fit narrow viewports */
  if (state.announce) {
    const a = clamp(state.announce.t / 0.5, 0, 1) * clamp((3.2 - state.announce.t) / 0.3, 0, 1);
    const fs = Math.round(clamp(W / 26, 15, 26));
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "800 " + fs + "px 'Segoe UI'";
    ctx.shadowColor = "rgba(255,45,149,0.9)"; ctx.shadowBlur = 18;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillText(state.announce.txt, W / 2, H * 0.2);
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
let bodyIngame = false;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000;
  lastT = now;
  dt = Math.min(dt, 0.05);
  if (state.mode === "playing") update(dt);
  else if (state.mode === "menu") { state.cam.x += 18 * dt; state.cam.y += 6 * dt; }
  render();
  if (IS_MOBILE) {
    const ig = state.mode === "playing";
    if (ig !== bodyIngame) { document.body.classList.toggle("ingame", ig); bodyIngame = ig; }
    if (ig) updateDashBtn();
  }
}

/* ---------------- tutorial / intro demo ---------------- */
let tutOpen = false, tutIdx = 0, tutMode = "menu";
const TUT_SLIDES = [
  { k: 1,
    vis: `<svg viewBox="0 0 280 152" width="240" height="130"><g font-family="Segoe UI,sans-serif" font-weight="700" font-size="13" text-anchor="middle"><rect x="55" y="34" width="26" height="26" rx="5" fill="#0e2740" stroke="#2c5b78"/><text x="68" y="52" fill="#cfeefe">W</text><rect x="26" y="64" width="26" height="26" rx="5" fill="#0e2740" stroke="#2c5b78"/><text x="39" y="82" fill="#cfeefe">A</text><rect x="55" y="64" width="26" height="26" rx="5" fill="#0e2740" stroke="#2c5b78"/><text x="68" y="82" fill="#cfeefe">S</text><rect x="84" y="64" width="26" height="26" rx="5" fill="#0e2740" stroke="#2c5b78"/><text x="97" y="82" fill="#cfeefe">D</text></g><circle cx="205" cy="76" r="17" fill="#eafffb"/><circle cx="205" cy="76" r="21" fill="none" stroke="#00ffd9" stroke-width="2"/><g stroke="#00ffd9" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.85"><path d="M205 40 l-7 9 M205 40 l7 9"/><path d="M205 112 l-7 -9 M205 112 l7 -9"/><path d="M169 76 l9 -7 M169 76 l9 7"/><path d="M241 76 l-9 -7 M241 76 l-9 7"/></g></svg>` },
  { k: 2,
    vis: `<svg viewBox="0 0 280 152" width="240" height="130"><circle cx="58" cy="76" r="16" fill="#eafffb"/><circle cx="58" cy="76" r="20" fill="none" stroke="#00ffd9" stroke-width="2"/><polygon points="80,76 69,82 69,70" fill="#00ffd9"/><circle cx="118" cy="76" r="4" fill="#bfe6ff"/><circle cx="148" cy="76" r="4" fill="#bfe6ff"/><circle cx="178" cy="76" r="4" fill="#bfe6ff"/><g transform="translate(228,76)"><line x1="-30" y1="0" x2="30" y2="0" stroke="#b9c6d6" stroke-width="4" stroke-linecap="round"/><rect x="-20" y="-9" width="40" height="18" rx="9" fill="#ff8040" stroke="#7a3a17" stroke-width="1.5"/><rect x="-9" y="-9" width="4" height="18" fill="#7a3a17"/><rect x="3" y="-9" width="4" height="18" fill="#7a3a17"/></g></svg>` },
  { k: 3,
    vis: `<svg viewBox="0 0 280 152" width="240" height="130"><g transform="translate(48,58) rotate(20)"><rect x="-8" y="-8" width="16" height="16" rx="3" fill="#7dffd2"/></g><g transform="translate(80,96) rotate(-15)"><rect x="-7" y="-7" width="14" height="14" rx="3" fill="#7dffd2"/></g><g transform="translate(108,52) rotate(10)"><rect x="-9" y="-9" width="18" height="18" rx="3" fill="#ffe27a"/></g><rect x="150" y="62" width="104" height="15" rx="7" fill="rgba(8,20,30,0.8)" stroke="rgba(255,255,255,0.2)"/><rect x="152" y="64" width="74" height="11" rx="5" fill="#00ffd9"/><text x="202" y="104" text-anchor="middle" font-family="Segoe UI,sans-serif" font-weight="800" font-size="15" fill="#fff">LEVEL UP</text></svg>` },
  { k: 4,
    vis: `<svg viewBox="0 0 280 152" width="240" height="130"><rect x="26" y="62" width="66" height="28" rx="6" fill="#0e2740" stroke="#00ffd9"/><text x="59" y="81" text-anchor="middle" font-family="Segoe UI,sans-serif" font-weight="700" font-size="13" fill="#bffff2">SHIFT</text><circle cx="146" cy="76" r="8" fill="rgba(0,255,217,0.2)"/><circle cx="168" cy="76" r="11" fill="rgba(0,255,217,0.35)"/><circle cx="196" cy="76" r="15" fill="#eafffb"/><circle cx="196" cy="76" r="19" fill="none" stroke="#00ffd9" stroke-width="2"/><polygon points="217,76 206,82 206,70" fill="#00ffd9"/><g transform="translate(238,42)"><circle r="18" fill="#0e2740" stroke="#ffd75e" stroke-width="2"/><text y="5" text-anchor="middle" font-family="Segoe UI,sans-serif" font-weight="800" font-size="12" fill="#ffd75e">LV10</text></g></svg>` },
  { k: 5,
    vis: `<svg viewBox="0 0 280 152" width="240" height="130"><g transform="translate(66,68)"><polygon points="28,0 14,24 -14,24 -28,0 -14,-24 14,-24" fill="#7a1428" stroke="#ff2850" stroke-width="2.5"/><polygon points="16,0 8,14 -8,14 -16,0 -8,-14 8,-14" fill="#ff2850"/><circle r="8" fill="#fff2b0"/></g><text x="66" y="116" text-anchor="middle" font-family="Segoe UI,sans-serif" font-weight="700" font-size="11" fill="#ff9db4">OVERLOAD · 5:00</text><g transform="translate(168,64)"><rect x="-15" y="-11" width="28" height="22" rx="4" fill="#0a1f12" stroke="#5effa0" stroke-width="2"/><rect x="13" y="-5" width="4" height="10" fill="#5effa0"/><text x="-1" y="38" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="11" fill="#9dffc6">heal</text></g><g transform="translate(228,64)"><circle r="14" fill="none" stroke="#ffe75e" stroke-width="2"/><circle r="7" fill="none" stroke="#ffe75e" stroke-width="2" opacity="0.6"/><text x="0" y="38" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="11" fill="#ffe75e">clear</text></g></svg>` },
];
function renderTut() {
  const s = TUT_SLIDES[tutIdx];
  $("tutVis").innerHTML = s.vis;
  $("tutHead").textContent = t("tut" + s.k + "h");
  $("tutBody").textContent = t("tut" + s.k + "b");
  $("tutDots").innerHTML = TUT_SLIDES.map((_, i) => `<span class="${i === tutIdx ? "on" : ""}"></span>`).join("");
  $("tutPrev").disabled = tutIdx === 0;
  $("tutNext").textContent = tutIdx === TUT_SLIDES.length - 1 ? (tutMode === "intro" ? t("startBtn2") : t("done")) : t("next");
  $("tutSkip").style.display = tutMode === "intro" ? "" : "none";
}
function openTutorial(mode) {
  tutMode = mode; tutIdx = 0; tutOpen = true;
  hide(menuEl); renderTut(); show($("tutorial"));
}
function endTutorial() {
  tutOpen = false; hide($("tutorial"));
  try { localStorage.setItem("bgw_seen_tut", "1"); } catch (e) {}
  if (tutMode === "intro") { AudioSys.init(); startGame(); }
  else { state.mode = "menu"; show(menuEl); }
}
function tutNext() { if (tutIdx < TUT_SLIDES.length - 1) { tutIdx++; renderTut(); } else endTutorial(); }
function tutPrev() { if (tutIdx > 0) { tutIdx--; renderTut(); } }
function tutHandleKey(e) {
  if (e.code === "ArrowRight" || e.code === "Enter" || e.code === "Space") tutNext();
  else if (e.code === "ArrowLeft" || e.code === "Backspace") tutPrev();
  else if (e.code === "Escape") endTutorial();
}
$("howToBtn").onclick = e => { e.currentTarget.blur(); AudioSys.init(); openTutorial("menu"); };
$("tutNext").onclick = e => { e.currentTarget.blur(); tutNext(); };
$("tutPrev").onclick = e => { e.currentTarget.blur(); tutPrev(); };
$("tutSkip").onclick = e => { e.currentTarget.blur(); endTutorial(); };

/* ---------------- power-ups codex ---------------- */
let arsenalOpen = false;
function arsItem(icon, color, name, desc) {
  return `<div class="arsItem"><div class="ai" style="color:${color}">${icon}</div><div><h4>${name}</h4><p>${desc}</p></div></div>`;
}
function buildArsenal() {
  let h = `<div class="arsSection">${t("arsWeapons")}</div><div class="arsGrid">`;
  for (const k in WEAPON_DEFS) { const d = WEAPON_DEFS[k]; h += arsItem(d.icon, d.css, L(d.name), L(d.desc)[0]); }
  h += `</div><div class="arsSection">${t("arsPassives")}</div><div class="arsGrid">`;
  for (const k in PASSIVE_DEFS) { const d = PASSIVE_DEFS[k]; h += arsItem(d.icon, d.css, L(d.name), L(d.desc)); }
  h += `</div><div class="arsSection">${t("arsAbility")}</div><div class="arsGrid">`;
  h += arsItem("»", "#00ffd9", t("surgeDashName"), t("surgeDashCodex"));
  h += arsItem("▮", "#5effa0", t("batteryName"), t("batteryDesc"));
  h += arsItem("◎", "#ffe75e", t("empName"), t("empDesc"));
  h += arsItem("✚", "#ff5e9a", t("fieldRepairName"), t("repairCodexDesc"));
  h += `</div>`;
  $("arsenalList").innerHTML = h;
}
function openArsenal() { arsenalOpen = true; buildArsenal(); hide(menuEl); show($("arsenal")); }
function closeArsenal() { arsenalOpen = false; hide($("arsenal")); show(menuEl); }
$("powerBtn").onclick = e => { e.currentTarget.blur(); AudioSys.init(); openArsenal(); };
$("arsenalBack").onclick = e => { e.currentTarget.blur(); closeArsenal(); };

/* company logo → drawn as the player avatar (pre-rasterised once for speed) */
const logoImg = new Image();
let logoCanvas = null;
logoImg.onload = () => {
  const lw = 360, lh = Math.max(1, Math.round(lw * logoImg.height / logoImg.width));
  const c = document.createElement("canvas");
  c.width = lw; c.height = lh;
  c.getContext("2d").drawImage(logoImg, 0, 0, lw, lh);
  logoCanvas = c;
};
function loadLogo() { logoCanvas = null; logoImg.src = themeLogo(); }

/* ---------------- language + theme ---------------- */
function updateMenuBest() {
  $("menuBest").textContent = bestData.score > 0
    ? t("menuBestRecord", bestData.score.toLocaleString(), fmtTime(bestData.time))
    : t("menuBestFirst");
}
function applyLang() {
  document.documentElement.lang = curLang;
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.getAttribute("data-i18n")); });
  document.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
  const ni = $("nameInput"); if (ni) ni.placeholder = t("namePlaceholder");
  document.querySelectorAll("[data-lang]").forEach(b => b.classList.toggle("on", b.getAttribute("data-lang") === curLang));
  updateMenuBest();
  if (arsenalOpen) buildArsenal();
  if (tutOpen) renderTut();
  if (typeof lbRenderMenu === "function") lbRenderMenu();
}
function rebuildThemeAssets() {
  panelPattern = null;
  vigDark = makeRadialOverlay(themeVignette());
  loadLogo();
  document.querySelectorAll(".brandLogo").forEach(img => { img.src = themeLogo(); });
}
function applyTheme() {
  document.body.classList.toggle("light", curTheme === "light");
  document.querySelectorAll("[data-theme]").forEach(b => b.classList.toggle("on", b.getAttribute("data-theme") === curTheme));
  rebuildThemeAssets();
}
function setLang(l) { if (l === "en" || l === "hr") { curLang = l; saveLang(); applyLang(); } }
function setTheme(th) { if (th === "dark" || th === "light") { curTheme = th; saveTheme(); applyTheme(); } }
document.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", e => { e.currentTarget.blur(); setLang(b.getAttribute("data-lang")); }));
document.querySelectorAll("[data-theme]").forEach(b => b.addEventListener("click", e => { e.currentTarget.blur(); setTheme(b.getAttribute("data-theme")); }));

/* ---------------- boot ---------------- */
resize();
newGame();
state.mode = "menu";
applyTheme();
applyLang();
updateMuteBtn(false);
requestAnimationFrame(frame);

/* first-time players get the intro demo automatically */
let seenTut = false;
try { seenTut = !!localStorage.getItem("bgw_seen_tut"); } catch (e) {}
if (!seenTut) openTutorial("intro");

/* debug handle (used by automated tests) */
window.__NS = {
  get state() { return state; },
  startGame, gainXP, spawnEnemy, spawnBoss, damagePlayer, openUpgrades, chooseUpgrade, doNuke,
  tryDash, openTutorial, tutNext, get tutOpen() { return tutOpen; }, rollUpgrades,
  openArsenal, setLang, setTheme, get lang() { return curLang; }, get theme() { return curTheme; },
};
