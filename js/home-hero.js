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

function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;

  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);

  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")}`;
  return `${minutes} min`;
}

function heroIntentionLabel(value) {
  const labels = {
    discovery: "Découverte",
    challenge: "Challenge",
    progression: "Progression",
    performance: "Performance",
    transformation: "Transformation",
    sharing: "Partage",
    wellbeing: "Bien-être",
    escape: "Évasion"
  };

  return labels[value] || value || "À définir";
}

function heroSportLabel(value) {
  if (!value) return "À définir";
  return window.MomentumSports?.resolve(value)?.label || value;
}

function createHeroDetail(label, value) {
  return { label, value: value || "À définir" };
}

function getHeroDetails(horizon) {
  const details = [
    createHeroDetail("Intention", heroIntentionLabel(horizon.subcategory)),
    createHeroDetail("Date cible", formatHeroDate(horizon.target_date))
  ];

  if (horizon.category === "adventure") {
    const duration = Number(horizon.duration_days);

    details.push(
      createHeroDetail(
        "Durée",
        Number.isFinite(duration) && duration > 0
          ? `${duration} jour${duration > 1 ? "s" : ""}`
          : "À définir"
      ),
      createHeroDetail("Sport / activité", heroSportLabel(horizon.sport))
    );
  }

  if (horizon.category === "competition") {
    const distance = Number(horizon.distance_km);

    details.push(
      createHeroDetail(
        "Distance",
        Number.isFinite(distance) && distance > 0
          ? `${formatNumber(distance)} km`
          : "À définir"
      ),
      createHeroDetail(
        "Temps prévu",
        formatDuration(horizon.target_time_seconds) || "À définir"
      ),
      createHeroDetail("Sport / activité", heroSportLabel(horizon.sport))
    );
  }

  if (horizon.category === "pleasure") {
    details.push(
      createHeroDetail("Sport / activité", heroSportLabel(horizon.sport))
    );
  }

  return details;
}

function renderHeroDetails(details) {
  const element = $("#heroDetails");
  if (!element) return;

  element.dataset.items = String(details.length);
  element.innerHTML = details.map((detail) => `
    <div>
      <span>${escapeHtml(detail.value)}</span>
      <small>${escapeHtml(detail.label)}</small>
    </div>
  `).join("");
}

function renderHeroEmpty() {
  setText("#heroTitle", "Mon Horizon");
  setText("#heroQuote", "Chaque journée écrit une ligne du chemin.");
  renderHeroDetails([
    createHeroDetail("Intention", "À définir"),
    createHeroDetail("Date cible", "À définir")
  ]);
}

async function renderHero() {
  const horizon = await loadActiveHorizon();

  if (!horizon) {
    renderHeroEmpty();
    return;
  }

  setText("#heroTitle", horizon.title || "Mon Horizon");
  setText(
    "#heroQuote",
    horizon.description || "Chaque journée écrit une ligne du chemin."
  );

  renderHeroDetails(getHeroDetails(horizon));

  state.profile = {
    ...(state.profile || {}),
    project: horizon.title || "",
    tagline: horizon.description || ""
  };
}
