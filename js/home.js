/* =========================================================
   MOMENTUM — HOME v0.09
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
   Hero
   ========================================================= */

function renderHero() {
  const profile = state.profile || {};

  setText("#heroTitle", profile.project || "Mon Horizon");
  setText(
    "#heroQuote",
    profile.tagline || "Chaque journée écrit une ligne du chemin."
  );

  // Valeurs provisoires tant que Mon Horizon n'est pas raccordé à Supabase.
  setText("#daysLeft", "—");
  setText("#targetDateLabel", "Date à définir");
  setText("#missionProgress", "—");
  setText("#goalLabel", "À définir");
  setText("#paceLabel", "À définir");
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

    state.sessions = state.sessions || [];
    state.sessions.push(activity);
    saveState();

    renderHome();
  } catch (error) {
    console.error("HOME : import GPX impossible.", error);
    window.alert(error.message || "Impossible d'importer ce fichier GPX.");
  } finally {
    event.target.value = "";
  }
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
  const today = iso(new Date());
  const sessions = sessionsOn(today);

  renderHero();
  renderToday(today, sessions);
  renderLivingWeek(new Date());
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
  $("#gpxImport")?.addEventListener("change", handleGpxImport);

  $("#centerToday")?.addEventListener("click", () => {
    renderLivingWeek(new Date());
  });

  $("#prevMonth")?.addEventListener("click", () => {
    visibleMonth = addMonths(visibleMonth, -1);
    renderMonth();
  });

  $("#nextMonth")?.addEventListener("click", () => {
    visibleMonth = addMonths(visibleMonth, 1);
    renderMonth();
  });

  $("#todayBtn")?.addEventListener("click", () => {
    visibleMonth = startOfMonth(new Date());
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