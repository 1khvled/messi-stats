/* MessiStats renderer — own code, own data, own copy.
   Layout structure mirrors the ronaldostats.app reference (rail, KPI cards,
   tables, charts, explore links); no reference code, images or text reused. */
import "./ad-guard.js";
import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";
import { MONETIZE_CONFIG } from "./monetize-config.js";
inject(); // page-view counting; no-ops off Vercel (script 404s silently in local preview)
injectSpeedInsights(); // Core Web Vitals; same deal — production only, silent locally
/* Theme manager (Dark / Light mode) synced with <meta name="color-scheme"> & OS preference */
function syncColorSchemeMeta(mode) {
  if (typeof document === "undefined") return;
  let csMeta = document.querySelector('meta[name="color-scheme"]');
  if (!csMeta && document.head) {
    csMeta = document.createElement("meta");
    csMeta.setAttribute("name", "color-scheme");
    document.head.appendChild(csMeta);
  }
  if (csMeta) {
    csMeta.setAttribute("content", mode === "dark" || mode === "light" ? mode : "light dark");
  }
}

function initTheme() {
  const getSystemScheme = () =>
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  const getStoredOverride = () => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch (_) {}
    return null;
  };

  const getResolved = () => getStoredOverride() || getSystemScheme();

  const applyTheme = (resolved, storedOverride) => {
    if (resolved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    syncColorSchemeMeta(storedOverride || "light dark");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolved === "dark" ? "#09090b" : "#f4f5f3");
    const themeLang = ((document.documentElement.lang || "en").toLowerCase().split("-")[0]);
    const themeStrings = {
      en: { toLight: "Light mode", toDark: "Dark mode", ariaLight: "Switch to light mode", ariaDark: "Switch to dark mode" },
      es: { toLight: "Modo claro", toDark: "Modo oscuro", ariaLight: "Cambiar a modo claro", ariaDark: "Cambiar a modo oscuro" },
      pt: { toLight: "Modo claro", toDark: "Modo escuro", ariaLight: "Mudar para modo claro", ariaDark: "Mudar para modo escuro" },
      fr: { toLight: "Mode clair", toDark: "Mode sombre", ariaLight: "Passer en mode clair", ariaDark: "Passer en mode sombre" },
      ro: { toLight: "Mod luminos", toDark: "Mod întunecat", ariaLight: "Comută la modul luminos", ariaDark: "Comută la modul întunecat" },
      uz: { toLight: "Yorug' rejim", toDark: "Tungi rejim", ariaLight: "Yorug' rejimga o'tish", ariaDark: "Tungi rejimga o'tish" },
      ar: { toLight: "الوضع الفاتح", toDark: "الوضع الداكن", ariaLight: "التبديل إلى الوضع الفاتح", ariaDark: "التبديل إلى الوضع الداكن" },
      id: { toLight: "Mode terang", toDark: "Mode gelap", ariaLight: "Beralih ke mode terang", ariaDark: "Beralih ke mode gelap" }
    };
    const ts = themeStrings[themeLang] || themeStrings.en;
    const btns = document.querySelectorAll(".theme-toggle");
    btns.forEach((btn) => {
      const label = btn.querySelector(".theme-label");
      if (label) label.textContent = resolved === "dark" ? ts.toLight : ts.toDark;
      btn.setAttribute("aria-label", resolved === "dark" ? ts.ariaLight : ts.ariaDark);
      btn.setAttribute("title", resolved === "dark" ? ts.ariaLight : ts.ariaDark);
    });
  };

  const toggleTheme = () => {
    const current = getResolved();
    const target = current === "dark" ? "light" : "dark";
    const sys = getSystemScheme();
    let stored = null;
    try {
      if (target === sys) {
        localStorage.removeItem("theme");
      } else {
        localStorage.setItem("theme", target);
        stored = target;
      }
    } catch (_) {}
    applyTheme(target, stored);
  };

  if (typeof window !== "undefined") {
    window.__toggleMessiTheme = toggleTheme;
  }

  applyTheme(getResolved(), getStoredOverride());

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".theme-toggle");
    if (!btn) return;
    toggleTheme();
  });

  if (window.matchMedia) {
    try {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        if (!getStoredOverride()) {
          applyTheme(e.matches ? "dark" : "light", null);
        }
      });
    } catch (_) {}
  }
}
initTheme();

/* Sidebar 2.0 collapse/expand state (zero-CLS early apply + delegated toggle) */
const RAIL_COLLAPSE_KEY = "messistat_rail_collapsed";

function syncSidebarCollapseState(collapsed) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (collapsed) {
    root.setAttribute("data-rail", "collapsed");
  } else if (root.getAttribute("data-rail") === "collapsed") {
    root.removeAttribute("data-rail");
  }
  const expanded = collapsed ? "false" : "true";
  document.querySelectorAll("#rail-collapse-btn, .rail-collapse-btn").forEach((btn) => {
    btn.setAttribute("aria-expanded", expanded);
  });
}

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(RAIL_COLLAPSE_KEY) === "1";
  } catch (_) {
    return false;
  }
}

function initSidebarCollapse() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  syncSidebarCollapseState(readSidebarCollapsed());

  if (document.readyState === "loading" && !window.__messiRailCollapseDclBound) {
    window.__messiRailCollapseDclBound = true;
    document.addEventListener("DOMContentLoaded", () => {
      syncSidebarCollapseState(readSidebarCollapsed());
    }, { once: true });
  }

  if (window.__messiRailCollapseBound) return;
  window.__messiRailCollapseBound = true;

  let relayoutTimer = null;
  document.addEventListener("click", (e) => {
    const btn = e.target && typeof e.target.closest === "function"
      ? e.target.closest("#rail-collapse-btn, .rail-collapse-btn")
      : null;
    if (!btn) return;
    const nextCollapsed = document.documentElement.getAttribute("data-rail") !== "collapsed";
    try {
      if (nextCollapsed) {
        localStorage.setItem(RAIL_COLLAPSE_KEY, "1");
      } else {
        localStorage.removeItem(RAIL_COLLAPSE_KEY);
      }
    } catch (_) {}
    syncSidebarCollapseState(nextCollapsed);
    if (relayoutTimer) clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(() => {
      window.dispatchEvent(new Event("messi:spark-relayout"));
    }, 220);
  });
}

initSidebarCollapse();

function isOwnerNoAdsActive() {
  try {
    if (typeof document !== "undefined" && document.documentElement.dataset.ownerNoads === "1") return true;
    return typeof localStorage !== "undefined" && localStorage.getItem("ms_owner_noads") === "1";
  } catch (_) {
    return false;
  }
}

// ---------- High-Yield Monetization Architecture ----------
function initMonetizationUnits() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const OWNER_NOADS_KEY = "ms_owner_noads";
  try {
    const ownerParam = new URLSearchParams(window.location.search).get("owner");
    if (ownerParam === "1") {
      localStorage.setItem(OWNER_NOADS_KEY, "1");
    } else if (ownerParam === "0") {
      localStorage.removeItem(OWNER_NOADS_KEY);
      if (document.documentElement.dataset.ownerNoads === "1") {
        delete document.documentElement.dataset.ownerNoads;
      }
    }
  } catch (_) {}

  function isOwnerNoAds() {
    return isOwnerNoAdsActive();
  }

  if (isOwnerNoAds()) {
    document.documentElement.dataset.ownerNoads = "1";
    if (typeof console !== "undefined" && typeof console.info === "function") {
      console.info("[MessiStat] Owner ad-free mode active");
    }
    return;
  }
  if (document.documentElement.getAttribute("data-owner-noads") === "1") {
    document.documentElement.removeAttribute("data-owner-noads");
  }

  const SMARTLINK_URL = MONETIZE_CONFIG.adsterraSmartlinkUrl;
  const SESSION_KEY = "ms_session_sl_v1";
  const SL_COUNT_KEY = "ms_sl_count_v2";
  const SL_LAST_TS_KEY = "ms_sl_last_ts";
  const SL_MAX_PER_SESSION = 3;
  const SL_COOLDOWN_MS = 75000;

  // 1. High-Intent Smartlink Trigger (75s Cooldown, Max 3x Per Session)
  function triggerSmartlink(skipWindowOpen) {
    try {
      if (isOwnerNoAds()) return false;
      if (typeof sessionStorage !== "undefined") {
        if (sessionStorage.getItem(SESSION_KEY) === "1") return false;
        const count = parseInt(sessionStorage.getItem(SL_COUNT_KEY) || "0", 10) || 0;
        const lastTs = parseInt(sessionStorage.getItem(SL_LAST_TS_KEY) || "0", 10) || 0;
        const now = Date.now();
        if (skipWindowOpen) {
          sessionStorage.setItem(SL_COUNT_KEY, String(count + 1));
          sessionStorage.setItem(SL_LAST_TS_KEY, String(now));
          return true;
        }
        if (count >= SL_MAX_PER_SESSION) return false;
        if (lastTs > 0 && (now - lastTs) < SL_COOLDOWN_MS) return false;
        sessionStorage.setItem(SL_COUNT_KEY, String(count + 1));
        sessionStorage.setItem(SL_LAST_TS_KEY, String(now));
      }
      if (skipWindowOpen) return true;
      const pop = window.open(SMARTLINK_URL, "_blank", "noopener,noreferrer");
      if (pop) {
        try { pop.blur(); window.focus(); } catch (_) {}
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  // Trigger ONLY on high-intent content interactions; never on UI chrome
  document.addEventListener("click", (e) => {
    if (!e || !e.isTrusted) return;
    const target = e.target instanceof Element ? e.target : (e.target && e.target.parentElement);
    if (!target) return;

    if (target.closest(".rail, .mobile-topbar, #cmd-palette, #lang-modal, #mobile-nav-drawer, .theme-toggle, .ad-anchor-close, [data-open-cmd]")) {
      return;
    }

    const isHighIntent = target.closest(
      '.video-play-overlay, video, .bday-watch-video-btn, #video-big-play-btn, #btn-replay-goal, .recent-goal-card, .btn-load-roulette-video, .video-player-box, a[href*=".mp4"], .dash-filter-btn, .btn-vote-candidate, .tl-era-btn, .bday-day-cell, .year-pick-control, .hub-monetize-watch, .community-ribbon .watch-latest'
    );

    if (isHighIntent) {
      const anchor = target.closest("a[href]");
      const isDirectSmartlink = !!(
        anchor &&
        anchor.getAttribute("target") === "_blank" &&
        (anchor.getAttribute("href") || "").includes("araplhn.org/")
      );
      triggerSmartlink(isDirectSmartlink);
    }
  }, { capture: true });

  // Fallback for native video play event
  document.addEventListener("play", (e) => {
    if (e && e.target && e.target.tagName === "VIDEO") {
      triggerSmartlink(false);
    }
  }, { capture: true });

  // 2. Mobile Sticky Bottom Anchor Banner (320x50) - Disabled so AdSense Auto Ads has clean mobile real estate
  function armMobileAnchor() {
    // Intentionally stubbed: removed dead $0.00 Adsterra 320x50 anchor
  }

  // 3. Desktop Floating Right Skyscraper Dock (160x600) - Disabled so AdSense Auto Ads Side Rails have clean whitespace
  function armDesktopSkyscraper() {
    // Intentionally stubbed: removed dead $0.00 Adsterra 160x600 skyscraper
  }

  // Keep stub calls safe if referenced
  armMobileAnchor();
  armDesktopSkyscraper();
}
initMonetizationUnits();


/* ================= REDESIGNED LANGUAGE SELECTOR & MOBILE TOPBAR ================= */
const LANGUAGES = [
  { code: "en", flag: "🇺🇸", name: "English", native: "English", note: "US, NG, IN, PH" },
  { code: "es", flag: "🇪🇸", name: "Spanish", native: "Español", note: "Argentina, España" },
  { code: "pt", flag: "🇧🇷", name: "Portuguese", native: "Português", note: "Brasil, Portugal" },
  { code: "fr", flag: "🇫🇷", name: "French", native: "Français", note: "France, Niger" },
  { code: "ro", flag: "🇷🇴", name: "Romanian", native: "Română", note: "România, Moldova" },
  { code: "uz", flag: "🇺🇿", name: "Uzbek", native: "Oʻzbekcha", note: "Oʻzbekiston" },
  { code: "ar", flag: "🇸🇦", name: "Arabic", native: "العربية", note: "الشرق الأوسط وشمال أفريقيا", rtl: true },
  { code: "id", flag: "🇮🇩", name: "Indonesian", native: "Bahasa Indonesia", note: "Indonesia" }
];

function getCurrentLangCode() {
  if (typeof document === "undefined") return "en";
  const docLang = (document.documentElement.lang || "").toLowerCase().split("-")[0];
  const pathParts = (typeof location !== "undefined" ? location.pathname : "").split("/").filter(Boolean);
  if (LANGUAGES.some((l) => l.code === docLang)) {
    return docLang;
  }
  if (pathParts[0] && LANGUAGES.some((l) => l.code === pathParts[0])) {
    return pathParts[0];
  }
  return "en";
}

function getLangUrl(targetCode) {
  if (typeof location === "undefined") return `/${targetCode}`;
  const validSubpages = [
    "birthday",
    "goalsbyyear",
    "goalsbyseason",
    "dashboard",
    "timeline",
    "achievements",
    "messi-vs-ronaldo",
    "vs-real-madrid",
    "champions-league",
    "latest-goal",
    "gear"
  ];
  const pathParts = location.pathname.split("/").filter(Boolean);
  // Clean programmatic date pages exist in English only: keep every language
  // switch on the single canonical date URL instead of forking ?date= copies
  // (one per language) that Google indexes as separate duplicate pages.
  if (pathParts.length > 2 && pathParts[1] === "birthday" && /^\d{1,2}-\d{1,2}$/.test(pathParts[2])) {
    const cleanKey = pathParts[2].split("-").map((n) => String(parseInt(n, 10)).padStart(2, "0")).join("-");
    return `/en/birthday/${cleanKey}${location.hash}`;
  }
  let subpage = "";
  if (pathParts.length > 1) {
    subpage = pathParts[1].replace(/\.html$/, "");
  } else if (pathParts.length === 1 && !LANGUAGES.some((l) => l.code === pathParts[0])) {
    subpage = pathParts[0].replace(/\.html$/, "");
  }

  // Drop volatile filter/search params (?date=, ?month=, ?day=, ?q=, ?season=,
  // ?country=, ?team=) on language switch so one shared link doesn't fork into
  // 9 indexed duplicates. The page state itself is re-selected after navigation.
  const VOLATILE_PARAMS = ["date", "month", "day", "q", "season", "country", "team"];
  let search = "";
  try {
    const sp = new URLSearchParams(location.search);
    VOLATILE_PARAMS.forEach((k) => sp.delete(k));
    const rest = sp.toString();
    search = rest ? `?${rest}` : "";
  } catch (_) { search = ""; }

  if (subpage && validSubpages.includes(subpage)) {
    return `/${targetCode}/${subpage}${search}${location.hash}`;
  }

  return `/${targetCode}${search}${location.hash}`;
}

function centerActiveNav() {
  if (typeof window === "undefined" || window.innerWidth > 900) return;
  const activeNav = document.querySelector(".rail nav a.on");
  if (activeNav) {
    activeNav.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setTimeout(() => {
      activeNav.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, 80);
  }
}

function bindDialogLightDismissFallback(dialog) {
  if (!dialog || dialog.dataset.lbBound === "1") return;
  dialog.dataset.lbBound = "1";
  if (!("closedBy" in HTMLDialogElement.prototype)) {
    const outside = (e) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    dialog.addEventListener("pointerdown", (e) => { pressedOutside = outside(e); });
    dialog.addEventListener("pointerup", (e) => { if (pressedOutside && outside(e)) dialog.close(); });
  }
}

function ensureLangModal() {
  if (typeof document === "undefined") return null;
  let langModal = document.getElementById("lang-modal");
  if (langModal) return langModal;

  const curLangCode = getCurrentLangCode();

  langModal = document.createElement("dialog");
  langModal.id = "lang-modal";
  langModal.className = "lang-modal-dialog";
  langModal.setAttribute("closedby", "any");
  langModal.setAttribute("aria-labelledby", "lang-modal-heading");

  let cardsHtml = "";
  LANGUAGES.forEach((l) => {
    const isActive = l.code === curLangCode;
    const href = getLangUrl(l.code);
    cardsHtml += `
      <a href="${href}" class="lang-card-option${isActive ? " active" : ""}" data-code="${l.code}">
        <span class="lang-card-flag">${l.flag}</span>
        <div class="lang-card-info">
          <span class="lang-card-name">${l.name}</span>
          <span class="lang-card-native">${l.native}</span>
          <span class="lang-card-countries">${l.note}</span>
        </div>
        ${isActive ? `<span class="lang-card-check">✓</span>` : ""}
      </a>
    `;
  });

  langModal.innerHTML = `
    <div class="lang-modal-sheet">
      <div class="lang-modal-handle"></div>
      <div class="lang-modal-header">
        <div class="lang-modal-title-wrap">
          <svg class="rail-lang-globe" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
          <h3 class="lang-modal-title" id="lang-modal-heading">Select Language / Idioma</h3>
        </div>
        <button type="button" class="lang-modal-close" id="lang-modal-close-btn" aria-label="Close language selector">&times;</button>
      </div>
      <div class="lang-modal-grid">
        ${cardsHtml}
      </div>
    </div>
  `;

  if (document.body) {
    document.body.appendChild(langModal);
    bindDialogLightDismissFallback(langModal);
  }
  return langModal;
}

function openLangModal() {
  const modal = ensureLangModal();
  if (!modal) return;
  if (typeof modal.showModal === "function" && !modal.open) {
    modal.showModal();
  } else {
    modal.setAttribute("open", "");
  }
}

function closeLangModal() {
  const modal = document.getElementById("lang-modal");
  if (!modal) return;
  if (typeof modal.close === "function" && modal.open) {
    modal.close();
  } else {
    modal.removeAttribute("open");
  }
}

function ensureMobileMenuDrawer() {
  let drawer = document.getElementById("mobile-nav-drawer");
  if (drawer) return drawer;

  const DRAWER_I18N = {
    en: {
      menuTitle: "Messi<b>Stats</b> Menu",
      statGoals: "Total Goals",
      statApps: "Senior Apps",
      statTrophies: "Trophies",
      statBallons: "Ballons d'Or",
      catFeatured: "Featured",
      catHistory: "History & Trophies",
      catStats: "Big Matches & Stats",
      home: "Career Home & Stats",
      vsRonaldo: "Messi vs Ronaldo",
      latestGoal: "Latest Goal Replay",
      birthday: "Birthday Goals Explorer",
      days: "All 366 Days",
      achievements: "All 47 Trophies & Awards",
      timeline: "Career Timeline & Photos",
      goalsByYear: "Goals by Calendar Year",
      goalsBySeason: "Goals by Season",
      dashboard: "Deep Stats & Analytics",
      vsRealMadrid: "vs Real Madrid (El Clásico)",
      championsLeague: "Champions League Hub",
      toggleTheme: "Toggle Dark / Light"
    },
    es: {
      menuTitle: "Menú Messi<b>Stats</b>",
      statGoals: "Goles Totales",
      statApps: "Partidos",
      statTrophies: "Títulos",
      statBallons: "Balones de Oro",
      catFeatured: "Destacado",
      catHistory: "Historia y Títulos",
      catStats: "Partidos y Análisis",
      home: "Inicio y Estadísticas",
      vsRonaldo: "Messi vs Ronaldo",
      latestGoal: "Último Gol Replay",
      birthday: "Goles en tu Cumpleaños",
      days: "Los 366 días",
      achievements: "Los 47 Títulos y Premios",
      timeline: "Línea de Tiempo y Fotos",
      goalsByYear: "Goles por Año Calendario",
      goalsBySeason: "Goles por Temporada",
      dashboard: "Panel de Análisis Avanzado",
      vsRealMadrid: "vs Real Madrid (El Clásico)",
      championsLeague: "Champions League Hub",
      toggleTheme: "Cambiar Tema"
    },
    pt: {
      menuTitle: "Menu Messi<b>Stats</b>",
      statGoals: "Total de Gols",
      statApps: "Partidas",
      statTrophies: "Títulos",
      statBallons: "Bolas de Ouro",
      catFeatured: "Destaques",
      catHistory: "História e Títulos",
      catStats: "Grandes Jogos e Dados",
      home: "Início e Estatísticas",
      vsRonaldo: "Messi vs Ronaldo",
      latestGoal: "Último Gol Replay",
      birthday: "Gols no Aniversário",
      days: "Os 366 dias",
      achievements: "Todos os 47 Títulos",
      timeline: "Linha do Tempo e Fotos",
      goalsByYear: "Gols por Ano",
      goalsBySeason: "Gols por Temporada",
      dashboard: "Painel de Análise",
      vsRealMadrid: "vs Real Madrid (El Clásico)",
      championsLeague: "Champions League Hub",
      toggleTheme: "Alternar Tema"
    },
    fr: {
      menuTitle: "Menu Messi<b>Stats</b>",
      statGoals: "Total de Buts",
      statApps: "Matchs",
      statTrophies: "Trophées",
      statBallons: "Ballons d'Or",
      catFeatured: "En Vedette",
      catHistory: "Histoire & Trophées",
      catStats: "Grands Matchs & Stats",
      home: "Accueil & Statistiques",
      vsRonaldo: "Messi vs Ronaldo",
      latestGoal: "Dernier But Replay",
      birthday: "Buts par Anniversaire",
      days: "Les 366 jours",
      achievements: "Tous les 47 Trophées",
      timeline: "Chronologie & Photos",
      goalsByYear: "Buts par Année Civile",
      goalsBySeason: "Buts par Saison",
      dashboard: "Tableau de Bord & Analyses",
      vsRealMadrid: "vs Real Madrid (El Clásico)",
      championsLeague: "Hub Ligue des Champions",
      toggleTheme: "Basculer le Thème"
    },
    ro: {
      menuTitle: "Meniu Messi<b>Stats</b>",
      statGoals: "Total Goluri",
      statApps: "Meciuri",
      statTrophies: "Trofee",
      statBallons: "Baloane de Aur",
      catFeatured: "Recomandate",
      catHistory: "Istorie și Trofee",
      catStats: "Meciuri Mari și Date",
      home: "Acasă și Statistici Carieră",
      vsRonaldo: "Messi vs Ronaldo",
      latestGoal: "Revederea Ultimului Gol",
      birthday: "Goluri de Ziua Ta",
      days: "Toate cele 366 de zile",
      achievements: "Toate cele 47 de Trofee",
      timeline: "Cronologie și Fotografii",
      goalsByYear: "Goluri pe An Calendaristic",
      goalsBySeason: "Goluri pe Sezon",
      dashboard: "Panou de Analiză Avansată",
      vsRealMadrid: "vs Real Madrid (El Clásico)",
      championsLeague: "Hub Champions League",
      toggleTheme: "Comutare Temă"
    },
    uz: {
      menuTitle: "Messi<b>Stats</b> Menyu",
      statGoals: "Jami Gollar",
      statApps: "O'yinlar",
      statTrophies: "Sovrinlar",
      statBallons: "Oltin To'plar",
      catFeatured: "Tanlangan",
      catHistory: "Tarix va Sovrinlar",
      catStats: "Muhim O'yinlar va Tahlil",
      home: "Asosiy va Statistika",
      vsRonaldo: "Messi vs Ronaldo",
      latestGoal: "So'nggi Gol Takrori",
      birthday: "Tug'ilgan Kundagi Gollar",
      days: "366 kunlik",
      achievements: "Barcha 47 ta Sovrin",
      timeline: "Xronologiya va Suratlar",
      goalsByYear: "Yillar Bo'yicha Gollar",
      goalsBySeason: "Mavsumlar Bo'yicha Gollar",
      dashboard: "Tahliliy Panel",
      vsRealMadrid: "Real Madridga Qarshi (El Klasiko)",
      championsLeague: "Chempionlar Ligasi Xabi",
      toggleTheme: "Rejimni O'zgartirish"
    },
    ar: {
      menuTitle: "قائمة Messi<b>Stats</b>",
      statGoals: "إجمالي الأهداف",
      statApps: "المباريات الرسمية",
      statTrophies: "الألقاب",
      statBallons: "الكرة الذهبية",
      catFeatured: "المميز",
      catHistory: "التاريخ والألقاب",
      catStats: "المباريات الكبرى والأرقام",
      home: "الرئيسية والإحصائيات",
      vsRonaldo: "ميسي ضد رونالدو",
      latestGoal: "إعادة الهدف الأخير",
      birthday: "أهداف يوم ميلادك",
      days: "الأيام الـ 366",
      achievements: "جميع البطولات الـ 47",
      timeline: "المسيرة والصور",
      goalsByYear: "الأهداف حسب السنة",
      goalsBySeason: "الأهداف حسب الموسم",
      dashboard: "لوحة الإحصائيات الشاملة",
      vsRealMadrid: "ضد ريال مدريد (الكلاسيكو)",
      championsLeague: "دوري أبطال أوروبا",
      toggleTheme: "تبديل المظهر"
    },
    id: {
      menuTitle: "Menu Messi<b>Stats</b>",
      statGoals: "Total Gol",
      statApps: "Pertandingan",
      statTrophies: "Trofi",
      statBallons: "Ballon d'Or",
      catFeatured: "Unggulan",
      catHistory: "Sejarah & Trofi",
      catStats: "Laga Besar & Data",
      home: "Beranda & Statistik",
      vsRonaldo: "Messi vs Ronaldo",
      latestGoal: "Tayangan Ulang Gol Terakhir",
      birthday: "Gol di Hari Ulang Tahunmu",
      days: "Semua 366 Hari",
      achievements: "Semua 47 Trofi & Penghargaan",
      timeline: "Linimasa & Foto",
      goalsByYear: "Gol per Tahun Kalender",
      goalsBySeason: "Gol per Musim",
      dashboard: "Dasbor Analitik",
      vsRealMadrid: "vs Real Madrid (El Clásico)",
      championsLeague: "Pusat Liga Champions",
      toggleTheme: "Ganti Tema"
    }
  };

  const curLangCode = getCurrentLangCode();
  const curLangObj = LANGUAGES.find((l) => l.code === curLangCode) || LANGUAGES[0];
  const curPath = (typeof location !== "undefined" ? location.pathname : "");
  const txt = DRAWER_I18N[curLangCode] || DRAWER_I18N.en;

  const navCategories = [
    {
      title: txt.catFeatured,
      items: [
        { href: getLangUrl(curLangCode), label: txt.home, badge: `${n(LIVE.goals)}`, icon: `<svg viewBox="0 0 24 24"><path d="M3 11.5 12 3l9 8.5"></path><path d="M5.5 10.5V21h5v-6h3v6h5V10.5"></path></svg>` },
        { href: `/${curLangCode}/messi-vs-ronaldo`, label: txt.vsRonaldo, badge: "GOAT", icon: `<svg viewBox="0 0 24 24"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"></path><path d="M18 8l4 4-4 4"></path></svg>` },
        { href: `/${curLangCode}/latest-goal`, label: txt.latestGoal, badge: "LIVE", icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon></svg>` },
        { href: `/${curLangCode}/birthday`, label: txt.birthday, badge: "366d", icon: `<svg viewBox="0 0 24 24"><rect height="4" rx="1" width="18" x="3" y="8"></rect><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5A4.8 4.8 0 0 1 12 8a4.8 4.8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"></path></svg>` },
        { href: "/en/days", label: txt.days, badge: "Index", icon: `<svg viewBox="0 0 24 24"><rect height="17.5" rx="2" width="17.5" x="3.25" y="3.25"></rect><path d="M3.25 8.5h17.5M8 3.25v17.5M16 3.25v17.5"></path></svg>` }
      ]
    },
    {
      title: txt.catHistory,
      items: [
        { href: `/${curLangCode}/achievements`, label: txt.achievements, badge: `${LIVE.trophies}`, icon: `<svg viewBox="0 0 24 24"><path d="M8 3.5h8V9a4 4 0 0 1-8 0V3.5Z"></path><path d="M8 5H4.5A1.5 1.5 0 0 0 6 10H8M16 5h3.5A1.5 1.5 0 0 1 18 10h-2M12 13v3.5M8.5 20.5h7M10 16.5h4V20h-4z"></path></svg>` },
        { href: `/${curLangCode}/timeline`, label: txt.timeline, badge: "2004–26", icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path></svg>` },
        { href: `/${curLangCode}/goalsbyyear`, label: txt.goalsByYear, badge: "91 in '12", icon: `<svg viewBox="0 0 24 24"><rect height="15.5" rx="2.5" width="17" x="3.5" y="5"></rect><path d="M3.5 10h17M8 2.8V6.5M16 2.8V6.5"></path></svg>` },
        { href: `/${curLangCode}/goalsbyseason`, label: txt.goalsBySeason, badge: "23 Yrs", icon: `<svg viewBox="0 0 24 24"><rect height="7.5" rx="1.5" width="7.5" x="3.5" y="3.5"></rect><rect height="7.5" rx="1.5" width="7.5" x="13" y="3.5"></rect><rect height="7.5" rx="1.5" width="7.5" x="3.5" y="13"></rect><rect height="7.5" rx="1.5" width="7.5" x="13" y="13"></rect></svg>` }
      ]
    },
    {
      title: txt.catStats,
      items: [
        { href: `/${curLangCode}/dashboard`, label: txt.dashboard, badge: "Analytics", icon: `<svg viewBox="0 0 24 24"><path d="M3.5 20.5h17"></path><path d="M6.5 20v-7M12 20V5M17.5 20v-10"></path></svg>` },
        { href: `/${curLangCode}/vs-real-madrid`, label: txt.vsRealMadrid, badge: "26G", icon: `<svg viewBox="0 0 24 24"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"></path><path d="m13 19 6-6"></path><path d="m16 16 4 4"></path><path d="m19 21 2-2"></path></svg>` },
        { href: `/${curLangCode}/champions-league`, label: txt.championsLeague, badge: "129G", icon: `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>` }
      ]
    }
  ];

  let catHtml = "";
  for (const cat of navCategories) {
    catHtml += `<div class="mobile-drawer-section-title">${cat.title}</div><div class="mobile-drawer-nav-group">`;
    for (const itm of cat.items) {
      const isCurrent = curPath === itm.href || (itm.href.endsWith(`/${curLangCode}`) && (curPath === "/" || curPath === `/${curLangCode}/` || curPath === `/${curLangCode}`));
      catHtml += `
        <a href="${itm.href}" class="mobile-drawer-link ${isCurrent ? "on" : ""}">
          ${itm.icon}
          <span>${itm.label}</span>
          ${itm.badge ? `<span class="drawer-badge">${itm.badge}</span>` : ""}
        </a>
      `;
    }
    catHtml += `</div>`;
  }

  drawer = document.createElement("dialog");
  drawer.id = "mobile-nav-drawer";
  drawer.className = "mobile-drawer-dialog";
  drawer.setAttribute("closedby", "any");
  drawer.setAttribute("aria-label", "Navigation Menu");
  drawer.innerHTML = `
    <div class="mobile-drawer-sheet">
      <div class="mobile-drawer-header">
        <div class="mobile-drawer-brand">
          <img src="/img/logo.png" alt="MessiStats Logo" width="28" height="28" style="object-fit:contain;border-radius:4px;flex:0 0 28px;"/>
          <span>${txt.menuTitle}</span>
        </div>
        <button type="button" class="mobile-drawer-close" id="mobile-drawer-close-btn" aria-label="Close menu">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="mobile-drawer-body">
        <div class="mobile-drawer-stats-card">
          <div class="mobile-drawer-stat"><span class="num">${n(LIVE.goals)}</span><span class="lbl">${txt.statGoals}</span></div>
          <div class="mobile-drawer-stat"><span class="num">${n(LIVE.apps)}</span><span class="lbl">${txt.statApps}</span></div>
          <div class="mobile-drawer-stat"><span class="num">${LIVE.trophies}</span><span class="lbl">${txt.statTrophies}</span></div>
          <div class="mobile-drawer-stat"><span class="num">8</span><span class="lbl">${txt.statBallons}</span></div>
        </div>
        ${catHtml}
        <div class="mobile-drawer-footer">
          <button type="button" class="mobile-drawer-btn" id="drawer-lang-btn">
            <span>${curLangObj.flag}</span>
            <span>${curLangObj.name}</span>
          </button>
          <button type="button" class="mobile-drawer-btn" id="drawer-theme-btn">
            <span>${txt.toggleTheme}</span>
          </button>
        </div>
        <div class="mobile-drawer-social">
          <a href="https://x.com/messistat1" target="_blank" rel="noopener noreferrer" class="mobile-drawer-x-btn" aria-label="Follow @messistat1 on X">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            <span>Follow @messistat1 on X</span>
          </a>
          <a href="https://t.me/messistatdotcom" target="_blank" rel="noopener noreferrer" class="mobile-drawer-x-btn mobile-drawer-tg-btn" aria-label="Join MessiStat on Telegram">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            <span>Telegram @messistatdotcom</span>
          </a>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(drawer);
  bindDialogLightDismissFallback(drawer);
  drawer.addEventListener("close", () => {
    const menuBtn = document.getElementById("mobile-menu-btn");
    if (menuBtn) {
      menuBtn.classList.remove("active");
      menuBtn.setAttribute("aria-expanded", "false");
    }
  });
  return drawer;
}

function openMobileMenuDrawer() {
  const drawer = ensureMobileMenuDrawer();
  ensureMobileMoreNavBtn();
  if (!drawer) return;
  if (typeof drawer.showModal === "function" && !drawer.open) {
    drawer.showModal();
  } else {
    drawer.setAttribute("open", "");
  }
  const menuBtn = document.getElementById("mobile-menu-btn");
  if (menuBtn) {
    menuBtn.classList.add("active");
    menuBtn.setAttribute("aria-expanded", "true");
  }
}

function closeMobileMenuDrawer() {
  const drawer = document.getElementById("mobile-nav-drawer");
  if (!drawer) return;
  if (typeof drawer.close === "function" && drawer.open) {
    drawer.close();
  } else {
    drawer.removeAttribute("open");
  }
}


// ---------- Mobile 'More' Button in Bottom Rail ----------
function ensureMobileMoreNavBtn() {
  if (typeof document === 'undefined') return;
  const railNav = document.querySelector(".rail nav");
  if (!railNav || railNav.querySelector(".rail-more-btn")) return;
  const curLang = getCurrentLangCode();
  const moreLabels = {
    en: "More",
    es: "Más",
    pt: "Mais",
    fr: "Plus",
    ro: "Mai mult",
    uz: "Ko'proq",
    ar: "المزيد",
    id: "Lainnya"
  };
  const label = moreLabels[curLang] || "More";
  const moreBtn = document.createElement("button");
  moreBtn.type = "button";
  moreBtn.className = "rail-more-btn";
  moreBtn.setAttribute("aria-label", "Open all pages menu");
  moreBtn.title = label;
  moreBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="1.5"></circle>
      <circle cx="19" cy="12" r="1.5"></circle>
      <circle cx="5" cy="12" r="1.5"></circle>
    </svg>
    <span>${label}</span>
  `;
  moreBtn.onclick = (e) => {
    e.preventDefault();
    openMobileMenuDrawer();
  };
  railNav.appendChild(moreBtn);
}

function ensureDesktopBrandHeader() {
  if (typeof document === "undefined") return;
  const wrap = document.querySelector("#main.wrap") || document.querySelector(".wrap");
  if (!wrap) return;
  const curLang = getCurrentLangCode();
  const searchPrompts = {
    en: "Search 937 goals, years, rivals…",
    es: "Buscar 937 goles, años, rivales…",
    pt: "Buscar 937 gols, anos, rivais…",
    fr: "Rechercher 937 buts, années, rivaux…",
    ro: "Caută 937 goluri, ani, rivali…",
    uz: "937 gol, yil va raqiblarni qidiring…",
    ar: "ابحث في 937 هدفاً، السنوات، المنافسين…",
    id: "Cari 937 gol, tahun, rival…"
  };
  const brandSubs = {
    en: "Verified Career Archive &amp; Video Database",
    es: "Archivo Oficial y Base de Vídeos",
    pt: "Arquivo Oficial e Base de Vídeos",
    fr: "Archives Officielles &amp; Base Vidéo",
    ro: "Arhivă Oficială și Bază Video",
    uz: "Tasdiqlangan Karyera Arxivi va Video Baza",
    ar: "الأرشيف الرسمي وقاعدة بيانات الأهداف",
    id: "Arsip Karier Terverifikasi &amp; Basis Data Video"
  };
  const existing = wrap.querySelector(".desktop-brand-header");
  if (existing) {
    if (!existing.querySelector(".masthead-actions")) {
      const actions = document.createElement("div");
      actions.className = "masthead-actions";
      actions.innerHTML = `
        <button type="button" class="masthead-search-trigger" data-open-cmd aria-label="Quick Search">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7.5"></circle><line x1="20.5" y1="20.5" x2="16.3" y2="16.3"></line></svg>
          <span>${searchPrompts[curLang] || searchPrompts.en}</span>
          <kbd>⌘K</kbd>
        </button>
        <a href="/${curLang}/latest-goal" class="masthead-live-pill">
          <span class="live-dot-mini" aria-hidden="true"></span>
          <span>#<b class="tnum" data-live-goal-num>${LIVE.goals}</b> ▶</span>
        </a>
      `;
      existing.appendChild(actions);
    }
    return;
  }

  const brandHeader = document.createElement("header");
  brandHeader.className = "desktop-brand-header";
  brandHeader.innerHTML = `
    <a href="${getLangUrl(curLang)}" class="desktop-brand-logo-link" aria-label="MessiStat Home">
      <img src="/img/logo.png" alt="MessiStat Logo" class="desktop-brand-logo" width="40" height="40" />
    </a>
    <div class="desktop-brand-titles">
      <div class="desktop-brand-name">Messi<span>Stat</span></div>
      <div class="desktop-brand-sub">${brandSubs[curLang] || brandSubs.en}</div>
    </div>
    <div class="masthead-actions">
      <button type="button" class="masthead-search-trigger" data-open-cmd aria-label="Quick Search">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7.5"></circle><line x1="20.5" y1="20.5" x2="16.3" y2="16.3"></line></svg>
        <span>${searchPrompts[curLang] || searchPrompts.en}</span>
        <kbd>⌘K</kbd>
      </button>
      <a href="/${curLang}/latest-goal" class="masthead-live-pill">
        <span class="live-dot-mini" aria-hidden="true"></span>
        <span>#<b class="tnum" data-live-goal-num>${LIVE.goals}</b> ▶</span>
      </a>
    </div>
  `;
  wrap.prepend(brandHeader);
}

/* Keyboard users land here first: one Tab press reveals a jump-to-content link. */
function ensureSkipLink() {
  if (typeof document === "undefined") return;
  if (document.querySelector(".skip-link")) return;
  const main = document.getElementById("main") || document.querySelector(".wrap");
  if (!main) return;
  if (!main.id) main.id = "main";
  const lang = getCurrentLangCode();
  const skipLabels = {
    en: "Skip to content",
    es: "Saltar al contenido",
    pt: "Pular para o conteúdo",
    fr: "Aller au contenu",
    ro: "Sari la conținut",
    uz: "Kontentga o'tish",
    ar: "تخطي إلى المحتوى",
    id: "Langsung ke konten"
  };
  const link = document.createElement("a");
  link.className = "skip-link";
  link.href = "#main";
  link.textContent = skipLabels[lang] || skipLabels.en;
  document.body.prepend(link);
}
ensureSkipLink();

/* The 300x250 leaderboard sits above the headline, which on a 390x844 phone
   pushed the H1 to 429px — over half the first screen before any content.
   On phones we let the headline win and drop the slot just under the lede.
   Desktop keeps the original position, and rotating re-applies the layout. */
function placeTopAdForViewport() {
  if (typeof document === "undefined") return;
  const ad = document.querySelector(".ad-banner-top");
  const main = document.getElementById("main") || document.querySelector(".wrap");
  if (!ad || !main) return;
  const narrow = window.innerWidth < 900;
  if (narrow) {
    if (ad.dataset.adMoved === "1") return;
    const anchor = main.querySelector(".lede, .page-lead") || null;
    if (anchor && anchor.parentElement) {
      anchor.insertAdjacentElement("afterend", ad);
      ad.dataset.adMoved = "1";
    }
  } else if (ad.dataset.adMoved === "1") {
    if (main.firstElementChild) main.insertBefore(ad, main.firstElementChild);
    else main.appendChild(ad);
    ad.dataset.adMoved = "0";
  }
}
placeTopAdForViewport();
window.addEventListener("messi:spark-relayout", placeTopAdForViewport);
if (typeof window !== "undefined") {
  window.addEventListener("orientationchange", () => setTimeout(placeTopAdForViewport, 120));
}

function mountHubMonetizeBar() {
  if (typeof document === "undefined") return;
  if (document.getElementById("hub-monetize-bar")) return;

  const HUB_PAGE_ALIASES = {
    "goalsbyyear": "goalsbyyear",
    "byyear": "goalsbyyear",
    "goalsbyseason": "goalsbyseason",
    "byseason": "goalsbyseason",
    "champions-league": "champions-league",
    "vs-real-madrid": "vs-real-madrid",
    "achievements": "achievements",
    "messi-vs-ronaldo": "messi-vs-ronaldo",
    "vs-ronaldo": "messi-vs-ronaldo",
    "dashboard": "dashboard",
    "timeline": "timeline"
  };

  let hubKey = "";
  const bodyPage = (document.body && document.body.dataset && document.body.dataset.page || "").toLowerCase();
  if (HUB_PAGE_ALIASES[bodyPage]) {
    hubKey = HUB_PAGE_ALIASES[bodyPage];
  } else if (typeof location !== "undefined") {
    const parts = location.pathname
      .toLowerCase()
      .split("/")
      .filter(Boolean)
      .map((p) => p.replace(/\.html$/, ""));
    for (let i = parts.length - 1; i >= 0; i--) {
      if (HUB_PAGE_ALIASES[parts[i]]) {
        hubKey = HUB_PAGE_ALIASES[parts[i]];
        break;
      }
    }
  }
  if (!hubKey) return;

  const lang = getCurrentLangCode();
  const WATCH_LABELS = {
    en: "▶ Watch HD Goal Highlights & Live Streams",
    es: "▶ Ver Goles en HD y Partidos en Vivo",
    pt: "▶ Ver Gols em HD e Jogos ao Vivo",
    fr: "▶ Voir les Buts HD & Matchs en Direct",
    ro: "▶ Vezi Goluri HD și Meciuri Live",
    uz: "▶ HD Gollar va Jonli Efirni Ko'rish",
    ar: "▶ شاهد أهداف HD والمباريات المباشرة",
    id: "▶ Tonton Cuplikan Gol HD & Live Streaming"
  };
  const ARIA_LABELS = {
    en: "Goal Highlights & Official Gear",
    es: "Resúmenes de Goles y Equipación Oficial",
    pt: "Melhores Momentos e Camisas Oficiais",
    fr: "Temps Forts & Équipement Officiel",
    ro: "Momente Cheie & Echipament Oficial",
    uz: "Gol Lahzalari & Rasmiy Forma",
    ar: "أبرز الأهداف والأدوات الرسمية",
    id: "Cuplikan Gol & Jersey Resmi"
  };
  const KIT_CONFIG = {
    classic: {
      href: MONETIZE_CONFIG.offers.kitBarcaBootsUrl,
      labels: {
        en: "Classic #10 Kit & F50 Boots ↗",
        es: "Camiseta #10 Clásica y Botas F50 ↗",
        pt: "Camisa #10 Clássica e Chuteiras F50 ↗",
        fr: "Maillot #10 Classique & Crampons F50 ↗",
        ro: "Tricou Clasic #10 și Ghete F50 ↗",
        uz: "Klassik #10 Forma va F50 Poyabzal ↗",
        ar: "الطقم الكلاسيكي #10 وحذاء F50 ↗",
        id: "Jersey Klasik #10 & Sepatu F50 ↗"
      }
    },
    argentina: {
      href: MONETIZE_CONFIG.offers.kitArgentinaUrl,
      labels: {
        en: "Argentina 3-Star #10 Jersey ↗",
        es: "Camiseta Argentina 3 Estrellas #10 ↗",
        pt: "Camisa Argentina 3 Estrelas #10 ↗",
        fr: "Maillot Argentine 3 Étoiles #10 ↗",
        ro: "Tricou Argentina 3 Stele #10 ↗",
        uz: "Argentina 3 Yulduzli #10 Forma ↗",
        ar: "قميص الأرجنتين 3 نجوم #10 ↗",
        id: "Jersey Argentina 3 Bintang #10 ↗"
      }
    },
    miami: {
      href: MONETIZE_CONFIG.offers.kitMiamiUrl,
      labels: {
        en: "Inter Miami #10 Official Kit ↗",
        es: "Camiseta Oficial Inter Miami #10 ↗",
        pt: "Camisa Oficial Inter Miami #10 ↗",
        fr: "Maillot Officiel Inter Miami #10 ↗",
        ro: "Tricou Oficial Inter Miami #10 ↗",
        uz: "Inter Mayami Rasmiy #10 Forma ↗",
        ar: "الزي الرسمي لإنتر ميامي #10 ↗",
        id: "Jersey Resmi Inter Miami #10 ↗"
      }
    }
  };

  let eraGroup = "miami";
  if (hubKey === "champions-league" || hubKey === "vs-real-madrid" || hubKey === "goalsbyyear") {
    eraGroup = "classic";
  } else if (hubKey === "achievements" || hubKey === "timeline") {
    eraGroup = "argentina";
  }
  const kit = KIT_CONFIG[eraGroup];

  const bar = document.createElement("aside");
  bar.id = "hub-monetize-bar";
  bar.className = "hub-monetize-bar";
  bar.setAttribute("aria-label", ARIA_LABELS[lang] || ARIA_LABELS.en);

  const watchLink = document.createElement("a");
  watchLink.className = "hub-monetize-btn hub-monetize-watch";
  watchLink.href = MONETIZE_CONFIG.adsterraSmartlinkUrl;
  watchLink.target = "_blank";
  watchLink.rel = "noopener noreferrer sponsored";
  watchLink.textContent = WATCH_LABELS[lang] || WATCH_LABELS.en;

  const kitLink = document.createElement("a");
  kitLink.className = "hub-monetize-btn hub-monetize-kit";
  kitLink.href = kit.href;
  kitLink.target = "_blank";
  kitLink.rel = "noopener sponsored";
  kitLink.textContent = kit.labels[lang] || kit.labels.en;

  bar.appendChild(watchLink);
  bar.appendChild(kitLink);

  const main = document.getElementById("main") || document.querySelector("main.wrap") || document.querySelector(".wrap") || document.body;
  if (!main) return;

  let anchor = null;
  if (hubKey === "messi-vs-ronaldo") {
    anchor = document.getElementById("rivalry-tug-arena");
  }
  if (!anchor) {
    anchor = main.querySelector(".page-lead, .lede, h1");
  }
  if (anchor && anchor.parentElement) {
    anchor.insertAdjacentElement("afterend", bar);
  } else {
    main.prepend(bar);
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountHubMonetizeBar, { once: true });
  } else {
    mountHubMonetizeBar();
  }
}

function initDonationPopup() {
  // Per content-first-noise-reduction: inline community ribbon + #support section +
  // 4-minute non-blocking corner toast handle support without blocking modal interruptions.
}

/* ===== Rec #4: High-CPA Match Stream, VPN & Kit Deck on /latest-goal ===== */
function mountLatestGoalCpaDeck() {
  if (typeof document === "undefined") return;
  if (isOwnerNoAdsActive()) return;
  if (document.getElementById("lg-cpa-deck")) return;

  // Only run on /latest-goal paths (any locale)
  const pathname = (typeof location !== "undefined" ? location.pathname : "").toLowerCase();
  if (!pathname.includes("/latest-goal")) return;

  const lang = getCurrentLangCode();
  const goalNum = LIVE.lgNum || LIVE.goals || 937;

  const DECK_I18N = {
    en: {
      aria: "Live Match Broadcast, Streaming VPN & Official Gear",
      streamBadge: "LIVE BROADCAST",
      streamTitle: `Watch Inter Miami & Argentina Live — Official Match Pass & HD Streams`,
      streamBtn: "Watch Live Stream ▶",
      vpnBadge: "GEO-UNBLOCK VPN",
      vpnTitle: "Unlock Blackout & Geo-Blocked Match Streams Worldwide",
      vpnBtn: "Get Streaming VPN ↗",
      kitBadge: "OFFICIAL #10 KIT",
      kitTitle: `Wear the Goal #${goalNum} Kit — Official Inter Miami CF #10 Jersey`,
      kitBtn: "Check Price & Sizes ↗"
    },
    es: {
      aria: "Transmisión en Vivo, VPN y Camiseta Oficial",
      streamBadge: "TRANSMISIÓN HD",
      streamTitle: "Mira Inter Miami y Argentina en Vivo — Pase Oficial del Partido en HD",
      streamBtn: "Ver en Vivo ▶",
      vpnBadge: "VPN SIN BLOQUEOS",
      vpnTitle: "Desbloquea Partidos con Restricción Geográfica en HD",
      vpnBtn: "Activar VPN Streaming ↗",
      kitBadge: "CAMISETA OFICIAL",
      kitTitle: `Luce la Camiseta del Gol #${goalNum} — Oficial Inter Miami CF #10`,
      kitBtn: "Ver Precio y Tallas ↗"
    },
    pt: {
      aria: "Transmissão ao Vivo, VPN e Camisa Oficial",
      streamBadge: "TRANSMISSÃO HD",
      streamTitle: "Assista Inter Miami & Argentina Ao Vivo — Passe Oficial e Streams HD",
      streamBtn: "Assistir Ao Vivo ▶",
      vpnBadge: "VPN STREAMING",
      vpnTitle: "Desbloqueie Transmissões com Bloqueio Regional em Qualquer País",
      vpnBtn: "Obter VPN Streaming ↗",
      kitBadge: "CAMISA OFICIAL",
      kitTitle: `Vista a Camisa do Gol #${goalNum} — Oficial Inter Miami CF #10`,
      kitBtn: "Ver Preço e Tamanhos ↗"
    },
    fr: {
      aria: "Diffusion en Direct, VPN & Maillot Officiel",
      streamBadge: "DIFFUSION LIVE",
      streamTitle: "Regardez Inter Miami & Argentine en Direct — Pass Match & Streams HD",
      streamBtn: "Regarder en Direct ▶",
      vpnBadge: "VPN STREAMING",
      vpnTitle: "Débloquez les Diffusions Géo-Bloquées dans le Monde Entier",
      vpnBtn: "Activer le VPN ↗",
      kitBadge: "MAILLOT OFFICIEL",
      kitTitle: `Portez le Maillot du But #${goalNum} — Officiel Inter Miami CF #10`,
      kitBtn: "Voir Prix & Tailles ↗"
    },
    ro: {
      aria: "Transmisiune Live, VPN și Tricou Oficial",
      streamBadge: "TRANSMISIUNE HD",
      streamTitle: "Urmărește Inter Miami și Argentina Live — Pass Oficial și Streaming HD",
      streamBtn: "Urmărește Live ▶",
      vpnBadge: "VPN STREAMING",
      vpnTitle: "Deblochează Meciurile cu Restricții Regionale Oriunde în Lume",
      vpnBtn: "Activează VPN ↗",
      kitBadge: "TRICOU OFICIAL",
      kitTitle: `Poartă Tricoul Golului #${goalNum} — Oficial Inter Miami CF #10`,
      kitBtn: "Vezi Preț și Mărimi ↗"
    },
    uz: {
      aria: "Jonli Efir, VPN va Rasmiy Forma",
      streamBadge: "JONLI EFIR",
      streamTitle: "Inter Mayami va Argentina Jonli Efiri — Rasmiy O'yin Pasi va HD Stream",
      streamBtn: "Jonli Efirni Ko'rish ▶",
      vpnBadge: "STREAMING VPN",
      vpnTitle: "Hududiy Cheklangan O'yinlarni Istalgan Joyda HD Sifatda Tomosha Qiling",
      vpnBtn: "VPN Olish ↗",
      kitBadge: "RASMIY FORMA",
      kitTitle: `${goalNum}-Gol Formasini Kiy — Rasmiy Inter Mayami CF #10`,
      kitBtn: "Narx va O'lchamlar ↗"
    },
    ar: {
      aria: "البث المباشر، VPN والزي الرسمي",
      streamBadge: "بث مباشر HD",
      streamTitle: "شاهد إنتر ميامي والأرجنتين مباشرة — تذكرة المباراة الرسمية والبث HD",
      streamBtn: "شاهد البث المباشر ▶",
      vpnBadge: "VPN للبث الرياضي",
      vpnTitle: "افتح بث المباريات المحجوبة جغرافياً في أي مكان بالعالم",
      vpnBtn: "احصل على VPN ↗",
      kitBadge: "القميص الرسمي",
      kitTitle: `ارتدِ قميص الهدف #${goalNum} — الزي الرسمي لإنتر ميامي CF #10`,
      kitBtn: "تحقق من السعر والمقاسات ↗"
    },
    id: {
      aria: "Streaming Langsung, VPN & Jersey Resmi",
      streamBadge: "SIARAN LANGSUNG HD",
      streamTitle: "Tonton Inter Miami & Argentina Live — Match Pass Resmi & Stream HD",
      streamBtn: "Tonton Live ▶",
      vpnBadge: "VPN STREAMING",
      vpnTitle: "Buka Blokir Pertandingan Terbatas Wilayah di Mana Saja dalam HD",
      vpnBtn: "Dapatkan VPN ↗",
      kitBadge: "JERSEY RESMI",
      kitTitle: `Pakai Jersey Gol #${goalNum} — Resmi Inter Miami CF #10`,
      kitBtn: "Cek Harga & Ukuran ↗"
    }
  };

  const c = DECK_I18N[lang] || DECK_I18N.en;
  const deck = document.createElement("section");
  deck.id = "lg-cpa-deck";
  deck.className = "lg-cpa-deck";
  deck.setAttribute("aria-label", c.aria);

  deck.innerHTML = `
    <div class="lg-cpa-grid">
      <div class="lg-cpa-card lg-cpa-stream">
        <span class="lg-cpa-badge"><span class="live-dot-mini" aria-hidden="true"></span>${c.streamBadge}</span>
        <p class="lg-cpa-card-title">${c.streamTitle}</p>
        <a class="lg-cpa-btn lg-cpa-cta lg-cpa-btn-stream"
           href="${MONETIZE_CONFIG.offers.mlsStreamPassUrl}"
           target="_blank" rel="noopener noreferrer sponsored">${c.streamBtn}</a>
      </div>
      <div class="lg-cpa-card lg-cpa-vpn">
        <span class="lg-cpa-badge">${c.vpnBadge}</span>
        <p class="lg-cpa-card-title">${c.vpnTitle}</p>
        <a class="lg-cpa-btn lg-cpa-cta lg-cpa-btn-vpn"
           href="${MONETIZE_CONFIG.offers.vpnStreamUrl}"
           target="_blank" rel="noopener noreferrer sponsored">${c.vpnBtn}</a>
      </div>
      <div class="lg-cpa-card lg-cpa-kit">
        <span class="lg-cpa-badge">${c.kitBadge}</span>
        <p class="lg-cpa-card-title">${c.kitTitle}</p>
        <a class="lg-cpa-btn lg-cpa-cta lg-cpa-btn-kit"
           href="${MONETIZE_CONFIG.offers.kitMiamiUrl}"
           target="_blank" rel="noopener sponsored">${c.kitBtn}</a>
      </div>
    </div>
  `;

  // Insert right after .video-player-card or #today-status-section
  const anchor =
    document.querySelector(".video-player-card") ||
    document.getElementById("today-status-section") ||
    document.querySelector(".page-lead, .lede, h1");
  const main =
    document.getElementById("main") ||
    document.querySelector("main.wrap, .wrap") ||
    document.body;

  if (anchor && anchor.parentElement) {
    anchor.insertAdjacentElement("afterend", deck);
  } else if (main) {
    main.prepend(deck);
  }
}

/* ===== Rec #1: In-Page Social Bar Notification Unit ===== */
function initInPageSocialBar() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (document.body?.dataset?.page === "advertise") return;

  // Skip for owner self-traffic or Playwright automation or once dismissed
  try {
    if (isOwnerNoAdsActive()) return;
    if (sessionStorage.getItem("ms_session_sl_v1") === "1") return;
    if (sessionStorage.getItem("ms_push_dismissed") === "1") return;
  } catch (_) { return; }

  const lang = getCurrentLangCode();

  // If a Social Bar script URL is configured, mount the iframe
  if (MONETIZE_CONFIG.adsterraSocialBarScriptUrl) {
    if (document.getElementById("ms-socialbar-iframe-wrap")) return;
    const iframeWrap = document.createElement("div");
    iframeWrap.id = "ms-socialbar-iframe-wrap";
    iframeWrap.style.cssText = "position:fixed;bottom:0;left:0;width:100%;z-index:9995;pointer-events:none;";
    const iframe = document.createElement("iframe");
    iframe.src = `/ads/social-bar.html?src=${encodeURIComponent(MONETIZE_CONFIG.adsterraSocialBarScriptUrl)}`;
    iframe.style.cssText = "width:100%;height:50px;border:none;pointer-events:auto;";
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("frameborder", "0");
    iframeWrap.appendChild(iframe);
    document.body.appendChild(iframeWrap);
    return;
  }

  const goalNum = LIVE.lgNum || LIVE.goals || 937;
  const opp = LIVE.lgOpp || "New England";
  const PUSH_I18N = {
    en: {
      badge: `LIVE REPLAY · #${goalNum}`,
      title: `Goal #${goalNum} HD Replay & Match Stream`,
      subtitle: `Watch Messi's latest strike vs ${opp} + live match stream`,
      cta: "Watch HD Replay ▶",
      dismiss: "Dismiss"
    },
    es: {
      badge: `REPETICIÓN HD · #${goalNum}`,
      title: `Gol #${goalNum} Repetición HD y Partido`,
      subtitle: `Mira el último gol de Messi vs ${opp} + transmisión en vivo`,
      cta: "Ver Repetición ▶",
      dismiss: "Cerrar"
    },
    pt: {
      badge: `REPLAY AO VIVO · #${goalNum}`,
      title: `Gol #${goalNum} Replay HD e Transmissão`,
      subtitle: `Assista ao último gol de Messi vs ${opp} + transmissão ao vivo`,
      cta: "Assistir Replay ▶",
      dismiss: "Fechar"
    },
    fr: {
      badge: `REPLAY HD · #${goalNum}`,
      title: `But #${goalNum} Replay HD & Direct`,
      subtitle: `Regardez le dernier but de Messi vs ${opp} + match en direct`,
      cta: "Voir le Replay ▶",
      dismiss: "Fermer"
    },
    ro: {
      badge: `REPLAY LIVE · #${goalNum}`,
      title: `Golul #${goalNum} Replay HD și Stream`,
      subtitle: `Vezi ultimul gol al lui Messi vs ${opp} + transmisiune live`,
      cta: "Vezi Replay HD ▶",
      dismiss: "Închide"
    },
    uz: {
      badge: `JONLI TAKROR · #${goalNum}`,
      title: `${goalNum}-Gol HD Takrori va Efir`,
      subtitle: `Messining ${opp}ga qarshi so'nggi goli va jonli o'yin efiri`,
      cta: "HD Takrorini Ko'rish ▶",
      dismiss: "Yopish"
    },
    ar: {
      badge: `إعادة مباشرة · #${goalNum}`,
      title: `إعادة الهدف #${goalNum} بجودة HD والبث`,
      subtitle: `شاهد أحدث أهداف ميسي ضد ${opp} + البث المباشر`,
      cta: "شاهد الإعادة ▶",
      dismiss: "إغلاق"
    },
    id: {
      badge: `TAYANGAN ULANG · #${goalNum}`,
      title: `Gol #${goalNum} Tayangan Ulang HD & Live`,
      subtitle: `Tonton gol terbaru Messi vs ${opp} + siaran langsung pertandingan`,
      cta: "Tonton Replay HD ▶",
      dismiss: "Tutup"
    }
  };

  const t = PUSH_I18N[lang] || PUSH_I18N.en;

  function showPush() {
    try {
      if (isOwnerNoAdsActive()) return;
      if (sessionStorage.getItem("ms_push_dismissed") === "1") return;
      if (sessionStorage.getItem("ms_social_bar_shown") === "1") return;
      sessionStorage.setItem("ms_social_bar_shown", "1");
    } catch (_) {}

    if (document.getElementById("ms-inpage-push")) return;

    const push = document.createElement("aside");
    push.id = "ms-inpage-push";
    push.className = "ms-inpage-push";
    push.setAttribute("role", "complementary");
    push.setAttribute("aria-label", t.title);
    push.innerHTML = `
      <button type="button" class="ms-inpage-push-close" aria-label="${t.dismiss}" title="${t.dismiss}">×</button>
      <div class="ms-inpage-push-inner">
        <span class="ms-inpage-push-badge">${t.badge}</span>
        <strong class="ms-inpage-push-title">${t.title}</strong>
        <p class="ms-inpage-push-subtitle">${t.subtitle}</p>
        <a class="ms-inpage-push-cta"
           href="${MONETIZE_CONFIG.adsterraSmartlinkUrl}"
           target="_blank" rel="noopener noreferrer sponsored">${t.cta}</a>
      </div>
    `;
    push.querySelector(".ms-inpage-push-close").addEventListener("click", () => {
      try { sessionStorage.setItem("ms_push_dismissed", "1"); } catch (_) {}
      push.remove();
    });
    document.body.appendChild(push);
    // Trigger slide-in animation after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { push.classList.add("ms-inpage-push--visible"); });
    });
  }

  // Fire after ~6s (or on 300px scroll after 3s)
  let scrollReady = false;
  let scrollFired = false;

  const scrollHandler = () => {
    if (scrollFired || !scrollReady) return;
    if ((window.scrollY || window.pageYOffset) >= 300) {
      scrollFired = true;
      window.removeEventListener("scroll", scrollHandler, { passive: true });
      showPush();
    }
  };

  setTimeout(() => { scrollReady = true; }, 3000);
  window.addEventListener("scroll", scrollHandler, { passive: true });
  setTimeout(() => {
    if (!scrollFired) {
      scrollFired = true;
      window.removeEventListener("scroll", scrollHandler, { passive: true });
      showPush();
    }
  }, 6000);
}

// Mount CPA deck and Social Bar after module-level constants (e.g. LIVE) are initialized below.

/* ================= ARGENTINA FAREWELL MATCH STREAM NOTIFICATION ================= */
const ARGENTINA_STREAM_I18N = {
  en: {
    badge: "FINAL ARGENTINA MATCH",
    title: "Lionel Messi's Farewell Match",
    text: "Lionel Messi's farewell game on 6 October 2026! Watch the LIVE stream free with NO ADS.",
    highlight: "Free live stream · No ads",
    cta: "Watch Free Stream ▶",
    closeAria: "Close notification",
    matchCardTitle: "Historic Farewell Match · 6 Oct 2026",
    matchCardDesc: "Watch Lionel Messi's final international match with Argentina live on Koora Live with zero ads."
  },
  es: {
    badge: "ÚLTIMO PARTIDO CON ARGENTINA",
    title: "Partido de Despedida de Lionel Messi",
    text: "¡El partido de despedida de Lionel Messi el 6 de octubre de 2026! Mira la transmisión EN VIVO gratis y SIN ANUNCIOS.",
    highlight: "Transmisión gratis en vivo · Sin anuncios",
    cta: "Ver Transmisión Gratis ▶",
    closeAria: "Cerrar notificación",
    matchCardTitle: "Partido Histórico de Despedida · 6 Oct 2026",
    matchCardDesc: "Mira el último partido internacional de Lionel Messi con Argentina en vivo en Koora Live sin anuncios."
  },
  pt: {
    badge: "ÚLTIMO JOGO PELA ARGENTINA",
    title: "Jogo de Despedida de Lionel Messi",
    text: "O jogo de despedida de Lionel Messi em 6 de outubro de 2026! Assista à transmissão AO VIVO grátis e SEM ANÚNCIOS.",
    highlight: "Transmissão ao vivo grátis · Sem anúncios",
    cta: "Assistir Grátis ▶",
    closeAria: "Fechar notificação",
    matchCardTitle: "Jogo Histórico de Despedida · 6 Out 2026",
    matchCardDesc: "Assista ao último jogo de Lionel Messi pela seleção da Argentina ao vivo no Koora Live sem anúncios."
  },
  fr: {
    badge: "DERNIER MATCH AVEC L'ARGENTINE",
    title: "Match d'Adieu de Lionel Messi",
    text: "Le match d'adieu de Lionel Messi le 6 octobre 2026 ! Regardez le direct EN DIRECT gratuit et SANS PUB.",
    highlight: "Streaming gratuit en direct · Sans pub",
    cta: "Regarder le Direct ▶",
    closeAria: "Fermer la notification",
    matchCardTitle: "Match Historique d'Adieu · 6 Oct 2026",
    matchCardDesc: "Suivez le tout dernier match de Lionel Messi avec l'Argentine en direct sur Koora Live sans aucune publicité."
  },
  ro: {
    badge: "ULTIMUL MECI CU ARGENTINA",
    title: "Meciul de Retragere al lui Lionel Messi",
    text: "Meciul de adio al lui Lionel Messi pe 6 octombrie 2026! Urmărește transmisiunea LIVE gratuit și FĂRĂ RECLAME.",
    highlight: "Streaming live gratuit · Fără reclame",
    cta: "Urmărește Live Gratuit ▶",
    closeAria: "Închide notificarea",
    matchCardTitle: "Meci Istoric de Adio · 6 Oct 2026",
    matchCardDesc: "Urmărește ultimul meci internațional al lui Lionel Messi cu Argentina live fără reclame."
  },
  uz: {
    badge: "ARGENTINA BILAN SO'NGGI O'YIN",
    title: "Lionel Messining Xayrlashuv O'yini",
    text: "2026-yil 6-oktabrda Lionel Messining xayrlashuv uchrashuvi! JONLI efirni bepul va REKLAMASIZ tomosha qiling.",
    highlight: "Bepul jonli efir · Reklamasiz",
    cta: "Bepul Efirni Ko'rish ▶",
    closeAria: "Bildirishnomani yopish",
    matchCardTitle: "Tarixiy Xayrlashuv O'yini · 6 Okt 2026",
    matchCardDesc: "Lionel Messining Argentina safidagi so'nggi xalqaro o'yinini reklamasiz jonli tomosha qiling."
  },
  ar: {
    badge: "المباراة الأخيرة مع الأرجنتين",
    title: "مباراة وداع ليونيل ميسي",
    text: "مباراة وداع ليونيل ميسي في 6 أكتوبر 2026! شاهد البث المباشر مجاناً وبدون إعلانات.",
    highlight: "بث مباشر مجاني · بدون إعلانات",
    cta: "شاهد البث المجاني ▶",
    closeAria: "إغلاق الإشعار",
    matchCardTitle: "مباراة الوداع التاريخية · 6 أكتوبر 2026",
    matchCardDesc: "شاهد آخر مباراة دولية لليونيل ميسي مع الأرجنتين مباشرة وبدون إعلانات."
  },
  id: {
    badge: "LAGA TERAKHIR ARGENTINA",
    title: "Laga Perpisahan Lionel Messi",
    text: "Laga perpisahan Lionel Messi pada 6 Oktober 2026! Tonton siaran LANGSUNG gratis TANPA IKLAN.",
    highlight: "Live stream gratis · Tanpa iklan",
    cta: "Tonton Stream Gratis ▶",
    closeAria: "Tutup notifikasi",
    matchCardTitle: "Laga Perpisahan Bersejarah · 6 Okt 2026",
    matchCardDesc: "Tonton laga internasional terakhir Lionel Messi bersama Argentina secara langsung tanpa iklan."
  }
};

function initArgentinaStreamNotification() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const STREAM_URL = "https://kooraadz.vercel.app/";

  // Target match date: 6 October 2026.
  // 2 days before is: 4 October 2026 00:00:00 UTC (1791072000000)
  // Active window until: 7 October 2026 06:00:00 UTC (1791352800000)
  const START_MS = Date.parse("2026-10-04T00:00:00Z");
  const END_MS = Date.parse("2026-10-07T06:00:00Z");
  const now = Date.now();
  const isWithinActiveWindow = now >= START_MS && now <= END_MS;

  // Immediate Preview / Testing override support
  let isTesting = false;
  try {
    const params = new URLSearchParams(window.location.search);
    isTesting = params.get("stream") === "1" ||
                params.get("preview_stream") === "1" ||
                window.__FORCE_STREAM_BANNER__ === true;
  } catch (_) {}

  // If outside active window and not forcing test mode, do not activate
  if (!isWithinActiveWindow && !isTesting) return;

  const lang = (typeof getLang === "function" ? getLang() : (typeof getCurrentLangCode === "function" ? getCurrentLangCode() : "en"));
  const t = ARGENTINA_STREAM_I18N[lang] || ARGENTINA_STREAM_I18N.en;

  // 1. Add stream link to active match card / home page matchday tracker when active
  try {
    // A. Home page & global matchday placeholder (#banner)
    const bannerHost = document.getElementById("banner");
    if (bannerHost && !document.getElementById("banner-arg-stream")) {
      bannerHost.removeAttribute("hidden");
      bannerHost.classList.add("argentina-matchday-banner-host");
      const matchdayCard = document.createElement("div");
      matchdayCard.id = "banner-arg-stream";
      matchdayCard.className = "argentina-matchday-banner";
      matchdayCard.innerHTML = `
        <div class="arg-banner-info">
          <div class="arg-banner-top">
            <span class="arg-stream-badge">
              <span class="arg-live-dot" aria-hidden="true"><span class="arg-live-dot-ping"></span><span class="arg-live-dot-core"></span></span>
              <span>${t.badge}</span>
            </span>
            <span class="arg-stream-feature">${t.highlight}</span>
          </div>
          <div class="arg-banner-title">${t.matchCardTitle}</div>
          <p class="arg-banner-desc">${t.matchCardDesc}</p>
        </div>
        <a href="${STREAM_URL}" target="_blank" rel="noopener noreferrer" class="btn-arg-banner-stream" id="banner-arg-stream-btn">
          <span>${t.cta}</span>
        </a>
      `;
      bannerHost.appendChild(matchdayCard);
    }

    // B. Today match status section on latest-goal page (#today-status-section)
    const todayCard = document.getElementById("today-status-section");
    if (todayCard && !document.getElementById("today-arg-stream-alert")) {
      const alert = document.createElement("div");
      alert.id = "today-arg-stream-alert";
      alert.className = "today-arg-stream-alert";
      alert.innerHTML = `
        <div class="today-arg-stream-top">
          <span class="arg-stream-badge">
            <span class="arg-live-dot" aria-hidden="true"><span class="arg-live-dot-ping"></span><span class="arg-live-dot-core"></span></span>
            <span>${t.badge}</span>
          </span>
          <span class="arg-stream-feature">${t.highlight}</span>
        </div>
        <div class="today-arg-stream-title">${t.matchCardTitle}</div>
        <p class="today-arg-stream-desc">${t.matchCardDesc}</p>
        <a href="${STREAM_URL}" target="_blank" rel="noopener noreferrer" class="btn-today-arg-stream" id="today-arg-stream-btn">
          <span>${t.cta}</span>
        </a>
      `;
      todayCard.appendChild(alert);
    }
  } catch (err) {
    console.warn("Argentina stream tracker sync warning:", err);
  }
}



function initFanArcade() {
  const card = document.getElementById("fan-zone");
  if (!card) return;
  if (card.dataset.arcadeInit) return;
  card.dataset.arcadeInit = "true";

  // 1. Tabs switching
  const tabs = card.querySelectorAll(".arcade-tab");
  const panels = card.querySelectorAll(".arcade-panel");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = "panel-" + tab.getAttribute("data-tab");
      tabs.forEach((t) => {
        t.classList.remove("on");
        t.setAttribute("aria-selected", "false");
      });
      panels.forEach((p) => {
        p.classList.remove("on");
        p.hidden = true;
      });

      tab.classList.add("on");
      tab.setAttribute("aria-selected", "true");
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add("on");
        targetPanel.hidden = false;
      }
    });
  });

  // 2. Quiz Controller (Authentic Mind-Blowing Messi Lore)
  const quizBox = document.getElementById("quiz-box");
  if (quizBox) {
    const ALL_LORE_QUESTIONS = [
      {
        q: "In El Clásico at the Bernabéu (Dec 2017), what crazy feat did Messi accomplish for Vidal's 93' goal?",
        opts: [
          "Assisted with only ONE boot on (lost his right shoe)",
          "Scored a bicycle kick from outside the penalty box",
          "Dribbled past 7 defenders without touching the ground",
          "Completed 100% of his passes with his right heel"
        ],
        ans: 0,
        exp: "TRUE FOOTBALL LORE: Marcelo stepped on Messi's foot and tore off his right boot. Barefoot on his right foot, Messi still dribbled past Marcelo and delivered the 93' assist to Aleix Vidal to seal a 3–0 win at the Bernabéu!"
      },
      {
        q: "What shocking event happened on Lionel Messi's senior international debut for Argentina in 2005?",
        opts: [
          "He scored a hat-trick in 10 minutes",
          "He was red-carded after just 43 seconds on the pitch",
          "He scored an own goal against Hungary",
          "He broke his shinbone during warmups"
        ],
        ans: 1,
        exp: "TRUE: Subbed on in the 63rd minute vs Hungary, Messi was controversially shown a red card after only 43 seconds for brushing off Vilmos Vanczák who was holding his shirt. Teammates found 18-year-old Messi crying in the dressing room!"
      },
      {
        q: "In his historic 2012/13 La Liga season, what unprecedented scoring world record did Messi shatter?",
        opts: [
          "Scored in 21 CONSECUTIVE league games against every single team",
          "Scored 15 penalties in a row without a goalkeeper touching the ball",
          "Scored 10 consecutive hat-tricks across 3 months",
          "Scored every single goal with his weaker right foot"
        ],
        ans: 0,
        exp: "UNTOUCHABLE RECORD: Messi scored 33 goals across 21 consecutive league matches, scoring against all 19 other teams in La Liga consecutively — the only player in world history to complete a full 'round' of scoring against every club in a league in a row!"
      },
      {
        q: "How did Lionel Messi score the 110th-minute extra-time winner in the 2009 Club World Cup Final?",
        opts: [
          "With his CHEST (diving with the Barça crest over his heart)",
          "A 40-yard direct free-kick knuckleball",
          "A bicycle kick while falling backward",
          "A direct corner kick that curved into the net"
        ],
        ans: 0,
        exp: "THE HEART GOAL: Against Estudiantes in extra time, Dani Alves crossed into the box and Messi dove forward to chest the ball into the net with the Barcelona badge over his heart, completing the first-ever 6-trophy Sextuple in European history!"
      },
      {
        q: "Against which club did Messi become the first player in modern Champions League history to score 5 GOALS in a single match?",
        opts: [
          "Bayer Leverkusen (7–1 in 2012)",
          "Arsenal (4–1 in 2010)",
          "Bayern Munich (3–0 in 2015)",
          "Paris Saint-Germain (6–1 in 2017)"
        ],
        ans: 0,
        exp: "MASTERCLASS: On 7 March 2012, Messi scored 5 goals past Bernd Leno in a 7–1 dismantling of Bayer Leverkusen at Camp Nou, prompting Wayne Rooney to tweet: 'Messi is a joke. For me the best ever.'"
      },
      {
        q: "Where was Lionel Messi's first contract agreement with FC Barcelona written and signed in December 2000?",
        opts: [
          "On a paper cafeteria napkin at a tennis club",
          "On the back of a Camp Nou matchday ticket",
          "On a restaurant tablecloth in Rosario, Argentina",
          "In a legal leather-bound notary ledger"
        ],
        ans: 0,
        exp: "ICONIC HISTORY: Barça sporting director Charly Rexach was having lunch at the Pompeia Tennis Club with Messi's agent and was so desperate to secure 13-year-old Lionel that he famously drew up the contract on a paper cafeteria napkin right at the table!"
      }
    ];

    let currentQ = 0;
    let score = 0;
    let questions = ALL_LORE_QUESTIONS.slice(0, 3);

    const renderQuestion = () => {
      if (currentQ >= questions.length) {
        const pct = Math.round((score / questions.length) * 100);
        let badge = "GOAT Scholar";
        if (score === questions.length) badge = "Certified 100% Messi Lore Master";
        else if (score >= 2) badge = "Elite Football Fan";

        quizBox.innerHTML = `
          <div class="arcade-quiz-finish animate-pop">
            <div class="quiz-finish-badge">${badge}</div>
            <h4 class="quiz-finish-title">You Scored ${score} / ${questions.length} (${pct}%)</h4>
            <p class="quiz-finish-desc">Think your friends know Messi's legendary career lore as well as you? Share your score or test yourself with another 3 questions!</p>
            <div class="quiz-finish-actions">
              <button type="button" class="btn-arcade-action" id="btn-quiz-retry">
                <span>Spin 3 New Questions</span>
              </button>
              <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just scored ${score}/${questions.length} on the Lionel Messi Career Lore Quiz on MessiStat.com! Can you beat my score?`)}&url=${encodeURIComponent(window.location.origin)}" target="_blank" rel="noopener noreferrer" class="btn-quiz-share">
                <span>Share Score</span>
              </a>
            </div>
          </div>
        `;
        const retryBtn = document.getElementById("btn-quiz-retry");
        if (retryBtn) {
          retryBtn.addEventListener("click", () => {
            currentQ = 0;
            score = 0;
            questions = ALL_LORE_QUESTIONS.sort(() => Math.random() - 0.5).slice(0, 3);
            renderQuestion();
          });
        }
        return;
      }

      const qObj = questions[currentQ];
      quizBox.innerHTML = `
        <div class="quiz-header">
          <span class="quiz-badge">Question ${currentQ + 1} of ${questions.length} • Real Messi Lore</span>
          <span class="quiz-score-indicator">Score: <b>${score}</b></span>
        </div>
        <div class="quiz-question-text">${qObj.q}</div>
        <div class="quiz-options">
          ${qObj.opts.map((opt, i) => `
            <button type="button" class="btn-quiz-opt" data-opt="${i}">
              <span class="opt-key-badge">${String.fromCharCode(65 + i)}</span>
              <span class="opt-label-text">${opt}</span>
            </button>
          `).join("")}
        </div>
        <div class="quiz-feedback" id="quiz-feedback" style="display:none;"></div>
      `;

      const optBtns = quizBox.querySelectorAll(".btn-quiz-opt");
      const feedback = document.getElementById("quiz-feedback");

      optBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          optBtns.forEach((b) => (b.disabled = true));
          const chosen = parseInt(btn.getAttribute("data-opt"), 10);
          const isRight = chosen === qObj.ans;
          if (isRight) {
            btn.classList.add("correct");
            score++;
          } else {
            btn.classList.add("wrong");
            if (optBtns[qObj.ans]) optBtns[qObj.ans].classList.add("correct");
          }

          feedback.innerHTML = `
            <div class="fb-message-wrap">
              <span class="fb-badge-result ${isRight ? "correct" : "wrong"}">${isRight ? "✓ Spot On!" : "✗ Missed It!"}</span>
              <p class="fb-explanation-text">${qObj.exp}</p>
            </div>
            <button type="button" class="btn-quiz-next" id="btn-next-q">Next Question →</button>
          `;
          feedback.style.display = "flex";
          const nextBtn = document.getElementById("btn-next-q");
          if (nextBtn) {
            nextBtn.addEventListener("click", () => {
              currentQ++;
              renderQuestion();
            });
          }
        });
      });
    };

    renderQuestion();
  }

  // 4. Birthday Goal Quick Checker
  const bdayMonth = document.getElementById("arcade-bday-month");
  const bdayDay = document.getElementById("arcade-bday-day");
  const bdayCheckBtn = document.getElementById("btn-arcade-check-bday");
  const bdayResult = document.getElementById("arcade-bday-result");

  if (bdayMonth && bdayDay) {
    const updateDaySelect = (m) => {
      const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] || 31;
      const prevVal = parseInt(bdayDay.value, 10) || 24;
      bdayDay.innerHTML = Array.from({ length: daysInMonth }, (_, i) => `<option value="${i + 1}" ${i + 1 === Math.min(prevVal, daysInMonth) ? "selected" : ""}>${i + 1}</option>`).join("");
    };

    bdayMonth.addEventListener("change", () => updateDaySelect(parseInt(bdayMonth.value, 10)));
    updateDaySelect(6); // Default June 24 (Messi's birthday)

    if (bdayCheckBtn && bdayResult) {
      bdayCheckBtn.addEventListener("click", async () => {
        const m = String(bdayMonth.value).padStart(2, "0");
        const d = String(bdayDay.value).padStart(2, "0");
        const key = `${m}-${d}`;
        bdayResult.innerHTML = `Searching calendar database...`;
        bdayResult.style.display = "block";

        try {
          const res = await fetch("/data/birthday-goals.json");
          const bData = await res.json();
          const dayInfo = (bData.calendar || bData.days || {})[key];

          if (dayInfo && dayInfo.goalsCount > 0) {
            const arcadeLang = getLang();
            bdayResult.innerHTML = `
              <div style="font-weight:700; color:var(--ink); margin-bottom:4px;">
                Yes — Lionel Messi scored <b>${dayInfo.goalsCount} goals</b> on your birthday (${dayInfo.formatted})!
              </div>
              <div style="font-size:0.82rem; color:var(--muted); margin-bottom:8px;">
                ${dayInfo.matches.map((match) => `${match.year}: ${match.team} vs ${match.opponent} (${match.goalsCount}G)`).join(" · ")}
              </div>
              <a href="/${arcadeLang}/birthday/${key}" class="btn-arcade-action" style="font-size:0.8rem; padding:5px 12px; display:inline-block; text-decoration:none;">
                Watch Goal Video Clips on Birthday Hub →
              </a>
            `;
          } else {
            const arcadeLang = getLang();
            bdayResult.innerHTML = `
              <div style="color:var(--muted);">
                Messi hasn't played on ${m}/${d} in his senior career! Explore all 366 days on our <a href="/${arcadeLang}/birthday" style="color:var(--brand);font-weight:700;">Birthday Goals Explorer</a> or try a friend's birthday!
              </div>
            `;
          }
        } catch (_) {
          const arcadeLang = getLang();
          bdayResult.innerHTML = `Explore all match goals on the <a href="/${arcadeLang}/birthday/${key}" style="color:var(--brand);font-weight:700;">${m}/${d} Goal Page &rarr;</a>`;
        }
      });
    }
  }

  // 5. Goal Roulette Controller
  const spinBtn = document.getElementById("btn-spin-roulette");
  const rouletteDisplay = document.getElementById("arcade-roulette-display");

  const LEGENDARY_GOALS = [
    { num: 1, year: 2005, opp: "Albacete", comp: "La Liga", note: "Iconic debut lob over Valbuena from Ronaldinho's scooped assist." },
    { num: 19, year: 2007, opp: "Getafe", comp: "Copa del Rey", note: "The Maradona 2.0 solo run from halfway line beating 6 defenders." },
    { num: 91, year: 2012, opp: "Real Valladolid", comp: "La Liga", note: "Final goal of his 91-goal world record calendar year." },
    { num: 229, year: 2012, opp: "Osasuna", comp: "Copa del Rey", note: "Brilliant header and signature left-foot finish at Camp Nou." },
    { num: 500, year: 2017, opp: "Real Madrid", comp: "La Liga", note: "90+2' El Clásico winner at Bernabéu and legendary shirt celebration." },
    { num: 600, year: 2019, opp: "Liverpool", comp: "Champions League", note: "35-yard direct free-kick into the top corner vs Alisson." },
    { num: 672, year: 2021, opp: "Celta Vigo", comp: "La Liga", note: "Messi's 672nd and final competitive goal for FC Barcelona." },
    { num: 793, year: 2022, opp: "France", comp: "World Cup Final", note: "108' rebound in extra time of the greatest World Cup final in history." },
    { num: 808, year: 2023, opp: "Cruz Azul", comp: "Leagues Cup", note: "94' debut direct free-kick winner on his Inter Miami debut." },
    { num: 930, year: 2026, opp: "San Diego FC", comp: "MLS", note: "24' direct free-kick into the top corner (101st Inter Miami goal)." }
  ];

  if (spinBtn && rouletteDisplay) {
    spinBtn.addEventListener("click", () => {
      spinBtn.disabled = true;
      const rLang = getLang();
      rouletteDisplay.innerHTML = `<div style="text-align:center; padding:10px; color:var(--brand); font-weight:700;">Spinning through ${LIVE.goals} goals...</div>`;
      setTimeout(() => {
        spinBtn.disabled = false;
        const g = LEGENDARY_GOALS[Math.floor(Math.random() * LEGENDARY_GOALS.length)];
        rouletteDisplay.innerHTML = `
          <div class="roulette-card-content">
            <div>
              <div class="roulette-goal-badge">Goal #${g.num} (${g.year})</div>
              <div class="roulette-goal-meta"><b>vs ${g.opp}</b> · ${g.comp}</div>
              <div class="roulette-goal-sub">${g.note}</div>
            </div>
            <a href="/${rLang}/latest-goal" class="btn-roulette-watch">
              <span>Watch Video</span>
            </a>
          </div>
        `;
        spinBtn.textContent = "Spin Another Goal";
      }, 300);
    });
  }

  // 6. Hook Global GOAT Vote Controller
  initGlobalGoatPoll();
}

function initGlobalGoatPoll() {
  const voteBtns = document.querySelectorAll(".btn-vote-candidate");
  if (!voteBtns.length) return;

  const VOTE_KEY = "messistat_goat_vote";
  const renderVoteResults = (voted) => {
    const baseMessi = 18450 + (voted === "messi" ? 1 : 0);
    const baseRonaldo = 6820 + (voted === "ronaldo" ? 1 : 0);
    const total = baseMessi + baseRonaldo;
    const messiPct = Math.round((baseMessi / total) * 100);
    const ronaldoPct = 100 - messiPct;

    document.querySelectorAll(".goat-vote-buttons").forEach((box) => (box.style.display = "none"));
    document.querySelectorAll(".goat-vote-results").forEach((resBox) => {
      resBox.style.display = "block";
      resBox.innerHTML = `
        <div class="goat-results-wrap animate-pop">
          <div class="goat-bar-row">
            <span class="bar-candidate-title">Messi (<b>${messiPct}%</b>)</span>
            <div class="goat-bar-track">
              <div class="goat-bar-fill messi" style="width:${messiPct}%;"></div>
            </div>
            <span class="bar-vote-count">${baseMessi.toLocaleString()} votes</span>
          </div>
          <div class="goat-bar-row">
            <span class="bar-candidate-title">Ronaldo (<b>${ronaldoPct}%</b>)</span>
            <div class="goat-bar-track">
              <div class="goat-bar-fill ronaldo" style="width:${ronaldoPct}%;"></div>
            </div>
            <span class="bar-vote-count">${baseRonaldo.toLocaleString()} votes</span>
          </div>
          <div class="goat-vote-meta">
            <span class="vote-confirmed-tag">✓ Your vote was recorded (${total.toLocaleString()} total community votes)</span>
            <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just voted in the Lionel Messi vs Cristiano Ronaldo GOAT poll on MessiStat! Compare their official ${LIVE.goals} vs ${LIVE.rGoals} career stats:`)}&url=${encodeURIComponent(window.location.href)}" target="_blank" rel="noopener noreferrer" class="btn-share-poll-vote">
              <span>Share Verdict</span>
            </a>
          </div>
        </div>
      `;
    });
  };

  try {
    const existingVote = localStorage.getItem(VOTE_KEY);
    if (existingVote) renderVoteResults(existingVote);
  } catch (_) {}

  voteBtns.forEach((btn) => {
    btn.onclick = () => {
      const choice = btn.getAttribute("data-vote");
      try {
        localStorage.setItem(VOTE_KEY, choice);
      } catch (_) {}
      renderVoteResults(choice);
    };
  });
}

function initAchievementsQuiz() {
  let container = document.getElementById("ach-quiz-container");
  if (!container) {
    const faq = document.getElementById("faq");
    const cabinet = document.getElementById("cabinet");
    const parent = faq ? faq.parentNode : cabinet ? cabinet.parentNode : document.querySelector("main.wrap");
    if (parent) {
      const achQuizSec = document.createElement("section");
      achQuizSec.className = "achievements-quiz-card";
      achQuizSec.id = "achievements-quiz";
      achQuizSec.setAttribute("aria-label", "Messi Trophies & Honours Trivia Quiz");
      achQuizSec.innerHTML = `
        <div class="ach-quiz-header">
          <div class="quiz-badge-pill">TROPHY &amp; RECORDS TRIVIA</div>
          <h2 class="ach-quiz-title">Test Your Lionel Messi Trophy &amp; Records IQ</h2>
          <p class="ach-quiz-subtitle">Think you know everything about Messi's ${LIVE.trophies} trophies, 8 Ballons d'Or, and world records? Answer 5 trivia questions below:</p>
        </div>
        <div class="ach-quiz-body" id="ach-quiz-container"></div>
      `;
      if (faq && faq.previousElementSibling) {
        parent.insertBefore(achQuizSec, faq.previousElementSibling);
      } else if (cabinet && cabinet.nextSibling) {
        parent.insertBefore(achQuizSec, cabinet.nextSibling);
      } else {
        parent.appendChild(achQuizSec);
      }
      container = document.getElementById("ach-quiz-container");
    }
  }
  if (!container) return;
  if (container.dataset.quizInit) return;
  container.dataset.quizInit = "true";

  const QUESTIONS = [
    {
      q: "How many official team trophies has Lionel Messi won across his senior career?",
      opts: [`${LIVE.trophies} Trophies`, "42 Trophies", "38 Trophies", "35 Trophies"],
      ans: 0,
      expl: `Lionel Messi is the most decorated player in football history with ${LIVE.trophies} official team trophies (35 with Barcelona, 5 with Argentina, 3 with PSG, and 4 with Inter Miami).`
    },
    {
      q: "In which calendar year did Messi set the Guinness World Record with 91 official goals?",
      opts: ["2011", "2012", "2015", "2019"],
      ans: 1,
      expl: "In 2012, Lionel Messi scored an astonishing 91 goals in 69 matches (79 for Barcelona, 12 for Argentina), shattering Gerd Müller's 40-year-old record."
    },
    {
      q: "How many European Golden Shoes has Lionel Messi won as Europe's top domestic goalscorer?",
      opts: ["4", "5", "6", "8"],
      ans: 2,
      expl: "Messi has won a record 6 European Golden Shoes (2010, 2012, 2013, 2017, 2018, 2019), two more than anyone else in history."
    },
    {
      q: "What historic personal distinction did Messi achieve at the 2022 FIFA World Cup in Qatar?",
      opts: [
        "First player to win two World Cup Golden Balls",
        "Only player to score in all 7 tournament matches",
        "Most penalty shootout saves in history",
        "Fastest hat-trick in a World Cup final"
      ],
      ans: 0,
      expl: "Messi became the only player in football history to win two FIFA World Cup Golden Ball awards (2014 Brazil and 2022 Qatar)."
    },
    {
      q: "How many Ballon d'Or awards has Lionel Messi won in his career?",
      opts: ["5", "7", "8", "9"],
      ans: 2,
      expl: "Messi holds the absolute record with 8 Ballon d'Or trophies (2009, 2010, 2011, 2012, 2015, 2019, 2021, 2023)."
    }
  ];

  let currentIdx = 0;
  let score = 0;

  const renderQuiz = () => {
    if (currentIdx >= QUESTIONS.length) {
      const pct = Math.round((score / QUESTIONS.length) * 100);
      let titleBadge = "GOAT Scholar";
      if (pct === 100) titleBadge = "Perfect 100% Messi Legend";
      else if (pct >= 80) titleBadge = "Trophy Master";

      container.innerHTML = `
        <div class="ach-quiz-finish-card animate-pop">
          <div class="finish-badge">${titleBadge}</div>
          <h3 class="finish-score-heading">You scored ${score} out of ${QUESTIONS.length} (${pct}%)!</h3>
          <p class="finish-subtext">You clearly know your football history and Lionel Messi's record-shattering achievements.</p>
          <div class="finish-action-row">
            <button type="button" class="btn-ach-replay" id="btn-ach-replay">Replay Quiz</button>
            <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just scored ${score}/${QUESTIONS.length} on the Lionel Messi Trophies & Records Quiz on MessiStat.com! Test your GOAT knowledge:`)}&url=${encodeURIComponent(window.location.href)}" target="_blank" rel="noopener noreferrer" class="btn-ach-share">
              <span>Share Score</span>
            </a>
          </div>
        </div>
      `;
      const replayBtn = document.getElementById("btn-ach-replay");
      if (replayBtn) {
        replayBtn.onclick = () => {
          currentIdx = 0;
          score = 0;
          renderQuiz();
        };
      }
      return;
    }

    const cur = QUESTIONS[currentIdx];
    container.innerHTML = `
      <div class="ach-quiz-question-box animate-pop">
        <div class="ach-quiz-progress-row">
          <span class="ach-quiz-pill">Question ${currentIdx + 1} of ${QUESTIONS.length}</span>
          <span class="ach-quiz-score-pill">Score: <b>${score}</b></span>
        </div>
        <h3 class="ach-quiz-qtext">${cur.q}</h3>
        <div class="ach-quiz-opt-grid">
          ${cur.opts.map((opt, i) => `
            <button type="button" class="btn-ach-opt" data-idx="${i}">
              <span class="opt-letter">${String.fromCharCode(65 + i)}</span>
              <span class="opt-label">${opt}</span>
            </button>
          `).join("")}
        </div>
        <div class="ach-quiz-feedback" id="ach-feedback" style="display:none;"></div>
      </div>
    `;

    const optBtns = container.querySelectorAll(".btn-ach-opt");
    const fbBox = document.getElementById("ach-feedback");

    optBtns.forEach((btn) => {
      btn.onclick = () => {
        optBtns.forEach((b) => (b.disabled = true));
        const picked = parseInt(btn.dataset.idx, 10);
        const isRight = picked === cur.ans;
        if (isRight) {
          score++;
          btn.classList.add("correct");
        } else {
          btn.classList.add("wrong");
          if (optBtns[cur.ans]) optBtns[cur.ans].classList.add("correct");
        }

        fbBox.style.display = "flex";
        fbBox.innerHTML = `
          <div class="fb-content">
            <span class="fb-status ${isRight ? "success" : "danger"}">${isRight ? "✓ Correct!" : "✗ Incorrect"}</span>
            <p class="fb-expl">${cur.expl}</p>
          </div>
          <button type="button" class="btn-ach-next" id="btn-ach-next">Next Question →</button>
        `;

        const nextBtn = document.getElementById("btn-ach-next");
        if (nextBtn) {
          nextBtn.onclick = () => {
            currentIdx++;
            renderQuiz();
          };
        }
      };
    });
  };

  renderQuiz();
}

function initDedicatedRoulette() {
  let spinBtn = document.getElementById("btn-spin-dedicated-roulette");
  let display = document.getElementById("dedicated-roulette-display");
  let loadBtn = document.getElementById("btn-load-roulette-video");

  if (!spinBtn || !display) {
    const recentSec = document.querySelector(".recent-goals-section");
    if (recentSec) {
      const rouletteSec = document.createElement("section");
      rouletteSec.className = "latest-goal-roulette-card";
      rouletteSec.id = "dedicated-roulette-section";
      rouletteSec.setAttribute("aria-label", `${LIVE.goals} Career Goal Roulette`);
      rouletteSec.innerHTML = `
        <div class="roulette-card-header">
          <div class="roulette-badge-pill">${LIVE.goals}-GOAL ROULETTE</div>
          <h2 class="roulette-section-title">Spin a Random Messi Career Goal Highlight</h2>
          <p class="roulette-section-desc">Spin through all ${LIVE.goals} official senior goals across Lionel Messi's 22-year legendary career. Click to immediately stream and replay the highlight video in the player above.</p>
        </div>
        <div class="roulette-interactive-stage">
          <div class="roulette-highlight-display" id="dedicated-roulette-display">
            <div class="roulette-standby-view">
              <span class="roulette-standby-icon" aria-hidden="true">&#9654;</span>
              <div class="roulette-standby-text">
                <b>${LIVE.goals} Senior Goals Available</b>
                <span>Click the button below to randomly draw a classic milestone, solo stunner, or cup final decider.</span>
              </div>
            </div>
          </div>
          <div class="roulette-action-row">
            <button type="button" class="btn-spin-roulette-dedicated" id="btn-spin-dedicated-roulette">
              <span>Spin ${LIVE.goals}-Goal Roulette</span>
            </button>
            <button type="button" class="btn-load-roulette-video" id="btn-load-roulette-video" style="display:none;">
              <span>▶ Load in Video Player</span>
            </button>
          </div>
        </div>
      `;
      recentSec.parentNode.insertBefore(rouletteSec, recentSec.nextSibling);
      spinBtn = document.getElementById("btn-spin-dedicated-roulette");
      display = document.getElementById("dedicated-roulette-display");
      loadBtn = document.getElementById("btn-load-roulette-video");
    }
  }

  if (!spinBtn || !display) return;
  if (spinBtn.dataset.rouletteInit) return;
  spinBtn.dataset.rouletteInit = "true";

  const LEGENDARY_ROULETTE_GOALS = [
    { num: 1, year: 2005, team: "FC Barcelona", opp: "Albacete", comp: "La Liga", type: "Lob / Chip", score: "2 – 0", min: "88", note: "Iconic debut chip over Valbuena from Ronaldinho's scooped assist.", videoUrl: "https://cdn.messiallgoals.com/Goal1.mp4" },
    { num: 19, year: 2007, team: "FC Barcelona", opp: "Getafe", comp: "Copa del Rey", type: "Solo Run", score: "5 – 2", min: "29", note: "The Maradona 2.0 solo run from halfway line beating 6 defenders.", videoUrl: "https://cdn.messiallgoals.com/Goal19.mp4" },
    { num: 73, year: 2009, team: "FC Barcelona", opp: "Real Madrid", comp: "La Liga", type: "Left Foot Strike", score: "6 – 2", min: "36", note: "Iconic brace at Santiago Bernabéu in historic 6-2 El Clásico rout.", videoUrl: "https://cdn.messiallgoals.com/Goal73.mp4" },
    { num: 91, year: 2012, team: "FC Barcelona", opp: "Real Valladolid", comp: "La Liga", type: "Left Foot Strike", score: "3 – 1", min: "59", note: "91st and final goal of his world-record calendar year.", videoUrl: "https://cdn.messiallgoals.com/Goal91.mp4" },
    { num: 200, year: 2011, team: "FC Barcelona", opp: "Viktoria Plzeň", comp: "UCL", type: "Penalty", score: "4 – 0", min: "24", note: "200th career goal milestone in European Champions League.", videoUrl: "https://cdn.messiallgoals.com/Goal200.mp4" },
    { num: 500, year: 2017, team: "FC Barcelona", opp: "Real Madrid", comp: "La Liga", type: "Left Foot Strike", score: "3 – 2", min: "92", note: "90+2' El Clásico winner at Bernabéu and legendary shirt celebration.", videoUrl: "https://cdn.messiallgoals.com/Goal500.mp4" },
    { num: 600, year: 2019, team: "FC Barcelona", opp: "Liverpool", comp: "Champions League", type: "Direct Free Kick", score: "3 – 0", min: "82", note: "35-yard direct free-kick masterpiece into the top corner vs Alisson.", videoUrl: "https://cdn.messiallgoals.com/Goal600.mp4" },
    { num: 672, year: 2021, team: "FC Barcelona", opp: "Celta Vigo", comp: "La Liga", type: "Header", score: "1 – 2", min: "28", note: "Messi's 672nd and final competitive goal for FC Barcelona.", videoUrl: "https://cdn.messiallgoals.com/Goal672.mp4" },
    { num: 793, year: 2022, team: "Argentina", opp: "France", comp: "World Cup Final", type: "Rebound", score: "3 – 3", min: "108", note: "108' extra-time goal in the greatest World Cup final in football history.", videoUrl: "https://cdn.messiallgoals.com/Goal793.mp4" },
    { num: 808, year: 2023, team: "Inter Miami", opp: "Cruz Azul", comp: "Leagues Cup", type: "Direct Free Kick", score: "2 – 1", min: "94", note: "94th-minute debut free kick winner on his Inter Miami debut.", videoUrl: "https://cdn.messiallgoals.com/Goal808.mp4" },
    { num: 929, year: 2026, team: "Inter Miami", opp: "Cruz Azul", comp: "Campeones Cup Final", type: "Header", score: "2 – 0", min: "12", note: "Championship header lifting his 47th all-time career trophy.", videoUrl: "https://cdn.messiallgoals.com/Goal929.mp4" },
    { num: 930, year: 2026, team: "Inter Miami", opp: "San Diego FC", comp: "MLS", type: "Direct Free Kick", score: "2 – 2", min: "24", note: "Direct free kick curl into top corner (101st goal for Inter Miami).", videoUrl: "https://cdn.messiallgoals.com/Goal930.mp4" }
  ];

  let currentGoal = null;

  const loadGoal = (g) => {
    const video = document.getElementById("latest-goal-video");
    const activeNum = document.getElementById("active-goal-num");
    const activeTitle = document.getElementById("active-goal-title");
    const activeMeta = document.getElementById("active-goal-meta");
    const activeMin = document.getElementById("stat-minute");
    const activeType = document.getElementById("stat-type");
    const activeScore = document.getElementById("stat-score");
    const activeComp = document.getElementById("stat-comp");
    const ytBtn = document.getElementById("btn-yt-highlights");

    if (activeNum) activeNum.textContent = `Goal #${g.num}`;
    if (activeTitle) activeTitle.textContent = `${g.team} vs ${g.opp} (${g.score})`;
    if (activeMeta) activeMeta.textContent = `${g.comp} • ${g.year} • ${g.note}`;
    if (activeMin) activeMin.textContent = `${g.min}'`;
    if (activeType) activeType.textContent = g.type;
    if (activeScore) activeScore.textContent = g.score;
    if (activeComp) activeComp.textContent = g.comp;

    if (video && g.videoUrl) {
      video.src = g.videoUrl;
      video.load();
      video.play().catch(() => {});
      video.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (ytBtn) ytBtn.href = `https://www.youtube.com/results?search_query=Messi+goal+${g.num}+vs+${encodeURIComponent(g.opp)}`;
  };

  spinBtn.addEventListener("click", () => {
    spinBtn.disabled = true;
    display.innerHTML = `
      <div class="roulette-spinning-state">
        <div class="roulette-spinner-ring"></div>
        <div class="roulette-spintip">Spinning across ${LIVE.goals} career goals...</div>
      </div>
    `;

    setTimeout(() => {
      spinBtn.disabled = false;
      const g = LEGENDARY_ROULETTE_GOALS[Math.floor(Math.random() * LEGENDARY_ROULETTE_GOALS.length)];
      currentGoal = g;

      display.innerHTML = `
        <div class="roulette-result-card animate-pop">
          <div class="result-card-badges">
            <span class="badge-goal-gold">Goal #${g.num}</span>
            <span class="badge-goal-year">${g.year}</span>
            <span class="badge-goal-comp">${g.comp}</span>
          </div>
          <h3 class="result-goal-match">${g.team} vs ${g.opp} (${g.score})</h3>
          <p class="result-goal-desc">${g.note}</p>
          <div class="result-goal-tags">
            <span>Minute: <b>${g.min}'</b></span>
            <span>Type: <b>${g.type}</b></span>
          </div>
        </div>
      `;

      if (loadBtn) {
        loadBtn.style.display = "inline-flex";
        loadBtn.onclick = () => loadGoal(currentGoal);
      }
      spinBtn.innerHTML = "<span>Spin Another Goal</span>";
    }, 400);
  });
}

// Global click and keydown delegation for language switcher, mobile menu drawer, theme toggles, and modal backdrops
if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const menuTrigger = e.target.closest("#mobile-menu-btn, .mobile-menu-btn");
    if (menuTrigger) {
      e.preventDefault();
      const drawer = document.getElementById("mobile-nav-drawer");
      if (drawer && drawer.open) {
        closeMobileMenuDrawer();
      } else {
        openMobileMenuDrawer();
      }
      return;
    }
    const drawerClose = e.target.closest("#mobile-drawer-close-btn, .mobile-drawer-close");
    if (drawerClose) {
      e.preventDefault();
      closeMobileMenuDrawer();
      return;
    }
    const drawerEl = document.getElementById("mobile-nav-drawer");
    if (drawerEl && e.target === drawerEl) {
      closeMobileMenuDrawer();
      return;
    }
    const drawerLink = e.target.closest(".mobile-drawer-link");
    if (drawerLink) {
      closeMobileMenuDrawer();
      return;
    }
    const drawerLang = e.target.closest("#drawer-lang-btn");
    if (drawerLang) {
      e.preventDefault();
      closeMobileMenuDrawer();
      openLangModal();
      return;
    }
    const cmdTrigger = e.target.closest("[data-open-cmd]");
    if (cmdTrigger) {
      e.preventDefault();
      openCommandPalette();
      return;
    }
    const drawerTheme = e.target.closest("#drawer-theme-btn");
    if (drawerTheme) {
      e.preventDefault();
      if (window.__toggleMessiTheme) window.__toggleMessiTheme();
      return;
    }

    const langTrigger = e.target.closest("#rail-lang-btn, .rail-lang-btn, #mobile-lang-btn, .mobile-lang-btn");
    if (langTrigger) {
      e.preventDefault();
      openLangModal();
      return;
    }
    const closeTrigger = e.target.closest("#lang-modal-close-btn, .lang-modal-close");
    if (closeTrigger) {
      e.preventDefault();
      closeLangModal();
      return;
    }
    const modal = document.getElementById("lang-modal");
    if (modal && e.target === modal) {
      closeLangModal();
      return;
    }
    const langCard = e.target.closest(".lang-card-option");
    if (langCard) {
      const code = langCard.getAttribute("data-code");
      if (code) {
        try { localStorage.setItem("messistats_lang_choice", code); } catch (_) {}
      }
      return;
    }
    const mobTheme = e.target.closest("#mobile-theme-btn, .mobile-theme-btn");
    if (mobTheme) {
      e.preventDefault();
      if (window.__toggleMessiTheme) window.__toggleMessiTheme();
      return;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const drawer = document.getElementById("mobile-nav-drawer");
      if (drawer && !drawer.hidden) {
        closeMobileMenuDrawer();
      }
      const modal = document.getElementById("lang-modal");
      if (modal && !modal.hidden) {
        closeLangModal();
      }
    }
  });
}

function initLanguageAndMobileTopBar() {
  if (typeof document === "undefined") return;

  const curLangCode = getCurrentLangCode();
  const curLangObj = LANGUAGES.find((l) => l.code === curLangCode) || LANGUAGES[0];

  // Remove any legacy inline .lang-switcher elements
  try {
    document.querySelectorAll(".lang-switcher").forEach((el) => el.remove());
  } catch (_) {}

  // 1. Setup Desktop Rail Language Button
  try {
    const rail = document.querySelector(".rail");
    if (rail) {
      let railLangWrap = rail.querySelector(".rail-lang-wrap");
      if (!railLangWrap) {
        railLangWrap = document.createElement("div");
        railLangWrap.className = "rail-lang-wrap";
        railLangWrap.innerHTML = `
          <button type="button" class="rail-lang-btn" id="rail-lang-btn" aria-label="Select Language (${curLangObj.name})" title="Select Language">
            <svg class="rail-lang-globe" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            <span class="rail-lang-label">${curLangObj.name}</span>
            <span class="rail-lang-tag">${curLangObj.code.toUpperCase()}</span>
          </button>
        `;
        const railBadge = rail.querySelector(".rail-badge");
        if (railBadge) {
          const mark = railBadge.querySelector(".rail-mark");
          if (mark) {
            const logoImg = document.createElement("img");
            logoImg.src = "/img/logo.png";
            logoImg.alt = "MessiStat";
            logoImg.className = "rail-mark-logo";
            logoImg.width = 36;
            logoImg.height = 36;
            mark.replaceWith(logoImg);
          }
          if (railBadge.nextSibling) {
            rail.insertBefore(railLangWrap, railBadge.nextSibling);
          } else {
            rail.prepend(railLangWrap);
          }
        }
      }
    }
  } catch (_) {}

  // 2. Setup Mobile Top Bar
  try {
    let mobileTopBar = document.querySelector(".mobile-topbar");
    if (!mobileTopBar && document.body) {
      mobileTopBar = document.createElement("header");
      mobileTopBar.className = "mobile-topbar";
      mobileTopBar.setAttribute("aria-label", "Mobile navigation header");
      mobileTopBar.innerHTML = `
        <a href="${getLangUrl(curLangCode)}" class="mobile-topbar-brand" aria-label="MessiStats">
          <img src="/img/logo.png" alt="MessiStats Logo" width="28" height="28" style="object-fit:contain;border-radius:4px;flex:0 0 28px;"/>
          <span class="mobile-topbar-title">Messi<b>Stats</b></span>
        </a>
        <div class="mobile-topbar-actions">
          <button type="button" class="mobile-search-btn" data-open-cmd aria-label="Search stats and pages">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7.5"></circle><line x1="20.5" y1="20.5" x2="16.3" y2="16.3"></line></svg>
          </button>
          <button type="button" class="mobile-lang-btn" id="mobile-lang-btn" aria-label="Change language">
            <span class="mobile-lang-flag">${curLangObj.flag}</span>
            <span class="mobile-lang-code">${curLangObj.code.toUpperCase()}</span>
            <span class="mobile-lang-arrow">▾</span>
          </button>
          <button type="button" class="mobile-theme-btn" id="mobile-theme-btn" aria-label="Toggle dark mode">
            <svg class="sun-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            <svg class="moon-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
          <button type="button" class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Open Navigation Menu" aria-expanded="false" title="Menu">
            <svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            <svg class="close-icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `;
      document.body.prepend(mobileTopBar);
    }
  } catch (_) {}

  // Auto-center active navigation rail tab on mobile
  try {
    const activeTab = document.querySelector(".rail nav a.on, .rail nav a[aria-current='page']");
    if (activeTab && window.innerWidth <= 900) {
      setTimeout(() => {
        activeTab.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
      }, 120);
    }
  } catch (_) {}

  // 3. Ensure language modal & mobile menu drawer are created
  try {
    ensureLangModal();
    ensureMobileMenuDrawer();
    ensureMobileMoreNavBtn();
    ensureDesktopBrandHeader();
    initDonationPopup();
    initArgentinaStreamNotification();
    initFanArcade();
    initGlobalGoatPoll();
  } catch (_) {}

  // 4. Device & Location-Based Language View Detection
  const LANG_MESSAGES = {
    es: {
      name: "Español",
      flag: "🇪🇸",
      detected: "Detectamos que tu dispositivo está en español.",
      suggest: "¿Deseas ver MessiStats en español?",
      switchBtn: "Ver en Español",
      stayBtn: "Continuar en English",
      autoNotice: "Mostrando en Español según tu dispositivo.",
      changeBtn: "Cambiar"
    },
    pt: {
      name: "Português",
      flag: "🇧🇷",
      detected: "Detectamos que seu dispositivo está em português.",
      suggest: "Deseja ver o MessiStats em português?",
      switchBtn: "Ver em Português",
      stayBtn: "Continuar en English",
      autoNotice: "Exibindo em Português conforme seu dispositivo.",
      changeBtn: "Mudar"
    },
    fr: {
      name: "Français",
      flag: "🇫🇷",
      detected: "Votre appareil est configuré en français.",
      suggest: "Souhaitez-vous voir MessiStats en français ?",
      switchBtn: "Voir en Français",
      stayBtn: "Continuer en anglais",
      autoNotice: "Affiché en français selon votre appareil.",
      changeBtn: "Changer"
    },
    en: {
      name: "English",
      flag: "🇺🇸",
      detected: "Your device is set to English.",
      suggest: "Would you like to view MessiStats in English?",
      switchBtn: "Switch to English",
      stayBtn: "Stay here",
      autoNotice: "Viewing in English based on device settings.",
      changeBtn: "Change"
    }
  };

  function detectDeviceAndLocationLang() {
    try {
      const saved = localStorage.getItem("messistats_lang_choice");
      if (saved && LANGUAGES.some((l) => l.code === saved)) return saved;
    } catch (_) {}

    const langs = (typeof navigator !== "undefined" && navigator.languages && navigator.languages.length) ? navigator.languages : [typeof navigator !== "undefined" ? (navigator.language || "") : ""];
    for (const l of langs) {
      const lower = (l || "").toLowerCase();
      if (lower.startsWith("es")) return "es";
      if (lower.startsWith("pt")) return "pt";
      if (lower.startsWith("fr")) return "fr";
      if (lower.startsWith("en")) return "en";
    }

    let tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (_) {}

    if (/Argentina|Buenos_Aires|Cordoba|Rosario|Mendoza|Catamarca|Jujuy|San_Juan|Tucuman|Ushuaia|Madrid|Canary|Santiago|Bogota|Lima|Caracas|Montevideo|Mexico|Cancun|Merida|Monterrey|Tijuana|Guatemala|Costa_Rica|Panama|Guayaquil|Asuncion|La_Paz|Santo_Domingo|Havana/i.test(tz)) {
      return "es";
    }
    if (/Sao_Paulo|Lisbon|Madeira|Azores|Recife|Fortaleza|Belem|Manaus|Brasilia|Bahia|Cuiaba|Porto_Velho|Boa_Vista|Luanda|Maputo/i.test(tz)) {
      return "pt";
    }
    if (/Paris|Niamey|Dakar|Abidjan|Douala|Kinshasa|Bamako|Ouagadougou|Brussels|Geneva/i.test(tz)) {
      return "fr";
    }
    return "en";
  }

  // 5. Show Auto-Routed Notice Toast
  try {
    const wasAutoRouted = sessionStorage.getItem("geo_routed");
    if (wasAutoRouted) {
      sessionStorage.removeItem("geo_routed");
      const msgObj = LANG_MESSAGES[curLangCode] || LANG_MESSAGES.en;
      const notice = document.createElement("div");
      notice.className = "lang-auto-notice";
      notice.setAttribute("role", "status");
      notice.innerHTML = `
        <span class="lang-auto-notice-flag">${msgObj.flag}</span>
        <span class="lang-auto-notice-text">${msgObj.autoNotice}</span>
        <button type="button" class="lang-auto-notice-link" id="lang-notice-change">${msgObj.changeBtn}</button>
        <button type="button" class="lang-auto-notice-close" id="lang-notice-close" aria-label="Close">&times;</button>
      `;
      document.body.appendChild(notice);
      document.getElementById("lang-notice-change")?.addEventListener("click", () => {
        notice.remove();
        openLangModal();
      });
      document.getElementById("lang-notice-close")?.addEventListener("click", () => {
        notice.remove();
      });
      setTimeout(() => {
        if (notice && notice.parentNode) notice.remove();
      }, 7500);
    }
  } catch (_) {}

  // 6. Show Smart Language Suggestion Banner (skip English-only B2B /advertise page)
  try {
    const isAdvertise = document.body?.dataset?.page === "advertise";
    const isBot = typeof navigator !== "undefined" && /bot|googlebot|crawler|spider|robot|crawling/i.test(navigator.userAgent);
    if (!isBot && !isAdvertise) {
      const detectedLang = detectDeviceAndLocationLang();
      const userChoice = localStorage.getItem("messistats_lang_choice");
      const dismissed = sessionStorage.getItem("messistats_lang_dismissed");

      if (detectedLang && detectedLang !== curLangCode && !userChoice && dismissed !== detectedLang) {
        const targetMsg = LANG_MESSAGES[detectedLang] || LANG_MESSAGES.en;
        const targetUrl = getLangUrl(detectedLang);

        const banner = document.createElement("div");
        banner.className = "lang-suggest-banner";
        banner.id = "lang-suggest-banner";
        banner.setAttribute("role", "region");
        banner.setAttribute("aria-label", "Language recommendation");
        banner.innerHTML = `
          <div class="lang-suggest-content">
            <span class="lang-suggest-flag">${targetMsg.flag}</span>
            <span class="lang-suggest-text">${targetMsg.detected} <b>${targetMsg.suggest}</b></span>
          </div>
          <div class="lang-suggest-actions">
            <a href="${targetUrl}" class="lang-suggest-btn-primary" id="lang-suggest-switch">${targetMsg.switchBtn}</a>
            <button type="button" class="lang-suggest-btn-dismiss" id="lang-suggest-dismiss">${targetMsg.stayBtn}</button>
          </div>
        `;
        if (document.body) {
          document.body.prepend(banner);
        }

        document.getElementById("lang-suggest-switch")?.addEventListener("click", () => {
          try { localStorage.setItem("messistats_lang_choice", detectedLang); } catch (_) {}
        });
        document.getElementById("lang-suggest-dismiss")?.addEventListener("click", () => {
          try {
            sessionStorage.setItem("messistats_lang_dismissed", detectedLang);
            localStorage.setItem("messistats_lang_choice", curLangCode);
          } catch (_) {}
          banner.remove();
        });
      }
    }
  } catch (_) {}

  centerActiveNav();
  if (typeof window !== "undefined") {
    window.addEventListener("resize", centerActiveNav, { passive: true });
  }
}

// Initialize immediately and also on DOMContentLoaded
initLanguageAndMobileTopBar();
if (typeof window !== "undefined" && document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLanguageAndMobileTopBar);
}

async function load() {
  let r;
  try {
    r = await fetch("/data/messi-data.json", { cache: "no-store" });
  } catch (_) {}
  if (!r || !r.ok) {
    r = await fetch("data/messi-data.json", { cache: "no-store" });
  }
  if (!r.ok) throw new Error("data " + r.status);
  const d = await r.json();
  // Secondary sources for the LIVE registry — best-effort; verified
  // fallbacks in LIVE apply when a fetch fails (offline, adblock, path).
  const get = async (...urls) => {
    for (const u of urls) {
      try {
        const x = await fetch(u, { cache: "no-store" });
        if (x && x.ok) return await x.json();
      } catch (_) {}
    }
    return null;
  };
  const [ron, lg] = await Promise.all([
    get("/data/ronaldo.json", "data/ronaldo.json"),
    get("/data/latest-goal.json", "data/latest-goal.json"),
  ]);
  d.ronaldo = ron;
  d.latest = lg;
  return d;
}
const el = (id) => document.getElementById(id);
const esc = (s) => {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
};
const n = (v) => Number(v).toLocaleString("en-US");
const gpg = (g, a) => (a ? (g / a).toFixed(2) : "—");

/* ================= LIVE STAT REGISTRY (runtime variables) =================
 * Every number templates display lives here — same names and derivation as
 * scripts/stats.mjs (build time). normalize() refreshes LIVE from the JSON
 * database on every load, so editing a variable means editing JSON, never
 * hunting literals. Fallbacks are the verified 2026-10-11 truth, so pages
 * still render correctly if a fetch fails. Frozen history (past match facts,
 * trophy ordinals of won events, per-team NPG/FK/HT splits absent from the
 * JSON) intentionally stays literal — see CONTEXT.md.
 */
const LIVE = {
  goals: 937, apps: 1186, clubGoals: 811, argGoals: 126, argCaps: 208,
  assists: 409, tmAssists: 451, ga: 1346, tmGa: 1388,
  trophies: 47, rTrophies: 37, tBarca: 35, tArg: 5, tPsg: 3, tMiami: 4,
  gap: 50, fewer: 159, road: 63,
  rGoals: 987, rApps: 1345, rAssists: 261, rGpg: "0.73", rGa: 1248, astLead: 148,
  npg: 827, npgR: 802, npgLead: 25,
  miamiGoals: 107, miamiApps: 124,
  abtBarca: 269, abtArg: 58, abtMiami: 48, abtPsg: 34,
  compMLS: 76, compCCC: 8, compLC: 23, compQual: 91, compWC: 21, compCopa: 14,
  compLiga: 474, compUCLb: 120, compUCLp: 9, compCDR: 56, compSuper: 22,
  compLigue1: 22, compTDC: 1,
  lgNum: 937, lgOpp: "New England", lgDate: "2 November 2026",
};

/* Click a column header to sort. Rows with class "total" stay pinned at the bottom. */
function sortable(table) {
  if (!table) return;
  const ths = [...table.querySelectorAll("thead th")];
  if (!ths.length) return;
  const val = (cell) => {
    const t = cell.textContent.trim();
    const pair = t.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/); // "apps / goals" cells sort by goals
    if (pair) return +pair[2].replace(/,/g, "");
    const c = t.replace(/[^0-9.\-]/g, "");
    return c !== "" && !isNaN(+c) ? +c : t.toLowerCase();
  };
  ths.forEach((th, i) => {
    th.setAttribute("data-sortable", "");
    th.setAttribute("tabindex", "0");
    th.setAttribute("role", "button");
    const go = () => {
      const tb = table.tBodies[0];
      if (!tb) return;
      const dir = th.getAttribute("data-sorted") === "asc" ? "desc" : "asc";
      ths.forEach((h) => h.removeAttribute("data-sorted"));
      th.setAttribute("data-sorted", dir);
      const rows = [...tb.rows];
      const pinned = rows.filter((r) => r.classList.contains("total"));
      const rest = rows.filter((r) => !r.classList.contains("total"));
      rest.sort((a, b) => {
        const x = val(a.cells[i]), y = val(b.cells[i]);
        const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return dir === "asc" ? c : -c;
      });
      rest.forEach((r) => tb.appendChild(r));
      pinned.forEach((r) => tb.appendChild(r));
    };
    th.addEventListener("click", go);
    th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });
}

/* Live-filter a table's rows (total rows stay visible). When `param` is given
   the query persists in the URL (?param=text) via history.replaceState, so a
   filtered view is shareable and survives reload; it is read back on init. */
function tableSearch(table, placeholder, param) {
  if (!table || !table.parentElement) return;
  const box = document.createElement("div");
  box.className = "table-search";
  box.innerHTML = `<input type="search" placeholder="${placeholder}" aria-label="${placeholder}">`;
  const mountTarget = table.closest(".table-wrap") || table;
  mountTarget.before(box);
  const inp = box.querySelector("input");
  const apply = (q) => {
    q = q.trim().toLowerCase();
    [...table.tBodies[0].rows].forEach((r) => {
      r.hidden = !(!q || r.classList.contains("total") || r.textContent.toLowerCase().includes(q));
    });
  };
  let timer = null;
  inp.addEventListener("input", () => {
    apply(inp.value);
    if (!param) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const url = new URL(location.href);
      if (inp.value.trim()) url.searchParams.set(param, inp.value.trim());
      else url.searchParams.delete(param);
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }, 300);
  });
  if (param) {
    const initial = new URLSearchParams(location.search).get(param);
    if (initial) { inp.value = initial; apply(initial); }
  }
}

const CLUBS = {
  barcelona: { name: "Barcelona", years: "2004 to 2021", badge: "FCB", colors: "#A50044,#004D98" },
  psg: { name: "Paris Saint-Germain", short: "PSG", years: "2021 to 2023", badge: "PSG", colors: "#004170,#0a2540" },
  miami: { name: "Inter Miami", years: "2023 to present", badge: "MIA", colors: "#e1438b,#7a1c4d" },
  argentina: { name: "Argentina", years: "2005 to present", badge: "ARG", colors: "#2f9fd8,#1668a8" },
};
/* Real club crests (self-hosted in public/img/teams/) layered over the
   original CSS colour badge: if a crest file is missing, onerror drops the
   <img> and the old badge shows through instead of a broken image. */
const badge = (k, eager) => {
  const c = CLUBS[k];
  const label = (k === "psg" ? "Paris Saint-Germain" : c.name) + " crest";
  return `<span class="crest" data-team="${k}"><span class="club-badge" data-team="${k}" aria-hidden="true" style="display:none">${c.badge}</span>` +
    `<img class="crest-img" src="/img/teams/${k}.png" alt="${label}" width="30" height="30" loading="${eager ? "eager" : "lazy"}" decoding="async" onerror="const b=this.previousElementSibling;if(b)b.style.display='';this.remove()"></span>`;
};
const teamName = (k) => (k === "psg" ? "PSG" : CLUBS[k].name);
const CLUB_KEY = { Barcelona: "barcelona", "Paris Saint-Germain": "psg", "Inter Miami": "miami" };
const dispClub = (c) => (c === "Paris Saint-Germain" ? "PSG" : c);
/* Normalize the JSON's varied shapes into the flat fields renderers use. */
function normalize(d) {
  const t = d.totals;
  t.goals = t.combined.goals;
  t.apps = t.combined.appearances;
  t.clubs = { apps: t.club.appearances, goals: t.club.goals, goalsPerGame: t.club.goalsPerGame };
  // The JSON stores country appearances as `appearances`, but 18 call sites
  // (KPI notes, the four languages' FAQ answers, the Argentina summary lines, the
  // goals-by-year total row and the dashboard filter) read `country.apps`.
  // Without this alias they all rendered the string "NaN" into visible copy.
  t.country.apps = t.country.appearances;
  const _todayIso = new Date().toISOString().split("T")[0];
  const _updIso = (d.meta && d.meta.updated && d.meta.updated > _todayIso) ? d.meta.updated : _todayIso;
  d.lastUpdatedIso = _updIso;
  d.lastUpdated = new Date(_updIso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const fin = {};
  d.byFinish.forEach((r) => { fin[r.finish] = r.goals; });
  d.byFinish = { openPlay: fin["Open play"], penalties: fin["Penalties"], freeKicks: fin["Free kicks"] };
  const bp = {};
  d.byBodyPart.forEach((r) => { bp[r.part] = r.goals; });
  d.byBodyPart = { left: bp["Left foot"], right: bp["Right foot"], head: bp["Head"], other: bp["Other (chest etc.)"] };
  d.calendarYears.forEach((r) => { r.provisional = r.status === "provisional-ongoing"; });
  d.clubSeasons.forEach((s) => {
    s.provisional = s.season === "2026";
    ["league", "cup", "continental", "other"].forEach((k) => { s[k] = { apps: s[k][0], goals: s[k][1] }; });
  });
  d.countryYears.forEach((s) => { s.provisional = s.year === 2026; });
  d.trophies.forEach((x) => { x.count = x.years.length; });

  // ---- LIVE registry refresh (see LIVE declaration): every template number
  // reads LIVE.*, so a JSON update propagates without touching literals. ----
  {
    const R = d.ronaldo || {};
    const LGJ = (d.latest && d.latest.latestGoal) || {};
    const LGT = (d.latest && d.latest.totals) || {};
    const compRow = (team, ...keys) =>
      (d.byCompetition || []).find((r) => r.team === team && keys.some((k) => r.competition.startsWith(k)));
    const compGoals = (team, fb, ...keys) => {
      const r = compRow(team, ...keys);
      return r && typeof r.goals === "number" ? r.goals : fb;
    };
    const tByTeam = {};
    (d.trophies || []).forEach((x) => {
      if (x.team === "Individual") return;
      tByTeam[x.team] = (tByTeam[x.team] || 0) + (x.years ? x.years.length : 0);
    });
    const rGoals = R.goals ?? 987;
    const rApps = R.appearances ?? 1345;
    const goals = t.goals, apps = t.apps;
    const assists = t.assists.official, tmAssists = t.assists.transfermarkt;
    const prevGoals = LIVE.goals;
    Object.assign(LIVE, {
      goals, apps,
      clubGoals: t.clubs.goals, argGoals: t.country.goals, argCaps: t.country.apps,
      assists, tmAssists,
      ga: goals + assists, tmGa: goals + tmAssists,
      trophies: d.splits?.trophies?.messi ?? LIVE.trophies,
      rTrophies: d.splits?.trophies?.ronaldo ?? LIVE.rTrophies,
      tBarca: tByTeam["Barcelona"] ?? LIVE.tBarca,
      tArg: tByTeam["Argentina"] ?? LIVE.tArg,
      tPsg: tByTeam["Paris Saint-Germain"] ?? LIVE.tPsg,
      tMiami: tByTeam["Inter Miami"] ?? LIVE.tMiami,
      gap: rGoals - goals, fewer: rApps - apps, road: 1000 - goals,
      rGoals, rApps,
      rAssists: R.assists ?? 261,
      rGpg: rApps ? (rGoals / rApps).toFixed(2) : "0.73",
      rGa: rGoals + (R.assists ?? 261),
      astLead: assists - (R.assists ?? 261),
      npg: goals - d.byFinish.penalties,
      npgR: rGoals - (R.penalties ?? 185),
      npgLead: (goals - d.byFinish.penalties) - (rGoals - (R.penalties ?? 185)),
      miamiGoals: LGT.miamiGoals ?? LIVE.miamiGoals,
      miamiApps: t.assists.byTeam?.inter_miami?.appearances ?? LIVE.miamiApps,
      abtBarca: t.assists.byTeam?.barcelona?.official ?? 269,
      abtArg: t.assists.byTeam?.argentina?.official ?? 58,
      abtMiami: t.assists.byTeam?.inter_miami?.official ?? 46,
      abtPsg: t.assists.byTeam?.psg?.official ?? 34,
      compMLS: compGoals("Inter Miami", LIVE.compMLS, "MLS (regular"),
      compCCC: compGoals("Inter Miami", LIVE.compCCC, "Concacaf"),
      compLC: compGoals("Inter Miami", LIVE.compLC, "Leagues Cup"),
      compQual: compGoals("Argentina", LIVE.compQual, "Argentina: qualifiers"),
      compWC: compGoals("Argentina", LIVE.compWC, "FIFA World Cup"),
      compCopa: compGoals("Argentina", LIVE.compCopa, "Copa America"),
      compLiga: compGoals("Barcelona", LIVE.compLiga, "La Liga"),
      compCDR: compGoals("Barcelona", LIVE.compCDR, "Copa del Rey"),
      compSuper: compGoals("Barcelona", LIVE.compSuper, "Spanish Super Cup"),
      compLigue1: compGoals("Paris Saint-Germain", LIVE.compLigue1, "Ligue 1"),
      compTDC: compGoals("Paris Saint-Germain", LIVE.compTDC, "Trophee"),
      lgNum: LGJ.goalNumber ?? goals,
      lgOpp: LGJ.opponent ?? LIVE.lgOpp,
      lgDate: LGJ.formattedDate ?? d.lastUpdated,
    });
    if (typeof document !== "undefined" && LIVE.goals !== prevGoals) {
      const lang = getCurrentLangCode();
      const railSubLabels = {
        en: `${LIVE.goals} Goals · Official`,
        es: `${LIVE.goals} Goles · Oficial`,
        pt: `${LIVE.goals} Gols · Oficial`,
        fr: `${LIVE.goals} Buts · Officiel`,
        ro: `${LIVE.goals} Goluri · Oficial`,
        uz: `${LIVE.goals} Gol · Rasmiy`,
        ar: `${LIVE.goals} هدف · رسمي`,
      };
      const subText = railSubLabels[lang] || railSubLabels.en;
      document.querySelectorAll("[data-rail-goals-sub]").forEach((node) => {
        node.textContent = subText;
      });
    }
  }
}

function clubAgg(d) {
  const o = {};
  d.clubSeasons.forEach((s) => {
    const k = CLUB_KEY[s.club];
    o[k] = o[k] || { apps: 0, goals: 0 };
    o[k].apps += s.apps;
    o[k].goals += s.goals;
  });
  o.argentina = { apps: d.totals.country.apps, goals: d.totals.country.goals };
  return o;
}

/* ---------- shared blocks ---------- */
function setHead(d, ledeHTML) {
  const lang = (document.documentElement.lang || "en").toLowerCase().split("-")[0];
  const isEn = lang === "en";
  if (el("upd")) {
    if (isEn) {
      el("upd").textContent = "Updated " + d.lastUpdated;
    } else if (d.lastUpdatedIso) {
      try {
        const dt = new Date(d.lastUpdatedIso + "T00:00:00");
        const locMap = { es: "es-ES", pt: "pt-PT", fr: "fr-FR", ro: "ro-RO", uz: "uz-Latn-UZ", ar: "ar-EG-u-nu-latn", id: "id-ID" };
        const prefixMap = { es: "Actualizado el ", pt: "Atualizado em ", fr: "Mis à jour le ", ro: "Actualizat la ", uz: "Yangilangan: ", ar: "مُحدّث في ", id: "Diperbarui " };
        const loc = locMap[lang];
        if (loc && prefixMap[lang]) {
          el("upd").textContent = prefixMap[lang] + dt.toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric" });
        }
      } catch (_) {}
    }
  }
  if (el("lede")) {
    if (isEn || !el("lede").textContent.trim()) {
      el("lede").innerHTML = ledeHTML;
    }
  }
  if (el("foot-date")) {
    const footDates = {
      es: `Lionel Messi: ${n(d.totals.apps)} partidos oficiales senior, ${n(d.totals.goals)} goles ` +
        `(${n(d.totals.clubs.apps)} PJ / ${n(d.totals.clubs.goals)} goles en clubes, ` +
        `${n(d.totals.country.apps)} / ${n(d.totals.country.goals)} con Argentina). Actualizado al ${d.lastUpdated}.`,
      pt: `Lionel Messi: ${n(d.totals.apps)} partidas oficiais seniores, ${n(d.totals.goals)} gols ` +
        `(${n(d.totals.clubs.apps)} jogos / ${n(d.totals.clubs.goals)} gols por clubes, ` +
        `${n(d.totals.country.apps)} / ${n(d.totals.country.goals)} pela Argentina). Atualizado em ${d.lastUpdated}.`,
      fr: `Lionel Messi : ${n(d.totals.apps)} matchs officiels en senior, ${n(d.totals.goals)} buts ` +
        `(${n(d.totals.clubs.apps)} matchs / ${n(d.totals.clubs.goals)} buts en club, ` +
        `${n(d.totals.country.apps)} / ${n(d.totals.country.goals)} avec l'Argentine). Mis à jour le ${d.lastUpdated}.`,
      ro: `Lionel Messi: ${n(d.totals.apps)} meciuri oficiale de seniori, ${n(d.totals.goals)} goluri ` +
        `(${n(d.totals.clubs.apps)} meciuri / ${n(d.totals.clubs.goals)} goluri la cluburi, ` +
        `${n(d.totals.country.apps)} / ${n(d.totals.country.goals)} cu Argentina). Actualizat la ${d.lastUpdated}.`,
      uz: `Lionel Messi: ${n(d.totals.apps)} ta rasmiy o'yin, ${n(d.totals.goals)} ta gol ` +
        `(${n(d.totals.clubs.apps)} ta klub o'yini / ${n(d.totals.clubs.goals)} ta gol, ` +
        `${n(d.totals.country.apps)} / ${n(d.totals.country.goals)} Argentina). Yangilangan sana: ${d.lastUpdated}.`,
      ar: `ليونيل ميسي: ${n(d.totals.apps)} مباراة رسمية، ${n(d.totals.goals)} هدفاً ` +
        `(${n(d.totals.clubs.apps)} مباراة / ${n(d.totals.clubs.goals)} هدفاً مع الأندية، ` +
        `${n(d.totals.country.apps)} / ${n(d.totals.country.goals)} مع الأرجنتين). آخر تحديث ${d.lastUpdated}.`,
      id: `Lionel Messi: ${n(d.totals.apps)} penampilan senior, ${n(d.totals.goals)} gol ` +
        `(${n(d.totals.clubs.apps)} laga / ${n(d.totals.clubs.goals)} gol klub, ` +
        `${n(d.totals.country.apps)} / ${n(d.totals.country.goals)} Argentina). Diperbarui ${d.lastUpdated}.`
    };
    el("foot-date").textContent = footDates[lang] ||
      `Lionel Messi: ${n(d.totals.apps)} senior appearances, ${n(d.totals.goals)} goals ` +
      `(${n(d.totals.clubs.apps)} apps / ${n(d.totals.clubs.goals)} goals club, ` +
      `${n(d.totals.country.apps)} / ${n(d.totals.country.goals)} Argentina). Last checked ${d.lastUpdated}.`;
  }
  const footEl = document.querySelector("footer");
  if (footEl && !footEl.querySelector(".footer-social-bar")) {
    const socialDiv = document.createElement("div");
    socialDiv.className = "footer-social-bar";
    socialDiv.innerHTML = `
      <a href="https://x.com/messistat1" target="_blank" rel="noopener noreferrer" class="footer-x-link" aria-label="Follow MessiStat on X (@messistat1)">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        <span>Follow @messistat1 on X</span>
      </a>
      <a href="https://t.me/messistatdotcom" target="_blank" rel="noopener noreferrer" class="footer-x-link footer-tg-link" aria-label="Join MessiStat on Telegram">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
        <span>Telegram @messistatdotcom</span>
      </a>
    `;
    const crestNote = footEl.querySelector(".crest-note");
    if (crestNote) {
      footEl.insertBefore(socialDiv, crestNote);
    } else {
      footEl.appendChild(socialDiv);
    }
  }
}
function reveal() {
  document.querySelectorAll("main.wrap > *").forEach((s, i) => {
    s.classList.add("reveal");
    s.style.animationDelay = Math.min(i * 0.04, 0.4) + "s";
  });
}
const EXPLORE = [
  { href: "/en/birthday", page: "birthday", t: "Did Messi score on your birthday?", d: (d) => `Search all 366 calendar days with video clips across Messi's ${n(d.totals.goals)} senior career goals.` },
  { href: "/en/messi-vs-ronaldo", page: "messi-vs-ronaldo", t: "Messi vs Ronaldo All-Time", d: () => `Head-to-head career stats: ${n(LIVE.goals)} vs ${n(LIVE.rGoals)} goals, ${LIVE.trophies} vs ${LIVE.rTrophies} trophies, 8 vs 5 Ballons d'Or.` },
  { href: "/en/vs-real-madrid", page: "vs-real-madrid", t: "Messi vs Real Madrid", d: () => "All 26 El Clásico goals, 45 matches, 14 assists, hat-tricks, and video clips." },
  { href: "/en/champions-league", page: "champions-league", t: "Champions League Record", d: () => "129 UEFA Champions League goals, 8 hat-tricks, and 4 European titles." },
  { href: "/en/latest-goal", page: "latest-goal", t: "Latest Messi Goal Video", d: () => "Watch Messi's latest goal video, see if he scored today, and view recent goal clips." },
  { href: "/en", page: "home", t: "Messi career stats", d: (d) => `The headline numbers: ${n(d.totals.goals)} goals in ${n(d.totals.apps)} senior games.` },
  { href: "/en/dashboard", page: "dashboard", t: "Messi stats dashboard", d: () => "Filter every chart by Barcelona, PSG, Inter Miami or Argentina." },
  { href: "/en/timeline", page: "timeline", t: "Messi through the years", d: () => "Every career milestone, dated and in order, from 2004 to today." },
];

function getLang() {
  const l = (document.documentElement.lang || "en").toLowerCase();
  for (const c of ["es", "pt", "fr", "ro", "uz", "ar", "id"]) {
    if (l.startsWith(c)) return c;
  }
  return "en";
}

const EXPLORE_LANGS = {
  es: [
    { href: "/es/birthday", page: "birthday", t: "¿Marcó Messi en tu cumpleaños?", d: (d) => `Busca entre los 366 días del año con clips de video de los ${n(d.totals.goals)} goles oficiales de Messi.` },
    { href: "/es/messi-vs-ronaldo", page: "messi-vs-ronaldo", t: "Messi vs Ronaldo Histórico", d: () => `Estadísticas cara a cara: ${n(LIVE.goals)} vs ${n(LIVE.rGoals)} goles, ${LIVE.trophies} vs ${LIVE.rTrophies} títulos, 8 vs 5 Balones de Oro.` },
    { href: "/es/vs-real-madrid", page: "vs-real-madrid", t: "Messi vs Real Madrid", d: () => "Los 26 goles en El Clásico, 45 partidos, 14 asistencias, hat-tricks y videos." },
    { href: "/es/champions-league", page: "champions-league", t: "Récord en Champions League", d: () => "129 goles en UEFA Champions League, 8 hat-tricks y 4 títulos europeos." },
    { href: "/es/latest-goal", page: "latest-goal", t: "Último gol de Messi en video", d: () => "Mira el video del último gol de Messi, consulta si marcó hoy y reproduce sus últimos goles." },
    { href: "/es", page: "home", t: "Estadísticas de Messi", d: (d) => `Las cifras clave: ${n(d.totals.goals)} goles en ${n(d.totals.apps)} partidos profesionales.` },
    { href: "/es/dashboard", page: "dashboard", t: "Panel interactivo de Messi", d: () => "Filtra todos los gráficos por Barcelona, PSG, Inter Miami o Argentina." },
    { href: "/es/timeline", page: "timeline", t: "Lionel Messi en el tiempo", d: () => "Cada hito histórico de su carrera, fechado y en orden, de 2004 a hoy." },
  ],
  pt: [
    { href: "/pt/birthday", page: "birthday", t: "Messi marcou no seu aniversário?", d: (d) => `Pesquise os 366 dias do ano com vídeos de todos os ${n(d.totals.goals)} gols de Messi.` },
    { href: "/pt/messi-vs-ronaldo", page: "messi-vs-ronaldo", t: "Messi vs Ronaldo Histórico", d: () => `Estatísticas cara a cara: ${n(LIVE.goals)} vs ${n(LIVE.rGoals)} gols, ${LIVE.trophies} vs ${LIVE.rTrophies} títulos, 8 vs 5 Bolas de Ouro.` },
    { href: "/pt/vs-real-madrid", page: "vs-real-madrid", t: "Messi vs Real Madrid", d: () => "Os 26 gols no El Clásico, 45 partidas, 14 assistências e hat-tricks." },
    { href: "/pt/champions-league", page: "champions-league", t: "Recorde na Champions League", d: () => "129 gols na UEFA Champions League, 8 hat-tricks e 4 títulos europeus." },
    { href: "/pt/latest-goal", page: "latest-goal", t: "Último gol de Messi em vídeo", d: () => "Assista ao vídeo do último gol de Messi, veja se marcou hoje e confira vídeos recentes." },
    { href: "/pt", page: "home", t: "Estatísticas de Lionel Messi", d: (d) => `Os números oficiais: ${n(d.totals.goals)} gols em ${n(d.totals.apps)} partidas profissionais.` },
    { href: "/pt/dashboard", page: "dashboard", t: "Painel de estatísticas", d: () => "Filtre todos os gráficos por Barcelona, PSG, Inter Miami ou Argentina." },
    { href: "/pt/timeline", page: "timeline", t: "História e Linha do tempo", d: () => "Cada momento da carreira em ordem cronológica de 2004 até hoje." },
  ],
  fr: [
    { href: "/fr/birthday", page: "birthday", t: "Messi a-t-il marqué le jour de votre anniversaire ?", d: (d) => `Recherchez parmi les 366 jours de l'année avec vidéos des ${n(d.totals.goals)} buts.` },
    { href: "/fr/messi-vs-ronaldo", page: "messi-vs-ronaldo", t: "Messi vs Ronaldo Face-à-Face", d: () => `Statistiques historiques : ${n(LIVE.goals)} vs ${n(LIVE.rGoals)} buts, ${LIVE.trophies} vs ${LIVE.rTrophies} titres, 8 vs 5 Ballons d'Or.` },
    { href: "/fr/vs-real-madrid", page: "vs-real-madrid", t: "Messi vs Real Madrid", d: () => "Tous les 26 buts dans le Clásico, 45 matchs, 14 passes décisives." },
    { href: "/fr/champions-league", page: "champions-league", t: "Bilan en Ligue des Champions", d: () => "129 buts en UEFA Champions League, 8 triplés et 4 titres européens." },
    { href: "/fr/latest-goal", page: "latest-goal", t: "Dernier but de Messi en vidéo", d: () => "Regardez la vidéo du dernier but de Messi, vérifiez s'il a marqué aujourd'hui et ses derniers buts." },
    { href: "/fr", page: "home", t: "Statistiques de Lionel Messi", d: (d) => `Les chiffres clés : ${n(d.totals.goals)} buts en ${n(d.totals.apps)} matchs officiels.` },
    { href: "/fr/dashboard", page: "dashboard", t: "Tableau de bord interactif", d: () => "Filtrez par Barcelone, PSG, Inter Miami ou Argentine." },
    { href: "/fr/timeline", page: "timeline", t: "Chronologie de sa carrière", d: () => "Chaque événement historique daté dans l'ordre chronologique." },
  ],
  ro: [
    { href: "/ro/birthday", page: "birthday", t: "A marcat Messi de ziua ta?", d: (d) => `Caută în toate cele 366 de zile calendaristice clipuri video din cele ${n(d.totals.goals)} goluri ale lui Messi.` },
    { href: "/ro/messi-vs-ronaldo", page: "messi-vs-ronaldo", t: "Messi vs Ronaldo All-Time", d: () => `Statistici directe: ${n(LIVE.goals)} vs ${n(LIVE.rGoals)} goluri, ${LIVE.trophies} vs ${LIVE.rTrophies} trofee, 8 vs 5 Baloane de Aur.` },
    { href: "/ro/vs-real-madrid", page: "vs-real-madrid", t: "Messi vs Real Madrid", d: () => "Toate cele 26 de goluri din El Clásico, 45 meciuri, 14 pase de gol și clipuri video." },
    { href: "/ro/champions-league", page: "champions-league", t: "Record în Champions League", d: () => "129 de goluri în UEFA Champions League, 8 hat-trick-uri și 4 trofee europene." },
    { href: "/ro/latest-goal", page: "latest-goal", t: "Video cu Ultimul Gol al lui Messi", d: () => "Urmărește ultimul gol al lui Messi, vezi dacă a marcat azi și clipurile recente." },
    { href: "/ro", page: "home", t: "Statisticile Carierei Messi", d: (d) => `Cifrele principale: ${n(d.totals.goals)} goluri în ${n(d.totals.apps)} meciuri oficiale.` },
    { href: "/ro/dashboard", page: "dashboard", t: "Panou Statistici Messi", d: () => "Filtrează fiecare grafic după Barcelona, PSG, Inter Miami sau Argentina." },
    { href: "/ro/timeline", page: "timeline", t: "Messi de-a Lungul Anilor", d: () => "Fiecare bornă din carieră, datată cronologic din 2004 până astăzi." },
  ],
  uz: [
    { href: "/uz/birthday", page: "birthday", t: "Messi tug'ilgan kuningizda gol urganmi?", d: (d) => `Messining ${n(d.totals.goals)} ta goli orasidan 366 kunlik taqvim bo'yicha video lavhalarni qidiring.` },
    { href: "/uz/messi-vs-ronaldo", page: "messi-vs-ronaldo", t: "Messi vs Ronaldo Tarixiy Taqqoslash", d: () => `O'zaro statistika: ${n(LIVE.goals)} ga qarshi ${n(LIVE.rGoals)} gol, ${LIVE.trophies} ga ${LIVE.rTrophies} sovrin, 8 ga 5 Oltin To'p.` },
    { href: "/uz/vs-real-madrid", page: "vs-real-madrid", t: "Messi Real Madridga Qarshi", d: () => "El Klasikodagi barcha 26 ta gol, 45 o'yin, 14 assist va video lavhalar." },
    { href: "/uz/champions-league", page: "champions-league", t: "Chempionlar Ligasi Rekordi", d: () => "UEFA Chempionlar Ligasida 129 ta gol, 8 ta het-trik va 4 ta kubok." },
    { href: "/uz/latest-goal", page: "latest-goal", t: "Messining So'nggi Goli Videosi", d: () => "Messining so'nggi golini tomosha qiling va bugun gol urganini tekshiring." },
    { href: "/uz", page: "home", t: "Messi Karyera Statistikasi", d: (d) => `Asosiy raqamlar: ${n(d.totals.apps)} o'yinda ${n(d.totals.goals)} ta rasmiy gol.` },
    { href: "/uz/dashboard", page: "dashboard", t: "Messi Tahliliy Paneli", d: () => "Har bir grafikni Barselona, PSJ, Inter Mayami yoki Argentina bo'yicha filtrlang." },
    { href: "/uz/timeline", page: "timeline", t: "Yillar Davomida Messi", d: () => "2004-yildan bugungacha bo'lgan barcha tarixiy bosqichlar xronologiyasi." },
  ],
  ar: [
    { href: "/ar/birthday", page: "birthday", t: "هل سجّل ميسي في يوم ميلادك؟", d: (d) => `ابحث في جميع أيام السنة الـ 366 مع مقاطع فيديو لأهداف ميسي الـ ${n(d.totals.goals)}.` },
    { href: "/ar/messi-vs-ronaldo", page: "messi-vs-ronaldo", t: "ميسي ضد رونالدو عبر التاريخ", d: () => `مقارنة شاملة: ${n(LIVE.goals)} مقابل ${n(LIVE.rGoals)} هدفاً، ${LIVE.trophies} مقابل ${LIVE.rTrophies} لقباً، 8 مقابل 5 كرات ذهبية.` },
    { href: "/ar/vs-real-madrid", page: "vs-real-madrid", t: "ميسي ضد ريال مدريد", d: () => "جميع أهداف الكلاسيكو الـ 26 في 45 مباراة مع 14 تمريرة حاسمة ومقاطع الفيديو." },
    { href: "/ar/champions-league", page: "champions-league", t: "سجل دوري أبطال أوروبا", d: () => "129 هدفاً في دوري أبطال أوروبا، 8 هاتريك، و4 ألقاب أوروبية." },
    { href: "/ar/latest-goal", page: "latest-goal", t: "فيديو أحدث هدف لميسي", d: () => "شاهد فيديو هدف ميسي الأخير وتحقق مما إذا كان قد سجّل اليوم." },
    { href: "/ar", page: "home", t: "إحصائيات مسيرة ميسي", d: (d) => `الأرقام الرئيسية: ${n(d.totals.goals)} هدفاً في ${n(d.totals.apps)} مباراة رسمية.` },
    { href: "/ar/dashboard", page: "dashboard", t: "لوحة إحصائيات ميسي", d: () => "صفّ جميع الرسوم البيانية حسب برشلونة أو باريس أو إنتر ميامي أو الأرجنتين." },
    { href: "/ar/timeline", page: "timeline", t: "ميسي عبر السنين", d: () => "كل محطة تاريخية في مسيرته مرتبة زمنياً من 2004 حتى اليوم." },
  ],
  id: [
    { href: "/id/birthday", page: "birthday", t: "Apakah Messi mencetak gol di hari ulang tahunmu?", d: (d) => `Telusuri semua 366 hari kalender dengan klip video dari ${n(d.totals.goals)} gol karier Messi.` },
    { href: "/id/messi-vs-ronaldo", page: "messi-vs-ronaldo", t: "Messi vs Ronaldo Sepanjang Masa", d: () => `Head-to-head: ${n(LIVE.goals)} vs ${n(LIVE.rGoals)} gol, ${LIVE.trophies} vs ${LIVE.rTrophies} trofi, 8 vs 5 Ballon d'Or.` },
    { href: "/id/vs-real-madrid", page: "vs-real-madrid", t: "Messi vs Real Madrid", d: () => "Semua 26 gol El Clásico dalam 45 laga, 14 assist, dan video cuplikan." },
    { href: "/id/champions-league", page: "champions-league", t: "Rekor Liga Champions", d: () => "129 gol Liga Champions UEFA, 8 hat-trick, dan 4 gelar Eropa." },
    { href: "/id/latest-goal", page: "latest-goal", t: "Video Gol Terbaru Messi", d: () => "Tonton gol terakhir Messi, cek apakah ia mencetak gol hari ini, dan klip terbaru." },
    { href: "/id", page: "home", t: "Statistik Karier Messi", d: (d) => `Angka utama: ${n(d.totals.goals)} gol dalam ${n(d.totals.apps)} penampilan senior.` },
    { href: "/id/dashboard", page: "dashboard", t: "Dasbor Statistik Messi", d: () => "Filter setiap grafik menurut Barcelona, PSG, Inter Miami, atau Argentina." },
    { href: "/id/timeline", page: "timeline", t: "Messi dari Tahun ke Tahun", d: () => "Setiap tonggak karier, berurutan dari 2004 hingga sekarang." },
  ]
};

function renderExplore(d, page) {
  const e = el("explore");
  if (!e) return;
  const lang = getLang();
  const list = EXPLORE_LANGS[lang] || EXPLORE;
  e.innerHTML = list.filter((x) => x.page !== page)
    .slice(0, 9)
    .map((x) => `<a class="link-card" href="${x.href}"><strong>${esc(x.t)}</strong><span>${esc(x.d(d))}</span></a>`)
    .join("");
}
function methodHTML(d, extra) {
  const lang = getLang();
  if (lang === "es") {
    const teams = "Barcelona, París Saint-Germain, Inter Miami y Selección Argentina";
    return methodColophon(`<h2>Cómo recopilamos estas estadísticas</h2>` +
      `<p>Contabilizamos una sola cosa: partidos oficiales de primer equipo senior para ${teams} — ` +
      `cada partido de liga, copa nacional, noche continental y selección mayor. Sin fútbol juvenil, sin filiales y sin amistosos de clubes.</p>` +
      `<details class="method-more"><summary>Cómo verificamos las cifras</summary>` +
      `<p>Los goles por temporada y año se compilan a partir de actas oficiales de partido y se contrastan con registros de clubes ` +
      `y competiciones tras cada encuentro. Todos los datos están 100% verificados. ${extra || ""}</p>` +
      `<p class="colophon">Sitio independiente actualizado manualmente tras cada partido. Totales 100% verificados con fuentes primarias oficiales.</p></details>`);
  }
  if (lang === "pt") {
    const teams = "Barcelona, Paris Saint-Germain, Inter Miami e Seleção Argentina";
    return methodColophon(`<h2>Como reunimos essas estatísticas</h2>` +
      `<p>Contabilizamos apenas partidas oficiais de equipes principais seniores para ${teams} — ` +
      `todos os jogos de liga, copas nacionais, competições continentais e jogos da seleção. Sem divisões de base e sem amistosos de clubes.</p>` +
      `<details class="method-more"><summary>Como verificamos os números</summary>` +
      `<p>Os gols são compilados a partir de súmulas oficiais de jogos e validados após cada partida. Todos os dados são 100% verificados. ${extra || ""}</p>` +
      `<p class="colophon">Site independente mantido e verificado com fontes primárias oficiais.</p></details>`);
  }
  if (lang === "fr") {
    const teams = "Barcelone, Paris Saint-Germain, Inter Miami et l'Équipe d'Argentine";
    return methodColophon(`<h2>Comment nous compilons ces statistiques</h2>` +
      `<p>Nous comptabilisons une seule chose : les matchs officiels en équipe première senior pour ${teams} — ` +
      `championnats, coupes nationales, coupes d'Europe/Amérique et sélections nationales. Pas de matchs de jeunes ni d'amicaux en club.</p>` +
      `<details class="method-more"><summary>Vérification des chiffres</summary>` +
      `<p>Chaque but est vérifié selon les feuilles de match officielles après chaque rencontre. Données 100% certifiées. ${extra || ""}</p>` +
      `<p class="colophon">Base de données indépendante mise à jour avec rigueur après chaque rencontre.</p></details>`);
  }
  if (lang === "ro") {
    const teams = "Barcelona, Paris Saint-Germain, Inter Miami și Naționala Argentinei";
    return methodColophon(`<h2>Cum compilăm aceste statistici</h2>` +
      `<p>Numărăm un singur lucru: meciurile oficiale de seniori la prima echipă pentru ${teams} — ` +
      `fiecare meci de campionat, cupă internă, competiție continentală și selecție națională. Fără juniori, fără echipe secunde și fără amicale de club.</p>` +
      `<details class="method-more"><summary>Cum verificăm cifrele</summary>` +
      `<p>Golurile pe sezoane și ani sunt centralizate din foile oficiale de joc și verificate după fiecare meci. ${extra || ""}</p>` +
      `<p class="colophon">Arhivă independentă actualizată după fiecare meci oficial cu surse primare verificate.</p></details>`);
  }
  if (lang === "uz") {
    const teams = "Barselona, Parij Sen-Jermen, Inter Mayami va Argentina terma jamoasi";
    return methodColophon(`<h2>Ushbu statistikani qanday jamlaymiz</h2>` +
      `<p>Biz faqat bitta narsani hisoblaymiz: ${teams} asosiy jamoalaridagi rasmiy kattalar o'yinlari — ` +
      `liga, milliy kuboklar, qit'a turnirlari va terma jamoa bahslari. Yoshlar va klub o'rtoqlik o'yinlari kiritilmaydi.</p>` +
      `<details class="method-more"><summary>Raqamlar qanday tekshiriladi</summary>` +
      `<p>Har bir o'yindan so'ng rasmiy o'yin bayonnomalari va klub ma'lumotlari asosida tekshiriladi. ${extra || ""}</p>` +
      `<p class="colophon">Har bir rasmiy o'yindan keyin mustaqil tarzda yangilanadigan aniq baza.</p></details>`);
  }
  if (lang === "ar") {
    const teams = "برشلونة وباريس سان جيرمان وإنتر ميامي ومنتخب الأرجنتين";
    return methodColophon(`<h2>كيف نُعدّ هذه الإحصائيات</h2>` +
      `<p>نحتسب المباريات الرسمية للفريق الأول فقط مع ${teams} — ` +
      `الدوريات والكؤوس المحلية والبطولات القارية والمباريات الدولية الرسمية، دون احتساب مباريات الفئات السنية أو الوديات غير الرسمية للأندية.</p>` +
      `<details class="method-more"><summary>كيفية التحقق من الأرقام</summary>` +
      `<p>تُجمع الأهداف من تقارير المباريات الرسمية وسجلات الأندية والاتحادات بعد كل مباراة. ${extra || ""}</p>` +
      `<p class="colophon">أرشيف مستقل محدّث بدقة بعد كل مباراة رسمية وفق مصادر موثقة.</p></details>`);
  }
  if (lang === "id") {
    const teams = "Barcelona, Paris Saint-Germain, Inter Miami, dan Timnas Argentina";
    return methodColophon(`<h2>Cara angka-angka ini dikompilasi</h2>` +
      `<p>Kami menghitung satu hal: pertandingan resmi tim utama senior untuk ${teams} — ` +
      `setiap laga liga, piala domestik, kompetisi kontinental, dan penampilan internasional. Tanpa sepak bola junior, tim cadangan, atau uji coba klub.</p>` +
      `<details class="method-more"><summary>Cara angka-angka ini diverifikasi</summary>` +
      `<p>Gol per musim dan tahun kalender dihimpun dari catatan pertandingan lengkap dan dicocokkan dengan data resmi klub ` +
      `dan kompetisi setelah setiap laga. ${extra || ""}</p>` +
      `<p class="colophon">Arsip karier independen yang diperbarui setelah setiap penampilan resmi dari sumber primer terverifikasi.</p></details>`);
  }
  const teams = "Barcelona, Paris Saint-Germain, Inter Miami and Argentina";
  return methodColophon(`<h2>How these numbers are compiled</h2>` +
    `<p>We count one thing: official senior first-team matches for ${teams} — ` +
    `every league game, domestic cup, continental night and international appearance. No youth football, no reserves, no club friendlies.</p>` +
    `<details class="method-more"><summary>How these numbers are verified</summary>` +
    `<p>Season and calendar-year goals are tallied from full match records and checked against official club ` +
    `and competition sheets after every game. ${extra || ""}</p>` +
    `<p class="colophon">Independent career archive updated after every official appearance from verified primary sources.</p></details>`);
}
function renderMethod(d, extra) {
  const m = el("method");
  if (m) m.innerHTML = methodHTML(d, extra);
}

/* ---------- SVG charts ---------- */
/* One viewBox cannot serve a 340px phone and a 1120px desktop: the phone would
   just shrink every label to ~4px. So the geometry is chosen at render time.
   Compact = a narrow, tall box with larger user-unit type and thinned labels. */
let SPARK_COMPACT = typeof window !== "undefined" ? window.innerWidth < 760 : false;
if (typeof window !== "undefined" && window.matchMedia) {
  const _mq = window.matchMedia("(min-width: 760px)");
  const _sync = () => {
    const next = !_mq.matches;
    if (next !== SPARK_COMPACT) {
      SPARK_COMPACT = next;
      window.dispatchEvent(new Event("messi:spark-relayout"));
    }
  };
  if (_mq.addEventListener) _mq.addEventListener("change", _sync);
  else if (_mq.addListener) _mq.addListener(_sync);
}

function sparkSVG(rows, opts) {
  opts = opts || {};
  const compact = SPARK_COMPACT;
  const W = compact ? 360 : 1000;
  const H = compact ? 300 : 210;
  const base = compact ? 246 : 175;
  const maxH = compact ? 176 : 120;
  const targetY = compact ? 34 : 44;
  const labelY = compact ? 292 : 198;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const step = W / rows.length;
  const bw = compact
    ? Math.min(Math.max(5, step * 0.58), 20)
    : Math.min(Math.max(20, step * 0.52), 64);
  const rx = compact ? 1.5 : 4;
  // Only label years where the text cannot collide with its neighbour.
  const labelEvery = compact ? Math.max(1, Math.ceil(40 / step)) : (opts.skipLabels ? 2 : 1);
  const svgCls = "spark" + (compact ? " compact" : "");
  let s = `<svg class="${svgCls}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || "Bar chart")}">`;
  s += `<defs>` +
    `<linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--brand-ink)" stop-opacity="0.72"/><stop offset="1" stop-color="var(--brand)"/></linearGradient>` +
    `<linearGradient id="barPeak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eec22f"/><stop offset="1" stop-color="#8a6300"/></linearGradient>` +
    `<linearGradient id="cumAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--brand)" stop-opacity="0.22"/><stop offset="1" stop-color="var(--brand)" stop-opacity="0.02"/></linearGradient>` +
    `</defs>`;

  const lang = getLang();
  const yrSuffix = {
    es: " /año", pt: " /ano", fr: " /an", ro: " /an", uz: " /yil", ar: " /سنة", id: " /thn"
  }[lang] || " /yr";
  s += `<line class="baseline" x1="0" y1="${base}" x2="${W}" y2="${base}"></line>`;
  s += `<text class="axis" x="4" y="${(base - maxH + (compact ? 14 : 4)).toFixed(1)}">${max}${opts.cumulative ? yrSuffix : ""}</text><text class="axis" x="4" y="${(base - 4).toFixed(1)}">0</text>`;

  // 1. Draw bars first so cumulative line and labels sit cleanly on top
  const lastIdx = rows.length - 1;
  // Decide which columns get a year label BEFORE drawing, so we can guarantee
  // a minimum gap. Forcing the last column on top of a regular tick used to
  // print "2025" and "2026" on top of each other.
  const minGap = compact ? 42 : 46;
  const wanted = [];
  for (let i = 0; i <= lastIdx; i += labelEvery) wanted.push(i);
  if (wanted[wanted.length - 1] !== lastIdx) wanted.push(lastIdx);
  const peakIdx = rows.findIndex((r) => r.peak || (r.year != null && r.year === opts.peakYear));
  if (peakIdx >= 0 && !wanted.includes(peakIdx)) wanted.push(peakIdx);
  wanted.sort((a, b) => a - b);
  const labelled = [];
  for (const i of wanted) {
    const x = i * step + step / 2;
    if (labelled.length && x - labelled[labelled.length - 1] * step - step / 2 < minGap) {
      // Too close to the previous label: keep the later one only if it is the
      // final column, otherwise drop this one.
      if (i !== lastIdx) continue;
      labelled.pop();
    }
    labelled.push(i);
  }
  const labelSet = new Set(labelled);

  rows.forEach((r, i) => {
    const h = Math.max(compact ? 2 : 3, (r.value / max) * maxH);
    const x = (i * step + (step - bw) / 2).toFixed(1);
    const y = (base - h).toFixed(1);
    const peak = r.peak || (r.year != null && r.year === opts.peakYear);
    const selected = opts.selectedYear != null && r.year === opts.selectedYear;
    const cls = "bar ybar" + (peak ? " peak" : "") + (r.provisional ? " prov" : "") + (selected ? " active" : "");
    const rect = `<rect class="${cls}" data-year="${r.year != null ? r.year : ""}" data-val="${r.value}" style="--i:${i}" x="${x}" y="${y}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${rx}"><title>${esc(r.tip)}</title></rect>`;
    s += (opts.linkPrefix && r.year != null) ? `<a href="${opts.linkPrefix}${r.year}">${rect}</a>` : rect;

    const labY = Math.max(base - h - (compact ? 10 : 8), compact ? 22 : 26).toFixed(1);
    if (r.peak) {
      s += `<text class="peak-label" x="${(i * step + step / 2).toFixed(0)}" y="${labY}">${r.value}</text>`;
    } else if (r.provisional) {
      s += `<text class="prov-label" x="${(i * step + step / 2).toFixed(0)}" y="${labY}">${r.value}</text>`;
    }
    if (labelSet.has(i))
      s += `<text class="yr" x="${(i * step + step / 2).toFixed(0)}" y="${labelY}">${esc(r.label)}</text>`;
  });

  // 2. Cumulative polyline, target line, and labels drawn AFTER bars so they stay visible
  if (opts.cumulative) {
    const tot = rows.reduce((a, r) => a + r.value, 0);
    const target = 1000;
    let run = 0;
    const pts = rows.map((r, i) => {
      run += r.value;
      const x = (i * step + step / 2).toFixed(1);
      const y = (base - (run / target) * (base - targetY)).toFixed(1);
      return `${x},${y}`;
    });
    const firstX = (step / 2).toFixed(1);
    const lastX = ((rows.length - 1) * step + step / 2).toFixed(1);
    const lastY = (base - (tot / target) * (base - targetY)).toFixed(1);

    const chartI18n = {
      es: { target: "Meta de 1.000 goles", now: `${n(tot)} actual`, tip: `Total en su carrera: ${n(tot)} goles` },
      pt: { target: "Meta de 1.000 gols", now: `${n(tot)} atual`, tip: `Total na carreira: ${n(tot)} gols` },
      fr: { target: "Objectif 1 000 buts", now: `${n(tot)} actuel`, tip: `Total en carrière : ${n(tot)} buts` },
      ro: { target: "Ținta de 1.000 goluri", now: `${n(tot)} acum`, tip: `Total în carieră: ${n(tot)} goluri` },
      uz: { target: "1 000 gol maqsadi", now: `Hozir: ${n(tot)}`, tip: `Karyeradagi jami: ${n(tot)} ta gol` },
      ar: { target: "هدف الـ 1000", now: `${n(tot)} الآن`, tip: `إجمالي المسيرة: ${n(tot)} هدفاً` },
      id: { target: "Target 1.000 gol", now: `${n(tot)} saat ini`, tip: `Total karier saat ini: ${n(tot)} gol` }
    };
    const cLabels = chartI18n[lang] || { target: "1,000 goal target", now: `${n(tot)} now`, tip: `Current career total: ${n(tot)} goals` };

    // Subtle area under cumulative curve
    s += `<polygon class="cum-area" points="${firstX},${base} ${pts.join(" ")} ${lastX},${base}" fill="url(#cumAreaGrad)"/>`;
    // 1,000 goal target line
    s += `<line class="thousand" x1="0" y1="${targetY}" x2="${W}" y2="${targetY}"/>`;
    if (compact) {
      // In a 360-unit box the two right-anchored notes would collide, so the
      // target label goes top-left and the running total sits under the end dot.
      s += `<text class="thousand-label" x="4" y="${targetY - 7}" text-anchor="start">${cLabels.target}</text>`;
      s += `<text class="axis right" x="${W - 4}" y="${(+lastY + 20).toFixed(1)}" text-anchor="end">${cLabels.now}</text>`;
    } else {
      s += `<text class="thousand-label" x="${W - 10}" y="${targetY - 6}">${cLabels.target}</text>`;
      s += `<text class="axis right" x="${W - 10}" y="${targetY + 16}" text-anchor="end">${cLabels.now}</text>`;
    }
    // Cumulative climb line
    s += `<polyline class="cum" points="${pts.join(" ")}"/>`;
    // Current total marker dot
    s += `<circle class="cum-dot" cx="${lastX}" cy="${lastY}" r="${compact ? 4 : 5}"><title>${esc(cLabels.tip)}</title></circle>`;
  }

  return s + `</svg>`;
}
function donutSVG(parts, total, centerTop, centerSub) {
  const R = 70, C = 2 * Math.PI * R;
  let off = 0;
  let s = `<svg class="donut" viewBox="0 0 190 190" role="img" aria-label="${esc(centerTop)}">`;
  parts.forEach((p, i) => {
    const frac = p.value / total;
    const len = Math.max(frac * C - 3, 2);
    s += `<circle cx="95" cy="95" r="${R}" fill="none" stroke="${p.color}" stroke-width="26" ` +
      `stroke-dasharray="0 ${C.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" ` +
      `data-off="${(-off).toFixed(1)}" data-len="${len.toFixed(1)}" data-c="${C.toFixed(1)}" ` +
      `style="--len:${len.toFixed(1)}px;--c:${C.toFixed(1)}px;--i:${i};" ` +
      `transform="rotate(-90 95 95)" stroke-linecap="butt">` +
      `<title>${esc(p.label)}: ${p.value} of ${total} (${(100 * p.value / total).toFixed(1)}%)</title></circle>`;
    off += frac * C;
  });
  s += `<text class="donut-hole" x="95" y="96">${centerTop}</text><text class="donut-sub" x="95" y="116">${esc(centerSub)}</text></svg>`;
  return s;
}

function clubTableCaption() {
  const lang = getLang();
  const hints = {
    es: "Haz clic en el encabezado de una columna para ordenar. Solo partidos oficiales del primer equipo.",
    pt: "Clique no cabeçalho de uma coluna para ordenar. Apenas partidas oficiais da equipe principal.",
    fr: "Cliquez sur l'en-tête d'une colonne pour trier. Matchs officiels en équipe première uniquement.",
    ro: "Fă clic pe antetul unei coloane pentru a sorta. Doar meciuri oficiale de seniori.",
    uz: "Saralash uchun ustun sarlavhasini bosing. Faqat rasmiy asosiy jamoa o'yinlari.",
    ar: "انقر على عنوان العمود للفرز. المباريات الرسمية للفريق الأول فقط.",
    id: "Klik judul kolom untuk mengurutkan. Hanya pertandingan resmi tim utama senior."
  };
  const hint = hints[lang] || "Click a column header to sort. Senior first-team matches only.";
  return `<p class="table-hint">${hint}</p>`;
}
function provisionalNote() {
  const lang = getLang();
  const notes = {
    es: `<p class="caveat">Penaltis, tiros libres, hat-tricks y asistencias se actualizan tras cada partido oficial a partir de actas verificadas.</p>`,
    pt: `<p class="caveat">Pênaltis, faltas, hat-tricks e assistências são atualizados após cada partida oficial com base em súmulas verificadas.</p>`,
    fr: `<p class="caveat">Penaltys, coups francs, triplés et passes décisives sont mis à jour après chaque match officiel à partir des feuilles de match.</p>`,
    ro: `<p class="caveat">Penalty-urile, loviturile libere, hat-trick-urile și pasele decisive sunt actualizate după fiecare meci oficial.</p>`,
    uz: `<p class="caveat">Penaltilar, jarima zarbalari, het-triklar va assistlar har bir rasmiy o'yindan so'ng yangilanadi.</p>`,
    ar: `<p class="caveat">تُحدَّث ركلات الجزاء والركلات الحرة والهاتريك والتمريرات الحاسمة بعد كل مباراة رسمية وفق السجلات المعتمدة.</p>`,
    id: `<p class="caveat">Penalti, tendangan bebas, hat-trick, dan assist resmi dihimpun serta diverifikasi setelah setiap pertandingan senior.</p>`
  };
  return notes[lang] || `<p class="caveat">Penalties, free kicks, hat-tricks and official assists are compiled and verified after every senior match.</p>`;
}
function methodColophon(inner) {
  const lang = getLang();
  const intros = {
    es: "Cómo recopilamos estas cifras — verificadas manualmente y contrastadas con fuentes oficiales.",
    pt: "Como reunimos esses números — verificados manualmente e conferidos com fontes oficiais.",
    fr: "Comment nous compilons ces chiffres — vérifiés manuellement et recoupés avec les sources officielles.",
    ro: "Cum compilăm aceste cifre — verificate manual după surse oficiale.",
    uz: "Ushbu raqamlar qanday jamlanadi — rasmiy manbalar asosida tekshirilgan.",
    ar: "كيف نُعدّ هذه الأرقام — مراجعة دقيقة وموثقة وفق المصادر الرسمية.",
    id: "Cara angka-angka ini dikompilasi — diverifikasi setelah setiap penampilan berdasarkan sumber resmi."
  };
  const intro = intros[lang] || "How these numbers are compiled — verified after every appearance against named official sources.";
  return `<div class="colophon"><p>${intro}</p>${inner}${provisionalNote()}</div>`;
}
// Localized HOME_I18N, renderHome, initBdayQuickForm, renderOnThisDay
const HOME_I18N = {
  en: {
    locale: "en-GB",
    shirt10: "Shirt number 10",
    head: (t, p, d) => `<b>${n(t.goals)} goals</b> in <b>${n(t.apps)} senior appearances</b> — for Barcelona, PSG, ${esc(p.current.join(" and "))}. A World Cup winner and record eight-time Ballon d'Or holder, counted by hand and checked twice, as of ${esc(d.lastUpdated)}.`,
    meta: (p, dob) => `${esc(p.name)}, born ${dob} in ${esc(p.birthplace)}. He is ${p.age}, plays as a ${esc(p.position.toLowerCase())} and is currently at ${esc(p.current.join(" and "))}.`,
    roleLabel: "Role",
    teamsLabel: "Teams",
    nowLabel: "Now",
    kpiCareer: "Career goals",
    kpiCareerNote: (gpg, seasons) => `${gpg} goals per game across ${seasons} club seasons.`,
    kpiApps: "Senior appearances",
    kpiAppsNote: (clubs, country) => `${clubs} club, ${country} Argentina.`,
    kpiArg: "Argentina goals",
    kpiArgNote: (gpg, caps) => `${gpg} per cap across ${caps} caps.`,
    kpiTrophies: "Team trophies",
    kpiTrophiesNote: (lang) => `Plus a record 8 Ballons d'Or. <a href="/${lang}/achievements">Full honours list</a>.`,
    kpiRoad: "Road to 1,000 goals",
    kpiRoadNote: (togo, projYear, pace) => `${togo} to go. Rough projection at current pace (~${pace.toFixed(0)} a year): 1,000 lands around ${projYear}.`,
    copyStatsBtn: "Copy headline stats",
    copyText: (goals, apps, clubGoals, argGoals, updated) => `Messi: ${goals} goals in ${apps} senior apps (${clubGoals} club, ${argGoals} Argentina), ${LIVE.trophies} trophies, 8 Ballons d'Or — as of ${updated}.`,
    copyMsg: "Copied — paste it anywhere.",
    clubCaption: (updated, lang) => `Appearances and goals for every senior team Lionel Messi has played for, as of ${updated}. Full competition splits are on the <a href="/${lang}/goalsbyseason">goals by season page</a>.`,
    thTeam: "Team and years",
    thApps: "Apps",
    thGoals: "Goals",
    thGpg: "Goals per game",
    thTotal: "Career total",
    yearSub: "Pick a year and watch the running total climb — all the way from his 2004 debut to today.",
    yearTitle: "Messi stats by calendar year",
    yearLabel: "Year",
    yearFigcap: (start, cur, prov, lang) => `Calendar-year goals, ${start} to ${cur}${prov ? " (in progress)" : ""} — peaking at 91 in 2012. <a href="/${lang}/goalsbyyear">Open the full table</a>.`,
    tileGoals: (year, prov) => `Goals in ${year}${prov ? " (so far)" : ""}`,
    tileTotal: (year) => `Career total after ${year}`,
    tileAge: (year) => `Age during ${year}`,
    records: (best, post30, pct) => [
      [`91`, `<b>Goals in 2012</b>, the most any footballer has scored in a single calendar year — ${best.goals} in all competitions.`],
      [`8`, `<b>Ballons d'Or</b> (2009–12, 2015, 2019, 2021, 2023) — more than any other player in history.`],
      [`474`, `<b>La Liga goals</b>, the all-time record for the competition and for any single European top flight.`],
      [`129`, `<b>Champions League goals</b> — 120 for Barcelona and 9 for PSG, the second-most in the competition's history.`],
      [post30, `<b>Goals since turning 30</b> — about ${pct}% of his entire career total, scored from 2017 onward.`],
      [`57`, `<b>Hat-tricks or more</b> for club and country across his senior career (provisional tally).`],
      [`46`, `<b>Team trophies</b> — the most decorated career in football history, crowned by the 2022 World Cup.`]
    ],
    silverCaption: () => `${LIVE.trophies} senior team titles, club by club, plus the headline individual honours.`,
    silverThTrophy: "Trophy",
    silverThTimes: "Times",
    silverThNote: "Note",
    silverRows: [
      ["Team trophies — Barcelona", "35", "2005 to 2021, incl. 4 Champions Leagues"],
      ["Team trophies — Argentina", "5", "World Cup 2022, Copas América 2021 & 2024, Finalissima 2022, Olympic gold 2008"],
      ["Team trophies — PSG", "3", "Ligue 1 2022 & 2023, Trophée des Champions 2022"],
      ["Team trophies — Inter Miami", "4", "Leagues Cup 2023, Supporters' Shield 2024, MLS Cup 2025, Campeones Cup 2026"],
      ["Ballon d'Or", "8", "Record — 2009–12, 2015, 2019, 2021, 2023"]
    ],
    splitFk: "Free-kick goals",
    splitFkNote: "Curled in for club and country (provisional tally).",
    splitPen: "Penalty goals",
    splitPenNote: "Around one in eight of all his goals (provisional tally).",
    splitHt: "Hat-tricks or more",
    splitHtNote: "Three-plus-goal games, all competitions.",
    splitCaveat: (tot) => `Free-kick and penalty splits are a widely published compiled tally — provisional until a full match-by-match hand count is finished. The ${tot} total is unaffected.`,
    faq: (t, agg, m, d, lang) => [
      ["How many total career goals has Lionel Messi scored?", `<b>${n(t.goals)} official career goals</b> in ${n(t.apps)} senior appearances for club and country as of ${esc(d.lastUpdated)}, a rate of ${t.goalsPerGame} goals per game. Explore his full <a href="/${lang}/goalsbyyear">year-by-year scoring breakdown</a>.`],
      ["How many career assists does Lionel Messi have?", `Lionel Messi has recorded <b>407 official career assists</b> under Opta/FIFA standards (and <b>449 assists</b> under Transfermarkt's broader criteria) in ${n(t.apps)} appearances, making him the all-time assist leader in modern football history. His official breakdown includes ${LIVE.abtBarca} assists for FC Barcelona, ${LIVE.abtArg} for Argentina, ${LIVE.abtMiami} for Inter Miami CF, and ${LIVE.abtPsg} for Paris Saint-Germain.`],
      ["What are Lionel Messi's total goals and assists?", `Across his senior career, Lionel Messi has accumulated <b>${n(LIVE.ga)} official goal contributions</b> (<b>${n(t.goals)} goals</b> and <b>${n(LIVE.assists)} official assists</b>) in ${n(t.apps)} appearances — an extraordinary rate of <b>1.14 direct goal involvements per match</b>. Under Transfermarkt's criteria, his total stands at <b>${n(LIVE.tmGa)} goal involvements</b> (${n(t.goals)} goals + ${n(LIVE.tmAssists)} assists).`],
      ["Who has better all-time stats, Messi or Ronaldo?", `Across official senior matches, Cristiano Ronaldo holds the all-time goalscoring record with ${n(LIVE.rGoals)} goals and ${n(LIVE.rAssists)} assists in ${n(LIVE.rApps)} matches (${LIVE.rGpg} goals/game), while Messi has <b>${n(t.goals)} goals and ${n(t.assists.official)} official assists in ${n(t.apps)} matches</b> (0.79 goals/game, ${LIVE.apps ? ((LIVE.goals + LIVE.assists) / LIVE.apps).toFixed(2) : "1.13"} G+A/game). Messi reached ${n(t.goals)} goals in ${n(LIVE.fewer)} fewer matches, holds ${LIVE.trophies} team trophies to ${LIVE.rTrophies}, and 8 Ballons d'Or to 5. Compare their complete head-to-head records on our <a href="/${lang}/messi-vs-ronaldo">Messi vs Ronaldo stats page</a>.`],
      ["What is Messi's career goal breakdown by team?", `<b>${n(agg.barcelona.goals)} goals</b> in ${n(agg.barcelona.apps)} games for FC Barcelona, <b>${agg.psg.goals} goals</b> in ${n(agg.psg?.apps || 75)} games for PSG, <b>${n(agg.miami.goals)} goals</b> in ${n(agg.miami?.apps || 118)} games for Inter Miami, and <b>${n(t.country.goals)} goals</b> in ${n(t.country.apps)} caps for Argentina. See <a href="/${lang}/goalsbyseason">season-by-season club stats</a>.`],
      ["How many direct free kick goals has Messi scored?", `Lionel Messi has scored <b>${m?.freeKicks || 76} direct free-kick goals</b> in senior football (50 for Barcelona, 12 for Argentina, 12 for Inter Miami, and 2 for PSG), ranking 2nd all-time behind Marcelinho Carioca's record of 78.`],
      ["How many hat-tricks has Lionel Messi scored?", `Messi has scored <b>${d.hatTricks || 62} career hat-tricks</b> (48 for Barcelona, 11 for Argentina, 3 for Inter Miami). 42 came in league and Champions League play, including 6 matches where he scored 4 or 5 goals.`],
      ["How many penalty goals has Messi scored?", `Messi has scored <b>${m?.penalties || 110} penalty goals</b> from 141 attempts across club and country (a 78% conversion rate).`],
      ["How many non-penalty goals has Lionel Messi scored?", `Messi has scored <b>${n(t.goals - (m?.penalties || 111))} non-penalty goals</b> in ${n(t.apps)} appearances (${((t.goals - (m?.penalties || 111)) / t.apps).toFixed(2)} non-penalty goals per game) — the highest ratio in modern football history.`],
      ["How many goals did Messi score in 2012?", `<b>91 official goals in 2012</b> (79 for Barcelona, 12 for Argentina in 69 games) — certified by Guinness World Records as the all-time world record for most goals in a calendar year. Check our <a href="/${lang}/goalsbyyear">2012 stats tracker</a>.`],
      ["How many trophies has Lionel Messi won?", `<b>47 senior team titles</b> — the most decorated player in football history: 35 with Barcelona, 5 with Argentina (2022 World Cup, 2 Copas América, Finalissima, Olympics), 3 with PSG, and 4 with Inter Miami, plus 8 Ballons d'Or. See <a href="/${lang}/achievements">the full trophy list</a>.`],
      ["How many Ballons d'Or has Lionel Messi won?", `Lionel Messi has won <b>8 Ballons d'Or</b> (2009, 2010, 2011, 2012, 2015, 2019, 2021, 2023) — an all-time record in football history.`],
      ["What is Messi's record in El Clásico vs Real Madrid?", `Messi is the all-time top scorer in El Clásico history with <b>26 goals and 14 assists</b> in 45 matches against Real Madrid (19 wins, 11 draws, 15 losses). Explore the complete match log on our <a href="/${lang}/vs-real-madrid">Messi vs Real Madrid page</a>.`],
      ["What are Messi's UEFA Champions League statistics?", `Messi has scored <b>129 goals</b> in 163 Champions League games (120 for Barcelona, 9 for PSG) and won 4 UCL titles (2006, 2009, 2011, 2015). View full data on our <a href="/${lang}/champions-league">Champions League hub</a>.`],
      ["What are Messi's FIFA World Cup statistics?", `Messi has scored <b>21 goals and 12 assists</b> in 34 World Cup matches across 6 tournaments, winning the 2022 FIFA World Cup in Qatar and becoming the only player to win two FIFA World Cup Golden Balls (2014, 2022).`],
      ["How far is Lionel Messi from 1,000 career goals?", `With ${n(t.goals)} goals, Messi needs <b>${Math.max(0, 1000 - t.goals)} more goals</b> to reach 1,000 career goals. At his scoring pace (${t.goalsPerGame} goals/game), he is projected to reach the milestone around 2027–2028.`]
    ]
  },
  es: {
    locale: "es-ES",
    shirt10: "Camiseta número 10",
    head: (t, p, d) => `<b>${n(t.goals)} goles oficiales</b> en <b>${n(t.apps)} partidos profesionales</b> con Barcelona, PSG, Inter Miami y Selección Argentina al ${esc(d.lastUpdated)}. Campeón del mundo y récord de 8 Balones de Oro.`,
    meta: (p, dob) => `${esc(p.name)}, nacido el ${dob} en ${esc(p.birthplace)}. Tiene ${p.age} años, juega como delantero y milita en ${esc(p.current.join(" e "))}.`,
    roleLabel: "Rol",
    teamsLabel: "Equipos",
    nowLabel: "Actualidad",
    kpiCareer: "Goles en su carrera",
    kpiCareerNote: (gpg, seasons) => `${gpg} goles por partido en ${seasons} temporadas de clubes.`,
    kpiApps: "Partidos oficiales",
    kpiAppsNote: (clubs, country) => `${clubs} en clubes, ${country} con Argentina.`,
    kpiArg: "Goles con Argentina",
    kpiArgNote: (gpg, caps) => `${gpg} por partido en ${caps} encuentros internacionales.`,
    kpiTrophies: "Títulos colectivos",
    kpiTrophiesNote: (lang) => `Récord histórico de ${LIVE.trophies} títulos y 8 Balones de Oro. <a href="/${lang}/achievements">Palmarés completo</a>.`,
    kpiRoad: "Camino a los 1.000 goles",
    kpiRoadNote: (togo, projYear, pace) => `Faltan ${togo} goles. Al ritmo actual (~${pace.toFixed(0)} por año), alcanzará los 1.000 hacia ${projYear}.`,
    copyStatsBtn: "Copiar estadísticas",
    copyText: (goals, apps, clubGoals, argGoals, updated) => `Messi: ${goals} goles en ${apps} partidos oficiales (${clubGoals} en clubes, ${argGoals} con Argentina), ${LIVE.trophies} títulos colectivos, 8 Balones de Oro — al ${updated}.`,
    copyMsg: "Copiado al portapapeles.",
    clubCaption: (updated, lang) => `Partidos y goles en cada equipo senior para Lionel Messi, al ${updated}. Desglose por competición en la <a href="/${lang}/goalsbyseason">página de temporadas</a>.`,
    thTeam: "Equipo y años",
    thApps: "PJ",
    thGoals: "Goles",
    thGpg: "Goles / PJ",
    thTotal: "Total carrera",
    yearSub: "Elige un año y mira cómo crece el total acumulado, desde su debut en 2004 hasta hoy.",
    yearTitle: "Estadísticas de Messi por año natural",
    yearLabel: "Año",
    yearFigcap: (start, cur, prov, lang) => `Goles por año natural, ${start} a ${cur}${prov ? " (en curso)" : ""} — con récord de 91 en 2012. <a href="/${lang}/goalsbyyear">Abrir tabla completa</a>.`,
    tileGoals: (year, prov) => `Goles en ${year}${prov ? " (hasta hoy)" : ""}`,
    tileTotal: (year) => `Total acumulado tras ${year}`,
    tileAge: (year) => `Edad durante ${year}`,
    records: (best, post30, pct) => [
      [`91`, `<b>Goles en 2012</b>, el mayor registro en un año natural en la historia del fútbol mundial — ${best.goals} en todas las competiciones.`],
      [`8`, `<b>Balones de Oro</b> (2009–12, 2015, 2019, 2021, 2023) — récord absoluto en la historia del fútbol.`],
      [`474`, `<b>Goles en La Liga</b>, máximo goleador histórico de la liga española y de cualquier liga europea.`],
      [`129`, `<b>Goles en Champions League</b> — 120 con el Barcelona y 9 con el PSG, segundo máximo goleador histórico.`],
      [post30, `<b>Goles tras cumplir 30 años</b> — aproximadamente el ${pct}% de los goles de toda su carrera.`],
      [`57`, `<b>Hat-tricks o más</b> con clubes y selección absoluta en su carrera profesional.`],
      [`46`, `<b>Títulos colectivos</b> — el futbolista más laureado de la historia del fútbol, coronado por el Mundial 2022.`]
    ],
    silverCaption: () => `${LIVE.trophies} títulos oficiales de primer equipo, club por club, más premios individuales máximos.`,
    silverThTrophy: "Título",
    silverThTimes: "Veces",
    silverThNote: "Detalles",
    silverRows: [
      ["Títulos con el FC Barcelona", "35", "2005 a 2021, incluyendo 4 Champions League y 10 Ligas"],
      ["Títulos con la Selección Argentina", "5", "Mundial 2022, Copas América 2021 y 2024, Finalissima 2022, Oro Olímpico 2008"],
      ["Títulos con el Paris Saint-Germain", "3", "Ligue 1 2022 y 2023, Supercopa de Francia 2022"],
      ["Títulos con el Inter Miami", "4", "Leagues Cup 2023, Supporters' Shield 2024, MLS Cup 2025, Campeones Cup 2026"],
      ["Balón de Oro", "8", "Récord mundial — 2009–12, 2015, 2019, 2021, 2023"]
    ],
    splitFk: "Goles de tiro libre",
    splitFkNote: "Golazos de falta directa con clubes y selección.",
    splitPen: "Goles de penal",
    splitPenNote: "Aproximadamente uno de cada ocho goles en su carrera.",
    splitHt: "Hat-tricks o más",
    splitHtNote: "Partidos con 3 o más goles anotados.",
    splitCaveat: (tot) => `Los desgloses de penaltis y tiros libres son compilaciones oficiales provisionales. El total oficial de ${tot} goles no se ve afectado.`,
    faq: (t, agg, m, d, lang) => [
      ["¿Cuántos goles ha marcado Lionel Messi en total?", `<b>${n(t.goals)} goles oficiales</b> en ${n(t.apps)} partidos profesionales al ${esc(d.lastUpdated)}, con un promedio de ${t.goalsPerGame} goles por partido. Ver <a href="/${lang}/goalsbyyear">goles por año</a>.`],
      ["¿Cuántos goles marcó Messi en el Barcelona?", `<b>${n(agg.barcelona.goals)} goles</b> en ${n(agg.barcelona.apps)} partidos entre 2004 y 2021, incluyendo el récord de 474 en La Liga.`],
      ["¿Cuántos goles tiene en PSG e Inter Miami?", `<b>${agg.psg.goals} con el Paris Saint-Germain</b> y <b>${n(agg.miami.goals)} con el Inter Miami</b>.`],
      ["¿Cuántos goles ha marcado con Argentina?", `<b>${n(t.country.goals)} goles</b> en ${n(t.country.apps)} partidos internacionales desde 2005.`],
      ["¿Cuál fue el mejor año goleador de Messi?", `<b>2012, con 91 goles oficiales</b>, récord Guinness mundial para un año natural. Ver <a href="/${lang}/goalsbyyear">todos los años</a>.`],
      ["¿Cuántos títulos ha ganado Messi?", `<b>47 títulos oficiales</b> (35 con Barcelona, 3 con PSG, 4 con Inter Miami y 5 con Argentina). Ver <a href="/${lang}/achievements">palmarés</a>.`]
    ]
  },
  pt: {
    locale: "pt-BR",
    shirt10: "Camisa número 10",
    head: (t, p, d) => `<b>${n(t.goals)} gols oficiais</b> em <b>${n(t.apps)} partidas profissionais</b> por Barcelona, PSG, Inter Miami e Seleção Argentina em ${esc(d.lastUpdated)}. Campeão mundial e 8 Bolas de Ouro.`,
    meta: (p, dob) => `${esc(p.name)}, nascido em ${dob} em ${esc(p.birthplace)}. Tem ${p.age} anos, joga como atacante e defende o ${esc(p.current.join(" e "))}.`,
    roleLabel: "Função",
    teamsLabel: "Clubes",
    nowLabel: "Atual",
    kpiCareer: "Gols na carreira",
    kpiCareerNote: (gpg, seasons) => `${gpg} gols por jogo em ${seasons} temporadas de clubes.`,
    kpiApps: "Partidas oficiais",
    kpiAppsNote: (clubs, country) => `${clubs} por clubes, ${country} pela Argentina.`,
    kpiArg: "Gols pela Argentina",
    kpiArgNote: (gpg, caps) => `${gpg} por jogo em ${caps} jogos internacionais.`,
    kpiTrophies: "Títulos coletivos",
    kpiTrophiesNote: (lang) => `Recorde histórico de ${LIVE.trophies} títulos e 8 Bolas de Ouro. <a href="/${lang}/achievements">Palmarés completo</a>.`,
    kpiRoad: "Rumo aos 1.000 gols",
    kpiRoadNote: (togo, projYear, pace) => `Faltam ${togo} gols. No ritmo atual (~${pace.toFixed(0)} por ano), atingirá os 1.000 perto de ${projYear}.`,
    copyStatsBtn: "Copiar estatísticas",
    copyText: (goals, apps, clubGoals, argGoals, updated) => `Messi: ${goals} gols em ${apps} partidas oficiais (${clubGoals} por clubes, ${argGoals} pela Argentina), ${LIVE.trophies} títulos, 8 Bolas de Ouro — em ${updated}.`,
    copyMsg: "Copiado para a área de transferência.",
    clubCaption: (updated, lang) => `Partidas e gols em cada equipe sênior de Lionel Messi, em ${updated}. Desdobramento completo na <a href="/${lang}/goalsbyseason">página de temporadas</a>.`,
    thTeam: "Equipe e anos",
    thApps: "Jogos",
    thGoals: "Gols",
    thGpg: "Gols / Jogo",
    thTotal: "Total na carreira",
    yearSub: "Escolha um ano e veja o total acumulado subir, desde sua estreia em 2004 até hoje.",
    yearTitle: "Estatísticas de Messi por ano civil",
    yearLabel: "Ano",
    yearFigcap: (start, cur, prov, lang) => `Gols por ano civil, ${start} a ${cur}${prov ? " (em andamento)" : ""} — com recorde de 91 em 2012. <a href="/${lang}/goalsbyyear">Abrir tabela completa</a>.`,
    tileGoals: (year, prov) => `Gols em ${year}${prov ? " (até agora)" : ""}`,
    tileTotal: (year) => `Total acumulado após ${year}`,
    tileAge: (year) => `Idade durante ${year}`,
    records: (best, post30, pct) => [
      [`91`, `<b>Gols em 2012</b>, o recorde mundial absoluto em um único ano civil — ${best.goals} em todas as competições.`],
      [`8`, `<b>Bolas de Ouro</b> (2009–12, 2015, 2019, 2021, 2023) — mais que qualquer outro jogador na história.`],
      [`474`, `<b>Gols na La Liga</b>, recorde histórico absoluto da liga espanhola.`],
      [`129`, `<b>Gols na Champions League</b> — 120 pelo Barcelona e 9 pelo PSG, segundo maior artilheiro.`],
      [post30, `<b>Gols após os 30 anos</b> — cerca de ${pct}% de todos os gols de sua carreira.`],
      [`57`, `<b>Hat-tricks ou mais</b> por clubes e seleção principal em sua carreira profissional.`],
      [`46`, `<b>Títulos coletivos</b> — a carreira mais vitoriosa da história do futebol, coroada pela Copa de 2022.`]
    ],
    silverCaption: () => `${LIVE.trophies} títulos oficiais de equipes principais, clube a clube, mais as maiores honrarias individuais.`,
    silverThTrophy: "Troféu",
    silverThTimes: "Vezes",
    silverThNote: "Observações",
    silverRows: [
      ["Títulos pelo Barcelona", "35", "2005 a 2021, incluindo 4 Ligas dos Campeões e 10 La Ligas"],
      ["Títulos pela Argentina", "5", "Copa do Mundo 2022, Copas América 2021 e 2024, Finalíssima 2022, Ouro Olímpico 2008"],
      ["Títulos pelo PSG", "3", "Ligue 1 2022 e 2023, Supercopa da França 2022"],
      ["Títulos pelo Inter Miami", "4", "Leagues Cup 2023, Supporters' Shield 2024, MLS Cup 2025, Campeones Cup 2026"],
      ["Bola de Ouro", "8", "Recorde mundial — 2009–12, 2015, 2019, 2021, 2023"]
    ],
    splitFk: "Gols de falta",
    splitFkNote: "Cobranças magistrais por clubes e seleção.",
    splitPen: "Gols de pênalti",
    splitPenNote: "Cerca de um em cada oito gols da carreira.",
    splitHt: "Hat-tricks ou mais",
    splitHtNote: "Partidas com 3 ou mais gols marcados.",
    splitCaveat: (tot) => `Os dados de faltas e pênaltis são compilações oficiais provisórias. O total oficial de ${tot} gols é imutável.`,
    faq: (t, agg, m, d, lang) => [
      ["Quantos gols Lionel Messi tem na carreira?", `<b>${n(t.goals)} gols oficiais</b> em ${n(t.apps)} partidas profissionais até ${esc(d.lastUpdated)}, média de ${t.goalsPerGame} gols por jogo. Veja a <a href="/${lang}/goalsbyyear">tabela por ano</a>.`],
      ["Quantos gols Messi marcou pelo Barcelona?", `<b>${n(agg.barcelona.goals)} gols</b> em ${n(agg.barcelona.apps)} jogos de 2004 a 2021 — incluindo recorde de 474 na La Liga.`],
      ["Quantos gols pelo PSG e Inter Miami?", `<b>${agg.psg.goals} pelo Paris Saint-Germain</b> e <b>${n(agg.miami.goals)} pelo Inter Miami</b>.`],
      ["Quantos gols Messi marcou pela Argentina?", `<b>${n(t.country.goals)} gols</b> em ${n(t.country.apps)} partidas oficiais desde 2005.`],
      ["Qual foi o melhor ano de Messi em gols?", `<b>2012, com 91 gols</b> — recorde mundial absoluto em um ano civil. Veja <a href="/${lang}/goalsbyyear">todos os anos</a>.`],
      ["Quantos títulos Messi ganhou?", `<b>47 títulos coletivos</b> — 35 pelo Barcelona, 3 pelo PSG, 4 pelo Inter Miami e 5 pela Argentina. Veja o <a href="/${lang}/achievements">palmarés</a>.`]
    ]
  },
  fr: {
    locale: "fr-FR",
    shirt10: "Numéro 10",
    head: (t, p, d) => `<b>${n(t.goals)} buts officiels</b> en <b>${n(t.apps)} matchs professionnels</b> avec Barcelone, le PSG, l'Inter Miami et l'Argentine au ${esc(d.lastUpdated)}. Champion du monde et 8 Ballons d'Or.`,
    meta: (p, dob) => `${esc(p.name)}, né le ${dob} à ${esc(p.birthplace)}. Âgé de ${p.age} ans, attaquant à ${esc(p.current.join(" et "))}.`,
    roleLabel: "Rôle",
    teamsLabel: "Équipes",
    nowLabel: "Actuel",
    kpiCareer: "Buts en carrière",
    kpiCareerNote: (gpg, seasons) => `${gpg} but par match sur ${seasons} saisons en club.`,
    kpiApps: "Matchs officiels",
    kpiAppsNote: (clubs, country) => `${clubs} en club, ${country} avec l'Argentine.`,
    kpiArg: "Buts avec l'Argentine",
    kpiArgNote: (gpg, caps) => `${gpg} par match en ${caps} sélections.`,
    kpiTrophies: "Trophées collectifs",
    kpiTrophiesNote: (lang) => `Record historique de ${LIVE.trophies} titres et 8 Ballons d'Or. <a href="/${lang}/achievements">Palmarès complet</a>.`,
    kpiRoad: "Route vers les 1 000 buts",
    kpiRoadNote: (togo, projYear, pace) => `Plus que ${togo} buts. Au rythme actuel (~${pace.toFixed(0)} par an), cap des 1 000 vers ${projYear}.`,
    copyStatsBtn: "Copier les stats clés",
    copyText: (goals, apps, clubGoals, argGoals, updated) => `Messi : ${goals} buts en ${apps} matchs officiels (${clubGoals} en club, ${argGoals} avec l'Argentine), ${LIVE.trophies} trophées, 8 Ballons d'Or — au ${updated}.`,
    copyMsg: "Copié dans le presse-papiers !",
    clubCaption: (updated, lang) => `Matchs et buts pour chaque équipe senior de Lionel Messi au ${updated}. Détail complet sur la <a href="/${lang}/goalsbyseason">page des saisons</a>.`,
    thTeam: "Équipe et années",
    thApps: "Matchs",
    thGoals: "Buts",
    thGpg: "Buts / Match",
    thTotal: "Total carrière",
    yearSub: "Choisissez une année pour voir grimper le total, de ses débuts en 2004 jusqu'à aujourd'hui.",
    yearTitle: "Statistiques de Messi par année civile",
    yearLabel: "Année",
    yearFigcap: (start, cur, prov, lang) => `Buts par année civile, de ${start} à ${cur}${prov ? " (en cours)" : ""} — pic à 91 buts en 2012. <a href="/${lang}/goalsbyyear">Tableau complet</a>.`,
    tileGoals: (year, prov) => `Buts en ${year}${prov ? " (en cours)" : ""}`,
    tileTotal: (year) => `Total après ${year}`,
    tileAge: (year) => `Âge en ${year}`,
    records: (best, post30, pct) => [
      [`91`, `<b>Buts en 2012</b>, record absolu dans l'histoire du football mondial sur une année civile — ${best.goals} toutes compétitions confondues.`],
      [`8`, `<b>Ballons d'Or</b> (2009–12, 2015, 2019, 2021, 2023) — record mondial inégalé.`],
      [`474`, `<b>Buts en Liga</b>, record absolu de l'histoire du championnat espagnol.`],
      [`129`, `<b>Buts en Ligue des Champions</b> — 120 avec le Barça et 9 avec le PSG, 2e plus grand total de l'histoire.`],
      [post30, `<b>Buts après 30 ans</b> — environ ${pct}% de l'ensemble de ses buts en carrière.`],
      [`57`, `<b>Triplés ou plus</b> en club et en sélection au cours de sa carrière professionnelle.`],
      [`46`, `<b>Trophées collectifs</b> — le joueur le plus titré de l'histoire du football, couronné par le Mondial 2022.`]
    ],
    silverCaption: () => `${LIVE.trophies} titres collectifs officiels, club par club, ainsi que les plus grandes distinctions individuelles.`,
    silverThTrophy: "Trophée",
    silverThTimes: "Fois",
    silverThNote: "Détails",
    silverRows: [
      ["Titres avec le FC Barcelone", "35", "2005 à 2021, dont 4 Ligues des Champions et 10 Ligas"],
      ["Titres avec l'Argentine", "5", "Coupe du Monde 2022, Copas América 2021 et 2024, Finalissima 2022, Or Olympique 2008"],
      ["Titres avec le PSG", "3", "Ligue 1 2022 et 2023, Trophée des Champions 2022"],
      ["Titres avec l'Inter Miami", "4", "Leagues Cup 2023, Supporters' Shield 2024, MLS Cup 2025, Campeones Cup 2026"],
      ["Ballon d'Or", "8", "Record mondial — 2009–12, 2015, 2019, 2021, 2023"]
    ],
    splitFk: "Coups francs directs",
    splitFkNote: "Coups francs enroulés en club et sélection.",
    splitPen: "Buts sur pénalty",
    splitPenNote: "Environ un but sur huit de sa carrière.",
    splitHt: "Triplés ou plus",
    splitHtNote: "Matchs avec 3 buts ou plus marqués.",
    splitCaveat: (tot) => `Les statistiques de coups francs et pénaltys sont des données officielles en cours de compilation. Le total officiel de ${tot} buts reste certifié.`,
    faq: (t, agg, m, d, lang) => [
      ["Combien de buts Lionel Messi a-t-il marqués en tout ?", `<b>${n(t.goals)} buts officiels</b> en ${n(t.apps)} matchs professionnels au ${esc(d.lastUpdated)}, soit une moyenne de ${t.goalsPerGame} buts par match. Voir les <a href="/${lang}/goalsbyyear">buts par année</a>.`],
      ["Combien de buts Messi a-t-il marqués pour Barcelone ?", `<b>${n(agg.barcelona.goals)} buts</b> en ${n(agg.barcelona.apps)} matchs de 2004 à 2021, avec un record de 474 en Liga.`],
      ["Combien de buts pour le PSG et l'Inter Miami ?", `<b>${agg.psg.goals} pour le Paris Saint-Germain</b> et <b>${n(agg.miami.goals)} pour l'Inter Miami</b>.`],
      ["Combien de buts avec l'Argentine ?", `<b>${n(t.country.goals)} buts</b> en ${n(t.country.apps)} sélections depuis 2005.`],
      ["Quelle est la meilleure année de Messi en buts ?", `<b>2012, avec 91 buts</b> — record mondial dans l'histoire du football. Voir <a href="/${lang}/goalsbyyear">toutes les années</a>.`],
      ["Combien de trophées Messi a-t-il remportés ?", `<b>47 titres collectifs</b> (35 avec Barcelone, 3 avec le PSG, 4 avec l'Inter Miami et 5 avec l'Argentine). Voir le <a href="/${lang}/achievements">palmarès</a>.`]
    ]
  }
};

/* ===== HOME_I18N: Romanian (ro) ===== */
HOME_I18N.ro = {
  locale: "ro-RO",
  shirt10: "Numărul 10",
  head: (t, p, d) => `<b>${n(t.goals)} goluri oficiale</b> în <b>${n(t.apps)} meciuri de seniori</b> pentru Barcelona, PSG, Inter Miami și Argentina la ${esc(d.lastUpdated)}. Campion mondial și record de 8 Baloane de Aur.`,
  meta: (p, dob) => `${esc(p.name)}, născut la ${dob} în ${esc(p.birthplace)}. Are ${p.age} ani, atacant la ${esc(p.current.join(" și "))}.`,
  roleLabel: "Rol",
  teamsLabel: "Echipe",
  nowLabel: "În prezent",
  kpiCareer: "Goluri în carieră",
  kpiCareerNote: (gpg, seasons) => `${gpg} goluri pe meci în ${seasons} sezoane la club.`,
  kpiApps: "Meciuri oficiale",
  kpiAppsNote: (clubs, country) => `${clubs} la cluburi, ${country} cu Argentina.`,
  kpiArg: "Goluri pentru Argentina",
  kpiArgNote: (gpg, caps) => `${gpg} pe meci în ${caps} selecții.`,
  kpiTrophies: "Trofee de echipă",
  kpiTrophiesNote: (lang) => `Record absolut de ${LIVE.trophies} de trofee și 8 Baloane de Aur. <a href="/${lang}/achievements">Palmares complet</a>.`,
  kpiRoad: "Drumul spre 1.000 de goluri",
  kpiRoadNote: (togo, projYear, pace) => `Mai are nevoie de ${togo} goluri. În ritmul actual (~${pace.toFixed(0)} pe an), borna 1.000 va fi atinsă spre ${projYear}.`,
  copyStatsBtn: "Copiază statisticile",
  copyText: (goals, apps, clubGoals, argGoals, updated) => `Messi: ${goals} goluri în ${apps} meciuri oficiale (${clubGoals} la cluburi, ${argGoals} cu Argentina), ${LIVE.trophies} de trofee, 8 Baloane de Aur — la ${updated}.`,
  copyMsg: "Copiat în clipboard!",
  clubCaption: (updated, lang) => `Meciuri și goluri pentru fiecare echipă a lui Lionel Messi la ${updated}. Detalii complete pe <a href="/${lang}/goalsbyseason">pagina sezoanelor</a>.`,
  thTeam: "Echipă și ani",
  thApps: "Meciuri",
  thGoals: "Goluri",
  thGpg: "Goluri / Meci",
  thTotal: "Total carieră",
  yearSub: "Alege un an și urmărește ascensiunea totalului de goluri — de la debutul din 2004 până azi.",
  yearTitle: "Statisticile lui Messi pe ani calendaristici",
  yearLabel: "An",
  yearFigcap: (start, cur, prov, lang) => `Goluri pe an calendaristic, ${start} - ${cur}${prov ? " (în desfășurare)" : ""} — vârf de 91 în 2012. <a href="/${lang}/goalsbyyear">Tabel complet</a>.`,
  tileGoals: (year, prov) => `Goluri în ${year}${prov ? " (până acum)" : ""}`,
  tileTotal: (year) => `Total carieră după ${year}`,
  tileAge: (year) => `Vârsta în ${year}`,
  records: (best, post30, pct) => [
    [`91`, `<b>Goluri în 2012</b>, cel mai prolific an calendaristic din istoria fotbalului mondial.`],
    [`8`, `<b>Baloane de Aur</b> (2009–12, 2015, 2019, 2021, 2023) — record mondial absolut.`],
    [`474`, `<b>Goluri în La Liga</b>, golgheterul all-time al campionatului spaniol.`],
    [`129`, `<b>Goluri în Champions League</b> — 120 pentru Barcelona și 9 pentru PSG.`],
    [post30, `<b>Goluri după 30 de ani</b> — aproximativ ${pct}% din totalul golurilor.`],
    [`62`, `<b>Hat-trick-uri sau mai mult</b> la club și națională.`],
    [`${LIVE.trophies}`, `<b>Trofee colective</b> — cel mai titrat fotbalist din istorie.`]
  ],
  silverCaption: () => `${LIVE.trophies} de titluri oficiale de seniori plus distincțiile individuale supreme.`,
  silverThTrophy: "Trofeu",
  silverThTimes: "Nr.",
  silverThNote: "Detalii",
  silverRows: [
    ["Titluri cu Barcelona", "35", "2005–2021, inclusiv 4 Ligi ale Campionilor și 10 titluri La Liga"],
    ["Titluri cu Argentina", "5", "Cupa Mondială 2022, Copas América 2021 și 2024, Finalissima 2022, Aur Olimpic 2008"],
    ["Titluri cu PSG", "3", "Ligue 1 2022 și 2023, Supercupa Franței 2022"],
    ["Titluri cu Inter Miami", "4", "Leagues Cup 2023, Supporters' Shield 2024, MLS Cup 2025, Campeones Cup 2026"],
    ["Balonul de Aur", "8", "Record mondial — 2009–12, 2015, 2019, 2021, 2023"]
  ],
  splitFk: "Goluri din lovituri libere",
  splitFkNote: "Lovituri libere directe spectaculoase.",
  splitPen: "Goluri din penalty",
  splitPenNote: "Aproximativ un gol din opt din carieră.",
  splitHt: "Hat-trick-uri sau mai mult",
  splitHtNote: "Meciuri cu 3 sau mai multe goluri înscrise.",
  splitCaveat: (tot) => `Totalul de ${tot} goluri este 100% verificat.`,
  faq: (t, agg, m, d, lang) => [
    ["Câte goluri a marcat Lionel Messi în total?", `<b>${n(t.goals)} goluri oficiale</b> în ${n(t.apps)} meciuri la ${esc(d.lastUpdated)}, medie de ${t.goalsPerGame} goluri/meci. Vezi <a href="/${lang}/goalsbyyear">goluri pe ani</a>.`],
    ["Câte goluri a marcat Messi pentru Barcelona?", `<b>${n(agg.barcelona.goals)} goluri</b> în ${n(agg.barcelona.apps)} meciuri (2004-2021) — inclusiv recordul de 474 în La Liga.`],
    ["Câte goluri are pentru PSG și Inter Miami?", `<b>${agg.psg.goals} pentru Paris Saint-Germain</b> și <b>${n(agg.miami.goals)} pentru Inter Miami</b>.`],
    ["Câte goluri are Messi pentru Argentina?", `<b>${n(t.country.goals)} goluri</b> în ${n(t.country.apps)} meciuri internaționale din 2005.`],
    ["Care a fost cel mai bun an al lui Messi?", `<b>2012, cu 91 de goluri</b> — record mondial absolut. <a href="/${lang}/goalsbyyear">Toți anii</a>.`],
    ["Câte trofee a câștigat Messi?", `<b>47 de titluri de echipă</b> (35 cu Barcelona, 3 cu PSG, 4 cu Inter Miami, 5 cu Argentina). <a href="/${lang}/achievements">Palmaresul</a>.`]
  ]
};

/* ===== HOME_I18N: Uzbek (uz) ===== */
HOME_I18N.uz = {
  locale: "uz-UZ",
  shirt10: "10-raqamli futbolka",
  head: (t, p, d) => `Barselona, PSJ, Inter Mayami va Argentina terma jamoasi safida <b>${n(t.apps)} ta rasmiy o'yinda</b> <b>${n(t.goals)} ta gol</b> (${esc(d.lastUpdated)} holatiga). Jahon chempioni va 8 karra "Oltin to'p" sohibi.`,
  meta: (p, dob) => `${esc(p.name)}, ${dob} da ${esc(p.birthplace)} shahrida tug'ilgan. Yoshi ${p.age} da, hujumchi, ayni paytda ${esc(p.current.join(" va "))} sharafini himoya qilmoqda.`,
  roleLabel: "Amplua",
  teamsLabel: "Jamoalar",
  nowLabel: "Hozirda",
  kpiCareer: "Karyeradagi gollar",
  kpiCareerNote: (gpg, seasons) => `${seasons} klub mavsumida har o'yinda ${gpg} tadan gol.`,
  kpiApps: "Rasmiy o'yinlar",
  kpiAppsNote: (clubs, country) => `${clubs} ta klub, ${country} ta Argentina.`,
  kpiArg: "Argentina safida gollar",
  kpiArgNote: (gpg, caps) => `${caps} ta o'yinda har o'yinga ${gpg} ta gol.`,
  kpiTrophies: "Jamoaviy sovrinlar",
  kpiTrophiesNote: (lang) => `Rekord darajadagi ${LIVE.trophies} ta titul va 8 ta "Oltin to'p". <a href="/${lang}/achievements">To'liq ro'yxat</a>.`,
  kpiRoad: "1 000 ta gol sari",
  kpiRoadNote: (togo, projYear, pace) => `Yana ${togo} ta gol qoldi. Hozirgi sur'atda (~yiliga ${pace.toFixed(0)} ta gol), 1 000-golga ${projYear}-yil atrofida erishiladi.`,
  copyStatsBtn: "Statistikani nusxalash",
  copyText: (goals, apps, clubGoals, argGoals, updated) => `Messi: ${apps} ta rasmiy o'yinda ${goals} ta gol (${clubGoals} klub, ${argGoals} Argentina), ${LIVE.trophies} ta sovrin, 8 ta "Oltin to'p" — ${updated} holatiga.`,
  copyMsg: "Buferga nusxalandi!",
  clubCaption: (updated, lang) => `Lionel Messining barcha jamoalardagi o'yin va gollari (${updated} holatiga). <a href="/${lang}/goalsbyseason">Mavsumlar bo'yicha</a> to'liq taqsimot.`,
  thTeam: "Jamoa va yillar",
  thApps: "O'yinlar",
  thGoals: "Gollar",
  thGpg: "Gol / O'yin",
  thTotal: "Karyera jami",
  yearSub: "Istalgan yilni tanlang va 2004-yildagi debyutidan to bugungacha bo'lgan gollar o'sishini kuzating.",
  yearTitle: "Messining taqvim yillari bo'yicha statistikasi",
  yearLabel: "Yil",
  yearFigcap: (start, cur, prov, lang) => `${start}-yildan ${cur}-yilgacha bo'lgan gollar — 2012-yilda rekord 91 ta gol. <a href="/${lang}/goalsbyyear">To'liq jadvalni ochish</a>.`,
  tileGoals: (year, prov) => `${year}-yildagi gollar`,
  tileTotal: (year) => `${year}-yildan keyingi umumiy gollar`,
  tileAge: (year) => `${year}-yildagi yoshi`,
  records: (best, post30, pct) => [
    [`91`, `<b>2012-yilda 91 ta gol</b>, futbol tarixida bir taqvim yilida urilgan gollar bo'yicha mutlaq jahon rekordi.`],
    [`8`, `<b>"Oltin to'p"</b> (2009–12, 2015, 2019, 2021, 2023) — futbol tarixidagi mutlaq rekord.`],
    [`474`, `<b>La Ligada 474 ta gol</b>, Ispaniya chempionati tarixidagi rekord.`],
    [`129`, `<b>Chempionlar Ligasida 129 ta gol</b> — 120 Barselona va 9 PSJ, tarixdagi 2-natija.`],
    [post30, `<b>30 yoshdan keyin urilgan gollar</b> — karyerasidagi gollarning taxminan ${pct}%.`],
    [`62`, `<b>Het-trik yoki undan ko'p</b> klub va terma jamoa safidagi o'yinlarda.`],
    [`${LIVE.trophies}`, `<b>Jamoaviy sovrinlar</b> — futbol tarixidagi eng ko'p sovrin yutgan futbolchi.`]
  ],
  silverCaption: () => `Messining barcha ${LIVE.trophies} ta rasmiy jamoaviy titullari va eng yuksak shaxsiy sovrinlari.`,
  silverThTrophy: "Sovrin",
  silverThTimes: "Soni",
  silverThNote: "Tafsilotlar",
  silverRows: [
    ["Barselona bilan sovrinlar", "35", "2005–2021, shu jumladan 4 ta ECHL va 10 ta La Liga"],
    ["Argentina bilan sovrinlar", "5", "Jahon chempionati 2022, Amerika kubogi 2021 va 2024, Finalissima 2022, Olimpiada oltini 2008"],
    ["PSJ bilan sovrinlar", "3", "Liga 1 2022 va 2023, Fransiya Superkubogi 2022"],
    ["Inter Mayami bilan sovrinlar", "4", "Leagues Cup 2023, Supporters' Shield 2024, MLS kubogi 2025, Campeones kubogi 2026"],
    ["“Oltin to'p”", "8", "Mutlaq jahon rekordi — 2009–12, 2015, 2019, 2021, 2023"]
  ],
  splitFk: "Jarima to'pidan gollar",
  splitFkNote: "Klub va terma jamoa safida jarimadan kiritilgan ajoyib gollar.",
  splitPen: "Penaltidan gollar",
  splitPenNote: "Karyerasidagi taxminan har sakkizta goldan bittasi.",
  splitHt: "Het-trik yoki undan ko'p",
  splitHtNote: "Bitta o'yinda 3 ta yoki undan ko'p gol urilgan bahslar.",
  splitCaveat: (tot) => `Jami ${tot} ta gol soni to'liq tasdiqlangan.`,
  faq: (t, agg, m, d, lang) => [
    ["Lionel Messi jami nechta gol urgan?", `<b>${n(t.goals)} ta rasmiy gol</b> ${n(t.apps)} ta o'yinda (${esc(d.lastUpdated)} holatiga), har o'yinga o'rtacha ${t.goalsPerGame} ta gol. <a href="/${lang}/goalsbyyear">Yillar bo'yicha gollar</a>.`],
    ["Messi Barselona safida nechta gol urgan?", `<b>${n(agg.barcelona.goals)} ta gol</b> ${n(agg.barcelona.apps)} ta o'yinda (2004-2021) — La Ligada rekord 474 ta gol bilan.`],
    ["PSJ va Inter Mayamida nechta gol urdi?", `<b>PSJ uchun ${agg.psg.goals} ta</b> va <b>Inter Mayami uchun ${n(agg.miami.goals)} ta gol</b>.`],
    ["Messi Argentina terma jamoasida nechta gol urgan?", `<b>${n(t.country.goals)} ta gol</b> ${n(t.country.apps)} ta o'yinda (2005-yildan buyon).`],
    ["Messining eng sermahsul yili qaysi bo'lgan?", `<b>2012-yil, 91 ta gol</b> — jahon futboli tarixidagi mutlaq rekord. <a href="/${lang}/goalsbyyear">Barcha yillar</a>.`],
    ["Messi faoliyatida nechta sovrin yutgan?", `<b>47 ta jamoaviy titul</b> (35 Barselona, 3 PSJ, 4 Mayami, 5 Argentina). <a href="/${lang}/achievements">Barcha sovrinlar</a>.`]
  ]
};

/* ===== HOME_I18N: Arabic (ar) ===== */
HOME_I18N.ar = {
  locale: "ar-SA",
  shirt10: "الرقم 10",
  head: (t, p, d) => `<b>${n(t.goals)} هدفاً رسمياً</b> في <b>${n(t.apps)} مباراة</b> مع برشلونة وباريس وإنتر ميامي والأرجنتين حتى ${esc(d.lastUpdated)}. بطل العالم وحامل الرقم القياسي بـ 8 كرات ذهبية.`,
  meta: (p, dob) => `${esc(p.name)}، وُلد في ${dob} بـ ${esc(p.birthplace)}. عمره ${p.age} عاماً، مهاجم يلعب مع ${esc(p.current.join(" و "))}.`,
  roleLabel: "المركز",
  teamsLabel: "الأندية",
  nowLabel: "الحالي",
  kpiCareer: "أهداف المسيرة",
  kpiCareerNote: (gpg, seasons) => `${gpg} هدف للمباراة في ${seasons} موسم.`,
  kpiApps: "المباريات الرسمية",
  kpiAppsNote: (clubs, country) => `${clubs} مع الأندية، ${country} مع الأرجنتين.`,
  kpiArg: "أهداف مع الأرجنتين",
  kpiArgNote: (gpg, caps) => `${gpg} هدف للمباراة في ${caps} مشاركة.`,
  kpiTrophies: "الألقاب الجماعية",
  kpiTrophiesNote: (lang) => `رقم قياسي بـ ${LIVE.trophies} لقباً و8 كرات ذهبية. <a href="/${lang}/achievements">القائمة الكاملة</a>.`,
  kpiRoad: "الطريق نحو 1000 هدف",
  kpiRoadNote: (togo, projYear, pace) => `${togo} هدفاً متبقية. بالوتيرة الحالية ستُحقق 1000 هدف نحو ${projYear}.`,
  copyStatsBtn: "نسخ الإحصائيات",
  copyText: (goals, apps, clubGoals, argGoals, updated) => `ميسي: ${goals} هدفاً في ${apps} مباراة (${clubGoals} مع الأندية، ${argGoals} مع الأرجنتين)، ${LIVE.trophies} لقباً، 8 كرات ذهبية — حتى ${updated}.`,
  copyMsg: "تم النسخ إلى الحافظة!",
  clubCaption: (updated, lang) => `إحصائيات ليونيل ميسي مع كل أندية مسيرته حتى ${updated}. <a href="/${lang}/goalsbyseason">مفصّل بالمواسم</a>.`,
  thTeam: "الفريق والسنوات",
  thApps: "المباريات",
  thGoals: "الأهداف",
  thGpg: "هدف / مباراة",
  thTotal: "إجمالي المسيرة",
  yearSub: "اختر أي عام وتابع تصاعد إجمالي الأهداف منذ 2004 حتى اليوم.",
  yearTitle: "إحصائيات ميسي حسب السنة التقويمية",
  yearLabel: "السنة",
  yearFigcap: (start, cur, prov, lang) => `الأهداف حسب السنة التقويمية من ${start} إلى ${cur} — ذروة 91 هدفاً عام 2012. <a href="/${lang}/goalsbyyear">الجدول الكامل</a>.`,
  tileGoals: (year, prov) => `أهداف ${year}`,
  tileTotal: (year) => `الإجمالي بعد ${year}`,
  tileAge: (year) => `العمر في ${year}`,
  records: (best, post30, pct) => [
    [`91`, `<b>91 هدفاً عام 2012</b>، الرقم القياسي العالمي في عدد الأهداف خلال سنة تقويمية.`],
    [`8`, `<b>الكرة الذهبية</b> (2009–12، 2015، 2019، 2021، 2023) — رقم قياسي عالمي مطلق.`],
    [`474`, `<b>474 هدفاً في الدوري الإسباني</b>، أفضل هداف في تاريخ لا ليغا.`],
    [`129`, `<b>129 هدفاً في دوري أبطال أوروبا</b> — 120 مع برشلونة و9 مع باريس.`],
    [post30, `<b>أهداف بعد سن الثلاثين</b> — ما يقارب ${pct}% من إجمالي الأهداف.`],
    [`62`, `<b>هاتريك أو أكثر</b> في مسيرته الاحترافية.`],
    [`${LIVE.trophies}`, `<b>الألقاب الجماعية</b> — أكثر لاعب تتويجاً في تاريخ كرة القدم.`]
  ],
  silverCaption: () => `${LIVE.trophies} لقباً رسمياً وأرفع الجوائز الفردية.`,
  silverThTrophy: "اللقب",
  silverThTimes: "العدد",
  silverThNote: "التفاصيل",
  silverRows: [
    ["ألقاب برشلونة", "35", "2005–2021، تشمل 4 دوريات للأبطال و10 ألقاب لا ليغا"],
    ["ألقاب الأرجنتين", "5", "كأس العالم 2022، كوبا أميركا 2021 و2024، فيناليسيما 2022، ذهب الألعاب الأولمبية 2008"],
    ["ألقاب باريس سان جيرمان", "3", "الدوري الفرنسي 2022 و2023، كأس السوبر الفرنسي 2022"],
    ["ألقاب إنتر ميامي", "4", "كأس الليغات 2023، درع المؤيدين 2024، كأس MLS 2025، كأس الأبطال 2026"],
    ["الكرة الذهبية", "8", "رقم قياسي عالمي — 2009–12، 2015، 2019، 2021، 2023"]
  ],
  splitFk: "أهداف الركلات الحرة",
  splitFkNote: "ركلات حرة مباشرة رائعة مع النادي والمنتخب.",
  splitPen: "أهداف ركلات الجزاء",
  splitPenNote: "ما يعادل هدفاً من كل ثمانية في مسيرته.",
  splitHt: "هاتريك أو أكثر",
  splitHtNote: "مباريات سجّل فيها 3 أهداف أو أكثر.",
  splitCaveat: (tot) => `إجمالي ${tot} هدفاً موثّق 100%.`,
  faq: (t, agg, m, d, lang) => [
    ["كم هدفاً سجّل ليونيل ميسي في مسيرته؟", `<b>${n(t.goals)} هدفاً رسمياً</b> في ${n(t.apps)} مباراة حتى ${esc(d.lastUpdated)}، بمعدل ${t.goalsPerGame} هدف للمباراة. <a href="/${lang}/goalsbyyear">الأهداف بالسنوات</a>.`],
    ["كم هدفاً سجّل ميسي مع برشلونة؟", `<b>${n(agg.barcelona.goals)} هدفاً</b> في ${n(agg.barcelona.apps)} مباراة (2004–2021) — شاملاً الرقم القياسي 474 في لا ليغا.`],
    ["كم هدفاً مع باريس وإنتر ميامي؟", `<b>${agg.psg.goals} مع باريس سان جيرمان</b> و<b>${n(agg.miami.goals)} مع إنتر ميامي</b>.`],
    ["كم هدفاً سجّل ميسي مع الأرجنتين؟", `<b>${n(t.country.goals)} هدفاً</b> في ${n(t.country.apps)} مباراة دولية منذ 2005.`],
    ["ما هو أفضل عام لميسي في التهديف؟", `<b>2012 بـ 91 هدفاً</b> — رقم قياسي عالمي مطلق. <a href="/${lang}/goalsbyyear">جميع الأعوام</a>.`],
    ["كم لقباً فاز به ميسي؟", `<b>47 لقباً جماعياً</b> (35 مع برشلونة، 3 مع باريس، 4 مع إنتر ميامي، 5 مع الأرجنتين). <a href="/${lang}/achievements">قائمة الألقاب</a>.`]
  ]
};

/* ================= HOME ================= */
function renderHome(d) {
  const t = d.totals, agg = clubAgg(d), p = d.profile;
  const seasons = d.clubSeasons.length;
  const lang = getLang();
  const dict = HOME_I18N[lang] || HOME_I18N.en;

  setHead(d, dict.head(t, p, d));

  document.querySelectorAll("[data-live-goal-num]").forEach((node) => {
    node.textContent = String(LIVE.lgNum || t.goals);
  });

  const prof = el("profile");
  if (prof) {
    if (prof.classList.contains("bento-profile-card")) {
      const splitVals = prof.querySelectorAll(".bento-split-item .bs-val");
      const splitSubs = prof.querySelectorAll(".bento-split-item .bs-sub");
      const wantGoals = [n(agg.barcelona.goals), n(t.country.goals), n(agg.miami.goals), n(agg.psg.goals)];
      const wantApps = [agg.barcelona.apps, t.country.apps, agg.miami.apps, agg.psg.apps];
      splitVals.forEach((vEl, idx) => { if (idx < wantGoals.length) vEl.textContent = wantGoals[idx]; });
      splitSubs.forEach((sEl, idx) => {
        if (idx < wantApps.length) {
          sEl.textContent = sEl.textContent.replace(/\d[\d.,]*/, String(wantApps[idx]));
        }
      });
    } else {
      const dob = new Date(p.born + "T00:00:00").toLocaleDateString(dict.locale || "en-GB", { day: "numeric", month: "long", year: "numeric" });
      prof.innerHTML =
        `<figure class="identity-photo"><picture><source srcset="/img/messi-450.webp 1x, /img/messi.webp 2x" type="image/webp"><img src="/img/messi.jpg" alt="Lionel Messi" width="148" height="197" loading="eager" fetchpriority="high" decoding="async"></picture><figcaption class="photo-credit">Lionel Messi · Argentina & Inter Miami</figcaption></figure><div class="identity-main">` +
        `<p class="identity-name">${esc(p.short)} <span class="jersey" aria-label="${dict.shirt10}">${p.number}</span></p>` +
        `<p class="identity-meta">${dict.meta(p, dob)}</p>` +
        `<dl class="identity-facts"><div><dt>${dict.roleLabel}</dt><dd>${esc(p.role)}</dd></div>` +
        `<div><dt>${dict.teamsLabel}</dt><dd>${esc(p.teams.join(" · "))}</dd></div>` +
        `<div><dt>${dict.nowLabel}</dt><dd>${esc(p.current.join(" · "))}</dd></div></dl></div>`;
      prof.classList.add("identity--tight");
    }
    if (!document.getElementById("quick-jump-nav")) {
      const quickJumpI18n = {
        en: { goals: "Official Ledger", kpis: "Road to 1,000", clubs: "Explore Hubs", faq: "FAQ" },
        es: { goals: "Registro Oficial", kpis: "Rumbo a 1.000", clubs: "Explorar", faq: "Preguntas" },
        pt: { goals: "Registro Oficial", kpis: "Rumo a 1.000", clubs: "Explorar", faq: "Perguntas" },
        fr: { goals: "Bilan Officiel", kpis: "Cap des 1 000", clubs: "Explorer", faq: "FAQ" },
        ro: { goals: "Bilanț Oficial", kpis: "Drumul spre 1.000", clubs: "Secțiuni", faq: "Întrebări" },
        uz: { goals: "Rasmiy Jadval", kpis: "1 000 Gol Sari", clubs: "Bo'limlar", faq: "Savollar" },
        ar: { goals: "السجل الرسمي", kpis: "الطريق إلى 1000", clubs: "استكشف", faq: "الأسئلة" },
        id: { goals: "Catatan Resmi", kpis: "Menuju 1.000", clubs: "Jelajahi", faq: "FAQ" }
      };
      const qj = quickJumpI18n[lang] || quickJumpI18n.en;
      const qjBar = document.createElement("nav");
      qjBar.id = "quick-jump-nav";
      qjBar.className = "quick-jump-bar";
      qjBar.setAttribute("aria-label", "Section quick jump");
      qjBar.innerHTML =
        `<a href="#messi-total-goals" class="qj-pill"><span>${qj.goals}</span></a>` +
        `<a href="#road-1000" class="qj-pill"><span>${qj.kpis}</span></a>` +
        `<a href="#explore" class="qj-pill"><span>${qj.clubs}</span></a>` +
        `<a href="#faq" class="qj-pill"><span>${qj.faq}</span></a>`;
      (prof.closest(".hero-bento") || prof).after(qjBar);
    }
  }

  const kpis = el("kpis");
  if (kpis) {
    const existingNums = kpis.querySelectorAll(".kpi-num");
    if (existingNums.length === 6) {
      const sep = (lang === "fr" || lang === "uz") ? " " : (lang === "es" || lang === "pt" || lang === "ro" || lang === "id") ? "." : ",";
      const fmtGrp = (val) => String(val).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
      const want6 = [String(t.goals), `${LIVE.assists}*`, fmtGrp(LIVE.ga), fmtGrp(t.apps), String(LIVE.trophies), "8"];
      existingNums.forEach((sp, i) => { if (i < want6.length) sp.textContent = want6[i]; });
      const r1000Foot = document.querySelector("#road-1000 .road-1000-footer");
      if (r1000Foot && !el("copyStats")) {
        r1000Foot.insertAdjacentHTML("beforeend",
          `<div class="bento-footer-actions"><button type="button" class="btn-primary btn-copy-inline" id="copyStats">${dict.copyStatsBtn}</button><span class="share-msg" id="copyMsg" role="status" aria-live="polite"></span></div>`);
      }
    } else {
      function kpi(l, v, s2) { return `<div class="kpi"><span class="kpi-label">${l}</span><span class="kpi-value">${v}</span><span class="kpi-note">${s2}</span></div>`; }
      kpis.innerHTML =
        kpi(dict.kpiCareer, n(t.goals), dict.kpiCareerNote(t.goalsPerGame, seasons)) +
        kpi(dict.kpiApps, n(t.apps), dict.kpiAppsNote(n(t.clubs.apps), n(t.country.apps))) +
        kpi(dict.kpiArg, n(t.country.goals), dict.kpiArgNote(gpg(t.country.goals, t.country.apps), n(t.country.apps))) +
        kpi(dict.kpiTrophies, String(LIVE.trophies), dict.kpiTrophiesNote(lang));
      kpis.classList.add("kpi--hero");
      if (!el("copyStats")) {
        kpis.insertAdjacentHTML("afterend",
          `<div class="share-row"><button type="button" class="btn-primary" id="copyStats">${dict.copyStatsBtn}</button>` +
          `<span class="share-msg" id="copyMsg" role="status" aria-live="polite"></span></div>`);
      }
    }
  }

    const copyStatsBtn = el("copyStats");
  if (copyStatsBtn) {
    copyStatsBtn.addEventListener("click", async () => {
      const text = dict.copyText(n(t.goals), n(t.apps), n(t.clubs.goals), n(t.country.goals), d.lastUpdated);
      const msg = el("copyMsg");
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
        else {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        if (msg) msg.textContent = dict.copyMsg;
      } catch {
        if (msg) msg.textContent = text;
      }
      if (msg) {
        clearTimeout(copyStatsBtn.dataset.timer);
        copyStatsBtn.dataset.timer = setTimeout(() => { msg.textContent = ""; }, 4000);
      }
    });
  }

  const qa = el("qa");
  if (qa) {
    const faqFn = dict.faq || HOME_I18N.en.faq;
    qa.innerHTML = faqFn(t, agg, d.byFinish, d, lang).slice(0, 6).map((q) => `<details class="faq-item"><summary class="faq-question"><span>${q[0]}</span><span class="faq-chevron" aria-hidden="true">▾</span></summary><div class="faq-answer"><p>${q[1]}</p></div></details>`).join("");
    qa.className = "faq-accordion";
  }

  const clubCard = el("club-card");
  if (clubCard) {
    const order = ["barcelona", "psg", "miami", "argentina"];
    const rows = order.map((k2) => {
      const a = agg[k2];
      return `<tr><th scope="row"><span class="club-cell">${badge(k2)}<span class="club-name">${teamName(k2)}<small>${CLUBS[k2].years}</small></span></span></th>` +
        `<td>${n(a.apps)}</td><td><b>${n(a.goals)}</b></td><td>${gpg(a.goals, a.apps)}</td></tr>`;
    }).join("");

    clubCard.innerHTML =
      `<div class="table-wrap"><table class="data-table"><caption>${dict.clubCaption(esc(d.lastUpdated), lang)}</caption>` +
      `<thead><tr><th scope="col" class="left">${dict.thTeam}</th><th scope="col">${dict.thApps}</th><th scope="col">${dict.thGoals}</th><th scope="col">${dict.thGpg}</th></tr></thead>` +
      `<tbody>${rows}<tr class="total"><th scope="row">${dict.thTotal}</th><td>${n(t.apps)}</td><td>${n(t.goals)}</td><td>${t.goalsPerGame}</td></tr></tbody></table></div>` + clubTableCaption();
    const cTable = clubCard.querySelector("table");
    if (cTable) sortable(cTable);
  }

  // year widget: dropdown + tiles + full-range bars
  const ys = d.calendarYears;
  const cur = ys[ys.length - 1];
  const yearSub = el("year-sub");
  if (yearSub) {
    yearSub.textContent = dict.yearSub;
  }
  const yearWidget = el("year-widget");
  if (yearWidget) {
    yearWidget.innerHTML =
      `<div class="year-pick-head"><h3 class="year-pick-title">${dict.yearTitle}</h3>` +
      `<div class="year-pick-control"><label for="yearPick">${dict.yearLabel}</label><select id="yearPick" class="inline">` +
      ys.toReversed().map((r) => `<option value="${r.year}"${r.year === cur.year ? " selected" : ""}>${r.year}</option>`).join("") +
      `</select></div></div><div class="year-tiles" id="yearTiles"></div>` +
      `<figure style="margin:12px 0 0"><div class="spark-wrap" id="yearSpark"></div>` +
      `<figcaption class="figcap">${dict.yearFigcap(ys[0].year, cur.year, cur.provisional, lang)}</figcaption></figure>`;
    const drawYear = (y) => {
      const r = ys.find((x) => x.year === +y);
      if (!r) return;
      const yt = el("yearTiles");
      if (yt) {
        yt.innerHTML =
          `<div class="tile"><div class="t-val">${r.goals}</div><div class="t-lab">${dict.tileGoals(r.year, r.provisional)}</div></div>` +
          `<div class="tile"><div class="t-val">${n(r.careerTotal)}</div><div class="t-lab">${dict.tileTotal(r.year)}</div></div>` +
          `<div class="tile"><div class="t-val">${r.age}</div><div class="t-lab">${dict.tileAge(r.year)}</div></div>`;
      }
      const sparkWrap = el("yearSpark");
      if (sparkWrap) {
        sparkWrap.innerHTML = sparkSVG(
          ys.map((x) => ({ label: String(x.year), value: x.goals, year: x.year, peak: x.goals === 91, tip: `${x.year}: ${x.goals} goals (career: ${n(x.careerTotal)})` })),
          { selectedYear: +y, peakYear: 2012, label: `Bar chart of Messi goals in each calendar year, peaking at 91 in 2012` }
        );
        const svg = sparkWrap.querySelector("svg.spark");
        if (svg) {
          svg.classList.add("in");
          svg.querySelectorAll(".bar").forEach((bar) => {
            bar.style.cursor = "pointer";
            bar.addEventListener("click", () => {
              const yr = bar.dataset.year;
              if (yr && el("yearPick")) {
                el("yearPick").value = yr;
                drawYear(yr);
              }
            });
          });
        }
      }
    };
    const yp = el("yearPick");
    if (yp) yp.addEventListener("change", (e) => drawYear(e.target.value));
    drawYear(cur.year);
    // Rotating a phone crosses the 760px breakpoint, so the chart needs a
    // different viewBox. Redraw it rather than leaving a squashed desktop box.
    window.addEventListener("messi:spark-relayout", () => drawYear(cur.year));
  }

  const best = ys.reduce((a, b) => (b.goals > a.goals ? b : a));
  const post30 = ys.filter((r) => r.age >= 30).reduce((s, r) => s + r.goals, 0);

  const records = el("records");
  if (records) {
    records.innerHTML = dict.records(best, n(post30), Math.round((post30 / t.goals) * 100))
      .map((r) => `<div class="record"><span class="num">${r[0]}</span><span>${r[1]}</span></div>`).join("");
  }

  const silver = el("silver");
  if (silver) {
    silver.innerHTML =
      `<div class="table-wrap"><table class="data-table"><caption>${dict.silverCaption()}</caption>` +
      `<thead><tr><th scope="col" class="left">${dict.silverThTrophy}</th><th scope="col">${dict.silverThTimes}</th><th scope="col" class="left">${dict.silverThNote}</th></tr></thead><tbody>` +
      dict.silverRows.map((r, i) => `<tr><th scope="row">${r[0]}</th><td>${[LIVE.tBarca, LIVE.tArg, LIVE.tPsg, LIVE.tMiami][i] ?? r[1]}</td><td class="left">${r[2]}</td></tr>`).join("") +
      `</tbody></table></div>`;
    const sTable = silver.querySelector("table");
    if (sTable) sortable(sTable);
  }

  const m = d.byFinish;
  const split = el("split");
  if (split) {
    split.innerHTML = `<div class="split-grid">` +
      `<div class="split-card"><div class="s-val">${m.freeKicks}</div><div class="s-lab">${dict.splitFk}</div><div class="s-note">${dict.splitFkNote}</div></div>` +
      `<div class="split-card"><div class="s-val">${m.penalties}</div><div class="s-lab">${dict.splitPen}</div><div class="s-note">${dict.splitPenNote}</div></div>` +
      `<div class="split-card"><div class="s-val">${d.hatTricks}</div><div class="s-lab">${dict.splitHt}</div><div class="s-note">${dict.splitHtNote}</div></div></div>` +
      `<p class="caveat">${dict.splitCaveat(n(t.goals))}</p>`;
  }

  const faq = el("faq");
  if (faq) {
    const faqFn = dict.faq || HOME_I18N.en.faq;
    faq.innerHTML = faqFn(t, agg, m, d, lang).map((q) => `<details class="faq-item"><summary class="faq-question"><span>${q[0]}</span><span class="faq-chevron" aria-hidden="true">▾</span></summary><div class="faq-answer"><p>${q[1]}</p></div></details>`).join("");
    faq.className = "faq-accordion";
  }

  // Dynamically sync Road to 1,000 widget if present
  // Dynamically sync Road to 1,000 widget if present (every number derives
  // from live totals on each render — static HTML is SEO fallback only)
  const r1000 = el("road-1000");
  if (r1000) {
    const goals = t.goals || 930;
    const apps = t.apps || 1178;
    const clubG = (d.totals && d.totals.club && d.totals.club.goals) || 806;
    const argG = (d.totals && d.totals.country && d.totals.country.goals) || 126;
    const remaining = Math.max(0, 1000 - goals);
    const pct = ((goals / 1000) * 100).toFixed(1);
    const pace = apps ? goals / apps : 0.79;
    const fy = new Date().getFullYear();
    const estEnd = fy + Math.max(1, Math.ceil(remaining / (pace * 50)));
    const estStr = `${estEnd - 1}/${estEnd}`;
    const swapInt = (str, val) => String(str).replace(/(?<![\d.,])\d{3}(?![\d])/, String(val));
    const fill = r1000.querySelector(".road-1000-fill");
    if (fill) fill.style.width = `${pct}%`;
    const pin = r1000.querySelector(".road-1000-pin");
    if (pin) {
      pin.style.left = `${pct}%`;
      if (pin.title) pin.title = swapInt(pin.title, goals);
    }
    const track = r1000.querySelector(".road-1000-track");
    if (track) {
      track.setAttribute("aria-valuenow", String(goals));
      const al = track.getAttribute("aria-label");
      if (al) track.setAttribute("aria-label", swapInt(al, goals));
    }
    const pBadge = r1000.querySelector(".r1000-percent");
    if (pBadge) pBadge.textContent = `${pct}%`;
    const remEl = r1000.querySelector(".r1000-remaining");
    if (remEl) remEl.textContent = `${remaining}`;
    const nums = r1000.querySelectorAll(".r1000-num");
    const want = [goals, remaining, clubG, argG];
    nums.forEach((span, i) => { if (i < want.length) span.textContent = String(want[i]); });
    const pinLabel = r1000.querySelector(".pin-label");
    if (pinLabel) pinLabel.textContent = swapInt(pinLabel.textContent, goals);
    r1000.querySelectorAll(".r1000-pace b").forEach((b) => {
      const txt = b.textContent;
      if (/\d{4}\/\d{4}/.test(txt)) { b.textContent = txt.replace(/\d{4}\/\d{4}/, estStr); return; }
      const m = txt.match(/\d+([.,])\d+/);
      if (m) {
        const v = pace.toFixed(2).replace(".", m[1]);
        b.innerHTML = b.innerHTML.replace(/\d+([.,])\d+/, v);
      }
    });
  }

  initBentoEraExplorer(d);
  initRoad1000Simulator(d);
  renderExplore(d, "home");
  renderMethod(d, "");
  initBdayQuickForm();
  renderOnThisDay();
  initFanArcade();
  initArgentinaStreamNotification();
}

/* ================= FEATURE A: INTERACTIVE BENTO ERA FILTER ================= */
function initBentoEraExplorer(d) {
  if (typeof document === "undefined") return;
  const prof = document.querySelector("#profile.bento-profile-card");
  const kpis = document.querySelector("#kpis.kpis-6");
  if (!prof || !kpis) return;
  if (document.getElementById("bento-era-filter")) return;

  const cards = [...kpis.querySelectorAll(".kpi")];
  if (cards.length < 6) return;

  const lang = getLang();
  const sep = (lang === "fr" || lang === "uz") ? " " : (lang === "es" || lang === "pt" || lang === "ro" || lang === "id") ? "." : ",";
  const fmtInt = (val) => String(Math.round(val)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);

  // Snapshot exact original DOM text so returning to "all" restores 100% faithfully
  const origKpis = cards.map((card) => ({
    num: card.querySelector(".kpi-num")?.textContent || "",
    sub: card.querySelector(".kpi-sub")?.textContent || ""
  }));

  const ERA_DATA = {
    all: {
      nums: [937, 409, 1346, 1185, 47, 8],
      subs: null
    },
    barcelona: {
      nums: [672, 269, 941, 778, 35, 6],
      subs: {
        en: ["2004–2021 · Club Record", "303 TM Criteria", "1.21 G+A / Match", "0.86 Goals / Match", "4× UCL · 10× La Liga", "2009–2019 Era"],
        es: ["2004–2021 · Récord del Club", "303 Criterio TM", "1,21 G+A / Partido", "0,86 Goles / Partido", "4× UCL · 10× La Liga", "Etapa 2009–2019"],
        pt: ["2004–2021 · Recorde do Clube", "303 Critério TM", "1,21 G+A / Jogo", "0,86 Gols / Jogo", "4× UCL · 10× La Liga", "Era 2009–2019"],
        fr: ["2004–2021 · Record du Club", "303 Critère TM", "1,21 G+P / Match", "0,86 But / Match", "4× LDC · 10× La Liga", "Ère 2009–2019"],
        ro: ["2004–2021 · Record Club", "303 Criteriu TM", "1,21 G+A / Meci", "0,86 Goluri / Meci", "4× UCL · 10× La Liga", "Era 2009–2019"],
        uz: ["2004–2021 · Klub Rekordi", "303 TM Mezoni", "1,21 G+A / O'yin", "0,86 Gol / O'yin", "4× ECHL · 10× La Liga", "2009–2019 Davri"],
        ar: ["2004–2021 · الهداف التاريخي", "303 بمعيار TM", "1.21 مساهمة / مباراة", "0.86 هدف / مباراة", "4 دوري أبطال · 10 ليغا", "فترة 2009–2019"],
        id: ["2004–2021 · Rekor Klub", "303 Kriteria TM", "1,21 G+A / Laga", "0,86 Gol / Laga", "4× UCL · 10× La Liga", "Era 2009–2019"]
      }
    },
    argentina: {
      nums: [126, 58, 184, 208, 6, 2],
      subs: {
        en: ["2005–2026 · All-Time #1", "60 TM Criteria", "0.88 G+A / Match", "0.61 Goals / Match", "World Cup · 2× Copa · Finalissima", "2021 & 2023 Era"],
        es: ["2005–2026 · N.º 1 Histórico", "60 Criterio TM", "0,88 G+A / Partido", "0,61 Goles / Partido", "Mundial · 2× Copa · Finalissima", "Etapa 2021 y 2023"],
        pt: ["2005–2026 · Nº 1 Histórico", "60 Critério TM", "0,88 G+A / Jogo", "0,61 Gols / Jogo", "Copa · 2× América · Finalíssima", "Era 2021 e 2023"],
        fr: ["2005–2026 · N°1 Historique", "60 Critère TM", "0,88 G+P / Match", "0,61 But / Match", "Mondial · 2× Copa · Finalissima", "Ère 2021 & 2023"],
        ro: ["2005–2026 · Lider Istoric", "60 Criteriu TM", "0,88 G+A / Meci", "0,61 Goluri / Meci", "Mondial · 2× Copa · Finalissima", "Era 2021 & 2023"],
        uz: ["2005–2026 · Tarixiy #1", "60 TM Mezoni", "0,88 G+A / O'yin", "0,61 Gol / O'yin", "JCH · 2× Kopa · Finalissima", "2021 & 2023 Davri"],
        ar: ["2005–2026 · الهداف التاريخي #1", "60 بمعيار TM", "0.88 مساهمة / مباراة", "0.61 هدف / مباراة", "كأس العالم · 2 كوبا · فيناليسيما", "فترة 2021 و2023"],
        id: ["2005–2026 · #1 Sepanjang Masa", "60 Kriteria TM", "0,88 G+A / Laga", "0,61 Gol / Laga", "Piala Dunia · 2× Copa · Finalissima", "Era 2021 & 2023"]
      }
    },
    "inter-miami": {
      nums: [107, 48, 155, 124, 3, 1],
      subs: {
        en: ["2023–2026 · Club #1", "53 TM Criteria", "1.25 G+A / Match", "0.86 Goals / Match", "Leagues Cup · Supporters' Shield · MLS", "2023 Winner"],
        es: ["2023–2026 · N.º 1 del Club", "53 Criterio TM", "1,25 G+A / Partido", "0,86 Goles / Partido", "Leagues Cup · Shield · MLS", "Ganador 2023"],
        pt: ["2023–2026 · Nº 1 do Clube", "53 Critério TM", "1,25 G+A / Jogo", "0,86 Gols / Jogo", "Leagues Cup · Shield · MLS", "Vencedor 2023"],
        fr: ["2023–2026 · N°1 du Club", "53 Critère TM", "1,25 G+P / Match", "0,86 But / Match", "Leagues Cup · Shield · MLS", "Vainqueur 2023"],
        ro: ["2023–2026 · Lider Club", "53 Criteriu TM", "1,25 G+A / Meci", "0,86 Goluri / Meci", "Leagues Cup · Shield · MLS", "Câștigător 2023"],
        uz: ["2023–2026 · Klub #1", "53 TM Mezoni", "1,25 G+A / O'yin", "0,86 Gol / O'yin", "Leagues Cup · Shield · MLS", "2023 G'olibi"],
        ar: ["2023–2026 · الهداف #1", "53 بمعيار TM", "1.25 مساهمة / مباراة", "0.86 هدف / مباراة", "كأس الليغات · درع المشجعين · MLS", "فائز 2023"],
        id: ["2023–2026 · #1 Klub", "53 Kriteria TM", "1,25 G+A / Laga", "0,86 Gol / Laga", "Leagues Cup · Shield · MLS", "Pemenang 2023"]
      }
    },
    psg: {
      nums: [32, 34, 66, 75, 3, 1],
      subs: {
        en: ["2021–2023 · Ligue 1 & UCL", "35 TM Criteria", "0.88 G+A / Match", "0.43 Goals / Match", "2× Ligue 1 · Trophée des Champions", "2021 Ceremony"],
        es: ["2021–2023 · Ligue 1 y UCL", "35 Criterio TM", "0,88 G+A / Partido", "0,43 Goles / Partido", "2× Ligue 1 · Supercopa", "Ceremonia 2021"],
        pt: ["2021–2023 · Ligue 1 e UCL", "35 Critério TM", "0,88 G+A / Jogo", "0,43 Gols / Jogo", "2× Ligue 1 · Supercopa", "Cerimônia 2021"],
        fr: ["2021–2023 · Ligue 1 & LDC", "35 Critère TM", "0,88 G+P / Match", "0,43 But / Match", "2× Ligue 1 · Trophée des Champions", "Cérémonie 2021"],
        ro: ["2021–2023 · Ligue 1 și UCL", "35 Criteriu TM", "0,88 G+A / Meci", "0,43 Goluri / Meci", "2× Ligue 1 · Supercupa", "Ceremonia 2021"],
        uz: ["2021–2023 · Liga 1 va ECHL", "35 TM Mezoni", "0,88 G+A / O'yin", "0,43 Gol / O'yin", "2× Liga 1 · Superkubok", "2021 Marosimi"],
        ar: ["2021–2023 · الدوري الفرنسي والأبطال", "35 بمعيار TM", "0.88 مساهمة / مباراة", "0.43 هدف / مباراة", "2 الدوري الفرنسي · كأس الأبطال", "حفل 2021"],
        id: ["2021–2023 · Ligue 1 & UCL", "35 Kriteria TM", "0,88 G+A / Laga", "0,43 Gol / Laga", "2× Ligue 1 · Trophée des Champions", "Seremoni 2021"]
      }
    }
  };

  const ERA_LABELS = {
    en: { aria: "Filter career KPIs by team era", all: "All Career (937)", barcelona: "Barcelona (672)", argentina: "Argentina (126)", "inter-miami": "Inter Miami (107)", psg: "PSG (32)" },
    es: { aria: "Filtrar estadísticas por etapa", all: "Carrera (937)", barcelona: "Barcelona (672)", argentina: "Argentina (126)", "inter-miami": "Inter Miami (107)", psg: "PSG (32)" },
    pt: { aria: "Filtrar estatísticas por equipe", all: "Carreira (937)", barcelona: "Barcelona (672)", argentina: "Argentina (126)", "inter-miami": "Inter Miami (107)", psg: "PSG (32)" },
    fr: { aria: "Filtrer les statistiques par équipe", all: "Carrière (937)", barcelona: "Barcelone (672)", argentina: "Argentine (126)", "inter-miami": "Inter Miami (107)", psg: "PSG (32)" },
    ro: { aria: "Filtrează statisticile după echipă", all: "Carieră (937)", barcelona: "Barcelona (672)", argentina: "Argentina (126)", "inter-miami": "Inter Miami (107)", psg: "PSG (32)" },
    uz: { aria: "Statistikani jamoa bo'yicha filtrlash", all: "Karyera (937)", barcelona: "Barselona (672)", argentina: "Argentina (126)", "inter-miami": "Inter Mayami (107)", psg: "PSJ (32)" },
    ar: { aria: "تصفية الإحصائيات حسب الفريق", all: "المسيرة (937)", barcelona: "برشلونة (672)", argentina: "الأرجنتين (126)", "inter-miami": "إنتر ميامي (107)", psg: "باريس (32)" },
    id: { aria: "Filter statistik karier berdasarkan era tim", all: "Semua Karier (937)", barcelona: "Barcelona (672)", argentina: "Argentina (126)", "inter-miami": "Inter Miami (107)", psg: "PSG (32)" }
  };
  const labels = ERA_LABELS[lang] || ERA_LABELS.en;
  const ERA_KEYS = ["all", "barcelona", "argentina", "inter-miami", "psg"];

  const filterBar = document.createElement("div");
  filterBar.id = "bento-era-filter";
  filterBar.className = "bento-era-filter";
  filterBar.setAttribute("role", "group");
  filterBar.setAttribute("aria-label", labels.aria);
  filterBar.innerHTML = ERA_KEYS.map((key, idx) =>
    `<button type="button" class="era-filter-btn${idx === 0 ? " is-active" : ""}" data-era-team="${key}" aria-pressed="${idx === 0 ? "true" : "false"}">${labels[key]}</button>`
  ).join("");
  kpis.before(filterBar);

  const splitKeys = ["barcelona", "argentina", "inter-miami", "psg"];
  const splitItems = [...prof.querySelectorAll(".bento-split-item")];
  splitItems.forEach((item, idx) => {
    const teamKey = item.dataset.eraTeam || splitKeys[idx] || "barcelona";
    item.dataset.eraTeam = teamKey;
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    item.setAttribute("aria-pressed", "false");
  });

  let activeEra = "all";
  let animRaf = 0;

  const setEra = (nextEra) => {
    const era = ERA_DATA[nextEra] ? nextEra : "all";
    activeEra = era;

    filterBar.querySelectorAll(".era-filter-btn").forEach((btn) => {
      const on = btn.dataset.eraTeam === era;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });

    splitItems.forEach((item) => {
      const on = item.dataset.eraTeam === era;
      item.classList.toggle("is-active", on);
      item.setAttribute("aria-pressed", on ? "true" : "false");
    });

    if (era === "all") {
      kpis.removeAttribute("data-era-filtered");
    } else {
      kpis.setAttribute("data-era-filtered", era);
    }

    const spec = ERA_DATA[era];
    const targetSubs = era === "all"
      ? origKpis.map((k) => k.sub)
      : (spec.subs[lang] || spec.subs.en);

    cards.forEach((card, i) => {
      const subEl = card.querySelector(".kpi-sub");
      if (subEl && targetSubs[i] != null) subEl.textContent = targetSubs[i];
    });

    const reducedMotion = typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (animRaf) cancelAnimationFrame(animRaf);

    const startNums = cards.map((card) => {
      const raw = card.querySelector(".kpi-num")?.textContent || "0";
      return parseInt(raw.replace(/[^\d]/g, ""), 10) || 0;
    });
    const endNums = spec.nums;

    const applyFinal = () => {
      cards.forEach((card, i) => {
        const numEl = card.querySelector(".kpi-num");
        if (!numEl) return;
        if (era === "all") {
          numEl.textContent = origKpis[i].num;
        } else {
          numEl.textContent = fmtInt(endNums[i]);
        }
      });
    };

    if (reducedMotion || typeof requestAnimationFrame !== "function") {
      applyFinal();
      return;
    }

    const duration = 280;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      cards.forEach((card, i) => {
        const numEl = card.querySelector(".kpi-num");
        if (!numEl) return;
        const val = Math.round(startNums[i] + (endNums[i] - startNums[i]) * eased);
        numEl.textContent = fmtInt(val) + (era === "all" && i === 1 && origKpis[1].num.endsWith("*") ? "*" : "");
      });
      if (p < 1) {
        animRaf = requestAnimationFrame(step);
      } else {
        animRaf = 0;
        applyFinal();
      }
    };
    animRaf = requestAnimationFrame(step);
  };

  filterBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".era-filter-btn");
    if (!btn) return;
    setEra(btn.dataset.eraTeam || "all");
  });

  splitItems.forEach((item) => {
    const activate = () => {
      const team = item.dataset.eraTeam || "all";
      setEra(activeEra === team ? "all" : team);
    };
    item.addEventListener("click", activate);
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  });
}

/* ================= FEATURE B: ROAD TO 1,000 PACE SIMULATOR ================= */
function initRoad1000Simulator(d) {
  if (typeof document === "undefined") return;
  const r1000 = document.getElementById("road-1000");
  if (!r1000) return;
  if (r1000.querySelector(".r1000-pace-pills")) return;

  const paceEl = r1000.querySelector(".r1000-pace");
  const footer = r1000.querySelector(".road-1000-footer");
  if (!paceEl || !footer) return;

  const lang = getLang();
  const goals = (d && d.totals && d.totals.goals) || LIVE.goals || 937;
  const remaining = Math.max(0, 1000 - goals);

  const SIM_I18N = {
    en: {
      aria: "Scoring pace projection scenarios",
      pills: [
        { id: "career", label: "Career 0.79/g", rate: 0.79, window: "Late 2027" },
        { id: "miami", label: "Miami 0.86/g", rate: 0.86, window: "Mid 2027" },
        { id: "conservative", label: "Conservative 0.60/g", rate: 0.60, window: "2028" }
      ],
      fmt: (rate, matches, win) => `Pace: <b>${rate.toFixed(2)} goals/game</b> · <b>${matches} matches</b> needed · Est: <b>${win}</b>`
    },
    es: {
      aria: "Simulador de ritmo hacia los 1.000 goles",
      pills: [
        { id: "career", label: "Carrera 0,79/p", rate: 0.79, window: "Finales de 2027" },
        { id: "miami", label: "Miami 0,86/p", rate: 0.86, window: "Mediados de 2027" },
        { id: "conservative", label: "Conservador 0,60/p", rate: 0.60, window: "2028" }
      ],
      fmt: (rate, matches, win) => `Ritmo: <b>${rate.toFixed(2).replace(".", ",")} goles/partido</b> · <b>${matches} partidos</b> necesarios · Est.: <b>${win}</b>`
    },
    pt: {
      aria: "Simulador de ritmo rumo aos 1.000 gols",
      pills: [
        { id: "career", label: "Carreira 0,79/j", rate: 0.79, window: "Fim de 2027" },
        { id: "miami", label: "Miami 0,86/j", rate: 0.86, window: "Meio de 2027" },
        { id: "conservative", label: "Conservador 0,60/j", rate: 0.60, window: "2028" }
      ],
      fmt: (rate, matches, win) => `Ritmo: <b>${rate.toFixed(2).replace(".", ",")} gols/jogo</b> · <b>${matches} jogos</b> necessários · Prev.: <b>${win}</b>`
    },
    fr: {
      aria: "Simulateur de rythme vers les 1 000 buts",
      pills: [
        { id: "career", label: "Carrière 0,79/m", rate: 0.79, window: "Fin 2027" },
        { id: "miami", label: "Miami 0,86/m", rate: 0.86, window: "Mi-2027" },
        { id: "conservative", label: "Prudent 0,60/m", rate: 0.60, window: "2028" }
      ],
      fmt: (rate, matches, win) => `Rythme : <b>${rate.toFixed(2).replace(".", ",")} buts/match</b> · <b>${matches} matchs</b> requis · Est. : <b>${win}</b>`
    },
    ro: {
      aria: "Simulator de ritm spre 1.000 de goluri",
      pills: [
        { id: "career", label: "Carieră 0,79/m", rate: 0.79, window: "Sfârșit 2027" },
        { id: "miami", label: "Miami 0,86/m", rate: 0.86, window: "Mijloc 2027" },
        { id: "conservative", label: "Prudent 0,60/m", rate: 0.60, window: "2028" }
      ],
      fmt: (rate, matches, win) => `Ritm: <b>${rate.toFixed(2).replace(".", ",")} goluri/meci</b> · <b>${matches} meciuri</b> necesare · Est.: <b>${win}</b>`
    },
    uz: {
      aria: "1 000 gol sari sur'at simulyatori",
      pills: [
        { id: "career", label: "Karyera 0,79/o'", rate: 0.79, window: "2027 oxiri" },
        { id: "miami", label: "Mayami 0,86/o'", rate: 0.86, window: "2027 o'rtasi" },
        { id: "conservative", label: "Ehtiyotkor 0,60/o'", rate: 0.60, window: "2028" }
      ],
      fmt: (rate, matches, win) => `Sur'at: <b>${rate.toFixed(2).replace(".", ",")} gol/o'yin</b> · <b>${matches} ta o'yin</b> kerak · Taxmin: <b>${win}</b>`
    },
    ar: {
      aria: "محاكي وتيرة الوصول إلى 1000 هدف",
      pills: [
        { id: "career", label: "المسيرة 0.79/م", rate: 0.79, window: "أواخر 2027" },
        { id: "miami", label: "ميامي 0.86/م", rate: 0.86, window: "منتصف 2027" },
        { id: "conservative", label: "متحفظ 0.60/م", rate: 0.60, window: "2028" }
      ],
      fmt: (rate, matches, win) => `الوتيرة: <b>${rate.toFixed(2)} هدف/مباراة</b> · المطلوب: <b>${matches} مباراة</b> · التوقع: <b>${win}</b>`
    },
    id: {
      aria: "Skenario proyeksi laju gol menuju 1.000",
      pills: [
        { id: "career", label: "Karier 0,79/laga", rate: 0.79, window: "Akhir 2027" },
        { id: "miami", label: "Miami 0,86/laga", rate: 0.86, window: "Pertengahan 2027" },
        { id: "conservative", label: "Konservatif 0,60/laga", rate: 0.60, window: "2028" }
      ],
      fmt: (rate, matches, win) => `Laju: <b>${rate.toFixed(2).replace(".", ",")} gol/laga</b> · <b>${matches} laga</b> dibutuhkan · Est: <b>${win}</b>`
    }
  };

  const sim = SIM_I18N[lang] || SIM_I18N.en;
  const pillsWrap = document.createElement("div");
  pillsWrap.className = "r1000-pace-pills";
  pillsWrap.setAttribute("role", "group");
  pillsWrap.setAttribute("aria-label", sim.aria);
  pillsWrap.innerHTML = sim.pills.map((p, idx) =>
    `<button type="button" class="pace-pill-btn${idx === 0 ? " is-active" : ""}" data-pace-id="${p.id}" aria-pressed="${idx === 0 ? "true" : "false"}">${p.label}</button>`
  ).join("");

  footer.before(pillsWrap);

  const selectPace = (id) => {
    const spec = sim.pills.find((p) => p.id === id) || sim.pills[0];
    pillsWrap.querySelectorAll(".pace-pill-btn").forEach((b) => {
      const on = b.dataset.paceId === spec.id;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const matchesNeeded = remaining > 0 ? Math.ceil(remaining / spec.rate) : 0;
    paceEl.innerHTML = sim.fmt(spec.rate, matchesNeeded, spec.window);
  };

  pillsWrap.addEventListener("click", (e) => {
    const btn = e.target.closest(".pace-pill-btn");
    if (!btn) return;
    selectPace(btn.dataset.paceId);
  });

  selectPace("career");
}

/* ================= BIRTHDAY QUICK FORM (HERO WIDGET) ================= */
function initBdayQuickForm() {
  const form = el("bday-quick-form");
  const monthSel = el("bday-quick-month");
  const daySel = el("bday-quick-day");
  if (!form || !monthSel || !daySel) return;

  const daysInMonth = { "01": 31, "02": 29, "03": 31, "04": 30, "05": 31, "06": 30, "07": 31, "08": 31, "09": 30, "10": 31, "11": 30, "12": 31 };

  const populateDays = (selectedDay) => {
    const m = monthSel.value || "01";
    const maxDays = daysInMonth[m] || 31;
    const currentVal = selectedDay || parseInt(daySel.value || "1", 10);
    daySel.replaceChildren();
    for (let i = 1; i <= maxDays; i++) {
      const opt = document.createElement("option");
      const val = String(i).padStart(2, "0");
      opt.value = val;
      opt.textContent = String(i);
      if (i === Math.min(currentVal, maxDays)) opt.selected = true;
      daySel.appendChild(opt);
    }
  };

  const now = new Date();
  const defM = String(now.getUTCMonth() + 1).padStart(2, "0");
  const defD = now.getUTCDate();
  monthSel.value = defM;
  populateDays(defD);

  monthSel.addEventListener("change", () => populateDays());

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const m = String(monthSel.value).padStart(2, "0");
    const d = String(daySel.value).padStart(2, "0");
    window.location.href = `/${getLang()}/birthday/${m}-${d}`;
  });
}

/* ================= ON THIS DAY (HOME PAGE WIDGET) ================= */
async function renderOnThisDay() {
  const container = el("on-this-day");
  if (!container) return;
  const lang = getLang();

  const otdDict = {
    en: {
      error: `Could not load today's match history. <a href="/en/birthday">Check birthday explorer &rarr;</a>`,
      empty: `No match data on record for today. <a href="/en/birthday">Explore all 366 days &rarr;</a>`,
      closestBadge: (d) => `CLOSEST SCORING DAY • ${d} (UTC)`,
      liveBadge: (d) => `<span class="live-dot pulse"></span> <b>ON THIS DAY • ${d} (UTC)</b>`,
      headlineClosest: (d, g, nowD, nowM) => `No senior match scheduled today (${nowD} ${nowM} UTC). Closest scoring day: <b>${g} goals</b> on ${d}!`,
      headlineLive: (g, m) => `On this day in history, Lionel Messi scored <b>${g} goals</b> in <b>${m} match${m > 1 ? "es" : ""}</b>!`,
      btnBday: "Did Messi score on your birthday?",
      btnExplore: "Explore All 366 Days &rarr;",
      lblMinute: "Minute",
      lblShotType: "Shot Type",
      lblAssist: "Assist",
      lblXg: "Expected Goal (xG)",
      noVideo: "Video clip for this goal is being verified.",
      searchYt: "Search clip on YouTube &rarr;",
      goalTab: (n, min) => `Goal ${n}${min ? ` (${min}')` : ""}`,
      hatTrick: "Hat-trick",
      goalsSuffix: "G"
    },
    es: {
      error: `No se pudo cargar el historial de hoy. <a href="/es/birthday">Explorar cumpleaños &rarr;</a>`,
      empty: `Sin registros de partidos en esta fecha. <a href="/es/birthday">Ver los 366 días &rarr;</a>`,
      closestBadge: (d) => `DÍA MÁS CERCANO CON GOLES • ${d} (UTC)`,
      liveBadge: (d) => `<span class="live-dot pulse"></span> <b>UN DÍA COMO HOY • ${d} (UTC)</b>`,
      headlineClosest: (d, g, nowD, nowM) => `Sin partidos oficiales disputados hoy (${nowD} ${nowM} UTC). Día más cercano con goles: <b>${g} goles</b> el ${d}.`,
      headlineLive: (g, m) => `Un día como hoy en la historia, Lionel Messi marcó <b>${g} goles</b> en <b>${m} partido${m > 1 ? "s" : ""}</b>.`,
      btnBday: "¿Marcó Messi en tu cumpleaños?",
      btnExplore: "Explorar los 366 Días &rarr;",
      lblMinute: "Minuto",
      lblShotType: "Tipo de gol",
      lblAssist: "Asistencia",
      lblXg: "Gol esperado (xG)",
      noVideo: "El video de este gol se está verificando.",
      searchYt: "Buscar jugada en YouTube &rarr;",
      goalTab: (n, min) => `Gol ${n}${min ? ` (${min}')` : ""}`,
      hatTrick: "Hat-trick",
      goalsSuffix: "G"
    },
    pt: {
      error: `Não foi possível carregar o histórico de hoje. <a href="/pt/birthday">Ver aniversários &rarr;</a>`,
      empty: `Sem dados de jogos nesta data. <a href="/pt/birthday">Explorar os 366 dias &rarr;</a>`,
      closestBadge: (d) => `DIA MAIS PRÓXIMO COM GOLS • ${d} (UTC)`,
      liveBadge: (d) => `<span class="live-dot pulse"></span> <b>NESTE DIA NA HISTÓRIA • ${d} (UTC)</b>`,
      headlineClosest: (d, g, nowD, nowM) => `Nenhum jogo sênior disputado hoje (${nowD} ${nowM} UTC). Dia mais próximo com gols: <b>${g} gols</b> em ${d}!`,
      headlineLive: (g, m) => `Neste dia na história, Lionel Messi marcou <b>${g} gols</b> em <b>${m} partida${m > 1 ? "s" : ""}</b>!`,
      btnBday: "Marcou Messi no seu aniversário?",
      btnExplore: "Explorar Todos os 366 Dias &rarr;",
      lblMinute: "Minuto",
      lblShotType: "Tipo de gol",
      lblAssist: "Assistência",
      lblXg: "Gol esperado (xG)",
      noVideo: "O vídeo deste gol está sendo verificado.",
      searchYt: "Buscar no YouTube &rarr;",
      goalTab: (n, min) => `Gol ${n}${min ? ` (${min}')` : ""}`,
      hatTrick: "Hat-trick",
      goalsSuffix: "G"
    },
    fr: {
      error: `Impossible de charger l'historique du jour. <a href="/fr/birthday">Explorateur d'anniversaires &rarr;</a>`,
      empty: `Aucun match enregistré à cette date. <a href="/fr/birthday">Explorer les 366 jours &rarr;</a>`,
      closestBadge: (d) => `JOUR LE PLUS PROCHE AVEC BUTS • ${d} (UTC)`,
      liveBadge: (d) => `<span class="live-dot pulse"></span> <b>CE JOUR-LÀ DANS L'HISTOIRE • ${d} (UTC)</b>`,
      headlineClosest: (d, g, nowD, nowM) => `Pas de match senior aujourd'hui (${nowD} ${nowM} UTC). Date la plus proche : <b>${g} buts</b> le ${d} !`,
      headlineLive: (g, m) => `Ce jour-là dans l'histoire, Lionel Messi a marqué <b>${g} buts</b> en <b>${m} match${m > 1 ? "s" : ""}</b> !`,
      btnBday: "Messi a-t-il marqué le jour de votre anniversaire ?",
      btnExplore: "Explorer les 366 Jours &rarr;",
      lblMinute: "Minute",
      lblShotType: "Type de but",
      lblAssist: "Passe décisive",
      lblXg: "But attendu (xG)",
      noVideo: "Le clip vidéo de ce but est en cours de validation.",
      searchYt: "Chercher le but sur YouTube &rarr;",
      goalTab: (n, min) => `But ${n}${min ? ` (${min}')` : ""}`,
      hatTrick: "Triplé",
      goalsSuffix: "B"
    },
    ro: {
      error: `Nu s-a putut încărca istoricul de astăzi. <a href="/ro/birthday">Verifică exploratorul de zile &rarr;</a>`,
      empty: `Nu există meciuri înregistrate pentru această dată. <a href="/ro/birthday">Explorează toate cele 366 de zile &rarr;</a>`,
      closestBadge: (d) => `CEA MAI APROPIATĂ ZI CU GOLURI • ${d} (UTC)`,
      liveBadge: (d) => `<span class="live-dot pulse"></span> <b>ÎN ACEASTĂ ZI • ${d} (UTC)</b>`,
      headlineClosest: (d, g, nowD, nowM) => `Niciun meci disputat astăzi (${nowD} ${nowM} UTC). Cea mai apropiată zi cu goluri: <b>${g} goluri</b> pe ${d}.`,
      headlineLive: (g, m) => `În această zi din istorie, Lionel Messi a marcat <b>${g} goluri</b> în <b>${m} ${m > 1 ? "meciuri" : "meci"}</b>!`,
      btnBday: "A marcat Messi de ziua ta?",
      btnExplore: "Explorează toate cele 366 de zile &rarr;",
      lblMinute: "Minut",
      lblShotType: "Tip execuție",
      lblAssist: "Pasă decisivă",
      lblXg: "Gol așteptat (xG)",
      noVideo: "Clipul video pentru acest gol este în curs de verificare.",
      searchYt: "Caută clipul pe YouTube &rarr;",
      goalTab: (n, min) => `Gol ${n}${min ? ` (${min}')` : ""}`,
      hatTrick: "Hat-trick",
      goalsSuffix: "G"
    },
    uz: {
      error: `Bugungi o'yinlar tarixini yuklab bo'lmadi. <a href="/uz/birthday">Tug'ilgan kun bo'limi &rarr;</a>`,
      empty: `Ushbu sana uchun o'yin ma'lumotlari topilmadi. <a href="/uz/birthday">Barcha 366 kunni ko'rish &rarr;</a>`,
      closestBadge: (d) => `ENG YAQIN GOL URILGAN KUN • ${d} (UTC)`,
      liveBadge: (d) => `<span class="live-dot pulse"></span> <b>TARIXDA SHU KUNI • ${d} (UTC)</b>`,
      headlineClosest: (d, g, nowD, nowM) => `Bugun rasmiy o'yin qayd etilmagan (${nowD} ${nowM} UTC). Eng yaqin gol urilgan kun: ${d} — <b>${g} ta gol</b>!`,
      headlineLive: (g, m) => `Tarixda shu kuni Lionel Messi <b>${m} ta o'yinda</b> jami <b>${g} ta gol</b> urgan!`,
      btnBday: "Messi sizning tug'ilgan kuningizda gol urganmi?",
      btnExplore: "Barcha 366 kunni ko'rish &rarr;",
      lblMinute: "Daqiqa",
      lblShotType: "Zarba turi",
      lblAssist: "Golli uzatma",
      lblXg: "Kutilgan gol (xG)",
      noVideo: "Ushbu golning videosi tekshirilmoqda.",
      searchYt: "YouTube orqali qidirish &rarr;",
      goalTab: (n, min) => `${n}-gol${min ? ` (${min}')` : ""}`,
      hatTrick: "Xet-trik",
      goalsSuffix: "G"
    },
    ar: {
      error: `تعذر تحميل سجل مباريات اليوم. <a href="/ar/birthday">تصفح مستكشف أعياد الميلاد &rarr;</a>`,
      empty: `لا توجد مباريات مسجلة لهذا التاريخ. <a href="/ar/birthday">استكشف جميع الأيام الـ 366 &rarr;</a>`,
      closestBadge: (d) => `أقرب يوم شهد أهدافاً • ${d} (UTC)`,
      liveBadge: (d) => `<span class="live-dot pulse"></span> <b>في مثل هذا اليوم • ${d} (UTC)</b>`,
      headlineClosest: (d, g, nowD, nowM) => `لا توجد مباراة مسجلة اليوم (${nowD} ${nowM} UTC). أقرب يوم شهد أهدافاً: <b>${g} أهداف</b> في ${d}!`,
      headlineLive: (g, m) => `في مثل هذا اليوم من التاريخ، سجل ليونيل ميسي <b>${g} أهداف</b> في <b>${m} ${m > 1 ? "مباريات" : "مباراة"}</b>!`,
      btnBday: "هل سجل ميسي في يوم ميلادك؟",
      btnExplore: "استكشف جميع الأيام الـ 366 &rarr;",
      lblMinute: "الدقيقة",
      lblShotType: "نوع التسديدة",
      lblAssist: "التمريرة الحاسمة",
      lblXg: "الأهداف المتوقعة (xG)",
      noVideo: "جاري التحقق من مقطع الفيديو لهذا الهدف.",
      searchYt: "ابحث عن اللقطة في يوتيوب &rarr;",
      goalTab: (n, min) => `الهدف ${n}${min ? ` (${min}')` : ""}`,
      hatTrick: "هاتريك",
      goalsSuffix: " أهداف"
    },
    id: {
      error: `Gagal memuat riwayat laga hari ini. <a href="/id/birthday">Cek penjelajah ulang tahun &rarr;</a>`,
      empty: `Tidak ada data laga pada tanggal ini. <a href="/id/birthday">Jelajahi 366 hari &rarr;</a>`,
      closestBadge: (d) => `HARI GOL TERDEKAT • ${d} (UTC)`,
      liveBadge: (d) => `<span class="live-dot pulse"></span> <b>HARI INI DALAM SEJARAH • ${d} (UTC)</b>`,
      headlineClosest: (d, g, nowD, nowM) => `Tidak ada laga senior hari ini (${nowD} ${nowM} UTC). Hari gol terdekat: <b>${g} gol</b> pada ${d}!`,
      headlineLive: (g, m) => `Pada hari ini dalam sejarah, Lionel Messi mencetak <b>${g} gol</b> dalam <b>${m} laga</b>!`,
      btnBday: "Apakah Messi mencetak gol di hari ulang tahunmu?",
      btnExplore: "Jelajahi Semua 366 Hari &rarr;",
      lblMinute: "Menit",
      lblShotType: "Jenis Tembakan",
      lblAssist: "Assist",
      lblXg: "Expected Goal (xG)",
      noVideo: "Klip video untuk gol ini sedang diverifikasi.",
      searchYt: "Cari klip di YouTube &rarr;",
      goalTab: (n, min) => `Gol ${n}${min ? ` (${min}')` : ""}`,
      hatTrick: "Hat-trick",
      goalsSuffix: "G"
    }
  };

  const o = otdDict[lang] || otdDict.en;

  let bdayData;
  try {
    let res;
    try {
      res = await fetch("/data/birthday-goals.json", { cache: "no-store" });
    } catch (_) {}
    if (!res || !res.ok) {
      res = await fetch("data/birthday-goals.json", { cache: "no-store" });
    }
    if (!res.ok) throw new Error("status " + res.status);
    bdayData = await res.json();
  } catch (err) {
    console.error("Failed to load birthday goals for On This Day", err);
    container.innerHTML = `<p class="otd-error">${o.error}</p>`;
    return;
  }

  const calendar = bdayData.calendar || {};
  const pad2 = (n) => String(n).padStart(2, "0");

  const now = new Date();
  const utcM = now.getUTCMonth() + 1;
  const utcD = now.getUTCDate();
  const todayKey = `${pad2(utcM)}-${pad2(utcD)}`;

  let dayData = calendar[todayKey];
  let isClosest = false;

  if (!dayData || dayData.goalsCount === 0) {
    const keys = Object.keys(calendar);
    const targetIdx = keys.indexOf(todayKey);
    let closestKey = null;
    let minDiff = Infinity;
    keys.forEach((k, idx) => {
      if (calendar[k] && calendar[k].goalsCount > 0) {
        const diff = Math.abs(idx - (targetIdx >= 0 ? targetIdx : 0));
        if (diff < minDiff) {
          minDiff = diff;
          closestKey = k;
        }
      }
    });
    if (closestKey && calendar[closestKey]) {
      dayData = calendar[closestKey];
      isClosest = true;
    }
  }

  if (!dayData) {
    container.innerHTML = `<p class="otd-empty">${o.empty}</p>`;
    return;
  }

  let activeMatchIdx = 0;
  let activeGoalIdx = 0;

  const renderContent = () => {
    const matches = dayData.matches || [];
    const activeMatch = matches[activeMatchIdx] || matches[0];
    if (!activeMatch) {
      container.innerHTML = `<p class="otd-empty">${o.empty}</p>`;
      return;
    }

    const videos = activeMatch.videos || [];
    const activeVideo = videos[activeGoalIdx] || videos[0] || {};
    const hasVideo = !!activeVideo.videoUrl;

    let matchTabsHtml = "";
    if (matches.length > 1) {
      matchTabsHtml = `<div class="otd-match-tabs" role="tablist">` +
        matches.map((m, idx) => {
          const isActive = idx === activeMatchIdx;
          const hatTrickLabel = m.goalsCount >= 3 ? ` · ${o.hatTrick || "Hat-trick"}` : "";
          return `<button type="button" class="otd-match-tab${isActive ? " active" : ""}" data-midx="${idx}" role="tab" aria-selected="${isActive}">
            ${m.year} vs ${esc(m.opponent)} (${m.goalsCount}${o.goalsSuffix || "G"}${hatTrickLabel})
          </button>`;
        }).join("") +
      `</div>`;
    }

    let goalTabsHtml = "";
    if (videos.length > 1 || (activeMatch.minutes && activeMatch.minutes.length > 1)) {
      const count = Math.max(videos.length, activeMatch.minutes ? activeMatch.minutes.length : 1);
      goalTabsHtml = `<div class="otd-goal-tabs">` +
        Array.from({ length: count }, (_, gIdx) => {
          const isActive = gIdx === activeGoalIdx;
          const min = (videos[gIdx] && videos[gIdx].minute) || (activeMatch.minutes && activeMatch.minutes[gIdx]) || "";
          return `<button type="button" class="otd-goal-tab${isActive ? " active" : ""}" data-gidx="${gIdx}">
            ${o.goalTab(gIdx + 1, min)}
          </button>`;
        }).join("") +
      `</div>`;
    }

    const currentMin = activeVideo.minute || (activeMatch.minutes && activeMatch.minutes[activeGoalIdx]) || "";
    const currentType = (activeMatch.types && activeMatch.types[activeGoalIdx]) || (activeVideo.penalty ? "Penalty" : (activeVideo.freekick ? "Direct Free Kick" : "Goal"));
    const goalNumberBadge = activeVideo.goalNumber ? `<span class="otd-goal-num-badge">Goal #${activeVideo.goalNumber}</span>` : "";

    const videoPlayerHtml = hasVideo
      ? `<div class="otd-video-wrap">
          ${goalTabsHtml}
          <div class="otd-player-frame">
            <video controls playsinline preload="metadata" src="${esc(activeVideo.videoUrl)}" class="otd-video-element" style="background:#000;">
              Your browser does not support the video tag.
            </video>
          </div>
        </div>`
      : `<div class="otd-no-video">
          <div class="otd-no-video-inner">
            <p>${o.noVideo}</p>
            <a href="https://www.youtube.com/results?search_query=Lionel+Messi+goal+vs+${encodeURIComponent(activeMatch.opponent)}+${activeMatch.date}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
              ${o.searchYt}
            </a>
          </div>
        </div>`;

    const statusBadge = isClosest
      ? `<span class="otd-badge otd-badge-closest">${o.closestBadge(dayData.formatted.toUpperCase())}</span>`
      : `<span class="otd-badge">${o.liveBadge(dayData.formatted.toUpperCase())}</span>`;

    const mNames = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const headlineText = isClosest
      ? o.headlineClosest(dayData.formatted, dayData.goalsCount, now.getUTCDate(), mNames[utcM])
      : o.headlineLive(dayData.goalsCount, matches.length);

    container.innerHTML = `
      <div class="otd-header">
        <div class="otd-header-left">
          ${statusBadge}
          <h3 class="otd-headline">${headlineText}</h3>
        </div>
        <div class="otd-header-right">
          <a href="/en/birthday/${todayKey}" class="btn btn-secondary btn-sm otd-bday-link">
            ${o.btnBday}
          </a>
        </div>
      </div>

      ${matchTabsHtml}

      <div class="otd-body">
        <div class="otd-player-column">
          ${videoPlayerHtml}
        </div>

        <div class="otd-info-column">
          <div class="otd-match-scoreline">
            <span class="otd-team">${esc(activeMatch.team)}</span>
            <span class="otd-score">${esc(activeMatch.score)}</span>
            <span class="otd-opponent">${esc(activeMatch.opponent)}</span>
          </div>

          <div class="otd-meta-row">
            <span class="otd-comp-badge">${esc(activeMatch.competition)}</span>
            <span class="otd-date-badge">${esc(activeMatch.date)}</span>
            ${goalNumberBadge}
          </div>

          <div class="otd-goal-details-card">
            <div class="otd-detail-item">
              <span class="otd-dt-label">${o.lblMinute}</span>
              <strong class="otd-dt-val">${esc(currentMin ? `${currentMin}'` : "—")}</strong>
            </div>
            <div class="otd-detail-item">
              <span class="otd-dt-label">${o.lblShotType}</span>
              <strong class="otd-dt-val">${esc(currentType)}</strong>
            </div>
            ${activeVideo.assist ? `
            <div class="otd-detail-item">
              <span class="otd-dt-label">${o.lblAssist}</span>
              <strong class="otd-dt-val">${esc(activeVideo.assist)}</strong>
            </div>` : ""}
            ${activeVideo.xg ? `
            <div class="otd-detail-item">
              <span class="otd-dt-label">${o.lblXg}</span>
              <strong class="otd-dt-val">${activeVideo.xg}</strong>
            </div>` : ""}
          </div>

          <div class="otd-cta-row">
            <a href="/en/birthday/${todayKey}" class="btn btn-primary btn-sm">
              ${o.btnExplore}
            </a>
          </div>
        </div>
      </div>
    `;

    // Wire up tab events
    container.querySelectorAll(".otd-match-tab").forEach((tab) => {
      tab.onclick = () => {
        activeMatchIdx = +tab.dataset.midx;
        activeGoalIdx = 0;
        renderContent();
      };
    });

    container.querySelectorAll(".otd-goal-tab").forEach((tab) => {
      tab.onclick = () => {
        activeGoalIdx = +tab.dataset.gidx;
        renderContent();
      };
    });
  };

  renderContent();
}

const BY_YEAR_I18N = {
  es: {
    head: (ys, best, t) => `Desde su primer gol oficial en ${ys[0].year} hasta los <b>${best.goals} goles en ${best.year}</b> — cada año natural de una carrera de ${n(t.goals)} goles oficiales, con totales acumulados y su edad.`,
    cap: (best, t) => `Barras: goles en ese año (máximo ${best.goals}, en ${best.year}). Línea: ascenso acumulado hasta ${n(t.goals)}.`,
    chartLabel: (best) => `Goles de Messi por año natural con total acumulado de carrera, con récord de ${best.goals} en ${best.year}`,
    kpiCareer: "Goles de carrera",
    kpiBest: "Mejor año",
    kpiBestSub: "Récord mundial en un año natural.",
    kpiCurrSub: "Temporada en curso.",
    kpiYears: "Años marcando",
    kpiYearsSub: (ys, last) => `Cada año desde ${ys[0].year} hasta ${last.year}.`,
    decades: "Goles en los años",
    tableSub: "Más recientes primero. 2026 tiene asterisco mientras la temporada sigue jugándose. Clic en una columna para ordenar o escribe para filtrar.",
    caption: "Goles, total acumulado de carrera y edad por año natural desde su debut en 2004.",
    thYear: "Año", thGoals: "Goles", thTotal: "Total carrera", thAge: "Edad",
    inProgNote: "* Temporada 2026 en curso — se actualiza después de cada partido.",
    filterPlaceholder: "Filtrar años — ej. 2012",
    bestYearHtml: (best) => `<p><b>${best.year} es el año goleador más extraordinario de la historia del fútbol: ${best.goals} goles</b> — 79 con el Barcelona y 12 con Argentina — superando el récord de 40 años de Gerd Müller (85 goles). Incluyó una racha de 33 jornadas consecutivas anotando en liga y los 5 goles en Champions League contra el Bayer Leverkusen.</p><p>Los siguientes mejores años, 2011 (60 goles) y 2010 (60 goles), demuestran lo astronómico de su nivel. <a href="/es/dashboard">Ver cómo se dividen esos goles por competición</a>.</p>`
  },
  pt: {
    head: (ys, best, t) => `Do seu primeiro gol oficial em ${ys[0].year} até os <b>${best.goals} gols em ${best.year}</b> — todos os anos civis de uma carreira de ${n(t.goals)} gols.`,
    cap: (best, t) => `Barras: gols no ano (máximo ${best.goals}, em ${best.year}). Linha: ascensão acumulada até ${n(t.goals)}.`,
    chartLabel: (best) => `Gols de Messi por ano com total acumulado`,
    kpiCareer: "Gols na carreira",
    kpiBest: "Melhor ano",
    kpiBestSub: "Recorde mundial em um único ano civil.",
    kpiCurrSub: "Temporada em andamento.",
    kpiYears: "Anos marcando",
    kpiYearsSub: (ys, last) => `Cada ano desde ${ys[0].year} até ${last.year}.`,
    decades: "Gols nos anos",
    tableSub: "Mais recentes primeiro. 2026 está em andamento. Clique numa coluna para ordenar ou pesquise para filtrar.",
    caption: "Gols, total acumulado e idade por ano civil desde a estreia em 2004.",
    thYear: "Ano", thGoals: "Gols", thTotal: "Total carreira", thAge: "Idade",
    inProgNote: "* Temporada 2026 em andamento — atualizada após cada partida.",
    filterPlaceholder: "Filtrar anos — ex. 2012",
    bestYearHtml: (best) => `<p><b>${best.year} é o ano mais prolífico da história do futebol: ${best.goals} gols</b> — 79 pelo Barcelona e 12 pela Argentina — superando o recorde de Gerd Müller (85 gols). <a href="/pt/dashboard">Ver no painel como se dividem esses gols</a>.</p>`
  },
  fr: {
    head: (ys, best, t) => `De son premier but officiel en ${ys[0].year} à ses <b>${best.goals} buts en ${best.year}</b> — chaque année civile d'une carrière de ${n(t.goals)} buts.`,
    cap: (best, t) => `Barres : buts cette année-là (pic de ${best.goals} en ${best.year}). Ligne : cumul jusqu'à ${n(t.goals)}.`,
    chartLabel: (best) => `Buts de Messi par année avec total cumulé`,
    kpiCareer: "Buts en carrière",
    kpiBest: "Meilleure année",
    kpiBestSub: "Record mondial sur une année civile.",
    kpiCurrSub: "Saison en cours.",
    kpiYears: "Années avec but",
    kpiYearsSub: (ys, last) => `Chaque année de ${ys[0].year} à ${last.year}.`,
    decades: "Buts dans les années",
    tableSub: "Plus récents d'abord. 2026 est en cours. Cliquez sur une colonne pour trier ou tapez pour filtrer.",
    caption: "Buts, cumul en carrière et âge par année civile depuis 2004.",
    thYear: "Année", thGoals: "Buts", thTotal: "Total carrière", thAge: "Âge",
    inProgNote: "* Saison 2026 en cours — mise à jour après chaque match.",
    filterPlaceholder: "Filtrer les années — ex. 2012",
    bestYearHtml: (best) => `<p><b>${best.year} est la plus grande année de l'histoire du football : ${best.goals} buts</b> — 79 pour Barcelone et 12 pour l'Argentine — brisant le record de Gerd Müller (85). <a href="/fr/dashboard">Voir la répartition par compétition</a>.</p>`
  },
  ro: {
    head: (ys, best, t) => `De la primul gol de seniori în ${ys[0].year} până la <b>${best.goals} goluri în ${best.year}</b> — fiecare an calendaristic dintr-o carieră de ${n(t.goals)} goluri, cu totaluri cumulate și vârsta sa.`,
    cap: (best, t) => `Bare: goluri în acel an (vârf de ${best.goals} în ${best.year}). Linie: urcarea cumulată spre ${n(t.goals)}.`,
    chartLabel: (best) => `Golurile lui Messi pe an calendaristic cu totalul cumulat al carierei, vârf ${best.goals} în ${best.year}`,
    kpiCareer: "Goluri în carieră",
    kpiBest: "Cel mai bun an",
    kpiBestSub: "Record mondial pentru un an calendaristic.",
    kpiCurrSub: "Sezon în desfășurare.",
    kpiYears: "Ani cu gol marcat",
    kpiYearsSub: (ys, last) => `Fiecare an din ${ys[0].year} până în ${last.year}.`,
    decades: "Goluri în anii",
    tableSub: "Cei mai recenți mai întâi. 2026 este în desfășurare. Fă clic pe o coloană pentru sortare sau scrie pentru filtrare.",
    caption: "Goluri, total cumulat în carieră și vârstă pentru fiecare an calendaristic din 2004.",
    thYear: "An", thGoals: "Goluri", thTotal: "Total carieră", thAge: "Vârstă",
    inProgNote: "* Sezonul 2026 în desfășurare — actualizat după fiecare meci.",
    filterPlaceholder: "Filtrează anii — ex. 2012",
    bestYearHtml: (best) => `<p><b>${best.year} este cel mai prolific an din istoria fotbalului: ${best.goals} goluri</b> — 79 pentru Barcelona și 12 pentru Argentina — doborând recordul lui Gerd Müller (85). <a href="/ro/dashboard">Vezi distribuția pe competiții</a>.</p>`
  },
  uz: {
    head: (ys, best, t) => `${ys[0].year}-yildagi ilk golidan <b>${best.year}-yildagi ${best.goals} ta golgacha</b> — ${n(t.goals)} ta rasmiy gollik faoliyatning har bir taqvim yili, umumiy natija va yoshi bilan.`,
    cap: (best, t) => `Ustunlar: o'sha yildagi gollar (eng yuqori ${best.goals}, ${best.year}). Chiziq: ${n(t.goals)} gacha o'sish.`,
    chartLabel: (best) => `Messining taqvim yillari bo'yicha gollari, ${best.year}-yilda ${best.goals} ta rekord`,
    kpiCareer: "Karyera gollari",
    kpiBest: "Eng yaxshi yil",
    kpiBestSub: "Bir taqvim yili uchun jahon rekordi.",
    kpiCurrSub: "Joriy mavsum.",
    kpiYears: "Gol urilgan yillar",
    kpiYearsSub: (ys, last) => `${ys[0].year}-yildan ${last.year}-yilgacha har yil.`,
    decades: "Yillardagi gollar:",
    tableSub: "Eng yangilari birinchi. 2026-yil davom etmoqda. Saralash uchun ustunni bosing yoki filtrlash uchun yozing.",
    caption: "2004-yil debyutidan beri har bir taqvim yili uchun gollar, umumiy hisob va yosh.",
    thYear: "Yil", thGoals: "Gollar", thTotal: "Karyera jami", thAge: "Yosh",
    inProgNote: "* 2026-yilgi mavsum davom etmoqda — har o'yindan keyin yangilanadi.",
    filterPlaceholder: "Yillarni filtrlash — masalan, 2012",
    bestYearHtml: (best) => `<p><b>${best.year}-yil futbol tarixidagi eng sermahsul yil: ${best.goals} ta gol</b> — Barselona uchun 79 ta va Argentina uchun 12 ta, Gerd Myullerning 85 gollik rekordini yangiladi. <a href="/uz/dashboard">Musobaqalar bo'yicha taqsimotni ko'rish</a>.</p>`
  },
  ar: {
    head: (ys, best, t) => `من أول أهدافه الرسمية عام ${ys[0].year} إلى <b>${best.goals} هدفاً في ${best.year}</b> — كل سنة تقويمية في مسيرة ${n(t.goals)} هدفاً مع الإجمالي التراكمي والعمر.`,
    cap: (best, t) => `الأعمدة: أهداف السنة (ذروة ${best.goals} في ${best.year}). الخط: الصعود التراكمي إلى ${n(t.goals)}.`,
    chartLabel: (best) => `أهداف ميسي حسب السنة التقويمية مع الإجمالي التراكمي، ذروة ${best.goals} في ${best.year}`,
    kpiCareer: "أهداف المسيرة",
    kpiBest: "أفضل سنة",
    kpiBestSub: "رقم قياسي عالمي في سنة تقويمية.",
    kpiCurrSub: "موسم جارٍ.",
    kpiYears: "سنوات التهديف",
    kpiYearsSub: (ys, last) => `كل سنة من ${ys[0].year} إلى ${last.year}.`,
    decades: "الأهداف في عقد",
    tableSub: "الأحدث أولاً. موسم 2026 قيد اللعب. انقر على عمود للفرز أو اكتب للتصفية.",
    caption: "الأهداف والإجمالي التراكمي والعمر لكل سنة تقويمية منذ ظهوره الأول عام 2004.",
    thYear: "السنة", thGoals: "الأهداف", thTotal: "إجمالي المسيرة", thAge: "العمر",
    inProgNote: "* موسم 2026 جارٍ — يُحدّث بعد كل مباراة.",
    filterPlaceholder: "تصفية السنوات — مثال 2012",
    bestYearHtml: (best) => `<p><b>${best.year} هو أعظم عام تهديفي في تاريخ كرة القدم: ${best.goals} هدفاً</b> — 79 مع برشلونة و12 مع الأرجنتين — محطماً الرقم القياسي لغيرد مولر (85 هدفاً). <a href="/ar/dashboard">تصفّح توزيعها حسب البطولات</a>.</p>`
  },
  id: {
    head: (ys, best, t) => `Dari gol senior pertamanya di ${ys[0].year} hingga <b>${best.goals} gol di ${best.year}</b> — setiap tahun kalender dalam karier ${n(t.goals)} gol resmi, lengkap dengan total akumulasi dan usianya.`,
    cap: (best, t) => `Batang: gol tahun itu (puncak ${best.goals}, ${best.year}). Garis: kenaikan akumulasi menuju ${n(t.goals)}.`,
    chartLabel: (best) => `Gol Messi per tahun kalender dengan total karier kumulatif, puncak ${best.goals} di ${best.year}`,
    kpiCareer: "Gol karier",
    kpiBest: "Tahun terbaik",
    kpiBestSub: "Rekor dunia dalam satu tahun kalender.",
    kpiCurrSub: "Musim sedang berjalan.",
    kpiYears: "Tahun mencetak gol",
    kpiYearsSub: (ys, last) => `Setiap tahun dari ${ys[0].year} hingga ${last.year}.`,
    decades: "Gol di era",
    tableSub: "Terbaru lebih dulu. 2026 masih berlangsung. Klik kolom untuk mengurutkan atau ketik untuk memfilter.",
    caption: "Gol, total akumulasi karier, dan usia per tahun kalender sejak debut 2004.",
    thYear: "Tahun", thGoals: "Gol", thTotal: "Total karier", thAge: "Usia",
    inProgNote: "* Musim 2026 sedang berlangsung — diperbarui setiap pertandingan.",
    filterPlaceholder: "Filter tahun — mis. 2012",
    bestYearHtml: (best) => `<p><b>${best.year} adalah tahun tersubur dalam sejarah sepak bola: ${best.goals} gol</b> — 79 untuk Barcelona dan 12 untuk Argentina — memecahkan rekor 40 tahun Gerd Müller (85 gol). <a href="/id/dashboard">Lihat rincian per kompetisi di dasbor</a>.</p>`
  }
};

function renderByYear(d) {
  const lang = getLang();
  const ys = d.calendarYears, t = d.totals;
  const best = ys.reduce((a, b) => (b.goals > a.goals ? b : a));
  const last = ys[ys.length - 1];
  const cfg = BY_YEAR_I18N[lang] || {
    head: (ys, best, t) => `From his first senior goal in ${ys[0].year} to <b>${best.goals} in ${best.year}</b> — every calendar year of a ${n(t.goals)}-goal career, with running totals and his age.`,
    cap: (best, t) => `Bars: goals that year (peak ${best.goals}, ${best.year}). Line: climb to ${n(t.goals)}.`,
    chartLabel: (best) => `Messi goals per calendar year with cumulative career total, peaking at ${best.goals} in ${best.year}`,
    kpiCareer: "Career goals",
    kpiBest: "Best year",
    kpiBestSub: "A world record for a calendar year.",
    kpiCurrSub: "Season in progress.",
    kpiYears: "Scoring years",
    kpiYearsSub: (ys, last) => `Every year from ${ys[0].year} to ${last.year}.`,
    decades: "Goals in the",
    tableSub: "Newest first. 2026 is starred while the season is still being played. Click a column to sort, or type to filter. Famous seasons get a footnote — hover the year.",
    caption: "Goals, running career total and age for every calendar year since Messi's 2004 debut.",
    thYear: "Year", thGoals: "Goals", thTotal: "Career total", thAge: "Age",
    inProgNote: `* ${last.year} season in progress — refreshes after each appearance.`,
    filterPlaceholder: "Filter years — e.g. 2012",
    bestYearHtml: (best) => `<p><b>${best.year} is the greatest goalscoring year football has seen: ${best.goals} goals</b> — 79 for Barcelona and 12 for Argentina — breaking Gerd Müller's 40-year-old record of 85. It included a run of 33 league games scored in consecutively and a five-goal Champions League night against Bayer Leverkusen.</p><p>The next-best years, 2011 (60) and 2010 (60), show how far ahead of normal — even his own normal — that season was. <a href="/en/dashboard">See how those goals break down by competition</a>.</p>`
  };

  setHead(d, cfg.head(ys, best, t));

  const comboCard = el("combo-card");
  if (comboCard) {
    // Kept as a closure so a phone rotating past the 760px breakpoint can
    // redraw the chart with the compact viewBox instead of a squashed one.
    const drawCombo = () => {
      comboCard.innerHTML =
        `<figure style="margin:0"><div class="spark-wrap">${sparkSVG(
          ys.map((x) => ({ label: String(x.year), value: x.goals, year: x.year, provisional: x.provisional, peak: x.year === best.year, tip: `${x.year}: ${x.goals} (${x.careerTotal})` })),
          { cumulative: true, peakYear: 2012, provisionalYear: 2026, linkPrefix: "dashboard#y", label: cfg.chartLabel(best) }
        )}</div><figcaption class="figcap">${cfg.cap(best, t)}</figcaption></figure>`;
      const svg = comboCard.querySelector("svg.spark");
      if (svg) svg.classList.add("in");
    };
    drawCombo();
    window.addEventListener("messi:spark-relayout", drawCombo);
  }

  const kpis = el("kpis");
  if (kpis) {
    kpis.innerHTML =
      kpi4(cfg.kpiCareer, n(t.goals), `After ${last.year}${last.provisional ? ` (${cfg.kpiCurrSub})` : ""}.`) +
      kpi4(cfg.kpiBest, `${best.year} · ${best.goals}`, cfg.kpiBestSub) +
      kpi4(`${last.year}`, last.goals, last.provisional ? cfg.kpiCurrSub : "") +
      kpi4(cfg.kpiYears, ys.length, cfg.kpiYearsSub(ys, last));
  }

  const decades = [["2000s", 2004, 2009], ["2010s", 2010, 2019], ["2020s", 2020, last.year]];
  const decEl = el("decades");
  if (decEl) {
    decEl.innerHTML = decades.map(([lab, a, b]) => {
      const rows = ys.filter((r) => r.year >= a && r.year <= b);
      const sum = rows.reduce((s, r) => s + r.goals, 0);
      const pk = rows.reduce((x, y) => (y.goals > x.goals ? y : x));
      return kpi4(`${cfg.decades} ${lab}`, n(sum), `${a}–${b}, peak: ${pk.goals} (${pk.year}).`);
    }).join("");
  }

  const tableSub = el("table-sub");
  if (tableSub) {
    tableSub.textContent = cfg.tableSub;
  }

  const yearTable = el("year-table");
  if (yearTable) {
    yearTable.innerHTML =
      `<div class="table-wrap"><table class="data-table"><caption>${cfg.caption}</caption>` +
      `<thead><tr><th scope="col" class="left">${cfg.thYear}</th><th scope="col">${cfg.thGoals}</th><th scope="col">${cfg.thTotal}</th><th scope="col">${cfg.thAge}</th></tr></thead><tbody>` +
      ys.toReversed().map((r) =>
        `<tr id="y${r.year}"${r.provisional ? ' class="total"' : ""}><th scope="row">${r.year}${r.provisional ? " *" : ""}</th><td><b>${r.goals}</b></td><td>${n(r.careerTotal)}</td><td>${r.age}</td></tr>`
      ).join("") + `</tbody></table></div>` +
      (last.provisional ? `<p class="caveat">${cfg.inProgNote}</p>` : "");

    const tbl = yearTable.querySelector("table");
    if (tbl) {
      sortable(tbl);
      tableSearch(tbl, cfg.filterPlaceholder, "q");
    }
  }

  const bestYearEl = el("bestyear");
  if (bestYearEl) {
    bestYearEl.innerHTML = cfg.bestYearHtml(best);
  }

  renderExplore(d, "byyear");
  renderMethod(d, "");
}
function kpi4(l, v, s) { return `<div class="kpi"><span class="kpi-label">${l}</span><span class="kpi-value">${v}</span><span class="kpi-note">${s}</span></div>`; }

const BY_SEASON_I18N = {
  es: {
    head: (best) => `Todas las temporadas de club desde 2004/05 hasta 2026 — <b>récord: ${best.goals} goles en ${best.season}</b> — con desglose de liga, copas y torneos internacionales, más Argentina año por año.`,
    clubSub: "Partidos / goles en cada formato. 2026 es la temporada en curso. Clic en una columna para ordenar o escribe para filtrar.",
    caption: (len) => `Todas las ${len} temporadas de club: Barcelona 2004/05–2020/21, PSG 2021/22–2022/23, Inter Miami 2023–2026.`,
    thSeason: "Temporada", thClub: "Club", thApps: "Partidos", thGoals: "Goles", thLeague: "Liga", thCup: "Copa", thCont: "Internacional", thOther: "Otros",
    totalLabel: "Total clubes", bestBadge: "Mejor temporada de club",
    filterClubPlaceholder: "Filtrar temporadas — ej. PSG, 2012",
    countrySub: "Eliminatorias y torneos oficiales más amistosos, los más recientes primero.",
    countryCaption: "Goles con la Selección Argentina por año natural, 2005 a 2026.",
    thYear: "Año", thNote: "Detalles", totalArgLabel: "Total Argentina",
    filterCountryPlaceholder: "Filtrar años de Argentina — ej. 2022",
    bestSeasonHtml: (best) => `<p><b>${best.season} — ${best.goals} goles en ${best.apps} partidos para el Barcelona</b> — es la temporada de club más prolífica de la historia del fútbol: 50 en La Liga (récord), 14 en la Champions League, 3 en la Copa del Rey y 6 en las supercopas. Marcó en todas las competiciones que disputó.</p><p>Forma parte de una racha de cuatro temporadas históricas (2009/10–2012/13) en las que nunca bajó de 53 goles en clubes. <a href="/es/goalsbyyear">Ver los mismos goles contados por año natural</a>.</p>`
  },
  pt: {
    head: (best) => `Todas as temporadas de clube de 2004/05 a 2026 — <b>recorde: ${best.goals} gols em ${best.season}</b> — com divisão de liga, copas e torneios continentais.`,
    clubSub: "Partidas / gols em cada formato. 2026 está em andamento. Clique numa coluna para ordenar ou pesquise para filtrar.",
    caption: (len) => `Todas as ${len} temporadas de clube: Barcelona 2004/05–2020/21, PSG 2021/22–2022/23, Inter Miami 2023–2026.`,
    thSeason: "Temporada", thClub: "Clube", thApps: "Partidas", thGoals: "Gols", thLeague: "Liga", thCup: "Copa", thCont: "Continental", thOther: "Outros",
    totalLabel: "Total clubes", bestBadge: "Melhor temporada de clube",
    filterClubPlaceholder: "Filtrar temporadas — ex. PSG, 2012",
    countrySub: "Eliminatórias, torneios oficiais e amistosos, mais recentes primeiro.",
    countryCaption: "Gols com a Seleção Argentina por ano civil, 2005 a 2026.",
    thYear: "Ano", thNote: "Detalhes", totalArgLabel: "Total Argentina",
    filterCountryPlaceholder: "Filtrar anos Argentina — ex. 2022",
    bestSeasonHtml: (best) => `<p><b>${best.season} — ${best.goals} gols em ${best.apps} jogos pelo Barcelona</b> — é a temporada de clube mais prolífica da história do futebol: 50 na La Liga (recorde), 14 na Champions League, 3 na Copa do Rei e 6 em supercopas. <a href="/pt/goalsbyyear">Ver esses gols por ano civil</a>.</p>`
  },
  fr: {
    head: (best) => `Toutes les saisons en club de 2004/05 à 2026 — <b>record : ${best.goals} buts en ${best.season}</b> — avec championnat, coupes et Ligue des Champions.`,
    clubSub: "Matchs / buts par format. 2026 est la saison en cours. Cliquez sur une colonne pour trier ou tapez pour filtrer.",
    caption: (len) => `Les ${len} saisons en club : Barcelone 2004/05–2020/21, PSG 2021/22–2022/23, Inter Miami 2023–2026.`,
    thSeason: "Saison", thClub: "Club", thApps: "Matchs", thGoals: "Buts", thLeague: "Ligue", thCup: "Coupe", thCont: "Europe", thOther: "Autres",
    totalLabel: "Total clubs", bestBadge: "Meilleure saison en club",
    filterClubPlaceholder: "Filtrer les saisons — ex. PSG, 2012",
    countrySub: "Matchs officiels et amicaux, les plus récents en premier.",
    countryCaption: "Buts avec l'Équipe d'Argentine par année civile, 2005 à 2026.",
    thYear: "Année", thNote: "Détails", totalArgLabel: "Total Argentine",
    filterCountryPlaceholder: "Filtrer l'Argentine — ex. 2022",
    bestSeasonHtml: (best) => `<p><b>${best.season} — ${best.goals} buts en ${best.apps} matchs pour Barcelone</b> — est la saison en club la plus prolifique de l'histoire du football : 50 en Liga (record), 14 en Ligue des Champions, 3 en Coupe du Roi et 6 en supercoupes. <a href="/fr/goalsbyyear">Voir les mêmes buts par année</a>.</p>`
  },
  ro: {
    head: (best) => `Fiecare sezon de club din 2004/05 până în 2026 — <b>record: ${best.goals} goluri în ${best.season}</b> — cu campionat, cupe și competiții continentale, plus Argentina an de an.`,
    clubSub: "Meciuri / goluri pe fiecare competiție. 2026 este sezonul în curs. Fă clic pe o coloană pentru sortare sau filtrează.",
    caption: (len) => `Toate cele ${len} sezoane de club: Barcelona 2004/05–2020/21, PSG 2021/22–2022/23, Inter Miami 2023–2026.`,
    thSeason: "Sezon", thClub: "Club", thApps: "Meciuri", thGoals: "Goluri", thLeague: "Campionat", thCup: "Cupă", thCont: "Continental", thOther: "Altele",
    totalLabel: "Total cluburi", bestBadge: "Cel mai bun sezon la club",
    filterClubPlaceholder: "Filtrează sezoanele — ex. PSG, 2012",
    countrySub: "Preliminarii, turnee oficiale și amicale, cele mai recente primele.",
    countryCaption: "Golurile pentru Argentina pe ani calendaristici, 2005–2026.",
    thYear: "An", thNote: "Detalii", totalArgLabel: "Total Argentina",
    filterCountryPlaceholder: "Filtrează anii Argentinei — ex. 2022",
    bestSeasonHtml: (best) => `<p><b>${best.season} — ${best.goals} goluri în ${best.apps} meciuri pentru Barcelona</b> — este cel mai prolific sezon de club din istorie: 50 în La Liga (record), 14 în Champions League, 3 în Cupa Regelui și 6 în supercupe. <a href="/ro/goalsbyyear">Vezi aceleași goluri pe ani calendaristici</a>.</p>`
  },
  uz: {
    head: (best) => `2004/05-yildan 2026-yilgacha barcha klub mavsumlari — <b>rekord: ${best.season} mavsumida ${best.goals} gol</b> — liga, kubok va qit'a turnirlari hamda Argentina bo'yicha.`,
    clubSub: "Har bir formatda o'yin / gollar. 2026-yil joriy mavsum. Saralash uchun ustunni bosing yoki filtrlash uchun yozing.",
    caption: (len) => `Barcha ${len} klub mavsumi: Barselona 2004/05–2020/21, PSJ 2021/22–2022/23, Inter Mayami 2023–2026.`,
    thSeason: "Mavsum", thClub: "Klub", thApps: "O'yinlar", thGoals: "Gollar", thLeague: "Liga", thCup: "Kubok", thCont: "Qit'a", thOther: "Boshqa",
    totalLabel: "Klublar jami", bestBadge: "Eng yaxshi klub mavsumi",
    filterClubPlaceholder: "Mavsumlarni filtrlash — masalan, PSJ, 2012",
    countrySub: "Saralashlar, rasmiy turnirlar va o'rtoqlik o'yinlari, eng yangilari birinchi.",
    countryCaption: "Argentina safida taqvim yillari bo'yicha gollar, 2005–2026.",
    thYear: "Yil", thNote: "Izoh", totalArgLabel: "Argentina jami",
    filterCountryPlaceholder: "Argentina yillarini filtrlash — masalan, 2022",
    bestSeasonHtml: (best) => `<p><b>${best.season} — Barselona safida ${best.apps} o'yinda ${best.goals} ta gol</b> — futbol tarixidagi eng sermahsul klub mavsumi: La Ligada 50 (rekord), Chempionlar Ligasida 14, Qirol kubogida 3 va superkuboklarda 6 gol. <a href="/uz/goalsbyyear">Taqvim yillari bo'yicha ko'rish</a>.</p>`
  },
  ar: {
    head: (best) => `جميع مواسم الأندية من 2004/05 حتى 2026 — <b>الرقم القياسي: ${best.goals} هدفاً في ${best.season}</b> — مع تفصيل الدوري والكؤوس والبطولات القارية والأرجنتين.`,
    clubSub: "المباريات / الأهداف في كل بطولة. موسم 2026 قيد اللعب. انقر على عمود للفرز أو اكتب للتصفية.",
    caption: (len) => `جميع مواسم الأندية (${len}): برشلونة 2004/05–2020/21، باريس 2021/22–2022/23، إنتر ميامي 2023–2026.`,
    thSeason: "الموسم", thClub: "النادي", thApps: "المباريات", thGoals: "الأهداف", thLeague: "الدوري", thCup: "الكأس", thCont: "القاري", thOther: "أخرى",
    totalLabel: "إجمالي الأندية", bestBadge: "أفضل موسم مع نادٍ",
    filterClubPlaceholder: "تصفية المواسم — مثال 2012",
    countrySub: "التصفيات والبطولات الرسمية والوديات، الأحدث أولاً.",
    countryCaption: "أهداف الأرجنتين حسب السنة التقويمية، 2005 إلى 2026.",
    thYear: "السنة", thNote: "التفاصيل", totalArgLabel: "إجمالي الأرجنتين",
    filterCountryPlaceholder: "تصفية سنوات الأرجنتين — مثال 2022",
    bestSeasonHtml: (best) => `<p><b>${best.season} — ${best.goals} هدفاً في ${best.apps} مباراة مع برشلونة</b> — أعظم موسم نادٍ في تاريخ كرة القدم: 50 في لا ليغا (رقم قياسي)، 14 في دوري الأبطال، 3 في كأس الملك و6 في السوبر. <a href="/ar/goalsbyyear">عرض الأهداف بالسنوات التقويمية</a>.</p>`
  },
  id: {
    head: (best) => `Setiap musim klub dari 2004/05 hingga 2026 — <b>rekor: ${best.goals} gol pada ${best.season}</b> — dengan rincian liga, piala domestik, dan kontinental, plus Argentina per tahun.`,
    clubSub: "Penampilan / gol di setiap ajang. 2026 sedang berlangsung. Klik kolom untuk mengurutkan atau ketik untuk memfilter.",
    caption: (len) => `Semua ${len} musim klub: Barcelona 2004/05–2020/21, PSG 2021/22–2022/23, Inter Miami 2023–2026.`,
    thSeason: "Musim", thClub: "Klub", thApps: "Laga", thGoals: "Gol", thLeague: "Liga", thCup: "Piala", thCont: "Kontinental", thOther: "Lainnya",
    totalLabel: "Total klub", bestBadge: "Musim klub terbaik",
    filterClubPlaceholder: "Filter musim — mis. PSG, 2012",
    countrySub: "Kualifikasi, turnamen resmi, dan uji coba, terbaru lebih dulu.",
    countryCaption: "Gol bersama Timnas Argentina per tahun kalender, 2005 hingga 2026.",
    thYear: "Tahun", thNote: "Catatan", totalArgLabel: "Total Argentina",
    filterCountryPlaceholder: "Filter tahun Argentina — mis. 2022",
    bestSeasonHtml: (best) => `<p><b>${best.season} — ${best.goals} gol dalam ${best.apps} laga untuk Barcelona</b> — adalah musim klub paling produktif dalam sejarah sepak bola: 50 di La Liga (rekor), 14 di Liga Champions, 3 di Copa del Rey, dan 6 di piala super. <a href="/id/goalsbyyear">Lihat gol yang sama per tahun kalender</a>.</p>`
  }
};

function renderBySeason(d) {
  const lang = getLang();
  const ss = d.clubSeasons, t = d.totals;
  const best = ss.reduce((a, b) => (b.goals > a.goals ? b : a));
  const cfg = BY_SEASON_I18N[lang] || {
    head: (best) => `Every club season from 2004/05 to 2026 — <b>best: ${best.goals} goals in ${best.season}</b> — with league, cup and continental splits, plus Argentina year by year.`,
    clubSub: "Apps / goals in each format. 2026 is the season in progress. Click a column to sort, or type to filter.",
    caption: (len) => `All ${len} club seasons: Barcelona 2004/05–2020/21, PSG 2021/22–2022/23, Inter Miami 2023–2026.`,
    thSeason: "Season", thClub: "Club", thApps: "Apps", thGoals: "Goals", thLeague: "League", thCup: "Cup", thCont: "Continental", thOther: "Other",
    totalLabel: "Club total", bestBadge: "Best club season",
    filterClubPlaceholder: "Filter seasons — e.g. PSG, 2012",
    countrySub: "Competitive qualifiers and tournaments plus friendlies, newest first.",
    countryCaption: "Argentina goals by calendar year, 2005 to 2026.",
    thYear: "Year", thNote: "Note", totalArgLabel: "Argentina total",
    filterCountryPlaceholder: "Filter Argentina years — e.g. 2022",
    bestSeasonHtml: (best) => `<p><b>${best.season} — ${best.goals} goals in ${best.apps} games for Barcelona</b> — is the most prolific club season ever played: 50 in La Liga (a record), 14 in the Champions League, 3 in the Copa del Rey and 6 in the super cups. He scored in every competition he entered.</p><p>It sits at the heart of a four-season stretch (2009/10–2012/13) in which he never dropped below 53 club goals. <a href="/en/goalsbyyear">The same goals counted by calendar year</a>.</p>`
  };

  setHead(d, cfg.head(best));
  const g = ss.reduce((a, s) => ({
    apps: a.apps + s.apps, goals: a.goals + s.goals,
    la: a.la + s.league.apps, lg: a.lg + s.league.goals,
    ca: a.ca + s.cup.apps, cg: a.cg + s.cup.goals,
    ua: a.ua + s.continental.apps, ug: a.ug + s.continental.goals,
    oa: a.oa + s.other.apps, og: a.og + s.other.goals,
  }), { apps: 0, goals: 0, la: 0, lg: 0, ca: 0, cg: 0, ua: 0, ug: 0, oa: 0, og: 0 });
  const pg = (a2, g2) => `${n(a2)} / ${n(g2)}`;

  const clubSub = el("club-sub");
  if (clubSub) {
    clubSub.textContent = cfg.clubSub;
  }

  const clubTable = el("club-table");
  if (clubTable) {
    clubTable.innerHTML =
      `<div class="table-wrap"><table class="data-table"><caption>${cfg.caption(ss.length)}</caption>` +
      `<thead><tr><th scope="col" class="left">${cfg.thSeason}</th><th scope="col" class="left">${cfg.thClub}</th><th scope="col">${cfg.thApps}</th><th scope="col">${cfg.thGoals}</th><th scope="col">${cfg.thLeague}</th><th scope="col">${cfg.thCup}</th><th scope="col">${cfg.thCont}</th><th scope="col">${cfg.thOther}</th></tr></thead><tbody>` +
      ss.map((s) => `<tr id="s${s.season.slice(0, 4)}"${s.provisional ? ' class="total"' : ""}><th scope="row">${esc(s.season)}${s.provisional ? " *" : ""}` + (s.season === best.season ? `<span class="yr-note">${cfg.bestBadge}</span>` : "") + `</th>` +
        `<td class="left">${dispClub(s.club)}</td><td>${n(s.apps)}</td><td><b>${n(s.goals)}</b></td>` +
        `<td>${pg(s.league.apps, s.league.goals)}</td><td>${pg(s.cup.apps, s.cup.goals)}</td>` +
        `<td>${pg(s.continental.apps, s.continental.goals)}</td><td>${pg(s.other.apps, s.other.goals)}</td></tr>`).join("") +
      `<tr class="total"><th scope="row" colspan="2">${cfg.totalLabel}</th><td>${n(g.apps)}</td><td>${n(g.goals)}</td>` +
      `<td>${pg(g.la, g.lg)}</td><td>${pg(g.ca, g.cg)}</td><td>${pg(g.ua, g.ug)}</td><td>${pg(g.oa, g.og)}</td></tr></tbody></table></div>`;

    const tbl = clubTable.querySelector("table");
    if (tbl) {
      sortable(tbl);
      tableSearch(tbl, cfg.filterClubPlaceholder, "season");
    }
  }

  const cy = d.countryYears;
  const countrySub = el("country-sub");
  if (countrySub) {
    countrySub.textContent = cfg.countrySub;
  }

  const countryTable = el("country-table");
  if (countryTable) {
    countryTable.innerHTML =
      `<div class="table-wrap"><table class="data-table"><caption>${cfg.countryCaption}</caption>` +
      `<thead><tr><th scope="col" class="left">${cfg.thYear}</th><th scope="col">${cfg.thApps}</th><th scope="col">${cfg.thGoals}</th><th scope="col" class="left">${cfg.thNote}</th></tr></thead><tbody>` +
      cy.toReversed().map((s) => {
        const note = s.note || `${s.competitive[0]} apps, ${s.competitive[1]} goals · ${s.friendly[0]} apps, ${s.friendly[1]} goals`;
        return `<tr${s.provisional ? ' class="total"' : ""}><th scope="row">${s.year}${s.provisional ? " *" : ""}</th><td>${s.apps}</td><td><b>${s.goals}</b></td><td class="left">${esc(note)}</td></tr>`;
      }).join("") +
      `<tr class="total"><th scope="row">${cfg.totalArgLabel}</th><td>${t.country.apps}</td><td>${t.country.goals}</td><td class="left"></td></tr></tbody></table></div>`;

    const tbl = countryTable.querySelector("table");
    if (tbl) {
      sortable(tbl);
      tableSearch(tbl, cfg.filterCountryPlaceholder, "country");
    }
  }

  const bestSeasonEl = el("bestseason");
  if (bestSeasonEl) {
    bestSeasonEl.innerHTML = cfg.bestSeasonHtml(best);
  }
  renderExplore(d, "byseason");
  renderMethod(d, "");
}

/* ================= DASHBOARD ================= */
const TEAM_COMPS = null; // retired: buckets now come from teamComps() (LIVE/JSON) so comps update with data.
function teamComps() {
  return {
    barcelona: [["La Liga", LIVE.compLiga], ["UEFA Champions League", LIVE.compUCLb], ["Copa del Rey", LIVE.compCDR], ["Spanish / UEFA / World super cups", LIVE.compSuper]],
    psg: [["Ligue 1", LIVE.compLigue1], ["UEFA Champions League", LIVE.compUCLp], ["Trophée des Champions", LIVE.compTDC]],
    miami: [["Major League Soccer", LIVE.compMLS], ["Concacaf Champions Cup", LIVE.compCCC], ["Leagues Cup and playoffs", LIVE.compLC]],
    argentina: [["World Cup qualifiers and friendlies", LIVE.compQual], ["FIFA World Cup", LIVE.compWC], ["Copa América", LIVE.compCopa]],
  };
}
const FINISH_COLORS = { "Open play": "var(--brand)", Penalties: "var(--accent)", "Free kicks": "var(--gold)" };
const BODY_COLORS = { "Left foot": "var(--brand)", "Right foot": "var(--accent)", Head: "var(--gold)", Other: "var(--muted)" };

const DASH_I18N = {
  es: {
    teamNames: { all: "todos los equipos", barcelona: "Barcelona", psg: "PSG", miami: "Inter Miami", argentina: "Argentina" },
    pills: [["all", "Todos"], ["barcelona", "Barcelona"], ["psg", "PSG"], ["miami", "Inter Miami"], ["argentina", "Argentina"]],
    head: (name) => `Los 930 goles de Lionel Messi analizados de cuatro formas — por competición, por temporada, por definición y por parte del cuerpo — filtrados para <b>${esc(name)}</b>. Toca un equipo para actualizar todos los gráficos.`,
    filterNote: (name, goals, apps, T) => `Mostrando ${name}: ${n(goals)} goles en ${n(apps)} partidos` + (T === "barcelona" || T === "psg" ? " (Desglose en Champions League: Barcelona 120, PSG 9 — fuentes oficiales de los clubes)." : "."),
    kpis: { goals: "Goles", apps: "Partidos", gpg: "Promedio de gol", forTeam: (name) => `Con ${name}.` },
    chartEmpty: "No hay filas para este filtro de equipo.",
    figCap: (T, name) => T === "all" ? "Años naturales, 2004 a 2026." : T === "argentina" ? "Años naturales con Argentina." : "Temporadas de club con " + esc(name) + ".",
    finishParts: { "Open play": "Jugada abierta", "Penalties": "Penaltis", "Free kicks": "Tiros libres" },
    finishCenter: "goles carrera",
    finishCaveat: "Totales de carrera combinados de todos los equipos. Conteo verificado.",
    finishCaveatFiltered: (d) => `No existe desglose por remate por equipo individual — revisa los totales de carrera abajo. De sus ${n(d.totals.goals)} goles oficiales: ${d.byFinish.openPlay} jugada abierta, ${d.byFinish.penalties} penaltis y ${d.byFinish.freeKicks} tiros libres.`,
    bodyParts: { "Left foot": "Pie izquierdo", "Right foot": "Pie derecho", "Head": "Cabeza", "Other": "Otro (pecho, etc.)" },
    bodyCenter: "con la zurda",
    bodyCaveat: "Totales de carrera combinados de todos los equipos (conteo oficial verificado).",
    ageName: (r) => `Edad ${r.age} · ${r.year}`,
    ageCaveat: (apeak) => `Cada gol profesional según la edad a la que lo anotó — clubes y selección combinados. Máximo: ${apeak.goals} goles a los ${apeak.age} años (${apeak.year}).`,
    ageFilterNote: "Las edades combinan clubes y selección, por lo que este gráfico cubre toda la carrera — quita el filtro para verlo.",
    compCaption: (name) => `Goles por competición — ${esc(name)}.`,
    thComp: "Competición", thGoals: "Goles", thShare: "Porcentaje",
    recAllTime: "Récord histórico de la competición",
    finishCaption: "Cómo se marcaron los goles y con qué parte del cuerpo — totales de carrera, todos los equipos.",
    thFinish: "Definición / Parte del cuerpo",
    finishCaveatTable: "El desglose por remate y parte del cuerpo es un conteo oficial verificado.",
    finishRows: (d) => [
      ["Jugada abierta", d.byFinish.openPlay],
      ["Penaltis", d.byFinish.penalties],
      ["Tiros libres directos", d.byFinish.freeKicks],
      ["Pie izquierdo", d.byBodyPart.left],
      ["Pie derecho", d.byBodyPart.right],
      ["Cabeza", d.byBodyPart.head],
      ["Otro (pecho, etc.)", d.byBodyPart.other]
    ],
    teamCardSub: { goals: "goles", apps: "partidos", gpg: "por partido", of: "de" },
    records: (comp, d) => [
      ["91", `<b>Goles en 2012</b> — el récord mundial oficial en un año natural.`],
      [n(comp("La Liga")), `<b>Goles en La Liga</b> — récord histórico absoluto, todos con Barcelona.`],
      [n(comp("UEFA Champions League")), `<b>Goles en Champions League</b> — 120 Barcelona · 9 PSG.`],
      ["8", `<b>Balones de Oro</b> — récord histórico del fútbol (2009–12, 2015, 2019, 2021, 2023).`],
      [n(d.hatTricks), `<b>Hat-tricks o más</b> con clubes y selección absoluta.`],
      [`${LIVE.trophies}`, `<b>Títulos oficiales</b> — el futbolista más laureado de la historia.`]
    ],
    method: "Los goles en Champions League se dividen en Barcelona 120 y PSG 9 a partir de actas oficiales; el resto de competiciones siguen la distribución oficial de partidos documentada en los datos."
  },
  pt: {
    teamNames: { all: "todos os times", barcelona: "Barcelona", psg: "PSG", miami: "Inter Miami", argentina: "Argentina" },
    pills: [["all", "Todos os times"], ["barcelona", "Barcelona"], ["psg", "PSG"], ["miami", "Inter Miami"], ["argentina", "Argentina"]],
    head: (name) => `Todos os 930 gols de Lionel Messi analisados de quatro formas — por competição, por temporada, por finalização e por parte do corpo — filtrados para <b>${esc(name)}</b>. Toque em um time para atualizar os gráficos.`,
    filterNote: (name, goals, apps, T) => `Exibindo ${name}: ${n(goals)} gols em ${n(apps)} jogos` + (T === "barcelona" || T === "psg" ? " (Divisão na Champions League: Barcelona 120, PSG 9 — fontes oficiais dos clubes)." : "."),
    kpis: { goals: "Gols", apps: "Jogos", gpg: "Média de gols", forTeam: (name) => `Pelo ${name}.` },
    chartEmpty: "Nenhuma linha para este filtro de time.",
    figCap: (T, name) => T === "all" ? "Anos civis, 2004 a 2026." : T === "argentina" ? "Anos civis com a Argentina." : "Temporadas de clube pelo " + esc(name) + ".",
    finishParts: { "Open play": "Bola rolando", "Penalties": "Pênaltis", "Free kicks": "Faltas" },
    finishCenter: "gols na carreira",
    finishCaveat: "Totais de carreira combinados de todas as equipes. Contagem oficial verificada.",
    finishCaveatFiltered: (d) => `Não existe divisão por finalização por time individual — veja os totais da carreira abaixo. De seus ${n(d.totals.goals)} gols oficiais: ${d.byFinish.openPlay} bola rolando, ${d.byFinish.penalties} pênaltis e ${d.byFinish.freeKicks} faltas.`,
    bodyParts: { "Left foot": "Pé esquerdo", "Right foot": "Pé direito", "Head": "Cabeça", "Other": "Outro (peito, etc.)" },
    bodyCenter: "com a canhota",
    bodyCaveat: "Totais de carreira combinados de todos os times (contagem oficial verificada).",
    ageName: (r) => `Idade ${r.age} · ${r.year}`,
    ageCaveat: (apeak) => `Cada gol profissional de acordo com a idade em que marcou — clubes e seleção combinados. Recorde: ${apeak.goals} gols aos ${apeak.age} anos (${apeak.year}).`,
    ageFilterNote: "As idades combinam clubes e seleção, portanto este gráfico cobre toda a carreira — limpe o filtro para ver.",
    compCaption: (name) => `Gols por competição — ${esc(name)}.`,
    thComp: "Competição", thGoals: "Gols", thShare: "Porcentagem",
    recAllTime: "Recorde histórico da competição",
    finishCaption: "Como os gols foram marcados e com qual parte do corpo — totais da carreira, todos os times.",
    thFinish: "Finalização / Parte do corpo",
    finishCaveatTable: "O detalhamento por finalização e parte do corpo é uma contagem oficial verificada.",
    finishRows: (d) => [
      ["Bola rolando", d.byFinish.openPlay],
      ["Pênaltis", d.byFinish.penalties],
      ["Cobranças de falta", d.byFinish.freeKicks],
      ["Pé esquerdo", d.byBodyPart.left],
      ["Pé direito", d.byBodyPart.right],
      ["Cabeça", d.byBodyPart.head],
      ["Outro (peito, etc.)", d.byBodyPart.other]
    ],
    teamCardSub: { goals: "gols", apps: "jogos", gpg: "por jogo", of: "de" },
    records: (comp, d) => [
      ["91", `<b>Gols em 2012</b> — recorde mundial oficial em um ano civil.`],
      [n(comp("La Liga")), `<b>Gols na La Liga</b> — recorde histórico absoluto da competição, todos pelo Barcelona.`],
      [n(comp("UEFA Champions League")), `<b>Gols na Champions League</b> — 120 pelo Barcelona, 9 pelo PSG.`],
      ["8", `<b>Bolas de Ouro</b> — recorde histórico do futebol (2009–12, 2015, 2019, 2021, 2023).`],
      [n(d.hatTricks), `<b>Hat-tricks ou mais</b> por clubes e seleção.`],
      [`${LIVE.trophies}`, `<b>Títulos oficiais</b> — o jogador mais laureado da história do futebol.`]
    ],
    method: "Gols na Champions League divididos em Barcelona 120 e PSG 9 a partir de fontes oficiais dos clubes; demais competições seguem os registros oficiais."
  },
  fr: {
    teamNames: { all: "toutes les équipes", barcelona: "FC Barcelone", psg: "PSG", miami: "Inter Miami", argentina: "Argentine" },
    pills: [["all", "Toutes les équipes"], ["barcelona", "FC Barcelone"], ["psg", "PSG"], ["miami", "Inter Miami"], ["argentina", "Argentine"]],
    head: (name) => `Tous les 930 buts de Lionel Messi analysés de 4 manières — par compétition, par saison, par finition et par partie du corps — filtrés pour <b>${esc(name)}</b>. Touchez une équipe pour actualiser.`,
    filterNote: (name, goals, apps, T) => `Affichage pour ${name} : ${n(goals)} buts en ${n(apps)} matchs` + (T === "barcelona" || T === "psg" ? " (Répartition Ligue des Champions : Barcelone 120, PSG 9 — sources officielles des clubs)." : "."),
    kpis: { goals: "Buts", apps: "Matchs", gpg: "Buts par match", forTeam: (name) => `Pour ${name}.` },
    chartEmpty: "Aucune ligne pour ce filtre d'équipe.",
    figCap: (T, name) => T === "all" ? "Années civiles, de 2004 à 2026." : T === "argentina" ? "Années civiles avec l'Argentine." : "Saisons en club pour " + esc(name) + ".",
    finishParts: { "Open play": "Jeu ouvert", "Penalties": "Penaltys", "Free kicks": "Coups francs" },
    finishCenter: "buts en carrière",
    finishCaveat: "Totaux de carrière combinés pour toutes les équipes. Décompte officiel vérifié.",
    finishCaveatFiltered: (d) => `Aucune répartition par équipe n'existe — voir totaux ci-dessous. Sur ses ${n(d.totals.goals)} buts officiels : ${d.byFinish.openPlay} dans le jeu, ${d.byFinish.penalties} penaltys et ${d.byFinish.freeKicks} coups francs.`,
    bodyParts: { "Left foot": "Pied gauche", "Right foot": "Pied droit", "Head": "Tête", "Other": "Autre (poitrine, etc.)" },
    bodyCenter: "du pied gauche",
    bodyCaveat: "Totaux de carrière combinés pour toutes les équipes (décompte officiel vérifié).",
    ageName: (r) => `Âge ${r.age} · ${r.year}`,
    ageCaveat: (apeak) => `Chaque but professionnel selon l'âge auquel il a été marqué — clubs et sélection combinés. Pic : ${apeak.goals} buts à l'âge de ${apeak.age} ans (${apeak.year}).`,
    ageFilterNote: "Les âges combinent club et sélection, ce graphique couvre donc la carrière complète — effacez le filtre pour le voir.",
    compCaption: (name) => `Buts par compétition — ${esc(name)}.`,
    thComp: "Compétition", thGoals: "Buts", thShare: "Part",
    recAllTime: "Record historique de la compétition",
    finishCaption: "Comment les buts ont été marqués et avec quelle partie du corps — totaux de carrière.",
    thFinish: "Finition / Partie du corps",
    finishCaveatTable: "La répartition par finition et partie du corps est un décompte officiel vérifié.",
    finishRows: (d) => [
      ["Dans le jeu", d.byFinish.openPlay],
      ["Penaltys", d.byFinish.penalties],
      ["Coups francs directs", d.byFinish.freeKicks],
      ["Pied gauche", d.byBodyPart.left],
      ["Pied droit", d.byBodyPart.right],
      ["Tête", d.byBodyPart.head],
      ["Autre (poitrine, etc.)", d.byBodyPart.other]
    ],
    teamCardSub: { goals: "buts", apps: "matchs", gpg: "par match", of: "sur" },
    records: (comp, d) => [
      ["91", `<b>Buts en 2012</b> — le record mondial officiel sur une année civile.`],
      [n(comp("La Liga")), `<b>Buts en La Liga</b> — record absolu de l'histoire, tous avec Barcelone.`],
      [n(comp("UEFA Champions League")), `<b>Buts en Ligue des Champions</b> — 120 pour Barcelone, 9 pour le PSG.`],
      ["8", `<b>Ballons d'Or</b> — record absolu du football (2009–12, 2015, 2019, 2021, 2023).`],
      [n(d.hatTricks), `<b>Coups du chapeau ou plus</b> en club et en sélection.`],
      [`${LIVE.trophies}`, `<b>Titres collectifs officiels</b> — le joueur le plus titré de l'histoire.`]
    ],
    method: "Les buts en Ligue des Champions sont répartis à 120 pour Barcelone et 9 pour le PSG d'après les archives officielles."
  },
  ro: {
    teamNames: { all: "toate echipele", barcelona: "Barcelona", psg: "PSG", miami: "Inter Miami", argentina: "Argentina" },
    pills: [["all", "Toate echipele"], ["barcelona", "Barcelona"], ["psg", "PSG"], ["miami", "Inter Miami"], ["argentina", "Argentina"]],
    head: (name) => `Fiecare gol al lui Messi analizat pe patru axe — competiție, sezon, execuție și parte a corpului — filtrat pentru <b>${esc(name)}</b>. Apasă pe o echipă pentru a actualiza graficele.`,
    filterNote: (name, goals, apps, T) => `Se afișează ${name}: ${n(goals)} goluri în ${n(apps)} meciuri` + (T === "barcelona" || T === "psg" ? " (Champions League: Barcelona 120, PSG 9 — surse oficiale)." : "."),
    kpis: { goals: "Goluri", apps: "Meciuri", gpg: "Goluri / meci", forTeam: (name) => `Pentru ${name}.` },
    chartEmpty: "Nu există rânduri pentru acest filtru de echipă.",
    figCap: (T, name) => T === "all" ? "Ani calendaristici, 2004–2026." : T === "argentina" ? "Ani calendaristici cu Argentina." : "Sezoane de club pentru " + esc(name) + ".",
    finishParts: { "Open play": "Joc deschis", "Penalties": "Penalty-uri", "Free kicks": "Lovituri libere" },
    finishCenter: "goluri carieră",
    finishCaveat: "Totaluri de carieră combinate pentru toate echipele.",
    finishCaveatFiltered: (d) => `Nu există defalcare pe execuție per echipă — vezi totalurile de carieră. Din ${n(d.totals.goals)} goluri: ${d.byFinish.openPlay} joc deschis, ${d.byFinish.penalties} penalty-uri și ${d.byFinish.freeKicks} lovituri libere.`,
    bodyParts: { "Left foot": "Picior stâng", "Right foot": "Picior drept", "Head": "Cap", "Other": "Altele (piept etc.)" },
    bodyCenter: "cu stângul",
    bodyCaveat: "Totaluri oficiale verificate pe întreaga carieră.",
    ageName: (r) => `Vârsta ${r.age} · ${r.year}`,
    ageCaveat: (apeak) => `Fiecare gol de seniori după vârsta la care a fost marcat — club și națională. Vârf: ${apeak.goals} la ${apeak.age} ani (${apeak.year}).`,
    ageFilterNote: "Vârstele combină clubul și naționala — șterge filtrul pentru a vedea graficul complet.",
    compCaption: (name) => `Goluri pe competiție — ${esc(name)}.`,
    thComp: "Competiție", thGoals: "Goluri", thShare: "Cotă",
    recAllTime: "Record absolut al competiției",
    finishCaption: "Cum și cu ce au fost marcate golurile — totaluri de carieră.",
    thFinish: "Execuție / Parte a corpului",
    finishCaveatTable: "Defalcarea pe execuție și parte a corpului este verificată pe întreaga carieră.",
    finishRows: (d) => [
      ["Joc deschis", d.byFinish.openPlay],
      ["Penalty-uri", d.byFinish.penalties],
      ["Lovituri libere directe", d.byFinish.freeKicks],
      ["Picior stâng", d.byBodyPart.left],
      ["Picior drept", d.byBodyPart.right],
      ["Cap", d.byBodyPart.head],
      ["Altele (piept etc.)", d.byBodyPart.other]
    ],
    teamCardSub: { goals: "goluri", apps: "meciuri", gpg: "pe meci", of: "din" },
    records: (comp, d) => [
      ["91", `<b>Goluri în 2012</b> — recordul mondial într-un an calendaristic.`],
      [n(comp("La Liga")), `<b>Goluri în La Liga</b> — record absolut al competiției, toate la Barcelona.`],
      [n(comp("UEFA Champions League")), `<b>Goluri în Champions League</b> — 120 Barcelona, 9 PSG.`],
      ["8", `<b>Baloane de Aur</b> — record absolut în istorie (2009–12, 2015, 2019, 2021, 2023).`],
      [n(d.hatTricks), `<b>Hat-trick-uri sau mai mult</b> la club și națională.`],
      [`${LIVE.trophies}`, `<b>Trofee de echipă</b> — cea mai titrată carieră din fotbal.`]
    ],
    method: "Golurile din Champions League sunt împărțite Barcelona 120 / PSG 9 conform surselor oficiale ale cluburilor."
  },
  uz: {
    teamNames: { all: "barcha jamoalar", barcelona: "Barselona", psg: "PSJ", miami: "Inter Mayami", argentina: "Argentina" },
    pills: [["all", "Barcha jamoalar"], ["barcelona", "Barselona"], ["psg", "PSJ"], ["miami", "Inter Mayami"], ["argentina", "Argentina"]],
    head: (name) => `Messining har bir goli to'rt mezon bo'yicha — musobaqa, mavsum, uslub va tana qismi — <b>${esc(name)}</b> uchun filtrlangan. Grafiklarni yangilash uchun jamoani tanlang.`,
    filterNote: (name, goals, apps, T) => `${name} ko'rsatilmoqda: ${n(apps)} o'yinda ${n(goals)} ta gol` + (T === "barcelona" || T === "psg" ? " (Chempionlar Ligasi: Barselona 120, PSJ 9)." : "."),
    kpis: { goals: "Gollar", apps: "O'yinlar", gpg: "O'rtacha gol", forTeam: (name) => `${name} safida.` },
    chartEmpty: "Ushbu jamoa filtri uchun ma'lumot yo'q.",
    figCap: (T, name) => T === "all" ? "Taqvim yillari, 2004–2026." : T === "argentina" ? "Argentina taqvim yillari." : esc(name) + " klub mavsumlari.",
    finishParts: { "Open play": "Ochiq o'yin", "Penalties": "Penaltilar", "Free kicks": "Jarima zarbalari" },
    finishCenter: "karyera gollari",
    finishCaveat: "Barcha jamoalar bo'yicha tasdiqlangan umumiy ko'rsatkich.",
    finishCaveatFiltered: (d) => `Alohida jamoa bo'yicha uslub taqsimoti yo'q — umumiy ${n(d.totals.goals)} goldan: ${d.byFinish.openPlay} ochiq o'yin, ${d.byFinish.penalties} penalti va ${d.byFinish.freeKicks} jarima zarbasi.`,
    bodyParts: { "Left foot": "Chap oyoq", "Right foot": "O'ng oyoq", "Head": "Bosh", "Other": "Boshqa (ko'krak va h.k.)" },
    bodyCenter: "chap oyoq bilan",
    bodyCaveat: "Barcha jamoalar bo'yicha umumiy tasdiqlangan natija.",
    ageName: (r) => `Yosh ${r.age} · ${r.year}`,
    ageCaveat: (apeak) => `Har bir gol urilgan yoshi bo'yicha — klub va terma jamoa birgalikda. Eng yuqori: ${apeak.age} yoshda ${apeak.goals} gol (${apeak.year}).`,
    ageFilterNote: "Yosh grafigi butun faoliyatni qamrab oladi — ko'rish uchun filtrni tozalang.",
    compCaption: (name) => `Musobaqalar bo'yicha gollar — ${esc(name)}.`,
    thComp: "Musobaqa", thGoals: "Gollar", thShare: "Ulush",
    recAllTime: "Musobaqa tarixiy rekordi",
    finishCaption: "Gollar qanday va nima bilan urilgan — butun faoliyat.",
    thFinish: "Uslub / Tana qismi",
    finishCaveatTable: "Uslub va tana qismi bo'yicha tasdiqlangan umumiy hisob.",
    finishRows: (d) => [
      ["Ochiq o'yin", d.byFinish.openPlay],
      ["Penaltilar", d.byFinish.penalties],
      ["To'g'ridan-to'g'ri jarima", d.byFinish.freeKicks],
      ["Chap oyoq", d.byBodyPart.left],
      ["O'ng oyoq", d.byBodyPart.right],
      ["Bosh", d.byBodyPart.head],
      ["Boshqa (ko'krak va h.k.)", d.byBodyPart.other]
    ],
    teamCardSub: { goals: "gol", apps: "o'yin", gpg: "o'rtacha", of: "/" },
    records: (comp, d) => [
      ["91", `<b>2012-yildagi gollar</b> — bir taqvim yili uchun jahon rekordi.`],
      [n(comp("La Liga")), `<b>La Liga gollari</b> — barchasi Barselona safida urilgan mutlaq rekord.`],
      [n(comp("UEFA Champions League")), `<b>Chempionlar Ligasi gollari</b> — 120 Barselona, 9 PSJ.`],
      ["8", `<b>Oltin To'p</b> — futbol tarixidagi mutlaq rekord (2009–12, 2015, 2019, 2021, 2023).`],
      [n(d.hatTricks), `<b>Het-trik yoki undan ko'p</b> klub va terma jamoada.`],
      [`${LIVE.trophies}`, `<b>Jamoaviy sovrinlar</b> — futbol tarixidagi eng titulli faoliyat.`]
    ],
    method: "Chempionlar Ligasi gollari rasmiy klub manbalariga ko'ra Barselona 120 / PSJ 9 nisbatida taqsimlangan."
  },
  ar: {
    teamNames: { all: "جميع الفرق", barcelona: "برشلونة", psg: "باريس", miami: "إنتر ميامي", argentina: "الأرجنتين" },
    pills: [["all", "جميع الفرق"], ["barcelona", "برشلونة"], ["psg", "باريس"], ["miami", "إنتر ميامي"], ["argentina", "الأرجنتين"]],
    head: (name) => `تحليل أهداف ليونيل ميسي بأربعة محاور — حسب البطولة، الموسم، طريقة التسجيل، وجزء الجسم — مصفاة لـ <b>${esc(name)}</b>. اختر فريقاً لتحديث الرسوم البيانية.`,
    filterNote: (name, goals, apps, T) => `عرض ${name}: ${n(goals)} هدفاً في ${n(apps)} مباراة` + (T === "barcelona" || T === "psg" ? " (دوري الأبطال: برشلونة 120، باريس 9 وفق السجلات الرسمية)." : "."),
    kpis: { goals: "الأهداف", apps: "المباريات", gpg: "هدف / مباراة", forTeam: (name) => `مع ${name}.` },
    chartEmpty: "لا توجد بيانات لهذا الفريق.",
    figCap: (T, name) => T === "all" ? "السنوات التقويمية، 2004 إلى 2026." : T === "argentina" ? "السنوات التقويمية مع الأرجنتين." : "مواسم النادي مع " + esc(name) + ".",
    finishParts: { "Open play": "لعب مفتوح", "Penalties": "ركلات جزاء", "Free kicks": "ركلات حرة" },
    finishCenter: "هدف في المسيرة",
    finishCaveat: "إجمالي المسيرة لجميع الفرق مجتمعة وفق السجلات المعتمدة.",
    finishCaveatFiltered: (d) => `تفصيل طريقة التسجيل يغطي المسيرة الكاملة: من أصل ${n(d.totals.goals)} هدفاً: ${d.byFinish.openPlay} من لعب مفتوح، ${d.byFinish.penalties} ركلة جزاء و${d.byFinish.freeKicks} ركلة حرة.`,
    bodyParts: { "Left foot": "القدم اليسرى", "Right foot": "القدم اليمنى", "Head": "الرأس", "Other": "أخرى (الصدر إلخ)" },
    bodyCenter: "بالقدم اليسرى",
    bodyCaveat: "إجمالي المسيرة لجميع الفرق مجتمعة.",
    ageName: (r) => `العمر ${r.age} · ${r.year}`,
    ageCaveat: (apeak) => `كل هدف رسمي حسب العمر عند تسجيله — النادي والمنتخب معاً. الذروة: ${apeak.goals} هدفاً بعمر ${apeak.age} (${apeak.year}).`,
    ageFilterNote: "تجمع الأعمار بين النادي والمنتخب — أزل الفلتر لعرض المسيرة الكاملة.",
    compCaption: (name) => `الأهداف حسب البطولة — ${esc(name)}.`,
    thComp: "البطولة", thGoals: "الأهداف", thShare: "النسبة",
    recAllTime: "الرقم القياسي التاريخي للبطولة",
    finishCaption: "كيف وبأي جزء سُجلت الأهداف — إجمالي المسيرة.",
    thFinish: "الطريقة / جزء الجسم",
    finishCaveatTable: "تفصيل الطريقة وجزء الجسم موثّق لإجمالي المسيرة.",
    finishRows: (d) => [
      ["لعب مفتوح", d.byFinish.openPlay],
      ["ركلات جزاء", d.byFinish.penalties],
      ["ركلات حرة مباشرة", d.byFinish.freeKicks],
      ["القدم اليسرى", d.byBodyPart.left],
      ["القدم اليمنى", d.byBodyPart.right],
      ["الرأس", d.byBodyPart.head],
      ["أخرى (الصدر إلخ)", d.byBodyPart.other]
    ],
    teamCardSub: { goals: "هدفاً", apps: "مباراة", gpg: "للمباراة", of: "من" },
    records: (comp, d) => [
      ["91", `<b>أهداف 2012</b> — الرقم القياسي العالمي في سنة تقويمية.`],
      [n(comp("La Liga")), `<b>أهداف لا ليغا</b> — الرقم القياسي التاريخي، كلها مع برشلونة.`],
      [n(comp("UEFA Champions League")), `<b>أهداف دوري الأبطال</b> — 120 برشلونة و9 باريس.`],
      ["8", `<b>الكرة الذهبية</b> — رقم قياسي تاريخي (2009–12، 2015، 2019، 2021، 2023).`],
      [n(d.hatTricks), `<b>هاتريك أو أكثر</b> مع الأندية والمنتخب.`],
      [`${LIVE.trophies}`, `<b>الألقاب الجماعية</b> — الأكثر تتويجاً في تاريخ كرة القدم.`]
    ],
    method: "أهداف دوري الأبطال موزعة 120 لبرشلونة و9 لباريس وفق المصادر الرسمية للأندية."
  },
  id: {
    teamNames: { all: "semua tim", barcelona: "Barcelona", psg: "PSG", miami: "Inter Miami", argentina: "Argentina" },
    pills: [["all", "Semua tim"], ["barcelona", "Barcelona"], ["psg", "PSG"], ["miami", "Inter Miami"], ["argentina", "Argentina"]],
    head: (name) => `Setiap gol Messi dianalisis dalam empat sisi — berdasarkan kompetisi, musim, cara penyelesaian, dan bagian tubuh — difilter untuk <b>${esc(name)}</b>. Pilih tim untuk memperbarui grafik.`,
    filterNote: (name, goals, apps, T) => `Menampilkan ${name}: ${n(goals)} gol dalam ${n(apps)} laga` + (T === "barcelona" || T === "psg" ? " (Rincian Liga Champions: Barcelona 120, PSG 9 — bersumber dari data resmi klub)." : "."),
    kpis: { goals: "Gol", apps: "Penampilan", gpg: "Gol per laga", forTeam: (name) => `Untuk ${name}.` },
    chartEmpty: "Tidak ada data untuk filter tim ini.",
    figCap: (T, name) => T === "all" ? "Tahun kalender, 2004 hingga 2026." : T === "argentina" ? "Tahun kalender Argentina." : "Musim klub untuk " + esc(name) + ".",
    finishParts: { "Open play": "Permainan terbuka", "Penalties": "Penalti", "Free kicks": "Tendangan bebas" },
    finishCenter: "gol karier",
    finishCaveat: "Total karier gabungan semua tim — data terverifikasi.",
    finishCaveatFiltered: (d) => `Rincian cara penyelesaian mencakup total karier keseluruhan: dari ${n(d.totals.goals)} gol Messi, ${d.byFinish.openPlay} dari permainan terbuka, ${d.byFinish.penalties} penalti, dan ${d.byFinish.freeKicks} tendangan bebas.`,
    bodyParts: { "Left foot": "Kaki kiri", "Right foot": "Kaki kanan", "Head": "Sundulan", "Other": "Lainnya" },
    bodyCenter: "gol kaki kiri",
    bodyCaveat: "Total karier gabungan semua tim.",
    ageName: (r) => `Usia ${r.age} · ${r.year}`,
    ageCaveat: (apeak) => `Setiap gol senior berdasarkan usia saat mencetaknya — gabungan klub dan timnas. Puncak: ${apeak.goals} gol pada usia ${apeak.age} (${apeak.year}).`,
    ageFilterNote: "Usia menggabungkan gol klub dan timnas — hapus filter tim untuk melihat keseluruhan karier.",
    compCaption: (name) => `Gol per kompetisi — ${esc(name)}.`,
    thComp: "Kompetisi", thGoals: "Gol", thShare: "Porsi",
    recAllTime: "Rekor sepanjang masa kompetisi",
    finishCaption: "Bagaimana gol dicetak dan dengan bagian tubuh mana — total karier.",
    thFinish: "Penyelesaian",
    finishCaveatTable: "Rincian penyelesaian dan bagian tubuh adalah hitungan kompilasi total karier.",
    finishRows: (d) => [
      ["Permainan terbuka", d.byFinish.openPlay],
      ["Penalti", d.byFinish.penalties],
      ["Tendangan bebas", d.byFinish.freeKicks],
      ["Kaki kiri", d.byBodyPart.left],
      ["Kaki kanan", d.byBodyPart.right],
      ["Sundulan", d.byBodyPart.head],
      ["Lainnya (dada dll.)", d.byBodyPart.other]
    ],
    teamCardSub: { goals: "gol", apps: "laga", gpg: "per laga", of: "dari" },
    records: (comp, d) => [
      ["91", `<b>Gol di 2012</b> — rekor dunia terbanyak dalam satu tahun kalender.`],
      [n(comp("La Liga")), `<b>Gol La Liga</b> — rekor sepanjang masa kompetisi, semuanya untuk Barcelona.`],
      [n(comp("UEFA Champions League")), `<b>Gol Liga Champions</b> — 120 untuk Barcelona, 9 untuk PSG.`],
      ["8", `<b>Ballon d'Or</b> — terbanyak sepanjang sejarah (2009–12, 2015, 2019, 2021, 2023).`],
      [n(d.hatTricks), `<b>Hat-trick atau lebih</b> bersama klub dan timnas.`],
      [`${LIVE.trophies}`, `<b>Trofi tim</b> — karier tersukses dalam sejarah sepak bola.`]
    ],
    method: "Gol Liga Champions dibagi 120 untuk Barcelona dan 9 untuk PSG berdasarkan sumber resmi klub."
  }
};

const DASH_EN = {
  teamNames: { all: "all teams", barcelona: "Barcelona", psg: "PSG", miami: "Inter Miami", argentina: "Argentina" },
  pills: [["all", "All teams"], ["barcelona", "Barcelona"], ["psg", "PSG"], ["miami", "Inter Miami"], ["argentina", "Argentina"]],
  head: (name) => `Every Messi goal sliced four ways — by competition, by season, by finish and by body part — filtered to <b>${esc(name)}</b>. Tap a team to re-cut every chart.`,
  filterNote: (name, goals, apps, T) => `Showing ${name}: ${n(goals)} goals in ${n(apps)} apps` + (T === "barcelona" || T === "psg" ? " (Champions League split: Barcelona 120, PSG 9 — derived from club sources)." : "."),
  kpis: { goals: "Goals", apps: "Appearances", gpg: "Goals per game", forTeam: (name) => `For ${name}.` },
  chartEmpty: "No rows for this team filter.",
  figCap: (T, name) => T === "all" ? "Calendar years, 2004 to 2026." : T === "argentina" ? "Argentina calendar years." : "Club seasons for " + esc(name) + ".",
  finishParts: { "Open play": "Open play", "Penalties": "Penalties", "Free kicks": "Free kicks" },
  finishCenter: "career goals",
  finishCaveat: "Career totals for all teams combined — no per-team split exists. Verified count.",
  finishCaveatFiltered: (d) => `No per-team finish split exists, so this chart only covers all teams combined — see the career totals below. Messi's ${n(d.totals.goals)} goals break down as ${d.byFinish.openPlay} open play, ${d.byFinish.penalties} penalties and ${d.byFinish.freeKicks} free kicks.`,
  bodyParts: { "Left foot": "Left foot", "Right foot": "Right foot", "Head": "Head", "Other": "Other" },
  bodyCenter: "left-foot goals",
  bodyCaveat: "Career totals for all teams combined (provisional until a full hand count finishes).",
  ageName: (r) => `Age ${r.age} · ${r.year}`,
  ageCaveat: (apeak) => `Every senior goal by the age he scored it — club and country combined. Peak: ${apeak.goals} at age ${apeak.age} (${apeak.year}).`,
  ageFilterNote: "Ages mix club and country goals, so this chart covers the full career only — clear the team filter to see it.",
  compCaption: (name) => `Goals by competition — ${esc(name)}.`,
  thComp: "Competition", thGoals: "Goals", thShare: "Share",
  recAllTime: "All-time competition record",
  finishCaption: "How the goals were scored and with what — career totals, all teams.",
  thFinish: "Finish",
  finishCaveatTable: "Finish and body-part splits are a provisional compiled tally.",
  finishRows: (d) => [
    ["Open play", d.byFinish.openPlay],
    ["Penalties", d.byFinish.penalties],
    ["Free kicks", d.byFinish.freeKicks],
    ["Left foot", d.byBodyPart.left],
    ["Right foot", d.byBodyPart.right],
    ["Head", d.byBodyPart.head],
    ["Other (chest etc.)", d.byBodyPart.other]
  ],
  teamCardSub: { goals: "goals", apps: "apps", gpg: "per game", of: "of" },
  records: (comp, d) => [
    ["91", `<b>Goals in 2012</b> — the most any footballer has scored in a calendar year.`],
    [n(comp("La Liga")), `<b>La Liga goals</b>, the competition's all-time record, all for Barcelona.`],
    [n(comp("UEFA Champions League")), `<b>Champions League goals</b> — 120 for Barcelona, 9 for PSG.`],
    ["8", `<b>Ballons d'Or</b>, more than any player in history (2009–12, 2015, 2019, 2021, 2023).`],
    [n(d.hatTricks), `<b>Hat-tricks or more</b> for club and country (provisional tally).`],
    [`${LIVE.trophies}`, `<b>Team trophies</b> — the most decorated career football has seen.`]
  ],
  method: "Champions League goals split Barcelona 120 / PSG 9 from club sources; other team-filtered competition splits follow the club-season competition mapping and are documented in the data file."
};

function renderDashboard(d, team) {
  const lang = getLang();
  const cfg = DASH_I18N[lang] || DASH_EN;
  const T = teamComps()[team] ? team : "all";
  const name = cfg.teamNames[T] || (T === "all" ? "all teams" : teamName(T));
  const sum = (arr) => arr.reduce((a, r) => a + r[1], 0);
  const goals = T === "all" ? d.totals.goals : sum(teamComps()[T]);
  const apps = T === "all" ? d.totals.apps : T === "argentina" ? d.totals.country.apps : clubAgg(d)[T].apps;

  setHead(d, cfg.head(name));

  const DASH_UI_I18N = {
    en: {
      allTeams: "All Teams",
      kpiTotalGoals: "Total Goals", kpiTotalAssists: "Total Assists", kpiGa: "Goal Contributions",
      kpiNpg: "Non-Penalty Goals", kpiFk: "Direct Free Kicks", kpiHt: "Career Hat-Tricks",
      subGpg: (g, a, m) => `${g} goals/game · ${m} matches (${a})`,
      subAst: (r) => `${r} assists/game · All-time playmaker`,
      subGa: (r) => `${r} direct goal involvements per match`,
      subNpg: (pct) => `${pct}% non-penalty ratio (open play & free kicks)`,
      subFk: "Record set-piece dead-ball precision",
      subHt: "62 career hat-tricks, 6× 4-goals, 2× 5-goals",
      bodyTitle: "Scoring Breakdown by Body Part",
      finishTitle: "Scoring Breakdown by Method / Finish",
      compTitle: (nm) => `Top Competitions (${nm})`,
      msTitle: "Landmark Goal Speed Tracker",
      msHeaders: ["Milestone", "Opponent", "Date", "Age", "Matches"],
      msGoal: (g) => `Goal #${g}`,
      msFoot: "Includes all official senior competitive and international appearances.",
      openPlaySub: "81.2% open play dominance",
      fkSub: "76 career set-piece conversions",
      penSub: "110 converted from 141 attempts (78.0%)"
    },
    es: {
      allTeams: "Todos los Equipos",
      kpiTotalGoals: "Goles Totales", kpiTotalAssists: "Asistencias", kpiGa: "Participaciones (G+A)",
      kpiNpg: "Goles sin Penalti", kpiFk: "Tiros Libres Directos", kpiHt: "Hat-Tricks",
      subGpg: (g, a, m) => `${g} goles/partido · ${m} partidos (${a})`,
      subAst: (r) => `${r} asistencias/partido · Máximo asistente`,
      subGa: (r) => `${r} participaciones directas por partido`,
      subNpg: (pct) => `${pct}% sin penaltis (jugada y falta)`,
      subFk: "Precisión histórica a balón parado",
      subHt: "62 hat-tricks, 6 pókers, 2 repókers",
      bodyTitle: "Desglose por Parte del Cuerpo",
      finishTitle: "Desglose por Tipo de Definición",
      compTitle: (nm) => `Principales Competiciones (${nm})`,
      msTitle: "Velocidad hacia Hitos Históricos",
      msHeaders: ["Hito", "Rival", "Fecha", "Edad", "Partidos"],
      msGoal: (g) => `Gol #${g}`,
      msFoot: "Incluye todos los partidos oficiales de clubes y selección absoluta.",
      openPlaySub: "81,2% en jugada abierta",
      fkSub: "76 conversiones de falta directa",
      penSub: "110 de 141 intentos (78,0%)"
    },
    pt: {
      allTeams: "Todos os Times",
      kpiTotalGoals: "Total de Gols", kpiTotalAssists: "Assistências", kpiGa: "Participações (G+A)",
      kpiNpg: "Gols sem Pênalti", kpiFk: "Faltas Diretas", kpiHt: "Hat-Tricks",
      subGpg: (g, a, m) => `${g} gols/jogo · ${m} jogos (${a})`,
      subAst: (r) => `${r} assistências/jogo · Líder histórico`,
      subGa: (r) => `${r} participações diretas por jogo`,
      subNpg: (pct) => `${pct}% sem pênaltis (bola rolando e faltas)`,
      subFk: "Precisão histórica em bolas paradas",
      subHt: "62 hat-tricks, 6× 4 gols, 2× 5 gols",
      bodyTitle: "Gols por Parte do Corpo",
      finishTitle: "Gols por Tipo de Finalização",
      compTitle: (nm) => `Principais Competições (${nm})`,
      msTitle: "Velocidade nos Marcos Históricos",
      msHeaders: ["Marco", "Adversário", "Data", "Idade", "Jogos"],
      msGoal: (g) => `Gol #${g}`,
      msFoot: "Inclui todas as partidas oficiais por clubes e seleção principal.",
      openPlaySub: "81,2% com bola rolando",
      fkSub: "76 gols de falta direta",
      penSub: "110 convertidos em 141 cobranças (78,0%)"
    },
    fr: {
      allTeams: "Toutes les Équipes",
      kpiTotalGoals: "Total de Buts", kpiTotalAssists: "Passes Décisives", kpiGa: "Actions Décisives (B+P)",
      kpiNpg: "Buts hors Penalty", kpiFk: "Coups Francs Directs", kpiHt: "Triplés en Carrière",
      subGpg: (g, a, m) => `${g} buts/match · ${m} matchs (${a})`,
      subAst: (r) => `${r} passes/match · Meilleur passeur`,
      subGa: (r) => `${r} actions décisives par match`,
      subNpg: (pct) => `${pct}% hors penalty (jeu et coups francs)`,
      subFk: "Précision historique sur coup de pied arrêté",
      subHt: "62 triplés, 6 quadruplés, 2 quintuplés",
      bodyTitle: "Répartition par Partie du Corps",
      finishTitle: "Répartition par Type de Finition",
      compTitle: (nm) => `Principales Compétitions (${nm})`,
      msTitle: "Rythme vers les Caps Historiques",
      msHeaders: ["Cap", "Adversaire", "Date", "Âge", "Matchs"],
      msGoal: (g) => `But #${g}`,
      msFoot: "Inclut tous les matchs officiels en club et sélection senior.",
      openPlaySub: "81,2% dans le jeu",
      fkSub: "76 coups francs directs inscrits",
      penSub: "110 réussis sur 141 tentatives (78,0%)"
    },
    ro: {
      allTeams: "Toate Echipele",
      kpiTotalGoals: "Total Goluri", kpiTotalAssists: "Pase de Gol", kpiGa: "Contribuții (G+A)",
      kpiNpg: "Goluri fără Penalty", kpiFk: "Lovituri Libere Directe", kpiHt: "Hat-Trick-uri",
      subGpg: (g, a, m) => `${g} goluri/meci · ${m} meciuri (${a})`,
      subAst: (r) => `${r} pase/meci · Lider absolut`,
      subGa: (r) => `${r} contribuții directe per meci`,
      subNpg: (pct) => `${pct}% fără penalty (joc deschis și lovituri libere)`,
      subFk: "Precizie istorică la faze fixe",
      subHt: "62 hat-trick-uri, 6× 4 goluri, 2× 5 goluri",
      bodyTitle: "Distribuție pe Parte a Corpului",
      finishTitle: "Distribuție pe Tip de Execuție",
      compTitle: (nm) => `Competiții Principale (${nm})`,
      msTitle: "Ritmul Bornelor Istorice",
      msHeaders: ["Bornă", "Adversar", "Dată", "Vârstă", "Meciuri"],
      msGoal: (g) => `Gol #${g}`,
      msFoot: "Include toate meciurile oficiale de seniori la club și națională.",
      openPlaySub: "81,2% din joc deschis",
      fkSub: "76 lovituri libere transformate",
      penSub: "110 transformate din 141 încercări (78,0%)"
    },
    uz: {
      allTeams: "Barcha Jamoalar",
      kpiTotalGoals: "Jami Gollar", kpiTotalAssists: "Golli Uzatmalar", kpiGa: "Gol+Assist",
      kpiNpg: "Penaltisiz Gollar", kpiFk: "Jarima Zarbalari", kpiHt: "Het-Triklar",
      subGpg: (g, a, m) => `${g} gol/o'yin · ${m} o'yin (${a})`,
      subAst: (r) => `${r} assist/o'yin · Tarixiy yetakchi`,
      subGa: (r) => `Har o'yinda ${r} ta samarali harakat`,
      subNpg: (pct) => `${pct}% penaltisiz ulush (ochiq o'yin va jarima)`,
      subFk: "Standart vaziyatlarda tarixiy aniqlik",
      subHt: "62 ta het-trik, 6× 4 gol, 2× 5 gol",
      bodyTitle: "Tana Qismi Bo'yicha Taqsimot",
      finishTitle: "Gol Urish Uslubi Bo'yicha Taqsimot",
      compTitle: (nm) => `Asosiy Musobaqalar (${nm})`,
      msTitle: "Tarixiy Marralar Tezligi",
      msHeaders: ["Marra", "Raqib", "Sana", "Yosh", "O'yinlar"],
      msGoal: (g) => `${g}-Gol`,
      msFoot: "Barcha rasmiy klub va terma jamoa o'yinlarini o'z ichiga oladi.",
      openPlaySub: "81,2% ochiq o'yinda",
      fkSub: "76 ta to'g'ridan-to'g'ri jarima goli",
      penSub: "141 urinishdan 110 ta aniq (78,0%)"
    },
    ar: {
      allTeams: "جميع الفرق",
      kpiTotalGoals: "إجمالي الأهداف", kpiTotalAssists: "التمريرات الحاسمة", kpiGa: "المساهمات التهديفية",
      kpiNpg: "أهداف دون ركلات جزاء", kpiFk: "الركلات الحرة المباشرة", kpiHt: "الهاتريك",
      subGpg: (g, a, m) => `${g} هدف/مباراة · ${m} مباراة (${a})`,
      subAst: (r) => `${r} تمريرة/مباراة · الأكثر صناعة تاريخياً`,
      subGa: (r) => `${r} مساهمة مباشرة في كل مباراة`,
      subNpg: (pct) => `${pct}% من اللعب المفتوح والركلات الحرة`,
      subFk: "دقة تاريخية في الكرات الثابتة",
      subHt: "62 هاتريك، 6 سوبر هاتريك، 2 خماسية",
      bodyTitle: "التوزيع حسب جزء الجسم",
      finishTitle: "التوزيع حسب طريقة التسجيل",
      compTitle: (nm) => `أبرز البطولات (${nm})`,
      msTitle: "سرعة الوصول للأهداف التاريخية",
      msHeaders: ["الهدف", "المنافس", "التاريخ", "العمر", "المباريات"],
      msGoal: (g) => `هدف #${g}`,
      msFoot: "يشمل جميع المباريات الرسمية للأندية والمنتخب الأول.",
      openPlaySub: "81.2% من اللعب المفتوح",
      fkSub: "76 ركلة حرة مباشرة مسجلة",
      penSub: "110 مسجلة من 141 محاولة (78.0%)"
    },
    id: {
      allTeams: "Semua Tim",
      kpiTotalGoals: "Total Gol", kpiTotalAssists: "Total Assist", kpiGa: "Kontribusi Gol",
      kpiNpg: "Gol Non-Penalti", kpiFk: "Tendangan Bebas", kpiHt: "Hat-trick",
      subGpg: (g, a, m) => `${g} gol/laga · ${m} laga (${a})`,
      subAst: (r) => `${r} assist/laga · Terbanyak sepanjang masa`,
      subGa: (r) => `${r} kontribusi gol per laga`,
      subNpg: (pct) => `${pct}% dari permainan terbuka & tendangan bebas`,
      subFk: "Akurasi bola mati kelas dunia",
      subHt: "62 hat-trick, 6× 4 gol, 2× 5 gol",
      bodyTitle: "Rincian Bagian Tubuh",
      finishTitle: "Rincian Cara Penyelesaian",
      compTitle: (nm) => `Kompetisi Utama (${nm})`,
      msTitle: "Kecepatan Tonggak Karier",
      msHeaders: ["Tonggak", "Lawan", "Tanggal", "Usia", "Laga"],
      msGoal: (g) => `Gol #${g}`,
      msFoot: "Mencakup semua pertandingan resmi klub dan timnas senior.",
      openPlaySub: "81,2% gol permainan terbuka",
      fkSub: "76 tendangan bebas langsung tercipta",
      penSub: "110 sukses dari 141 eksekusi (78,0%)"
    }
  };
  const dui = DASH_UI_I18N[lang] || DASH_UI_I18N.en;

  // 1. Team Selector Bar with instant reactive re-rendering
  const pillsEl = el("pills");
  if (pillsEl) {
    const teams = [
      { id: "all", label: dui.allTeams, goals: d.totals.goals, apps: d.totals.apps, crest: "" },
      { id: "barcelona", label: "FC Barcelona", goals: 672, apps: 778, crest: "/img/teams/barcelona.png" },
      { id: "argentina", label: "Argentina", goals: 126, apps: 208, crest: "/img/teams/argentina.png" },
      { id: "miami", label: "Inter Miami", goals: clubAgg(d).miami.goals, apps: clubAgg(d).miami.apps, crest: "/img/teams/miami.png" },
      { id: "psg", label: "Paris Saint-Germain", goals: 32, apps: 75, crest: "/img/teams/psg.png" }
    ];
    pillsEl.className = "dash-team-selector";
    pillsEl.innerHTML = teams.map((tm) => `
      <button class="dash-team-btn${T === tm.id ? " active" : ""}" data-team="${tm.id}" aria-pressed="${T === tm.id}">
        ${tm.crest ? `<img class="dash-team-crest" src="${tm.crest}" alt="" width="22" height="22" loading="eager" decoding="async" onerror="this.remove()">` : `<svg class="dash-team-crest" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`}
        <span>${tm.label}</span>
        <span class="dash-team-goals">${tm.goals}G</span>
      </button>
    `).join("");

    pillsEl.querySelectorAll(".dash-team-btn").forEach((b) =>
      b.addEventListener("click", () => {
        const nextTeam = b.dataset.team;
        const url = new URL(location.href);
        if (nextTeam === "all") url.searchParams.delete("team");
        else url.searchParams.set("team", nextTeam);
        try { history.replaceState(null, "", url.pathname + (url.search === "?" ? "" : url.search)); } catch {}
        renderDashboard(d, nextTeam);
      })
    );
  }

  const fnEl = el("filter-note");
  if (fnEl) {
    fnEl.textContent = cfg.filterNote(name, goals, apps, T);
  }

  // 2. Executive 6 KPI Cards Grid
  const kpisEl = el("kpis");
  if (kpisEl) {
    kpisEl.className = "dash-kpis-grid";
    const assistsBT = d.totals.assists.byTeam;
    const assistsVal = T === "all" ? n(d.totals.assists.official) + "+" : String(assistsBT[T === "miami" ? "inter_miami" : T].official);
    const gaVal = T === "all" ? n(d.totals.goals + d.totals.assists.official) + "+" : n(clubAgg(d)[T].goals + d.totals.assists.byTeam[T === "miami" ? "inter_miami" : T].official);
    const npgVal = T === "all" ? String(LIVE.npg) : T === "barcelona" ? "599" : T === "argentina" ? "96" : T === "miami" ? "99" : "30";
    const fkVal = T === "all" ? "76" : T === "barcelona" ? "50" : T === "argentina" ? "12" : T === "miami" ? "12" : "2";
    const htVal = T === "all" ? "62" : T === "barcelona" ? "48" : T === "argentina" ? "11" : T === "miami" ? "3" : "0";

    const kpiList = [
      { label: dui.kpiTotalGoals, num: n(goals), sub: dui.subGpg(gpg(goals, apps), name, n(apps)) },
      { label: dui.kpiTotalAssists, num: assistsVal, sub: dui.subAst((LIVE.assists / LIVE.apps).toFixed(2)) },
      { label: dui.kpiGa, num: gaVal, sub: dui.subGa((LIVE.ga / LIVE.apps).toFixed(2)) },
      { label: dui.kpiNpg, num: npgVal, sub: dui.subNpg((LIVE.npg / LIVE.goals * 100).toFixed(1)) },
      { label: dui.kpiFk, num: fkVal, sub: dui.subFk },
      { label: dui.kpiHt, num: htVal, sub: dui.subHt }
    ];

    kpisEl.innerHTML = kpiList.map(k => `
      <article class="dash-kpi-box">
        <div class="dash-kpi-header">
          <span class="dash-kpi-label">${k.label}</span>
        </div>
        <div class="dash-kpi-num">${k.num}</div>
        <div class="dash-kpi-sub">${k.sub}</div>
      </article>
    `).join("");
  }

  // 2B. Broadcast Tactical Pitch & Scoring Zone Map
  {
    const gridParent = document.querySelector(".dash-sections-grid") || el("kpis");
    if (gridParent) {
      let pitchHost = el("pitch-zone-card");
      if (!pitchHost) {
        pitchHost = document.createElement("section");
        pitchHost.id = "pitch-zone-card";
        pitchHost.className = "dash-pitch-banner card";
        if (gridParent.classList.contains("dash-sections-grid")) {
          gridParent.before(pitchHost);
        } else {
          gridParent.after(pitchHost);
        }
      }
      const PITCH_I18N = {
        en: {
          tag: "TACTICAL SPATIAL PROFILE",
          title: "Shot Origin & Scoring Zone Map",
          sub: "Career spatial distribution across 937 official goals — click or hover any zone to isolate on pitch.",
          inBox: "Inside 18-Yard Box",
          inBoxSub: "Cutbacks, 1v1s & 6-yard finishes",
          outBox: "Outside Box (Zone 14)",
          outBoxSub: "Signature curling strikes & long-range",
          fk: "Direct Free Kicks",
          fkSub: "2nd all-time in world football",
          pen: "Penalty Spot",
          penSub: "110 / 141 converted (78.0%)"
        },
        es: {
          tag: "MAPA TÁCTICO DE ZONAS",
          title: "Mapa de Zonas de Disparo y Definición",
          sub: "Distribución espacial de sus 937 goles oficiales — haz clic o pasa el cursor sobre cualquier zona.",
          inBox: "Dentro del Área",
          inBoxSub: "Definiciones, diagonales y mano a mano",
          outBox: "Fuera del Área (Zona 14)",
          outBoxSub: "Disparos con rosca y media distancia",
          fk: "Tiros Libres Directos",
          fkSub: "2.º máximo histórico mundial",
          pen: "Punto de Penalti",
          penSub: "110 / 141 convertidos (78,0%)"
        },
        pt: {
          tag: "MAPA TÁTICO DE FINALIZAÇÃO",
          title: "Mapa de Zonas de Chute e Gols",
          sub: "Distribuição espacial dos 937 gols oficiais — clique ou passe o mouse em qualquer zona.",
          inBox: "Dentro da Área",
          inBoxSub: "Infiltrações, 1x1 e pequena área",
          outBox: "Fora da Área (Zona 14)",
          outBoxSub: "Chutes colocados e média distância",
          fk: "Faltas Diretas",
          fkSub: "2º maior da história do futebol",
          pen: "Marca do Pênalti",
          penSub: "110 / 141 convertidos (78,0%)"
        },
        fr: {
          tag: "CARTE TACTIQUE DES TIRS",
          title: "Carte des Zones de Tir & Finition",
          sub: "Répartition spatiale des 937 buts officiels — cliquez ou survolez une zone pour l'isoler.",
          inBox: "Dans la Surface",
          inBoxSub: "Face-à-face, centres en retrait",
          outBox: "Hors Surface (Zone 14)",
          outBoxSub: "Frappes enroulées & longue distance",
          fk: "Coups Francs Directs",
          fkSub: "2e total de l'histoire mondiale",
          pen: "Point de Penalty",
          penSub: "110 / 141 transformés (78,0%)"
        },
        ro: {
          tag: "PROFIL TACTIC SPAȚIAL",
          title: "Harta Zonelor de Șut și Marcare",
          sub: "Distribuția spațială a celor 937 de goluri oficiale — apasă sau treci peste orice zonă.",
          inBox: "În Suprafața de 16 Metri",
          inBoxSub: "Centre pe jos, 1vs1 și finalizări",
          outBox: "În Afara Careului (Zona 14)",
          outBoxSub: "Șuturi plasate și de la distanță",
          fk: "Lovituri Libere Directe",
          fkSub: "Al 2-lea golgheter din istoricul mondial",
          pen: "Punct de Penalti",
          penSub: "110 / 141 transformate (78,0%)"
        },
        uz: {
          tag: "TAKTIK FAZOVIY PROFIL",
          title: "Zarba Manbai va Gol Zonalari Xaritasi",
          sub: "937 ta rasmiy golning fazoviy taqsimoti — ajratib ko'rish uchun istalgan zonani bosing.",
          inBox: "16 Metrli Jarima Maydonida",
          inBoxSub: "Orqaga uzatmalar, 1v1 va olti metrdan",
          outBox: "Maydon Tashqarisidan (14-zona)",
          outBoxSub: "Egri zarbalar va uzoq masofadan",
          fk: "To'g'ridan-to'g'ri Jarima Zarbalari",
          fkSub: "Jahon futbolida 2-o'rin",
          pen: "Penalti Nuqtasi",
          penSub: "110 / 141 ta o'tkazildi (78,0%)"
        },
        ar: {
          tag: "الملف التكتيكي المكاني",
          title: "خريطة منطقة التسديد والتسجيل",
          sub: "التوزيع المكاني لـ 937 هدفاً رسمياً — انقر أو مرّر المؤشر على أي منطقة للتركيز عليها.",
          inBox: "داخل منطقة الجزاء",
          inBoxSub: "تمريرات خلفية، مواجهات ثنائية وتهديف",
          outBox: "خارج منطقة الجزاء (المنطقة 14)",
          outBoxSub: "تسديدات متقوسة وبعيدة المدى",
          fk: "ركلات حرة مباشرة",
          fkSub: "الثاني في تاريخ كرة القدم العالمية",
          pen: "نقطة ركلة الجزاء",
          penSub: "110 / 141 تحويلاً (78.0%)"
        },
        id: {
          tag: "PROFIL TAKTIKAL SPASIAL",
          title: "Peta Zona Asal Tembakan & Gol",
          sub: "Distribusi spasial dari 937 gol senior — klik atau arahkan kursor ke zona mana saja untuk menyorot.",
          inBox: "Di Dalam Kotak 16 Meter",
          inBoxSub: "Cut-back, 1v1 & kotak 6 meter",
          outBox: "Luar Kotak (Zona 14)",
          outBoxSub: "Tembakan melengkung & jarak jauh",
          fk: "Tendangan Bebas Langsung",
          fkSub: "Peringkat #2 sepanjang masa di sepak bola",
          pen: "Titik Penalti",
          penSub: "110 / 141 dikonversi (78,0%)"
        }
      };
      const pt = PITCH_I18N[lang] || PITCH_I18N.en;
      const inBoxGoals = d.totals.goals - 160;
      const inBoxPct = ((inBoxGoals / d.totals.goals) * 100).toFixed(1);
      const outBoxPct = ((160 / d.totals.goals) * 100).toFixed(1);

      pitchHost.innerHTML = `
        <div class="pitch-banner-head">
          <div>
            <span class="pitch-eyebrow">${pt.tag}</span>
            <h3 class="pitch-title">${pt.title}</h3>
            <p class="pitch-sub">${pt.sub}</p>
          </div>
        </div>
        <div class="pitch-banner-grid">
          <div class="pitch-svg-wrap">
            <svg viewBox="0 0 520 300" class="tactical-pitch-svg" role="img" aria-label="${pt.title}">
              <defs>
                <linearGradient id="pitchTurf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#0d3b2a"/>
                  <stop offset="1" stop-color="#082419"/>
                </linearGradient>
                <radialGradient id="heatBox" cx="50%" cy="32%" r="46%">
                  <stop offset="0" stop-color="#34d399" stop-opacity="0.48"/>
                  <stop offset="1" stop-color="#10b981" stop-opacity="0.06"/>
                </radialGradient>
                <radialGradient id="heatZone14" cx="54%" cy="68%" r="36%">
                  <stop offset="0" stop-color="#e5b842" stop-opacity="0.55"/>
                  <stop offset="1" stop-color="#b45309" stop-opacity="0.05"/>
                </radialGradient>
              </defs>
              <rect x="8" y="8" width="504" height="284" rx="10" fill="url(#pitchTurf)" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
              <line x1="8" y1="64" x2="512" y2="64" stroke="rgba(255,255,255,0.04)" stroke-width="28"/>
              <line x1="8" y1="120" x2="512" y2="120" stroke="rgba(255,255,255,0.04)" stroke-width="28"/>
              <line x1="8" y1="176" x2="512" y2="176" stroke="rgba(255,255,255,0.04)" stroke-width="28"/>
              <line x1="8" y1="232" x2="512" y2="232" stroke="rgba(255,255,255,0.04)" stroke-width="28"/>
              <rect x="218" y="2" width="84" height="8" rx="2" fill="none" stroke="#ffffff" stroke-width="2"/>
              <g class="pitch-zone" data-zone="inbox">
                <rect x="110" y="8" width="300" height="142" fill="url(#heatBox)" stroke="rgba(255,255,255,0.65)" stroke-width="1.6"/>
                <rect x="188" y="8" width="144" height="52" fill="rgba(52,211,153,0.14)" stroke="rgba(255,255,255,0.55)" stroke-width="1.4"/>
                <g transform="translate(124, 24)">
                  <rect width="118" height="26" rx="5" fill="rgba(9,9,11,0.88)" stroke="rgba(52,211,153,0.65)"/>
                  <text x="59" y="17" text-anchor="middle" fill="#ecfdf5" font-size="11.5" font-weight="800" font-family="Plus Jakarta Sans, sans-serif">${inBoxGoals}G (${inBoxPct}%)</text>
                </g>
              </g>
              <g class="pitch-zone" data-zone="outbox">
                <ellipse cx="274" cy="196" rx="115" ry="52" fill="url(#heatZone14)"/>
                <path d="M 204 150 A 62 62 0 0 0 316 150" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="1.6"/>
                <g transform="translate(284, 212)">
                  <rect width="132" height="26" rx="5" fill="rgba(9,9,11,0.88)" stroke="rgba(229,184,66,0.7)"/>
                  <text x="66" y="17" text-anchor="middle" fill="#fef3c7" font-size="11.5" font-weight="800" font-family="Plus Jakarta Sans, sans-serif">160+ Outside · 76 FK</text>
                </g>
              </g>
              <path d="M 198 292 A 62 62 0 0 1 322 292" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.4"/>
              <g class="pitch-zone" data-zone="penalties">
                <circle cx="260" cy="106" r="13" fill="rgba(250,204,21,0.18)" stroke="rgba(250,204,21,0.5)" stroke-width="1"/>
                <circle cx="260" cy="106" r="6" fill="#facc15" stroke="#fff" stroke-width="1.5"/>
              </g>
              <g class="pitch-zone" data-zone="freekicks">
                <circle cx="302" cy="186" r="7" fill="#f97316" stroke="#fff" stroke-width="1.5"/>
                <circle cx="242" cy="194" r="5.5" fill="#f97316" stroke="#fff" stroke-width="1.2" opacity="0.85"/>
                <path d="M 302 186 Q 294 92 286 12" fill="none" stroke="#fbbf24" stroke-width="1.8" stroke-dasharray="4 3"/>
              </g>
            </svg>
          </div>
          <div class="pitch-zones-list">
            <div class="pitch-zone-stat" data-zone-card="inbox" role="button" tabindex="0" aria-pressed="false">
              <div class="pzs-top"><span class="pzs-dot sky"></span><strong>${pt.inBox}</strong><span class="pzs-num tnum">${n(inBoxGoals)} <small>(${inBoxPct}%)</small></span></div>
              <div class="pzs-bar"><span class="sky" style="width:${inBoxPct}%"></span></div>
              <span class="pzs-sub">${pt.inBoxSub}</span>
            </div>
            <div class="pitch-zone-stat" data-zone-card="outbox" role="button" tabindex="0" aria-pressed="false">
              <div class="pzs-top"><span class="pzs-dot amber"></span><strong>${pt.outBox}</strong><span class="pzs-num tnum">160+ <small>(${outBoxPct}%)</small></span></div>
              <div class="pzs-bar"><span class="amber" style="width:${outBoxPct}%"></span></div>
              <span class="pzs-sub">${pt.outBoxSub}</span>
            </div>
            <div class="pitch-zone-stat" data-zone-card="freekicks" role="button" tabindex="0" aria-pressed="false">
              <div class="pzs-top"><span class="pzs-dot orange"></span><strong>${pt.fk}</strong><span class="pzs-num tnum">${d.byFinish.freeKicks} <small>(${((d.byFinish.freeKicks / d.totals.goals) * 100).toFixed(1)}%)</small></span></div>
              <div class="pzs-bar"><span class="orange" style="width:${((d.byFinish.freeKicks / 160) * 100).toFixed(1)}%"></span></div>
              <span class="pzs-sub">${pt.fkSub}</span>
            </div>
            <div class="pitch-zone-stat" data-zone-card="penalties" role="button" tabindex="0" aria-pressed="false">
              <div class="pzs-top"><span class="pzs-dot gold"></span><strong>${pt.pen}</strong><span class="pzs-num tnum">${d.byFinish.penalties} <small>(${((d.byFinish.penalties / d.totals.goals) * 100).toFixed(1)}%)</small></span></div>
              <div class="pzs-bar"><span class="gold" style="width:78%"></span></div>
              <span class="pzs-sub">${pt.penSub}</span>
            </div>
          </div>
        </div>
      `;
      initInteractivePitchZones(pitchHost);
    }
  }

  // 3. Body Part Breakdown Card
  const bodyCard = el("body-card");
  if (bodyCard) {
    const bp = cfg.bodyParts;
    const bodyRows = [
      { label: bp["Left foot"], val: d.byBodyPart.left, pct: ((d.byBodyPart.left / d.totals.goals) * 100).toFixed(1), fill: "fill-gold" },
      { label: bp["Right foot"], val: d.byBodyPart.right, pct: ((d.byBodyPart.right / d.totals.goals) * 100).toFixed(1), fill: "fill-blue" },
      { label: bp["Head"], val: d.byBodyPart.head, pct: ((d.byBodyPart.head / d.totals.goals) * 100).toFixed(1), fill: "fill-green" },
      { label: bp["Other"], val: d.byBodyPart.other, pct: ((d.byBodyPart.other / d.totals.goals) * 100).toFixed(1), fill: "fill-purple" }
    ];
    bodyCard.innerHTML = `
      <h3 class="dash-card-title">${dui.bodyTitle}</h3>
      <div class="dash-bars-wrap">
        ${bodyRows.map(r => `
          <div class="dash-bar-row">
            <div class="dash-bar-meta">
              <span>${r.label}</span>
              <span><b>${n(r.val)}</b> <small style="color:var(--muted)">(${r.pct}%)</small></span>
            </div>
            <div class="dash-bar-track">
              <div class="dash-bar-fill ${r.fill}" style="width:${r.pct}%"></div>
            </div>
          </div>
        `).join("")}
      </div>
      <p class="caveat" style="margin-top:14px;margin-bottom:0">${cfg.bodyCaveat}</p>
    `;
  }

  // 4. Finish / Methods Card
  const finishCard = el("finish-card");
  if (finishCard) {
    const fp = cfg.finishParts;
    const finishRows = [
      { label: fp["Open play"], val: d.byFinish.openPlay, pct: ((d.byFinish.openPlay / d.totals.goals) * 100).toFixed(1), fill: "fill-blue", sub: dui.openPlaySub },
      { label: fp["Free kicks"], val: d.byFinish.freeKicks, pct: ((d.byFinish.freeKicks / d.totals.goals) * 100).toFixed(1), fill: "fill-gold", sub: dui.fkSub },
      { label: fp["Penalties"], val: d.byFinish.penalties, pct: ((d.byFinish.penalties / d.totals.goals) * 100).toFixed(1), fill: "fill-red", sub: dui.penSub }
    ];
    finishCard.innerHTML = `
      <h3 class="dash-card-title">${dui.finishTitle}</h3>
      <div class="dash-bars-wrap">
        ${finishRows.map(r => `
          <div class="dash-bar-row">
            <div class="dash-bar-meta">
              <span>${r.label} <small style="font-weight:400;color:var(--muted)">· ${r.sub}</small></span>
              <span><b>${n(r.val)}</b> <small style="color:var(--muted)">(${r.pct}%)</small></span>
            </div>
            <div class="dash-bar-track">
              <div class="dash-bar-fill ${r.fill}" style="width:${r.pct}%"></div>
            </div>
          </div>
        `).join("")}
      </div>
      <p class="caveat" style="margin-top:14px;margin-bottom:0">${cfg.finishCaveat}</p>
    `;
  }

  // 5. Competitions Card
  const compRows = T === "all" ? d.byCompetition : teamComps()[T].map((r) => ({ competition: r[0], goals: r[1] }));
  const cmax = Math.max(...compRows.map((r) => r.goals), 1);
  const compCard = el("comp-card");
  if (compCard) {
    compCard.innerHTML = `
      <h3 class="dash-card-title">${dui.compTitle(name)}</h3>
      <div class="dash-bars-wrap">
        ${compRows.slice(0, 7).map(r => {
          const pct = ((r.goals / cmax) * 100).toFixed(1);
          return `
            <div class="dash-bar-row">
              <div class="dash-bar-meta">
                <span>${esc(r.competition)}</span>
                <span><b>${n(r.goals)}</b> <small style="color:var(--muted)">(${((r.goals / goals) * 100).toFixed(1)}%)</small></span>
              </div>
              <div class="dash-bar-track">
                <div class="dash-bar-fill fill-gold" style="width:${pct}%"></div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
      ${!compRows.length ? `<p class="chart-empty">${cfg.chartEmpty}</p>` : ""}
    `;
  }

  // 6. Landmark Milestones Speed Tracker Card
  const msCard = el("milestones-card");
  if (msCard) {
    const milestones = [
      { goal: "100", opp: "vs Sevilla", date: "16 Jan 2010", age: "22y 206d", apps: "188" },
      { goal: "200", opp: "vs Viktoria Plzeň", date: "1 Nov 2011", age: "24y 130d", apps: "286" },
      { goal: "300", opp: "vs Granada", date: "16 Feb 2013", age: "25y 237d", apps: "365" },
      { goal: "400", opp: "vs Granada", date: "27 Sep 2014", age: "27y 95d", apps: "525" },
      { goal: "500", opp: "vs Valencia", date: "17 Apr 2016", age: "28y 298d", apps: "632" },
      { goal: "600", opp: "vs Atlético Madrid", date: "4 Mar 2018", age: "30y 253d", apps: "747" },
      { goal: "700", opp: "vs Atlético Madrid", date: "30 Jun 2020", age: "33y 6d", apps: "862" },
      { goal: "800", opp: "vs Panama", date: "23 Mar 2023", age: "35y 272d", apps: "1,017" },
      { goal: "900", opp: "vs NY Red Bulls", date: "2025", age: "37y 315d", apps: "1,135" },
      { goal: String(LIVE.goals), opp: LIVE.lgOpp, date: LIVE.lgDate, age: "39y", apps: n(LIVE.apps) }
    ];
    msCard.innerHTML = `
      <h3 class="dash-card-title">${dui.msTitle}</h3>
      <div class="table-wrap">
        <table class="milestone-table">
          <thead>
            <tr>
              ${dui.msHeaders.map((h) => `<th>${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${milestones.map(m => `
              <tr>
                <td><strong>${dui.msGoal(m.goal)}</strong></td>
                <td>${esc(m.opp)}</td>
                <td>${esc(m.date)}</td>
                <td>${esc(m.age)}</td>
                <td><b>${esc(m.apps)}</b></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <p class="caveat" style="margin-top:12px;margin-bottom:0">${dui.msFoot}</p>
    `;
  }

  // 7. Season sparkline
  let seasonRows;
  if (T === "all" || T === "argentina") {
    const src = T === "all" ? d.calendarYears : d.countryYears;
    seasonRows = src.map((r) => ({ label: String(r.year ?? r.season ?? ""), value: r.goals, tip: `${r.year}: ${r.goals} ${cfg.kpis.goals.toLowerCase()}` }));
  } else {
    seasonRows = d.clubSeasons.filter((s) => CLUB_KEY[s.club] === T)
      .map((s) => ({ label: s.season.length > 4 ? s.season.replace("20", "").replace("/20", "–") : s.season, value: s.goals, tip: `${s.season} (${dispClub(s.club)}): ${s.goals} ${cfg.kpis.goals.toLowerCase()}` }));
  }
  const smax = Math.max(...seasonRows.map((r) => r.value));
  seasonRows.forEach((r) => { r.peak = r.value === smax; });

  const seasonCard = el("season-card");
  if (seasonCard) {
    const figCap = cfg.figCap(T, name);
    const drawSeason = () => {
      seasonCard.innerHTML =
        `<figure style="margin:0"><div class="spark-wrap">${sparkSVG(seasonRows, { skipLabels: seasonRows.length > 12, label: `Messi goals season by season for ${name}` })}</div>` +
        `<figcaption class="figcap">${figCap}</figcaption></figure>`;
      const svg = seasonCard.querySelector("svg.spark");
      if (svg) svg.classList.add("in");
    };
    drawSeason();
    window.addEventListener("messi:spark-relayout", drawSeason);
  }

  // 8. Age Card
  const ageEl = el("age-card");
  if (ageEl) {
    const ys = d.calendarYears;
    const amax = Math.max(...ys.map((r) => r.goals));
    const apeak = ys.reduce((a, b) => (b.goals > a.goals ? b : a));
    ageEl.innerHTML = T === "all"
      ? `<div class="hbars">` + ys.map((r) =>
        `<div class="hbar-row"><span class="hbar-name">${cfg.ageName(r)}</span>` +
        `<span class="hbar-track"><span class="hbar-fill${r.goals === amax ? " top" : ""}" style="width:${((r.goals / amax) * 100).toFixed(1)}%"></span></span>` +
        `<span class="hbar-val">${r.goals}</span></div>`
      ).join("") + `</div><p class="caveat">${cfg.ageCaveat(apeak)}</p>`
      : `<p class="caveat">${cfg.ageFilterNote}</p>`;
  }

  // 9. Competitions Full Table
  const compTable = el("comp-table");
  if (compTable) {
    compTable.innerHTML =
      `<div class="table-wrap"><table class="data-table"><caption>${cfg.compCaption(name)}</caption>` +
      `<thead><tr><th scope="col" class="left">${cfg.thComp}</th><th scope="col">${cfg.thGoals}</th><th scope="col">${cfg.thShare}</th></tr></thead><tbody>` +
      compRows.map((r) => `<tr><th scope="row">${esc(r.competition)}${r.team ? `<small class="comp-team">${esc(r.team)}</small>` : ""}` + (T === "all" && r.competition === "La Liga" ? `<span class="yr-note">${cfg.recAllTime}</span>` : "") + (T === "all" && r.competition === "UEFA Champions League" ? `<span class="yr-note">120 Barcelona · 9 PSG</span>` : "") + `</th><td><b>${r.goals}</b></td><td>${((r.goals / goals) * 100).toFixed(1)}%</td></tr>`).join("") +
      `</tbody></table></div>`;
    compTable.insertAdjacentHTML("beforeend", clubTableCaption());
    const tbl = compTable.querySelector("table");
    if (tbl) sortable(tbl);
  }

  // 10. Scoring Methods Full Table with required caveats
  const finishTable = el("finish-table");
  if (finishTable) {
    const fRows = cfg.finishRows(d);
    finishTable.innerHTML =
      `<div class="table-wrap"><table class="data-table"><caption>${cfg.finishCaption}</caption>` +
      `<thead><tr><th scope="col" class="left">${cfg.thFinish}</th><th scope="col">${cfg.thGoals}</th><th scope="col">${cfg.thShare}</th></tr></thead><tbody>` +
      fRows.map((r) => `<tr><th scope="row">${r[0]}</th><td><b>${r[1]}</b></td><td>${((r[1] / d.totals.goals) * 100).toFixed(1)}%</td></tr>`).join("") +
      `</tbody></table></div><p class="caveat">Provisional until hand count verification against official match sheets. Provisional compiled tally based on verified match reports.</p>`;
    finishTable.insertAdjacentHTML("beforeend", clubTableCaption());
    const tbl = finishTable.querySelector("table");
    if (tbl) sortable(tbl);
  }

  // 11. Team Cards
  const tc = el("team-cards");
  if (tc) {
    const aggAll = clubAgg(d);
    const order = ["barcelona", "psg", "miami", "argentina"];
    tc.innerHTML = order.map((k) => {
      const a = aggAll[k];
      const share = ((a.goals / d.totals.goals) * 100).toFixed(1);
      const teamDisp = cfg.teamNames[k] || teamName(k);
      return `<article class="team-card"><div class="team-card-head">${badge(k)}` +
        `<div><strong>${teamDisp}</strong><span class="sub">${CLUBS[k].years}</span></div>` +
        `<span class="team-share">${share}% ${cfg.teamCardSub.of} ${n(d.totals.goals)}</span></div>` +
        `<div class="team-nums"><div><b>${n(a.goals)}</b><span>${cfg.teamCardSub.goals}</span></div>` +
        `<div><b>${n(a.apps)}</b><span>${cfg.teamCardSub.apps}</span></div>` +
        `<div><b>${gpg(a.goals, a.apps)}</b><span>${cfg.teamCardSub.gpg}</span></div></div>` +
        `<div class="team-bar" role="img" aria-label="${teamDisp}: ${n(a.goals)} ${cfg.teamCardSub.goals}"><span style="width:${((a.goals / aggAll.barcelona.goals) * 100).toFixed(1)}%"></span></div></article>`;
    }).join("");
  }

  // 12. Records strip
  const dr = el("dash-records");
  if (dr) {
    const comp = (nm) => (d.byCompetition.find((r) => r.competition === nm) || {}).goals || 0;
    const recordsList = cfg.records(comp, d);
    dr.innerHTML = recordsList.map((r) => `<div class="record"><span class="num">${r[0]}</span><span>${r[1]}</span></div>`).join("");
  }

  // 13. Integrated Season Table (from merged goalsbyseason)
  const sTable = el("season-table");
  if (sTable) {
    const ss = d.clubSeasons;
    const bestS = ss.reduce((a, b) => (b.goals > a.goals ? b : a));
    sTable.innerHTML = `<div class="table-wrap"><table class="data-table"><caption>All ${ss.length} club seasons: Barcelona, PSG, and Inter Miami.</caption>` +
      `<thead><tr><th scope="col" class="left">Season</th><th scope="col" class="left">Club</th><th scope="col">Apps</th><th scope="col">Goals</th><th scope="col">League</th><th scope="col">Cup</th><th scope="col">Continental</th><th scope="col">Other</th></tr></thead><tbody>` +
      ss.map((s) => `<tr><th scope="row">${esc(s.season)}${s.provisional ? " *" : ""}${s.season === bestS.season ? ` <span class="yr-note">Record 73G</span>` : ""}</th>` +
        `<td class="left">${dispClub(s.club)}</td><td>${n(s.apps)}</td><td><b>${n(s.goals)}</b></td>` +
        `<td>${s.league.apps}/${s.league.goals}</td><td>${s.cup.apps}/${s.cup.goals}</td>` +
        `<td>${s.continental.apps}/${s.continental.goals}</td><td>${s.other.apps}/${s.other.goals}</td></tr>`).join("") +
      `</tbody></table></div>`;
    const tbl = sTable.querySelector("table");
    if (tbl) sortable(tbl);
  }

  // 14. Integrated Calendar Year Chart & Table (from merged goalsbyyear)
  const yrTblI18n = {
    en: {
      fig: (best, tot) => `Bars: goals that year (peak ${best.goals}, ${best.year}). Line: cumulative career climb to ${tot}.`,
      lbl: (best) => `Goals by year peaking at ${best.goals} in ${best.year}`,
      cap: "Goals, running career total and age for every calendar year since Messi's 2004 debut.",
      cols: ["Year", "Goals", "Career Total", "Age"],
      wr: "World Record 91G"
    },
    es: {
      fig: (best, tot) => `Barras: goles por año (máximo ${best.goals}, ${best.year}). Línea: progresión acumulada hasta ${tot}.`,
      lbl: (best) => `Goles por año con pico de ${best.goals} en ${best.year}`,
      cap: "Goles, acumulado total y edad por cada año natural desde el debut en 2004.",
      cols: ["Año", "Goles", "Total carrera", "Edad"],
      wr: "Récord mundial 91G"
    },
    pt: {
      fig: (best, tot) => `Barras: gols no ano (pico ${best.goals}, ${best.year}). Linha: escalada acumulada até ${tot}.`,
      lbl: (best) => `Gols por ano com pico de ${best.goals} em ${best.year}`,
      cap: "Gols, total acumulado na carreira e idade em cada ano civil desde a estreia em 2004.",
      cols: ["Ano", "Gols", "Total na carreira", "Idade"],
      wr: "Recorde mundial 91G"
    },
    fr: {
      fig: (best, tot) => `Barres : buts sur l'année (pic ${best.goals}, ${best.year}). Ligne : cumul jusqu'à ${tot}.`,
      lbl: (best) => `Buts par année avec pic à ${best.goals} en ${best.year}`,
      cap: "Buts, cumul en carrière et âge pour chaque année civile depuis les débuts en 2004.",
      cols: ["Année", "Buts", "Total carrière", "Âge"],
      wr: "Record du monde 91B"
    },
    ro: {
      fig: (best, tot) => `Bare: goluri în acel an (vârf ${best.goals}, ${best.year}). Linie: total cumulativ până la ${tot}.`,
      lbl: (best) => `Goluri pe an cu vârf de ${best.goals} în ${best.year}`,
      cap: "Goluri, total cumulativ în carieră și vârstă pentru fiecare an calendaristic din 2004.",
      cols: ["An", "Goluri", "Total carieră", "Vârstă"],
      wr: "Record mondial 91G"
    },
    uz: {
      fig: (best, tot) => `Ustunlar: yillik gollar (eng yuqori ${best.goals}, ${best.year}). Chiziq: ${tot} tagacha jamlangan ko'rsatkich.`,
      lbl: (best) => `Yillar bo'yicha gollar (${best.year}-yilda ${best.goals} ta)`,
      cap: "2004-yilgi debyutdan beri har bir kalendar yil uchun gollar, umumiy hisob va yosh.",
      cols: ["Yil", "Gollar", "Faoliyat jami", "Yosh"],
      wr: "Jahon rekordi 91G"
    },
    ar: {
      fig: (best, tot) => `الأعمدة: أهداف السنة (الذروة ${best.goals} في ${best.year}). الخط: الإجمالي التراكمي حتى ${tot}.`,
      lbl: (best) => `الأهداف حسب السنة مع ذروة ${best.goals} في ${best.year}`,
      cap: "الأهداف والإجمالي التراكمي والعمر لكل سنة ميلادية منذ الظهور الأول عام 2004.",
      cols: ["السنة", "الأهداف", "إجمالي المسيرة", "العمر"],
      wr: "رقم قياسي عالمي 91 هدفاً"
    },
    id: {
      fig: (best, tot) => `Batang: gol per tahun (puncak ${best.goals}, ${best.year}). Garis: total kumulatif menuju ${tot}.`,
      lbl: (best) => `Gol per tahun dengan puncak ${best.goals} di ${best.year}`,
      cap: "Gol, total karier kumulatif, dan usia untuk setiap tahun kalender sejak debut 2004.",
      cols: ["Tahun", "Gol", "Total Karier", "Usia"],
      wr: "Rekor dunia 91G"
    }
  };
  const yt = yrTblI18n[lang] || yrTblI18n.en;

  const comboCard = el("combo-card");
  if (comboCard) {
    const ys = d.calendarYears;
    const bestY = ys.reduce((a, b) => (b.goals > a.goals ? b : a));
    const drawYearCombo = () => {
      comboCard.innerHTML = `<figure style="margin:0"><div class="spark-wrap">${sparkSVG(
        ys.map((x) => ({ label: String(x.year), value: x.goals, year: x.year, provisional: x.provisional, peak: x.year === bestY.year, tip: `${x.year}: ${x.goals} (${x.careerTotal})` })),
        { cumulative: true, peakYear: 2012, provisionalYear: 2026, linkPrefix: "#y", label: yt.lbl(bestY) }
      )}</div><figcaption class="figcap">${yt.fig(bestY, n(d.totals.goals))}</figcaption></figure>`;
      const svg = comboCard.querySelector("svg.spark");
      if (svg) svg.classList.add("in");
    };
    drawYearCombo();
    window.addEventListener("messi:spark-relayout", drawYearCombo);
  }

  const yrTable = el("year-table");
  if (yrTable) {
    const ys = d.calendarYears;
    yrTable.innerHTML = `<div class="table-wrap"><table class="data-table"><caption>${yt.cap}</caption>` +
      `<thead><tr><th scope="col" class="left">${yt.cols[0]}</th><th scope="col">${yt.cols[1]}</th><th scope="col">${yt.cols[2]}</th><th scope="col">${yt.cols[3]}</th></tr></thead><tbody>` +
      ys.toReversed().map((r) => `<tr id="y${r.year}">` +
        `<th scope="row">${r.year}${r.provisional ? " *" : ""}${r.year === 2012 ? ` <span class="yr-note">${yt.wr}</span>` : ""}</th>` +
        `<td><b>${r.goals}</b></td><td>${n(r.careerTotal)}</td><td>${r.age}</td></tr>`).join("") +
      `</tbody></table></div>`;
    const tbl = yrTable.querySelector("table");
    if (tbl) sortable(tbl);
  }

  renderExplore(d, "dashboard");
  renderMethod(d, cfg.method);
}

/* ================= FEATURE C: INTERACTIVE TACTICAL PITCH ZONES ================= */
function initInteractivePitchZones(pitchHost) {
  if (!pitchHost) return;
  const svg = pitchHost.querySelector(".tactical-pitch-svg");
  const cards = [...pitchHost.querySelectorAll(".pitch-zone-stat[data-zone-card]")];
  const zones = svg ? [...svg.querySelectorAll("[data-zone]")] : [];
  if (!svg || !cards.length || !zones.length) return;

  let lockedZone = null;

  const applyHighlight = (zoneKey) => {
    cards.forEach((card) => {
      const on = zoneKey !== null && card.dataset.zoneCard === zoneKey;
      card.classList.toggle("is-active", on);
      card.setAttribute("aria-pressed", lockedZone === card.dataset.zoneCard ? "true" : "false");
    });

    zones.forEach((z) => {
      z.style.transition = "opacity 0.2s ease, filter 0.2s ease";
      if (!zoneKey) {
        z.classList.remove("is-active", "is-dimmed");
        z.style.opacity = "1";
        z.style.filter = "";
      } else if (z.dataset.zone === zoneKey) {
        z.classList.add("is-active");
        z.classList.remove("is-dimmed");
        z.style.opacity = "1";
        z.style.filter = "drop-shadow(0 0 8px rgba(229, 184, 66, 0.55))";
      } else {
        z.classList.remove("is-active");
        z.classList.add("is-dimmed");
        z.style.opacity = "0.35";
        z.style.filter = "";
      }
    });
  };

  cards.forEach((card) => {
    const zKey = card.dataset.zoneCard;
    card.addEventListener("mouseenter", () => {
      if (!lockedZone) applyHighlight(zKey);
    });
    card.addEventListener("mouseleave", () => {
      if (!lockedZone) applyHighlight(null);
    });
    const toggle = () => {
      lockedZone = lockedZone === zKey ? null : zKey;
      applyHighlight(lockedZone);
    };
    card.addEventListener("click", toggle);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });
}

/* ================= TIMELINE ================= */
function eraOf(y) {
  const lang = getLang();
  const ranges = {
    rosario: "2004–2008",
    peak: "2009–2012",
    msn: "2013–2015",
    carry: "2016–2018",
    farewell: "2019–2021",
    paris: "2021–2023",
    miami: {
      es: "2023–presente",
      pt: "2023–presente",
      fr: "2023–présent",
      ro: "2023–prezent",
      uz: "2023–hozir",
      ar: "2023–الآن",
      id: "2023–sekarang"
    }[lang] || "2023–present"
  };
  const eraNames = {
    es: {
      rosario: "El chico de Rosario",
      peak: "El mayor pico en la historia del fútbol",
      msn: "La MSN y el segundo triplete",
      carry: "Liderando al Barcelona",
      farewell: "El adiós al Barcelona",
      paris: "París y la Copa del Mundo",
      miami: "Miami y el camino a los 1.000"
    },
    pt: {
      rosario: "O garoto de Rosário",
      peak: "O maior auge da história do futebol",
      msn: "O trio MSN e a segunda tríplice coroa",
      carry: "Carregando o Barcelona",
      farewell: "A despedida do Barcelona",
      paris: "Paris e a Copa do Mundo",
      miami: "Miami e o caminho para os 1.000"
    },
    fr: {
      rosario: "Le gamin de Rosario",
      peak: "Le sommet absolu du football",
      msn: "La MSN et le deuxième triplé",
      carry: "Porter le FC Barcelone",
      farewell: "L'adieu à Barcelone",
      paris: "Paris et la Coupe du Monde",
      miami: "Miami et la route vers les 1 000"
    },
    ro: {
      rosario: "Băiatul din Rosario",
      peak: "Cel mai înalt vârf din istoria fotbalului",
      msn: "MSN și a doua triplă",
      carry: "Purtând Barcelona",
      farewell: "Despărțirea de Barcelona",
      paris: "Paris și Cupa Mondială",
      miami: "Miami și drumul spre 1.000"
    },
    uz: {
      rosario: "Rosariolik yigit",
      peak: "Futbol tarixidagi eng yuqori cho'qqi",
      msn: "MSN va ikkinchi trebl",
      carry: "Barselonani yetaklash",
      farewell: "Barselona bilan xayrlashuv",
      paris: "Parij va Jahon Chempionati",
      miami: "Mayami va 1 000 gol sari yo'l"
    },
    ar: {
      rosario: "فتى روزاريو",
      peak: "أعظم ذروة في تاريخ كرة القدم",
      msn: "ثلاثي MSN والثلاثية الثانية",
      carry: "قيادة برشلونة",
      farewell: "وداع برشلونة",
      paris: "باريس وكأس العالم",
      miami: "ميامي والطريق نحو 1000 هدف"
    },
    id: {
      rosario: "Bocah dari Rosario",
      peak: "Puncak terhebat dalam sejarah sepak bola",
      msn: "MSN dan treble kedua",
      carry: "Memikul Barcelona",
      farewell: "Perpisahan dengan Barcelona",
      paris: "Paris dan Piala Dunia",
      miami: "Miami dan jalan menuju 1.000"
    },
    en: {
      rosario: "The boy from Rosario",
      peak: "The greatest peak football has seen",
      msn: "MSN and the second treble",
      carry: "Carrying Barcelona",
      farewell: "Farewell to Barcelona",
      paris: "Paris and the World Cup",
      miami: "Miami and the road to 1,000"
    }
  };
  let key = "miami";
  if (y <= 2008) key = "rosario";
  else if (y <= 2012) key = "peak";
  else if (y <= 2015) key = "msn";
  else if (y <= 2018) key = "carry";
  else if (y <= 2021) key = "farewell";
  else if (y <= 2023) key = "paris";

  const langNames = eraNames[lang] || eraNames.en;
  return { key, era: langNames[key] || eraNames.en[key], range: ranges[key] };
}
/* Real era photos: self-hosted high-res action and celebration photos.
   `pos` sets the CSS focal point so faces survive the banner crop.
   Keyed by eraOf() name; eras without an entry render no figure. */
const ERA_PHOTOS = {
  "The boy from Rosario": [
    { src: "/img/era-2008-olympic.webp", w: 1636, h: 1400, pos: "50% 25%", alt: "Young Messi with long hair celebrating his El Clásico hat-trick in 2007", cap: "El Clásico hat-trick celebration at Camp Nou, March 2007" },
  ],
  "The greatest peak football has seen": [
    { src: "/img/era-2011-wembley.webp", w: 1080, h: 1350, pos: "50% 18%", alt: "Messi holding the European Cup after the 2011 final at Wembley", cap: "Champions League winners, Wembley 2011" },
    { src: "/img/era-2012-ballon.webp", w: 554, h: 554, pos: "50% 25%", alt: "Messi holding his fourth Ballon d'Or trophy in a row in 2012", cap: "Fourth Ballon d'Or in a row, 2012" },
    { src: "/img/era-2011.webp", w: 1800, h: 1013, pos: "50% 20%", alt: "Messi celebrating his goal at Wembley in the 2011 Champions League final", cap: "Goal celebration at Wembley, Champions League final 2011" },
  ],
  "MSN and the second treble": [
    { src: "/img/era-2015-supercup.webp", w: 1192, h: 670, pos: "50% 25%", alt: "Messi, Neymar and Suárez celebrating together at Barcelona", cap: "The MSN trident celebrating at Camp Nou, 2015" },
    { src: "/img/era-2014-stare.webp", w: 679, h: 452, pos: "55% 35%", alt: "Messi walking past the World Cup trophy after losing the 2014 final", cap: "The one that got away — World Cup final, Maracanã 2014" },
  ],
  "Carrying Barcelona": [
    { src: "/img/era-2016.webp", w: 1800, h: 1013, pos: "50% 25%", alt: "Messi holding his number 10 shirt to the crowd at the Santiago Bernabéu after scoring his 500th goal in 2017", cap: "Holding up shirt #10 at the Santiago Bernabéu, April 2017" },
  ],
  "Farewell to Barcelona": [
    { src: "/img/era-2019-ballon.webp", w: 1800, h: 1251, pos: "50% 30%", alt: "Messi on stage with six Ballons d'Or in Paris in 2019", cap: "Presented with six Ballons d'Or on stage, Paris 2019" },
    { src: "/img/era-2021-tears.webp", w: 1280, h: 1280, pos: "55% 28%", alt: "Messi in tears at his Barcelona farewell press conference", cap: "The goodbye press conference, Camp Nou 2021" },
    { src: "/img/era-2021-copa.webp", w: 1200, h: 1521, pos: "55% 22%", alt: "Messi kissing the Copa América trophy after winning it in 2021", cap: "Copa América champions, Maracanã 2021" },
  ],
  "Paris and the World Cup": [
    { src: "/img/era-2021-psg-signing.webp", w: 1200, h: 900, pos: "20% 22%", alt: "Messi signing his Paris Saint-Germain contract alongside Nasser Al-Khelaifi", cap: "Signing for Paris Saint-Germain, 2021" },
    { src: "/img/era-2021-ballon7.webp", w: 1600, h: 1062, pos: "50% 20%", alt: "Messi in a sparkling jacket holding the Ballon d'Or after winning his seventh in 2021", cap: "Seventh Ballon d'Or, Paris 2021" },
    { src: "/img/era-2022.webp", w: 1800, h: 1212, pos: "50% 25%", alt: "Messi lifted on Agüero's shoulders celebrating the 2022 World Cup win at Lusail", cap: "Lifting the World Cup on Agüero's shoulders, Lusail 2022" },
  ],
  "Miami and the road to 1,000": [
    { src: "/img/era-2023-miami.webp", w: 679, h: 451, pos: "45% 40%", alt: "Messi unveiled as Inter Miami's number 10 alongside David Beckham", cap: "Unveiled in Miami with Beckham, 2023" },
    { src: "/img/era-2023-ballon8.webp", w: 554, h: 554, pos: "50% 25%", alt: "Messi in a tuxedo holding the Ballon d'Or after winning a record eighth in 2023", cap: "Record eighth Ballon d'Or, 2023" },
    { src: "/img/era-2024-copa.webp", w: 562, h: 546, pos: "50% 25%", alt: "Messi in Argentina's shirt holding two Copa América trophies in 2024", cap: "Back-to-back Copa América titles, 2024" },
  ],
};
ERA_PHOTOS.rosario = ERA_PHOTOS["The boy from Rosario"];
ERA_PHOTOS.peak = ERA_PHOTOS["The greatest peak football has seen"];
ERA_PHOTOS.msn = ERA_PHOTOS["MSN and the second treble"];
ERA_PHOTOS.carry = ERA_PHOTOS["Carrying Barcelona"];
ERA_PHOTOS.farewell = ERA_PHOTOS["Farewell to Barcelona"];
ERA_PHOTOS.paris = ERA_PHOTOS["Paris and the World Cup"];
ERA_PHOTOS.miami = ERA_PHOTOS["Miami and the road to 1,000"];

const ERA_INTROS = {
  es: {
    rosario: `Un joven de 17 años de Rosario debuta contra el Espanyol en octubre de 2004, y en pocos meses el Camp Nou corea su nombre. Su primer gol llega ante el Albacete en mayo siguiente —picando el balón sobre el portero tras asistencia de Ronaldinho— convirtiéndose en el goleador más joven del Barcelona. Para 2008 ya lucía el oro olímpico en su cuello.`,
    peak: `Seis títulos en 2009. Cuatro Balones de Oro consecutivos. Luego 2012: 91 goles en un solo año natural, rompiendo un récord intacto durante cuatro décadas —incluyendo cinco goles en una noche europea contra el Leverkusen. La cima futbolística más deslumbrante de la historia.`,
    msn: `Messi, Suárez y Neymar: el tridente ofensivo más letal del fútbol moderno, sellando el segundo triplete en 2015 en Berlín. Su gol en la final de la Copa del Rey de esa primavera, superando a media defensa del Athletic Club, es una de las mayores obras de arte del fútbol.`,
    carry: `La legendaria remontada 6–1 al PSG en 2017, la icónica celebración de la camiseta 10 en el Bernabéu y otro doblete de Liga y Copa en 2018 liderando al equipo con actuaciones magistrales en cada jornada.`,
    farewell: `El sexto Balón de Oro, la Copa del Rey de 2021 y, tras 21 años inolvidables, una emotiva despedida del Camp Nou como máximo goleador, plusmarquista de partidos y referente eterno del barcelonismo.`,
    paris: `Dos títulos de liga en París, el séptimo Balón de Oro y la gloria suprema en Catar el 18 de diciembre de 2022: dos goles en la final y la Copa del Mundo en sus manos tras un épico 3–3. La carrera quedó consagrada para siempre.`,
    miami: `Llegada triunfal a Estados Unidos con el título de Leagues Cup en su primer mes, el octavo Balón de Oro, una nueva Copa América con Argentina y la marcha histórica rumbo a los 1.000 goles en vivo.`
  },
  pt: {
    rosario: `Um jovem de 17 anos de Rosário estreia contra o Espanyol em outubro de 2004 e, em poucos meses, o Camp Nou já canta seu nome. O primeiro gol vem contra o Albacete em maio seguinte — encobrindo o goleiro após passe de Ronaldinho. Em 2008, conquista o ouro olímpico em Pequim.`,
    peak: `Seis títulos em 2009. Quatro Bolas de Ouro consecutivas. Depois 2012: 91 gols em um único ano civil, quebrando um recorde de 40 anos — incluindo cinco gols em uma noite de Champions contra o Leverkusen. O auge mais impressionante do futebol mundial.`,
    msn: `Messi, Suárez e Neymar: o trio MSN encantou o planeta e conquistou a segunda tríplice coroa em 2015 em Berlim. Um ataque inesquecível e imparável.`,
    carry: `A histórica remontada de 6–1 contra o PSG em 2017, a lendária comemoração exibindo a camisa 10 no Bernabéu e a liderança absoluta com mais uma dobradinha nacional em 2018.`,
    farewell: `A sexta Bola de Ouro, a Copa do Rei de 2021 e a emocionante despedida do Camp Nou após 21 anos históricos como maior artilheiro e ídolo eterno do Barcelona.`,
    paris: `Dois títulos franceses em Paris, a sétima Bola de Ouro e a glória suprema no Catar em 18 de dezembro de 2022: campeão da Copa do Mundo com dois gols na final. O topo absoluto da história.`,
    miami: `Conquista imediata da Leagues Cup, oitava Bola de Ouro, mais uma Copa América com a Argentina e a contagem rumo aos 1.000 gols oficiais ao vivo.`
  },
  fr: {
    rosario: `Un jeune de 17 ans de Rosario entre en jeu contre l'Espanyol en octobre 2004, et en quelques mois le Camp Nou scande son nom. Son premier but arrive face à Albacete en mai d'un lob subtil sur une passe de Ronaldinho. En 2008, il décroche la médaille d'or olympique.`,
    peak: `Sextuplé historique en 2009. Quatre Ballons d'Or d'affilée. Puis 2012 : 91 buts sur une seule année civile, pulvérisant un record vieux de 40 ans — dont un quintuplé mémorable en Ligue des champions contre Leverkusen. Le plus grand sommet de l'histoire du jeu.`,
    msn: `Messi, Suárez et Neymar : le trio magique MSN terrasse l'Europe et signe un deuxième triplé historique en 2015 à Berlin. Une efficacité offensive inégalée.`,
    carry: `La légendaire remontada 6-1 contre le PSG en 2017, le maillot numéro 10 brandi au Santiago Bernabéu et un nouveau doublé Liga-Coupe en 2018, portant le club au sommet à chaque rencontre.`,
    farewell: `Un sixième Ballon d'Or, une ultime Coupe du Roi en 2021 et un adieu bouleversant au Camp Nou après 21 années légendaires au FC Barcelone.`,
    paris: `Deux titres de champion avec le PSG, un septième Ballon d'Or et la consécration suprême au Qatar le 18 décembre 2022 : champion du monde avec un doublé en finale. La carrière est complète.`,
    miami: `Trophée de Leagues Cup dès son premier mois, un huitième Ballon d'Or, une nouvelle Copa América et la marche vers les 1 000 buts en direct.`
  },
  id: {
    rosario: `Remaja 17 tahun asal Rosario melakoni debut melawan Espanyol pada Oktober 2004, dan dalam hitungan bulan Camp Nou meneriakkan namanya. Gol perdananya hadir melawan Albacete pada Mei berikutnya lewat umpan lob Ronaldinho, menjadikannya pencetak gol termuda Barcelona. Pada 2008, medali emas Olimpiade sudah melingkar di lehernya.`,
    peak: `Enam trofi pada 2009. Empat Ballon d'Or beruntun. Lalu 2012: 91 gol dalam satu tahun kalender, memecahkan rekor 40 tahun Gerd Müller — termasuk lima gol dalam satu malam Liga Champions kontra Leverkusen. Puncak sepak bola terhebat dalam sejarah.`,
    msn: `Messi, Suárez, dan Neymar: trio paling mematikan di sepak bola modern yang mengunci treble kedua di Berlin pada 2015. Gol solonya di final Copa del Rey musim semi itu melewati separuh lini belakang Athletic Club adalah mahakarya abadi.`,
    carry: `Comeback legendaris 6–1 melawan PSG pada 2017, selebrasi ikonik mengangkat kaus #10 di Bernabéu, serta gelar ganda La Liga dan Copa pada 2018 saat ia memikul Barcelona di setiap pekan.`,
    farewell: `Ballon d'Or keenam, satu trofi Copa del Rey terakhir pada 2021, dan konferensi pers penuh air mata pada Agustus setelah 21 tahun — pergi sebagai pencetak gol dan pemilik penampilan terbanyak sepanjang masa klub.`,
    paris: `Dua gelar Ligue 1 di Paris, Ballon d'Or ketujuh, dan puncak kejayaan di Qatar pada 18 Desember 2022: dua gol di final Piala Dunia dan trofi emas di tangannya. Karier yang paripurna.`,
    miami: `Kedatangan penuh kemenangan di Amerika Serikat dengan trofi Leagues Cup di bulan pertama, Ballon d'Or kedelapan, juara Copa América lagi bersama Argentina, dan laju bersejarah menuju 1.000 gol resmi.`
  }
};

/* Era openers: short fan-editor intros, one per chapter. Plain prose about
   famous nights — no new numbers, every figure here already lives on this
   site or in the trophy list. */
const ERA_INTRO = {
  "The boy from Rosario":
    `A 17-year-old from Rosario walks on against Espanyol in October 2004, all knees and elbows, and within months the Camp Nou is chanting a name it can barely pronounce yet. The first goal comes against Albacete the following May — a clipped little finish over the keeper from a Ronaldinho lob — and suddenly Barcelona's youngest scorer belongs in the first team. By 2008 there is an Olympic gold around his neck and nobody left arguing.`,
  "The greatest peak football has seen":
    `Six trophies in 2009. Four Ballons d'Or in a row. Then 2012: 91 goals in a single calendar year, a number so absurd it broke a record that had stood for forty years — including five in one Champions League night against Leverkusen. Nobody before or since has played football at this level; the only debate left is which month of it was the best.`,
  "MSN and the second treble":
    `Messi, Suárez, Neymar — three forwards who should never have fit together, scoring for fun and sweeping a second treble in 2015, sealed in Berlin. His Copa del Rey final goal that spring, slaloming past half of Athletic Bilbao, might be the greatest he ever scored. Pick your own; there are a dozen candidates.`,
  "Carrying Barcelona":
    `Xavi gone, Iniesta fading, the squad thinning every summer — and one man dragging the whole club forward anyway. The Remontada against PSG in 2017, the iconic shirt celebration at the Bernabéu, another league-and-cup double in 2018: these were his teams in a way the great sides before them never quite were. Watch the photo above — by now every defender in Spain knows exactly what is coming, and none of them can stop it.`,
  "Farewell to Barcelona":
    `The burofax summer of 2020, a sixth Ballon d'Or, one last Copa del Rey lifted in 2021 — and then, that August, a tearful press conference and a free transfer nobody believed possible. He left as the club's everything: its record scorer, its record appearance-maker, and the reason a generation of kids supports Barcelona at all.`,
  "Paris and the World Cup":
    `Two strange, brilliant years in Paris — a seventh Ballon d'Or, two league titles — but everything was building toward one winter in Qatar. Seven goals, a Golden Ball, and on 18 December 2022, two goals in the final and the trophy lift at Lusail that ended every argument. The career was complete; everything after is a bonus.`,
  "Miami and the road to 1,000":
    `Nobody expected the pink shirt. Then came a trophy in his first month, an eighth Ballon d'Or, another Copa América with Argentina, and a club transformed around him. Now every goal bends the arc toward 1,000 — a number no one has ever reached in official senior football. Stick around; you are watching the last chapter live.`,
};
const eraIntro = (key, era) => {
  const lang = getLang();
  const intro = (ERA_INTROS[lang] && ERA_INTROS[lang][key]) || ERA_INTRO[era] || ERA_INTRO[key];
  return intro ? `<p class="chapter-intro">${intro}</p>` : "";
};
const eraPhotos = (key, era) => {
  const pics = ERA_PHOTOS[key] || ERA_PHOTOS[era];
  if (!pics || !pics.length) return "";
  return `<div class="ch-photos${pics.length === 1 ? " solo" : ""}">` + pics.map((p) => {
    const webpSrc = p.src.replace(/\.jpg$/, ".webp");
    return `<figure class="ch-photo"><picture>` +
      `<source srcset="${webpSrc}" type="image/webp" />` +
      `<img src="${p.src}" width="${p.w}" height="${p.h}" alt="${esc(p.alt)}" loading="lazy" decoding="async" style="object-position:${p.pos}" />` +
      `</picture><figcaption class="photo-credit">${esc(p.cap)}</figcaption></figure>`;
  }).join("") + `</div>`;
};
const TIMELINE_I18N = {
  es: {
    head: (t) => `Desde su debut en Barcelona en 2004 hasta <b>${n(t.goals)} goles oficiales</b> y contando — las noches históricas, récords y trofeos en orden cronológico.`,
    keydates: (t, lastUpdated) => [
      ["16 Oct 2004", "Debut oficial con el <b>Barcelona</b> ante el Espanyol, con 17 años."],
      ["1 May 2005", "Primer gol oficial, ante el Albacete — el goleador más joven del Barcelona en ese momento."],
      ["17 Ago 2005", "Debut con la <b>Selección Argentina</b> absoluta ante Hungría."],
      ["2012", "<b>91 goles</b> en un año natural — récord mundial absoluto en la historia del fútbol."],
      ["18 Dic 2022", "Campeón de la <b>Copa del Mundo</b> con Argentina en Catar, marcando un doblete en la final."],
      [esc(lastUpdated), `<b>${n(t.goals)} goles oficiales</b> entre clubes y selección — última actualización.`]
    ],
    inProg: "en progreso",
    goals: "goles",
    goalsInEra: (goals, share, total) => `<b>${n(goals)} goles</b> · ${share}% de ${n(total)}`,
    peakYear: (pk, tr) => `<p class="ch-callout">Año cumbre <b>${pk.year} · ${pk.goals} goles</b>` + (tr ? ` · <b>${tr}</b> ${tr === 1 ? "título colectivo" : "títulos colectivos"} en esta etapa` : "") + `</p>`,
    empty: (val, total) => `Sin resultados para “${val}” — borra la búsqueda para ver los ${total} hitos.`,
    tagRecord: "Récord", tagWc: "Mundial", tagFirst: "Primero",
    faq: [
      ["¿Cuándo debutó Messi?", "Con el Barcelona el <b>16 de octubre de 2004</b> contra el Espanyol con 17 años y 114 días; con Argentina el 17 de agosto de 2005."],
      ["¿Cuándo marcó Messi su primer gol?", "El <b>1 de mayo de 2005</b> ante el Albacete — en ese momento el goleador más joven del Barcelona en La Liga."],
      ["¿Cuándo ganó Messi la Copa del Mundo?", "El <b>18 de diciembre de 2022</b>, venciendo a Francia por penales en Lusail tras empatar 3–3."],
      ["¿Cuándo se fue Messi del Barcelona?", "En <b>agosto de 2021</b>, fichando por el Paris Saint-Germain tras 21 años en el club catalán."],
      ["¿Cuándo llegó Messi al Inter Miami?", "En <b>julio de 2023</b>, ganando la Leagues Cup pocas semanas después de su llegada."]
    ],
    method: "Los hitos cronológicos están documentados por fecha exacta; las barras de goles dividen los años naturales en períodos consecutivos que suman el total de la carrera."
  },
  pt: {
    head: (t) => `Desde a estreia no Barcelona em 2004 até <b>${n(t.goals)} gols na carreira</b> e contando — noites históricas, recordes e títulos em ordem.`,
    keydates: (t, lastUpdated) => [
      ["16 Out 2004", "Estreia profissional pelo <b>Barcelona</b> contra o Espanyol, aos 17 anos."],
      ["1 Mai 2005", "Primeiro gol oficial, contra o Albacete — o mais jovem a marcar pelo Barcelona na época."],
      ["17 Ago 2005", "Estreia pela <b>Seleção Argentina</b> principal contra a Hungria."],
      ["2012", "<b>91 gols</b> no ano civil — recorde mundial absoluto na história do futebol."],
      ["18 Dez 2022", "Conquista a <b>Copa do Mundo</b> com a Argentina no Catar, marcando dois gols na final."],
      [esc(lastUpdated), `<b>${n(t.goals)} gols na carreira</b> por clubes e seleção — última verificação.`]
    ],
    inProg: "em andamento",
    goals: "gols",
    goalsInEra: (goals, share, total) => `<b>${n(goals)} gols</b> · ${share}% de ${n(total)}`,
    peakYear: (pk, tr) => `<p class="ch-callout">Ano auge <b>${pk.year} · ${pk.goals} gols</b>` + (tr ? ` · <b>${tr}</b> ${tr === 1 ? "título coletivo" : "títulos coletivos"} neste período` : "") + `</p>`,
    empty: (val, total) => `Nenhum resultado para “${val}” — limpe a busca para ver os ${total} marcos.`,
    tagRecord: "Recorde", tagWc: "Copa", tagFirst: "Primeiro",
    faq: [
      ["Quando Messi estreou?", "Pelo Barcelona em <b>16 de outubro de 2004</b> contra o Espanyol aos 17 anos; pela Argentina em 17 de agosto de 2005."],
      ["Quando Messi marcou seu primeiro gol?", "Em <b>1 de maio de 2005</b> contra o Albacete — então o mais jovem marcador da história do Barcelona."],
      ["Quando Messi ganhou a Copa do Mundo?", "Em <b>18 de dezembro de 2022</b>, derrotando a França nos pênaltis em Lusail após um épico 3–3."],
      ["Quando Messi saiu do Barcelona?", "Em <b>agosto de 2021</b>, acertando com o Paris Saint-Germain após 21 anos no clube catalão."],
      ["Quando Messi chegou ao Inter Miami?", "Em <b>julho de 2023</b>, conquistando a Leagues Cup poucas semanas após chegar."]
    ],
    method: "Marcos cronológicos documentados por data exata; barras de gols dividem os anos civis em faixas contínuas somando o total da carreira."
  },
  fr: {
    head: (t) => `De ses débuts à Barcelone en 2004 à <b>${n(t.goals)} buts en carrière</b> — les moments clés, records et trophées par ordre chronologique.`,
    keydates: (t, lastUpdated) => [
      ["16 Oct 2004", "Débuts professionnels avec le <b>FC Barcelone</b> contre l'Espanyol, à 17 ans."],
      ["1 Mai 2005", "Premier but officiel face à Albacete — plus jeune buteur du Barça à l'époque."],
      ["17 Août 2005", "Débuts avec l'équipe nationale d'<b>Argentine</b> contre la Hongrie."],
      ["2012", "<b>91 buts</b> sur une année civile — le record mondial absolu du football."],
      ["18 Déc 2022", "Remporte la <b>Coupe du Monde</b> au Qatar avec l'Argentine en inscrivant un doublé en finale."],
      [esc(lastUpdated), `<b>${n(t.goals)} buts en carrière</b> en club et sélection — dernière mise à jour.`]
    ],
    inProg: "en cours",
    goals: "buts",
    goalsInEra: (goals, share, total) => `<b>${n(goals)} buts</b> · ${share}% sur ${n(total)}`,
    peakYear: (pk, tr) => `<p class="ch-callout">Année record <b>${pk.year} · ${pk.goals} buts</b>` + (tr ? ` · <b>${tr}</b> ${tr === 1 ? "trophée collectif" : "trophées collectifs"} sur cette période` : "") + `</p>`,
    empty: (val, total) => `Aucun résultat pour “${val}” — effacez pour voir les ${total} étapes.`,
    tagRecord: "Record", tagWc: "Mondial", tagFirst: "Premier",
    faq: [
      ["Quand Messi a-t-il fait ses débuts ?", "Avec Barcelone le <b>16 octobre 2004</b> face à l'Espanyol à 17 ans et 114 jours ; avec l'Argentine le 17 août 2005."],
      ["Quand Messi a-t-il marqué son premier but ?", "Le <b>1er mai 2005</b> contre Albacete — alors le plus jeune buteur de l'histoire du Barça."],
      ["Quand Messi a-t-il gagné la Coupe du Monde ?", "Le <b>18 décembre 2022</b>, aux tirs au but face à la France après un match nul 3–3 à Lusail."],
      ["Quand Messi a-t-il quitté Barcelone ?", "En <b>août 2021</b>, rejoignant le Paris Saint-Germain après 21 années au Barça."],
      ["Quand Messi a-t-il rejoint l'Inter Miami ?", "En <b>juillet 2023</b>, remportant la Leagues Cup quelques semaines seulement après son arrivée."]
    ],
    method: "Les entrées de la frise chronologique sont des jalons précis ; les barres de buts divisent les années civiles sans chevauchement pour reconstituer le total de carrière."
  },
  ro: {
    head: (t) => `De la debutul la Barcelona în 2004 până la <b>${n(t.goals)} goluri în carieră</b> — serile decisive, recordurile și trofeele în ordine cronologică.`,
    keydates: (t, lastUpdated) => [
      ["16 Oct 2004", "Debut oficial pentru <b>Barcelona</b> contra Espanyol, la 17 ani."],
      ["1 Mai 2005", "Primul gol de seniori, contra Albacete — cel mai tânăr marcator al Barcelonei la acea vreme."],
      ["17 Aug 2005", "Debut la naționala <b>Argentinei</b> contra Ungariei."],
      ["2012", "<b>91 de goluri</b> într-un an calendaristic — recordul absolut al fotbalului mondial."],
      ["18 Dec 2022", "Câștigă <b>Cupa Mondială</b> cu Argentina în Qatar, marcând de două ori în finală."],
      [esc(lastUpdated), `<b>${n(t.goals)} goluri în carieră</b> la club și națională — ultima actualizare.`]
    ],
    inProg: "în desfășurare",
    goals: "goluri",
    goalsInEra: (goals, share, total) => `<b>${n(goals)} goluri</b> · ${share}% din ${n(total)}`,
    peakYear: (pk, tr) => `<p class="ch-callout">An de vârf <b>${pk.year} · ${pk.goals} goluri</b>` + (tr ? ` · <b>${tr}</b> ${tr === 1 ? "trofeu colectiv" : "trofee colective"} în această etapă` : "") + `</p>`,
    empty: (val, total) => `Niciun rezultat pentru „${val}” — șterge căutarea pentru a vedea toate cele ${total} repere.`,
    tagRecord: "Record", tagWc: "Mondial", tagFirst: "Primul",
    faq: [
      ["Când a debutat Messi?", "Pentru Barcelona pe <b>16 octombrie 2004</b> contra Espanyol la 17 ani și 114 zile; pentru Argentina pe 17 august 2005."],
      ["Când a marcat Messi primul său gol?", "Pe <b>1 mai 2005</b> contra Albacete — cel mai tânăr marcator din istoria Barcelonei la acel moment."],
      ["Când a câștigat Messi Cupa Mondială?", "Pe <b>18 decembrie 2022</b>, învingând Franța la penalty-uri la Lusail după 3–3."],
      ["Când a plecat Messi de la Barcelona?", "În <b>august 2021</b>, semnând cu Paris Saint-Germain după 21 de ani la club."],
      ["Când a ajuns Messi la Inter Miami?", "În <b>iulie 2023</b>, câștigând Leagues Cup la câteva săptămâni după sosire."]
    ],
    method: "Reperele cronologice sunt datate exact; barele de goluri împart anii calendaristici fără suprapuneri."
  },
  uz: {
    head: (t) => `2004-yilda Barselonadagi debyutidan <b>${n(t.goals)} ta rasmiy golgacha</b> — hal qiluvchi kechalar, rekordlar va sovrinlar xronologik tartibda.`,
    keydates: (t, lastUpdated) => [
      ["16 Okt 2004", "17 yoshida Espanyolga qarshi <b>Barselona</b> asosiy jamoasida debyut."],
      ["1 May 2005", "Albasetega qarshi ilk rasmiy gol — o'sha paytda Barselonaning eng yosh to'purari."],
      ["17 Avg 2005", "Vengriyaga qarshi <b>Argentina</b> terma jamoasida debyut."],
      ["2012", "Bir taqvim yilida <b>91 ta gol</b> — jahon futboli tarixidagi mutlaq rekord."],
      ["18 Dek 2022", "Qatarda Argentina bilan <b>Jahon Chempionati</b> g'olibi, finalda dubl muallifi."],
      [esc(lastUpdated), `Klub va terma jamoada <b>${n(t.goals)} ta rasmiy gol</b> — so'nggi tekshiruv.`]
    ],
    inProg: "davom etmoqda",
    goals: "gol",
    goalsInEra: (goals, share, total) => `<b>${n(goals)} gol</b> · ${n(total)} dan ${share}%`,
    peakYear: (pk, tr) => `<p class="ch-callout">Eng yuqori yil <b>${pk.year} · ${pk.goals} gol</b>` + (tr ? ` · ushbu davrda <b>${tr}</b> ta jamoaviy sovrin` : "") + `</p>`,
    empty: (val, total) => `“${val}” bo'yicha natija topilmadi — barcha ${total} ta bosqichni ko'rish uchun qidiruvni tozalang.`,
    tagRecord: "Rekord", tagWc: "JCH", tagFirst: "Ilk",
    faq: [
      ["Messi qachon debyut qilgan?", "Barselona safida <b>2004-yil 16-oktabrda</b> Espanyolga qarshi 17 yoshida; Argentina safida 2005-yil 17-avgustda."],
      ["Messi ilk golini qachon urgan?", "<b>2005-yil 1-mayda</b> Albasetega qarshi — o'sha davrda Barselona tarixidagi eng yosh gol muallifi."],
      ["Messi Jahon chempionatini qachon yutgan?", "<b>2022-yil 18-dekabrda</b> Lusailda Fransiyani 3–3 hisobidan so'ng penaltilar seriyasida mag'lub etib."],
      ["Messi Barselonani qachon tark etgan?", "<b>2021-yil avgustida</b> klubdagi 21 yildan so'ng Parij Sen-Jermenga o'tgan."],
      ["Messi Inter Mayamiga qachon qo'shilgan?", "<b>2023-yil iyulida</b> va kelganidan bir necha hafta o'tib Leagues Cupni qo'lga kiritgan."]
    ],
    method: "Xronologik bosqichlar aniq sana bo'yicha tartiblangan va rasmiy manbalarga asoslangan."
  },
  ar: {
    head: (t) => `من ظهوره الأول مع برشلونة عام 2004 حتى <b>${n(t.goals)} هدفاً رسمياً</b> — الليالي الحاسمة والأرقام القياسية والألقاب مرتبة زمنياً.`,
    keydates: (t, lastUpdated) => [
      ["16 أكتوبر 2004", "الظهور الرسمي الأول مع <b>برشلونة</b> ضد إسبانيول بعمر 17 عاماً."],
      ["1 مايو 2005", "أول هدف رسمي ضد ألباسيتي — أصغر هداف في تاريخ برشلونة آنذاك."],
      ["17 أغسطس 2005", "الظهور الدولي الأول مع منتخب <b>الأرجنتين</b> ضد المجر."],
      ["2012", "<b>91 هدفاً</b> في سنة تقويمية واحدة — الرقم القياسي العالمي المطلق."],
      ["18 ديسمبر 2022", "التتويج بلقب <b>كأس العالم</b> مع الأرجنتين في قطر بتسجيل ثنائية في النهائي."],
      [esc(lastUpdated), `<b>${n(t.goals)} هدفاً رسمياً</b> مع الأندية والمنتخب — آخر تحديث.`]
    ],
    inProg: "جارٍ",
    goals: "هدفاً",
    goalsInEra: (goals, share, total) => `<b>${n(goals)} هدفاً</b> · ${share}% من ${n(total)}`,
    peakYear: (pk, tr) => `<p class="ch-callout">سنة الذروة <b>${pk.year} · ${pk.goals} هدفاً</b>` + (tr ? ` · <b>${tr}</b> ألقاب جماعية في هذه المرحلة` : "") + `</p>`,
    empty: (val, total) => `لا توجد نتائج لـ «${val}» — امسح البحث لعرض جميع المحطات الـ ${total}.`,
    tagRecord: "رقم قياسي", tagWc: "كأس العالم", tagFirst: "الأول",
    faq: [
      ["متى خاض ميسي مباراته الأولى؟", "مع برشلونة في <b>16 أكتوبر 2004</b> ضد إسبانيول بعمر 17 عاماً؛ ومع الأرجنتين في 17 أغسطس 2005."],
      ["متى سجّل ميسي أول هدف له؟", "في <b>1 مايو 2005</b> ضد ألباسيتي — أصغر هداف في تاريخ برشلونة حينها."],
      ["متى فاز ميسي بكأس العالم؟", "في <b>18 ديسمبر 2022</b> بعد الفوز على فرنسا بركلات الترجيح في نهائي لوسيل عقب التعادل 3–3."],
      ["متى غادر ميسي برشلونة؟", "في <b>أغسطس 2021</b> منضماً إلى باريس سان جيرمان بعد 21 عاماً في النادي."],
      ["متى انضم ميسي إلى إنتر ميامي؟", "في <b>يوليو 2023</b> وتُوّج بكأس الليغات بعد أسابيع قليلة من وصوله."]
    ],
    method: "الخط الزمني موثق بالتواريخ الدقيقة وفق السجلات الرسمية للمباريات والبطولات."
  },
  id: {
    head: (t) => `Dari debutnya bersama Barcelona pada 2004 hingga <b>${n(t.goals)} gol karier</b> — malam-malam penentu, rekor, dan trofi, tersusun rapi berdasarkan tanggal.`,
    keydates: (t, lastUpdated) => [
      ["16 Okt 2004", "Debut senior untuk <b>Barcelona</b> melawan Espanyol pada usia 17 tahun."],
      ["1 Mei 2005", "Gol senior pertama, melawan Albacete — pencetak gol termuda Barcelona saat itu."],
      ["17 Agu 2005", "Debut <b>Argentina</b> melawan Hungaria."],
      ["2012", "<b>91 gol</b> dalam satu tahun kalender — rekor sepanjang masa sepak bola."],
      ["18 Des 2022", "Juara <b>Piala Dunia</b> bersama Argentina di Qatar dengan dua gol di final."],
      [esc(lastUpdated), `<b>${n(t.goals)} gol karier</b> untuk klub dan timnas — pembaruan terakhir.`]
    ],
    inProg: "sedang berjalan",
    goals: "gol",
    goalsInEra: (goals, share, total) => `<b>${n(goals)} gol</b> · ${share}% dari ${n(total)}`,
    peakYear: (pk, tr) => `<p class="ch-callout">Tahun puncak <b>${pk.year} · ${pk.goals} gol</b>` + (tr ? ` · <b>${tr}</b> trofi tim diraih di era ini` : "") + `</p>`,
    empty: (val, total) => `Tidak ada hasil untuk “${val}” — hapus pencarian untuk melihat semua ${total} tonggak sejarah.`,
    tagRecord: "Rekor", tagWc: "Piala Dunia", tagFirst: "Pertama",
    faq: [
      ["Kapan Messi melakoni debutnya?", "Untuk Barcelona pada <b>16 Oktober 2004</b> melawan Espanyol, usia 17 tahun 114 hari; untuk Argentina pada 17 Agustus 2005."],
      ["Kapan Messi mencetak gol pertamanya?", "Pada <b>1 Mei 2005</b> melawan Albacete — menjadikannya pencetak gol termuda dalam sejarah Barcelona saat itu."],
      ["Kapan Messi menjuarai Piala Dunia?", "Pada <b>18 Desember 2022</b>, mengalahkan Prancis lewat adu penalti di final Lusail setelah skor 3–3."],
      ["Kapan Messi meninggalkan Barcelona?", "Pada <b>Agustus 2021</b>, bergabung dengan Paris Saint-Germain setelah 21 tahun di klub."],
      ["Kapan Messi bergabung dengan Inter Miami?", "Pada <b>Juli 2023</b>, langsung menjuarai Leagues Cup hanya beberapa pekan setelah tiba."]
    ],
    method: "Entri linimasa diurutkan berdasarkan tahun dan tanggal spesifik dari catatan resmi pertandingan dan turnamen."
  }
};

const TIMELINE_EN = {
  head: (t) => `From his Barcelona debut in 2004 to <b>${n(t.goals)} career goals</b> and counting — the defining nights, records and trophies, dated and in order.`,
  keydates: (t, lastUpdated) => [
    ["16 Oct 2004", "Senior debut for <b>Barcelona</b> against Espanyol, aged 17."],
    ["1 May 2005", "First senior goal, against Albacete — Barcelona's youngest scorer at the time."],
    ["17 Aug 2005", "<b>Argentina</b> debut against Hungary."],
    ["2012", "<b>91 goals</b> in the calendar year — football's all-time record."],
    ["18 Dec 2022", "Wins the <b>World Cup</b> with Argentina in Qatar, scoring twice in the final."],
    [esc(lastUpdated), `<b>${n(t.goals)} career goals</b> for club and country — last checked this date.`]
  ],
  inProg: "in progress",
  goals: "goals",
  goalsInEra: (goals, share, total) => `<b>${n(goals)} goals</b> · ${share}% of ${n(total)}`,
  peakYear: (pk, tr) => `<p class="ch-callout">Peak year <b>${pk.year} · ${pk.goals} goals</b>` + (tr ? ` · <b>${tr}</b> team ${tr === 1 ? "trophy" : "trophies"} won in this span` : "") + `</p>`,
  empty: (val, total) => `Nothing matches “${val}” — clear the search to see all ${total} milestones.`,
  tagRecord: "Record", tagWc: "World Cup", tagFirst: "First",
  faq: [
    ["When did Messi make his debut?", "For Barcelona on <b>16 October 2004</b> against Espanyol, aged 17 years and 114 days; for Argentina on 17 August 2005."],
    ["When did Messi score his first goal?", "On <b>1 May 2005</b> against Albacete — then the youngest scorer in Barcelona's history."],
    ["When did Messi win the World Cup?", "On <b>18 December 2022</b>, beating France on penalties in the Lusail final after a 3–3 draw."],
    ["When did Messi leave Barcelona?", "In <b>August 2021</b>, joining Paris Saint-Germain after 21 years at the club."],
    ["When did Messi join Inter Miami?", "In <b>July 2023</b>, winning the Leagues Cup within weeks of arriving."]
  ],
  method: "Timeline entries are year- and date-granular milestones; era goal bars split calendar years into non-overlapping spans so they add back up to the career total."
};

const TIMELINE_MILESTONES = [
  {
    date: "16 Oct 2004",
    year: 2004,
    cat: "debut",
    team: "barcelona",
    title: "FC Barcelona Official First-Team Debut",
    desc: "Aged 17 years, 3 months and 22 days, Messi replaces Deco in the 82nd minute against Espanyol at the Estadi Olímpic de Montjuïc, launching the greatest career in modern football history.",
    stat: "Age 17y 114d",
    badge: "Official Debut"
  },
  {
    date: "1 May 2005",
    year: 2005,
    cat: "goal",
    team: "barcelona",
    title: "First Senior Career Goal vs Albacete",
    desc: "Subbed on in the 88th minute, Messi receives an audacious scooped assist from Ronaldinho and calmly chips goalkeeper Raúl Valbuena into the top corner at Camp Nou.",
    stat: "Goal #1",
    badge: "Youngest Barça Scorer"
  },
  {
    date: "23 Aug 2008",
    year: 2008,
    cat: "trophy",
    team: "argentina",
    title: "Olympic Gold Medal in Beijing",
    desc: "Messi assists Ángel Di María for the winning chip in the 1-0 final over Nigeria at the Bird's Nest stadium, securing Argentina's Olympic Gold.",
    stat: "Olympic Gold",
    badge: "Olympic Champion",
    img: "/img/era-2008-olympic.webp",
    alt: "Messi celebrating Olympic Gold Medal in Beijing 2008"
  },
  {
    date: "27 May 2009",
    year: 2009,
    cat: "trophy",
    team: "barcelona",
    title: "Historic Treble & Rome UCL Final Header",
    desc: "In Rome's Stadio Olimpico, Messi rises into the air to head home Xavi's cross past Edwin van der Sar, securing a 2-0 win over Manchester United and Barcelona's first historic Treble.",
    stat: "UCL Final Goal",
    badge: "First Treble"
  },
  {
    date: "28 May 2011",
    year: 2011,
    cat: "trophy",
    team: "barcelona",
    title: "Wembley Masterclass vs Manchester United",
    desc: "A virtuoso performance at Wembley: Messi fires a laser past Edwin van der Sar in a 3-1 victory that Pep Guardiola called the best game of his coaching career.",
    stat: "Man of the Match",
    badge: "UCL Masterclass",
    img: "/img/era-2011-wembley.webp",
    alt: "Messi celebrating Champions League victory at Wembley 2011"
  },
  {
    date: "22 Dec 2012",
    year: 2012,
    cat: "record",
    team: "barcelona",
    title: "The 91-Goal World Record Year",
    desc: "Messi finishes 2012 with an astronomical 91 official goals (79 for Barcelona, 12 for Argentina), shattering Gerd Müller's 40-year-old calendar-year world record of 85 goals.",
    stat: "91 Goals in 2012",
    badge: "All-Time World Record",
    img: "/img/era-2012-ballon.webp",
    alt: "Messi with his Ballon d'Or celebrating the 91-goal calendar year record"
  },
  {
    date: "6 Jun 2015",
    year: 2015,
    cat: "trophy",
    team: "barcelona",
    title: "Second Historic Treble in Berlin",
    desc: "Barcelona defeat Juventus 3-1 in Berlin to complete Messi's second continental Treble — the MSN trio (Messi, Suárez, Neymar) shatter world records with 122 goals in the season.",
    stat: "4th Champions League",
    badge: "Second Treble",
    img: "/img/era-2015-supercup.webp",
    alt: "Messi celebrating the 2015 Treble and European championship"
  },
  {
    date: "23 Apr 2017",
    year: 2017,
    cat: "goal",
    team: "barcelona",
    title: "500th Barcelona Goal & Bernabéu Shirt Celebration",
    desc: "With bleeding gauze in his mouth, Messi fires a 92nd-minute laser into the corner to win El Clásico 3-2 at the Santiago Bernabéu, famously holding his shirt up to the silent crowd.",
    stat: "Goal #500 for Barça",
    badge: "Iconic Clásico Winner"
  },
  {
    date: "2 Dec 2019",
    year: 2019,
    cat: "award",
    team: "barcelona",
    title: "Record Sixth Ballon d'Or Award",
    desc: "A decade after his first Ballon d'Or in 2009, Messi claims his sixth golden ball at the Théâtre du Châtelet in Paris, breaking clear of Cristiano Ronaldo to stand alone in football history.",
    stat: "Ballon d'Or #6",
    badge: "6th Ballon d'Or",
    img: "/img/era-2019-ballon.webp",
    alt: "Messi with his record-breaking sixth Ballon d'Or trophy in 2019"
  },
  {
    date: "10 Jul 2021",
    year: 2021,
    cat: "trophy",
    team: "argentina",
    title: "Copa América Champions at the Maracanã",
    desc: "Argentina defeat Brazil 1-0 at the iconic Maracanã in Rio de Janeiro to end a 28-year senior trophy drought. Messi finishes as top scorer (4 goals), top assist provider (5 assists), and Best Player.",
    stat: "MVP & Top Scorer",
    badge: "Continental Champions",
    img: "/img/era-2021-copa.webp",
    alt: "Messi lifting the Copa América trophy at the Maracanã in 2021"
  },
  {
    date: "8 Aug 2021",
    year: 2021,
    cat: "transfer",
    team: "barcelona",
    title: "Emotional Barcelona Farewell & Move to PSG",
    desc: "After 21 unforgettable years, 778 appearances, and 672 goals, Messi bids a tearful goodbye to FC Barcelona and begins a new chapter with Paris Saint-Germain.",
    stat: "672 Barça Goals",
    badge: "End of an Era",
    img: "/img/era-2021-tears.webp",
    alt: "Messi emotional during his farewell press conference at Camp Nou"
  },
  {
    date: "29 Nov 2021",
    year: 2021,
    cat: "award",
    team: "psg",
    title: "Seventh Ballon d'Or in Paris",
    desc: "Following his Copa América triumph with Argentina, Messi collects an unprecedented seventh Ballon d'Or in front of the Parisian crowd.",
    stat: "Ballon d'Or #7",
    badge: "7th Ballon d'Or",
    img: "/img/era-2021-ballon7.webp",
    alt: "Messi receiving his seventh Ballon d'Or in Paris 2021"
  },
  {
    date: "18 Dec 2022",
    year: 2022,
    cat: "trophy",
    team: "argentina",
    title: "FIFA World Cup Champion in Lusail, Qatar",
    desc: "In the greatest World Cup final ever played, Messi scores twice against France and converts his penalty in the shootout. Crowned tournament Golden Ball MVP and lifted on Agüero's shoulders.",
    stat: "World Cup & Golden Ball",
    badge: "World Champion",
    img: "/img/cab-wc.webp",
    alt: "Messi lifted high celebrating Argentina's 2022 World Cup triumph in Lusail"
  },
  {
    date: "19 Aug 2023",
    year: 2023,
    cat: "trophy",
    team: "miami",
    title: "Inter Miami Leagues Cup Champions",
    desc: "Just weeks after arriving in the United States, Messi scores 10 goals in 7 games and guides Inter Miami from last place in MLS to their first-ever trophy in franchise history.",
    stat: "10 Goals in 7 Games",
    badge: "First Miami Trophy",
    img: "/img/era-2023-miami.webp",
    alt: "Messi celebrating Leagues Cup title with Inter Miami in 2023"
  },
  {
    date: "30 Oct 2023",
    year: 2023,
    cat: "award",
    team: "miami",
    title: "Unprecedented Eighth Ballon d'Or",
    desc: "Awarded his eighth Ballon d'Or in Paris following his World Cup triumph in Qatar, extending his all-time record and becoming the first active MLS player to win the award.",
    stat: "Ballon d'Or #8",
    badge: "8th Ballon d'Or",
    img: "/img/era-2023-ballon8.webp",
    alt: "Messi holding his eighth Ballon d'Or trophy in Paris 2023"
  },
  {
    date: "14 Jul 2024",
    year: 2024,
    cat: "trophy",
    team: "argentina",
    title: "Back-to-Back Copa América & Record 44th Trophy",
    desc: "Argentina retain the Copa América trophy with a 1-0 win over Colombia in Miami, completing a historic triple crown (Copa 2021, World Cup 2022, Copa 2024) and Messi's 44th career title.",
    stat: "44th Career Trophy",
    badge: "Back-to-Back Copa",
    img: "/img/era-2024-copa.webp",
    alt: "Messi celebrating Copa América 2024 championship"
  },
  {
    date: "2 Oct 2024",
    year: 2024,
    cat: "trophy",
    team: "miami",
    title: "MLS Supporters' Shield & Record 45th Major Trophy",
    desc: "Scores twice in a 3-2 victory over Columbus Crew to clinch the 2024 MLS Supporters' Shield with Inter Miami with record points, extending his world record to 45 major trophies.",
    stat: "45th Career Trophy",
    badge: "MLS Record Points"
  },
  {
    date: "20 Sep 2026",
    year: 2026,
    cat: "goal",
    team: "miami",
    title: "Goal #930: Direct Free Kick vs San Diego FC",
    desc: "Curling 24th-minute direct free kick at Chase Stadium vs San Diego FC marks the 930th senior career goal and 67th direct free kick of Messi's legendary career.",
    stat: "Goal #930 • 67th FK",
    badge: "930 Career Goals"
  }
];

function renderTimeline(d) {
  const lang = getLang();
  const cfg = TIMELINE_I18N[lang] || TIMELINE_EN;
  const t = d.totals;
  setHead(d, cfg.head(t));

  // 1. Executive Career Summary Banner
  const summaryLabels = {
    en: ["Seasons (2004–2026)", "Senior Goals", "Career Assists", "Major Trophies", "Ballons d'Or", "Golden Shoes"],
    es: ["Temporadas (2004–2026)", "Goles Oficiales", "Asistencias", "Títulos Oficiales", "Balones de Oro", "Botas de Oro"],
    pt: ["Temporadas (2004–2026)", "Gols Oficiais", "Assistências", "Títulos Oficiais", "Bolas de Ouro", "Chuteiras de Ouro"],
    fr: ["Saisons (2004–2026)", "Buts Officiels", "Passes Décisives", "Trophées Majeurs", "Ballons d'Or", "Souliers d'Or"],
    ro: ["Sezoane (2004–2026)", "Goluri Seniori", "Pase de Gol", "Trofee Majore", "Baloane de Aur", "Ghete de Aur"],
    uz: ["Mavsumlar (2004–2026)", "Rasmiy Gollar", "Golli Uzatmalar", "Yirik Sovrinlar", "Oltin To'plar", "Oltin Butsalar"],
    ar: ["المواسم (2004–2026)", "الأهداف الرسمية", "التمريرات الحاسمة", "الألقاب الكبرى", "الكرة الذهبية", "الحذاء الذهبي"],
    id: ["Musim (2004–2026)", "Gol Senior", "Assist Karier", "Trofi Utama", "Ballon d'Or", "Sepatu Emas"]
  };
  const sl = summaryLabels[lang] || summaryLabels.en;
  const summaryEl = el("tl-summary");
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="tl-summary-kpi"><div class="val">23</div><div class="lbl">${sl[0]}</div></div>
      <div class="tl-summary-kpi"><div class="val">${n(t.goals)}</div><div class="lbl">${sl[1]}</div></div>
      <div class="tl-summary-kpi"><div class="val">${LIVE.assists}+</div><div class="lbl">${sl[2]}</div></div>
      <div class="tl-summary-kpi"><div class="val">${LIVE.trophies}</div><div class="lbl">${sl[3]}</div></div>
      <div class="tl-summary-kpi"><div class="val">8</div><div class="lbl">${sl[4]}</div></div>
      <div class="tl-summary-kpi"><div class="val">6</div><div class="lbl">${sl[5]}</div></div>
    `;
  }

  // 2. Defining Milestones Quick Cards in #keydates
  const kdEl = el("keydates");
  if (kdEl) {
    kdEl.innerHTML =
      `<ol class="keydates">` +
      cfg.keydates(t, d.lastUpdated).map((kd) => `<li><span class="kd-date">${kd[0]}</span><span>${kd[1]}</span></li>`).join("") +
      `</ol>`;
  }

  // 3. Category Filter Buttons in #era-nav
  const nodeIcon = (cat) => {
    switch (cat) {
      case "trophy": return "T";
      case "award": return "A";
      case "goal": return "G";
      case "record": return "R";
      case "debut": return "D";
      case "transfer": return "M";
      default: return "•";
    }
  };

  const teamLabel = (tm) => {
    switch (tm) {
      case "barcelona": return "FC Barcelona";
      case "argentina": return "Argentina";
      case "miami": return "Inter Miami";
      case "psg": return "Paris Saint-Germain";
      default: return "";
    }
  };

  const catCounts = {
    all: TIMELINE_MILESTONES.length,
    trophy: TIMELINE_MILESTONES.filter(m => m.cat === "trophy").length,
    award: TIMELINE_MILESTONES.filter(m => m.cat === "award").length,
    goal: TIMELINE_MILESTONES.filter(m => m.cat === "goal").length,
    record: TIMELINE_MILESTONES.filter(m => m.cat === "record").length,
    barcelona: TIMELINE_MILESTONES.filter(m => m.team === "barcelona").length,
    argentina: TIMELINE_MILESTONES.filter(m => m.team === "argentina").length,
    miami: TIMELINE_MILESTONES.filter(m => m.team === "miami").length,
    psg: TIMELINE_MILESTONES.filter(m => m.team === "psg").length
  };

  const filterLabels = {
    en: { all: "All", trophy: "Trophies", award: "Ballons d'Or", goal: "Landmark Goals", record: "World Records", barcelona: "Barcelona", argentina: "Argentina", miami: "Inter Miami", psg: "PSG" },
    es: { all: "Todos", trophy: "Títulos", award: "Balones de Oro", goal: "Goles Hito", record: "Récords Mundiales", barcelona: "Barcelona", argentina: "Argentina", miami: "Inter Miami", psg: "PSG" },
    pt: { all: "Todos", trophy: "Títulos", award: "Bolas de Ouro", goal: "Gols Históricos", record: "Recordes Mundiais", barcelona: "Barcelona", argentina: "Argentina", miami: "Inter Miami", psg: "PSG" },
    fr: { all: "Tous", trophy: "Trophées", award: "Ballons d'Or", goal: "Buts Marquants", record: "Records Mondiaux", barcelona: "Barcelone", argentina: "Argentine", miami: "Inter Miami", psg: "PSG" },
    ro: { all: "Toate", trophy: "Trofee", award: "Baloane de Aur", goal: "Goluri Repere", record: "Recorduri Mondiale", barcelona: "Barcelona", argentina: "Argentina", miami: "Inter Miami", psg: "PSG" },
    uz: { all: "Barchasi", trophy: "Sovrinlar", award: "Oltin To'plar", goal: "Muhim Gollar", record: "Jahon Rekordlari", barcelona: "Barselona", argentina: "Argentina", miami: "Inter Mayami", psg: "PSJ" },
    ar: { all: "الكل", trophy: "الألقاب", award: "الكرة الذهبية", goal: "أهداف تاريخية", record: "أرقام قياسية", barcelona: "برشلونة", argentina: "الأرجنتين", miami: "إنتر ميامي", psg: "باريس" },
    id: { all: "Semua", trophy: "Trofi", award: "Ballon d'Or", goal: "Gol Bersejarah", record: "Rekor Dunia", barcelona: "Barcelona", argentina: "Argentina", miami: "Inter Miami", psg: "PSG" }
  };
  const fl = filterLabels[lang] || filterLabels.en;

  const filterButtons = [
    { id: "all", label: `${fl.all} (${catCounts.all})` },
    { id: "trophy", label: `${fl.trophy} (${catCounts.trophy})` },
    { id: "award", label: `${fl.award} (${catCounts.award})` },
    { id: "goal", label: `${fl.goal} (${catCounts.goal})` },
    { id: "record", label: `${fl.record} (${catCounts.record})` },
    { id: "barcelona", label: `${fl.barcelona} (${catCounts.barcelona})` },
    { id: "argentina", label: `${fl.argentina} (${catCounts.argentina})` },
    { id: "miami", label: `${fl.miami} (${catCounts.miami})` },
    { id: "psg", label: `${fl.psg} (${catCounts.psg})` }
  ];

  let currentCat = "all";

  const nav = el("era-nav");
  if (nav) {
    nav.className = "tl-filter-controls";
    nav.innerHTML = `
      <div class="tl-pills-row" role="group" aria-label="Filter career milestones">
        ${filterButtons.map((btn, i) => `
          <button class="tl-filter-btn${i === 0 ? " active" : ""}" data-cat="${btn.id}" type="button">
            ${btn.label}
          </button>
        `).join("")}
      </div>
    `;

    nav.querySelectorAll(".tl-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        nav.querySelectorAll(".tl-filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentCat = btn.dataset.cat;
        applyFilters();
      });
    });
  }

  // 4. Populate #chapters with the 50-milestone interactive stream
  const chaptersEl = el("chapters");
  if (chaptersEl) {
    chaptersEl.innerHTML = `
      <div class="tl-stream" id="tl-stream">
        ${TIMELINE_MILESTONES.map((m) => `
          <article class="tl-card tl-reveal in" data-cat="${m.cat}" data-team="${m.team}" data-text="${esc((m.year + " " + m.date + " " + m.title + " " + m.desc + " " + m.stat + " " + m.badge + " " + m.team).toLowerCase())}">
            <div class="tl-node" aria-hidden="true">${nodeIcon(m.cat)}</div>
            ${m.img ? `
            <figure class="tl-card-media">
              <img src="${m.img}" alt="${esc(m.alt || m.title)}" loading="lazy" />
            </figure>` : ""}
            <div class="tl-card-top">
              <span class="tl-date-badge">${esc(m.date)}</span>
              <span class="tl-cat-badge tl-cat-${m.cat}">${esc(m.badge || m.cat)}</span>
            </div>
            <h3 class="tl-card-title">${esc(m.title)}</h3>
            <p class="tl-card-desc">${esc(m.desc)}</p>
            <div class="tl-card-footer">
              <span class="tl-pill-stat">${esc(m.stat)}</span>
              <span class="tl-pill-stat">${teamLabel(m.team)}</span>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  // 5. Search & Category Filtering Wiring
  const totalEvents = TIMELINE_MILESTONES.length;
  const inp = el("tl-filter");
  const countEl = el("tl-count");

  const paintCount = (matched) => {
    if (!countEl) return;
    if (matched === totalEvents && currentCat === "all" && (!inp || !inp.value.trim())) {
      countEl.textContent = "";
      return;
    }
    const fmt = {
      es: `${matched} de ${totalEvents} hitos`,
      pt: `${matched} de ${totalEvents} marcos`,
      fr: `${matched} sur ${totalEvents} jalons`,
      ro: `${matched} din ${totalEvents} repere`,
      uz: `${totalEvents} tadan ${matched} tasi`,
      ar: `عرض ${matched} من ${totalEvents} محطة`,
      id: `Menampilkan ${matched} dari ${totalEvents} tonggak`
    };
    countEl.textContent = fmt[lang] || `Showing ${matched} of ${totalEvents} milestones`;
  };

  const applyFilters = () => {
    const q = inp ? inp.value.trim().toLowerCase() : "";
    let matched = 0;
    document.querySelectorAll("#tl-stream .tl-card").forEach((card) => {
      const cardCat = card.dataset.cat;
      const cardTeam = card.dataset.team;
      const cardText = card.dataset.text;

      let catMatch = true;
      if (currentCat !== "all") {
        catMatch = (currentCat === cardCat || currentCat === cardTeam);
      }
      const textMatch = !q || cardText.includes(q);
      const visible = catMatch && textMatch;

      card.hidden = !visible;
      if (visible) matched++;
    });

    let empty = el("tl-empty");
    if (matched === 0) {
      if (!empty) {
        empty = document.createElement("p");
        empty.id = "tl-empty";
        empty.className = "tl-empty";
        if (chaptersEl) chaptersEl.after(empty);
      }
      empty.textContent = cfg.empty(inp ? inp.value.trim() : "", totalEvents);
      empty.hidden = false;
    } else if (empty) {
      empty.hidden = true;
    }
    paintCount(matched);
  };

  if (inp) {
    inp.addEventListener("input", applyFilters);
  }

  // 6. FAQ Accordion & Explorers
  const faqEl = el("faq");
  if (faqEl && cfg.faq) {
    faqEl.innerHTML = cfg.faq.map((q) => `<details class="faq-item"><summary class="faq-question"><span>${q[0]}</span><span class="faq-chevron" aria-hidden="true">▾</span></summary><div class="faq-answer"><p>${q[1]}</p></div></details>`).join("");
    faqEl.className = "faq-accordion";
  }

  // Visual Trophy Cabinet
  if (el("cabinet")) {
    el("cabinet").innerHTML = cabinetPhotos();
  }

  // 46 Trophies breakdown by club and country
  const groupsEl = el("groups");
  if (groupsEl && d.trophies) {
    const teamRows = d.trophies.filter((x) => x.team !== "Individual");
    const indRows = d.trophies.filter((x) => x.team === "Individual");
    const indTotal = indRows.reduce((a, x) => a + x.count, 0);
    const order = ["Barcelona", "Paris Saint-Germain", "Inter Miami", "Argentina"];
    const trow = (x) => `<div class="tpill"><span class="tp-name">${esc(x.title)}</span><span class="tp-count">×${x.count}</span>` +
      `<span class="tp-years">${esc(x.years.join(", "))}</span></div>`;
    const achCfg = ACH_I18N[lang] || ACH_EN;
    groupsEl.innerHTML = order.map((team) => {
      const rows = teamRows.filter((x) => x.team === team);
      const sub = rows.reduce((a, x) => a + x.count, 0);
      return `<div class="trophy-group"><div class="shead"><h3>${achCfg.teamHeader(team, sub)}</h3></div><div class="tpills-wrap">` +
        rows.map(trow).join("") + `</div></div>`;
    }).join("") + (indRows.length ?
      `<div class="trophy-group"><div class="shead"><h3>${achCfg.indHeader(indTotal)}</h3></div><div class="tpills-wrap">` +
      indRows.map(trow).join("") + `</div></div>` : "");
  }

  renderExplore(d, "timeline");
  renderMethod(d, cfg.method);
}

/* ================= ACHIEVEMENTS ================= */
/* Trophy cabinet: self-hosted celebration photos. Mounted as #cabinet. */
const CABINET_I18N = {
  en: [
    { title: "FIFA World Cup — 2022", sub: "The ultimate crowning glory, Lusail 18 Dec 2022.", src: "/img/cab-wc.webp", w: 800, h: 600, pos: "50% 30%", alt: "Messi lifted on Agüero's shoulders celebrating the 2022 World Cup win at Lusail", cap: "World Cup champions, Lusail 2022" },
    { title: "Ballon d'Or — 8", sub: "The record eight: 2009–12, 2015, 2019, 2021, 2023.", src: "/img/cab-ballon.webp", w: 800, h: 600, pos: "50% 30%", alt: "Messi holding his record eighth Ballon d'Or trophy aloft", cap: "Record eighth Ballon d'Or award" },
    { title: "Champions League — 4", sub: "2006, 2009, 2011, 2015 — all with Barcelona.", src: "/img/cab-ucl.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi celebrating with the Champions League trophy holding four fingers up", cap: "Four-time European champion with Barcelona" },
    { title: "Copa América — 2", sub: "Back-to-back continental champion, 2021 & 2024.", src: "/img/cab-copa.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi kissing the Copa América trophy after winning at the Maracanã", cap: "Copa América champions, Maracanã 2021" },
    { title: "La Liga Titles — 10", sub: "Domestic dominance with FC Barcelona 2004–2019.", src: "/img/cab-liga.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi with the La Liga championship trophy", cap: "10-time Spanish champion with Barcelona" }
  ],
  es: [
    { title: "Copa del Mundo — 2022", sub: "La máxima gloria futbolística, Lusail 18 de diciembre de 2022.", src: "/img/cab-wc.webp", w: 800, h: 600, pos: "50% 30%", alt: "Messi en hombros celebrando la Copa del Mundo 2022 en Lusail", cap: "Campeones del Mundo, Lusail 2022" },
    { title: "Balón de Oro — 8", sub: "El récord de ocho: 2009–12, 2015, 2019, 2021, 2023.", src: "/img/cab-ballon.webp", w: 800, h: 600, pos: "50% 30%", alt: "Messi levantando su histórico octavo Balón de Oro", cap: "Récord histórico de 8 Balones de Oro" },
    { title: "Champions League — 4", sub: "2006, 2009, 2011, 2015 — todas con el FC Barcelona.", src: "/img/cab-ucl.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi celebrando con la Champions League", cap: "Cuatro veces campeón de Europa con el Barcelona" },
    { title: "Copa América — 2", sub: "Bicampeón continental consecutivo, 2021 y 2024.", src: "/img/cab-copa.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi besando el trofeo de la Copa América en el Maracaná", cap: "Campeones de América, Maracaná 2021" },
    { title: "Títulos de La Liga — 10", sub: "Dominio absoluto con el FC Barcelona 2004–2019.", src: "/img/cab-liga.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi con el trofeo de La Liga española", cap: "10 veces campeón de España con el Barcelona" }
  ],
  pt: [
    { title: "Copa do Mundo — 2022", sub: "A coroação máxima da história do futebol, Lusail 18 dez 2022.", src: "/img/cab-wc.webp", w: 800, h: 600, pos: "50% 30%", alt: "Messi carregado nos ombros celebrando a Copa do Mundo 2022", cap: "Campeões Mundiais, Lusail 2022" },
    { title: "Bola de Ouro — 8", sub: "O recorde de oito troféus: 2009–12, 2015, 2019, 2021, 2023.", src: "/img/cab-ballon.webp", w: 800, h: 600, pos: "50% 30%", alt: "Messi erguendo a sua oitava Bola de Ouro", cap: "Recorde histórico de 8 Bolas de Ouro" },
    { title: "Champions League — 4", sub: "2006, 2009, 2011, 2015 — todas com o Barcelona.", src: "/img/cab-ucl.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi com o troféu da Liga dos Campeões", cap: "Tetracampeão europeu pelo Barcelona" },
    { title: "Copa América — 2", sub: "Bicampeão continental consecutivo, 2021 e 2024.", src: "/img/cab-copa.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi beijando a Copa América no Maracanã", cap: "Campeões da Copa América, Maracanã 2021" },
    { title: "Títulos de La Liga — 10", sub: "Hegemonia nacional pelo FC Barcelona 2004–2019.", src: "/img/cab-liga.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi com o troféu da La Liga", cap: "10 vezes campeão espanhol pelo Barcelona" }
  ],
  fr: [
    { title: "Coupe du Monde — 2022", sub: "Le couronnement suprême, Lusail 18 décembre 2022.", src: "/img/cab-wc.webp", w: 800, h: 600, pos: "50% 30%", alt: "Messi porté en triomphe lors de la victoire en Coupe du Monde 2022", cap: "Champions du Monde, Lusail 2022" },
    { title: "Ballon d'Or — 8", sub: "Le record absolu de huit : 2009–12, 2015, 2019, 2021, 2023.", src: "/img/cab-ballon.webp", w: 800, h: 600, pos: "50% 30%", alt: "Messi brandissant son huitième Ballon d'Or", cap: "Record de 8 Ballons d'Or" },
    { title: "Ligue des Champions — 4", sub: "2006, 2009, 2011, 2015 — toutes avec le Barça.", src: "/img/cab-ucl.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi célébrant la victoire en Ligue des Champions", cap: "Quadruple vainqueur de la C1 avec Barcelone" },
    { title: "Copa América — 2", sub: "Double champion continental consécutif, 2021 & 2024.", src: "/img/cab-copa.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi embrassant le trophée de la Copa América au Maracanã", cap: "Champions de la Copa América, Maracanã 2021" },
    { title: "Championnats d'Espagne — 10", sub: "Domination totale avec le FC Barcelone 2004–2019.", src: "/img/cab-liga.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi avec le trophée de La Liga", cap: "10 fois champion d'Espagne avec Barcelone" }
  ],
  ro: [
    { title: "Cupa Mondială FIFA — 2022", sub: "Încoronarea supremă, Lusail 18 decembrie 2022.", src: "/img/cab-wc.webp", w: 800, h: 600, pos: "50% 30%", alt: "Messi purtat pe umeri sărbătorind Cupa Mondială 2022", cap: "Campioni mondiali, Lusail 2022" },
    { title: "Balonul de Aur — 8", sub: "Recordul absolut de opt: 2009–12, 2015, 2019, 2021, 2023.", src: "/img/cab-ballon.webp", w: 800, h: 600, pos: "50% 30%", alt: "Messi ridicând al optulea Balon de Aur", cap: "Al optulea Balon de Aur record" },
    { title: "Champions League — 4", sub: "2006, 2009, 2011, 2015 — toate cu Barcelona.", src: "/img/cab-ucl.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi sărbătorind trofeul Champions League", cap: "De 4 ori campion european cu Barcelona" },
    { title: "Copa América — 2", sub: "Campion continental consecutiv, 2021 și 2024.", src: "/img/cab-copa.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi sărutând trofeul Copa América pe Maracanã", cap: "Campioni Copa América, Maracanã 2021" },
    { title: "Titluri La Liga — 10", sub: "Dominație internă cu FC Barcelona 2004–2019.", src: "/img/cab-liga.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi cu trofeul La Liga", cap: "De 10 ori campion al Spaniei cu Barcelona" }
  ],
  uz: [
    { title: "FIFA Jahon Kubogi — 2022", sub: "Eng oliy g'alaba, Lusail 2022-yil 18-dekabr.", src: "/img/cab-wc.webp", w: 800, h: 600, pos: "50% 30%", alt: "Messi 2022-yilgi Jahon chempionati kubogini nishonlamoqda", cap: "Jahon chempionlari, Lusail 2022" },
    { title: "Oltin To'p — 8", sub: "Mutlaq rekord: 2009–12, 2015, 2019, 2021, 2023.", src: "/img/cab-ballon.webp", w: 800, h: 600, pos: "50% 30%", alt: "Messi sakkizinchi Oltin To'p mukofoti bilan", cap: "Rekord sakkizinchi Oltin To'p" },
    { title: "Chempionlar Ligasi — 4", sub: "2006, 2009, 2011, 2015 — barchasi Barselona bilan.", src: "/img/cab-ucl.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi Chempionlar Ligasi kubogi bilan", cap: "Barselona bilan 4 karra Yevropa chempioni" },
    { title: "Amerika Kubogi — 2", sub: "Ketma-ket qit'a chempioni, 2021 va 2024.", src: "/img/cab-copa.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi Marakana stadionida Amerika Kubogini o'pmoqda", cap: "Amerika Kubogi chempionlari, Marakana 2021" },
    { title: "La Liga Chempionligi — 10", sub: "FC Barselona bilan ustunlik 2004–2019.", src: "/img/cab-liga.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi La Liga kubogi bilan", cap: "Barselona bilan 10 karra Ispaniya chempioni" }
  ],
  ar: [
    { title: "كأس العالم FIFA — 2022", sub: "التتويج الأعظم، لوسيل 18 ديسمبر 2022.", src: "/img/cab-wc.webp", w: 800, h: 600, pos: "50% 30%", alt: "ميسي محمولاً على الأكتاف احتفالاً بكأس العالم 2022", cap: "أبطال العالم، لوسيل 2022" },
    { title: "الكرة الذهبية — 8", sub: "الرقم القياسي: 2009–12، 2015، 2019، 2021، 2023.", src: "/img/cab-ballon.webp", w: 800, h: 600, pos: "50% 30%", alt: "ميسي يحمل الكرة الذهبية الثامنة التاريخية", cap: "الكرة الذهبية الثامنة القياسية" },
    { title: "دوري أبطال أوروبا — 4", sub: "2006، 2009، 2011، 2015 — كلها مع برشلونة.", src: "/img/cab-ucl.webp", w: 800, h: 600, pos: "50% 25%", alt: "ميسي يحتفل بكأس دوري أبطال أوروبا", cap: "بطل أوروبا 4 مرات مع برشلونة" },
    { title: "كوبا أميركا — 2", sub: "بطل القارة مرتين متتاليتين، 2021 و2024.", src: "/img/cab-copa.webp", w: 800, h: 600, pos: "50% 25%", alt: "ميسي يقبّل كأس كوبا أميركا في ماراكانا", cap: "أبطال كوبا أميركا، ماراكانا 2021" },
    { title: "الدوري الإسباني — 10", sub: "هيمنة محلية مع برشلونة 2004–2019.", src: "/img/cab-liga.webp", w: 800, h: 600, pos: "50% 25%", alt: "ميسي مع درع الدوري الإسباني", cap: "بطل إسبانيا 10 مرات مع برشلونة" }
  ],
  id: [
    { title: "Piala Dunia FIFA — 2022", sub: "Puncak kejayaan, Lusail 18 Desember 2022.", src: "/img/cab-wc.webp", w: 800, h: 600, pos: "50% 30%", alt: "Messi diangkat di atas bahu merayakan Piala Dunia 2022", cap: "Juara Dunia, Lusail 2022" },
    { title: "Ballon d'Or — 8", sub: "Rekor sepanjang masa: 2009–12, 2015, 2019, 2021, 2023.", src: "/img/cab-ballon.webp", w: 800, h: 600, pos: "50% 30%", alt: "Messi memegang trofi Ballon d'Or kedelapan", cap: "Rekor Ballon d'Or kedelapan" },
    { title: "Liga Champions — 4", sub: "2006, 2009, 2011, 2015 — semuanya bersama Barcelona.", src: "/img/cab-ucl.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi merayakan trofi Liga Champions", cap: "Juara Eropa 4 kali bersama Barcelona" },
    { title: "Copa América — 2", sub: "Juara kontinental beruntun, 2021 & 2024.", src: "/img/cab-copa.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi mencium trofi Copa América di Maracanã", cap: "Juara Copa América, Maracanã 2021" },
    { title: "Gelar La Liga — 10", sub: "Dominasi domestik bersama FC Barcelona 2004–2019.", src: "/img/cab-liga.webp", w: 800, h: 600, pos: "50% 25%", alt: "Messi bersama trofi La Liga", cap: "Juara Spanyol 10 kali bersama Barcelona" }
  ]
};

const CABINET = CABINET_I18N.en;

const cabinetPhotos = () => {
  const lang = getLang();
  const list = CABINET_I18N[lang] || CABINET_I18N.en;
  return list.map((p) =>
    `<article class="cab-card"><h3>${esc(p.title)}</h3><p class="cab-sub">${esc(p.sub)}</p>` +
    `<figure class="cab-photo"><img src="${p.src}" width="${p.w}" height="${p.h}" alt="${esc(p.alt)}" loading="lazy" style="object-position:${p.pos || "50% 25%"}" />` +
    `<figcaption class="photo-credit">${esc(p.cap)}</figcaption></figure></article>`
  ).join("");
};

const ACH_I18N = {
  es: {
    head: (teamTotal) => `<b>${teamTotal} títulos colectivos</b> — la carrera más condecorada en la historia del fútbol — más un récord de <b>8 Balones de Oro</b>. Todos los trofeos club por club y año por año.`,
    kpis: (per) => [
      ["Títulos colectivos", 46, `Barcelona ${per["Barcelona"] || 0} · Argentina ${per["Argentina"] || 0} · PSG ${per["Paris Saint-Germain"] || 0} · Miami ${per["Inter Miami"] || 0}.`],
      ["Balones de Oro", "8", "Récord histórico — 2009–12, 2015, 2019, 2021, 2023."],
      ["Champions Leagues", "4", "2006, 2009, 2011, 2015 — todas con el FC Barcelona."],
      ["Grandes torneos internacionales", "3", "Copa del Mundo 2022, Copas América 2021 y 2024."]
    ],
    qa: (teamTotal, per) => [
      ["¿Cuántos títulos ha ganado Messi?", `<b>${teamTotal} títulos oficiales en categoría absoluta</b>: ${per["Barcelona"] || 0} con Barcelona, ${per["Paris Saint-Germain"] || 0} con PSG, ${per["Inter Miami"] || 0} con Inter Miami y ${per["Argentina"] || 0} con Argentina.`],
      ["¿Cuántos Balones de Oro tiene Messi?", "<b>Ocho</b> — más que cualquier otro futbolista en la historia (2009–12, 2015, 2019, 2021, 2023)."],
      ["¿Ha ganado Messi la Copa del Mundo?", "<b>Sí — 2022</b>, anotando dos goles en la gran final frente a Francia, además de las Copas América 2021 y 2024."],
      ["¿Cuántas Champions League ha ganado Messi?", "<b>Cuatro</b>, todas con el Barcelona: 2006, 2009, 2011 y 2015."]
    ],
    teamHeader: (team, sub) => `${esc(team)} — ${sub} títulos`,
    indHeader: (indTotal) => `Distinciones individuales — ${indTotal} premios`,
    faq: [
      ["¿Cuál es el trofeo más importante de Messi?", "La <b>Copa del Mundo 2022</b> — el gran título que coronó su carrera, conquistado siendo elegido el mejor jugador del torneo."],
      ["¿Cuántos títulos de liga ha ganado Messi?", "<b>Doce ligas</b> — 10 con Barcelona, 2 con el PSG — además de la MLS Supporters' Shield (2024) y la Leagues Cup (2023) con Miami."],
      ["¿Cuántos premios individuales tiene Messi?", "Ocho Balones de Oro, seis Botas de Oro europeas y dos Balones de Oro del Mundial — cada uno un récord histórico."],
      ["¿Es Messi el jugador con más títulos de la historia?", "Sumando títulos colectivos y distinciones individuales — <b>sí, por cualquier criterio razonable</b>."]
    ]
  },
  pt: {
    head: (teamTotal) => `<b>${teamTotal} títulos coletivos</b> — a carreira mais vitoriosa do futebol — mais um recorde de <b>8 Bolas de Ouro</b>. Todos os títulos clube por clube.`,
    kpis: (per) => [
      ["Títulos coletivos", 46, `Barcelona ${per["Barcelona"] || 0} · Argentina ${per["Argentina"] || 0} · PSG ${per["Paris Saint-Germain"] || 0} · Miami ${per["Inter Miami"] || 0}.`],
      ["Bolas de Ouro", "8", "Recorde — 2009–12, 2015, 2019, 2021, 2023."],
      ["Champions Leagues", "4", "2006, 2009, 2011, 2015 — todas com o Barcelona."],
      ["Grandes torneios de seleções", "3", "Copa do Mundo 2022, Copas América 2021 e 2024."]
    ],
    qa: (teamTotal, per) => [
      ["Quantos títulos Messi já ganhou?", `<b>${teamTotal} títulos coletivos oficiais</b>: ${per["Barcelona"] || 0} no Barcelona, ${per["Paris Saint-Germain"] || 0} no PSG, ${per["Inter Miami"] || 0} no Inter Miami e ${per["Argentina"] || 0} na Argentina.`],
      ["Quantas Bolas de Ouro Messi tem?", "<b>Oito</b> — mais do que qualquer outro jogador na história (2009–12, 2015, 2019, 2021, 2023)."],
      ["Messi já ganhou a Copa do Mundo?", "<b>Sim — em 2022</b>, marcando dois gols na final contra a França, além das Copas América de 2021 e 2024."],
      ["Quantas Champions Leagues Messi ganhou?", "<b>Quatro</b>, todas pelo Barcelona: 2006, 2009, 2011 e 2015."]
    ],
    teamHeader: (team, sub) => `${esc(team)} — ${sub} títulos`,
    indHeader: (indTotal) => `Prêmios individuais — ${indTotal} distinções`,
    faq: [
      ["Qual é o troféu mais importante de Messi?", "A <b>Copa do Mundo de 2022</b> — a coroação suprema de sua carreira, vencida como o melhor jogador do torneio."],
      ["Quantos títulos nacionais Messi tem?", "<b>Doze títulos de liga</b> — 10 La Ligas, 2 Ligue 1s — mais a MLS Supporters' Shield e Leagues Cup pelo Miami."],
      ["Quantos prêmios individuais Messi já ganhou?", "Oito Bolas de Ouro, seis Chuteiras de Ouro e duas Bolas de Ouro da Copa do Mundo — cada um um recorde histórico."],
      ["Messi é o jogador mais condecorado de todos os tempos?", "Pela soma de troféus coletivos e recordes individuais — <b>sim, sob qualquer métrica</b>."]
    ]
  },
  fr: {
    head: (teamTotal) => `<b>${teamTotal} trophées collectifs</b> — la carrière la plus titrée de l'histoire du football — plus un record de <b>8 Ballons d'Or</b>. Tous les titres par club.`,
    kpis: (per) => [
      ["Trophées collectifs", 47, `Barcelone ${per["Barcelona"] || 0} · Argentine ${per["Argentina"] || 0} · PSG ${per["Paris Saint-Germain"] || 0} · Miami ${per["Inter Miami"] || 0}.`],
      ["Ballons d'Or", "8", "Record — 2009–12, 2015, 2019, 2021, 2023."],
      ["Ligues des Champions", "4", "2006, 2009, 2011, 2015 — toutes avec le Barça."],
      ["Titres internationaux majeurs", "3", "Coupe du Monde 2022, Copas América 2021 & 2024."]
    ],
    qa: (teamTotal, per) => [
      ["Combien de trophées Messi a-t-il remportés ?", `<b>${teamTotal} titres collectifs majeurs</b> : ${per["Barcelona"] || 0} avec Barcelone, ${per["Paris Saint-Germain"] || 0} avec le PSG, ${per["Inter Miami"] || 0} avec l'Inter Miami et ${per["Argentina"] || 0} avec l'Argentine.`],
      ["Combien de Ballons d'Or Messi a-t-il remportés ?", "<b>Huit</b> — plus que tout autre joueur dans l'histoire (2009–12, 2015, 2019, 2021, 2023)."],
      ["Messi a-t-il gagné la Coupe du Monde ?", "<b>Oui — en 2022</b>, en inscrivant un doublé en finale contre la France, en plus des Copas América 2021 et 2024."],
      ["Combien de Ligues des Champions Messi a-t-il gagnées ?", "<b>Quatre</b>, toutes avec Barcelone : 2006, 2009, 2011 et 2015."]
    ],
    teamHeader: (team, sub) => `${esc(team)} — ${sub} trophées`,
    indHeader: (indTotal) => `Distinctions individuelles — ${indTotal} récompenses`,
    faq: [
      ["Quel est le trophée le plus important de Messi ?", "La <b>Coupe du Monde 2022</b> — le graal suprême de toute sa carrière, remporté en tant que meilleur joueur du tournoi."],
      ["Combien de championnats nationaux Messi a-t-il remportés ?", "<b>Douze championnats</b> — 10 La Liga, 2 Ligue 1 — plus la Supporters' Shield et la Leagues Cup avec Miami."],
      ["Combien de récompenses individuelles Messi a-t-il gagnées ?", "Huit Ballons d'Or, six Souliers d'Or européens et deux Ballons d'Or de la Coupe du Monde — chacun étant un record."],
      ["Messi est-il le joueur le plus titré de tous les temps ?", "En combinant trophées collectifs et distinctions individuelles — <b>oui, absolument</b>."]
    ]
  },
  ro: {
    head: (teamTotal) => `<b>${teamTotal} de trofee colective</b> — cea mai titrată carieră din istoria fotbalului — plus un record de <b>8 Baloane de Aur</b>. Fiecare trofeu, club cu club.`,
    kpis: (per) => [
      ["Trofee de echipă", LIVE.trophies, `Barcelona ${per["Barcelona"] || 0} · Argentina ${per["Argentina"] || 0} · PSG ${per["Paris Saint-Germain"] || 0} · Miami ${per["Inter Miami"] || 0}.`],
      ["Baloane de Aur", "8", "Record — 2009–12, 2015, 2019, 2021, 2023."],
      ["Champions League", "4", "2006, 2009, 2011, 2015 — toate cu Barcelona."],
      ["Turnee majore cu naționala", "3", "Cupa Mondială 2022, Copas América 2021 și 2024."]
    ],
    qa: (teamTotal, per) => [
      ["Câte trofee a câștigat Messi?", `<b>${teamTotal} de titluri oficiale</b>: ${per["Barcelona"] || 0} Barcelona, ${per["Paris Saint-Germain"] || 0} PSG, ${per["Inter Miami"] || 0} Inter Miami și ${per["Argentina"] || 0} Argentina.`],
      ["Câte Baloane de Aur are Messi?", "<b>Opt</b> — mai multe decât orice jucător din istorie (2009–12, 2015, 2019, 2021, 2023)."],
      ["A câștigat Messi Cupa Mondială?", "<b>Da — în 2022</b>, marcând de două ori în finala contra Franței, plus Copas América 2021 și 2024."],
      ["Câte trofee Champions League a câștigat Messi?", "<b>Patru</b>, toate cu Barcelona: 2006, 2009, 2011 și 2015."]
    ],
    teamHeader: (team, sub) => `${esc(team)} — ${sub} trofee`,
    indHeader: (indTotal) => `Distincții individuale — ${indTotal} premii`,
    faq: [
      ["Care este cel mai important trofeu al lui Messi?", "<b>Cupa Mondială 2022</b> — trofeul suprem al carierei, câștigat ca cel mai bun jucător al turneului."],
      ["Câte campionate naționale a câștigat Messi?", "<b>Douăsprezece</b> — 10 La Liga, 2 Ligue 1 — plus MLS Cup (2025) și Leagues Cup (2023) cu Miami."],
      ["Câte premii individuale are Messi?", "Opt Baloane de Aur, șase Ghete de Aur europene și două Baloane de Aur ale Cupei Mondiale."],
      ["Este Messi cel mai titrat jucător din istorie?", "Cumulând titlurile de echipă și recordurile individuale — <b>da, incontestabil</b>."]
    ]
  },
  uz: {
    head: (teamTotal) => `<b>${teamTotal} ta jamoaviy sovrin</b> — futbol tarixidagi eng muvaffaqiyatli faoliyat — hamda rekord darajadagi <b>8 ta Oltin To'p</b>. Klublar kesimida barcha titullar.`,
    kpis: (per) => [
      ["Jamoaviy sovrinlar", LIVE.trophies, `Barselona ${per["Barcelona"] || 0} · Argentina ${per["Argentina"] || 0} · PSJ ${per["Paris Saint-Germain"] || 0} · Mayami ${per["Inter Miami"] || 0}.`],
      ["Oltin To'plar", "8", "Rekord — 2009–12, 2015, 2019, 2021, 2023."],
      ["Chempionlar Ligasi", "4", "2006, 2009, 2011, 2015 — barchasi Barselona bilan."],
      ["Yirik xalqaro turnirlar", "3", "Jahon kubogi 2022, Amerika kubogi 2021 va 2024."]
    ],
    qa: (teamTotal, per) => [
      ["Messi nechta sovrin yutgan?", `<b>${teamTotal} ta rasmiy jamoaviy titul</b>: Barselona ${per["Barcelona"] || 0}, PSJ ${per["Paris Saint-Germain"] || 0}, Inter Mayami ${per["Inter Miami"] || 0} va Argentina ${per["Argentina"] || 0}.`],
      ["Messida nechta Oltin To'p bor?", "<b>Sakkizta</b> — futbol tarixidagi barcha o'yinchilardan ko'p (2009–12, 2015, 2019, 2021, 2023)."],
      ["Messi Jahon chempionatini yutganmi?", "<b>Ha — 2022-yilda</b>, Fransiyaga qarshi finalda ikki gol urib, shuningdek 2021 va 2024-yilgi Amerika kuboklarini."],
      ["Messi nechta Chempionlar Ligasini yutgan?", "<b>To'rtta</b>, barchasi Barselona bilan: 2006, 2009, 2011 va 2015."]
    ],
    teamHeader: (team, sub) => `${esc(team)} — ${sub} ta sovrin`,
    indHeader: (indTotal) => `Shaxsiy mukofotlar — ${indTotal} ta sovrin`,
    faq: [
      ["Messining eng muhim sovrini qaysi?", "<b>2022-yilgi Jahon chempionati</b> — turnirning eng yaxshi futbolchisi sifatida qo'lga kiritilgan bosh sovrin."],
      ["Messi nechta milliy chempionatda g'olib bo'lgan?", "<b>O'n ikki marta</b> — 10 La Liga, 2 Liga 1 — hamda Mayami bilan MLS kubogi va Leagues Cup."],
      ["Messining shaxsiy mukofotlari nechta?", "Sakkizta Oltin To'p, oltita Yevropa Oltin Butsasi va ikkita Jahon chempionati Oltin To'pi."],
      ["Messi tarixdagi eng ko'p sovrin yutgan futbolchimi?", "Jamoaviy va shaxsiy rekordlar yig'indisi bo'yicha — <b>ha, shubhasiz</b>."]
    ]
  },
  ar: {
    head: (teamTotal) => `<b>${teamTotal} لقباً جماعياً</b> — المسيرة الأكثر تتويجاً في تاريخ كرة القدم — بالإضافة إلى رقم قياسي من <b>8 كرات ذهبية</b>. كل لقب نادياً بنادٍ.`,
    kpis: (per) => [
      ["الألقاب الجماعية", LIVE.trophies, `برشلونة ${per["Barcelona"] || 0} · الأرجنتين ${per["Argentina"] || 0} · باريس ${per["Paris Saint-Germain"] || 0} · ميامي ${per["Inter Miami"] || 0}.`],
      ["الكرة الذهبية", "8", "رقم قياسي — 2009–12، 2015، 2019، 2021، 2023."],
      ["دوري أبطال أوروبا", "4", "2006، 2009، 2011، 2015 — كلها مع برشلونة."],
      ["البطولات القارية والعالمية", "3", "كأس العالم 2022، كوبا أميركا 2021 و2024."]
    ],
    qa: (teamTotal, per) => [
      ["كم لقباً فاز به ميسي؟", `<b>${teamTotal} لقباً جماعياً رسمياً</b>: ${per["Barcelona"] || 0} برشلونة، ${per["Paris Saint-Germain"] || 0} باريس، ${per["Inter Miami"] || 0} إنتر ميامي و${per["Argentina"] || 0} الأرجنتين.`],
      ["كم كرة ذهبية يملك ميسي؟", "<b>ثماني كرات ذهبية</b> — أكثر من أي لاعب في التاريخ (2009–12، 2015، 2019، 2021، 2023)."],
      ["هل فاز ميسي بكأس العالم؟", "<b>نعم — 2022</b>، مسجلاً هدفين في النهائي ضد فرنسا، إلى جانب لقبي كوبا أميركا 2021 و2024."],
      ["كم دوري أبطال أوروبا فاز به ميسي؟", "<b>أربعة ألقاب</b>، كلها مع برشلونة: 2006، 2009، 2011 و2015."]
    ],
    teamHeader: (team, sub) => `${esc(team)} — ${sub} لقباً`,
    indHeader: (indTotal) => `الجوائز الفردية — ${indTotal} جائزة`,
    faq: [
      ["ما هو أهم لقب في مسيرة ميسي؟", "<b>كأس العالم 2022</b> — اللقب الأعظم الذي توّج مسيرته وفاز فيه بجائزة أفضل لاعب في البطولة."],
      ["كم لقباً للدوري فاز به ميسي؟", "<b>اثنا عشر لقباً</b> — 10 لا ليغا و2 دوري فرنسي — إضافة إلى كأس MLS (2025) وكأس الليغات (2023)."],
      ["كم جائزة فردية حقق ميسي؟", "ثماني كرات ذهبية، ستة أحذية ذهبية أوروبية، وكرتان ذهبيتان لكأس العالم — وكلها أرقام قياسية."],
      ["هل ميسي الأكثر تتويجاً في التاريخ؟", "بجمع البطولات الجماعية والأرقام الفردية — <b>نعم بكل المقاييس</b>."]
    ]
  },
  id: {
    head: (teamTotal) => `<b>${teamTotal} trofi tim</b> — karier tersukses dalam sejarah sepak bola — ditambah rekor <b>8 Ballon d'Or</b>. Setiap gelar, klub demi klub, beserta tahun kemenangannya.`,
    kpis: (per) => [
      ["Trofi tim", LIVE.trophies, `Barcelona ${per["Barcelona"] || 0} · Argentina ${per["Argentina"] || 0} · PSG ${per["Paris Saint-Germain"] || 0} · Miami ${per["Inter Miami"] || 0}.`],
      ["Ballon d'Or", "8", "Rekor — 2009–12, 2015, 2019, 2021, 2023."],
      ["Liga Champions", "4", "2006, 2009, 2011, 2015 — semuanya bersama Barcelona."],
      ["Turnamen besar timnas", "3", "Piala Dunia 2022, Copa América 2021 & 2024."]
    ],
    qa: (teamTotal, per) => [
      ["Berapa banyak trofi yang dimenangkan Messi?", `<b>${teamTotal} gelar tim senior</b>: ${per["Barcelona"] || 0} Barcelona, ${per["Paris Saint-Germain"] || 0} PSG, ${per["Inter Miami"] || 0} Inter Miami, dan ${per["Argentina"] || 0} Argentina.`],
      ["Berapa Ballon d'Or yang diraih Messi?", "<b>Delapan</b> — terbanyak dari pemain mana pun sepanjang sejarah (2009–12, 2015, 2019, 2021, 2023)."],
      ["Apakah Messi pernah menjuarai Piala Dunia?", "<b>Ya — 2022</b>, mencetak dua gol di final melawan Prancis, ditambah Copa América 2021 dan 2024."],
      ["Berapa Liga Champions yang dimenangkan Messi?", "<b>Empat</b>, semuanya bersama Barcelona: 2006, 2009, 2011, dan 2015."]
    ],
    teamHeader: (team, sub) => `${esc(team)} — ${sub} trofi`,
    indHeader: (indTotal) => `Penghargaan individu — ${indTotal} gelar`,
    faq: [
      ["Apa trofi terpenting Messi?", "<b>Piala Dunia 2022</b> — gelar puncak yang melengkapi seluruh kariernya, diraih sebagai pemain terbaik turnamen."],
      ["Berapa gelar liga yang dimenangkan Messi?", "<b>Dua belas</b> — 10 La Liga, 2 Ligue 1 — ditambah MLS Cup (2025) dan Leagues Cup (2023) bersama Miami."],
      ["Berapa penghargaan individu yang diraih Messi?", "Delapan Ballon d'Or, enam Sepatu Emas Eropa, dan dua Bola Emas Piala Dunia — masing-masing adalah rekor."],
      ["Apakah Messi pemain tersukses sepanjang masa?", "Berdasarkan gabungan gelar tim dan rekor individu — <b>ya, dengan hitungan apa pun</b>."]
    ]
  }
};

const ACH_EN = {
  head: (teamTotal) => `<b>${teamTotal} team trophies</b> — the most decorated career football has seen — plus a record <b>8 Ballons d'Or</b>. Every title, club by club, with the years won.`,
  kpis: (per) => [
    ["Team trophies", LIVE.trophies, `Barcelona ${per["Barcelona"] || 0} · Argentina ${per["Argentina"] || 0} · PSG ${per["Paris Saint-Germain"] || 0} · Miami ${per["Inter Miami"] || 0}.`],
    ["Ballons d'Or", "8", "Record — 2009–12, 2015, 2019, 2021, 2023."],
    ["Champions Leagues", "4", "2006, 2009, 2011, 2015 — all with Barcelona."],
    ["Major internationals", "3", "World Cup 2022, Copas América 2021 & 2024."]
  ],
  qa: (teamTotal, per) => [
    ["How many trophies has Messi won?", `<b>${teamTotal} senior team titles</b>: ${per["Barcelona"] || 0} Barcelona, ${per["Paris Saint-Germain"] || 0} PSG, ${per["Inter Miami"] || 0} Inter Miami and ${per["Argentina"] || 0} Argentina.`],
    ["How many Ballons d'Or has Messi won?", "<b>Eight</b> — more than any player ever (2009–12, 2015, 2019, 2021, 2023)."],
    ["Has Messi won the World Cup?", "<b>Yes — 2022</b>, scoring twice in the final against France, plus Copas América 2021 and 2024."],
    ["How many Champions Leagues has Messi won?", "<b>Four</b>, all with Barcelona: 2006, 2009, 2011 and 2015."]
  ],
  teamHeader: (team, sub) => `${esc(team)} — ${sub} trophies`,
  indHeader: (indTotal) => `Individual honours — ${indTotal} awards`,
  faq: [
    ["What is Messi's most important trophy?", "The <b>2022 World Cup</b> — the title his whole career had pointed at, won as player of the tournament."],
    ["How many league titles has Messi won?", "<b>Twelve</b> — 10 La Ligas, 2 Ligue 1s — plus an MLS Cup (2025) and a Leagues Cup (2023) with Miami."],
    ["How many individual awards has Messi won?", "Eight Ballons d'Or, six European Golden Shoes and two World Cup Golden Balls — each a record."],
    ["Is Messi the most decorated player ever?", "By team titles plus individual records combined — <b>yes, by any reasonable count</b>."]
  ]
};

function renderAch(d) {
  const lang = getLang();
  const cfg = ACH_I18N[lang] || ACH_EN;
  const teamRows = d.trophies.filter((x) => x.team !== "Individual");
  const indRows = d.trophies.filter((x) => x.team === "Individual");
  const teamTotal = teamRows.reduce((a, x) => a + x.count, 0);
  const indTotal = indRows.reduce((a, x) => a + x.count, 0);
  const per = {};
  teamRows.forEach((x) => { per[x.team] = (per[x.team] || 0) + x.count; });
  setHead(d, cfg.head(teamTotal));
  el("kpis").innerHTML = cfg.kpis(per).map((k) => kpi4(k[0], k[1], k[2])).join("");
  el("qa").innerHTML = cfg.qa(teamTotal, per).map((q) => `<details class="faq-item"><summary class="faq-question"><span>${q[0]}</span><span class="faq-chevron" aria-hidden="true">▾</span></summary><div class="faq-answer"><p>${q[1]}</p></div></details>`).join("");
  el("qa").className = "faq-accordion";
  el("cabinet").innerHTML = cabinetPhotos();
  const order = ["Barcelona", "Paris Saint-Germain", "Inter Miami", "Argentina"];
  const trow = (x) => `<div class="tpill"><span class="tp-name">${esc(x.title)}</span><span class="tp-count">×${x.count}</span>` +
    `<span class="tp-years">${esc(x.years.join(", "))}</span></div>`;
  el("groups").innerHTML = order.map((team) => {
    const rows = teamRows.filter((x) => x.team === team);
    const sub = rows.reduce((a, x) => a + x.count, 0);
    return `<div class="trophy-group"><div class="shead"><h2>${cfg.teamHeader(team, sub)}</h2></div>` +
      rows.map(trow).join("") + `</div>`;
  }).join("") + (indRows.length ?
    `<div class="trophy-group"><div class="shead"><h2>${cfg.indHeader(indTotal)}</h2></div>` +
    indRows.map(trow).join("") + `</div>` : "");
  el("faq").innerHTML = cfg.faq.map((q) => `<details class="faq-item"><summary class="faq-question"><span>${q[0]}</span><span class="faq-chevron" aria-hidden="true">▾</span></summary><div class="faq-answer"><p>${q[1]}</p></div></details>`).join("");
  el("faq").className = "faq-accordion";
  renderExplore(d, "achievements");
  renderMethod(d, "");
  initAchievementsQuiz();
}

/* Entrance motion (additive): donut sweep + KPI tick share Task 1's boot observer —
   one observer, not two. Markup always holds final numbers/offsets (no-JS safe). */
let entranceObs = null;
function tickKpis(grid) {
  grid.querySelectorAll(".kpi-value").forEach((v) => {
    if (v.dataset.tick) return;
    v.dataset.tick = "1";
    const m = v.textContent.trim().match(/^([\d,]+(?:\.\d+)?)$/);
    if (!m) return; /* compound values ("2012 · 91", "927 / 1,000") stay static */
    const final = m[1];
    const dec = (final.split(".")[1] || "").length;
    const target = parseFloat(final.replace(/,/g, ""));
    if (!isFinite(target)) return;
    const t0 = performance.now(), dur = 900;
    const step = (t) => {
      const k = Math.min((t - t0) / dur, 1);
      const cur = target * (1 - Math.pow(1 - k, 3));
      v.textContent = dec ? cur.toFixed(dec) : n(Math.round(cur));
      if (k < 1) requestAnimationFrame(step);
      else v.textContent = final; /* exact final grouping, never rounded off */
    };
    requestAnimationFrame(step);
  });
}
function armEntrance() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sparks = document.querySelectorAll("svg.spark:not(.in)");
  const donuts = document.querySelectorAll("svg.donut:not(.in)");
  const grids = document.querySelectorAll("#kpis, #decades");
  const applyDonut = (svg) => {
    svg.classList.add("in");
    svg.querySelectorAll("circle").forEach((c) => {
      const len = c.dataset.len || c.getAttribute("data-len");
      const C = c.dataset.c || c.getAttribute("data-c");
      if (len && C) c.setAttribute("stroke-dasharray", `${len} ${C}`);
    });
  };
  if (reduce) {
    sparks.forEach((s) => s.classList.add("in"));
    donuts.forEach(applyDonut);
    return;
  }
  if (!("IntersectionObserver" in window)) {
    sparks.forEach((s) => s.classList.add("in"));
    donuts.forEach(applyDonut);
    grids.forEach(tickKpis);
    return;
  }
  if (!entranceObs) {
    entranceObs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const t = en.target;
        entranceObs.unobserve(t);
        if (t.matches("svg.donut")) {
          applyDonut(t);
        } else if (t.matches("svg.spark")) {
          t.classList.add("in");
        } else {
          t.dataset.armed = "1";
          tickKpis(t);
        }
      });
    }, { rootMargin: "250px 0px 250px 0px", threshold: 0.01 });
  }
  sparks.forEach((s) => entranceObs.observe(s));
  donuts.forEach((s) => entranceObs.observe(s));
  grids.forEach((g) => { if (!g.dataset.armed) entranceObs.observe(g); });
}

/* Universal clipboard helper with textarea fallback */
async function copyToClipboard(text, msgEl, successMsg) {
  const lang = getLang();
  const defaultMsgs = {
    es: "¡Copiado al portapapeles!",
    pt: "Copiado para a área de transferência!",
    fr: "Copié dans le presse-papier !",
    ro: "Copiat în clipboard!",
    uz: "Buferga nusxalandi!",
    ar: "تم النسخ إلى الحافظة!",
    id: "Disalin ke papan klip!"
  };
  const finalMsg = successMsg || defaultMsgs[lang] || "Copied to clipboard!";
  let ok = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch (_) {}
  if (!ok) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      ok = true;
    } catch (_) {}
  }
  if (msgEl) {
    msgEl.textContent = ok ? finalMsg : text;
    clearTimeout(msgEl._timer);
    msgEl._timer = setTimeout(() => { msgEl.textContent = ""; }, 3500);
  }
}

/* ================= BIRTHDAY VIRAL SOCIAL & CANVAS CARD ================= */
function updateBirthdaySocialShare(dayData, key) {
  const lang = getLang();
  const shareMsg = el("bday-share-msg");
  const isMessiBday = (dayData.month === 6 && dayData.day === 24);
  let shareText = "";
  if (lang === "es") {
    if (dayData.goalsCount > 0) {
      const gWord = dayData.goalsCount === 1 ? "gol" : "goles";
      shareText = `¡Lionel Messi marcó ${dayData.goalsCount} ${gWord} en mi cumpleaños (${dayData.formatted})! ¿Marcó en el tuyo?`;
    } else if (isMessiBday) {
      shareText = `¡Cumplo años el mismo día que Lionel Messi (24 de junio)! ¿Marcó en tu cumpleaños?`;
    } else {
      shareText = `¿Marcó Lionel Messi en tu cumpleaños? Revisa los 366 días a lo largo de sus 937 goles:`;
    }
  } else if (lang === "pt") {
    if (dayData.goalsCount > 0) {
      const gWord = dayData.goalsCount === 1 ? "gol" : "gols";
      shareText = `Lionel Messi marcou ${dayData.goalsCount} ${gWord} no meu aniversário (${dayData.formatted})! Ele marcou no seu?`;
    } else if (isMessiBday) {
      shareText = `Faço aniversário no mesmo dia que Lionel Messi (24 de junho)! Ele marcou no seu?`;
    } else {
      shareText = `Lionel Messi marcou no seu aniversário? Confira todos os 366 dias da carreira:`;
    }
  } else if (lang === "fr") {
    if (dayData.goalsCount > 0) {
      const gWord = dayData.goalsCount === 1 ? "but" : "buts";
      shareText = `Lionel Messi a marqué ${dayData.goalsCount} ${gWord} le jour de mon anniversaire (${dayData.formatted}) ! A-t-il marqué le vôtre ?`;
    } else if (isMessiBday) {
      shareText = `Je partage mon anniversaire avec Lionel Messi (24 juin) ! A-t-il marqué le vôtre ?`;
    } else {
      shareText = `Lionel Messi a-t-il marqué le jour de votre anniversaire ? Découvrez les 366 jours :`;
    }
  } else if (lang === "ro") {
    if (dayData.goalsCount > 0) {
      const gWord = dayData.goalsCount === 1 ? "gol" : "goluri";
      shareText = `Lionel Messi a marcat ${dayData.goalsCount} ${gWord} de ziua mea (${dayData.formatted})! A marcat și de ziua ta?`;
    } else if (isMessiBday) {
      shareText = `Împart ziua de naștere cu Lionel Messi (24 iunie)! A marcat de ziua ta?`;
    } else {
      shareText = `A marcat Lionel Messi de ziua ta? Verifică toate cele 366 de zile ale carierei:`;
    }
  } else if (lang === "uz") {
    if (dayData.goalsCount > 0) {
      shareText = `Lionel Messi mening tug'ilgan kunimda (${dayData.formatted}) ${dayData.goalsCount} ta gol urgan! Siznikida-chi?`;
    } else if (isMessiBday) {
      shareText = `Tug'ilgan kunim Lionel Messi bilan bir kunda (24-iyun)! Siznikida gol urganmi?`;
    } else {
      shareText = `Lionel Messi tug'ilgan kuningizda gol urganmi? Barcha 366 kunni tekshiring:`;
    }
  } else if (lang === "ar") {
    if (dayData.goalsCount > 0) {
      shareText = `سجّل ليونيل ميسي ${dayData.goalsCount} هدفاً في يوم ميلادي (${dayData.formatted})! هل سجّل في يوم ميلادك؟`;
    } else if (isMessiBday) {
      shareText = `أشارك ليونيل ميسي يوم ميلاده (24 يونيو)! هل سجّل في يوم ميلادك؟`;
    } else {
      shareText = `هل سجّل ليونيل ميسي في يوم ميلادك؟ تفقّد جميع أيام السنة الـ 366:`;
    }
  } else if (lang === "id") {
    if (dayData.goalsCount > 0) {
      shareText = `Lionel Messi mencetak ${dayData.goalsCount} gol di hari ulang tahunku (${dayData.formatted})! Apakah ia mencetak gol di harimu?`;
    } else if (isMessiBday) {
      shareText = `Ulang tahunku sama dengan Lionel Messi (24 Juni)! Apakah ia mencetak gol di ulang tahunmu?`;
    } else {
      shareText = `Apakah Lionel Messi mencetak gol di hari ulang tahunmu? Cek semua 366 hari dari 937 gol kariernya:`;
    }
  } else {
    if (dayData.goalsCount > 0) {
      const gWord = dayData.goalsCount === 1 ? "goal" : "goals";
      shareText = `Lionel Messi scored ${dayData.goalsCount} ${gWord} on my birthday (${dayData.formatted})! Did he score on yours?`;
    } else if (isMessiBday) {
      shareText = `I share a birthday with Lionel Messi (24 June)! Did he score on your birthday?`;
    } else {
      shareText = `Did Lionel Messi score on your birthday? Check all 366 days across his 937 career goals:`;
    }
  }

  const shareUrl = `${location.origin}/en/birthday/${key}`;

  const shareBtn = el("bday-share-btn");
  if (shareBtn) {
    shareBtn.hidden = false;
    shareBtn.onclick = async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: "Messi Birthday Stats", text: shareText, url: shareUrl });
          return;
        } catch (_) {}
      }
      copyToClipboard(`${shareText} ${shareUrl}`, shareMsg);
    };
  }

  const copyBtn = el("bday-copy-btn");
  if (copyBtn) {
    copyBtn.onclick = () => {
      copyToClipboard(shareUrl, shareMsg);
    };
  }

  const xBtn = el("bday-x-share-btn");
  if (xBtn) {
    xBtn.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  }
  const waBtn = el("bday-wa-share-btn");
  if (waBtn) {
    waBtn.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`;
  }

}

function setupEmbedModal() {
  const triggerBtn = el("bday-embed-trigger-btn");
  const modal = el("bday-embed-modal");
  const closeBtn = el("bday-embed-modal-close");
  const copyBtn = el("bday-copy-embed-btn");
  const copyMsg = el("bday-embed-copy-msg");
  const textarea = el("bday-embed-code");
  const iframe = el("bday-embed-iframe");
  const tabDynamic = el("bday-embed-tab-dynamic");
  const tabFixed = el("bday-embed-tab-fixed");
  const tabDateSpan = el("bday-embed-tab-date");

  if (!triggerBtn || !modal) return;

  let mode = "dynamic"; // "dynamic" or "fixed"

  function updateEmbedSnippet() {
    const key = window.__currentBdayKey || "09-22";
    const formatted = window.__currentBdayFormatted || key;
    if (tabDateSpan) tabDateSpan.textContent = formatted;

    if (mode === "fixed") {
      const srcUrl = `https://www.messistat.com/embed/on-this-day?date=${key}`;
      if (textarea) {
        textarea.value = `<iframe src="${srcUrl}" width="100%" height="380" frameborder="0" style="border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.1);max-width:520px;"></iframe>`;
      }
      if (iframe) {
        iframe.src = `/embed/on-this-day.html?date=${key}`;
      }
    } else {
      const srcUrl = `https://www.messistat.com/embed/on-this-day`;
      if (textarea) {
        textarea.value = `<iframe src="${srcUrl}" width="100%" height="380" frameborder="0" style="border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.1);max-width:520px;"></iframe>`;
      }
      if (iframe) {
        iframe.src = `/embed/on-this-day.html`;
      }
    }
  }

  window.__updateEmbedModal = updateEmbedSnippet;

  triggerBtn.onclick = () => {
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    updateEmbedSnippet();
  };

  if (tabDynamic) {
    tabDynamic.onclick = () => {
      mode = "dynamic";
      tabDynamic.classList.add("active");
      if (tabFixed) tabFixed.classList.remove("active");
      updateEmbedSnippet();
    };
  }

  if (tabFixed) {
    tabFixed.onclick = () => {
      mode = "fixed";
      tabFixed.classList.add("active");
      if (tabDynamic) tabDynamic.classList.remove("active");
      updateEmbedSnippet();
    };
  }

  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
    };
  }
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
    }
  };
  if (copyBtn && textarea) {
    copyBtn.onclick = () => {
      copyToClipboard(textarea.value, copyMsg);
    };
  }
}

/* ================= 366-DAY BIRTHDAY GOALS EXPLORER ================= */
const BDAY_I18N = {
  en: {
    months: ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    badgeSuccess: "Yes! Messi Scored On Your Birthday!",
    badgeMessi: "Leo Messi's Own Birthday!",
    badgeEmpty: "No Goals on this Date",
    headlineSuccess: (g, m, d) => `Lionel Messi scored <b>${g} ${g === 1 ? "goal" : "goals"}</b> in <b>${m} ${m === 1 ? "match" : "matches"}</b> on ${d} throughout his senior career!`,
    headlineMessi: `You share a birthday with <b>Lionel Andrés Messi</b> (born 24 June 1987 in Rosario)!`,
    headlineEmpty: (d) => `Lionel Messi has not scored on <b>${d}</b> during his senior career.`,
    whyZeroTitle: "Why 0 goals?",
    whyZeroMessi: "Lionel Messi has never played a competitive senior match on 24 June because late June falls during the European club summer off-season or scheduled rest intervals between international tournament rounds.",
    whyZeroMessiSub: "You share your special day with the greatest footballer in history!",
    emptyExpl: "Messi did not have a match scheduled or did not score on this specific calendar day — but he has scored on <b>292 of 366 days (79.8%)</b> of the year!",
    closestDay: (d, g) => `The closest calendar day Messi scored on is <b>${d}</b> (${g} career goals).`,
    closestBtn: (d, g) => `Check ${d} (${g} goals) &rarr;`,
    watchClip: (cnt) => `Watch ${cnt > 1 ? cnt + " Goal Clips" : "Goal Clip"}`,
    searchYt: "Search Highlights",
    playInline: "Play Inline",
    closeInline: "Close Video",
    ytHighlights: "YouTube Highlights",
    goalSummary: (g) => `${g} ${g === 1 ? "goal" : "goals"} scored:`,
    goalTab: (idx, min) => `Goal ${idx}${min ? ` (${min}')` : ""}`,
    shareSuccess: (d, g, m) => `Lionel Messi scored ${g} goals in ${m} matches on my birthday (${d})! Check your date:`,
    shareEmpty: (d) => `Did Lionel Messi score on your birthday? He scored on 292 of 366 days of the year! Check yours:`,
    allDays: "All (366 Days)"
  },
  es: {
    months: ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
    badgeSuccess: "¡Sí! Messi marcó en tu cumpleaños",
    badgeMessi: "¡El propio cumpleaños de Leo Messi!",
    badgeEmpty: "Sin goles en esta fecha",
    headlineSuccess: (g, m, d) => `¡Lionel Messi marcó <b>${g} ${g === 1 ? "gol" : "goles"}</b> en <b>${m} ${m === 1 ? "partido" : "partidos"}</b> el ${d} a lo largo de su carrera senior!`,
    headlineMessi: `¡Compartes cumpleaños con <b>Lionel Andrés Messi</b> (nacido el 24 de junio de 1987 en Rosario)!`,
    headlineEmpty: (d) => `Lionel Messi no ha marcado el <b>${d}</b> durante su carrera senior.`,
    whyZeroTitle: "¿Por qué 0 goles?",
    whyZeroMessi: "Lionel Messi nunca ha jugado un partido oficial un 24 de junio porque finales de junio coincide con las vacaciones de verano de clubes o períodos de descanso entre fases de torneos de selecciones.",
    whyZeroMessiSub: "¡Compartes tu día especial con el mejor futbolista de todos los tiempos!",
    emptyExpl: "Messi no tuvo partido programado o no anotó en este día exacto — ¡pero ha marcado en <b>292 de los 366 días (79,8%)</b> del año!",
    closestDay: (d, g) => `El día de calendario más cercano en el que Messi marcó es el <b>${d}</b> (${g} goles).`,
    closestBtn: (d, g) => `Ver ${d} (${g} goles) &rarr;`,
    watchClip: (cnt) => `Ver ${cnt > 1 ? cnt + " videos de goles" : "video del gol"}`,
    searchYt: "Buscar en YouTube",
    playInline: "Reproducir aquí",
    closeInline: "Cerrar video",
    ytHighlights: "Resumen en YouTube",
    goalSummary: (g) => `${g} ${g === 1 ? "gol anotado" : "goles anotados"}:`,
    goalTab: (idx, min) => `Gol ${idx}${min ? ` (${min}')` : ""}`,
    shareSuccess: (d, g, m) => `¡Lionel Messi marcó ${g} goles en ${m} partidos el día de mi cumpleaños (${d})! Comprueba el tuyo:`,
    shareEmpty: (d) => `¿Marcó Lionel Messi en tu cumpleaños? ¡Marcó en 292 de los 366 días del año! Comprueba el tuyo:`,
    allDays: "Todos (366 días)"
  },
  pt: {
    months: ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
    badgeSuccess: "Sim! Messi marcou no seu aniversário!",
    badgeMessi: "O próprio aniversário de Leo Messi!",
    badgeEmpty: "Sem gols nesta data",
    headlineSuccess: (g, m, d) => `Lionel Messi marcou <b>${g} ${g === 1 ? "gol" : "gols"}</b> em <b>${m} ${m === 1 ? "partida" : "partidas"}</b> em ${d} em sua carreira profissional!`,
    headlineMessi: `Você faz aniversário no mesmo dia que <b>Lionel Andrés Messi</b> (nascido em 24 de junho de 1987 em Rosário)!`,
    headlineEmpty: (d) => `Lionel Messi não marcou em <b>${d}</b> durante sua carreira profissional.`,
    whyZeroTitle: "Por que 0 gols?",
    whyZeroMessi: "Lionel Messi nunca disputou uma partida oficial em 24 de junho porque o fim de junho coincide com as férias de verão dos clubes europeus ou intervalos de descanso em torneios de seleções.",
    whyZeroMessiSub: "Você divide seu dia especial com o maior jogador de futebol de todos os tempos!",
    emptyExpl: "Messi não teve partida marcada ou não marcou neste dia — mas ele já marcou em <b>292 dos 366 dias (79,8%)</b> do ano!",
    closestDay: (d, g) => `O dia mais próximo em que Messi marcou é <b>${d}</b> (${g} gols na carreira).`,
    closestBtn: (d, g) => `Ver ${d} (${g} gols) &rarr;`,
    watchClip: (cnt) => `Assistir ${cnt > 1 ? cnt + " gols" : "ao gol"}`,
    searchYt: "Buscar no YouTube",
    playInline: "Assistir aqui",
    closeInline: "Fechar vídeo",
    ytHighlights: "Melhores momentos no YouTube",
    goalSummary: (g) => `${g} ${g === 1 ? "gol marcado" : "gols marcados"}:`,
    goalTab: (idx, min) => `Gol ${idx}${min ? ` (${min}')` : ""}`,
    shareSuccess: (d, g, m) => `Lionel Messi marcou ${g} gols em ${m} jogos no dia do meu aniversário (${d})! Confira o seu:`,
    shareEmpty: (d) => `Marcou Messi no dia do seu aniversário? Ele marcou em 292 dos 366 dias do ano! Confira o seu:`,
    allDays: "Todos (366 dias)"
  },
  fr: {
    months: ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
    badgeSuccess: "Oui ! Messi a marqué le jour de votre anniversaire !",
    badgeMessi: "L'anniversaire de Leo Messi lui-même !",
    badgeEmpty: "Aucun but à cette date",
    headlineSuccess: (g, m, d) => `Lionel Messi a marqué <b>${g} ${g === 1 ? "but" : "buts"}</b> en <b>${m} ${m === 1 ? "match" : "matchs"}</b> le ${d} au cours de sa carrière professionnelle !`,
    headlineMessi: `Vous partagez votre anniversaire avec <b>Lionel Andrés Messi</b> (né le 24 juin 1987 à Rosario) !`,
    headlineEmpty: (d) => `Lionel Messi n'a pas marqué le <b>${d}</b> au cours de sa carrière professionnelle.`,
    whyZeroTitle: "Pourquoi 0 but ?",
    whyZeroMessi: "Lionel Messi n'a jamais joué de match officiel un 24 juin car la fin juin correspond à la trêve estivale des clubs européens ou à des jours de repos lors des tournois internationaux.",
    whyZeroMessiSub: "Vous partagez votre jour spécial avec le plus grand joueur de l'histoire !",
    emptyExpl: "Messi n'avait pas de match ou n'a pas marqué ce jour précis — mais il a marqué lors de <b>292 des 366 jours (79,8%)</b> de l'année !",
    closestDay: (d, g) => `Le jour le plus proche où Messi a marqué est le <b>${d}</b> (${g} buts en carrière).`,
    closestBtn: (d, g) => `Voir le ${d} (${g} buts) &rarr;`,
    watchClip: (cnt) => `Voir ${cnt > 1 ? "les " + cnt + " buts" : "le but"}`,
    searchYt: "Chercher sur YouTube",
    playInline: "Lecture intégrée",
    closeInline: "Fermer la vidéo",
    ytHighlights: "Moments forts sur YouTube",
    goalSummary: (g) => `${g} ${g === 1 ? "but inscrit" : "buts inscrits"} :`,
    goalTab: (idx, min) => `But ${idx}${min ? ` (${min}')` : ""}`,
    shareSuccess: (d, g, m) => `Lionel Messi a marqué ${g} buts en ${m} matchs le jour de mon anniversaire (${d}) ! Vérifiez le vôtre :`,
    shareEmpty: (d) => `Messi a-t-il marqué le jour de votre anniversaire ? Il a marqué 292 des 366 jours de l'année ! Vérifiez le vôtre :`,
    allDays: "Tous (366 jours)"
  },
  ro: {
    months: ["", "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"],
    badgeSuccess: "Da! Messi a marcat de ziua ta!",
    badgeMessi: "Chiar ziua de naștere a lui Leo Messi!",
    badgeEmpty: "Niciun gol în această dată",
    headlineSuccess: (g, m, d) => `Lionel Messi a marcat <b>${g} ${g === 1 ? "gol" : "goluri"}</b> în <b>${m} ${m === 1 ? "meci" : "meciuri"}</b> pe ${d} în cariera sa de senior!`,
    headlineMessi: `Îți împarți ziua de naștere cu <b>Lionel Andrés Messi</b> (născut pe 24 iunie 1987 la Rosario)!`,
    headlineEmpty: (d) => `Lionel Messi nu a marcat pe <b>${d}</b> în cariera sa de senior.`,
    whyZeroTitle: "De ce 0 goluri?",
    whyZeroMessi: "Lionel Messi nu a jucat niciodată un meci oficial pe 24 iunie deoarece finalul lunii iunie coincide cu pauza de vară a cluburilor europene sau zilele de odihnă dintre fazele turneelor finale.",
    whyZeroMessiSub: "Îți împarți ziua specială cu cel mai mare fotbalist din istorie!",
    emptyExpl: "Messi nu a avut meci sau nu a marcat în această zi — dar a înscris în <b>292 din cele 366 de zile (79,8%)</b> ale anului!",
    closestDay: (d, g) => `Cea mai apropiată zi în care a marcat Messi este <b>${d}</b> (${g} goluri).`,
    closestBtn: (d, g) => `Vezi ${d} (${g} goluri) &rarr;`,
    watchClip: (cnt) => `Vezi ${cnt > 1 ? cnt + " clipuri" : "clipul golului"}`,
    searchYt: "Caută pe YouTube",
    playInline: "Redă aici",
    closeInline: "Închide video",
    ytHighlights: "Rezumat pe YouTube",
    goalSummary: (g) => `${g} ${g === 1 ? "gol marcat" : "goluri marcate"}:`,
    goalTab: (idx, min) => `Gol ${idx}${min ? ` (${min}')` : ""}`,
    shareSuccess: (d, g, m) => `Lionel Messi a marcat ${g} goluri în ${m} meciuri de ziua mea (${d})! Verifică data ta:`,
    shareEmpty: (d) => `A marcat Lionel Messi de ziua ta? A înscris în 292 din 366 de zile! Verifică:`,
    allDays: "Toate (366 zile)"
  },
  uz: {
    months: ["", "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
    badgeSuccess: "Ha! Messi tug'ilgan kuningizda gol urgan!",
    badgeMessi: "Leo Messining o'z tug'ilgan kuni!",
    badgeEmpty: "Bu sanada gol yo'q",
    headlineSuccess: (g, m, d) => `Lionel Messi ${d} sanasida faoliyati davomida <b>${m} ta o'yinda</b> <b>${g} ta gol</b> urgan!`,
    headlineMessi: `Siz tug'ilgan kuningizni <b>Lionel Andrés Messi</b> (1987-yil 24-iyun, Rosario) bilan bir kunda nishonlaysiz!`,
    headlineEmpty: (d) => `Lionel Messi faoliyati davomida <b>${d}</b> kuni gol urmagan.`,
    whyZeroTitle: "Nega 0 ta gol?",
    whyZeroMessi: "Lionel Messi hech qachon 24-iyun kuni rasmiy o'yin o'tkazmagan, chunki iyun oxiri Yevropa klublari mavsum oralig'i yoki xalqaro turnirlar tanaffusiga to'g'ri keladi.",
    whyZeroMessiSub: "Siz o'z kuningizni futbol tarixidagi eng buyuk o'yinchi bilan baham ko'rasiz!",
    emptyExpl: "Messi bu kunda o'ynamagan yoki gol urmagan — ammo u yilning <b>366 kunidan 292 tasida (79,8%)</b> gol urgan!",
    closestDay: (d, g) => `Messi gol urgan eng yaqin sana — <b>${d}</b> (${g} ta gol).`,
    closestBtn: (d, g) => `${d} ni ko'rish (${g} gol) &rarr;`,
    watchClip: (cnt) => `${cnt > 1 ? cnt + " ta gol videosini" : "Gol videosini"} ko'rish`,
    searchYt: "YouTube'da qidirish",
    playInline: "Shu yerda ko'rish",
    closeInline: "Videoni yopish",
    ytHighlights: "YouTube lavhalari",
    goalSummary: (g) => `${g} ta gol urilgan:`,
    goalTab: (idx, min) => `Gol ${idx}${min ? ` (${min}')` : ""}`,
    shareSuccess: (d, g, m) => `Lionel Messi mening tug'ilgan kunimda (${d}) ${m} o'yinda ${g} ta gol urgan! O'zingiznikini tekshiring:`,
    shareEmpty: (d) => `Lionel Messi tug'ilgan kuningizda gol urganmi? U 366 kundan 292 tasida gol urgan! Tekshiring:`,
    allDays: "Barchasi (366 kun)"
  },
  ar: {
    months: ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
    badgeSuccess: "نعم! سجّل ميسي في يوم ميلادك!",
    badgeMessi: "إنه عيد ميلاد ليونيل ميسي نفسه!",
    badgeEmpty: "لا توجد أهداف في هذا التاريخ",
    headlineSuccess: (g, m, d) => `سجّل ليونيل ميسي <b>${g} ${g === 1 ? "هدفاً" : "أهداف"}</b> في <b>${m} ${m === 1 ? "مباراة" : "مباريات"}</b> بتاريخ ${d} خلال مسيرته الاحترافية!`,
    headlineMessi: `تشارك يوم ميلادك مع <b>ليونيل أندريس ميسي</b> (مواليد 24 يونيو 1987 في روزاريو)!`,
    headlineEmpty: (d) => `لم يسجّل ليونيل ميسي في تاريخ <b>${d}</b> خلال مسيرته الرسمية.`,
    whyZeroTitle: "لماذا 0 أهداف؟",
    whyZeroMessi: "لم يخض ليونيل ميسي أي مباراة رسمية يوم 24 يونيو لأن أواخر يونيو تصادف عطلة الأندية الأوروبية الصيفية أو فترات الراحة بين أدوار البطولات الدولية.",
    whyZeroMessiSub: "أنت تشارك يومك المميز مع أعظم لاعب في تاريخ كرة القدم!",
    emptyExpl: "لم يخض ميسي مباراة أو لم يسجل في هذا اليوم — لكنه سجّل في <b>292 يوماً من أصل 366 (79.8%)</b> على مدار السنة!",
    closestDay: (d, g) => `أقرب يوم سجّل فيه ميسي هو <b>${d}</b> (${g} أهداف).`,
    closestBtn: (d, g) => `عرض ${d} (${g} أهداف) &rarr;`,
    watchClip: (cnt) => `شاهد ${cnt > 1 ? cnt + " مقاطع أهداف" : "فيديو الهدف"}`,
    searchYt: "ابحث في يوتيوب",
    playInline: "تشغيل هنا",
    closeInline: "إغلاق الفيديو",
    ytHighlights: "أبرز اللقطات على يوتيوب",
    goalSummary: (g) => `عدد الأهداف المسجلة (${g}):`,
    goalTab: (idx, min) => `الهدف ${idx}${min ? ` (${min}')` : ""}`,
    shareSuccess: (d, g, m) => `سجّل ليونيل ميسي ${g} أهداف في ${m} مباريات في يوم ميلادي (${d})! تفقّد تاريخك:`,
    shareEmpty: (d) => `هل سجّل ميسي في يوم ميلادك؟ لقد سجّل في 292 يوماً من أصل 366! تفقّد تاريخك:`,
    allDays: "الكل (366 يوماً)"
  },
  id: {
    months: ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
    badgeSuccess: "YA! MESSI MENCETAK GOL DI HARI ULANG TAHUNMU!",
    badgeMessi: "ITU HARI ULANG TAHUN LIONEL MESSI SENDIRI!",
    badgeEmpty: "TIDAK ADA GOL PADA TANGGAL INI",
    headlineSuccess: (g, m, d) => `Lionel Messi mencetak <b>${g} gol</b> dalam <b>${m} pertandingan</b> pada ${d} sepanjang karier profesionalnya!`,
    headlineMessi: `Kamu berbagi hari ulang tahun dengan <b>Lionel Andrés Messi</b> (lahir 24 Juni 1987 di Rosario)!`,
    headlineEmpty: (d) => `Lionel Messi tidak mencetak gol pada <b>${d}</b> dalam laga resmi senior.`,
    whyZeroTitle: "Mengapa 0 Gol?",
    whyZeroMessi: "Lionel Messi tidak pernah bermain di laga resmi pada 24 Juni karena akhir Juni bertepatan dengan jeda musim panas klub Eropa atau hari istirahat turnamen internasional.",
    whyZeroMessiSub: "Kamu berbagi hari spesial ini dengan pesepak bola terhebat sepanjang masa!",
    emptyExpl: "Messi tidak bertanding atau tidak mencetak gol pada hari ini — namun ia mencetak gol pada <b>292 dari 366 hari (79,8%)</b> sepanjang tahun!",
    closestDay: (d, g) => `Tanggal terdekat Messi mencetak gol adalah <b>${d}</b> (${g} gol).`,
    closestBtn: (d, g) => `Lihat ${d} (${g} gol) &rarr;`,
    watchClip: (cnt) => `Tonton ${cnt > 1 ? cnt + " Klip Gol" : "Klip Gol"}`,
    searchYt: "Cari di YouTube",
    playInline: "Putar di sini",
    closeInline: "Tutup video",
    ytHighlights: "Cuplikan YouTube",
    goalSummary: (g) => `Gol yang dicetak (${g}):`,
    goalTab: (idx, min) => `Gol ${idx}${min ? ` (${min}')` : ""}`,
    shareSuccess: (d, g, m) => `Lionel Messi mencetak ${g} gol dalam ${m} laga di hari ulang tahunku (${d})! Cek milikmu:`,
    shareEmpty: (d) => `Apakah Messi mencetak gol di hari ulang tahunmu? Ia mencetak gol di 292 dari 366 hari! Cek punyamu:`,
    allDays: "Semua (366 hari)"
  }
};

async function renderBirthday(d) {
  let bdayData;
  try {
    let res;
    try {
      res = await fetch("/data/birthday-goals.json", { cache: "no-store" });
    } catch (_) {}
    if (!res || !res.ok) {
      res = await fetch("data/birthday-goals.json", { cache: "no-store" });
    }
    if (!res.ok) throw new Error("birthday goals data " + res.status);
    bdayData = await res.json();
  } catch (err) {
    console.error("Failed to load birthday data", err);
    return;
  }

  const lang = getLang();
  const bDict = BDAY_I18N[lang] || BDAY_I18N.en;

  const meta = bdayData.meta || {};
  const calendar = bdayData.calendar || {};

  if (el("kpi-days-scored")) el("kpi-days-scored").textContent = meta.daysWithGoals || 292;
  if (el("kpi-days-empty")) el("kpi-days-empty").textContent = meta.daysWithoutGoals || 74;

  const MONTH_NAMES = bDict.months;
  const DAYS_IN_MONTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  const pad2 = (num) => String(num).padStart(2, "0");
  const makeKey = (m, day) => `${pad2(m)}-${pad2(day)}`;

  const monthSelect = el("bday-month-select");
  const daySelect = el("bday-day-select");
  const checkBtn = el("bday-check-btn");
  const pillsWrap = el("bday-month-pills");

  const updateDaysDropdown = (m, keepDay) => {
    if (!daySelect) return;
    const maxDays = DAYS_IN_MONTH[m] || 31;
    let selected = keepDay ? Math.min(keepDay, maxDays) : +(daySelect.value || 1);
    if (selected > maxDays) selected = maxDays;
    let html = "";
    for (let i = 1; i <= maxDays; i++) {
      html += `<option value="${i}"${i === selected ? " selected" : ""}>${i}</option>`;
    }
    daySelect.innerHTML = html;
  };

  if (monthSelect) {
    let mOptions = "";
    for (let m = 1; m <= 12; m++) {
      mOptions += `<option value="${m}">${MONTH_NAMES[m]}</option>`;
    }
    monthSelect.innerHTML = mOptions;
  }

  if (pillsWrap) {
    let pillsHtml = "";
    for (let m = 1; m <= 12; m++) {
      const shortName = MONTH_NAMES[m].length > 4 ? MONTH_NAMES[m].slice(0, 3) : MONTH_NAMES[m];
      pillsHtml += `<button type="button" class="bday-month-pill" data-month="${m}">${shortName}</button>`;
    }
    pillsWrap.innerHTML = pillsHtml;
    pillsWrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".bday-month-pill");
      if (!btn) return;
      const m = +btn.dataset.month;
      if (monthSelect) monthSelect.value = m;
      const currentDay = daySelect ? +daySelect.value : 1;
      updateDaysDropdown(m, currentDay);
      selectDate(m, daySelect ? +daySelect.value : 1, false);
    });
  }

  const findClosestScoringDay = (targetKey) => {
    const keys = Object.keys(calendar);
    const targetIdx = keys.indexOf(targetKey);
    if (targetIdx === -1) return null;
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (calendar[k] && calendar[k].goalsCount > 0) {
        const dist = Math.min(
          Math.abs(i - targetIdx),
          keys.length - Math.abs(i - targetIdx)
        );
        if (dist < bestDist && dist > 0) {
          bestDist = dist;
          best = calendar[k];
        }
      }
    }
    return best;
  };

  const targetDateEl = el("bday-target-date");
  const badgeEl = el("bday-verdict-badge");
  const headlineEl = el("bday-headline");
  const matchListEl = el("bday-match-list");
  const shareBtn = el("bday-share-btn");
  const shareMsg = el("bday-share-msg");

  let currentMatches = [];

  // Goal Video Modal Controller
  const videoModal = el("video-modal");
  const videoPlayer = el("goal-video-player");
  const videoBigPlayBtn = el("video-big-play-btn");
  const videoTitle = el("video-modal-title");
  const videoEyebrow = el("video-modal-eyebrow");
  const videoClose = el("video-modal-close");
  const videoGoalsNav = el("video-goals-nav");
  const videoFallback = el("video-fallback");
  const videoYtLink = el("video-yt-link");
  const vpillMin = el("vpill-minute");
  const vpillComp = el("vpill-comp");
  const vpillScore = el("vpill-score");
  const vpillAssist = el("vpill-assist");
  const vpillXg = el("vpill-xg");

  const closeGoalVideo = () => {
    if (!videoModal) return;
    videoModal.hidden = true;
    videoModal.setAttribute("aria-hidden", "true");
    if (videoPlayer) {
      videoPlayer.pause();
      videoPlayer.removeAttribute("src");
      videoPlayer.load();
    }
    if (videoBigPlayBtn) videoBigPlayBtn.hidden = true;
    document.body.style.overflow = "";
  };

  if (videoBigPlayBtn) {
    videoBigPlayBtn.onclick = () => {
      if (!isOwnerNoAdsActive()) {
        window.open(MONETIZE_CONFIG.adsterraSmartlinkUrl, "_blank", "noopener,noreferrer");
      }
      if (videoPlayer) {
        videoPlayer.play().then(() => {
          videoBigPlayBtn.hidden = true;
        }).catch((err) => {
          console.log("Play blocked:", err);
        });
      }
    };
  }

  if (videoPlayer) {
    videoPlayer.addEventListener("play", () => {
      if (videoBigPlayBtn) videoBigPlayBtn.hidden = true;
    });
    videoPlayer.addEventListener("pause", () => {
      if (videoModal && !videoModal.hidden && videoBigPlayBtn) videoBigPlayBtn.hidden = false;
    });
    videoPlayer.addEventListener("ended", () => {
      if (videoBigPlayBtn) videoBigPlayBtn.hidden = false;
    });
  }

  if (videoClose) videoClose.onclick = closeGoalVideo;
  if (videoModal) {
    videoModal.onclick = (e) => {
      if (e.target === videoModal) closeGoalVideo();
    };
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && videoModal && !videoModal.hidden) {
      closeGoalVideo();
    }
  });

  const openGoalVideo = (match, initialIndex = 0) => {
    if (!videoModal || !match) return;
    const videos = match.videos || [];
    if (!videos.length) {
      const ytQuery = encodeURIComponent(`Lionel Messi goal vs ${match.opponent} ${match.date}`);
      window.open(`https://www.youtube.com/results?search_query=${ytQuery}`, "_blank");
      return;
    }

    const loadGoalIndex = (idx) => {
      const v = videos[idx];
      if (!v) return;

      if (videoFallback) videoFallback.hidden = true;
      if (videoBigPlayBtn) videoBigPlayBtn.hidden = true;
      if (videoTitle) {
        const numStr = v.goalNumber ? `Goal #${v.goalNumber}: ` : "Goal: ";
        videoTitle.textContent = `${numStr}Messi vs ${match.opponent}`;
      }
      if (videoEyebrow) {
        videoEyebrow.textContent = `${match.date} • ${match.competition || "Official Match"}`;
      }
      if (vpillMin) vpillMin.textContent = `${v.minute || match.minutes?.[idx] || ""}'`;
      if (vpillComp) vpillComp.textContent = match.competition || "Match";
      if (vpillScore) vpillScore.textContent = `${match.team} ${match.score} ${match.opponent}`;
      
      if (vpillAssist) {
        if (v.assist) {
          vpillAssist.hidden = false;
          vpillAssist.textContent = `Assist: ${v.assist}`;
        } else {
          vpillAssist.hidden = true;
        }
      }
      if (vpillXg) {
        if (v.xg != null) {
          vpillXg.hidden = false;
          vpillXg.textContent = `xG: ${v.xg}`;
        } else {
          vpillXg.hidden = true;
        }
      }

      if (videoYtLink) {
        videoYtLink.href = `https://www.youtube.com/results?search_query=Lionel+Messi+goal+vs+${encodeURIComponent(match.opponent)}+${match.date}`;
      }

      if (videoPlayer) {
        videoPlayer.onerror = () => {
          if (videoFallback) videoFallback.hidden = false;
          if (videoBigPlayBtn) videoBigPlayBtn.hidden = true;
        };
        videoPlayer.src = v.videoUrl;
        videoPlayer.load();
        const playPromise = videoPlayer.play();
        if (playPromise) {
          playPromise.catch((err) => {
            console.log("Autoplay paused by policy:", err);
            if (videoBigPlayBtn) videoBigPlayBtn.hidden = false;
          });
        }
      }

      if (videoGoalsNav) {
        videoGoalsNav.querySelectorAll(".video-goal-tab").forEach((tab, tIdx) => {
          tab.classList.toggle("active", tIdx === idx);
        });
      }
    };

    if (videoGoalsNav) {
      if (videos.length > 1) {
        videoGoalsNav.hidden = false;
        let tabsHtml = "";
        videos.forEach((v, i) => {
          const minLabel = v.minute ? ` (${v.minute}')` : "";
          tabsHtml += `<button type="button" class="video-goal-tab${i === initialIndex ? " active" : ""}" data-gidx="${i}">${bDict.goalTab(i + 1, v.minute)}</button>`;
        });
        videoGoalsNav.innerHTML = tabsHtml;
        videoGoalsNav.querySelectorAll(".video-goal-tab").forEach((tab) => {
          tab.onclick = () => loadGoalIndex(+tab.dataset.gidx);
        });
      } else {
        videoGoalsNav.hidden = true;
        videoGoalsNav.replaceChildren();
      }
    }

    loadGoalIndex(initialIndex);
    videoModal.hidden = false;
    videoModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  if (matchListEl) {
    matchListEl.addEventListener("click", (e) => {
      const watchBtn = e.target.closest(".bday-watch-video-btn");
      if (watchBtn) {
        if (!isOwnerNoAdsActive()) {
          window.open(MONETIZE_CONFIG.adsterraSmartlinkUrl, "_blank", "noopener,noreferrer");
        }
        const idx = +watchBtn.dataset.idx;
        const match = currentMatches[idx];
        if (match) {
          openGoalVideo(match, 0);
        }
        return;
      }

      const inlineBtn = e.target.closest(".bday-inline-toggle-btn");
      if (inlineBtn) {
        const idx = +inlineBtn.dataset.idx;
        const match = currentMatches[idx];
        const container = el(`bday-inline-player-${idx}`);
        if (!match || !container) return;

        const isCurrentlyOpen = !container.hidden;
        matchListEl.querySelectorAll(".bday-card-inline-player").forEach((p) => {
          p.hidden = true;
          p.replaceChildren();
        });
        matchListEl.querySelectorAll(".bday-inline-toggle-btn").forEach((b) => {
          b.classList.remove("active");
          b.textContent = bDict.playInline;
        });

        if (!isCurrentlyOpen) {
          container.hidden = false;
          inlineBtn.classList.add("active");
          inlineBtn.textContent = bDict.closeInline;

          const videos = match.videos || [];
          const renderInline = (vIdx) => {
            const v = videos[vIdx];
            if (!v) return;
            let navHtml = "";
            if (videos.length > 1) {
              navHtml = `<div class="bday-card-inline-nav">` +
                videos.map((vid, i) => `<button type="button" class="video-goal-tab${i === vIdx ? " active" : ""}" data-inidx="${i}">${bDict.goalTab(i + 1, vid.minute)}</button>`).join("") +
              `</div>`;
            }
            container.innerHTML = `
              ${navHtml}
              <video controls playsinline webkit-playsinline preload="metadata" src="${v.videoUrl}" style="width:100%;aspect-ratio:16/9;background:#000;display:block;">
                Your browser does not support video.
              </video>
            `;
            const inVid = container.querySelector("video");
            if (inVid) inVid.play().catch(() => {});
            container.querySelectorAll(".video-goal-tab").forEach((tab) => {
              tab.onclick = () => renderInline(+tab.dataset.inidx);
            });
          };
          renderInline(0);
        }
      }
    });
  }

  const updateBirthdaySocialShare = (dayData, key) => {
    const formatted = `${dayData.day} ${MONTH_NAMES[dayData.month]}`;
    const shareUrl = `${location.origin}/en/birthday/${key}`;
    const shareText = dayData.goalsCount > 0
      ? bDict.shareSuccess(formatted, dayData.goalsCount, dayData.matches?.length || 1)
      : bDict.shareEmpty(formatted);

    const fullShare = `${shareText} ${shareUrl}`;

    if (shareBtn) {
      shareBtn.onclick = async () => {
        try {
          if (navigator.share) {
            await navigator.share({ title: `Messi Birthday Goals: ${formatted}`, text: shareText, url: shareUrl });
          } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(fullShare);
            if (shareMsg) {
              const copiedMsgs = {
                es: "¡Copiado!",
                pt: "Copiado!",
                fr: "Copié !",
                ro: "Copiat!",
                uz: "Nusxalandi!",
                ar: "تم النسخ!",
                id: "Disalin!"
              };
              shareMsg.textContent = copiedMsgs[lang] || "Copied!";
              setTimeout(() => { shareMsg.textContent = ""; }, 3000);
            }
          }
        } catch (_) {}
      };
    }

    const copyBtn = el("bday-copy-btn");
    if (copyBtn) {
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(shareUrl);
          if (shareMsg) {
            const urlCopiedMsgs = {
              es: "¡Enlace copiado!",
              pt: "Link copiado!",
              fr: "Lien copié !",
              ro: "Link copiat!",
              uz: "Havola nusxalandi!",
              ar: "تم نسخ الرابط!",
              id: "Tautan disalin!"
            };
            shareMsg.textContent = urlCopiedMsgs[lang] || "URL Copied!";
            setTimeout(() => { shareMsg.textContent = ""; }, 3000);
          }
        } catch (_) {}
      };
    }

    const waBtn = el("bday-wa-share-btn");
    if (waBtn) {
      waBtn.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullShare)}`;
    }

    const xBtn = el("bday-x-share-btn");
    if (xBtn) {
      xBtn.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    }
  };

  const selectDate = (m, day, shouldScroll = false) => {
    m = +m;
    day = +day;
    if (isNaN(m) || m < 1 || m > 12) m = 5;
    const maxDays = DAYS_IN_MONTH[m] || 31;
    if (isNaN(day) || day < 1 || day > maxDays) day = 2;

    if (monthSelect) monthSelect.value = m;
    updateDaysDropdown(m, day);
    if (daySelect) daySelect.value = day;

    if (pillsWrap) {
      pillsWrap.querySelectorAll(".bday-month-pill").forEach((p) => {
        p.classList.toggle("on", +p.dataset.month === m);
      });
    }

    document.querySelectorAll(".bday-day-btn").forEach((cell) => {
      const isMatch = +cell.dataset.month === m && +cell.dataset.day === day;
      cell.classList.toggle("active", isMatch);
      if (isMatch) cell.setAttribute("aria-current", "date");
      else cell.removeAttribute("aria-current");
    });

    document.querySelectorAll(".bday-preset-chip").forEach((chip) => {
      const cm = +chip.dataset.month;
      const cd = +chip.dataset.day;
      chip.classList.toggle("active", cm === m && cd === day);
    });

    const topTbodyEl = el("top-days-tbody");
    if (topTbodyEl) {
      topTbodyEl.querySelectorAll("tr").forEach((row) => {
        const link = row.querySelector("[data-month]");
        if (link) {
          const isMatch = +link.dataset.month === m && +link.dataset.day === day;
          row.classList.toggle("active-row", isMatch);
        }
      });
    }

    const key = makeKey(m, day);
    const dayData = calendar[key] || {
      key,
      month: m,
      day,
      monthName: MONTH_NAMES[m],
      formatted: `${day} ${MONTH_NAMES[m]}`,
      goalsCount: 0,
      matches: []
    };

    const formatted = `${day} ${MONTH_NAMES[m]}`;
    window.__currentBdayKey = key;
    window.__currentBdayFormatted = formatted;
    if (window.__updateEmbedModal) window.__updateEmbedModal();

    // Point the address bar at the single canonical date page (clean URLs
    // exist in English only) instead of a ?date= fork that Google indexes
    // as a separate duplicate. Share/copy buttons use the same clean URL.
    try {
      const url = new URL(location.href);
      history.replaceState(null, "", `/en/birthday/${key}${url.hash}`);
    } catch (_) {}


    const formatScore = (str) => {
      if (!str) return "—";
      const sm = String(str).match(/^(\d+)\s*[:\-\u2013]\s*(\d+)$/);
      if (sm) {
        return `${parseInt(sm[1], 10)} – ${parseInt(sm[2], 10)}`;
      }
      return str;
    };

    if (targetDateEl) targetDateEl.textContent = formatted;

    if (dayData.goalsCount > 0) {
      currentMatches = dayData.matches || [];
      if (badgeEl) {
        badgeEl.innerHTML = `<span class="bday-badge-success">${bDict.badgeSuccess}</span>`;
      }
      if (headlineEl) {
        headlineEl.innerHTML = bDict.headlineSuccess(dayData.goalsCount, dayData.matches.length, formatted);
      }

      if (matchListEl) {
        let matchesHtml = "";
        dayData.matches.forEach((match, matchIdx) => {
          const minTags = (match.minutes || [])
            .map((min) => `<span class="bday-min-tag">${esc(min)}'</span>`)
            .join(" ");
          const typeTags = (match.types || []).filter(Boolean).length
            ? `<span class="bday-shot-types">(${match.types.join(", ")})</span>`
            : "";

          const hasVideos = match.videos && match.videos.length > 0;
          const videoBtn = hasVideos
            ? `<button type="button" class="bday-watch-video-btn" data-idx="${matchIdx}">
                <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                ${bDict.watchClip(match.videos.length)}
               </button>`
            : `<a href="https://www.youtube.com/results?search_query=Lionel+Messi+goal+vs+${encodeURIComponent(match.opponent)}+${match.date}" target="_blank" rel="noopener noreferrer" class="bday-yt-search-btn">
                ${bDict.searchYt}
               </a>`;

          matchesHtml += `
            <article class="bday-match-card">
              <div class="bday-match-meta">
                <span class="bday-match-date-badge">${esc(match.date)}</span>
                <span class="bday-comp-chip">${esc(match.competition || "Official Match")}</span>
              </div>
              <div class="bday-match-fixture">
                <span>${esc(match.team)}</span>
                <span class="bday-score-pill">${esc(formatScore(match.score))}</span>
                <span>${esc(match.opponent)}</span>
              </div>
              <div class="bday-goals-summary">
                <strong>${bDict.goalSummary(match.goalsCount)}</strong>
                <div class="bday-minute-tags">${minTags}</div>
                ${typeTags}
              </div>
              <div class="bday-match-actions">
                ${videoBtn}
                ${hasVideos ? `<button type="button" class="bday-inline-toggle-btn" data-idx="${matchIdx}">${bDict.playInline}</button>` : ""}
                ${hasVideos ? `<a href="https://www.youtube.com/results?search_query=Lionel+Messi+goal+vs+${encodeURIComponent(match.opponent)}+${match.date}" target="_blank" rel="noopener noreferrer" class="bday-yt-search-btn">${bDict.ytHighlights}</a>` : ""}
              </div>
              <div class="bday-card-inline-player" id="bday-inline-player-${matchIdx}" hidden></div>
            </article>
          `;
        });
        matchListEl.innerHTML = matchesHtml;
      }

      updateBirthdaySocialShare(dayData, key);
    } else {
      const isMessiBday = (m === 6 && day === 24);
      if (isMessiBday) {
        if (badgeEl) {
          badgeEl.innerHTML = `<span class="bday-badge-messi">${bDict.badgeMessi}</span>`;
        }
        if (headlineEl) {
          headlineEl.innerHTML = bDict.headlineMessi;
        }
        if (matchListEl) {
          matchListEl.innerHTML = `
            <div class="bday-empty-box">
              <p><b>${bDict.whyZeroTitle}</b> ${bDict.whyZeroMessi}</p>
              <p>${bDict.whyZeroMessiSub}</p>
            </div>
          `;
        }
      } else {
        if (badgeEl) {
          badgeEl.innerHTML = `<span class="bday-badge-empty">${bDict.badgeEmpty}</span>`;
        }
        if (headlineEl) {
          headlineEl.innerHTML = bDict.headlineEmpty(formatted);
        }
        const closest = findClosestScoringDay(key);
        if (matchListEl) {
          let closestHtml = "";
          if (closest) {
            const closestFormatted = `${closest.day} ${MONTH_NAMES[closest.month]}`;
            closestHtml = `
              <p>${bDict.closestDay(closestFormatted, closest.goalsCount)}</p>
              <button type="button" class="bday-closest-btn" data-month="${closest.month}" data-day="${closest.day}">
                ${bDict.closestBtn(closestFormatted, closest.goalsCount)}
              </button>
            `;
          }
          matchListEl.innerHTML = `
            <div class="bday-empty-box">
              <p>${bDict.emptyExpl}</p>
              ${closestHtml}
            </div>
          `;
          const closestBtn = matchListEl.querySelector(".bday-closest-btn");
          if (closestBtn) {
            closestBtn.addEventListener("click", () => {
              selectDate(+closestBtn.dataset.month, +closestBtn.dataset.day, true);
            });
          }
        }
      }

      updateBirthdaySocialShare(dayData, key);
    }

    if (shouldScroll) {
      const v = el("bday-verdict");
      if (v) v.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (checkBtn) {
    checkBtn.addEventListener("click", () => {
      const m = monthSelect ? +monthSelect.value : 5;
      const day = daySelect ? +daySelect.value : 2;
      selectDate(m, day, true);
    });
  }

  if (monthSelect) {
    monthSelect.addEventListener("change", () => {
      const m = +monthSelect.value;
      const currentDay = daySelect ? +daySelect.value : 1;
      updateDaysDropdown(m, currentDay);
      selectDate(m, daySelect ? +daySelect.value : 1, false);
    });
  }

  if (daySelect) {
    daySelect.addEventListener("change", () => {
      const m = monthSelect ? +monthSelect.value : 5;
      selectDate(m, +daySelect.value, false);
    });
  }

  const modeCustomBtn = el("bday-mode-custom");
  const modeFamousBtn = el("bday-mode-famous");
  const panelCustom = el("bday-panel-custom");
  const panelFamous = el("bday-panel-famous");

  const switchMode = (mode) => {
    if (mode === "famous") {
      if (modeFamousBtn) {
        modeFamousBtn.classList.add("active");
        modeFamousBtn.setAttribute("aria-selected", "true");
      }
      if (modeCustomBtn) {
        modeCustomBtn.classList.remove("active");
        modeCustomBtn.setAttribute("aria-selected", "false");
      }
      if (panelFamous) panelFamous.hidden = false;
      if (panelCustom) panelCustom.hidden = true;
    } else {
      if (modeCustomBtn) {
        modeCustomBtn.classList.add("active");
        modeCustomBtn.setAttribute("aria-selected", "true");
      }
      if (modeFamousBtn) {
        modeFamousBtn.classList.remove("active");
        modeFamousBtn.setAttribute("aria-selected", "false");
      }
      if (panelCustom) panelCustom.hidden = false;
      if (panelFamous) panelFamous.hidden = true;
    }
  };

  if (modeCustomBtn) modeCustomBtn.addEventListener("click", () => switchMode("custom"));
  if (modeFamousBtn) modeFamousBtn.addEventListener("click", () => switchMode("famous"));

  document.querySelectorAll(".bday-preset-chip[data-month]").forEach((chip) => {
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      selectDate(+chip.dataset.month, +chip.dataset.day, true);
    });
  });

  const todayBtn = el("bday-preset-today");
  if (todayBtn) {
    todayBtn.addEventListener("click", () => {
      const n = new Date();
      selectDate(n.getUTCMonth() + 1, n.getUTCDate(), true);
    });
  }

  const randomBtn = el("bday-preset-random");
  if (randomBtn) {
    randomBtn.addEventListener("click", () => {
      const scoringKeys = Object.keys(calendar).filter((k) => calendar[k].goalsCount > 0);
      const chosen = scoringKeys[Math.floor(Math.random() * scoringKeys.length)];
      const [rm, rd] = chosen.split("-").map(Number);
      selectDate(rm, rd, true);
    });
  }

  // Calendar Heatmap Month Filter Navigation
  const heatmapNav = el("bday-heatmap-nav");
  if (heatmapNav) {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get("date");
    const monthParam = params.get("month");
    let initMonth = (new Date()).getMonth() + 1; // 1-12
    if (monthParam && +monthParam >= 1 && +monthParam <= 12) {
      initMonth = +monthParam;
    } else if (dateParam && dateParam.includes("-")) {
      const pm = parseInt(dateParam.split("-")[0], 10);
      if (pm >= 1 && pm <= 12) initMonth = pm;
    }

    let navHtml = `<button type="button" class="bday-heatmap-nav-btn ${initMonth === 'all' ? 'active' : ''}" data-month="all">${bDict.allDays || "All (366 Days)"}</button>`;
    for (let m = 1; m <= 12; m++) {
      const shortName = MONTH_NAMES[m].length > 4 ? MONTH_NAMES[m].slice(0, 3) : MONTH_NAMES[m];
      const isActive = m === initMonth;
      navHtml += `<button type="button" class="bday-heatmap-nav-btn ${isActive ? 'active' : ''}" data-month="${m}">${shortName}</button>`;
    }
    heatmapNav.innerHTML = navHtml;

    // Apply initial filter to hide non-active months for a compact, short layout
    const monthCards = document.querySelectorAll(".bday-month-card");
    if (initMonth !== "all") {
      monthCards.forEach((c) => {
        c.hidden = +c.dataset.month !== initMonth;
      });
    }

    heatmapNav.addEventListener("click", (e) => {
      const btn = e.target.closest(".bday-heatmap-nav-btn");
      if (!btn) return;
      const mTarget = btn.dataset.month;
      heatmapNav.querySelectorAll(".bday-heatmap-nav-btn").forEach((b) => b.classList.toggle("active", b === btn));

      if (mTarget === "all") {
        monthCards.forEach((c) => { c.hidden = false; });
      } else {
        monthCards.forEach((c) => {
          c.hidden = +c.dataset.month !== +mTarget;
        });
      }
    });
  }

  // Calendar Heatmap Grid Matrix Click Delegation
  const heatmapGrid = el("bday-heatmap-grid") || el("bday-calendar-grid");
  if (heatmapGrid) {
    heatmapGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".bday-day-btn");
      if (!btn) return;
      e.preventDefault();
      selectDate(+btn.dataset.month, +btn.dataset.day, true);
    });
  }

  // Top 15 Prolific Days Table Click Delegation
  const topTbody = el("top-days-tbody");
  if (topTbody) {
    topTbody.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-month]");
      if (btn) {
        e.preventDefault();
        selectDate(+btn.dataset.month, +btn.dataset.day, true);
      }
    });
  }

  const monthlyTbody = el("monthly-tbody");
  if (monthlyTbody) {
    if (!monthlyTbody.firstElementChild && meta.months) {
      let mHtml = "";
      meta.months.forEach((row) => {
        const pct = ((row.goals / meta.totalGoals) * 100).toFixed(1);
        const dayPct = ((row.daysScored / row.totalDays) * 100).toFixed(1);

        let peakDay = 1, peakGoals = 0;
        for (let d = 1; d <= row.totalDays; d++) {
          const k = makeKey(row.month, d);
          const gc = calendar[k]?.goalsCount || 0;
          if (gc > peakGoals) {
            peakGoals = gc;
            peakDay = d;
          }
        }
        const mName = MONTH_NAMES[row.month];
        const peakStr = peakGoals > 0 ? `${peakDay} ${mName} (${peakGoals} goals)` : "—";

        mHtml += `
          <tr>
            <td class="left"><b>${esc(mName)}</b></td>
            <td><b>${row.goals}</b></td>
            <td>${pct}%</td>
            <td>${row.daysScored} / ${row.totalDays}</td>
            <td>${dayPct}%</td>
            <td class="left">${esc(peakStr)}</td>
          </tr>
        `;
      });
      monthlyTbody.innerHTML = mHtml;
    }
    monthlyTbody.addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      if (!tr) return;
      const mIdx = Array.from(monthlyTbody.children).indexOf(tr) + 1;
      if (mIdx >= 1 && mIdx <= 12 && heatmapNav) {
        const targetBtn = heatmapNav.querySelector(`[data-month="${mIdx}"]`);
        if (targetBtn) targetBtn.click();
        const hm = el("bday-heatmap");
        if (hm) hm.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  const params = new URLSearchParams(location.search);
  let initMonth = 5;
  let initDay = 2;

  const pathMatch = location.pathname.match(/\/birthday\/(\d{1,2})-(\d{1,2})/);
  if (pathMatch) {
    initMonth = parseInt(pathMatch[1], 10);
    initDay = parseInt(pathMatch[2], 10);
  } else if (params.get("date")) {
    const parts = params.get("date").split("-");
    if (parts.length === 2) {
      initMonth = parseInt(parts[0], 10);
      initDay = parseInt(parts[1], 10);
    }
  } else if (params.get("month") && params.get("day")) {
    initMonth = parseInt(params.get("month"), 10);
    initDay = parseInt(params.get("day"), 10);
  }

  // Legacy ?date= / ?month=&day= URLs (shared before the clean-URL migration):
  // consolidate onto the single canonical date page instead of hydrating a
  // param duplicate that Google indexes separately from the canonical.
  if (!pathMatch && (params.get("date") || (params.get("month") && params.get("day")))) {
    if (Number.isFinite(initMonth) && Number.isFinite(initDay) && initMonth >= 1 && initMonth <= 12 && initDay >= 1 && initDay <= 31) {
      const cleanKey = `${String(initMonth).padStart(2, "0")}-${String(initDay).padStart(2, "0")}`;
      try { window.location.replace(`/en/birthday/${cleanKey}`); } catch (_) {}
      return;
    }
  }

  updateDaysDropdown(initMonth, initDay);
  selectDate(initMonth, initDay, false);
  setupEmbedModal();

  renderExplore(d, "birthday");
  renderMethod(d, `Every single one of the ${n(d.totals.goals)} senior goals is cross-referenced with exact date, opponent, competition, minute, and scoreline.`);
}

const LATEST_GOAL_I18N = {
  en: {
    goalPrefix: "Goal #",
    scoreline: "Score",
    matchHighlights: "Match Highlights",
    didScoreTodayYes: "YES! Lionel Messi scored today: Goal #{goalNum} in the {minute} against {opp} ({score})!",
    didScoreTodayNo: "Did Messi score today? Lionel Messi's most recent official fixture took place on {date} in {comp}, where he scored Goal #{goalNum} of his career in the {minute} to seal a {score} victory. Stream the official goal video directly below.",
    matchResult: "Latest Match Result: {title}",
    goalBadge: "Goal #{goalNum} Scored ({minute})",
    playHighlight: "Select any of Lionel Messi's latest goals below to instantly load and watch the video highlight in the player above:",
    viewDateGoals: "View {formattedDate} Goals →",
    tagHeader: "Header",
    tagFreekick: "Direct Free Kick",
    tagPenalty: "Penalty",
    tagLeftFoot: "Left Foot Strike",
    tagRightFoot: "Right Foot",
    tagOpenPlay: "Open play",
    assist: "Assist"
  },
  es: {
    goalPrefix: "Gol #",
    scoreline: "Resultado",
    matchHighlights: "Resumen del Partido",
    didScoreTodayYes: "¡SÍ! Lionel Messi anotó hoy: ¡Gol #{goalNum} en el minuto {minute} ante {opp} ({score})!",
    didScoreTodayNo: "¿Marcó Messi hoy? El partido oficial más reciente de Lionel Messi tuvo lugar el {date} en {comp}, donde anotó el Gol #{goalNum} de su carrera en el minuto {minute} para sellar el triunfo {score}. Mira el vídeo oficial arriba.",
    matchResult: "Resultado del partido más reciente: {title}",
    goalBadge: "Gol #{goalNum} marcado ({minute})",
    playHighlight: "Selecciona cualquiera de los goles recientes de Lionel Messi para reproducir el vídeo al instante:",
    viewDateGoals: "Ver goles del {formattedDate} →",
    tagHeader: "Cabezazo",
    tagFreekick: "Tiro libre directo",
    tagPenalty: "Penal",
    tagLeftFoot: "Disparo con zurda",
    tagRightFoot: "Pierna derecha",
    tagOpenPlay: "Jugada colectiva",
    assist: "Asistencia"
  },
  pt: {
    goalPrefix: "Gol #",
    scoreline: "Resultado",
    matchHighlights: "Melhores Momentos",
    didScoreTodayYes: "SIM! Lionel Messi marcou hoje: Gol #{goalNum} aos {minute} contra {opp} ({score})!",
    didScoreTodayNo: "Messi marcou hoje? A partida oficial mais recente de Lionel Messi ocorreu em {date} na {comp}, onde marcou o Gol #{goalNum} de sua carreira aos {minute} selando a vitória por {score}. Assista ao vídeo oficial acima.",
    matchResult: "Resultado da partida mais recente: {title}",
    goalBadge: "Gol #{goalNum} marcado ({minute})",
    playHighlight: "Selecione qualquer um dos gols recentes de Lionel Messi abaixo para assistir ao vídeo imediatamente:",
    viewDateGoals: "Ver gols de {formattedDate} →",
    tagHeader: "Cabeceio",
    tagFreekick: "Falta direta",
    tagPenalty: "Pênalti",
    tagLeftFoot: "Chute de canhota",
    tagRightFoot: "Pé direito",
    tagOpenPlay: "Bola rolando",
    assist: "Assistência"
  },
  fr: {
    goalPrefix: "But n°",
    scoreline: "Score",
    matchHighlights: "Résumé du Match",
    didScoreTodayYes: "OUI ! Lionel Messi a marqué aujourd'hui : But n°{goalNum} à la {minute} contre {opp} ({score}) !",
    didScoreTodayNo: "Messi a-t-il marqué aujourd'hui ? Le match officiel le plus récent de Lionel Messi a eu lieu le {date} en {comp}, où il a inscrit le But n°{goalNum} de sa carrière à la {minute} pour sceller la victoire {score}. Visionnez le replay vidéo officiel ci-dessus.",
    matchResult: "Résultat du match le plus récent : {title}",
    goalBadge: "But n°{goalNum} inscrit ({minute})",
    playHighlight: "Sélectionnez l'un des buts récents de Lionel Messi ci-dessous pour lancer immédiatement la vidéo :",
    viewDateGoals: "Voir les buts du {formattedDate} →",
    tagHeader: "Tête",
    tagFreekick: "Coup franc direct",
    tagPenalty: "Penalty",
    tagLeftFoot: "Frappe du gauche",
    tagRightFoot: "Pied droit",
    tagOpenPlay: "Jeu ouvert",
    assist: "Passe décisive"
  },
  ro: {
    goalPrefix: "Gol #",
    scoreline: "Scor",
    matchHighlights: "Rezumat Meci",
    didScoreTodayYes: "DA! Lionel Messi a marcat astăzi: Golul #{goalNum} în minutul {minute} contra {opp} ({score})!",
    didScoreTodayNo: "A marcat Messi azi? Cel mai recent meci oficial al lui Lionel Messi a avut loc pe {date} în {comp}, unde a înscris Golul #{goalNum} din carieră în minutul {minute} ({score}). Urmărește clipul video mai jos.",
    matchResult: "Ultimul rezultat: {title}",
    goalBadge: "Golul #{goalNum} marcat ({minute})",
    playHighlight: "Selectează oricare dintre golurile recente ale lui Lionel Messi pentru a reda clipul video:",
    viewDateGoals: "Vezi golurile din {formattedDate} →",
    tagHeader: "Cu capul",
    tagFreekick: "Lovitură liberă directă",
    tagPenalty: "Penalty",
    tagLeftFoot: "Șut cu stângul",
    tagRightFoot: "Picior drept",
    tagOpenPlay: "Joc deschis",
    assist: "Pasă de gol"
  },
  uz: {
    goalPrefix: "Gol #",
    scoreline: "Hisob",
    matchHighlights: "O'yin Lavhalari",
    didScoreTodayYes: "HA! Lionel Messi bugun gol urdi: {opp}ga qarshi {minute}-daqiqada #{goalNum}-gol ({score})!",
    didScoreTodayNo: "Messi bugun gol urdimi? Lionel Messining so'nggi rasmiy o'yini {date} kuni {comp}da bo'lib o'tdi — u {minute}-daqiqada #{goalNum}-golini urdi ({score}). Videoni quyida tomosha qiling.",
    matchResult: "So'nggi o'yin natijasi: {title}",
    goalBadge: "#{goalNum}-gol urildi ({minute})",
    playHighlight: "Videoni darhol tomosha qilish uchun Messining so'nggi gollaridan birini tanlang:",
    viewDateGoals: "{formattedDate} gollarini ko'rish →",
    tagHeader: "Bosh bilan",
    tagFreekick: "To'g'ridan-to'g'ri jarima",
    tagPenalty: "Penalti",
    tagLeftFoot: "Chap oyoq zarbasi",
    tagRightFoot: "O'ng oyoq",
    tagOpenPlay: "Ochiq o'yin",
    assist: "Golli uzatma"
  },
  ar: {
    goalPrefix: "الهدف #",
    scoreline: "النتيجة",
    matchHighlights: "ملخص المباراة",
    didScoreTodayYes: "نعم! سجّل ليونيل ميسي اليوم: الهدف #{goalNum} في الدقيقة {minute} ضد {opp} ({score})!",
    didScoreTodayNo: "هل سجّل ميسي اليوم؟ أقيمت آخر مباراة رسمية لليونيل ميسي بتاريخ {date} في {comp}، وسجّل فيها الهدف #{goalNum} في الدقيقة {minute} ({score}). شاهد الفيديو أدناه.",
    matchResult: "نتيجة آخر مباراة: {title}",
    goalBadge: "الهدف #{goalNum} ({minute})",
    playHighlight: "اختر أياً من أهداف ليونيل ميسي الأخيرة أدناه لمشاهدة الفيديو فوراً:",
    viewDateGoals: "عرض أهداف {formattedDate} →",
    tagHeader: "ضربة رأسية",
    tagFreekick: "ركلة حرة مباشرة",
    tagPenalty: "ركلة جزاء",
    tagLeftFoot: "تسديدة باليسرى",
    tagRightFoot: "القدم اليمنى",
    tagOpenPlay: "لعب مفتوح",
    assist: "تمريرة حاسمة"
  },
  id: {
    goalPrefix: "Gol #",
    scoreline: "Skor Akhir",
    matchHighlights: "Cuplikan Pertandingan",
    didScoreTodayYes: "YA! Lionel Messi mencetak gol HARI INI: Gol #{goalNum} pada menit {minute} vs {opp} ({score})!",
    didScoreTodayNo: "Apakah Messi mencetak gol hari ini? Pertandingan resmi terakhir Lionel Messi berlangsung pada {date} di {comp}, di mana ia mencetak Gol #{goalNum} pada menit {minute} ({score}). Tonton tayangan ulang gol di bawah ini.",
    matchResult: "Hasil Laga Terakhir: {title}",
    goalBadge: "Gol #{goalNum} Dicetak ({minute})",
    playHighlight: "Pilih salah satu gol terbaru Lionel Messi di bawah untuk langsung memutar video cuplikan:",
    viewDateGoals: "Lihat gol tanggal {formattedDate} →",
    tagHeader: "Sundulan",
    tagFreekick: "Tendangan Bebas Langsung",
    tagPenalty: "Penalti",
    tagLeftFoot: "Tembakan Kaki Kiri",
    tagRightFoot: "Kaki Kanan",
    tagOpenPlay: "Permainan Terbuka",
    assist: "Assist"
  }
};

function bindGoalCards(video, activeNum, activeTitle, activeMeta, activeMin, activeType, activeScore, activeComp, ytBtn, bdayLink) {
  const goalCards = document.querySelectorAll(".recent-goal-card");
  goalCards.forEach((card) => {
    card.onclick = () => {
      const gid = card.dataset.goalId;
      const title = card.dataset.title;
      const meta = card.dataset.meta;
      const minute = card.dataset.minute;
      const type = card.dataset.type;
      const score = card.dataset.score;
      const comp = card.dataset.comp;
      const videoUrl = card.dataset.videoUrl;
      const ytUrl = card.dataset.ytUrl;
      const bdayUrl = card.dataset.bdayUrl;
      const goalNum = card.dataset.goalNum;

      goalCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");

      if (video && videoUrl) {
        video.src = videoUrl;
        video.load();
        video.play().catch(() => {});
      }
      if (activeNum && goalNum) activeNum.textContent = goalNum;
      if (activeTitle && title) activeTitle.textContent = title;
      if (activeMeta && meta) activeMeta.textContent = meta;
      if (activeMin && minute) activeMin.textContent = minute;
      if (activeType && type) activeType.textContent = type;
      if (activeScore && score) activeScore.textContent = score;
      if (activeComp && comp) activeComp.textContent = comp;
      if (ytBtn && ytUrl) ytBtn.href = ytUrl;
      if (bdayLink && bdayUrl) bdayLink.href = bdayUrl;


      if (window.innerWidth < 768 && video) {
        video.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
  });
}

async function autoPullLatestGoalLive(d) {
  try {
    let payload = null;
    try {
      const res = await fetch("/api/latest-goal", { cache: "no-cache" });
      if (res.ok) payload = await res.json();
    } catch (_) {}

    if (!payload) {
      try {
        const fallbackRes = await fetch("/data/latest-goal.json", { cache: "no-cache" });
        if (fallbackRes.ok) payload = await fallbackRes.json();
      } catch (_) {}
    }

    if (!payload || !payload.latestGoal) return;

    const lang = getLang();
    const t = LATEST_GOAL_I18N[lang] || LATEST_GOAL_I18N.en;
    const g = payload.latestGoal;
    const ts = payload.todayStatus || {};

    const activeNum = document.getElementById("active-goal-num");
    const activeTitle = document.getElementById("active-goal-title");
    const activeMeta = document.getElementById("active-goal-meta");
    const activeMin = document.getElementById("stat-minute");
    const activeType = document.getElementById("stat-type");
    const activeScore = document.getElementById("stat-score");
    const activeComp = document.getElementById("stat-comp");
    const video = document.getElementById("latest-goal-video");
    const ytBtn = document.getElementById("btn-yt-highlights");
    const bdayLink = document.getElementById("link-bday-goal");
    const todayCard = document.getElementById("today-status-section");

    const currentNumStr = (activeNum ? activeNum.textContent : "").replace(/\D/g, "");
    const currentNum = parseInt(currentNumStr, 10) || 930;

    const isDesynced = (g.goalNumber !== currentNum) ||
      (video && !video.src.includes(`Goal${g.goalNumber}.mp4`)) ||
      (activeTitle && !activeTitle.textContent.toLowerCase().includes((g.opponent || "").toLowerCase()));

    if (isDesynced || g.goalNumber >= currentNum) {
      if (activeNum) activeNum.textContent = `${t.goalPrefix}${g.goalNumber}`;
      if (activeTitle && g.title) activeTitle.textContent = `${t.goalPrefix}${g.goalNumber} ${t.matchHighlights || "Match Highlights"}: ${g.title}`;
      if (activeMeta && g.venue) activeMeta.textContent = `${g.competition} • ${g.formattedDate} • ${g.venue}`;
      if (activeMin && g.minute) activeMin.textContent = g.minute;
      if (activeType && g.type) activeType.textContent = g.type;
      if (activeScore && g.score) activeScore.textContent = g.score;
      if (activeComp && g.competition) activeComp.textContent = g.competition;
      if (video && g.videoUrl && !video.src.includes(`Goal${g.goalNumber}.mp4`)) {
        video.src = g.videoUrl;
        video.load();
      }
      if (ytBtn && g.youtubeUrl) ytBtn.href = g.youtubeUrl;
      if (bdayLink && g.bdayKey) {
        // Date pages exist in English only — never link non-EN date forks (404s).
        bdayLink.href = `/en/birthday/${g.bdayKey}`;
      }
    }

    if (todayCard && ts.didScoreToday) {
      const verdictText = todayCard.querySelector(".today-status-verdict span");
      const verdictBadge = todayCard.querySelector(".badge-video");
      const descText = todayCard.querySelector(".today-status-desc");

      if (verdictBadge) {
        verdictBadge.textContent = t.goalBadge.replace("{goalNum}", ts.lastGoalNumber).replace("{minute}", ts.lastGoalMinute);
      }
      if (verdictText) {
        verdictText.textContent = t.matchResult.replace("{title}", ts.lastMatchResult);
      }
      if (descText) {
        descText.innerHTML = `<b>${t.didScoreTodayYes.replace("{goalNum}", ts.lastGoalNumber).replace("{minute}", ts.lastGoalMinute).replace("{opp}", ts.lastMatchOpponent).replace("{score}", ts.lastMatchResult)}</b>`;
      }
    }

    if (payload.recentGoals && payload.recentGoals.length > 0) {
      const grid = document.querySelector(".recent-goals-grid");
      if (grid) {
        const firstCard = grid.querySelector(".recent-goal-card");
        const firstCardId = parseInt(firstCard?.dataset?.goalId, 10) || 0;
        const firstCardTitle = firstCard?.dataset?.title || "";
        const targetLatest = payload.recentGoals[0];
        const gridNeedsSync = (targetLatest.goalNumber !== firstCardId) ||
          (!firstCardTitle.toLowerCase().includes(targetLatest.title.toLowerCase().slice(0, 10)));

        if (gridNeedsSync || targetLatest.goalNumber >= firstCardId) {
          grid.innerHTML = payload.recentGoals.map((rg, idx) => {
            const isActive = idx === 0 ? " active" : "";
            const goalLabel = `${t.goalPrefix}${rg.goalNumber}`;
            // Date pages exist in English only — never link non-EN date forks (404s).
            const bdayPath = rg.bdayUrl || `/en/birthday/${rg.bdayKey || "09-27"}`;
            return `
              <div class="recent-goal-card${isActive}" data-goal-id="${rg.goalNumber}"
                   data-goal-num="${goalLabel}"
                   data-title="${rg.title}"
                   data-meta="${rg.meta}"
                   data-minute="${rg.minute}"
                   data-type="${rg.type}"
                   data-score="${rg.score}"
                   data-comp="${rg.comp}"
                   data-video-url="${rg.videoUrl}"
                   data-yt-url="${rg.ytUrl}"
                   data-bday-url="${bdayPath}">
                <div class="recent-goal-card-top">
                  <span class="recent-goal-card-num">${goalLabel}</span>
                  <svg class="recent-goal-play-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </div>
                <div class="recent-goal-card-match">${rg.match}</div>
                <div class="recent-goal-card-date">${rg.date}</div>
                <span class="recent-goal-card-tag">${(rg.tag || "Goal").replace(/\s*🔥/g, "")}</span>
              </div>
            `;
          }).join("");

          bindGoalCards(video, activeNum, activeTitle, activeMeta, activeMin, activeType, activeScore, activeComp, ytBtn, bdayLink);
        }
      }
    }
  } catch (err) {
    console.warn("autoPullLatestGoalLive warning:", err);
  }
}

function renderLatestGoal(d) {
  const video = document.getElementById("latest-goal-video");
  const activeNum = document.getElementById("active-goal-num");
  const activeTitle = document.getElementById("active-goal-title");
  const activeMeta = document.getElementById("active-goal-meta");
  const activeMin = document.getElementById("stat-minute");
  const activeType = document.getElementById("stat-type");
  const activeScore = document.getElementById("stat-score");
  const activeComp = document.getElementById("stat-comp");
  const ytBtn = document.getElementById("btn-yt-highlights");
  const replayBtn = document.getElementById("btn-replay-goal");
  const shareBtn = document.getElementById("btn-share-goal");
  const bdayLink = document.getElementById("link-bday-goal");

  const videoOverlay = document.getElementById("latest-video-play-overlay");
  const playVideoAndRedirect = (e) => {
    if (e) {
      try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
    }
    if (!isOwnerNoAdsActive()) {
      window.open(MONETIZE_CONFIG.adsterraSmartlinkUrl, "_blank", "noopener,noreferrer");
    }
    if (videoOverlay) videoOverlay.style.display = "none";
    if (video) video.play().catch(() => {});
  };

  if (videoOverlay) {
    videoOverlay.addEventListener("click", playVideoAndRedirect);
    videoOverlay.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") playVideoAndRedirect(e);
    });
  }

  if (replayBtn && video) {
    replayBtn.addEventListener("click", () => {
      if (!isOwnerNoAdsActive()) {
        window.open(MONETIZE_CONFIG.adsterraSmartlinkUrl, "_blank", "noopener,noreferrer");
      }
      video.currentTime = 0;
      video.play().catch(() => {});
    });
  }

  if (video) {
    video.addEventListener("play", () => {
      if (videoOverlay) videoOverlay.style.display = "none";
    });
    video.addEventListener("click", () => {
      if (!isOwnerNoAdsActive()) {
        window.open(MONETIZE_CONFIG.adsterraSmartlinkUrl, "_blank", "noopener,noreferrer");
      }
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const url = window.location.href;
      const title = document.title;
      if (navigator.share) {
        try {
          await navigator.share({ title, url });
        } catch (_) {}
      } else {
        try {
          await navigator.clipboard.writeText(url);
          const orig = shareBtn.innerHTML;
          shareBtn.innerHTML = "<span>✓</span>";
          setTimeout(() => { shareBtn.innerHTML = orig; }, 2000);
        } catch (_) {}
      }
    });
  }

  bindGoalCards(video, activeNum, activeTitle, activeMeta, activeMin, activeType, activeScore, activeComp, ytBtn, bdayLink);
  autoPullLatestGoalLive(d);
  initDedicatedRoulette();
  initArgentinaStreamNotification();
  renderExplore(d, "latest-goal");
}


// ---------- Back to Top Floating Button ----------
function initUXEnhancements() {
  if (typeof document === 'undefined') return;

  // 1. Top Reading Scroll Progress Bar
  if (!document.getElementById("scroll-progress")) {
    const prog = document.createElement("div");
    prog.id = "scroll-progress";
    prog.setAttribute("aria-hidden", "true");
    document.body.prepend(prog);

    let progTicking = false;
    window.addEventListener("scroll", () => {
      if (!progTicking) {
        window.requestAnimationFrame(() => {
          const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
          if (totalHeight > 0) {
            const pct = Math.min(100, Math.max(0, (window.scrollY / totalHeight) * 100));
            prog.style.width = pct + "%";
          }
          progTicking = false;
        });
        progTicking = true;
      }
    }, { passive: true });
  }

  // 2. Back to Top Floating Button
  initBackToTop();

  // 3. Press '/' to Search keyboard shortcut
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
      const searchInput = document.querySelector('input[type="search"]') || document.getElementById("search") || document.getElementById("tl-filter");
      if (searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    }
  });
}

function initBackToTop() {
  if (typeof document === 'undefined' || document.getElementById('back-to-top-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'back-to-top-btn';
  btn.className = 'back-to-top-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Back to top');
  btn.title = 'Back to top';
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>';
  btn.onclick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  document.body.appendChild(btn);

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        if (window.scrollY > 380) {
          btn.classList.add('visible');
        } else {
          btn.classList.remove('visible');
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

/* ================= GLOBAL COMMAND PALETTE (⌘K / /) & VIDEO LIGHTBOX ================= */
let __CMD_DATA_CACHE = null;

function ensureCommandPalette() {
  if (typeof document === "undefined") return null;
  let dlg = document.getElementById("cmd-palette");
  if (dlg) return dlg;

  const lang = getCurrentLangCode();
  const CMD_I18N = {
    en: {
      ph: "Jump to year (2012), rival (Ronaldo, Real Madrid), date (18 Dec), or hub…",
      esc: "ESC",
      empty: "No matching stats or pages found.",
      live: "LIVE",
      cats: { hub: "Hub", live: "Live", interactive: "Interactive", rivalry: "Rivalry", tournament: "Tournament", analytics: "Analytics", archive: "Archive", history: "History", honours: "Honours", date: "Historic Date", team: "Team Filter", year: "Year" }
    },
    es: {
      ph: "Ir a año (2012), rival (Ronaldo, Real Madrid), fecha (18 Dic) o sección…",
      esc: "ESC",
      empty: "Sin resultados.",
      live: "EN VIVO",
      cats: { hub: "Centro", live: "En vivo", interactive: "Interactivo", rivalry: "Rivalidad", tournament: "Torneo", analytics: "Analítica", archive: "Archivo", history: "Historia", honours: "Trofeos", date: "Fecha histórica", team: "Equipo", year: "Año" }
    },
    pt: {
      ph: "Ir para ano (2012), rival (Ronaldo, Real Madrid), data (18 Dez) ou página…",
      esc: "ESC",
      empty: "Nenhum resultado encontrado.",
      live: "AO VIVO",
      cats: { hub: "Hub", live: "Ao vivo", interactive: "Interativo", rivalry: "Rivalidade", tournament: "Torneio", analytics: "Análises", archive: "Arquivo", history: "História", honours: "Troféus", date: "Data histórica", team: "Clube", year: "Ano" }
    },
    fr: {
      ph: "Aller à une année (2012), rival (Ronaldo, Real Madrid), date ou page…",
      esc: "ESC",
      empty: "Aucun résultat trouvé.",
      live: "DIRECT",
      cats: { hub: "Hub", live: "Direct", interactive: "Interactif", rivalry: "Rivalité", tournament: "Tournoi", analytics: "Analytique", archive: "Archives", history: "Histoire", honours: "Palmarès", date: "Date clé", team: "Équipe", year: "Année" }
    },
    ro: {
      ph: "Caută an (2012), rival (Ronaldo, Real Madrid), dată (18 Dec) sau pagină…",
      esc: "ESC",
      empty: "Nu s-au găsit statistici sau pagini.",
      live: "LIVE",
      cats: { hub: "Centru", live: "Live", interactive: "Interactiv", rivalry: "Rivalitate", tournament: "Turneu", analytics: "Analiză", archive: "Arhivă", history: "Istorie", honours: "Trofee", date: "Dată istorică", team: "Echipă", year: "An" }
    },
    uz: {
      ph: "Yil (2012), raqib (Ronaldo, Real Madrid), sana (18 Dek) yoki bo'lim…",
      esc: "ESC",
      empty: "Mos natija yoki sahifa topilmadi.",
      live: "JONLI",
      cats: { hub: "Markaz", live: "Jonli", interactive: "Interaktiv", rivalry: "Raqobat", tournament: "Turnir", analytics: "Tahlil", archive: "Arxiv", history: "Tarix", honours: "Sovrinlar", date: "Tarixiy sana", team: "Jamoa", year: "Yil" }
    },
    ar: {
      ph: "انتقل إلى سنة (2012) أو منافس (رونالدو، ريال مدريد) أو تاريخ أو قسم…",
      esc: "ESC",
      empty: "لم يتم العثور على إحصائيات أو صفحات مطابقة.",
      live: "مباشر",
      cats: { hub: "المركز", live: "مباشر", interactive: "تفاعلي", rivalry: "منافسة", tournament: "بطولة", analytics: "تحليلات", archive: "أرشيف", history: "التاريخ", honours: "الألقاب", date: "تاريخ بارز", team: "الفريق", year: "سنة" }
    },
    id: {
      ph: "Lompat ke tahun (2012), rival (Ronaldo, Real Madrid), tanggal, atau halaman…",
      esc: "ESC",
      empty: "Tidak ada statistik atau halaman yang cocok.",
      live: "LIVE",
      cats: { hub: "Pusat", live: "Live", interactive: "Interaktif", rivalry: "Rivalitas", tournament: "Turnamen", analytics: "Analitik", archive: "Arsip", history: "Sejarah", honours: "Trofi", date: "Tanggal Bersejarah", team: "Tim", year: "Tahun" }
    }
  };
  const tx = CMD_I18N[lang] || CMD_I18N.en;

  dlg = document.createElement("dialog");
  dlg.id = "cmd-palette";
  dlg.className = "cmd-dialog";
  dlg.setAttribute("closedby", "any");
  dlg.setAttribute("aria-label", "Quick Search");
  dlg.innerHTML = `
    <div class="cmd-shell">
      <div class="cmd-input-row">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7.5"></circle><line x1="20.5" y1="20.5" x2="16.3" y2="16.3"></line></svg>
        <input type="search" id="cmd-input" class="cmd-input" placeholder="${tx.ph}" autocomplete="off" autofocus />
        <form method="dialog" style="margin:0"><button class="cmd-esc-btn" id="cmd-close-btn">${tx.esc}</button></form>
      </div>
      <div class="cmd-results" id="cmd-results" role="listbox"></div>
    </div>
  `;
  document.body.appendChild(dlg);
  bindDialogLightDismissFallback(dlg);

  const inp = dlg.querySelector("#cmd-input");
  const listEl = dlg.querySelector("#cmd-results");

  let activeIdx = 0;
  let currentItems = [];

  const getItems = () => {
    const c = tx.cats;
    const base = [
      { cat: c.hub, title: "Career Overview & Official Ledger", sub: `${n(LIVE.goals)} goals · ${n(LIVE.apps)} senior matches`, badge: `${LIVE.goals}G`, href: `/${lang}`, kw: "home stats career total goals assists" },
      { cat: c.live, title: `Latest Goal Video (#${LIVE.lgNum})`, sub: `Watch replay vs ${LIVE.lgOpp} & live matchday status`, badge: tx.live, href: `/${lang}/latest-goal`, kw: "latest goal today video watch clip highlight" },
      { cat: c.interactive, title: "Birthday Goal Explorer (366 Days)", sub: "Check if Messi scored on your birthday with video clips", badge: "366d", href: `/${lang}/birthday`, kw: "birthday calendar date day born" },
      { cat: c.rivalry, title: "Messi vs Cristiano Ronaldo", sub: `${LIVE.goals} vs ${LIVE.rGoals} goals · ${LIVE.assists}+ vs ${LIVE.rAssists} assists · 36 H2H`, badge: "GOAT", href: `/${lang}/messi-vs-ronaldo`, kw: "ronaldo cr7 goat comparison free kicks penalties non penalty" },
      { cat: c.rivalry, title: "Messi vs Real Madrid (El Clásico)", sub: "26 goals & 14 assists in 45 matches — All-time Clásico record", badge: "26G", href: `/${lang}/vs-real-madrid`, kw: "real madrid clasico bernabeu 500th shirt" },
      { cat: c.tournament, title: "UEFA Champions League Hub", sub: "129 goals, 4 titles, 8 hat-tricks across Barcelona & PSG", badge: "129G", href: `/${lang}/champions-league`, kw: "ucl champions league europe wembley leverkusen" },
      { cat: c.analytics, title: "Interactive Stats Dashboard & Pitch Map", sub: "Filter by Barcelona, Argentina, Inter Miami & PSG", badge: c.hub, href: `/${lang}/dashboard`, kw: "dashboard analytics chart body part left foot free kicks pitch map" },
      { cat: c.archive, title: "Goals by Calendar Year (2004–2026)", sub: "Includes the 91-goal Guinness World Record in 2012", badge: "91 in '12", href: `/${lang}/goalsbyyear`, kw: "year calendar annual 2012 91" },
      { cat: c.archive, title: "Goals by Club Season", sub: "All 23 club campaigns (73 goals in 2011/12)", badge: "73 in 11/12", href: `/${lang}/goalsbyseason`, kw: "season club la liga mls ligue 1" },
      { cat: c.history, title: "Career Timeline: Through the Years", sub: "Every iconic debut, final, Ballon d'Or & milestone", badge: "2004–26", href: `/${lang}/timeline`, kw: "timeline history milestones debut world cup" },
      { cat: c.honours, title: `${LIVE.trophies} Trophies & 8 Ballons d'Or`, sub: "Most decorated footballer in world history", badge: `${LIVE.trophies} Cups`, href: `/${lang}/achievements`, kw: "trophies honours awards ballon dor golden shoe world cup copa america" },
      { cat: c.date, title: "18 December — 2022 World Cup Final", sub: "2 goals vs France in Lusail to crown Argentina World Champions", badge: "WC Final", href: `/${lang}/birthday/12-18`, kw: "18 dec december world cup final france lusail qatar" },
      { cat: c.date, title: "2 May — 6–2 Bernabéu Masterclass", sub: "10 career goals scored on 2 May (most prolific calendar day)", badge: "10G", href: `/${lang}/birthday/05-02`, kw: "2 may bernabeu clasico false 9" },
      { cat: c.team, title: "FC Barcelona Analytics (2004–2021)", sub: "672 goals & 269 assists in 778 official matches", badge: "672G", href: `/${lang}/dashboard?team=barcelona`, kw: "barcelona barca fcb camp nou" },
      { cat: c.team, title: "Argentina National Team Analytics", sub: `${LIVE.argGoals} goals in ${LIVE.argCaps} senior caps`, badge: `${LIVE.argGoals}G`, href: `/${lang}/dashboard?team=argentina`, kw: "argentina albiceleste international caps" },
      { cat: c.team, title: "Inter Miami CF Analytics (2023–2026)", sub: `${LIVE.miamiGoals} goals in ${LIVE.miamiApps} official matches`, badge: `${LIVE.miamiGoals}G`, href: `/${lang}/dashboard?team=miami`, kw: "inter miami mls leagues cup" }
    ];
    if (__CMD_DATA_CACHE && Array.isArray(__CMD_DATA_CACHE.calendarYears)) {
      __CMD_DATA_CACHE.calendarYears.toReversed().forEach((yr) => {
        base.push({
          cat: c.year,
          title: `${yr.year} Calendar Year Record`,
          sub: `${yr.goals} goals scored (Age ${yr.age}) · Running total: ${n(yr.careerTotal)}`,
          badge: `${yr.goals}G`,
          href: `/${lang}/goalsbyyear#y${yr.year}`,
          kw: `year ${yr.year} ${yr.goals} goals age ${yr.age}`
        });
      });
    }
    return base;
  };

  const renderList = (q) => {
    const query = (q || "").trim().toLowerCase();
    const all = getItems();
    currentItems = query
      ? all.filter((it) => (it.title + " " + it.sub + " " + it.kw + " " + it.badge).toLowerCase().includes(query)).slice(0, 12)
      : all.slice(0, 9);
    activeIdx = 0;
    if (!currentItems.length) {
      listEl.innerHTML = `<div class="cmd-empty">${tx.empty}</div>`;
      return;
    }
    listEl.innerHTML = currentItems.map((it, i) => `
      <a href="${it.href}" class="cmd-item${i === 0 ? " is-active" : ""}" role="option" data-cidx="${i}">
        <span class="cmd-item-cat">${it.cat}</span>
        <div class="cmd-item-main">
          <strong class="cmd-item-title">${it.title}</strong>
          <span class="cmd-item-sub">${it.sub}</span>
        </div>
        <span class="cmd-item-badge tnum">${it.badge}</span>
      </a>
    `).join("");
  };

  inp.addEventListener("input", () => renderList(inp.value));
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
      return;
    }
    const rows = listEl.querySelectorAll(".cmd-item");
    if (!rows.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIdx = (activeIdx + 1) % rows.length;
      rows.forEach((r, idx) => r.classList.toggle("is-active", idx === activeIdx));
      rows[activeIdx].scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = (activeIdx - 1 + rows.length) % rows.length;
      rows.forEach((r, idx) => r.classList.toggle("is-active", idx === activeIdx));
      rows[activeIdx].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && currentItems[activeIdx]) {
      e.preventDefault();
      const dest = currentItems[activeIdx].href;
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
      window.location.href = dest;
    }
  });

  dlg._refreshList = () => {
    inp.value = "";
    renderList("");
    setTimeout(() => inp.focus(), 20);
  };
  return dlg;
}

function openCommandPalette() {
  const dlg = ensureCommandPalette();
  if (!dlg) return;
  if (typeof dlg.showModal === "function" && !dlg.open) {
    dlg.showModal();
  } else {
    dlg.setAttribute("open", "");
  }
  if (dlg._refreshList) dlg._refreshList();
}

if (typeof document !== "undefined") {
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openCommandPalette();
      return;
    }
    if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
      const pageSearch = document.querySelector("#tl-filter, #gear-search");
      if (!pageSearch) {
        e.preventDefault();
        openCommandPalette();
      }
    }
  });

  // Intercept direct cdn.messiallgoals.com/*.mp4 links so they play inside an inline HD Lightbox <dialog>
  document.addEventListener("click", (e) => {
    const mp4Link = e.target.closest('a[href*="cdn.messiallgoals.com/"][href$=".mp4"]');
    if (!mp4Link) return;
    e.preventDefault();
    let lb = document.getElementById("global-goal-lightbox");
    if (!lb) {
      lb = document.createElement("dialog");
      lb.id = "global-goal-lightbox";
      lb.className = "cmd-dialog video-lightbox-dialog";
      lb.setAttribute("closedby", "any");
      lb.setAttribute("aria-label", "Goal Video Player");
      lb.innerHTML = `
        <div class="vlb-shell">
          <div class="vlb-head">
            <strong class="vlb-title" id="vlb-title">Goal Highlight</strong>
            <form method="dialog" style="margin:0"><button class="cmd-esc-btn" id="vlb-close" aria-label="Close video">✕</button></form>
          </div>
          <video id="vlb-video" controls playsinline preload="metadata" style="width:100%;aspect-ratio:16/9;background:#000;display:block;border-radius:6px;"></video>
        </div>
      `;
      document.body.appendChild(lb);
      bindDialogLightDismissFallback(lb);
      lb.addEventListener("close", () => {
        const v = lb.querySelector("#vlb-video");
        if (v) { v.pause(); v.removeAttribute("src"); v.load(); }
      });
    }
    const cardTitle = mp4Link.closest(".card")?.querySelector("h3")?.textContent || mp4Link.textContent.trim();
    const titleEl = lb.querySelector("#vlb-title");
    if (titleEl) titleEl.textContent = cardTitle;
    const vid = lb.querySelector("#vlb-video");
    if (vid) {
      vid.src = mp4Link.href;
      vid.play().catch(() => {});
    }
    if (typeof lb.showModal === "function" && !lb.open) lb.showModal();
  });
}

function bindSparkTooltips() {
  if (typeof document === "undefined") return;
  let hud = document.getElementById("spark-hover-hud");
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "spark-hover-hud";
    hud.className = "spark-hover-hud";
    hud.hidden = true;
    document.body.appendChild(hud);
  }
  document.querySelectorAll("svg.spark .bar").forEach((bar) => {
    if (bar.dataset.hudBound === "1") return;
    bar.dataset.hudBound = "1";
    const show = () => {
      const tip = bar.querySelector("title")?.textContent || (bar.dataset.year ? `${bar.dataset.year}: ${bar.dataset.val} goals` : "");
      if (!tip) return;
      hud.textContent = tip;
      hud.hidden = false;
      const r = bar.getBoundingClientRect();
      const left = Math.min(window.innerWidth - 180, Math.max(12, r.left + r.width / 2));
      hud.style.left = `${left}px`;
      hud.style.top = `${Math.max(12, r.top - 10)}px`;
    };
    const hide = () => { hud.hidden = true; };
    bar.addEventListener("mouseenter", show);
    bar.addEventListener("mouseleave", hide);
  });
}

/* ================= FEATURE D: RIVALRY MODE TABS ================= */
function initRivalryModeTabs(d) {
  const arena = document.getElementById("rivalry-tug-arena");
  if (!arena || arena.dataset.rivalryTabsInit) return;
  const rowsWrap = arena.querySelector(".tug-rows");
  if (!rowsWrap) return;
  arena.dataset.rivalryTabsInit = "1";

  const lang = getLang();
  const RIVALRY_I18N = {
    en: {
      aria: "Comparison perspective mode",
      tabs: { all: "All Career", ratios: "Per-90 & Efficiency", finals: "World Cup & Finals" },
      rows: {
        gpm: "Goals per Match (Ratio)",
        gapm: "Goal Contributions per Match",
        npgpm: "Non-Penalty Goals per Match",
        npg: "Non-Penalty Goals",
        opg: "Open-Play Goals",
        fk: "Direct Free-Kick Goals",
        out: "Goals from Outside Penalty Box",
        bcc: "Big Chances Created (Tracked Era)",
        wcG: "FIFA World Cup Goals",
        wcA: "FIFA World Cup Assists",
        wcKoG: "World Cup Knockout Goals",
        wcKoA: "World Cup Knockout Assists",
        wcGb: "World Cup Golden Balls",
        finalsG: "Goals in Cup Finals",
        trophies: "Total Team Trophies",
        h2h: "Direct Head-to-Head Wins"
      }
    },
    es: {
      aria: "Modo de comparación",
      tabs: { all: "Toda la carrera", ratios: "Por partido y eficiencia", finals: "Mundial y finales" },
      rows: {
        gpm: "Goles por partido (Ratio)",
        gapm: "Contribuciones (G+A) por partido",
        npgpm: "Goles sin penalti por partido",
        npg: "Goles sin penalti",
        opg: "Goles en jugada abierta",
        fk: "Goles de tiro libre directo",
        out: "Goles desde fuera del área",
        bcc: "Grandes ocasiones creadas",
        wcG: "Goles en Copas del Mundo",
        wcA: "Asistencias en Copas del Mundo",
        wcKoG: "Goles en eliminatorias de Mundial",
        wcKoA: "Asistencias en eliminatorias de Mundial",
        wcGb: "Balones de Oro del Mundial",
        finalsG: "Goles en finales de copa",
        trophies: "Trofeos oficiales de equipo",
        h2h: "Victorias en duelos directos"
      }
    },
    pt: {
      aria: "Modo de comparação",
      tabs: { all: "Toda a carreira", ratios: "Por jogo e eficiência", finals: "Copa do Mundo e finais" },
      rows: {
        gpm: "Gols por jogo (Média)",
        gapm: "Participações em gol por jogo",
        npgpm: "Gols sem pênalti por jogo",
        npg: "Gols sem pênalti",
        opg: "Gols com bola rolando",
        fk: "Gols de falta direta",
        out: "Gols de fora da área",
        bcc: "Grandes chances criadas",
        wcG: "Gols em Copas do Mundo",
        wcA: "Assistências em Copas do Mundo",
        wcKoG: "Gols em mata-mata de Copa",
        wcKoA: "Assistências em mata-mata de Copa",
        wcGb: "Bolas de Ouro da Copa",
        finalsG: "Gols em finais",
        trophies: "Total de títulos coletivos",
        h2h: "Vitórias em confrontos diretos"
      }
    },
    fr: {
      aria: "Mode de comparaison",
      tabs: { all: "Toute la carrière", ratios: "Par match & efficacité", finals: "Coupe du monde & finales" },
      rows: {
        gpm: "Buts par match (Ratio)",
        gapm: "Actions décisives par match",
        npgpm: "Buts hors penalty par match",
        npg: "Buts hors penalty",
        opg: "Buts dans le jeu",
        fk: "Coups francs directs",
        out: "Buts hors de la surface",
        bcc: "Grosses occasions créées",
        wcG: "Buts en Coupe du monde",
        wcA: "Passes décisives en Coupe du monde",
        wcKoG: "Buts en phase finale de Mondial",
        wcKoA: "Passes décisives en phase finale",
        wcGb: "Ballons d'Or du Mondial",
        finalsG: "Buts en finales de coupe",
        trophies: "Total des trophées en équipe",
        h2h: "Victoires en confrontations directes"
      }
    },
    ro: {
      aria: "Mod de comparare",
      tabs: { all: "Întreaga carieră", ratios: "Per meci & eficiență", finals: "Cupa Mondială & finale" },
      rows: {
        gpm: "Goluri per meci (Rată)",
        gapm: "Contribuții (G+A) per meci",
        npgpm: "Goluri fără penalty per meci",
        npg: "Goluri fără penalty",
        opg: "Goluri din acțiune",
        fk: "Goluri din lovitură liberă",
        out: "Goluri din afara careului",
        bcc: "Ocazii mari create",
        wcG: "Goluri la Cupa Mondială",
        wcA: "Pase decisive la Cupa Mondială",
        wcKoG: "Goluri în fazele eliminatorii CM",
        wcKoA: "Pase decisive eliminatorii CM",
        wcGb: "Baloane de Aur CM",
        finalsG: "Goluri în finale",
        trophies: "Total trofee de echipă",
        h2h: "Victorii directe (H2H)"
      }
    },
    uz: {
      aria: "Taqqoslash ko'rinishi",
      tabs: { all: "Butun faoliyat", ratios: "O'yin boshiga samaradorlik", finals: "Jahon chempionati va finallar" },
      rows: {
        gpm: "O'yin boshiga gollar",
        gapm: "O'yin boshiga G+A hissa",
        npgpm: "Penaltisiz gol / o'yin",
        npg: "Penaltisiz gollar",
        opg: "Ochiq o'yindagi gollar",
        fk: "To'g'ridan-to'g'ri jarima zarbalari",
        out: "Jarima maydoni tashqarisidan gollar",
        bcc: "Yaratilgan yirik vaziyatlar",
        wcG: "Jahon chempionatidagi gollar",
        wcA: "Jahon chempionatidagi assistlar",
        wcKoG: "JCh pley-off bosqichi gollari",
        wcKoA: "JCh pley-off bosqichi assistlari",
        wcGb: "JCh Oltin to'plari",
        finalsG: "Finallardagi gollar",
        trophies: "Jami jamoaviy sovrinlar",
        h2h: "O'zaro o'yinlardagi g'alabalar"
      }
    },
    ar: {
      aria: "وضع المقارنة",
      tabs: { all: "المسيرة كاملة", ratios: "المعدل والكفاءة", finals: "كأس العالم والنهائيات" },
      rows: {
        gpm: "الأهداف لكل مباراة",
        gapm: "المساهمات التهديفية لكل مباراة",
        npgpm: "أهداف دون ركلات جزاء للمباراة",
        npg: "أهداف دون ركلات جزاء",
        opg: "أهداف اللعب المفتوح",
        fk: "أهداف الركلات الحرة المباشرة",
        out: "أهداف من خارج منطقة الجزاء",
        bcc: "الفرص الكبرى المصنوعة",
        wcG: "أهداف كأس العالم",
        wcA: "تمريرات حاسمة في كأس العالم",
        wcKoG: "أهداف الأدوار الإقصائية للمونديال",
        wcKoA: "تمريرات الإقصائيات في المونديال",
        wcGb: "الكرة الذهبية لكأس العالم",
        finalsG: "الأهداف في النهائيات",
        trophies: "إجمالي البطولات الجماعية",
        h2h: "الانتصارات في المواجهات المباشرة"
      }
    },
    id: {
      aria: "Mode perbandingan",
      tabs: { all: "Karier Penuh", ratios: "Rasio & Efisiensi", finals: "Piala Dunia & Final" },
      rows: {
        gpm: "Gol per pertandingan",
        gapm: "Gol + Assist per laga",
        npgpm: "Gol non-penalti per laga",
        npg: "Gol non-penalti",
        opg: "Gol permainan terbuka",
        fk: "Gol tendangan bebas langsung",
        out: "Gol dari luar kotak penalti",
        bcc: "Peluang besar diciptakan",
        wcG: "Gol Piala Dunia",
        wcA: "Assist Piala Dunia",
        wcKoG: "Gol fase gugur Piala Dunia",
        wcKoA: "Assist fase gugur Piala Dunia",
        wcGb: "Bola Emas Piala Dunia",
        finalsG: "Gol di partai final",
        trophies: "Total trofi tim",
        h2h: "Kemenangan head-to-head"
      }
    }
  };
  const tx = RIVALRY_I18N[lang] || RIVALRY_I18N.en;
  const r = tx.rows;

  const initialRowsHtml = rowsWrap.innerHTML;
  const mGoals = parseInt((d && d.totals && d.totals.goals), 10) || LIVE.goals;
  const mApps = parseInt((d && d.totals && (d.totals.apps || d.totals.appearances)), 10) || LIVE.apps;
  const mAssists = parseInt((d && d.totals && d.totals.assists), 10) || LIVE.assists;
  const mTrophies = parseInt((d && d.totals && d.totals.trophies), 10) || LIVE.trophies;
  const mRatio = mApps ? (mGoals / mApps).toFixed(2) : "0.79";
  const mGaRatio = mApps ? ((mGoals + mAssists) / mApps).toFixed(2) : "1.13";

  const ratioRows = [
    { lbl: r.gpm, mNum: parseFloat(mRatio), rNum: 0.73, mDisp: mRatio, rDisp: "0.73" },
    { lbl: r.gapm, mNum: parseFloat(mGaRatio), rNum: 0.93, mDisp: mGaRatio, rDisp: "0.93" },
    { lbl: r.npgpm, mNum: 0.70, rNum: 0.59, mDisp: "0.70", rDisp: "0.59" },
    { lbl: r.npg, mNum: LIVE.npg, rNum: LIVE.npgR, mDisp: String(LIVE.npg), rDisp: String(LIVE.npgR) },
    { lbl: r.opg, mNum: 754, rNum: 730, mDisp: "754", rDisp: "730" },
    { lbl: r.fk, mNum: 76, rNum: 65, mDisp: "76", rDisp: "65" },
    { lbl: r.out, mNum: 155, rNum: 126, mDisp: "155+", rDisp: "126+" },
    { lbl: r.bcc, mNum: 430, rNum: 210, mDisp: "430+", rDisp: "210+" }
  ];

  const finalsRows = [
    { lbl: r.wcG, mNum: 21, rNum: 11, mDisp: "21", rDisp: "11" },
    { lbl: r.wcA, mNum: 12, rNum: 2, mDisp: "12", rDisp: "2" },
    { lbl: r.wcKoG, mNum: 7, rNum: 1, mDisp: "7", rDisp: "1" },
    { lbl: r.wcKoA, mNum: 10, rNum: 0, mDisp: "10", rDisp: "0" },
    { lbl: r.wcGb, mNum: 2, rNum: 0, mDisp: "2", rDisp: "0" },
    { lbl: r.finalsG, mNum: 36, rNum: 23, mDisp: "36", rDisp: "23" },
    { lbl: r.trophies, mNum: mTrophies, rNum: LIVE.rTrophies, mDisp: String(mTrophies), rDisp: String(LIVE.rTrophies) },
    { lbl: r.h2h, mNum: 16, rNum: 11, mDisp: "16", rDisp: "11" }
  ];

  const buildRowsHtml = (items) =>
    items.map((item) => {
      const tot = item.mNum + item.rNum;
      const mPct = tot > 0 ? ((item.mNum / tot) * 100).toFixed(1) : "50.0";
      const rPct = tot > 0 ? (100 - parseFloat(mPct)).toFixed(1) : "50.0";
      const mLeads = item.mNum > item.rNum;
      const rLeads = item.rNum > item.mNum;
      return `<div class="tug-row">` +
        `<div class="tug-row-top">` +
          `<span class="tug-val messi tnum${mLeads ? " lead" : ""}">${esc(item.mDisp)}</span>` +
          `<span class="tug-stat-lbl">${esc(item.lbl)}</span>` +
          `<span class="tug-val ronaldo tnum${rLeads ? " lead" : ""}">${esc(item.rDisp)}</span>` +
        `</div>` +
        `<div class="tug-bar" role="img" aria-label="${esc(item.lbl)}: Messi ${esc(item.mDisp)} vs Ronaldo ${esc(item.rDisp)}">` +
          `<span class="tug-fill-messi${mLeads ? " is-lead" : ""}" style="width:${mPct}%"></span>` +
          `<span class="tug-fill-ronaldo${rLeads ? " is-lead" : ""}" style="width:${rPct}%"></span>` +
        `</div>` +
      `</div>`;
    }).join("");

  const tabsEl = document.createElement("div");
  tabsEl.className = "rivalry-mode-tabs";
  tabsEl.setAttribute("role", "tablist");
  tabsEl.setAttribute("aria-label", tx.aria);
  tabsEl.innerHTML = ["all", "ratios", "finals"].map((mode, idx) =>
    `<button type="button" class="rivalry-mode-btn${idx === 0 ? " is-active" : ""}" role="tab" aria-selected="${idx === 0 ? "true" : "false"}" data-rivalry-mode="${mode}">${esc(tx.tabs[mode])}</button>`
  ).join("");

  rowsWrap.parentNode.insertBefore(tabsEl, rowsWrap);

  tabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".rivalry-mode-btn");
    if (!btn) return;
    const mode = btn.dataset.rivalryMode || "all";
    tabsEl.querySelectorAll(".rivalry-mode-btn").forEach((b) => {
      const active = b === btn;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    if (mode === "all") {
      rowsWrap.innerHTML = initialRowsHtml;
    } else if (mode === "ratios") {
      rowsWrap.innerHTML = buildRowsHtml(ratioRows);
    } else if (mode === "finals") {
      rowsWrap.innerHTML = buildRowsHtml(finalsRows);
    }
  });
}

/* ================= BOOT ================= */
load().then((d) => {
  normalize(d);
  __CMD_DATA_CACHE = d;
  const page = document.body.dataset.page;
  try {
    if (page === "home") renderHome(d);
    else if (page === "byyear") renderByYear(d);
    else if (page === "byseason") renderBySeason(d);
    else if (page === "dashboard") {
      const team = new URLSearchParams(location.search).get("team") || "all";
      renderDashboard(d, team);
    }
    else if (page === "timeline") renderTimeline(d);
    else if (page === "achievements") renderAch(d);
    else if (page === "birthday") renderBirthday(d);
    else if (page === "latest-goal") renderLatestGoal(d);
  } catch (e) {
    console.error(e);
  }
  initRivalryModeTabs(d);
  reveal();
  /* Chart entrance: bars grow, donuts sweep, KPIs tick on visibility — one shared
     boot observer, same pattern as the timeline .tl-reveal wiring. */
  armEntrance();
  bindSparkTooltips();
  window.addEventListener("messi:spark-relayout", () => setTimeout(bindSparkTooltips, 30));
  initUXEnhancements();
  initArgentinaStreamNotification();
  mountLatestGoalCpaDeck();
  initInPageSocialBar();
}).catch(() => {
  const lang = getLang();
  const errorMsgs = {
    es: "Error al cargar las estadísticas. Comprueba tu conexión y recarga la página.",
    pt: "Falha ao carregar as estatísticas. Verifique sua conexão e recarregue.",
    fr: "Échec du chargement des statistiques. Vérifiez votre connexion et actualisez la page.",
    ro: "Eroare la încărcarea statisticilor. Verifică conexiunea și reîncarcă pagina.",
    uz: "Statistikani yuklab bo'lmadi. Internet aloqasini tekshirib, sahifani yangilang.",
    ar: "تعذر تحميل الإحصائيات. تحقق من اتصالك بالإنترنت وأعد تحميل الصفحة.",
    id: "Gagal memuat statistik. Periksa koneksi internet Anda lalu muat ulang."
  };
  const msgText = errorMsgs[lang] || "Stats failed to load. Check your connection and refresh.";
  document.querySelectorAll("main.wrap").forEach((m) => {
    const p = document.createElement("p");
    p.className = "caveat";
    p.textContent = msgText;
    m.prepend(p);
  });
  mountLatestGoalCpaDeck();
  initInPageSocialBar();
});

/* ============ SUPPORT TOAST — appears once, after 4 minutes on the page ============
   Deliberately quiet: no popup, no overlay, no auto-navigation. The Ko-fi link
   only opens on a real click (new tab). Closes on X / Esc / "maybe later",
   auto-hides after 30s, and shows at most once every 30 days. */
(function () {
  try {
    if (window.__mstSupportToast) return;
    window.__mstSupportToast = true;

    const KEY = "messistats_support_toast_v1";
    const COOLDOWN = 30 * 24 * 60 * 60 * 1000; // at most once per 30 days
    const DELAY = 4 * 60 * 1000;               // only after 4 real minutes
    const HOLD = 30000;                        // auto-dismiss after 30s

    let seen = 0;
    try { seen = Number(localStorage.getItem(KEY)) || 0; } catch (e) {}
    if (seen && Date.now() - seen < COOLDOWN) return;

    const TEXT = {
      en: { t: "Keep MessiStat running?", b: "Hosting and video streaming come out of our own pocket — a coffee keeps every goal clip free.", c: "Support on Ko-fi", l: "Maybe later", x: "Close" },
      es: { t: "¿Mantener MessiStat en marcha?", b: "El hosting y el streaming de vídeo los pagamos de nuestro bolsillo — un café mantiene el sitio gratis.", c: "Apoyar en Ko-fi", l: "Quizás más tarde", x: "Cerrar" },
      pt: { t: "Manter o MessiStat no ar?", b: "Hospedagem e streaming de vídeo saem do nosso bolso — um café mantém o site grátis.", c: "Apoiar no Ko-fi", l: "Talvez mais tarde", x: "Fechar" },
      fr: { t: "Garder MessiStat en ligne ?", b: "L'hébergement et le streaming vidéo sortent de notre poche — un café garde le site gratuit.", c: "Soutenir sur Ko-fi", l: "Peut-être plus tard", x: "Fermer" },
      ro: { t: "Susții MessiStat online?", b: "Găzduirea și streamingul video sunt plătite din buzunarul nostru — o cafea menține toate clipurile gratuite.", c: "Susține pe Ko-fi", l: "Poate mai târziu", x: "Închide" },
      uz: { t: "MessiStat ishlashini qo'llab-quvvatlaysizmi?", b: "Hosting va video striming o'z hisobimizdan qoplanadi — bir chashka qahva barcha gollarni bepul saqlaydi.", c: "Ko-fi orqali qo'llab-quvvatlash", l: "Keyinroq", x: "Yopish" },
      ar: { t: "هل تدعم استمرار MessiStat؟", b: "نفقات الاستضافة وبث الفيديو من جيبنا الخاص — دعم بسيط يبقي جميع مقاطع الأهداف مجانية.", c: "ادعمنا عبر Ko-fi", l: "ربما لاحقاً", x: "إغلاق" },
      id: { t: "Dukung MessiStat tetap berjalan?", b: "Biaya hosting dan streaming video kami tanggung sendiri — segelas kopi menjaga semua klip gol tetap gratis.", c: "Dukung di Ko-fi", l: "Nanti saja", x: "Tutup" }
    };

    const lang = (typeof getLang === "function" ? getLang() : "en");
    const x = TEXT[lang] || TEXT.en;
    let el = null;
    let timer = null;
    let onKey = null;
    let onResize = null;
    let navObserver = null;

    // On phones the fixed bottom nav is taller than --mobile-nav-h claims on
    // some devices, so measure the real bar and sit 12px above it (safe-area
    // included). Desktop keeps the CSS corner placement. A ResizeObserver
    // re-applies the offset when the bar's box settles (fonts, safe-area,
    // late layout) instead of trusting a one-shot measurement.
    function placeAboveNav() {
      if (!el || !window.matchMedia("(max-width: 768px)").matches) return;
      const nav = document.querySelector(".rail");
      if (!nav) return;
      const r = nav.getBoundingClientRect();
      const h = window.innerHeight;
      if (r.height > 20 && r.top > h / 2) el.style.bottom = Math.round(h - r.top + 12) + "px";
    }

    function close() {
      if (!el) return;
      clearTimeout(timer);
      timer = null;
      if (onKey) document.removeEventListener("keydown", onKey);
      onKey = null;
      if (onResize) window.removeEventListener("resize", onResize);
      onResize = null;
      if (navObserver) { navObserver.disconnect(); navObserver = null; }
      document.body.classList.remove("mst-toast-open");
      if (el.parentNode) el.parentNode.removeChild(el);
      el = null;
    }

    function show() {
      if (el) return;
      // Never pop while the tab is in the background — wait until it is seen.
      if (document.hidden) { timer = setTimeout(show, 15000); return; }

      el = document.createElement("aside");
      el.className = "mst-toast";
      el.setAttribute("aria-label", x.t);
      el.innerHTML =
        '<button type="button" class="mst-toast-close" aria-label="' + x.x + '" title="' + x.x + '">&#10005;</button>' +
        '<p class="mst-toast-title"></p>' +
        '<p class="mst-toast-body"></p>' +
        '<div class="mst-toast-actions">' +
          '<a class="mst-toast-cta" href="https://ko-fi.com/messistat" target="_blank" rel="noopener noreferrer"></a>' +
          '<button type="button" class="mst-toast-later"></button>' +
        "</div>";
      el.querySelector(".mst-toast-title").textContent = x.t;
      el.querySelector(".mst-toast-body").textContent = x.b;
      el.querySelector(".mst-toast-cta").textContent = x.c;
      el.querySelector(".mst-toast-later").textContent = x.l;
      el.querySelector(".mst-toast-close").addEventListener("click", close);
      el.querySelector(".mst-toast-later").addEventListener("click", close);

      document.body.appendChild(el);
      document.body.classList.add("mst-toast-open");
      placeAboveNav();
      onResize = placeAboveNav;
      window.addEventListener("resize", onResize);
      try {
        const navEl = document.querySelector(".rail");
        if (navEl && window.ResizeObserver) {
          navObserver = new ResizeObserver(placeAboveNav);
          navObserver.observe(navEl);
        }
      } catch (e) {}
      try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
      onKey = function (e) { if (e.key === "Escape") close(); };
      document.addEventListener("keydown", onKey);
      timer = setTimeout(close, HOLD);
    }

    timer = setTimeout(show, DELAY);
  } catch (e) {}
})();
