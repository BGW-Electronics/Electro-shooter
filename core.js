"use strict";
/* ============================================================
   NEON SWARM — core.js
   utils · canvas · glow sprites · audio synth · data tables · state
   ============================================================ */

const TAU = Math.PI * 2;
const rand   = (a, b) => a + Math.random() * (b - a);
const randi  = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const clamp  = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp   = (a, b, t) => a + (b - a) * t;
const choice = a => a[(Math.random() * a.length) | 0];
const dist2  = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function hash2(x, y) { let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ":" + (s < 10 ? "0" : "") + s; }

/* ---------------- canvas ---------------- */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let W = innerWidth, H = innerHeight;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
let vigDark = null, vigHurt = null;
/* true only for actual phones/tablets — NOT touch-capable laptops (which keep
   the full desktop view). a laptop with a touchscreen still has a fine pointer. */
const IS_MOBILE = (function () {
  const mm = window.matchMedia ? window.matchMedia.bind(window) : null;
  const coarse = mm && mm("(pointer: coarse)").matches;
  const anyFine = mm && mm("(any-pointer: fine)").matches;
  const ua = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent || "");
  return ua || (coarse && !anyFine);
})();
/* world zoom: phones zoom out to see more of the arena; desktop stays 1:1. */
let ZOOM = IS_MOBILE ? 0.78 : 1;
/* visible world half-extents (account for zoom) — used for spawning + background fill */
function viewHW() { return (W / 2) / ZOOM; }
function viewHH() { return (H / 2) / ZOOM; }

function makeRadialOverlay(col) {
  const c = document.createElement("canvas");
  c.width = Math.max(2, W); c.height = Math.max(2, H);
  const g = c.getContext("2d");
  const r = Math.hypot(W, H) / 2;
  const gr = g.createRadialGradient(W / 2, H / 2, r * 0.42, W / 2, H / 2, r);
  gr.addColorStop(0, "rgba(0,0,0,0)");
  gr.addColorStop(1, col);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  return c;
}
function resize() {
  W = innerWidth; H = innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px"; canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  vigDark = makeRadialOverlay(typeof themeVignette === "function" ? themeVignette() : "rgba(0,0,14,0.55)");
  vigHurt = makeRadialOverlay("rgba(255,20,55,0.55)");
}
addEventListener("resize", resize);

/* ---------------- glow sprite cache ---------------- */
const glowCache = new Map();
function glowSprite(col, r) {
  r = Math.max(2, Math.round(r));
  const key = col + "|" + r;
  let c = glowCache.get(key);
  if (c) return c;
  const s = r * 5;
  c = document.createElement("canvas"); c.width = c.height = s;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, `rgba(${col},0.9)`);
  gr.addColorStop(0.35, `rgba(${col},0.30)`);
  gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  glowCache.set(key, c);
  return c;
}
function drawGlow(x, y, r, col, alpha) {
  const s = glowSprite(col, r);
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.drawImage(s, x - s.width / 2, y - s.height / 2);
  ctx.globalAlpha = 1;
}

/* ---------------- audio ---------------- */
const AudioSys = {
  ctx: null, master: null, musicGain: null, muted: false, started: false,
  step: 0, nextT: 0,
  init() {
    if (this.started) return;
    this.started = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.15;
      this.musicGain.connect(this.master);
      this.startMusic();
    } catch (e) { this.ctx = null; }
  },
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  },
  tone(o) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (o.delay || 0);
    const osc = this.ctx.createOscillator(), g = this.ctx.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(Math.max(1, o.f0), t);
    if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + o.dur + 0.05);
  },
  noise(o) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (o.delay || 0);
    const len = Math.max(16, Math.ceil(this.ctx.sampleRate * o.dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = o.ftype || "lowpass";
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(o.vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + o.dur + 0.02);
  },
  /* --- tiny procedural music: A-minor pentatonic bass + pad + hats --- */
  mnote(f, t, dur, vol) {
    const osc = this.ctx.createOscillator(), g = this.ctx.createGain(), lp = this.ctx.createBiquadFilter();
    osc.type = "square"; osc.frequency.value = f;
    lp.type = "lowpass"; lp.frequency.value = 620;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp); lp.connect(g); g.connect(this.musicGain);
    osc.start(t); osc.stop(t + dur + 0.05);
  },
  mhat(t) {
    const len = Math.ceil(this.ctx.sampleRate * 0.035);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const hp = this.ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    src.connect(hp); hp.connect(g); g.connect(this.musicGain);
    src.start(t); src.stop(t + 0.05);
  },
  mpad(t, dur, f1, f2) {
    for (const f of [f1, f1 * 1.005, f2]) {
      const osc = this.ctx.createOscillator(), g = this.ctx.createGain(), lp = this.ctx.createBiquadFilter();
      osc.type = "sawtooth"; osc.frequency.value = f;
      lp.type = "lowpass"; lp.frequency.value = 850;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.035, t + dur * 0.35);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      osc.connect(lp); lp.connect(g); g.connect(this.musicGain);
      osc.start(t); osc.stop(t + dur + 0.1);
    }
  },
  startMusic() {
    if (!this.ctx) return;
    const bpm = 112, stepDur = (60 / bpm) / 2; // 8th notes
    const bassSemi = [0, 0, 7, 0, 10, 0, 7, 5, 0, 0, 7, 0, 12, 10, 7, 5];
    const bassOn   = [1, 0, 1, 0, 1,  0, 1, 1, 1, 0, 1, 0, 1,  1,  1, 1];
    const pads = [[110, 164.81], [110, 164.81], [87.31, 130.81], [98, 146.83]];
    this.nextT = this.ctx.currentTime + 0.1;
    setInterval(() => {
      if (!this.ctx) return;
      while (this.nextT < this.ctx.currentTime + 0.18) {
        const s = this.step % 16, bar = Math.floor(this.step / 16) % 4;
        if (bassOn[s]) this.mnote(55 * Math.pow(2, bassSemi[s] / 12), this.nextT, stepDur * 0.9, 0.5);
        if (s % 4 === 2) this.mhat(this.nextT);
        if (s === 0) this.mpad(this.nextT, stepDur * 16, pads[bar][0], pads[bar][1]);
        this.step++;
        this.nextT += stepDur;
      }
    }, 40);
  }
};

const sfxLast = {};
function sfx(name) {
  if (!AudioSys.ctx || AudioSys.muted) return;
  const now = performance.now();
  const throttle = { shoot: 60, hit: 45, gem: 35, kill: 50, boom: 80 }[name] || 0;
  if (throttle && sfxLast[name] && now - sfxLast[name] < throttle) return;
  sfxLast[name] = now;
  const A = AudioSys;
  switch (name) {
    case "shoot":   A.tone({ type: "square",   f0: rand(700, 820), f1: 420, dur: 0.07, vol: 0.04 }); break;
    case "hit":     A.tone({ type: "triangle", f0: 300, f1: 180, dur: 0.05, vol: 0.05 }); break;
    case "kill":    A.noise({ f0: 900, f1: 180, dur: 0.16, vol: 0.11 });
                    A.tone({ type: "sine", f0: 320, f1: 90, dur: 0.16, vol: 0.06 }); break;
    case "gem":     A.tone({ type: "sine", f0: rand(660, 740), f1: 1100, dur: 0.07, vol: 0.05 }); break;
    case "heart":   A.tone({ type: "sine", f0: 500, f1: 900, dur: 0.14, vol: 0.12 }); break;
    case "hurt":    A.tone({ type: "sawtooth", f0: 220, f1: 70, dur: 0.25, vol: 0.2 });
                    A.noise({ f0: 700, f1: 150, dur: 0.12, vol: 0.1 }); break;
    case "dash":    A.noise({ ftype: "highpass", f0: 400, f1: 2600, dur: 0.16, vol: 0.12 }); break;
    case "nova":    A.tone({ type: "sine", f0: 150, f1: 55, dur: 0.35, vol: 0.17 });
                    A.noise({ f0: 1200, f1: 120, dur: 0.3, vol: 0.09 }); break;
    case "zap":     A.noise({ ftype: "highpass", f0: 2500, f1: 800, dur: 0.09, vol: 0.1 });
                    A.tone({ type: "square", f0: 1400, f1: 220, dur: 0.08, vol: 0.05 }); break;
    case "missile": A.noise({ f0: 600, f1: 1400, dur: 0.13, vol: 0.06 }); break;
    case "rail":    A.noise({ ftype: "highpass", f0: 3200, f1: 400, dur: 0.18, vol: 0.13 });
                    A.tone({ type: "sawtooth", f0: 700, f1: 130, dur: 0.18, vol: 0.08 }); break;
    case "field":   A.tone({ type: "sine", f0: 180, f1: 90, dur: 0.18, vol: 0.06 });
                    A.noise({ ftype: "highpass", f0: 1600, f1: 600, dur: 0.14, vol: 0.05 }); break;
    case "boom":    A.noise({ f0: 700, f1: 80, dur: 0.3, vol: 0.18 }); break;
    case "bigboom": A.noise({ f0: 900, f1: 50, dur: 0.7, vol: 0.3 });
                    A.tone({ type: "sine", f0: 110, f1: 35, dur: 0.7, vol: 0.25 }); break;
    case "levelup": [523, 659, 784, 1046].forEach((f, i) => A.tone({ type: "triangle", f0: f, dur: 0.12, vol: 0.11, delay: i * 0.08 })); break;
    case "pick":    A.tone({ type: "triangle", f0: 880, f1: 1320, dur: 0.1, vol: 0.1 }); break;
    case "boss":    A.tone({ type: "sawtooth", f0: 85, f1: 42, dur: 0.9, vol: 0.25 });
                    A.noise({ f0: 400, f1: 60, dur: 0.9, vol: 0.15 }); break;
    case "win":     [392, 523, 659, 784, 1046].forEach((f, i) => A.tone({ type: "triangle", f0: f, dur: 0.22, vol: 0.12, delay: i * 0.12 })); break;
    case "gameover":A.tone({ type: "sawtooth", f0: 160, f1: 38, dur: 1.1, vol: 0.18 }); break;
  }
}

/* ---------------- data tables ---------------- */
/* weapon stats per level (index = level-1) */
const BLASTER = [
  { dmg: 9,  int: 0.55, n: 1 },
  { dmg: 10, int: 0.48, n: 2 },
  { dmg: 12, int: 0.38, n: 2 },
  { dmg: 13, int: 0.36, n: 3 },
  { dmg: 16, int: 0.28, n: 4 },
];
const ORBIT = [
  { n: 2, dmg: 12, spd: 2.4, rad: 78 },
  { n: 3, dmg: 14, spd: 2.7, rad: 86 },
  { n: 4, dmg: 17, spd: 3.0, rad: 94 },
  { n: 5, dmg: 20, spd: 3.3, rad: 102 },
  { n: 7, dmg: 25, spd: 3.7, rad: 114 },
];
const NOVA = [
  { int: 4.0, dmg: 20, r: 150 },
  { int: 3.5, dmg: 26, r: 178 },
  { int: 3.0, dmg: 33, r: 206 },
  { int: 2.5, dmg: 40, r: 238 },
  { int: 1.9, dmg: 52, r: 285 },
];
const LIGHTNING = [
  { int: 2.6, dmg: 16, chain: 3 },
  { int: 2.3, dmg: 20, chain: 4 },
  { int: 2.0, dmg: 25, chain: 5 },
  { int: 1.7, dmg: 31, chain: 6 },
  { int: 1.3, dmg: 40, chain: 8 },
];
const MISSILE = [
  { int: 3.0, dmg: 26, n: 1, r: 70 },
  { int: 2.7, dmg: 30, n: 2, r: 76 },
  { int: 2.4, dmg: 36, n: 2, r: 86 },
  { int: 2.1, dmg: 42, n: 3, r: 94 },
  { int: 1.7, dmg: 52, n: 4, r: 106 },
];
const FIELD = [
  { int: 2.2, dmg: 6,  r: 60, dur: 3.5, n: 1 },
  { int: 2.0, dmg: 7,  r: 68, dur: 4.0, n: 1 },
  { int: 1.7, dmg: 8,  r: 76, dur: 4.5, n: 2 },
  { int: 1.5, dmg: 10, r: 84, dur: 5.0, n: 2 },
  { int: 1.2, dmg: 13, r: 95, dur: 5.5, n: 3 },
];
const RAIL = [
  { int: 2.6, dmg: 40,  w: 12, range: 700 },
  { int: 2.3, dmg: 52,  w: 13, range: 760 },
  { int: 2.0, dmg: 66,  w: 15, range: 820 },
  { int: 1.7, dmg: 82,  w: 17, range: 900 },
  { int: 1.4, dmg: 105, w: 20, range: 1000 },
];
const FARADAY = [
  { r: 55, dmg: 5,  block: 0.15 },
  { r: 62, dmg: 7,  block: 0.20 },
  { r: 70, dmg: 9,  block: 0.28 },
  { r: 78, dmg: 12, block: 0.35 },
  { r: 90, dmg: 16, block: 0.45 },
];

const WEAPON_DEFS = {
  blaster:   { icon: "✦", css: "#7fd4ff", table: BLASTER,
    name: { en: "Arc Emitter", hr: "Lučni Emiter" },
    desc: { en: ["Auto-fires arcs at the nearest component", "+1 arc, faster fire", "Faster fire, +damage", "+1 arc", "+1 arc, max power"],
            hr: ["Sam puca lukove na najbližu komponentu", "+1 luk, brže pucanje", "Brže pucanje, +šteta", "+1 luk", "+1 luk, maks. snaga"] } },
  orbit:     { icon: "❖", css: "#ff5ad1", table: ORBIT,
    name: { en: "Coil Rotors", hr: "Zavojni Rotori" },
    desc: { en: ["2 coils orbit the core, shredding on contact", "+1 coil", "+1 coil, faster spin", "+1 coil, +damage", "+2 coils, max power"],
            hr: ["2 zavojnice kruže oko jezgre i ranjavaju dodirom", "+1 zavojnica", "+1 zavojnica, brža vrtnja", "+1 zavojnica, +šteta", "+2 zavojnice, maks. snaga"] } },
  nova:      { icon: "◎", css: "#5dffc9", table: NOVA,
    name: { en: "EMP Pulse", hr: "EMP Puls" },
    desc: { en: ["Periodic EMP shockwave — also wipes enemy shots", "Bigger, stronger", "Faster recharge", "Bigger, stronger", "Massive EMP"],
            hr: ["Povremeni EMP val — briše i neprijateljske hice", "Veći, jači", "Brže punjenje", "Veći, jači", "Ogroman EMP"] } },
  lightning: { icon: "⚡", css: "#ffe75e", table: LIGHTNING,
    name: { en: "Tesla Arc", hr: "Tesla Luk" },
    desc: { en: ["Zaps the nearest component, arcs between foes", "+1 chain", "+1 chain, +damage", "+1 chain", "+2 chains, max power"],
            hr: ["Šokira najbližu komponentu, preskače na druge", "+1 skok", "+1 skok, +šteta", "+1 skok", "+2 skoka, maks. snaga"] } },
  missile:   { icon: "➤", css: "#ff9d5c", table: MISSILE,
    name: { en: "Ion Seekers", hr: "Ionski Tragači" },
    desc: { en: ["Homing ion charge with splash damage", "+1 seeker", "+damage, +splash", "+1 seeker", "+1 seeker, max power"],
            hr: ["Samonavodeći ionski naboj s eksplozijom", "+1 tragač", "+šteta, +eksplozija", "+1 tragač", "+1 tragač, maks. snaga"] } },
  statics:   { icon: "▦", css: "#b388ff", table: FIELD,
    name: { en: "Static Field", hr: "Statičko Polje" },
    desc: { en: ["Drops a crackling field that shocks enemies inside it", "Bigger field, lasts longer", "+1 field, +damage", "Bigger, faster drops", "+1 field, max power"],
            hr: ["Ostavlja pucketavo polje koje šokira neprijatelje unutra", "Veće polje, duže traje", "+1 polje, +šteta", "Veće, brže postavljanje", "+1 polje, maks. snaga"] } },
  railgun:   { icon: "⇶", css: "#ff6b8a", table: RAIL,
    name: { en: "Railgun", hr: "Topnjača" },
    desc: { en: ["Charges and fires a piercing beam through a line of enemies", "+damage, longer beam", "Faster fire, +damage", "Wider beam, +damage", "Faster fire, max power"],
            hr: ["Nabija i ispaljuje probojnu zraku kroz red neprijatelja", "+šteta, duža zraka", "Brže pucanje, +šteta", "Šira zraka, +šteta", "Brže pucanje, maks. snaga"] } },
  faraday:   { icon: "✺", css: "#86f7ff", table: FARADAY,
    name: { en: "Faraday Shield", hr: "Faradayev Kavez" },
    desc: { en: ["A shield aura shocks nearby enemies and blocks some contact damage", "Bigger aura, +damage", "+block, +damage", "Bigger aura, +block", "+damage, max power"],
            hr: ["Štitna aura šokira bliske neprijatelje i blokira dio kontaktne štete", "Veća aura, +šteta", "+blok, +šteta", "Veća aura, +blok", "+šteta, maks. snaga"] } },
};

const PASSIVE_DEFS = {
  damage:   { icon: "✸", css: "#ff7b7b", name: { en: "Voltage Boost", hr: "Naponsko Pojačanje" }, desc: { en: "+12% damage to everything", hr: "+12% štete na sve" } },
  rate:     { icon: "⟳", css: "#7fd4ff", name: { en: "Overclock", hr: "Overclock" }, desc: { en: "+10% attack speed", hr: "+10% brzine napada" } },
  speed:    { icon: "»", css: "#9dffa1", name: { en: "Swift Circuits", hr: "Brzi Krugovi" }, desc: { en: "+9% movement speed", hr: "+9% brzine kretanja" } },
  vitality: { icon: "▮", css: "#ff5e9a", name: { en: "Capacitor Bank", hr: "Banka Kondenzatora" }, desc: { en: "+20 max HP, recharge 20", hr: "+20 maks. HP, napuni 20" } },
  magnet:   { icon: "◉", css: "#5de1ff", name: { en: "Magnetic Field", hr: "Magnetsko Polje" }, desc: { en: "+35% pickup range", hr: "+35% dometa skupljanja" } },
  regen:    { icon: "✚", css: "#a1ff5e", name: { en: "Trickle Charge", hr: "Sporo Punjenje" }, desc: { en: "+0.6 HP/s recharge", hr: "+0.6 HP/s punjenje" } },
  siphon:   { icon: "♥", css: "#ff96c0", name: { en: "Energy Siphon", hr: "Energetski Sifon" }, desc: { en: "Heal a little for every point of damage you deal", hr: "Lječi malo za svaku štetu koju naneseš" } },
  overvolt: { icon: "★", css: "#ffcf4d", name: { en: "Overvolt", hr: "Prenapon" }, desc: { en: "+crit chance and +crit damage", hr: "+šansa i +šteta kritičnog udara" } },
};

/* enemy archetypes (rogue components) — shape: 0 = circle, else polygon sides
   chaser=Resistor speedy=Diode tank=Transformer splitter=Transistor mini=Electron shooter=Actuator */
const ETYPES = {
  chaser:   { r: 13, hp: 16, spd: [68, 95],   dmg: 10, xp: 1, score: 10, col: "255,128,64",  shape: 0 },
  speedy:   { r: 9,  hp: 9,  spd: [150, 180], dmg: 7,  xp: 1, score: 15, col: "255,224,84",  shape: 3 },
  tank:     { r: 24, hp: 85, spd: [38, 50],   dmg: 18, xp: 4, score: 40, col: "150,140,255", shape: 6 },
  splitter: { r: 17, hp: 34, spd: [60, 75],   dmg: 12, xp: 2, score: 30, col: "80,235,140",  shape: 4 },
  mini:     { r: 8,  hp: 7,  spd: [120, 150], dmg: 6,  xp: 1, score: 8,  col: "150,255,205", shape: 0 },
  shooter:  { r: 13, hp: 26, spd: [52, 62],   dmg: 8,  xp: 3, score: 35, col: "225,120,255", shape: 5 },
};

const UNLOCKS = [
  [40,  "speedy",   "unlockDiodes"],
  [90,  "tank",     "unlockTransformers"],
  [140, "splitter", "unlockTransistors"],
  [200, "shooter",  "unlockActuators"],
];

/* ---------------- best score ---------------- */
function loadBest() {
  try { return JSON.parse(localStorage.getItem("neonswarm_best")) || { score: 0, time: 0 }; }
  catch (e) { return { score: 0, time: 0 }; }
}
function saveBest(b) {
  try { localStorage.setItem("neonswarm_best", JSON.stringify(b)); } catch (e) {}
}
let bestData = loadBest();

/* ---------------- game state ---------------- */
let state = null;

function xpNeedFor(lvl) { return Math.floor(6 + lvl * 4 + Math.pow(lvl, 1.6)); }

function newGame() {
  state = {
    mode: "playing",
    time: 0, score: 0, kills: 0,
    cam: { x: 0, y: 0 },
    player: {
      x: 0, y: 0, r: 12, hp: 100, maxhp: 100, baseSpeed: 235,
      ifr: 1.5, dashCd: 0, dashT: 0, dashDx: 1, dashDy: 0,
      face: 0, moveAng: 0, muzzle: 0,
    },
    weapons: {
      blaster:   { lvl: 1, cd: 0.5 },
      orbit:     { lvl: 0, cd: 0, ang: 0 },
      nova:      { lvl: 0, cd: 0 },
      lightning: { lvl: 0, cd: 0 },
      missile:   { lvl: 0, cd: 0 },
      statics:   { lvl: 0, cd: 0 },
      railgun:   { lvl: 0, cd: 0 },
      faraday:   { lvl: 0, cd: 0 },
    },
    passives: { damage: 0, rate: 0, speed: 0, vitality: 0, magnet: 0, regen: 0, siphon: 0, overvolt: 0 },
    dashTaken: 0, dashUnlocked: false, dashCdMax: 7, dashLockMsgT: 0,
    level: 1, xp: 0, xpNeed: xpNeedFor(1), pendingUps: 0,
    enemies: [], bullets: [], ebullets: [], gems: [], pickups: [],
    missiles: [], novas: [], bolts: [], parts: [], texts: [],
    fields: [], beams: [],
    bladePos: null,
    spawnT: 0.8, eliteT: 110, bossT: 300, boss: null, bossesKilled: 0,
    shake: 0, shakeMag: 0, flash: 0, hurtT: 0,
    announced: {}, announce: null,
    upgradeOpts: null,
    won: false, hyper: 0,
  };
}

/* derived stats */
function dmgMul()      { return 1 + 0.12 * state.passives.damage; }
function rateMul()     { return 1 + 0.10 * state.passives.rate; }
function moveSpeed()   { return state.player.baseSpeed * (1 + 0.09 * state.passives.speed); }
function magnetR()     { return 95 * (1 + 0.35 * state.passives.magnet); }
function regenRate()   { return 0.6 * state.passives.regen; }
function siphonFrac()  { return 0.01 * state.passives.siphon; }
function critChance()  { return 0.10 + 0.05 * state.passives.overvolt; }
function critMult()    { return 2 + 0.2 * state.passives.overvolt; }
function faradayBlock() { const w = state.weapons.faraday; return w.lvl > 0 ? FARADAY[w.lvl - 1].block : 0; }
