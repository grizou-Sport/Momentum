/* =========================================================
   MOMENTUM — HOME CORE v1.0
   ---------------------------------------------------------
   État local, dates, utilisateur et utilitaires communs.
   ========================================================= */

const $ = (selector) => document.querySelector(selector);

const STORE_KEY = "momentum_home_v1";

const DAY_LONG = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi"
];

const DAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre"
];

let state = loadState();
let visibleMonth = startOfMonth(new Date());
let homeDialogScrollY = null;
let homeDialogScrollToken = 0;


/* =========================================================
   État local temporaire
   ========================================================= */

function defaultState() {
  return {
    profile: {
      athlete: "",
      project: "",
      tagline: "",
      locationName: "",
      latitude: null,
      longitude: null
    },
    sessions: [],
    wellbeing: {},
    context: {}
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
    return parsed && typeof parsed === "object" ? parsed : defaultState();
  } catch (error) {
    console.warn("HOME : état local illisible, réinitialisation.", error);
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function sessionIconHtml(session, className = "session-icon") {
  const category = session?.category || session?.activity_category || "sport";
  if (category === "wellbeing") {
    return window.MomentumIcons?.render("mobility", { collection:"sports", size:22, className }) || "";
  }
  if (category === "adventure") {
    return window.MomentumIcons?.render("mountain", { collection:"sports", size:22, className }) || "";
  }
  return window.MomentumIcons?.renderSport(session?.sport || session?.activity_type || "activity", { size:22, className }) || "";
}

function sessionIconsHtml(sessions, className = "session-icon") {
  return sessions.slice(0, 3).map((session) => sessionIconHtml(session, className)).join("");
}


/* =========================================================
   Dates
   ========================================================= */

function iso(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function dateFromIso(value) {
  return new Date(`${value}T12:00:00`);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

function fmtDate(value) {
  const d = dateFromIso(value);
  return `${DAY_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtShortDate(value) {
  const d = dateFromIso(value);
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()}`;
}

function uid() {
  return `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

async function getCurrentUser() {
  if (!window.momentumDB) {
    console.error("HOME : le client Supabase momentumDB n'est pas chargé.");
    return null;
  }

  const { data, error } = await window.momentumDB.auth.getSession();

  if (error) {
    console.error("HOME : impossible de lire la session.", error);
    return null;
  }

  return data.session?.user || null;
}

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openHomeDialog(dialog) {
  if (!dialog || dialog.open || typeof dialog.showModal !== "function") return;

  if (homeDialogScrollY === null) {
    homeDialogScrollToken += 1;
    homeDialogScrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${homeDialogScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  dialog.addEventListener("close", restoreHomeDialogScroll, { once:true });
  dialog.showModal();
}

function closeHomeDialog(dialog) {
  if (!dialog?.open) return;

  dialog.close();

  restoreHomeDialogScroll();
}

function restoreHomeDialogScroll() {
  if (document.querySelector("dialog[open]") || homeDialogScrollY === null) return;

  const scrollY = homeDialogScrollY ?? 0;
  const restoreToken = ++homeDialogScrollToken;
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  homeDialogScrollY = null;
  window.scrollTo(0, scrollY);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (
        restoreToken === homeDialogScrollToken &&
        homeDialogScrollY === null &&
        !document.querySelector("dialog[open]")
      ) {
        window.scrollTo(0, scrollY);
      }
    });
  });
}
