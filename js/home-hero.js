/* =========================================================
   MOMENTUM — HOME HERO v1.0
   ---------------------------------------------------------
   Raccordement de Mon Horizon et rendu de la couverture.
   ========================================================= */

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
