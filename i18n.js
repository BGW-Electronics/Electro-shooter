"use strict";
/* ============================================================
   BGW ELECTRO SHOOTER — i18n.js
   language (hr/en) + theme (dark/light) data and helpers
   ============================================================ */

let curLang = "hr", curTheme = "dark";
try { curLang = localStorage.getItem("bgw_lang") || "hr"; } catch (e) {}
try { curTheme = localStorage.getItem("bgw_theme") || "dark"; } catch (e) {}
if (curLang !== "en" && curLang !== "hr") curLang = "hr";
if (curTheme !== "light" && curTheme !== "dark") curTheme = "dark";
function saveLang() { try { localStorage.setItem("bgw_lang", curLang); } catch (e) {} }
function saveTheme() { try { localStorage.setItem("bgw_theme", curTheme); } catch (e) {} }

/* t(key) for UI strings, with optional {0}/{1} substitution.
   L(obj) for inline {en,hr} objects (weapon/passive data). */
function t(key, a0, a1) {
  let s = (LANG[curLang] && LANG[curLang][key]);
  if (s === undefined) s = LANG.en[key];
  if (s === undefined) return key;
  if (a0 !== undefined) s = s.split("{0}").join(a0);
  if (a1 !== undefined) s = s.split("{1}").join(a1);
  return s;
}
function L(obj) { return obj ? (obj[curLang] !== undefined ? obj[curLang] : obj.en) : ""; }

/* canvas colour palettes per theme (used by the renderer) */
const THEMES = {
  dark: {
    base: "#060b18", panelA: "#16294e", panelB: "#0a1733", cell: "#102346",
    cellBorder: "rgba(46,78,132,0.9)", busbar: "rgba(150,185,225,0.09)", sheen: "rgba(120,180,255,0.10)",
    frame: "rgba(130,150,182,0.22)", frameGlow: "rgba(0,255,217,0.06)",
    vignette: "rgba(0,0,14,0.55)", logo: "assets/bgw_logo_dark.svg",
  },
  light: {
    base: "#d7e3f0", panelA: "#cfe0f2", panelB: "#bcd0e8", cell: "#c6d8ee",
    cellBorder: "rgba(120,150,190,0.65)", busbar: "rgba(70,100,140,0.10)", sheen: "rgba(255,255,255,0.30)",
    frame: "rgba(90,115,150,0.30)", frameGlow: "rgba(0,150,130,0.10)",
    vignette: "rgba(150,165,190,0.30)", logo: "assets/bgw_electronics.svg",
  },
};
function themeColors() { return THEMES[curTheme]; }
function themeVignette() { return THEMES[curTheme].vignette; }
function themeLogo() { return THEMES[curTheme].logo; }

const LANG = {
  en: {
    /* menu */
    start: "START", howto: "HOW TO PLAY", powerups: "POWER-UPS",
    menuSub: "harvest charge · upgrade the grid · survive THE OVERLOAD at 5:00",
    controls: `<b>WASD / arrows</b> move &nbsp;·&nbsp; defenses fire automatically &nbsp;·&nbsp; <b>SHIFT / SPACE</b> dash <span class="dim">(unlocks LV 10)</span><br><b>P</b> pause &nbsp;·&nbsp; <b>M</b> mute &nbsp;·&nbsp; touch: drag to move, second finger to dash`,
    theme: "THEME", themeDark: "DARK", themeLight: "LIGHT", language: "LANGUAGE",
    menuBestRecord: "grid record {0} · best uptime {1}", menuBestFirst: "first shift — protect the grid",
    /* level up */
    levelup: "LEVEL UP", levelupSub: "CHOOSE AN UPGRADE — CLICK OR PRESS 1 / 2 / 3",
    newWeapon: "NEW WEAPON", unlockPower: "UNLOCK · POWER-UP",
    fieldRepairName: "Field Repair", fieldRepairDesc: "Restore 40 HP",
    surgeDashName: "Surge Dash",
    surgeDashUnlockDesc: "Dash with SHIFT / SPACE — short burst + brief invulnerability. {0}s cooldown.",
    surgeDashCutDesc: "Shorten the Surge Dash cooldown.",
    /* pause */
    paused: "PAUSED", pauseHint: "WASD move · SPACE dash · M mute", resume: "RESUME [P]",
    /* over / win */
    gridDown: "GRID DOWN", restart: "RESTART [R]",
    winTitle: "OVERLOAD PURGED", winSub: "THE GRID HOLDS — BUT THE LOAD KEEPS RISING…", keepDef: "KEEP DEFENDING [ENTER]",
    /* stats */
    statUptime: "UPTIME", statLevel: "LEVEL", statKills: "KILLS", statScore: "SCORE", statBest: "BEST", statNew: " ★ NEW",
    /* HUD */
    hudDash: "DASH", hudBuy: "BUY", hudLv10: "LV 10", bossName: "THE OVERLOAD",
    /* tutorial */
    howtoTitle: "HOW TO PLAY", back: "◀ BACK", next: "NEXT ▶", startBtn2: "START ▶", done: "DONE ✓", skip: "SKIP INTRO",
    tut1h: "Move the core", tut1b: "You are the BGW core. Move with WASD or the arrow keys — on touch, drag anywhere. Dodge the swarm to stay alive.",
    tut2h: "Defenses auto-fire", tut2b: "Your weapons fire on their own at the nearest component. Focus on positioning and let the grid do the shooting.",
    tut3h: "Harvest charge, level up", tut3b: "Destroyed components drop charge. Collect it to fill the bar and level up — then pick one of three upgrades: new weapons or stat boosts.",
    tut4h: "Surge Dash — from LV 10", tut4b: "From level 10 the Surge Dash appears in your upgrade choices. Pick it to unlock dashing (SHIFT / SPACE or the on-screen button): a fast burst with brief invulnerability. Take it again every 10 levels to shorten the cooldown.",
    tut5h: "Survive the Overload", tut5b: "Waves grow stronger and gold elites appear every minute. At 5:00 the OVERLOAD boss strikes. Grab green batteries to heal and yellow EMPs to wipe the screen.",
    /* arsenal */
    powerupsTitle: "POWER-UPS", powerupsSub: "everything you can find during a run",
    arsWeapons: "Weapons — auto-fire, each levels up to 5", arsPassives: "Passives — stack for bigger boosts", arsAbility: "Ability & pickups",
    surgeDashCodex: "Unlocks at level 10. Dash (SHIFT / SPACE or the on-screen button) for a fast burst with brief invulnerability — slip through enemies. Every 10 levels you can cut its cooldown (starts at 7s).",
    batteryName: "Battery", batteryDesc: "Dropped by elites and bosses — instantly restores 20 HP.",
    empName: "EMP", empDesc: "Rare drop — wipes every enemy on screen and clears their shots.",
    repairCodexDesc: "Offered on level-up when nothing new fits — restores 40 HP.",
    /* leaderboard */
    namePlaceholder: "YOUR NAME", submit: "SUBMIT",
    lbMenuTitle: "★ TOP ENGINEERS — ALL TIME", lbTop10: "★ ALL-TIME TOP 10", lbNoScores: "no scores yet — be first",
    lbRank: "RANK #{0} — GRID SECURED, {1}", lbOffline: "GLOBAL LEADERBOARD OFFLINE — DEPLOYED VERSION ONLY", lbSubmitFail: "SUBMIT FAILED — ",
    /* announcements */
    bossOnline: "⚡ THE OVERLOAD ONLINE ⚡", bossRedef: "⚡ OVERLOAD PURGED — IT WILL REBUILD ⚡",
    elite: "⚠ POWER SPIKE — OVERCHARGED UNIT ⚠",
    dashLockLv: "⚡ SURGE DASH UNLOCKS AT LEVEL 10", dashLockBuy: "⚡ PICK THE SURGE DASH UPGRADE TO USE IT",
    dashOnline: "⚡ SURGE DASH ONLINE — SHIFT / SPACE", dashCd: "⚡ DASH COOLDOWN → {0}s",
    overdrive: "OVERDRIVE — THE GRID DESTABILIZES",
    unlockDiodes: "◣ DIODES SURGING IN", unlockTransformers: "◉ TRANSFORMERS INBOUND",
    unlockTransistors: "◈ TRANSISTORS DESTABILIZING", unlockActuators: "✦ ACTUATORS ARMED",
  },
  hr: {
    /* menu */
    start: "START", howto: "KAKO IGRATI", powerups: "POJAČANJA",
    menuSub: "skupljaj naboj · nadograđuj mrežu · preživi PREOPTEREĆENJE na 5:00",
    controls: `<b>WASD / strelice</b> kretanje &nbsp;·&nbsp; obrana puca sama &nbsp;·&nbsp; <b>SHIFT / SPACE</b> nalet <span class="dim">(otključava se LV 10)</span><br><b>P</b> pauza &nbsp;·&nbsp; <b>M</b> zvuk &nbsp;·&nbsp; dodir: povuci za kretanje, drugi prst za nalet`,
    theme: "TEMA", themeDark: "TAMNA", themeLight: "SVIJETLA", language: "JEZIK",
    menuBestRecord: "rekord {0} · najduže {1}", menuBestFirst: "prva smjena — zaštiti mrežu",
    /* level up */
    levelup: "NOVI NIVO", levelupSub: "ODABERI POJAČANJE — KLIKNI ILI PRITISNI 1 / 2 / 3",
    newWeapon: "NOVO ORUŽJE", unlockPower: "OTKLJUČAJ · POJAČANJE",
    fieldRepairName: "Brzi Popravak", fieldRepairDesc: "Vrati 40 HP",
    surgeDashName: "Energetski Nalet",
    surgeDashUnlockDesc: "Nalet sa SHIFT / SPACE — brzi trzaj + kratka neranjivost. Hlađenje {0}s.",
    surgeDashCutDesc: "Skrati hlađenje Energetskog Naleta.",
    /* pause */
    paused: "PAUZA", pauseHint: "WASD kretanje · SPACE nalet · M zvuk", resume: "NASTAVI [P]",
    /* over / win */
    gridDown: "MREŽA PALA", restart: "PONOVO [R]",
    winTitle: "PREOPTEREĆENJE UNIŠTENO", winSub: "MREŽA IZDRŽAVA — ALI OPTEREĆENJE I DALJE RASTE…", keepDef: "NASTAVI BRANITI [ENTER]",
    /* stats */
    statUptime: "VRIJEME", statLevel: "NIVO", statKills: "UNIŠTENO", statScore: "REZULTAT", statBest: "REKORD", statNew: " ★ NOVO",
    /* HUD */
    hudDash: "NALET", hudBuy: "KUPI", hudLv10: "LV 10", bossName: "PREOPTEREĆENJE",
    /* tutorial */
    howtoTitle: "KAKO IGRATI", back: "◀ NATRAG", next: "DALJE ▶", startBtn2: "KRENI ▶", done: "GOTOVO ✓", skip: "PRESKOČI",
    tut1h: "Pomiči jezgru", tut1b: "Ti si BGW jezgra. Kreći se sa WASD ili strelicama — na dodir povuci bilo gdje. Izbjegavaj roj da preživiš.",
    tut2h: "Obrana puca sama", tut2b: "Tvoje oružje puca samo na najbližu komponentu. Fokusiraj se na poziciju, a mreža neka puca.",
    tut3h: "Skupljaj naboj, diži nivo", tut3b: "Uništene komponente ispuštaju naboj. Skupi ga da napuniš traku i digneš nivo — onda biraj jedno od tri pojačanja: novo oružje ili boost.",
    tut4h: "Energetski Nalet — od LV 10", tut4b: "Od nivoa 10 Energetski Nalet se pojavljuje među pojačanjima. Odaberi ga da otključaš nalet (SHIFT / SPACE ili gumb na ekranu): brzi trzaj uz kratku neranjivost. Uzmi ga ponovo svakih 10 nivoa da skratiš hlađenje.",
    tut5h: "Preživi Preopterećenje", tut5b: "Valovi jačaju, a zlatne elite se pojavljuju svake minute. Na 5:00 napada boss PREOPTEREĆENJE. Skupljaj zelene baterije za lječenje i žute EMP-ove da očistiš ekran.",
    /* arsenal */
    powerupsTitle: "POJAČANJA", powerupsSub: "sve što možeš naći tijekom igre",
    arsWeapons: "Oružja — pucaju sama, svako ide do nivoa 5", arsPassives: "Pasivna — slažu se za veći boost", arsAbility: "Sposobnost i predmeti",
    surgeDashCodex: "Otključava se na nivou 10. Nalet (SHIFT / SPACE ili gumb na ekranu) za brzi trzaj uz kratku neranjivost — proklizni kroz neprijatelje. Svakih 10 nivoa možeš skratiti hlađenje (počinje na 7s).",
    batteryName: "Baterija", batteryDesc: "Ispuštaju je elite i bossovi — odmah vraća 20 HP.",
    empName: "EMP", empDesc: "Rijedak predmet — uništi sve neprijatelje na ekranu i očisti njihove hice.",
    repairCodexDesc: "Nudi se pri novom nivou kad ništa novo ne stane — vraća 40 HP.",
    /* leaderboard */
    namePlaceholder: "TVOJE IME", submit: "POŠALJI",
    lbMenuTitle: "★ NAJBOLJI INŽENJERI — SVE VRIJEME", lbTop10: "★ TOP 10 SVIH VREMENA", lbNoScores: "još nema rezultata — budi prvi",
    lbRank: "MJESTO #{0} — MREŽA OSIGURANA, {1}", lbOffline: "GLOBALNA LJESTVICA NEDOSTUPNA — SAMO U OBJAVLJENOJ VERZIJI", lbSubmitFail: "SLANJE NEUSPJEŠNO — ",
    /* announcements */
    bossOnline: "⚡ PREOPTEREĆENJE AKTIVNO ⚡", bossRedef: "⚡ PREOPTEREĆENJE UNIŠTENO — VRATIT ĆE SE ⚡",
    elite: "⚠ NAPONSKI UDAR — PREOPTEREĆENA JEDINICA ⚠",
    dashLockLv: "⚡ ENERGETSKI NALET SE OTKLJUČAVA NA NIVOU 10", dashLockBuy: "⚡ ODABERI POJAČANJE ENERGETSKI NALET DA GA KORISTIŠ",
    dashOnline: "⚡ ENERGETSKI NALET AKTIVAN — SHIFT / SPACE", dashCd: "⚡ HLAĐENJE NALETA → {0}s",
    overdrive: "OVERDRIVE — MREŽA SE DESTABILIZIRA",
    unlockDiodes: "◣ DIODE NADIRU", unlockTransformers: "◉ TRANSFORMATORI DOLAZE",
    unlockTransistors: "◈ TRANZISTORI SE DESTABILIZIRAJU", unlockActuators: "✦ AKTUATORI NAORUŽANI",
  },
};
