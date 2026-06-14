"use strict";
/* ============================================================
   NEON SWARM — leaderboard.js
   global top-100 via /api/scores (Cloudflare Pages Function + D1)
   degrades gracefully when the API is absent (local play)
   ============================================================ */

const LB = {
  api: "/api/scores",
  available: null,   // null = not checked yet
  cache: [],
  run: null,         // {score, time} captured at game over
  submitted: false,
  busy: false,
};

function lbEsc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function lbFetch() {
  try {
    const ctl = new AbortController();
    const tid = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(LB.api, { signal: ctl.signal });
    clearTimeout(tid);
    if (!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    LB.cache = Array.isArray(j.scores) ? j.scores : [];
    LB.available = true;
  } catch (e) {
    LB.available = false;
  }
  return LB.cache;
}

function lbRowsHTML(list, n, meName, meScore) {
  let html = "";
  for (let i = 0; i < Math.min(n, list.length); i++) {
    const s = list[i];
    const me = meName && s.name === meName && Number(s.score) === meScore;
    html += `<div class="lbRow${me ? " me" : ""}"><span class="rk">${i + 1}</span><span>${lbEsc(s.name)}</span><span>${Number(s.score).toLocaleString()}</span></div>`;
  }
  return html || `<div class="lbRow"><span class="rk">—</span><span>${t("lbNoScores")}</span><span></span></div>`;
}

async function lbRenderMenu() {
  const el = document.getElementById("menuBoard");
  if (!el) return;
  await lbFetch();
  if (!LB.available) return; /* stays hidden in local play */
  el.innerHTML = `<h4>${t("lbMenuTitle")}</h4>` + lbRowsHTML(LB.cache, 5);
  el.classList.remove("hidden");
}

/* called by gameOver() in main.js */
function lbOnGameOver() {
  LB.run = { score: Math.floor(state.score), time: state.time };
  LB.submitted = false;
  const form = document.getElementById("lbForm");
  const status = document.getElementById("lbStatus");
  const board = document.getElementById("overBoard");
  form.classList.add("hidden");
  status.classList.add("hidden");
  board.classList.add("hidden");
  lbFetch().then(() => {
    if (state.mode !== "over") return; /* player already restarted */
    if (!LB.available) {
      status.textContent = t("lbOffline");
      status.classList.remove("hidden");
      return;
    }
    const inp = document.getElementById("nameInput");
    try { inp.value = localStorage.getItem("neonswarm_name") || ""; } catch (e) {}
    form.classList.remove("hidden");
    board.innerHTML = `<h4>${t("lbTop10")}</h4>` + lbRowsHTML(LB.cache, 10);
    board.classList.remove("hidden");
  });
}

async function lbSubmit() {
  if (LB.busy || LB.submitted || !LB.run) return;
  const inp = document.getElementById("nameInput");
  const btn = document.getElementById("submitScoreBtn");
  const status = document.getElementById("lbStatus");
  const board = document.getElementById("overBoard");
  const name = inp.value.replace(/[^\w .\-]/g, "").trim().slice(0, 16).toUpperCase();
  if (!name) { inp.focus(); return; }
  try { localStorage.setItem("neonswarm_name", name); } catch (e) {}
  LB.busy = true;
  btn.disabled = true;
  btn.textContent = "…";
  try {
    const r = await fetch(LB.api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, score: LB.run.score, time: LB.run.time }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "submit failed");
    LB.submitted = true;
    document.getElementById("lbForm").classList.add("hidden");
    status.textContent = t("lbRank", j.rank, name);
    status.classList.remove("hidden");
    await lbFetch();
    board.innerHTML = `<h4>${t("lbTop10")}</h4>` + lbRowsHTML(LB.cache, 10, name, LB.run.score);
    board.classList.remove("hidden");
    sfx("levelup");
  } catch (e) {
    status.textContent = t("lbSubmitFail") + (e.message || "TRY AGAIN").toUpperCase();
    status.classList.remove("hidden");
  }
  LB.busy = false;
  btn.disabled = false;
  btn.textContent = "SUBMIT";
}

document.getElementById("submitScoreBtn").addEventListener("click", lbSubmit);
document.getElementById("nameInput").addEventListener("keydown", e => {
  e.stopPropagation(); /* keep game hotkeys (R = restart!) out of typing */
  if (e.key === "Enter") lbSubmit();
});

lbRenderMenu();
