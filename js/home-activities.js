/* =========================================================
   MOMENTUM — HOME ACTIVITIES v1.0
   ---------------------------------------------------------
   Pop-up, formulaire et enregistrement des activités.
   ========================================================= */

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
