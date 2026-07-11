/* =========================================================
   MOMENTUM — HOME CALENDAR v1.0
   ---------------------------------------------------------
   Aujourd’hui, fenêtre vivante et calendrier mensuel.
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
