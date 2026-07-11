/* =========================================================
   MOMENTUM — HOME v0.15
   ---------------------------------------------------------
   Rôle :
   - piloter la page HOME
   - gérer les activités créées/importées depuis HOME
   - afficher Aujourd'hui, la fenêtre -3/+3 et le calendrier
   - afficher la météo du lieu par défaut de l'utilisateur
   - préparer le futur raccordement Supabase

   Important :
   - aucune donnée de profil n'est inventée ici
   - aucune géolocalisation par adresse IP
   - les graphiques seront raccordés dans une étape séparée
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


/* =========================================================
   Activités
   ========================================================= */

function sessionsOn(date) {
  return (state.sessions || [])
    .filter((session) => session.date === date)
    .sort((a, b) => {
      if (a.status === b.status) return 0;
      return a.status === "done" ? -1 : 1;
    });
}


function mapActivityRow(row) {
  return {
    id: row.id,
    date: row.activity_date,
    status: row.status || "done",
    sport: row.sport || "",
    type: row.activity_type || "",
    distance: row.distance_km,
    duration: row.duration_min,
    elevation: row.elevation_m,
    hr: row.avg_hr,
    rpe: row.rpe,
    gear: row.gear || "",
    comment: row.notes || "",
    locationName: row.location_name || "",
    placeName: row.location_name || "",
    routeSummary: row.route_summary || null,
    weather: row.weather || null,
    createdAt: row.created_at
  };
}

function monthGridRange(monthDate) {
  const firstDay = startOfMonth(monthDate);
  const mondayIndex = (firstDay.getDay() + 6) % 7;
  const start = addDays(firstDay, -mondayIndex);
  const end = addDays(start, 41);

  return { start, end };
}

async function loadActivitiesForHome(
  centerDate = new Date(),
  monthDate = visibleMonth
) {
  const user = await getCurrentUser();

  if (!user) {
    state.sessions = [];
    return [];
  }

  const livingStart = addDays(centerDate, -3);
  const livingEnd = addDays(centerDate, 3);
  const calendarRange = monthGridRange(monthDate);

  const rangeStart =
    livingStart < calendarRange.start ? livingStart : calendarRange.start;

  const rangeEnd =
    livingEnd > calendarRange.end ? livingEnd : calendarRange.end;

  const { data, error } = await window.momentumDB
    .from("activities")
    .select(
      "id,user_id,sport,activity_type,status,distance_km,duration_min,elevation_m,avg_hr,rpe,gear,notes,created_at,activity_date,weather,location_name,route_summary"
    )
    .eq("user_id", user.id)
    .gte("activity_date", iso(rangeStart))
    .lte("activity_date", iso(rangeEnd))
    .order("activity_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error(
      "HOME : impossible de charger les activités du calendrier.",
      error
    );
    state.sessions = [];
    return [];
  }

  state.sessions = (data || [])
    .filter((row) => row.activity_date)
    .map(mapActivityRow);

  return state.sessions;
}

function sessionLabel(session) {
  return session.type || session.sport || "Activité";
}

function sessionMeta(session) {
  const parts = [];

  if (session.sport) parts.push(session.sport);
  if (Number(session.distance) > 0) parts.push(`${formatNumber(session.distance)} km`);
  if (Number(session.duration) > 0) parts.push(`${Math.round(session.duration)} min`);

  return parts.join(" · ");
}

function formatNumber(value) {
  return Number(value).toLocaleString("fr-CH", {
    maximumFractionDigits: 2
  });
}


/* =========================================================
   Météo
   ========================================================= */

function getDefaultUserLocation() {
  const profile = state.profile || {};
  const latitude = Number(profile.latitude);
  const longitude = Number(profile.longitude);

  if (
    !profile.locationName ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    locationName: profile.locationName,
    latitude,
    longitude,
    source: "profile"
  };
}

async function geocodePlace(placeName) {
  const params = new URLSearchParams({
    format: "jsonv2",
    q: placeName,
    limit: "1"
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`
  );

  if (!response.ok) {
    throw new Error(`Recherche du lieu indisponible (${response.status})`);
  }

  const results = await response.json();
  const match = results?.[0];

  if (!match) return null;

  const latitude = Number(match.lat);
  const longitude = Number(match.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    locationName: placeName,
    latitude,
    longitude
  };
}

async function loadPassportLocation() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await window.momentumDB
    .from("passports")
    .select("city,country")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("HOME : impossible de charger le Passeport.", error);
    return null;
  }

  const city = String(data?.city || "").trim();
  const country = String(data?.country || "").trim();
  const locationName = [city, country].filter(Boolean).join(", ");

  if (!locationName) {
    state.profile = {
      ...(state.profile || {}),
      locationName: "",
      latitude: null,
      longitude: null
    };

    state.context = {};
    saveState();
    return null;
  }

  const current = state.profile || {};
  const sameSavedPlace =
    current.locationName === locationName &&
    Number.isFinite(Number(current.latitude)) &&
    Number.isFinite(Number(current.longitude));

  if (sameSavedPlace) {
    return getDefaultUserLocation();
  }

  try {
    const resolved = await geocodePlace(locationName);

    state.profile = {
      ...(state.profile || {}),
      locationName,
      latitude: resolved?.latitude ?? null,
      longitude: resolved?.longitude ?? null
    };

    state.context = {};
    saveState();

    return resolved;
  } catch (error) {
    console.error(
      "HOME : impossible de localiser la ville du Passeport.",
      error
    );

    state.profile = {
      ...(state.profile || {}),
      locationName,
      latitude: null,
      longitude: null
    };

    state.context = {};
    saveState();

    return null;
  }
}

function weatherText(code) {
  const value = Number(code);

  if (value === 0) return "Ciel clair";
  if ([1, 2].includes(value)) return "Temps lumineux";
  if (value === 3) return "Ciel couvert";
  if ([45, 48].includes(value)) return "Brouillard";
  if (value >= 51 && value <= 67) return "Pluie";
  if (value >= 71 && value <= 77) return "Neige";
  if (value >= 80 && value <= 82) return "Averses";
  if (value >= 95) return "Orage";

  return "Conditions variables";
}

function timeOnly(value) {
  if (!value) return "—";

  const match = String(value).match(/T(\d{2}:\d{2})/);
  return match ? match[1] : String(value).slice(0, 5);
}

async function getWeather(latitude, longitude, date) {
  const today = iso(new Date());
  const isPast = date < today;

  const base = isPast
    ? "https://archive-api.open-meteo.com/v1/archive"
    : "https://api.open-meteo.com/v1/forecast";

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: date,
    end_date: date,
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,wind_speed_10m_max",
    timezone: "auto"
  });

  const response = await fetch(`${base}?${params}`);

  if (!response.ok) {
    throw new Error(`Météo indisponible (${response.status})`);
  }

  const data = await response.json();
  const daily = data.daily || {};

  return {
    code: daily.weather_code?.[0],
    tMax: daily.temperature_2m_max?.[0],
    tMin: daily.temperature_2m_min?.[0],
    rain: daily.precipitation_sum?.[0],
    wind: daily.wind_speed_10m_max?.[0],
    sunrise: daily.sunrise?.[0],
    sunset: daily.sunset?.[0]
  };
}

async function getContextForDate(date) {
  state.context = state.context || {};

  const location = getDefaultUserLocation();

  if (!location) {
    return {
      locationName: "",
      missingDefaultLocation: true
    };
  }

  const cached = state.context[date] || {};

  const sameLocation =
    cached.source === "profile" &&
    cached.locationName === location.locationName &&
    Number(cached.latitude) === location.latitude &&
    Number(cached.longitude) === location.longitude;

  if (cached.weather && sameLocation) {
    return cached;
  }

  try {
    const weather = await getWeather(
      location.latitude,
      location.longitude,
      date
    );

    const context = {
      ...location,
      weather,
      fetchedAt: new Date().toISOString()
    };

    state.context[date] = context;
    saveState();

    return context;
  } catch (error) {
    console.error("HOME : erreur météo.", error);

    return {
      ...location,
      weatherError: true
    };
  }
}


/* =========================================================
   Hero — Mon Horizon depuis Supabase
   ========================================================= */

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

async function loadActiveHorizon() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await window.momentumDB
    .from("user_missions")
    .select(
      "id,title,description,category,subcategory,sport,distance_km,target_time_seconds,target_pace_seconds_per_km,duration_days,target_date,created_at,status"
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("HOME : impossible de charger Mon Horizon.", error);
    return null;
  }

  return data || null;
}

function formatHeroDate(dateValue) {
  if (!dateValue) return "Date à définir";

  return new Date(`${dateValue}T12:00:00`).toLocaleDateString("fr-CH", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function daysUntil(dateValue) {
  if (!dateValue) return null;

  const today = dateFromIso(iso(new Date()));
  const target = dateFromIso(dateValue);
  return Math.ceil((target - today) / 86400000);
}

function horizonProgress(horizon) {
  if (!horizon?.created_at || !horizon?.target_date) return null;

  const start = new Date(horizon.created_at);
  const end = dateFromIso(horizon.target_date);
  const now = new Date();
  const total = end - start;

  if (total <= 0) return null;

  const elapsed = now - start;
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}

function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;

  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);

  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")}`;
  return `${minutes} min`;
}

function formatPace(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;

  const minutes = Math.floor(value / 60);
  const remaining = Math.round(value % 60);
  return `${minutes}'${String(remaining).padStart(2, "0")}/km`;
}

function getHorizonGoal(horizon) {
  if (!horizon) return "À définir";

  if (horizon.category === "competition") {
    return (
      formatDuration(horizon.target_time_seconds) ||
      (horizon.distance_km ? `${formatNumber(horizon.distance_km)} km` : null) ||
      "Compétition"
    );
  }

  if (horizon.category === "adventure") {
    return horizon.duration_days
      ? `${horizon.duration_days} jour${Number(horizon.duration_days) > 1 ? "s" : ""}`
      : "Aventure";
  }

  if (horizon.category === "health") return "Santé";
  if (horizon.category === "pleasure") return "Plaisir";

  return "À définir";
}

function getHorizonPace(horizon) {
  if (!horizon || horizon.category !== "competition") return "—";

  const storedPace = formatPace(horizon.target_pace_seconds_per_km);
  if (storedPace) return storedPace;

  const time = Number(horizon.target_time_seconds);
  const distance = Number(horizon.distance_km);

  if (Number.isFinite(time) && time > 0 && Number.isFinite(distance) && distance > 0) {
    return formatPace(time / distance);
  }

  return "—";
}

function renderHeroEmpty() {
  setText("#heroTitle", "Mon Horizon");
  setText("#heroQuote", "Chaque journée écrit une ligne du chemin.");
  setText("#daysLeft", "—");
  setText("#targetDateLabel", "Aucun horizon actif");
  setText("#missionProgress", "—");
  setText("#goalLabel", "À définir");
  setText("#paceLabel", "—");
}

async function renderHero() {
  const horizon = await loadActiveHorizon();

  if (!horizon) {
    renderHeroEmpty();
    return;
  }

  const remainingDays = daysUntil(horizon.target_date);
  const progress = horizonProgress(horizon);

  setText("#heroTitle", horizon.title || "Mon Horizon");
  setText(
    "#heroQuote",
    horizon.description || "Chaque journée écrit une ligne du chemin."
  );

  setText(
    "#daysLeft",
    remainingDays === null
      ? "—"
      : remainingDays >= 0
        ? `J-${remainingDays}`
        : `J+${Math.abs(remainingDays)}`
  );

  setText("#targetDateLabel", formatHeroDate(horizon.target_date));
  setText("#missionProgress", progress === null ? "—" : `${progress}%`);
  setText("#goalLabel", getHorizonGoal(horizon));
  setText("#paceLabel", getHorizonPace(horizon));

  state.profile = {
    ...(state.profile || {}),
    project: horizon.title || "",
    tagline: horizon.description || ""
  };
}


/* =========================================================
   Aujourd'hui
   ========================================================= */

function renderToday(date, sessions) {
  const title = $("#todayTitle");
  const narrative = $("#todayNarrative");
  const todayCard = $("#todayCard");
  const plannedCard = $("#plannedCard");

  if (title) title.textContent = fmtDate(date);

  if (narrative) {
    narrative.textContent = sessions.length
      ? `${sessions.length} activité${sessions.length > 1 ? "s" : ""} inscrite${sessions.length > 1 ? "s" : ""} aujourd'hui.`
      : "La journée est libre ou encore à écrire.";
  }

  if (todayCard) {
    const completed = sessions.filter((session) => session.status === "done");

    if (!completed.length) {
      todayCard.innerHTML = `
        <span class="card-label">Aujourd'hui</span>
        <h3>La page est encore blanche.</h3>
        <p>Une activité ajoutée ou importée depuis HOME apparaîtra ici.</p>
      `;
    } else {
      const main = completed[0];

      todayCard.innerHTML = `
        <span class="card-label">Réalisé</span>
        <h3>${escapeHtml(sessionLabel(main))}</h3>
        <p>${escapeHtml(sessionMeta(main) || "Activité enregistrée.")}</p>
        <p>${escapeHtml(main.comment || "Une ligne de plus dans le chemin.")}</p>
      `;
    }
  }

  if (plannedCard) {
    const planned = sessions.filter((session) => session.status === "planned");

    if (!planned.length) {
      plannedCard.innerHTML = `
        <div>
          <span class="card-label">À venir</span>
          <h3>Aucune séance prévue</h3>
        </div>
        <p class="muted">La journée reste ouverte.</p>
      `;
    } else {
      const next = planned[0];

      plannedCard.innerHTML = `
        <div>
          <span class="card-label">Prévu</span>
          <h3>${escapeHtml(sessionLabel(next))}</h3>
        </div>
        <p class="big-value">${escapeHtml(sessionMeta(next) || "Séance planifiée")}</p>
        <p class="muted">${escapeHtml(next.comment || "À écrire.")}</p>
      `;
    }
  }
}


/* =========================================================
   Fenêtre vivante -3 / +3
   ========================================================= */

function renderLivingWeek(centerDate = new Date()) {
  const container = $("#livingWeek");
  if (!container) return;

  const today = iso(new Date());

  container.innerHTML = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(centerDate, index - 3);
    const dateIso = iso(date);
    const sessions = sessionsOn(dateIso);
    const isToday = dateIso === today;

    const summary = sessions.length
      ? sessions.map((session) => sessionLabel(session)).join(" · ")
      : "Aucune activité";

    return `
      <button
        type="button"
        class="living-day${isToday ? " is-today" : ""}"
        data-date="${dateIso}"
        data-today="${isToday ? "true" : "false"}"
      >
        <span class="card-label">${escapeHtml(fmtShortDate(dateIso))}</span>
        <strong>${sessions.length || "—"}</strong>
        <p>${escapeHtml(summary)}</p>
      </button>
    `;
  }).join("");
}


/* =========================================================
   Calendrier mensuel
   ========================================================= */

function renderMonth() {
  const container = $("#monthGrid");
  const monthTitle = $("#monthTitle");

  if (!container || !monthTitle) return;

  monthTitle.textContent =
    `${MONTHS[visibleMonth.getMonth()]} ${visibleMonth.getFullYear()}`;

  const firstDay = startOfMonth(visibleMonth);
  const mondayIndex = (firstDay.getDay() + 6) % 7;
  const gridStart = addDays(firstDay, -mondayIndex);
  const today = iso(new Date());

  container.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    const dateIso = iso(date);
    const sessions = sessionsOn(dateIso);
    const outsideMonth = date.getMonth() !== visibleMonth.getMonth();
    const isToday = dateIso === today;

    return `
      <button
        type="button"
        class="month-day${outsideMonth ? " is-outside" : ""}${isToday ? " is-today" : ""}"
        data-date="${dateIso}"
        data-today="${isToday ? "true" : "false"}"
      >
        <span>${date.getDate()}</span>
        ${
          sessions.length
            ? `<small>${sessions.length} activité${sessions.length > 1 ? "s" : ""}</small>`
            : ""
        }
      </button>
    `;
  }).join("");
}


/* =========================================================
   Cartes contextuelles
   ========================================================= */

function renderWeatherCard(context) {
  const element = $("#weatherCard");
  if (!element) return;

  if (context.missingDefaultLocation) {
    element.innerHTML = `
      <span class="card-label">Météo</span>
      <h2>Lieu à définir</h2>
      <p>Ajoute ton lieu par défaut dans YOU pour afficher la météo locale.</p>
    `;
    return;
  }

  if (context.weatherError) {
    element.innerHTML = `
      <span class="card-label">Météo</span>
      <h2>Indisponible</h2>
      <p>Impossible de charger la météo pour le moment.</p>
    `;
    return;
  }

  const weather = context.weather;

  if (!weather) {
    element.innerHTML = `
      <span class="card-label">Météo</span>
      <h2>Chargement…</h2>
      <p>Recherche du décor du jour.</p>
    `;
    return;
  }

  element.innerHTML = `
    <span class="card-label">Météo</span>
    <h2>${escapeHtml(context.locationName)}</h2>
    <p class="big-value">
      ${Math.round(weather.tMin)}° – ${Math.round(weather.tMax)}°
    </p>
    <p>${escapeHtml(weatherText(weather.code))}</p>
    <p class="muted">
      Vent ${Math.round(weather.wind || 0)} km/h ·
      Pluie ${formatNumber(weather.rain || 0)} mm
    </p>
    <p class="muted">
      Lever ${timeOnly(weather.sunrise)} ·
      Coucher ${timeOnly(weather.sunset)}
    </p>
  `;
}

function renderCalendarCard(date, sessions) {
  const element = $("#calendarCard");
  if (!element) return;

  const main = sessions[0];

  element.innerHTML = `
    <span class="card-label">Calendrier</span>
    <h2>${escapeHtml(fmtDate(date))}</h2>
    ${
      main
        ? `
          <p class="big-value">${escapeHtml(sessionLabel(main))}</p>
          <p>${escapeHtml(sessionMeta(main) || "Séance enregistrée.")}</p>
          <p class="muted">${escapeHtml(main.comment || "")}</p>
        `
        : `
          <p class="big-value">Aucune séance</p>
          <p class="muted">La journée est libre ou encore à écrire.</p>
        `
    }
  `;
}

function renderMissionCard() {
  const element = $("#missionCard");
  if (!element) return;

  const profile = state.profile || {};

  element.innerHTML = `
    <span class="card-label">Horizon</span>
    <h2>${escapeHtml(profile.project || "Aucun Horizon actif")}</h2>
    <p>${escapeHtml(profile.tagline || "Ton Horizon apparaîtra ici une fois relié à YOU.")}</p>
  `;
}

function renderActivityList(date, sessions) {
  const element = $("#activityList");
  if (!element) return;

  if (!sessions.length) {
    element.innerHTML = `
      <article class="home-card">
        <span class="card-label">Activités</span>
        <h2>Aucune activité</h2>
        <p>Importe une activité GPX depuis HOME pour créer le premier chapitre.</p>
      </article>
    `;
    return;
  }

  element.innerHTML = sessions.map((session) => `
    <article class="home-card activity-card">
      <span class="card-label">
        ${session.status === "done" ? "Réalisé" : "Prévu"}
      </span>
      <h2>${escapeHtml(sessionLabel(session))}</h2>
      <p>${escapeHtml(sessionMeta(session))}</p>
      <p class="muted">
        ${escapeHtml(session.locationName || session.placeName || "Lieu à définir")}
      </p>
    </article>
  `).join("");
}


/* =========================================================
   GPX
   ========================================================= */

function haversineKm(pointA, pointB) {
  const radius = 6371;
  const toRad = (value) => value * Math.PI / 180;

  const dLat = toRad(pointB.lat - pointA.lat);
  const dLon = toRad(pointB.lon - pointA.lon);

  const lat1 = toRad(pointA.lat);
  const lat2 = toRad(pointB.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function routeDistance(points) {
  return points.reduce((total, point, index) => {
    if (index === 0) return 0;
    return total + haversineKm(points[index - 1], point);
  }, 0);
}

function routeDurationMinutes(points) {
  const first = points.find((point) => point.time);
  const last = [...points].reverse().find((point) => point.time);

  if (!first?.time || !last?.time) return 0;

  const duration = new Date(last.time) - new Date(first.time);
  return duration > 0 ? duration / 60000 : 0;
}

function routeCenter(route) {
  const points = route?.points || [];
  if (!points.length) return null;

  const middle = points[Math.floor(points.length / 2)];

  return {
    latitude: middle.lat,
    longitude: middle.lon
  };
}

async function reverseGeocode(latitude, longitude) {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude)
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`
  );

  if (!response.ok) {
    throw new Error(`Géocodage indisponible (${response.status})`);
  }

  const data = await response.json();
  const address = data.address || {};

  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    data.name ||
    "Lieu de l'activité"
  );
}

async function parseGpx(file) {
  const text = await file.text();
  const xml = new DOMParser().parseFromString(text, "application/xml");

  if (xml.querySelector("parsererror")) {
    throw new Error("Le fichier GPX est invalide.");
  }

  const points = [...xml.querySelectorAll("trkpt")]
    .map((point) => ({
      lat: Number(point.getAttribute("lat")),
      lon: Number(point.getAttribute("lon")),
      ele: Number(point.querySelector("ele")?.textContent || 0),
      time: point.querySelector("time")?.textContent || null
    }))
    .filter((point) =>
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lon)
    );

  if (!points.length) {
    throw new Error("Aucun point de trace trouvé dans le fichier GPX.");
  }

  return {
    name: file.name,
    points,
    startTime: points.find((point) => point.time)?.time || null,
    endTime: [...points].reverse().find((point) => point.time)?.time || null,
    distance: routeDistance(points),
    duration: routeDurationMinutes(points)
  };
}

async function handleGpxImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const route = await parseGpx(file);
    const activityDate = route.startTime
      ? iso(new Date(route.startTime))
      : iso(new Date());

    const center = routeCenter(route);
    let placeName = "Lieu de l'activité";

    if (center) {
      try {
        placeName = await reverseGeocode(
          center.latitude,
          center.longitude
        );
      } catch (error) {
        console.warn("HOME : lieu de l'activité non résolu.", error);
      }
    }

    const activity = {
      id: uid(),
      date: activityDate,
      status: "done",
      sport: "Course à pied",
      type: file.name.replace(/\.gpx$/i, ""),
      distance: Number(route.distance.toFixed(2)),
      duration: Math.round(route.duration),
      comment: "Activité importée depuis un fichier GPX.",
      route,
      placeName,
      locationName: placeName,
      startTime: route.startTime,
      endTime: route.endTime
    };

    const user = await getCurrentUser();

    if (!user) {
      throw new Error("Aucun utilisateur connecté.");
    }

    const routeSummary = {
      file_name: file.name,
      point_count: route.points.length,
      start_time: route.startTime,
      end_time: route.endTime,
      center
    };

    const { error: insertError } = await window.momentumDB
      .from("activities")
      .insert({
        user_id: user.id,
        sport: activity.sport,
        activity_type: activity.type,
        status: activity.status,
        distance_km: activity.distance,
        duration_min: activity.duration,
        notes: activity.comment,
        activity_date: activity.date,
        location_name: activity.locationName,
        route_summary: routeSummary
      });

    if (insertError) throw insertError;

    await renderHome();
  } catch (error) {
    console.error("HOME : import GPX impossible.", error);
    window.alert(error.message || "Impossible d'importer ce fichier GPX.");
  } finally {
    event.target.value = "";
  }
}



/* =========================================================
   Ajouter une activité
   ========================================================= */

function openActivityDialog() {
  const dialog = $("#activityDialog");
  const form = $("#activityForm");

  if (!dialog || !form) return;

  form.reset();
  form.elements.activity_date.value = iso(new Date());
  form.elements.status.value = "done";
  setActivityMessage("");

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  }
}

function closeActivityDialog() {
  const dialog = $("#activityDialog");
  if (dialog?.open) dialog.close();
}

function setActivityMessage(message, isError = false) {
  const element = $("#activityMessage");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function secondsToMinutes(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds / 60 : 0;
}

function fitDate(value) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : iso(date);
}

function fitSportLabel(value) {
  const labels = {
    1: "Course à pied",
    2: "Vélo",
    5: "Natation",
    11: "Randonnée",
    13: "Musculation",
    15: "Marche"
  };

  return labels[Number(value)] || "Autre";
}

function readFitValue(view, offset, baseType, littleEndian) {
  const type = baseType & 0x1f;

  switch (type) {
    case 0: return view.getUint8(offset);
    case 1: return view.getInt8(offset);
    case 2: return view.getUint8(offset);
    case 3: return view.getInt16(offset, littleEndian);
    case 4: return view.getUint16(offset, littleEndian);
    case 5: return view.getInt32(offset, littleEndian);
    case 6: return view.getUint32(offset, littleEndian);
    case 7: return null;
    case 8: return view.getFloat32(offset, littleEndian);
    case 9: return view.getFloat64(offset, littleEndian);
    case 10: return view.getUint8(offset);
    case 11: return view.getUint16(offset, littleEndian);
    case 12: return view.getUint32(offset, littleEndian);
    case 13: return view.getUint8(offset);
    case 14: return Number(view.getBigInt64(offset, littleEndian));
    case 15: return Number(view.getBigUint64(offset, littleEndian));
    case 16: return Number(view.getBigUint64(offset, littleEndian));
    default: return null;
  }
}

function fitEpochToDate(seconds) {
  const FIT_EPOCH_MS = Date.UTC(1989, 11, 31, 0, 0, 0);
  return new Date(FIT_EPOCH_MS + Number(seconds) * 1000);
}

async function parseFit(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  const headerSize = view.getUint8(0);
  const dataSize = view.getUint32(4, true);
  const dataEnd = Math.min(headerSize + dataSize, buffer.byteLength);

  if (headerSize < 12 || dataEnd <= headerSize) {
    throw new Error("Le fichier FIT est invalide.");
  }

  const definitions = new Map();
  let offset = headerSize;
  let session = null;

  while (offset < dataEnd) {
    const header = view.getUint8(offset);
    offset += 1;

    const compressedTimestamp = (header & 0x80) !== 0;
    const definitionMessage = !compressedTimestamp && (header & 0x40) !== 0;
    const developerData = !compressedTimestamp && (header & 0x20) !== 0;
    const localMessageType = compressedTimestamp ? ((header >> 5) & 0x03) : (header & 0x0f);

    if (definitionMessage) {
      offset += 1; // reserved
      const architecture = view.getUint8(offset);
      offset += 1;

      const littleEndian = architecture === 0;
      const globalMessageNumber = view.getUint16(offset, littleEndian);
      offset += 2;

      const fieldCount = view.getUint8(offset);
      offset += 1;

      const fields = [];

      for (let i = 0; i < fieldCount; i += 1) {
        fields.push({
          number: view.getUint8(offset),
          size: view.getUint8(offset + 1),
          baseType: view.getUint8(offset + 2)
        });
        offset += 3;
      }

      if (developerData) {
        const developerFieldCount = view.getUint8(offset);
        offset += 1 + developerFieldCount * 3;
      }

      definitions.set(localMessageType, {
        globalMessageNumber,
        littleEndian,
        fields
      });

      continue;
    }

    const definition = definitions.get(localMessageType);

    if (!definition) {
      throw new Error("Structure FIT non reconnue.");
    }

    const values = {};

    for (const field of definition.fields) {
      if (offset + field.size > dataEnd) {
        throw new Error("Le fichier FIT est incomplet.");
      }

      if (field.size === 1 || field.size === 2 || field.size === 4 || field.size === 8) {
        values[field.number] = readFitValue(
          view,
          offset,
          field.baseType,
          definition.littleEndian
        );
      }

      offset += field.size;
    }

    // Message global 18 = session
    if (definition.globalMessageNumber === 18) {
      session = {
        startTime: values[2] != null ? fitEpochToDate(values[2]) : null,
        sport: values[5],
        subSport: values[6],
        totalElapsedSeconds: values[7] != null ? values[7] / 1000 : 0,
        totalTimerSeconds: values[8] != null ? values[8] / 1000 : 0,
        totalDistanceKm: values[9] != null ? values[9] / 100000 : 0,
        avgHeartRate: values[16] ?? null,
        totalAscent: values[22] ?? null
      };
    }
  }

  if (!session) {
    throw new Error("Aucune séance n'a été trouvée dans ce fichier FIT.");
  }

  return {
    date: fitDate(session.startTime) || iso(new Date()),
    sport: fitSportLabel(session.sport),
    type: file.name.replace(/\.fit$/i, ""),
    distance: Number(session.totalDistanceKm.toFixed(2)),
    duration: Math.round(secondsToMinutes(
      session.totalTimerSeconds || session.totalElapsedSeconds
    )),
    elevation: session.totalAscent || "",
    avgHr: session.avgHeartRate || "",
    locationName: ""
  };
}

async function parseActivityFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "gpx") {
    const route = await parseGpx(file);
    const center = routeCenter(route);
    let locationName = "";

    if (center) {
      try {
        locationName = await reverseGeocode(
          center.latitude,
          center.longitude
        );
      } catch (error) {
        console.warn("HOME : lieu GPX non résolu.", error);
      }
    }

    return {
      date: route.startTime ? iso(new Date(route.startTime)) : iso(new Date()),
      sport: "Course à pied",
      type: file.name.replace(/\.gpx$/i, ""),
      distance: Number(route.distance.toFixed(2)),
      duration: Math.round(route.duration),
      elevation: "",
      avgHr: "",
      locationName,
      routeSummary: {
        file_name: file.name,
        point_count: route.points.length,
        start_time: route.startTime,
        end_time: route.endTime,
        center
      }
    };
  }

  if (extension === "fit") {
    return parseFit(file);
  }

  throw new Error("Format non pris en charge. Choisis un fichier .FIT ou .GPX.");
}

function fillActivityForm(data) {
  const form = $("#activityForm");
  if (!form) return;

  const values = {
    activity_date: data.date,
    sport: data.sport,
    activity_type: data.type,
    distance_km: data.distance,
    duration_min: data.duration,
    elevation_m: data.elevation,
    avg_hr: data.avgHr,
    location_name: data.locationName
  };

  Object.entries(values).forEach(([name, value]) => {
    if (form.elements[name] && value !== undefined && value !== null) {
      form.elements[name].value = value;
    }
  });

  form.dataset.routeSummary = data.routeSummary
    ? JSON.stringify(data.routeSummary)
    : "";
}

async function handleActivityFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  setActivityMessage("Lecture du fichier…");

  try {
    const parsed = await parseActivityFile(file);
    fillActivityForm(parsed);
    setActivityMessage("Fichier lu. Vérifie les données avant d'enregistrer.");
  } catch (error) {
    console.error("HOME : import impossible.", error);
    setActivityMessage(
      error.message || "Impossible de lire ce fichier.",
      true
    );
  }
}

async function saveActivity(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const values = new FormData(form);
  const user = await getCurrentUser();

  if (!user) {
    setActivityMessage("Aucun utilisateur connecté.", true);
    return;
  }

  const activityDate = String(values.get("activity_date") || "").trim();
  const sport = String(values.get("sport") || "").trim();
  const activityType = String(values.get("activity_type") || "").trim();

  if (!activityDate || !sport || !activityType) {
    setActivityMessage(
      "La date, le sport et le type d'activité sont obligatoires.",
      true
    );
    return;
  }

  const numberOrNull = (name) => {
    const raw = String(values.get(name) || "").trim();
    return raw === "" ? null : Number(raw);
  };

  let routeSummary = null;

  if (form.dataset.routeSummary) {
    try {
      routeSummary = JSON.parse(form.dataset.routeSummary);
    } catch {
      routeSummary = null;
    }
  }

  const payload = {
    user_id: user.id,
    activity_date: activityDate,
    sport,
    activity_type: activityType,
    status: String(values.get("status") || "done"),
    distance_km: numberOrNull("distance_km"),
    duration_min: numberOrNull("duration_min"),
    elevation_m: numberOrNull("elevation_m"),
    avg_hr: numberOrNull("avg_hr"),
    rpe: numberOrNull("rpe"),
    gear: String(values.get("gear") || "").trim() || null,
    location_name: String(values.get("location_name") || "").trim() || null,
    notes: String(values.get("notes") || "").trim() || null,
    route_summary: routeSummary
  };

  setActivityMessage("Enregistrement…");

  const { error } = await window.momentumDB
    .from("activities")
    .insert(payload);

  if (error) {
    console.error("HOME : activité non enregistrée.", error);
    setActivityMessage(
      error.message || "Impossible d'enregistrer l'activité.",
      true
    );
    return;
  }

  closeActivityDialog();
  await renderHome();
}


/* =========================================================
   Dialogue d'un jour
   ========================================================= */

function openDay(date) {
  const dialog = $("#dayDialog");
  const content = $("#dayDialogContent");

  if (!dialog || !content) return;

  const sessions = sessionsOn(date);

  content.innerHTML = `
    <span class="section-kicker">Journal</span>
    <h2>${escapeHtml(fmtDate(date))}</h2>
    ${
      sessions.length
        ? sessions.map((session) => `
            <article class="card">
              <span class="card-label">
                ${session.status === "done" ? "Réalisé" : "Prévu"}
              </span>
              <h3>${escapeHtml(sessionLabel(session))}</h3>
              <p>${escapeHtml(sessionMeta(session))}</p>
              <p class="muted">${escapeHtml(session.comment || "")}</p>
            </article>
          `).join("")
        : "<p>Aucune activité pour cette journée.</p>"
    }
  `;

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  }
}


/* =========================================================
   Rendu général
   ========================================================= */

async function renderHome() {
  const todayDate = new Date();
  const today = iso(todayDate);

  await Promise.all([
    renderHero(),
    loadPassportLocation(),
    loadActivitiesForHome(todayDate, visibleMonth)
  ]);

  const sessions = sessionsOn(today);

  renderToday(today, sessions);
  renderLivingWeek(todayDate);
  renderMonth();
  renderMissionCard();
  renderCalendarCard(today, sessions);
  renderActivityList(today, sessions);

  const weatherCard = $("#weatherCard");

  if (weatherCard) {
    weatherCard.innerHTML = `
      <span class="card-label">Météo</span>
      <h2>Chargement…</h2>
      <p>Recherche du décor du jour.</p>
    `;
  }

  const context = await getContextForDate(today);
  renderWeatherCard(context);
}


/* =========================================================
   Événements
   ========================================================= */

function bindHome() {
  $("#openActivityDialog")?.addEventListener("click", openActivityDialog);
  $("#closeActivityDialog")?.addEventListener("click", closeActivityDialog);
  $("#cancelActivity")?.addEventListener("click", closeActivityDialog);
  $("#activityFile")?.addEventListener("change", handleActivityFile);
  $("#activityForm")?.addEventListener("submit", saveActivity);

  $("#centerToday")?.addEventListener("click", () => {
    renderLivingWeek(new Date());
  });

  $("#prevMonth")?.addEventListener("click", async () => {
    visibleMonth = addMonths(visibleMonth, -1);
    await loadActivitiesForHome(new Date(), visibleMonth);
    renderMonth();
  });

  $("#nextMonth")?.addEventListener("click", async () => {
    visibleMonth = addMonths(visibleMonth, 1);
    await loadActivitiesForHome(new Date(), visibleMonth);
    renderMonth();
  });

  $("#todayBtn")?.addEventListener("click", async () => {
    visibleMonth = startOfMonth(new Date());
    await loadActivitiesForHome(new Date(), visibleMonth);
    renderMonth();
  });

  $("#livingWeek")?.addEventListener("click", (event) => {
    const day = event.target.closest("[data-date]");
    if (day?.dataset.date) openDay(day.dataset.date);
  });

  $("#monthGrid")?.addEventListener("click", (event) => {
    const day = event.target.closest("[data-date]");
    if (day?.dataset.date) openDay(day.dataset.date);
  });

  $("#closeDay")?.addEventListener("click", () => {
    $("#dayDialog")?.close();
  });
}


/* =========================================================
   Utilitaires DOM
   ========================================================= */

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


/* =========================================================
   Initialisation
   ========================================================= */

bindHome();
renderHome();