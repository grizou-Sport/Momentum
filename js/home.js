const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const storeKey = "momentum_v004";

const dayLong = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const months = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const sportsIcons = {
  "Course à pied": "🏃",
  "Vélo": "🚴",
  "Gravel / VTT": "🚵",
  "Musculation": "🏋️",
  "Natation": "🏊",
  "Randonnée": "⛰️",
  "Padel": "🎾",
  "Autre": "✨"
};

let state = loadState();

function iso(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function dateFromIso(value) {
  return new Date(`${value}T12:00:00`);
}

function fmtDate(value) {
  const d = dateFromIso(value);
  return `${dayLong[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(storeKey)) || defaultState();
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}

function defaultState() {
  return {
    profile: {
      athlete: "Chris",
      project: "Mission actuelle",
      tagline: "Transformer la donnée en histoire."
    },
    sessions: [],
    context: {}
  };
}

function weatherEmoji(code) {
  code = Number(code);
  if (code === 0) return "☀️";
  if ([1, 2].includes(code)) return "🌤️";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 95) return "⛈️";
  return "🌤️";
}

function weatherText(code) {
  code = Number(code);
  if (code === 0) return "ciel clair";
  if ([1, 2].includes(code)) return "temps lumineux";
  if (code === 3) return "ciel couvert";
  if ([45, 48].includes(code)) return "brouillard";
  if (code >= 51 && code <= 67) return "pluie";
  if (code >= 71 && code <= 77) return "neige";
  if (code >= 80 && code <= 82) return "averses";
  if (code >= 95) return "orage";
  return "conditions variables";
}

function timeOnly(value) {
  if (!value) return "—";
  const match = String(value).match(/T(\d{2}:\d{2})/);
  return match ? match[1] : String(value).slice(0, 5);
}

function sessionsOn(date) {
  return (state.sessions || [])
    .filter((s) => s.date === date)
    .sort((a, b) => (a.status === "done" ? -1 : 1));
}

function sessionIcon(session) {
  return sportsIcons[session.sport] || "✨";
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

async function getIpLocation() {
  const res = await fetch("https://ipapi.co/json/");
  if (!res.ok) throw new Error("IP location failed");

  const data = await res.json();

  return {
    locationName: data.city || "Lieu actuel",
    country: data.country_name || "",
    latitude: data.latitude,
    longitude: data.longitude,
    source: "ip"
  };
}

async function reverseGeocode(latitude, longitude) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${latitude}&lon=${longitude}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Reverse geocoding failed");

  const data = await res.json();
  const address = data.address || {};

  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    data.name ||
    "Lieu de l’activité"
  );
}

async function getWeather(latitude, longitude, date) {
  const today = iso(new Date());
  const isPast = date < today;

  const base = isPast
    ? "https://archive-api.open-meteo.com/v1/archive"
    : "https://api.open-meteo.com/v1/forecast";

  const params = new URLSearchParams({
    latitude,
    longitude,
    start_date: date,
    end_date: date,
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,wind_speed_10m_max",
    timezone: "auto"
  });

  const res = await fetch(`${base}?${params}`);
  if (!res.ok) throw new Error("Weather failed");

  const data = await res.json();
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

  const sessions = sessionsOn(date);
  const activityWithRoute = sessions.find((s) => s.route?.points?.length);
  const existing = state.context[date] || {};

  if (existing.weather && existing.locationName) {
    return existing;
  }

  try {
    let location;

    if (activityWithRoute) {
      const center = routeCenter(activityWithRoute.route);

      const placeName =
        activityWithRoute.placeName ||
        activityWithRoute.locationName ||
        (await reverseGeocode(center.latitude, center.longitude));

      location = {
        locationName: placeName,
        latitude: center.latitude,
        longitude: center.longitude,
        source: "activity"
      };
    } else {
      location = await getIpLocation();
    }

    const weather = await getWeather(location.latitude, location.longitude, date);

    state.context[date] = {
      ...existing,
      ...location,
      weather,
      fetchedAt: new Date().toISOString()
    };

    saveState();
    return state.context[date];
  } catch (error) {
    state.context[date] = {
      ...existing,
      locationName: existing.locationName || "Lieu indisponible",
      weatherError: true
    };

    saveState();
    return state.context[date];
  }
}

function renderWeatherCard(context) {
  const el = $("#weatherCard");
  if (!el) return;

  if (context.weatherError) {
    el.innerHTML = `
      <span class="card-label">Météo</span>
      <h2>Indisponible</h2>
      <p>Impossible de charger la météo pour le moment.</p>
    `;
    return;
  }

  const w = context.weather;

  if (!w) {
    el.innerHTML = `
      <span class="card-label">Météo</span>
      <h2>Chargement…</h2>
      <p>Recherche du décor du jour.</p>
    `;
    return;
  }

  el.innerHTML = `
    <span class="card-label">Météo</span>
    <h2>${weatherEmoji(w.code)} ${context.locationName}</h2>
    <p class="big-value">${Math.round(w.tMin)}° – ${Math.round(w.tMax)}°</p>
    <p>${weatherText(w.code)}</p>
    <p class="muted">
      Vent ${Math.round(w.wind || 0)} km/h · Pluie ${w.rain || 0} mm
    </p>
    <p class="muted">
      🌅 ${timeOnly(w.sunrise)} · 🌇 ${timeOnly(w.sunset)}
    </p>
  `;
}

function renderCalendarCard(date, sessions) {
  const el = $("#calendarCard");
  if (!el) return;

  const main = sessions[0];

  el.innerHTML = `
    <span class="card-label">Calendrier</span>
    <h2>${fmtDate(date)}</h2>
    ${
      main
        ? `
          <p class="big-value">${sessionIcon(main)} ${main.type || "Séance"}</p>
          <p>${main.distance ? `${main.distance} km` : ""} ${
            main.duration ? `· ${main.duration} min` : ""
          }</p>
          <p class="muted">${main.comment || "Séance enregistrée."}</p>
        `
        : `
          <p class="big-value">Aucune séance</p>
          <p class="muted">La journée est libre ou encore à écrire.</p>
        `
    }
  `;
}

function renderMissionCard() {
  const el = $("#missionCard");
  if (!el) return;

  const profile = state.profile || {};

  el.innerHTML = `
    <span class="card-label">Mission</span>
    <h2>${profile.project || "Mission actuelle"}</h2>
    <p>${profile.tagline || "Transformer la donnée en histoire."}</p>
  `;
}

function renderActivityList(date, sessions) {
  const el = $("#activityList");
  if (!el) return;

  if (!sessions.length) {
    el.innerHTML = `
      <article class="home-card">
        <span class="card-label">Activités</span>
        <h2>Aucune activité</h2>
        <p>Importe un GPX pour créer le premier chapitre.</p>
      </article>
    `;
    return;
  }

  el.innerHTML = sessions
    .map(
      (s) => `
      <article class="home-card activity-card">
        <span class="card-label">${s.status === "done" ? "Réalisé" : "Prévu"}</span>
        <h2>${sessionIcon(s)} ${s.type || "Activité"}</h2>
        <p>
          ${s.sport || "Sport"}
          ${s.distance ? ` · ${s.distance} km` : ""}
          ${s.duration ? ` · ${s.duration} min` : ""}
        </p>
        <p class="muted">${s.locationName || s.placeName || "Lieu à définir"}</p>
      </article>
    `
    )
    .join("");
}

async function parseGpx(file) {
  const text = await file.text();
  const xml = new DOMParser().parseFromString(text, "application/xml");

  const points = [...xml.querySelectorAll("trkpt")]
    .map((p) => ({
      lat: Number(p.getAttribute("lat")),
      lon: Number(p.getAttribute("lon")),
      ele: Number(p.querySelector("ele")?.textContent || 0),
      time: p.querySelector("time")?.textContent || null
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  return {
    name: file.name,
    points,
    startTime: points.find((p) => p.time)?.time || null,
    endTime: [...points].reverse().find((p) => p.time)?.time || null
  };
}

async function handleGpxImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const today = iso(new Date());
  const route = await parseGpx(file);

  const center = routeCenter(route);
  let placeName = "Lieu de l’activité";

  if (center) {
    try {
      placeName = await reverseGeocode(center.latitude, center.longitude);
    } catch {
      placeName = "Lieu de l’activité";
    }
  }

  const activity = {
    id: uid(),
    date: today,
    status: "done",
    sport: "Course à pied",
    type: route.name.replace(".gpx", ""),
    distance: 0,
    duration: 0,
    comment: "Activité importée depuis un fichier GPX.",
    route,
    placeName,
    locationName: placeName,
    startTime: route.startTime,
    endTime: route.endTime
  };

  state.sessions = state.sessions || [];
  state.sessions.push(activity);

  state.context = state.context || {};
  delete state.context[today];

  saveState();

  event.target.value = "";
  renderHome();
}

async function renderHome() {
  const today = iso(new Date());
  const sessions = sessionsOn(today);

  renderMissionCard();
  renderCalendarCard(today, sessions);
  renderActivityList(today, sessions);

  const context = await getContextForDate(today);
  renderWeatherCard(context);
}

function bindHome() {
  const importInput = $("#gpxImport");
  if (importInput) {
    importInput.addEventListener("change", handleGpxImport);
  }

  const resetBtn = $("#resetHomeBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      localStorage.removeItem(storeKey);
      state = defaultState();
      saveState();
      renderHome();
    });
  }
}

bindHome();
renderHome();
