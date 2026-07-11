/* =========================================================
   MOMENTUM — HOME WEATHER v1.0
   ---------------------------------------------------------
   Météo du lieu défini dans le Passeport.
   ========================================================= */

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
