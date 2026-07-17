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
    selectedActivityId:null
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
    const datedActivities = flowState.analysisActivities
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

  function renderFlowEmpty(message, detail = "") {
    const points = document.getElementById("flowPoints");
    const detailCard = document.getElementById("flowDetail");
    if (points) points.innerHTML = "";
    if (detailCard) detailCard.innerHTML = `
      <div class="flow-detail-empty">
        <span class="card-label">FLOW</span>
        <h3>${escapeHtml(message)}</h3>
        ${detail ? `<p>${escapeHtml(detail)}</p>` : ""}
      </div>`;
  }

  function renderFlowPoints() {
    const points = document.getElementById("flowPoints");
    const periodSummary = document.getElementById("flowPeriodSummary");
    const pendingSummary = document.getElementById("flowPendingSummary");
    if (!points) return;

    const assessedActivities = flowState.activities.filter((activity) => flowState.assessments.has(activity.id));
    const pendingCount = flowState.activities.length - assessedActivities.length;
    const periodLabel = FLOW_PERIODS[flowState.period]?.label || "Période";

    if (periodSummary) {
      periodSummary.textContent = `${assessedActivities.length} expérience${assessedActivities.length > 1 ? "s" : ""} · ${periodLabel}`;
    }
    if (pendingSummary) {
      pendingSummary.textContent = pendingCount ? `${pendingCount} à raconter` : "";
    }

    points.innerHTML = assessedActivities.map((activity) => {
      const assessment = flowState.assessments.get(activity.id);
      const zone = flowZoneKey(assessment.perceived_challenge, assessment.perceived_mastery);
      const color = window.MomentumSportVisuals?.getColor(activity.sport, activity.activity_category) || "#273c31";
      const selected = activity.id === flowState.selectedActivityId;
      return `
        <button
          class="flow-point${selected ? " is-selected" : ""}"
          type="button"
          style="--flow-x:${flowCoordinate(assessment.perceived_mastery)}%;--flow-y:${100 - flowCoordinate(assessment.perceived_challenge)}%;--flow-color:${color}"
          data-flow-activity="${escapeHtml(activity.id)}"
          data-flow-zone="${zone}"
          aria-label="${escapeHtml(flowActivityLabel(activity))}, ${escapeHtml(fmtDate(activity.activity_date))}, zone ${escapeHtml(flowZoneLabel(zone))}"
          aria-pressed="${selected ? "true" : "false"}"
        ><span></span></button>`;
    }).join("");

    const hasSelection = Boolean(flowState.selectedActivityId);
    points.classList.toggle("has-selection", hasSelection);
    document.querySelectorAll(".flow-zone").forEach((zone) => {
      zone.classList.toggle("is-active", hasSelection && zone.dataset.flowZone === points.querySelector(".flow-point.is-selected")?.dataset.flowZone);
    });

    if (!assessedActivities.length) {
      renderFlowEmpty(
        "La carte attend ton premier ressenti.",
        pendingCount ? `${pendingCount} activité${pendingCount > 1 ? "s" : ""} existe${pendingCount > 1 ? "nt" : ""} déjà sans réponse.` : "Enregistre une activité pour commencer."
      );
    }
  }

  async function loadFlowPhotos(activityId) {
    const host = document.querySelector(`[data-flow-photos="${activityId}"]`);
    if (!host) return;
    const { data:links, error:linksError } = await window.momentumDB
      .from("moment_activities")
      .select("moment_id")
      .eq("activity_id", activityId);
    if (linksError || !links?.length) {
      host.innerHTML = '<p class="flow-no-photos">Aucune photo liée à cette activité.</p>';
      return;
    }
    const momentIds = [...new Set(links.map((link) => link.moment_id).filter(Boolean))];
    const { data:media, error:mediaError } = await window.momentumDB
      .from("moment_media")
      .select("id,file_path,caption")
      .in("moment_id", momentIds)
      .order("created_at", { ascending:false });
    if (mediaError || !media?.length) {
      host.innerHTML = '<p class="flow-no-photos">Aucune photo liée à cette activité.</p>';
      return;
    }
    const photos = await Promise.all(media.slice(0, 6).map(async (item) => {
      const { data } = await window.momentumDB.storage.from("moment-media").createSignedUrl(item.file_path, 3600);
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
        <div><dt>Durée</dt><dd>${activity.duration_min == null ? "—" : `${Math.round(activity.duration_min)} min`}</dd></div>
        <div><dt>Distance</dt><dd>${activity.distance_km == null ? "—" : `${Number(activity.distance_km).toLocaleString("fr-CH", { maximumFractionDigits:1 })} km`}</dd></div>
        <div><dt>D+</dt><dd>${activity.elevation_m == null ? "—" : `${Math.round(activity.elevation_m)} m`}</dd></div>
        <div><dt>Charge</dt><dd>${charge || "—"}</dd></div>
        <div><dt>Bien-être</dt><dd>${escapeHtml(flowWellbeingText(activity))}</dd></div>
      </dl>
      <div class="flow-feeling-metrics">
        <div><span>Effort physique</span><strong>${assessment.perceived_exertion} / 10</strong></div>
        <div><span>Défi</span><strong>${assessment.perceived_challenge} / 10</strong></div>
        <div><span>Maîtrise</span><strong>${assessment.perceived_mastery} / 10</strong></div>
      </div>
      <section class="flow-detail-notes">
        <span class="card-label">Notes</span>
        <p>${escapeHtml(activity.notes || "Aucune note pour cette activité.")}</p>
      </section>
      <section class="flow-detail-photos">
        <span class="card-label">Photos</span>
        <div class="flow-photo-grid" data-flow-photos="${escapeHtml(activity.id)}"><p class="flow-no-photos">Recherche des photos…</p></div>
      </section>
      <div class="flow-detail-actions">
        <button class="secondary" type="button" data-flow-action="open-activity" data-flow-activity="${escapeHtml(activity.id)}">Voir l'activité</button>
        <button class="primary" type="button" data-flow-action="edit-assessment" data-flow-activity="${escapeHtml(activity.id)}">Modifier mon ressenti</button>
      </div>`;
    loadFlowPhotos(activity.id);
  }

  function selectFlowActivity(activityId) {
    const activity = flowState.activities.find((item) => item.id === activityId);
    if (!activity || !flowState.assessments.has(activityId)) return;
    flowState.selectedActivityId = activityId;
    renderFlowPoints();
    renderFlowDetail(activity);
  }

  async function loadFlowData(options = {}) {
    const user = window.momentumPageReady ? await window.momentumPageReady : await getCurrentUser();
    if (!user) return;
    flowState.user = user;
    const periodStart = flowPeriodStart();
    const analysisStart = iso(addDays(new Date(), -365));
    let query = window.momentumDB
      .from("activities")
      .select("id,activity_date,activity_category,sport,activity_type,status,duration_min,distance_km,elevation_m,avg_hr,rpe,notes,weather,route_summary,created_at")
      .eq("user_id", user.id)
      .eq("status", "done")
      .order("activity_date", { ascending:true });
    if (flowState.period !== "all") query = query.gte("activity_date", analysisStart);

    const { data:analysisActivities, error:activitiesError } = await query;
    if (activitiesError) throw activitiesError;
    flowState.analysisActivities = analysisActivities || [];
    flowState.activities = periodStart
      ? flowState.analysisActivities.filter((activity) => activity.activity_date >= periodStart)
      : flowState.analysisActivities;

    const activityIds = flowState.activities.map((activity) => activity.id);
    const assessmentPromise = activityIds.length
      ? window.momentumDB.from("activity_flow_assessments").select("*").eq("user_id", user.id).in("activity_id", activityIds)
      : Promise.resolve({ data:[], error:null });
    const wellbeingPromise = flowState.activities.length
      ? window.momentumDB.from("daily_wellbeing").select("recorded_date,sleep_hours,motivation").eq("user_id", user.id).gte("recorded_date", flowState.activities[0].activity_date).lte("recorded_date", iso(new Date()))
      : Promise.resolve({ data:[], error:null });
    const [assessmentResult, wellbeingResult] = await Promise.all([assessmentPromise, wellbeingPromise]);
    if (assessmentResult.error) throw assessmentResult.error;

    flowState.assessments = new Map((assessmentResult.data || []).map((assessment) => [assessment.activity_id, assessment]));
    flowState.wellbeing = new Map((wellbeingResult.data || []).map((day) => [day.recorded_date, day]));
    if (flowState.selectedActivityId && !flowState.activities.some((activity) => activity.id === flowState.selectedActivityId)) {
      flowState.selectedActivityId = null;
    }
    renderFlowPoints();
    if (flowState.selectedActivityId) selectFlowActivity(flowState.selectedActivityId);
    if (options.selectActivityId && flowState.assessments.has(options.selectActivityId)) selectFlowActivity(options.selectActivityId);
  }

  function setAssessmentMessage(message, isError = false) {
    const element = document.getElementById("flowAssessmentMessage");
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("is-error", isError);
  }

  function closeFlowAssessment() {
    const dialog = document.getElementById("flowAssessmentDialog");
    const returnToDay = dialog?.dataset.returnToDay || "";
    closeHomeDialog(dialog);
    if (dialog) dialog.dataset.returnToDay = "";
    if (returnToDay) openDay(returnToDay);
  }

  async function ensureFlowActivity(activityId) {
    const local = flowState.analysisActivities.find((activity) => activity.id === activityId);
    if (local) return local;
    const user = flowState.user || await getCurrentUser();
    if (!user) return null;
    flowState.user = user;
    const { data, error } = await window.momentumDB
      .from("activities")
      .select("id,activity_date,activity_category,sport,activity_type,status,duration_min,distance_km,elevation_m,avg_hr,rpe,notes,weather,route_summary,created_at")
      .eq("id", activityId)
      .eq("user_id", user.id)
      .single();
    if (error) throw error;
    flowState.analysisActivities.push(data);
    return data;
  }

  async function openFlowAssessment(activityId, options = {}) {
    try {
      const activity = await ensureFlowActivity(activityId);
      const dialog = document.getElementById("flowAssessmentDialog");
      const form = document.getElementById("flowAssessmentForm");
      if (!activity || !dialog || !form) return;
      const existing = flowState.assessments.get(activityId);
      form.elements.activityId.value = activityId;
      form.elements.perceivedExertion.value = existing?.perceived_exertion || activity.rpe || 5;
      form.elements.perceivedChallenge.value = existing?.perceived_challenge || 5;
      form.elements.perceivedMastery.value = existing?.perceived_mastery || 5;
      form.querySelectorAll('input[type="range"]').forEach((input) => {
        input.closest("label")?.querySelector("output")?.replaceChildren(document.createTextNode(input.value));
      });
      document.getElementById("flowAssessmentActivity").textContent = `${flowActivityLabel(activity)} · ${fmtDate(activity.activity_date)}`;
      dialog.dataset.returnToDay = options.returnToDay || "";
      setAssessmentMessage("");
      openHomeDialog(dialog);
    } catch (error) {
      console.error("FLOW : impossible d'ouvrir le ressenti.", error);
    }
  }

  async function saveFlowAssessment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const activityId = form.elements.activityId.value;
    const activity = await ensureFlowActivity(activityId);
    const user = flowState.user || await getCurrentUser();
    if (!activity || !user) return;
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    setAssessmentMessage("Enregistrement…");

    const payload = {
      activity_id:activityId,
      user_id:user.id,
      perceived_exertion:Number(form.elements.perceivedExertion.value),
      perceived_challenge:Number(form.elements.perceivedChallenge.value),
      perceived_mastery:Number(form.elements.perceivedMastery.value),
      analysis_context:buildFlowAnalysisContext({
        ...activity,
        rpe:Number(form.elements.perceivedExertion.value)
      }),
      assessment_version:1
    };

    try {
      const { data, error } = await window.momentumDB
        .from("activity_flow_assessments")
        .upsert(payload, { onConflict:"activity_id,user_id" })
        .select()
        .single();
      if (error) throw error;

      const { error:rpeError } = await window.momentumDB
        .from("activities")
        .update({ rpe:payload.perceived_exertion })
        .eq("id", activityId)
        .eq("user_id", user.id);
      if (rpeError) console.warn("FLOW : effort physique non synchronisé avec l'activité.", rpeError);

      flowState.assessments.set(activityId, data);
      closeFlowAssessment();
      await loadFlowData({ selectActivityId:activityId });
    } catch (error) {
      console.error("FLOW : ressenti non enregistré.", error);
      setAssessmentMessage(error.message || "Impossible d'enregistrer ton ressenti.", true);
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  async function offerAssessment(activityId, options = {}) {
    try {
      await loadFlowData();
      await openFlowAssessment(activityId, options);
    } catch (error) {
      console.error("FLOW : invitation au ressenti indisponible.", error);
    }
  }

  function bindFlow() {
    document.getElementById("flowPeriod")?.addEventListener("change", async (event) => {
      flowState.period = event.currentTarget.value;
      flowState.selectedActivityId = null;
      renderFlowEmpty("Chargement des expériences…");
      try {
        await loadFlowData();
      } catch (error) {
        console.error("FLOW : données indisponibles.", error);
        renderFlowEmpty("FLOW est momentanément indisponible.", "Réessaie dans un instant.");
      }
    });

    document.getElementById("flowPoints")?.addEventListener("click", (event) => {
      const point = event.target.closest("[data-flow-activity]");
      if (point) selectFlowActivity(point.dataset.flowActivity);
    });

    document.getElementById("flowDetail")?.addEventListener("click", (event) => {
      const action = event.target.closest("[data-flow-action]");
      if (!action) return;
      const activity = flowState.activities.find((item) => item.id === action.dataset.flowActivity);
      if (!activity) return;
      if (action.dataset.flowAction === "open-activity") openDay(activity.activity_date);
      if (action.dataset.flowAction === "edit-assessment") openFlowAssessment(activity.id);
    });

    document.getElementById("openFlowExplanation")?.addEventListener("click", () => openHomeDialog(document.getElementById("flowExplanationDialog")));
    document.getElementById("closeFlowExplanation")?.addEventListener("click", () => closeHomeDialog(document.getElementById("flowExplanationDialog")));
    document.getElementById("closeFlowAssessment")?.addEventListener("click", closeFlowAssessment);
    document.getElementById("flowAssessmentLater")?.addEventListener("click", closeFlowAssessment);
    document.getElementById("flowAssessmentForm")?.addEventListener("submit", saveFlowAssessment);
    document.getElementById("flowAssessmentForm")?.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener("input", () => {
        input.closest("label")?.querySelector("output")?.replaceChildren(document.createTextNode(input.value));
      });
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindFlow();
    try {
      await loadFlowData();
    } catch (error) {
      console.error("FLOW : données indisponibles.", error);
      renderFlowEmpty("FLOW est momentanément indisponible.", "Réessaie dans un instant.");
    }
  });

  window.MomentumFlow = Object.freeze({
    offerAssessment,
    openAssessment:openFlowAssessment,
    reload:loadFlowData,
    zone:flowZoneKey
  });
})();
