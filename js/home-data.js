/* =========================================================
   MOMENTUM — HOME DATA v1.0
   ---------------------------------------------------------
   Accès aux données Supabase et adaptation des enregistrements.
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
