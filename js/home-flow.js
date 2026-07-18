/* =========================================================
   MOMENTUM — FLOW V1
   ---------------------------------------------------------
   La position d'un point dépend uniquement du défi et de la
   maîtrise déclarés par l'utilisateur.
   ========================================================= */

(function initializeMomentumFlow() {
  const FLOW_PERIODS = {
    "4-weeks": { label:"4 semaines", days:28 },
    "8-weeks": { label:"8 semaines", days:56 },
    "6-months": { label:"6 mois", months:6 },
    "1-year": { label:"1 an", months:12 },
    all: { label:"Historique complet" }
  };

  const flowState = {
    user:null,
    period:"8-weeks",
    activities:[],
    analysisActivities:[],
    assessments:new Map(),
    wellbeing:new Map(),
    selectedActivityId:null,
    selectedGroupKey:null,
    requestVersion:0,
    hasValidData:false
  };

  function flowPeriodStart(period = flowState.period) {
    const definition = FLOW_PERIODS[period] || FLOW_PERIODS["8-weeks"];
    if (period === "all") return null;
    const today = new Date();
    if (definition.days) return iso(addDays(today, -(definition.days - 1)));
    const start = new Date(today);
    start.setMonth(start.getMonth() - definition.months);
    return iso(start);
  }

  function flowActivityLabel(activity) {
    return window.MomentumSports?.getLabel(
      activity.sport,
      activity.activity_type || "Activité"
    ) || activity.activity_type || "Activité";
  }

  function flowSportLabel(activity) {
    if (activity.activity_category === "wellbeing") return "Bien-être";
    if (activity.activity_category === "adventure") return "Aventure";
    return window.MomentumSports?.getLabel(activity.sport, activity.sport || "Sport") || "Sport";
  }

  function flowZoneKey(challenge, mastery) {
    const row = Number(challenge) <= 3 ? 2 : Number(challenge) <= 6 ? 1 : 0;
    const column = Number(mastery) <= 3 ? 0 : Number(mastery) <= 6 ? 1 : 2;
    return [
      ["explorer", "se-depasser", "flow"],
      ["apprendre", "equilibre", "maitriser"],
      ["recuperer", "routine", "relaxation"]
    ][row][column];
  }

  function flowZoneLabel(key) {
    return ({
      explorer:"Explorer",
      "se-depasser":"Se dépasser",
      flow:"FLOW",
      apprendre:"Apprendre",
      equilibre:"Expérience",
      maitriser:"Maîtriser",
      recuperer:"Récupérer",
      routine:"Routine",
      relaxation:"Relaxation"
    })[key] || "Expérience";
  }

  function flowCoordinate(value) {
    return 6 + (Math.max(1, Math.min(10, Number(value))) - 1) / 9 * 88;
  }

  function flowActivityLoad(activity) {
    const duration = Number(activity.duration_min || 0);
    const exertion = Number(activity.rpe || 5);
    return duration * Math.max(1, Math.min(10, exertion)) / 6;
  }

  function flowLoadContext(targetActivity) {
    const includesTarget = flowState.analysisActivities.some((activity) => activity.id === targetActivity.id);
    const datedActivities = (includesTarget ? flowState.analysisActivities : [...flowState.analysisActivities, targetActivity])
      .filter((activity) => activity.activity_date && activity.activity_date <= targetActivity.activity_date)
      .sort((a, b) => a.activity_date.localeCompare(b.activity_date));
    if (!datedActivities.length) return { acute_load:0, chronic_load:0, tsb:0 };

    const firstDate = dateFromIso(datedActivities[0].activity_date);
    const targetDate = dateFromIso(targetActivity.activity_date);
    let acute = 0;
    let chronic = 0;

    for (let cursor = new Date(firstDate); cursor <= targetDate; cursor = addDays(cursor, 1)) {
      const day = iso(cursor);
      const load = datedActivities
        .filter((activity) => activity.activity_date === day)
        .reduce((sum, activity) => sum + flowActivityLoad(activity), 0);
      acute += (load - acute) / 7;
      chronic += (load - chronic) / 42;
    }

    return {
      acute_load:Number(acute.toFixed(2)),
      chronic_load:Number(chronic.toFixed(2)),
      tsb:Number((chronic - acute).toFixed(2))
    };
  }

  function buildFlowAnalysisContext(activity) {
    return {
      version:1,
      source:"momentum-flow-v1",
      activity_metrics:{
        duration_min:activity.duration_min ?? null,
        distance_km:activity.distance_km ?? null,
        elevation_m:activity.elevation_m ?? null,
        avg_hr:activity.avg_hr ?? null,
        fit:activity.route_summary?.fit_analysis || null
      },
      load:flowLoadContext(activity),
      weather:activity.weather || null,
      computed_at:new Date().toISOString()
    };
  }

  function flowWellbeingText(activity) {
    const wellbeing = flowState.wellbeing.get(activity.activity_date);
    if (!wellbeing) return "Non renseigné";
    const values = [];
    if (wellbeing.sleep_hours != null) values.push(formatSleepDuration(wellbeing.sleep_hours));
    if (wellbeing.motivation != null) values.push(`motivation ${Number(wellbeing.motivation).toLocaleString("fr-CH")} / 10`);
    return values.length ? values.join(" · ") : "Non renseigné";
  }

  function renderFlowEmpty(message, detail = "", action = "") {
    const points = document.getElementById("flowPoints");
    const detailCard = document.getElementById("flowDetail");
    if (points) points.innerHTML = "";
    if (detailCard) detailCard.innerHTML = `
      <div class="flow-detail-empty">
        <span class="card-label">FLOW</span>
        <h3>${escapeHtml(message)}</h3>
        ${detail ? `<p>${escapeHtml(detail)}</p>` : ""}
        ${action ? `<button class="secondary flow-retry" type="button" data-flow-action="change-period">${escapeHtml(action)}</button>` : ""}
      </div>`;
  }

  function groupActivitiesByCoordinates(activities, assessments = flowState.assessments) {
    const groups = new Map();
    activities.forEach((activity) => {
      const assessment = assessments.get(activity.id);
      if (!assessment) return;
      const key = `${assessment.perceived_challenge}:${assessment.perceived_mastery}`;
      if (!groups.has(key)) groups.set(key, { key, assessment, activities:[] });
      groups.get(key).activities.push(activity);
    });
    groups.forEach((group) => group.activities.sort((a, b) =>
      String(b.activity_date).localeCompare(String(a.activity_date)) ||
      flowActivityLabel(a).localeCompare(flowActivityLabel(b), "fr")
    ));
    return [...groups.values()];
  }

  function flowGroups(activities) {
    return groupActivitiesByCoordinates(activities);
  }

  function renderFlowError() {
    const detailCard = document.getElementById("flowDetail");
    const periodSummary = document.getElementById("flowPeriodSummary");
    if (periodSummary) periodSummary.textContent = flowState.hasValidData
      ? "Mise à jour impossible · dernières données conservées"
      : "FLOW momentanément indisponible";
    if (detailCard) detailCard.innerHTML = `
      <div class="flow-detail-empty" role="alert">
        <span class="card-label">FLOW</span>
        <h3>La carte n’a pas pu être chargée.</h3>
        <p>${flowState.hasValidData ? "Les dernières données visibles sont conservées." : "Réessaie dans un instant."}</p>
        <button class="secondary flow-retry" type="button" data-flow-action="retry">Réessayer</button>
      </div>`;
  }

  function renderFlowGroup(group) {
    const detail = document.getElementById("flowDetail");
    if (!detail) return;
    const zone = flowZoneKey(group.assessment.perceived_challenge, group.assessment.perceived_mastery);
    detail.innerHTML = `
      <div class="flow-group-detail">
        <span class="card-label">${escapeHtml(flowZoneLabel(zone))}</span>
        <h3>${group.activities.length} Moments au même endroit</h3>
        <p>Défi ${group.assessment.perceived_challenge} / 10 · Maîtrise ${group.assessment.perceived_mastery} / 10</p>
        <div class="flow-group-list" role="group" aria-label="Moments regroupés">
          ${group.activities.map((activity) => `<button type="button" data-flow-group-activity="${escapeHtml(activity.id)}"><span>${escapeHtml(flowActivityLabel(activity))}</span><small>${escapeHtml(fmtDate(activity.activity_date))}</small></button>`).join("")}
        </div>
      </div>`;
  }

  function renderFlowPoints() {
    const points = document.getElementById("flowPoints");
    const periodSummary = document.getElementById("flowPeriodSummary");
    if (!points) return;

    const assessedActivities = flowState.activities.filter((activity) => flowState.assessments.has(activity.id));
    const pendingCount = flowState.activities.length - assessedActivities.length;
    const periodLabel = FLOW_PERIODS[flowState.period]?.label || "Période";

    if (periodSummary) {
      periodSummary.textContent = `${assessedActivities.length} expérience${assessedActivities.length > 1 ? "s" : ""} · ${periodLabel}`;
    }

    const groups = flowGroups(assessedActivities);
    points.innerHTML = groups.map((group) => {
      const assessment = group.assessment;
      const zone = flowZoneKey(assessment.perceived_challenge, assessment.perceived_mastery);
      const activity = group.activities[0];
      const color = window.MomentumSportVisuals?.getColor(activity.sport, activity.activity_category) || "#273c31";
      const selected = group.key === flowState.selectedGroupKey || group.activities.some((item) => item.id === flowState.selectedActivityId);
      const grouped = group.activities.length > 1;
      return `
        <button
          class="flow-point${selected ? " is-selected" : ""}${grouped ? " is-group" : ""}"
          type="button"
          style="--flow-x:${flowCoordinate(assessment.perceived_mastery)}%;--flow-y:${100 - flowCoordinate(assessment.perceived_challenge)}%;--flow-color:${color}"
          ${grouped ? `data-flow-group="${escapeHtml(group.key)}"` : `data-flow-activity="${escapeHtml(activity.id)}"`}
          data-flow-zone="${zone}"
          aria-label="${grouped ? `${group.activities.length} Moments, ` : `${escapeHtml(flowActivityLabel(activity))}, ${escapeHtml(fmtDate(activity.activity_date))}, `}défi ${assessment.perceived_challenge} sur 10, maîtrise ${assessment.perceived_mastery} sur 10, zone ${escapeHtml(flowZoneLabel(zone))}"
          aria-pressed="${selected ? "true" : "false"}"
        ><span></span>${grouped ? `<b aria-hidden="true">${group.activities.length}</b>` : ""}</button>`;
    }).join("");

    const hasSelection = Boolean(flowState.selectedActivityId || flowState.selectedGroupKey);
    points.classList.toggle("has-selection", hasSelection);
    document.querySelectorAll(".flow-zone").forEach((zone) => {
      zone.classList.toggle("is-active", hasSelection && zone.dataset.flowZone === points.querySelector(".flow-point.is-selected")?.dataset.flowZone);
    });

    if (!assessedActivities.length) {
      renderFlowEmpty(
        pendingCount ? "Ta carte FLOW prendra forme au fil de tes Moments." : "Aucun Moment évalué sur cette période.",
        pendingCount ? "Après une activité, indique simplement comment tu l’as vécue." : "Ta carte reste disponible sur une autre période.",
        pendingCount ? "" : "Modifier la période"
      );
    }
  }

  async function loadFlowPhotos(activityId) {
    const host = document.querySelector(`[data-flow-photos="${activityId}"]`);
    if (!host) return;
    const { data:media, error:mediaError } = await window.momentumDB
      .from("activity_media")
      .select("id,file_path,caption")
      .eq("activity_id", activityId);
    if (mediaError || !media?.length) {
      host.innerHTML = '<p class="flow-no-photos">Aucune photo liée à cette activité.</p>';
      return;
    }
    const photos = await Promise.all(media.slice(0, 6).map(async (item) => {
      const { data } = await window.momentumDB.storage.from("activity-media").createSignedUrl(item.file_path, 3600);
      return { ...item, url:data?.signedUrl || null };
    }));
    if (!host.isConnected || flowState.selectedActivityId !== activityId) return;
    host.innerHTML = photos.filter((photo) => photo.url).map((photo) => `
      <figure><img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.caption || "Photo de l'activité")}" /></figure>
    `).join("") || '<p class="flow-no-photos">Aucune photo liée à cette activité.</p>';
  }

  function renderFlowDetail(activity) {
    const detail = document.getElementById("flowDetail");
    const assessment = flowState.assessments.get(activity.id);
    if (!detail || !assessment) return;
    const zone = flowZoneKey(assessment.perceived_challenge, assessment.perceived_mastery);
    const charge = Math.round(flowActivityLoad(activity));

    detail.innerHTML = `
      <div class="flow-detail-head">
        <div>
          <span class="card-label">${escapeHtml(flowZoneLabel(zone))}</span>
          <h3>${escapeHtml(flowActivityLabel(activity))}</h3>
          <p>${escapeHtml(fmtDate(activity.activity_date))}</p>
        </div>
        <i style="--flow-detail-color:${window.MomentumSportVisuals?.getColor(activity.sport, activity.activity_category) || "#273c31"}"></i>
      </div>
      <dl class="flow-detail-metrics">
        <div><dt>Sport</dt><dd>${escapeHtml(flowSportLabel(activity))}</dd></div>
        <div><dt>Durée</dt><dd>${activity.duration_min == null ? "—" : escapeHtml(window.MomentumDuration?.format(activity.duration_min) || `${Math.round(activity.duration_min)} min`)}</dd></div>
        <div><dt>Distance</dt><dd>${activity.distance_km == null ? "—" : `${Number(activity.distance_km).toLocaleString("fr-CH", { maximumFractionDigits:1 })} km`}</dd></div>
        <div><dt>D+</dt><dd>${activity.elevation_m == null ? "—" : `${Math.round(activity.elevation_m)} m`}</dd></div>
        <div><dt>Charge</dt><dd>${charge || "—"}</dd></div>
        <div><dt>Bien-être</dt><dd>${escapeHtml(flowWellbeingText(activity))}</dd></div>
      </dl>
      <div class="flow-feeling-metrics">
        <div><span>Effort physique</span><strong>${activity.rpe ?? "—"} / 10</strong></div>
        <div><span>Défi</span><strong>${assessment.perceived_challenge} / 10</strong></div>
        <div><span>Maîtrise</span><strong>${assessment.perceived_mastery} / 10</strong></div>
      </div>
      <section class="flow-detail-notes">
        <span class="card-label">Ce que tu souhaites garder</span>
        <p>${escapeHtml(assessment.retained_memory || activity.notes || "Aucun souvenir noté pour ce Moment.")}</p>
      </section>
      <section class="flow-detail-photos">
        <span class="card-label">Photos</span>
        <div class="flow-photo-grid" data-flow-photos="${escapeHtml(activity.id)}"><p class="flow-no-photos">Recherche des photos…</p></div>
      </section>
      <div class="flow-detail-actions">
        <button class="secondary" type="button" data-flow-action="open-activity" data-flow-activity="${escapeHtml(activity.id)}">Voir l'activité</button>
        <button class="primary" type="button" data-flow-action="edit-moment" data-flow-activity="${escapeHtml(activity.id)}">Modifier le Moment</button>
      </div>`;
    loadFlowPhotos(activity.id);
  }

  function selectFlowActivity(activityId) {
    const activity = flowState.activities.find((item) => item.id === activityId);
    if (!activity || !flowState.assessments.has(activityId)) return;
    flowState.selectedActivityId = activityId;
    const assessment = flowState.assessments.get(activityId);
    flowState.selectedGroupKey = assessment ? `${assessment.perceived_challenge}:${assessment.perceived_mastery}` : null;
    renderFlowPoints();
    renderFlowDetail(activity);
  }

  function selectFlowGroup(groupKey) {
    const assessedActivities = flowState.activities.filter((activity) => flowState.assessments.has(activity.id));
    const group = flowGroups(assessedActivities).find((item) => item.key === groupKey);
    if (!group) return;
    flowState.selectedActivityId = null;
    flowState.selectedGroupKey = groupKey;
    renderFlowPoints();
    renderFlowGroup(group);
  }

  async function loadFlowData(options = {}) {
    const requestVersion = ++flowState.requestVersion;
    const requestedPeriod = flowState.period;
    const user = window.momentumPageReady ? await window.momentumPageReady : await getCurrentUser();
    if (!user || requestVersion !== flowState.requestVersion) return;
    const periodStart = flowPeriodStart(requestedPeriod);
    const analysisStart = iso(addDays(new Date(), -365));
    let query = window.momentumDB
      .from("activities")
      .select("id,activity_date,activity_category,sport,activity_type,status,duration_min,distance_km,elevation_m,avg_hr,rpe,notes,weather,route_summary,created_at")
      .eq("user_id", user.id)
      .eq("status", "done")
      .order("activity_date", { ascending:true });
    if (requestedPeriod !== "all") query = query.gte("activity_date", analysisStart);

    const { data:analysisActivities, error:activitiesError } = await query;
    if (activitiesError) throw activitiesError;
    const nextAnalysisActivities = analysisActivities || [];
    const nextActivities = periodStart
      ? nextAnalysisActivities.filter((activity) => activity.activity_date >= periodStart)
      : nextAnalysisActivities;

    const activityIds = nextActivities.map((activity) => activity.id);
    const assessmentPromise = activityIds.length
      ? window.momentumDB.from("activity_flow_assessments").select("*").eq("user_id", user.id).in("activity_id", activityIds)
      : Promise.resolve({ data:[], error:null });
    const wellbeingPromise = nextActivities.length
      ? window.momentumDB.from("daily_wellbeing").select("recorded_date,sleep_hours,motivation").eq("user_id", user.id).gte("recorded_date", nextActivities[0].activity_date).lte("recorded_date", iso(new Date()))
      : Promise.resolve({ data:[], error:null });
    const [assessmentResult, wellbeingResult] = await Promise.all([assessmentPromise, wellbeingPromise]);
    if (assessmentResult.error) throw assessmentResult.error;
    if (wellbeingResult.error) throw wellbeingResult.error;
    if (requestVersion !== flowState.requestVersion || requestedPeriod !== flowState.period) return;

    flowState.user = user;
    flowState.analysisActivities = nextAnalysisActivities;
    flowState.activities = nextActivities;
    flowState.assessments = new Map((assessmentResult.data || []).map((assessment) => [assessment.activity_id, assessment]));
    flowState.wellbeing = new Map((wellbeingResult.data || []).map((day) => [day.recorded_date, day]));
    flowState.hasValidData = true;
    if (flowState.selectedActivityId && !flowState.activities.some((activity) => activity.id === flowState.selectedActivityId)) {
      flowState.selectedActivityId = null;
      flowState.selectedGroupKey = null;
    }
    renderFlowPoints();
    if (flowState.selectedActivityId) selectFlowActivity(flowState.selectedActivityId);
    if (options.selectActivityId && flowState.assessments.has(options.selectActivityId)) selectFlowActivity(options.selectActivityId);
  }


  function bindFlow() {
    document.getElementById("flowPeriod")?.addEventListener("change", async (event) => {
      flowState.period = event.currentTarget.value;
      const requestedPeriod = flowState.period;
      flowState.selectedActivityId = null;
      flowState.selectedGroupKey = null;
      const summary = document.getElementById("flowPeriodSummary");
      if (summary) summary.textContent = "Chargement des expériences…";
      const expectedRequestVersion = flowState.requestVersion + 1;
      try {
        await loadFlowData();
      } catch (error) {
        if (requestedPeriod !== flowState.period || expectedRequestVersion !== flowState.requestVersion) return;
        console.error("FLOW : données indisponibles.", error);
        renderFlowError();
      }
    });

    document.getElementById("flowPoints")?.addEventListener("click", (event) => {
      const point = event.target.closest("[data-flow-activity]");
      if (point) selectFlowActivity(point.dataset.flowActivity);
      const group = event.target.closest("[data-flow-group]");
      if (group) selectFlowGroup(group.dataset.flowGroup);
    });

    document.getElementById("flowDetail")?.addEventListener("click", (event) => {
      const action = event.target.closest("[data-flow-action]");
      const groupedActivity = event.target.closest("[data-flow-group-activity]");
      if (groupedActivity) return selectFlowActivity(groupedActivity.dataset.flowGroupActivity);
      if (!action) return;
      if (action.dataset.flowAction === "retry") {
        const summary = document.getElementById("flowPeriodSummary");
        if (summary) summary.textContent = "Chargement des expériences…";
        const expectedRequestVersion = flowState.requestVersion + 1;
        loadFlowData().catch((error) => {
          if (expectedRequestVersion !== flowState.requestVersion) return;
          console.error("FLOW : nouvel essai impossible.", error);
          renderFlowError();
        });
        return;
      }
      if (action.dataset.flowAction === "change-period") {
        document.getElementById("flowPeriod")?.focus();
        return;
      }
      const activity = flowState.activities.find((item) => item.id === action.dataset.flowActivity);
      if (!activity) return;
      if (action.dataset.flowAction === "open-activity") openDay(activity.activity_date);
      if (action.dataset.flowAction === "edit-moment") openEditActivityDialog(activity.id);
    });
    document.getElementById("openFlowExplanation")?.addEventListener("click", () => openHomeDialog(document.getElementById("flowExplanationDialog")));
    document.getElementById("closeFlowExplanation")?.addEventListener("click", () => closeHomeDialog(document.getElementById("flowExplanationDialog")));
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindFlow();
    const expectedRequestVersion = flowState.requestVersion + 1;
    try {
      await loadFlowData();
    } catch (error) {
      if (expectedRequestVersion !== flowState.requestVersion) return;
      console.error("FLOW : données indisponibles.", error);
      renderFlowError();
    }
  });

  window.MomentumFlow = Object.freeze({
    analysisContext:buildFlowAnalysisContext,
    reload:loadFlowData,
    zone:flowZoneKey,
    groupByCoordinates:groupActivitiesByCoordinates
  });
})();
