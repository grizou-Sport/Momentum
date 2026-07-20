/* =========================================================
   MOMENTUM — HOME DATA v1.0
   ---------------------------------------------------------
   Accès aux données Supabase et adaptation des enregistrements.
   ========================================================= */

const ACTIVITY_HOME_FIELDS = [
  "id", "user_id", "sport", "activity_type", "status",
  "distance_km", "duration_min", "elevation_m", "avg_hr", "rpe",
  "gear", "notes", "created_at", "activity_date", "activity_time",
  "weather", "location_name", "route_summary", "activity_category",
  "source_file_url", "source_file_type", "gpx_url",
  "started_at", "ended_at", "total_duration_seconds",
  "moving_time_seconds", "paused_time_seconds", "distance_m",
  "total_ascent_m", "average_heart_rate_bpm", "calories_kcal",
  "device_manufacturer", "device_model"
].join(",");

function sessionsOn(date) {
  return (state.sessions || [])
    .filter((session) => session.date === date)
    .sort((a, b) => {
      const aRank = a.status === "done" || a.calendarStatus === "past" ? 0 : 1;
      const bRank = b.status === "done" || b.calendarStatus === "past" ? 0 : 1;

      if (aRank !== bRank) return aRank - bRank;
      return String(a.sortAt || a.createdAt || "")
        .localeCompare(String(b.sortAt || b.createdAt || ""));
    });
}

function mapActivityRow(row) {
  return {
    id: row.id,
    date: row.activity_date,
    time: row.activity_time || "",
    status: row.status || "done",
    category: row.activity_category || "sport",
    activity_category: row.activity_category || "sport",
    sport: row.sport || "",
    type: row.activity_type || "",
    distance: row.distance_km,
    duration: row.duration_min,
    elevation: row.elevation_m,
    hr: row.avg_hr,
    startedAt: row.started_at || null,
    endedAt: row.ended_at || null,
    totalDurationSeconds: row.total_duration_seconds,
    movingTimeSeconds: row.moving_time_seconds,
    pausedTimeSeconds: row.paused_time_seconds,
    distanceMeters: row.distance_m,
    totalAscentMeters: row.total_ascent_m,
    averageHeartRateBpm: row.average_heart_rate_bpm,
    caloriesKcal: row.calories_kcal,
    deviceManufacturer: row.device_manufacturer || "",
    deviceModel: row.device_model || "",
    rpe: row.rpe,
    gear: row.gear || "",
    comment: row.notes || "",
    locationName: row.location_name || "",
    placeName: row.location_name || "",
    routeSummary: row.route_summary || null,
    sourceFileUrl: row.source_file_url || null,
    sourceFileType: row.source_file_type || null,
    gpxUrl: row.gpx_url || null,
    weather: row.weather || null,
    createdAt: row.created_at,
    sortAt: row.activity_time || row.created_at,
    source: "activity"
  };
}

function sharedMomentCalendarStatus(row, today = iso(new Date())) {
  const calendarStatus = window.MomentumMoments?.calendarStatus(row, today);
  return calendarStatus === "planning" ? null : calendarStatus;
}

function mapSharedMomentRow(row, today = iso(new Date())) {
  const calendarStatus = sharedMomentCalendarStatus(row, today);

  if (!calendarStatus) return null;

  return {
    id: row.id,
    momentId: row.id,
    date: iso(new Date(row.start_at)),
    status: row.status,
    calendarStatus,
    category: "shared",
    activity_category: "shared",
    type: row.title || "Moment partagé",
    momentType: row.moment_type || "OTHER",
    startAt: row.start_at,
    endAt: row.end_at || null,
    locationName: row.location_name || "",
    placeName: row.location_name || "",
    comment: row.description || "",
    clubId: row.club_id || null,
    createdAt: row.created_at,
    sortAt: row.start_at,
    source: "shared_moment"
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

  const momentRangeStart = new Date(
    rangeStart.getFullYear(),
    rangeStart.getMonth(),
    rangeStart.getDate()
  ).toISOString();
  const dayAfterRangeEnd = addDays(rangeEnd, 1);
  const momentRangeEnd = new Date(
    dayAfterRangeEnd.getFullYear(),
    dayAfterRangeEnd.getMonth(),
    dayAfterRangeEnd.getDate()
  ).toISOString();

  const [activitiesResult, momentsResult] = await Promise.all([
    window.momentumDB
      .from("activities")
      .select(ACTIVITY_HOME_FIELDS)
      .eq("user_id", user.id)
      .gte("activity_date", iso(rangeStart))
      .lte("activity_date", iso(rangeEnd))
      .order("activity_date", { ascending: true })
      .order("created_at", { ascending: true }),
    window.momentumDB
      .from("moments")
      .select(
        "id,title,description,moment_type,status,start_at,end_at,location_name,club_id,created_at"
      )
      .in("status", ["CONFIRMED", "ONGOING", "COMPLETED", "CANCELLED"])
      .not("start_at", "is", null)
      .gte("start_at", momentRangeStart)
      .lt("start_at", momentRangeEnd)
      .order("start_at", { ascending: true })
  ]);

  if (activitiesResult.error) {
    console.error(
      "HOME : impossible de charger les activités du calendrier.",
      activitiesResult.error
    );
  }

  if (momentsResult.error) {
    console.error(
      "HOME : impossible de charger les Moments partagés du calendrier.",
      momentsResult.error
    );
  }

  const firstError = activitiesResult.error || momentsResult.error;
  if (firstError) throw firstError;

  const activities = (activitiesResult.data || [])
    .filter((row) => row.activity_date)
    .map(mapActivityRow);
  const sharedMoments = (momentsResult.data || [])
    .map((row) => mapSharedMomentRow(row))
    .filter(Boolean);

  state.sessions = [...activities, ...sharedMoments];

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
