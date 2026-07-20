/* =========================================================
   MOMENTUM — HOME CALENDAR v1.0
   ---------------------------------------------------------
   Aujourd’hui, fenêtre vivante et calendrier mensuel.
   ========================================================= */

function renderToday(date, sessions) {
  const title = $("#todayTitle");
  const narrative = $("#todayNarrative");

  if (title) title.textContent = fmtDate(date);

  if (narrative) {
    narrative.textContent = sessions.length
      ? `${sessions.length} moment${sessions.length > 1 ? "s" : ""} inscrit${sessions.length > 1 ? "s" : ""} aujourd'hui.`
      : "Aucun Moment inscrit aujourd’hui. Une journée calme fait aussi partie du chemin.";
  }
}

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
      : "Rien n’est encore prévu";

    return `
      <button
        type="button"
        class="living-day${isToday ? " is-today" : ""}"
        data-date="${dateIso}"
        data-day-offset="${index - 3}"
        data-today="${isToday ? "true" : "false"}"
      >
        <span class="card-label">${escapeHtml(fmtShortDate(dateIso))}</span>
        <div
          class="living-weather is-loading"
          data-living-weather="${dateIso}"
        >
          <span>Météo…</span>
        </div>
        <div class="living-moments">
          <div class="calendar-session-icons">${sessionIconsHtml(sessions, "calendar-session-icon")}</div>
          <strong>${sessions.length || "—"}</strong>
          <p>${escapeHtml(summary)}</p>
        </div>
      </button>
    `;
  }).join("");

  centerLivingWeekOnToday(container);
}

function centerLivingWeekOnToday(container = $("#livingWeek"), behavior = "auto") {
  if (!container || !window.matchMedia("(max-width:760px)").matches) return;

  window.requestAnimationFrame(() => {
    const todayCard = container.querySelector('[data-today="true"]');
    if (!todayCard) return;
    const containerRect = container.getBoundingClientRect();
    const cardRect = todayCard.getBoundingClientRect();
    const left = container.scrollLeft + cardRect.left - containerRect.left - (container.clientWidth - cardRect.width) / 2;
    container.scrollTo({ left:Math.max(0, left), behavior });
  });
}

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
        <span class="card-label month-day-label">${escapeHtml(fmtShortDate(dateIso))}</span>
        <div class="month-day-moments">
          <div class="calendar-session-icons">${sessionIconsHtml(sessions, "calendar-session-icon")}</div>
          <strong>${sessions.length || "—"}</strong>
          <p>${sessions.length ? `${sessions.length} Moment${sessions.length > 1 ? "s" : ""}` : "Rien d’inscrit"}</p>
        </div>
      </button>
    `;
  }).join("");
}

function dayCategoryLabel(category) {
  const labels = {
    sport: "Sport",
    wellbeing: "Bien-être",
    adventure: "Aventure",
    shared: "Moment partagé"
  };

  return labels[category] || "Moment";
}

function activityValue(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }

  return null;
}

function activityMetricNumber(value, maximumFractionDigits = 0) {
  return Number(value).toLocaleString("fr-CH", {
    maximumFractionDigits
  });
}

function activityDurationLabel(seconds) {
  const value = activityValue(seconds);
  if (value === null) return "";

  const minutes = value / 60;
  return window.MomentumDuration?.format(minutes) || `${Math.round(minutes)} min`;
}

function activityClockLabel(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("fr-CH", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function activityTimeRange(session) {
  const start = activityClockLabel(session.startedAt) ||
    (session.time ? String(session.time).slice(0, 5) : "");
  const end = activityClockLabel(session.endedAt);

  if (start && end) return `${start} → ${end}`;
  return start;
}

function activityDateLabel(value) {
  return new Intl.DateTimeFormat("fr-CH", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(dateFromIso(value));
}

function activityDeviceLabel(session) {
  const manufacturerAliases = {
    coros: "COROS",
    garmin: "Garmin",
    hammerhead: "Hammerhead",
    polar: "Polar",
    suunto: "Suunto",
    wahoo: "Wahoo",
    whoop: "WHOOP"
  };
  const rawManufacturer = String(session.deviceManufacturer || "").trim();
  const manufacturer = manufacturerAliases[rawManufacturer.toLowerCase()] || rawManufacturer;
  const model = String(session.deviceModel || "").trim();

  if (!manufacturer) return model;
  if (!model) return manufacturer;
  if (model.toLowerCase().includes(manufacturer.toLowerCase())) return model;
  return `${manufacturer} ${model}`;
}

function activityImportLabel(session) {
  if (!session.sourceFileType) return "";
  const device = activityDeviceLabel(session);
  return `Import automatique${device ? ` • ${device}` : ""}`;
}

function activityMetricItems(session) {
  const distanceMeters = activityValue(
    session.distanceMeters,
    activityValue(session.distance, session.distance_km) === null
      ? null
      : activityValue(session.distance, session.distance_km) * 1000
  );
  const totalDurationSeconds = activityValue(
    session.totalDurationSeconds,
    activityValue(session.duration, session.duration_min) === null
      ? null
      : activityValue(session.duration, session.duration_min) * 60
  );
  const movingTimeSeconds = activityValue(session.movingTimeSeconds);
  const pausedTimeSeconds = activityValue(session.pausedTimeSeconds);
  const ascentMeters = activityValue(
    session.totalAscentMeters,
    session.elevation,
    session.elevation_m
  );
  const averageHeartRate = activityValue(
    session.averageHeartRateBpm,
    session.hr,
    session.avg_hr
  );
  const calories = activityValue(session.caloriesKcal);

  return [
    distanceMeters === null ? null : {
      label: "Distance",
      value: `${activityMetricNumber(distanceMeters / 1000, 2)} km`
    },
    totalDurationSeconds === null ? null : {
      label: "Durée totale",
      value: activityDurationLabel(totalDurationSeconds)
    },
    movingTimeSeconds === null ? null : {
      label: "Temps en mouvement",
      value: activityDurationLabel(movingTimeSeconds)
    },
    pausedTimeSeconds === null ? null : {
      label: "Temps de pause",
      value: activityDurationLabel(pausedTimeSeconds)
    },
    ascentMeters === null ? null : {
      label: "Dénivelé positif",
      value: `${activityMetricNumber(ascentMeters)} m`
    },
    averageHeartRate === null ? null : {
      label: "Fréquence cardiaque moyenne",
      value: `${activityMetricNumber(averageHeartRate)} bpm`
    },
    calories === null ? null : {
      label: "Calories",
      value: `${activityMetricNumber(calories)} kcal`
    }
  ].filter(Boolean);
}

function renderActivityMetrics(session) {
  const metrics = activityMetricItems(session);
  if (!metrics.length) return "";

  return `
    <section class="activity-detail-metrics" aria-label="Indicateurs de l’activité">
      <dl>
        ${metrics.map((metric) => `
          <div class="activity-detail-metric">
            <dt>${escapeHtml(metric.label)}</dt>
            <dd>${escapeHtml(metric.value)}</dd>
          </div>
        `).join("")}
      </dl>
    </section>
  `;
}

function renderPersonalActivityCard(session, date) {
  const timeRange = activityTimeRange(session);
  const importLabel = activityImportLabel(session);
  const hasRoute = Array.isArray(session.routeSummary?.map_points) &&
    session.routeSummary.map_points.length >= 2;

  return `
    <article class="day-moment-card activity-detail-card">
      <header class="activity-detail-header">
        <span class="card-label">
          ${escapeHtml(sessionStatusLabel(session))}
          · ${escapeHtml(dayCategoryLabel(session.category))}
        </span>
        <h3>${escapeHtml(sessionLabel(session))}</h3>
        <div class="activity-detail-context">
          ${session.sport
            ? `<span class="activity-detail-sport">${escapeHtml(activitySportLabel(session.sport))}</span>`
            : ""}
          ${session.locationName
            ? `<span class="activity-detail-location">📍 Départ : ${escapeHtml(session.locationName)}</span>`
            : ""}
          <time datetime="${escapeHtml(date)}">${escapeHtml(activityDateLabel(date))}</time>
          ${timeRange ? `<span>${escapeHtml(timeRange)}</span>` : ""}
        </div>
        ${session.comment
          ? `<p class="activity-detail-comment">${escapeHtml(session.comment)}</p>`
          : ""}
        ${importLabel
          ? `<p class="activity-detail-import">${escapeHtml(importLabel)}</p>`
          : ""}
      </header>

      ${renderActivityMetrics(session)}

      ${hasRoute ? `
        <section class="activity-detail-map" aria-label="Parcours de l’activité">
          <div
            class="momentum-map activity-route-map"
            data-route-map="${escapeHtml(session.id)}"
            aria-label="Trace de ${escapeHtml(sessionLabel(session))}"
          ></div>
        </section>
      ` : ""}

      <footer class="day-moment-actions activity-detail-actions">
        <button
          type="button"
          class="day-edit-moment"
          data-action="edit-moment"
          data-activity-id="${session.id}"
          data-date="${date}"
        >Modifier</button>

        <button
          type="button"
          class="day-delete-moment"
          data-action="delete-moment"
          data-activity-id="${session.id}"
          data-date="${date}"
        >Supprimer</button>
      </footer>
    </article>
  `;
}

function renderSharedMomentCard(session) {
  return `
    <article class="day-moment-card">
      <div class="day-moment-content">
        <span class="card-label">
          ${escapeHtml(sessionStatusLabel(session))}
          · ${escapeHtml(dayCategoryLabel(session.category))}
        </span>
        <h3>${escapeHtml(sessionLabel(session))}</h3>
        ${sessionMeta(session)
          ? `<p class="day-moment-meta">${escapeHtml(sessionMeta(session))}</p>`
          : ""}
        ${session.locationName
          ? `<p class="muted">${escapeHtml(session.locationName)}</p>`
          : ""}
        ${session.comment ? `<p>${escapeHtml(session.comment)}</p>` : ""}
      </div>
      <div class="day-moment-actions">
        <a
          class="day-open-shared-moment"
          href="together.html?moment=${encodeURIComponent(session.momentId)}"
        >Ouvrir dans TOGETHER</a>
      </div>
    </article>
  `;
}

async function openDay(date) {
  const dialog = $("#dayDialog");
  const content = $("#dayDialogContent");

  if (!dialog || !content) return;

  const sessions = sessionsOn(date);
  const wellbeing = date <= iso(new Date()) ? await loadDailyWellbeing(date) : null;
  dialog.dataset.date = date;

  content.querySelectorAll("[data-route-map]")
    .forEach((mapElement) => {
      window.MomentumMap?.clear(mapElement);
    });

  content.innerHTML = `
    <div class="day-dialog-head">
      <div>
        <span class="section-kicker">La journée</span>
        <h2>${escapeHtml(fmtDate(date))}</h2>
        <p class="muted">
          ${sessions.length
            ? `${sessions.length} moment${sessions.length > 1 ? "s" : ""} inscrit${sessions.length > 1 ? "s" : ""}.`
            : "Rien n’est encore prévu pour cette journée."}
        </p>
      </div>

      <button
        type="button"
        class="primary day-add-moment"
        data-action="add-moment"
        data-date="${date}"
      >Ajouter un moment</button>
    </div>

    ${date <= iso(new Date()) ? `
      <section class="day-wellbeing-summary" aria-labelledby="dayWellbeingTitle">
        <div class="day-wellbeing-heading">
          <div>
            <span class="card-label">Le corps ce jour-là</span>
            <h3 id="dayWellbeingTitle">Résumé de mon bien-être</h3>
          </div>
          ${wellbeing?.source ? `<span class="wellbeing-source">${escapeHtml(wellbeing.source)}</span>` : ""}
        </div>
        ${wellbeingSummaryHtml(wellbeing)}
        <div class="day-wellbeing-actions">
          <button
            type="button"
            class="day-edit-moment"
            data-action="${wellbeingHasData(wellbeing) ? "edit-wellbeing" : "add-wellbeing"}"
            data-date="${date}"
          >${wellbeingHasData(wellbeing) ? "Modifier" : "Ajouter des données"}</button>
          ${wellbeingHasData(wellbeing) ? `
            <button
              type="button"
              class="day-delete-moment"
              data-action="delete-wellbeing"
              data-date="${date}"
            >Supprimer</button>
          ` : ""}
        </div>
      </section>
    ` : ""}

    <div class="day-moment-list">
      ${sessions.length
        ? sessions.map((session) => session.source === "shared_moment"
          ? renderSharedMomentCard(session)
          : renderPersonalActivityCard(session, date)
        ).join("")
        : `
            <div class="day-empty">
              <p>Rien n’est encore prévu pour cette journée.</p>
              <button
                type="button"
                class="secondary"
                data-action="add-moment"
                data-date="${date}"
              >Ajouter un Moment</button>
            </div>
          `}
    </div>
  `;

  openHomeDialog(dialog);

  content.querySelectorAll("[data-route-map]")
    .forEach((mapElement) => {
      const session = sessions.find(
        (item) => item.id === mapElement.dataset.routeMap
      );

      if (session?.routeSummary?.map_points) {
        window.MomentumMap?.renderRoute(
          mapElement,
          session.routeSummary.map_points
        );
      }
    });
}
