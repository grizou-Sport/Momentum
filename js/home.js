/* =========================================================
   MOMENTUM — HOME v1.0
   ---------------------------------------------------------
   Orchestrateur : initialise les modules de la page HOME.
   ========================================================= */

async function renderHome() {
  const todayDate = new Date();
  const today = iso(todayDate);

  await Promise.all([
    renderHero(),
    loadPassportLocation(),
    loadActivitiesForHome(todayDate, visibleMonth),
    loadDailyWellbeing(today)
  ]);

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

  const livingContexts = await loadLivingWeatherWindow();
  renderLivingWeekWeather(livingContexts);

  const context = livingContexts[today] || await getContextForDate(today);
  renderWeatherCard(context);
}

function bindHome() {
  document.getElementById("homeLogoutBtn")?.addEventListener("click", async () => {
    await window.momentumDB.auth.signOut();
    window.location.href = "login.html";
  });
  $("#closeActivityDialog")?.addEventListener("click", closeActivityDialog);
  $("#cancelActivity")?.addEventListener("click", closeActivityDialog);
  $("#activityFile")?.addEventListener("change", handleActivityFile);
  $("#activityForm")?.addEventListener("submit", saveActivity);

  $("#centerToday")?.addEventListener("click", async () => {
    renderLivingWeek(new Date());
    const contexts = await loadLivingWeatherWindow();
    renderLivingWeekWeather(contexts);
  });

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
    const day = event.target.closest("[data-date]");
    if (day?.dataset.date) await openDay(day.dataset.date);
  });

  $("#monthGrid")?.addEventListener("click", async (event) => {
    const day = event.target.closest("[data-date]");
    if (day?.dataset.date) await openDay(day.dataset.date);
  });

  $("#openToday")?.addEventListener("click", async () => {
    await openDay(iso(new Date()));
  });

  $("#closeDay")?.addEventListener("click", () => {
    $("#dayDialog")?.close();
  });

  $("#dayDialogContent")?.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const action = actionButton.dataset.action;
    const date =
      actionButton.dataset.date || $("#dayDialog")?.dataset.date;

    if (action === "add-moment" && date) {
      $("#dayDialog")?.close();
      openActivityDialog(date, true);
      return;
    }

    if (action === "edit-moment") {
      const activityId = actionButton.dataset.activityId;
      if (activityId) {
        $("#dayDialog")?.close();
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
  renderHome();
});
