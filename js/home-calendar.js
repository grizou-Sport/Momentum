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
      : "La journée est libre ou encore à écrire.";
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
      : "Aucun moment";

    return `
      <button
        type="button"
        class="living-day${isToday ? " is-today" : ""}"
        data-date="${dateIso}"
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
          <p>${sessions.length ? `${sessions.length} moment${sessions.length > 1 ? "s" : ""}` : "Aucun moment"}</p>
        </div>
      </button>
    `;
  }).join("");
}

function dayCategoryLabel(category) {
  const labels = {
    sport: "Sport",
    wellbeing: "Bien-être",
    adventure: "Aventure"
  };

  return labels[category] || "Moment";
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
            : "La page est encore blanche."}
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
        ? sessions.map((session) => `
            <article class="day-moment-card">
              <div class="day-moment-content">
                <span class="card-label">
                  ${session.status === "done" ? "Réalisé" : "Prévu"}
                  · ${escapeHtml(dayCategoryLabel(session.category))}
                </span>
                <h3>${escapeHtml(sessionLabel(session))}</h3>
                ${sessionMeta(session)
                  ? `<p class="day-moment-meta">${escapeHtml(sessionMeta(session))}</p>`
                  : ""}
                ${session.locationName
                  ? `<p class="muted">${escapeHtml(session.locationName)}</p>`
                  : ""}
                ${session.comment
                  ? `<p>${escapeHtml(session.comment)}</p>`
                  : ""}
                ${session.sourceFileType
                  ? `<span class="day-file-label">Fichier ${escapeHtml(session.sourceFileType.toUpperCase())}</span>`
                  : ""}
                ${Array.isArray(session.routeSummary?.map_points) &&
                  session.routeSummary.map_points.length >= 2
                  ? `
                    <div
                      class="momentum-map activity-route-map"
                      data-route-map="${escapeHtml(session.id)}"
                      aria-label="Trace de ${escapeHtml(sessionLabel(session))}"
                    ></div>
                  `
                  : ""}
              </div>

              <div class="day-moment-actions">
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
              </div>
            </article>
          `).join("")
        : `
            <div class="day-empty">
              <p>Aucun moment pour cette journée.</p>
              <button
                type="button"
                class="secondary"
                data-action="add-moment"
                data-date="${date}"
              >Écrire le premier moment</button>
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
