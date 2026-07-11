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
