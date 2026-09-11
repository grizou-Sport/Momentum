/* =========================================================
   MOMENTUM — HOME v1.0
   ---------------------------------------------------------
   Orchestrateur : initialise les modules de la page HOME.
   ========================================================= */

async function renderHome() {
  if (window.momentumPageReady) await window.momentumPageReady;
  const todayDate = new Date();
  const today = iso(todayDate);

  const activityList = $("#activityList");
  if (activityList && !(state.sessions || []).length) activityList.innerHTML = '<div class="day-feed-empty" role="status"><h4>Chargement des Moments…</h4></div>';

  try {
    await Promise.all([
      renderHero(),
      loadPassportLocation(),
      loadActivitiesForHome(todayDate, visibleMonth),
      loadDailyWellbeing(today)
    ]);
  } catch (error) {
    console.error("HOME : données momentanément indisponibles.", error);
    if (activityList && !(state.sessions || []).length) activityList.innerHTML = `
      <div class="day-feed-empty" role="alert">
        <h4>Les Moments n’ont pas pu être chargés.</h4>
        <p>Réessaie dans un instant.</p>
        <button class="secondary" type="button" data-home-retry>Réessayer</button>
      </div>`;
    return;
  }

  const sessions = sessionsOn(today);

  renderToday(today, sessions);
  renderLivingWeek(todayDate);
  renderMonth();
  renderActivityList(today, sessions);
  renderWellbeingCard(today);

  const weatherCard = $("#weatherCard");

  if (weatherCard) {
    weatherCard.innerHTML = `
      <span class="card-label">Météo</span>
      <h2>Chargement…</h2>
      <p>Recherche du décor du jour.</p>
    `;
  }

  try { const livingContexts = await loadLivingWeatherWindow();renderLivingWeekWeather(livingContexts);const context=livingContexts[today]||await getContextForDate(today);renderWeatherCard(context); }
  catch(_){if(weatherCard)weatherCard.innerHTML='<span class="card-label">Météo</span><h2>Contexte indisponible</h2><p>Ton Journal reste disponible. La météo pourra être rechargée plus tard.</p>';}

}

function bindHome() {
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-home-retry]")) renderHome();
  });
  $("#closeActivityDialog")?.addEventListener("click", closeActivityDialog);
  $("#cancelActivity")?.addEventListener("click", closeActivityDialog);
  $("#activityFile")?.addEventListener("change", handleActivityFile);
  $("#activityForm")?.addEventListener("submit", saveActivity);
  $("#activityNutritionButton")?.addEventListener("click", openActivityFormNutrition);

  $("#centerToday")?.addEventListener("click", async () => {
    renderLivingWeek(new Date());
    centerLivingWeekOnToday();
    const contexts = await loadLivingWeatherWindow();
    renderLivingWeekWeather(contexts);
  });

  // Deliberate horizontal browsing survives visibility changes and data refreshes.

  $("#prevMonth")?.addEventListener("click", async () => {
    visibleMonth = addMonths(visibleMonth, -1);
    await loadActivitiesForHome(new Date(), visibleMonth);
    renderMonth();
  });

  $("#nextMonth")?.addEventListener("click", async () => {
    visibleMonth = addMonths(visibleMonth, 1);
    await loadActivitiesForHome(new Date(), visibleMonth);
    renderMonth();
  });

  $("#todayBtn")?.addEventListener("click", async () => {
    visibleMonth = startOfMonth(new Date());
    await loadActivitiesForHome(new Date(), visibleMonth);
    renderMonth();
  });

  $("#livingWeek")?.addEventListener("click", async (event) => {
    const moonTrigger = event.target.closest("[data-moon-date]");
    if (moonTrigger?.dataset.moonDate) {
      openMoonDialog(moonTrigger.dataset.moonDate);
      return;
    }

    const day = event.target.closest("[data-date]");
    if (day?.dataset.date) await openDay(day.dataset.date);
  });

  $("#closeMoonDialog")?.addEventListener("click", closeMoonDialog);
  $("#moonDialog")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeMoonDialog();
  });

  $("#monthGrid")?.addEventListener("click", async (event) => {
    const day = event.target.closest("[data-date]");
    if (day?.dataset.date) await openDay(day.dataset.date);
  });

  $("#openToday")?.addEventListener("click", async () => {
    await openDay(iso(new Date()));
  });

  $("#closeDay")?.addEventListener("click", () => {
    closeHomeDialog($("#dayDialog"));
  });

  $("#dayDialogContent")?.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const action = actionButton.dataset.action;
    const date =
      actionButton.dataset.date || $("#dayDialog")?.dataset.date;

    if (action === "add-moment" && date) {
      closeHomeDialog($("#dayDialog"));
      openActivityDialog(date, true);
      return;
    }

    if (["add-wellbeing", "edit-wellbeing"].includes(action) && date) {
      closeHomeDialog($("#dayDialog"));
      await openWellbeingDialog(date, true);
      return;
    }

    if (action === "delete-wellbeing" && date) {
      await deleteWellbeing(date, date);
      return;
    }

    if (action === "edit-nutrition") {
      const activityId = actionButton.dataset.activityId;
      const activity = (state.sessions || []).find((session) => session.id === activityId);
      if (activity) await window.MomentumNutrition?.open(activity, date);
      return;
    }

    if (action === "edit-moment") {
      const activityId = actionButton.dataset.activityId;
      if (activityId) {
        closeHomeDialog($("#dayDialog"));
        openEditActivityDialog(activityId);
      }
      return;
    }

    if (action === "delete-moment") {
      const activityId = actionButton.dataset.activityId;
      if (activityId && date) {
        await deleteActivity(activityId, date);
      }
    }
  });
}


document.addEventListener("DOMContentLoaded", () => {
  bindHome();
  bindWellbeingCard();
  bindWellbeingDialog();
  renderHome();
});
