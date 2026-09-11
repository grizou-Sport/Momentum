/* MOMENTUM — PROGRESSION v1.0 */
const PROGRESSION_PERIODS = {
  "last-7-days": { label:"7 derniers jours", kind:"rolling-days", amount:7 },
  "current-week": { label:"Semaine", kind:"calendar-week", amount:7 },
  "last-4-weeks": { label:"4 dernières semaines", kind:"rolling-days", amount:28 },
  "current-month": { label:"Mois", kind:"calendar-month", amount:1 },
  custom: { label:"Personnalisé", kind:"custom" }
};
const PROGRESSION_PREFERENCES_KEY = "momentum_progression_preferences_v1";

const progressionState = {
  activities:[], historyActivities:[], weeks:[], volumeChart:null, loadChart:null, sportChart:null,
  wellnessChart:null, mode:"time", wellnessMode:"summary", passport:null,
  physiological:null, loadSeries:[], loadDisplaySeries:[], sportGroups:[], wellbeingDays:[], wellbeingDisplayDays:[], dayRows:[], eventsByDate:new Map(),
  periodPreset:"last-7-days", periodOffset:0, periodStart:null, periodEnd:null, requestVersion:0
};

function progressionCounter(value, { decimals = 0, prefix = "", suffix = "" } = {}) {
  return `<strong data-motion-number data-motion-value="${Number(value) || 0}" data-motion-decimals="${decimals}" data-motion-prefix="${prefix}" data-motion-suffix="${suffix}">0${suffix}</strong>`;
}

function animateProgressionNumbers(root) {
  window.MomentumMotion?.animateNumbers(root);
}

function progressionChartTooltip(callbacks) {
  if (!window.MomentumMotion?.externalChartTooltip) return { callbacks };
  return {
    enabled:false,
    external:window.MomentumMotion.externalChartTooltip,
    callbacks
  };
}

function stageProgressionChart(chart, cardId) {
  const card = document.getElementById(cardId);
  if (window.MomentumMotion?.stageChart) {
    window.MomentumMotion.stageChart(chart, card, { duration:780, easing:"easeOutQuart" });
  } else {
    chart.options.animation = false;
    chart.update("none");
  }
}

function readProgressionPreferences() {
  return window.MomentumSession?.read("progression", {}) || {};
}

function saveProgressionPreferences() {
  try {
    window.MomentumSession.write("progression", { periodPreset:progressionState.periodPreset, periodOffset:progressionState.periodOffset, periodStart:progressionState.periodStart, periodEnd:progressionState.periodEnd, mode:progressionState.mode, wellnessMode:progressionState.wellnessMode });
  } catch (_error) { /* Une préférence locale ne doit jamais bloquer la page. */ }
}

function renderAccessibleChartTable(id, headers, rows, detailType = "") {
  const host = document.getElementById(id);
  if (!host) return;
  host.innerHTML = rows.length ? `<table><thead><tr>${headers.map((header)=>`<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row,index)=>`<tr>${row.map((cell,column)=>`<td>${column===0&&detailType?`<button type="button" data-progression-detail="${detailType}:${index}">${escapeHtml(cell)}</button>`:escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>` : '<p>Aucune donnée disponible pour cette période.</p>';
}

function progressionPeriodRange(preset = progressionState.periodPreset, customStart = null, customEnd = null, offset = progressionState.periodOffset, referenceDate = new Date()) {
  const definition = PROGRESSION_PERIODS[preset] || PROGRESSION_PERIODS["current-week"];
  if (definition.kind === "custom") {
    return { start:customStart, end:customEnd, label:definition.label };
  }

  const today = new Date(referenceDate);
  today.setHours(12, 0, 0, 0);
  const periodOffset = Number(offset) || 0;
  let end;
  let start;

  if (definition.kind === "rolling-days") {
    end = addDays(today, periodOffset * definition.amount);
    start = addDays(end, -(definition.amount - 1));
  } else if (definition.kind === "calendar-week") {
    const mondayIndex = (today.getDay() + 6) % 7;
    start = addDays(today, -mondayIndex + periodOffset * 7);
    end = addDays(start, 6);
  } else {
    start = new Date(today.getFullYear(), today.getMonth() + periodOffset, 1, 12);
    end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 12);
  }

  return { start:iso(start), end:iso(end), label:definition.label };
}

function progressionPeriodDateLabel(startValue, endValue) {
  if (!startValue || !endValue) return "";
  const start = dateFromIso(startValue);
  const end = dateFromIso(endValue);
  const day = new Intl.DateTimeFormat("fr-CH", { day:"numeric" });
  const month = new Intl.DateTimeFormat("fr-CH", { month:"long" });
  const full = new Intl.DateTimeFormat("fr-CH", { day:"numeric", month:"long", year:"numeric" });
  if (start.getFullYear() !== end.getFullYear()) return `${full.format(start)} – ${full.format(end)}`;
  if (start.getMonth() === end.getMonth()) return `${day.format(start)} – ${day.format(end)} ${month.format(end)}`;
  return `${day.format(start)} ${month.format(start)} – ${day.format(end)} ${month.format(end)}`;
}

function renderProgressionPeriodControl(range = progressionPeriodRange()) {
  const title = document.querySelector("[data-period-title]");
  const dates = document.querySelector("[data-period-range]");
  if (title) title.textContent = range.label;
  if (dates) dates.textContent = progressionPeriodDateLabel(range.start, range.end);
  document.querySelectorAll("[data-period-preset]").forEach((button) => {
    const active = button.dataset.periodPreset === progressionState.periodPreset;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-period-shift]").forEach((button) => {
    button.disabled = progressionState.periodPreset === "custom";
  });
}

function progressionWeekStart(value) {
  const date = new Date(`${value}T12:00:00`);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return iso(date);
}

function progressionWeeks(startValue, endValue) {
  const start = dateFromIso(progressionWeekStart(startValue));
  const end = dateFromIso(endValue);
  const count = Math.floor((end - start) / 604800000) + 1;
  return Array.from({ length:count }, (_, index) => {
    const weekStart = addDays(start, index * 7);
    return { id:iso(weekStart), start:iso(weekStart), end:iso(addDays(weekStart, 6)), label:new Intl.DateTimeFormat("fr-CH", { day:"numeric", month:"short" }).format(weekStart), activities:[] };
  });
}

async function loadProgressionData() {
  const message = document.querySelector("[data-period-message]");
  const requestVersion = ++progressionState.requestVersion;
  if (message) message.textContent = "Chargement des indicateurs…";

  try {
    const user = window.momentumPageReady
      ? await window.momentumPageReady
      : await getCurrentUser();
    if (!user) return;
    const range = progressionPeriodRange(
      progressionState.periodPreset,
      progressionState.periodStart,
      progressionState.periodEnd,
      progressionState.periodOffset
    );
    const start = range.start;
    const end = range.end;
    if (!start || !end) return;
    progressionState.periodStart = start;
    progressionState.periodEnd = end;
    renderProgressionPeriodControl(range);
    const historyEnd = [end, iso(new Date())].sort().at(-1);
    const [activitiesResult, passportResult, dailyResult, daysResult, physiologicalResult] = await Promise.all([
      window.MomentumData.history(user.id),
      window.momentumDB.from("passports").select("sport_level,habits,personalization").eq("user_id", user.id).maybeSingle(),
      window.MomentumData.all(() => window.momentumDB.from("daily_wellbeing").select("*", { count:"exact" }).eq("user_id",user.id).gte("recorded_date",start).lte("recorded_date",end).order("recorded_date").order("id")),
      window.MomentumData.all(() => window.momentumDB.from("days").select("*", { count:"exact" }).eq("user_id",user.id).gte("day_date",start).lte("day_date",end).order("day_date").order("id")),
      window.momentumDB.from("wellbeing_profile").select("resting_hr,preferred_sleep_hours").eq("user_id",user.id).maybeSingle(),
    ]);
    const firstError = activitiesResult.error || passportResult.error || dailyResult.error || daysResult.error || physiologicalResult.error;
    if (firstError) throw firstError;
    if (requestVersion !== progressionState.requestVersion) return;
    progressionState.historyActivities = (activitiesResult.data || []).map(window.MomentumData.trainingActivity);
    progressionState.historyComplete = activitiesResult.complete === true;
    progressionState.calculationDate = iso(new Date());
    progressionState.activities = progressionState.historyActivities.filter((activity) => activity.activity_date >= start && activity.activity_date <= end);
    progressionState.passport = passportResult.data || null;
    progressionState.physiological = physiologicalResult.data || null;
    progressionState.dayRows = daysResult.data || [];
    progressionState.wellbeingDays = mergeWellbeingDays(dailyResult.data || [], daysResult.data || [], start, end);
    progressionState.eventsByDate = buildProgressionEvents(progressionState.activities, progressionState.dayRows);
    progressionState.weeks = progressionWeeks(start, end);
    progressionState.activities.forEach((activity) => {
      const week = progressionState.weeks.find((item) => item.id === progressionWeekStart(activity.activity_date));
      if (week) week.activities.push(activity);
    });
    if (message) message.textContent = "";
    renderProgressionKpis();
    renderVolumeChart();
    renderSportChart();
    renderLoadChart();
    renderWellnessChart();
    renderDateComparison();
    renderPeriodStory(requestVersion);
    document.querySelectorAll(".chart-card,.kpi-strip").forEach(node=>{node.removeAttribute("aria-busy");node.classList.remove("is-data-unavailable");});
  } catch (error) {
    if (requestVersion !== progressionState.requestVersion) return;
    document.querySelectorAll(".chart-card,.kpi-strip").forEach(node=>node.classList.add("is-data-unavailable"));
    document.getElementById("periodStory")?.remove();
    document.getElementById("progressionDateComparison")?.remove();
    console.error("PROGRESSION : impossible de charger les indicateurs.", error);
    if (message) message.innerHTML = 'Les indicateurs n’ont pas pu être chargés. <button type="button" data-progression-retry>Réessayer</button>';
    window.MomentumMotion?.reveal();
  }
}

function completedActivities(activities = progressionState.activities) {
  return activities.filter((activity) => (window.MomentumMoments?.isCompletedActivity(activity) ?? activity.status === "done") && (!activity.activity_date || activity.activity_date <= (progressionState.calculationDate || iso(new Date()))));
}

function setProgressionChartEmpty(canvas, isEmpty, title = "Aucune donnée ne correspond à cette période.", text = "Tes premières activités feront apparaître ta progression ici.") {
  const wrapper = canvas?.parentElement;
  if (!wrapper) return;
  let empty = wrapper.querySelector(".progression-chart-empty");
  if (!empty) {
    empty = document.createElement("div");
    empty.className = "progression-chart-empty";
    wrapper.append(empty);
  }
  empty.hidden = !isEmpty;
  canvas.hidden = isEmpty;
  if (isEmpty) {
    const hasCustomFilter = progressionState.periodPreset !== "current-week";
    empty.innerHTML = window.MomentumEmptyState?.render({
      title:hasCustomFilter ? title : "Tes premières activités feront apparaître ta progression ici.",
      text:hasCustomFilter ? "Aucune activité réalisée ne correspond à la période choisie." : text,
      action:hasCustomFilter ? "Réinitialiser les filtres" : "",
      actionAttributes:hasCustomFilter ? "data-progression-reset" : "",
      compact:true
    }) || `<strong>${escapeHtml(title)}</strong>`;
  }
}

function activityValue(activity, mode) {
  const value=window.MomentumTrainingLoad.number(mode === "distance" ? activity.distance_km : activity.duration_min);
  return value==null||value<0?0:mode==="distance"?value:value/60;
}

function renderProgressionKpis() {
  const strip = document.getElementById("kpiStrip");
  if (!strip) return;
  const completed = completedActivities();
  const measuredDuration=completed.filter(a=>window.MomentumTrainingLoad.number(a.duration_min)!=null),measuredDistance=completed.filter(a=>window.MomentumTrainingLoad.number(a.distance_km)!=null);
  const hours = completed.reduce((sum, item) => sum + activityValue(item,"time"), 0);
  const distance = completed.reduce((sum, item) => sum + activityValue(item,"distance"), 0);
  const activeWeeks = progressionState.weeks.filter((week) => completedActivities(week.activities).length).length;
  const periodLabel = PROGRESSION_PERIODS[progressionState.periodPreset]?.label || "Période";
  strip.innerHTML = `<div>${progressionCounter(completed.length)}<span>Moments réalisés</span></div><div>${measuredDuration.length?progressionCounter(hours,{decimals:1,suffix:" h"}):"Non renseigné"}<span>Temps d’activité${measuredDuration.length<completed.length?" · partiel":""}</span></div><div>${measuredDistance.length?progressionCounter(distance,{decimals:1,suffix:" km"}):"Non renseignée"}<span>Distance enregistrée</span></div><div>${progressionCounter(new Set(completed.map(a=>a.activity_date)).size)}<span>Jours avec une activité</span></div>`;
  animateProgressionNumbers(strip);
}

function passportBaselineLoad() {
  // Conservé comme point de compatibilité technique, jamais injecté dans le modèle.
  return 0;
}

function activityTrainingLoad(activity) {
  return window.MomentumTrainingLoad.activityLoad(activity).load;
}

function progressionGranularity(startValue = progressionState.periodStart, endValue = progressionState.periodEnd) {
  const dayCount = window.MomentumTrainingLoad.daysBetween(startValue,endValue) + 1;
  if (dayCount <= 14) return "day";
  if (dayCount <= 120) return "week";
  return "month";
}

function progressionBucketKey(dateValue, granularity) {
  if (granularity === "week") return progressionWeekStart(dateValue);
  if (granularity === "month") return dateValue.slice(0, 7);
  return dateValue;
}

function progressionDateLabel(dateValue, granularity) {
  const options = granularity === "month" ? { month:"short", year:"2-digit" } : { day:"numeric", month:"short" };
  return new Intl.DateTimeFormat("fr-CH", options).format(dateFromIso(dateValue));
}

function buildVolumeSeries() {
  const granularity = progressionGranularity();
  const buckets = new Map();
  const activitiesByDate = new Map();
  completedActivities().forEach((activity) => {
    if (!activitiesByDate.has(activity.activity_date)) activitiesByDate.set(activity.activity_date, []);
    activitiesByDate.get(activity.activity_date).push(activity);
  });
  const start = dateFromIso(progressionState.periodStart);
  const end = dateFromIso(progressionState.periodEnd);
  const dayCount = Math.floor((end - start) / 86400000) + 1;
  for (let index = 0; index < dayCount; index += 1) {
    const date = iso(addDays(start, index));
    const key = progressionBucketKey(date, granularity);
    if (!buckets.has(key)) {
      buckets.set(key, { date:granularity === "month" ? `${key}-01` : key, hours:0, sessions:0, distance:0 });
    }
    const bucket = buckets.get(key);
    (activitiesByDate.get(date) || []).forEach((activity) => {
      bucket.hours += Number(activity.duration_min || 0) / 60;
      bucket.sessions += 1;
      bucket.distance += Number(activity.distance_km || 0);
    });
  }
  return [...buckets.values()];
}

function renderVolumeChart() {
  const canvas = document.getElementById("volumeChart");
  if (!canvas || !window.Chart) return;
  const series = buildVolumeSeries();
  const granularity = progressionGranularity();
  const totalHours = series.reduce((sum, item) => sum + item.hours, 0);
  const hasCompleted = totalHours > 0;
  setProgressionChartEmpty(canvas, !hasCompleted);
  if (!hasCompleted) {
    progressionState.volumeChart?.destroy();
    document.getElementById("volumeInsight").textContent = "Tes premières activités feront apparaître ton volume ici.";
    renderAccessibleChartTable("volumeChartTable", ["Période","Temps","Séances","Distance"], []);
    return;
  }
  progressionState.volumeChart?.destroy();
  progressionState.volumeChart = new Chart(canvas, {
    type:"bar",
    data:{
      labels:series.map((item) => progressionDateLabel(item.date, granularity)),
      datasets:[{
        label:"Temps d’activité",
        data:series.map((item) => Number(item.hours.toFixed(2))),
        backgroundColor:"rgba(39,60,49,.82)",
        hoverBackgroundColor:"#273c31",
        borderRadius:8,
        borderSkipped:false
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      animation:false,
      plugins:{legend:{display:false},tooltip:progressionChartTooltip({label:(context)=>`Temps d’activité : ${context.parsed.y.toLocaleString("fr-CH",{maximumFractionDigits:1})} h`})},
      scales:{x:{grid:{display:false},ticks:{maxTicksLimit:8,maxRotation:0,color:"#858178"}},y:{beginAtZero:true,grid:{color:"rgba(20,20,20,.07)"},ticks:{color:"#858178",callback:(value)=>`${value} h`}}}
    }
  });
  stageProgressionChart(progressionState.volumeChart, "volumeChartCard");
  renderAccessibleChartTable("volumeChartTable", ["Période","Temps","Séances","Distance"], series.map((item) => [progressionDateLabel(item.date,granularity),`${item.hours.toLocaleString("fr-CH",{maximumFractionDigits:1})} h`,item.sessions,`${item.distance.toLocaleString("fr-CH",{maximumFractionDigits:1})} km`]));
  const activeDays = new Set(completedActivities().map((activity) => activity.activity_date)).size;
  document.getElementById("volumeInsight").textContent = `${totalHours.toLocaleString("fr-CH",{maximumFractionDigits:1})} h construites sur ${activeDays} jour${activeDays > 1 ? "s" : ""} actif${activeDays > 1 ? "s" : ""}.`;
}

function normalizeProgressionText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function buildProgressionEvents(activities, dayRows) {
  const events = new Map();
  const add = (date, label) => { if (!date) return; if (!events.has(date)) events.set(date, []); if (!events.get(date).includes(label)) events.get(date).push(label); };
  activities.forEach(activity => {
    if (activity.activity_category === "adventure" || activity.qualifiers?.includes("adventure")) add(activity.activity_date, "Aventure");
    if (activity.qualifiers?.includes("together")) add(activity.activity_date, "Avec des proches");
    if (window.MomentumTrainingLoad.eligibility(activity).practice === "massage") add(activity.activity_date, "Massage");
  });
  // Les notes libres ne sont jamais interprétées comme des déclarations de maladie ou de vacances.
  dayRows.forEach(day => (day.context_annotations || []).forEach(value => {
    const label = { illness:"Maladie", vacation:"Vacances", competition:"Compétition" }[value];
    if (label) add(day.day_date, label);
  }));
  return events;
}

function buildLoadSeries() {
  const history = completedActivities(progressionState.historyActivities);
  const result = window.MomentumTrainingLoad.build(history, {
    asOf:progressionState.calculationDate || iso(new Date()), complete:progressionState.historyComplete === true
  });
  progressionState.loadResult = result;
  const byId = new Map(history.map(activity => [activity.id, activity]));
  progressionState.loadSeries = result.days.map(day => ({ ...day,
    activities:day.entries.map(item => byId.get(item.id)).filter(Boolean),
    actualLoad:day.known_load, modeledLoad:day.known_load, acute:day.recent, form:day.balance
  }));
  return progressionState.loadSeries;
}

function loadDisplaySeries(series) {
  const visible = series.filter((day) => day.date >= progressionState.periodStart && day.date <= progressionState.periodEnd);
  const granularity = progressionGranularity();
  if (granularity === "day") return visible.map((day) => ({ ...day, rangeStart:day.date, eventLabels:progressionState.eventsByDate.get(day.date) || [] }));
  const buckets = new Map();
  visible.forEach((day) => {
    const key=progressionBucketKey(day.date, granularity);
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(day);
  });
  return [...buckets.values()].map((bucket) => ({
    ...bucket.at(-1),
    rangeStart:bucket[0].date,
    activities:bucket.flatMap((day) => day.activities),
    actualLoad:bucket.reduce((sum,day) => sum+day.actualLoad,0),
    eventLabels:bucket.flatMap((day) => progressionState.eventsByDate.get(day.date) || []).filter((label,index,all) => all.indexOf(label) === index)
  }));
}

function loadPhase(series) {
  const result = progressionState.loadResult;
  if (!result?.has_calculable) return { label:"Pas encore de charge calculable", detail:"Une durée et un effort volontaire sont nécessaires." };
  const partial = series.some(day => day.partial);
  return { label:partial ? "Données partielles" : "Charges renseignées", detail:`Historique utilisé : depuis le ${result.source_start} · ${result.history_days} jours. Initialisation à zéro ; les activités non enregistrées ne sont pas connues.` };
}

function loadInterpretation(current) {
  if (!current || current.chronic == null) return "Pas encore de charge calculable.";
  if (current.partial) return "Une partie des activités n'est pas calculable. Ces repères partiels ne décrivent pas ta récupération.";
  return "Repères calculés à partir de tes activités renseignées. L'équilibre de charge ne décrit pas à lui seul ta récupération.";
}

function renderLoadChart() {
  const canvas = document.getElementById("fitnessChart");
  if (!canvas || !window.Chart) return;
  const series = buildLoadSeries();
  const hasCompleted = progressionState.loadResult?.has_calculable && series.some(day => day.chronic != null && day.date >= progressionState.periodStart && day.date <= progressionState.periodEnd);
  setProgressionChartEmpty(canvas, !hasCompleted, "Pas encore de charge calculable", "Renseigne librement une durée et un effort pour commencer tes repères.");
  if (!hasCompleted) {
    progressionState.loadChart?.destroy();
    document.getElementById("loadStatus").innerHTML = "";
    document.getElementById("loadInsight").textContent = "Pas encore de charge calculable pour cette période.";
    renderLoadCoverage(series.filter(day => day.date >= progressionState.periodStart && day.date <= progressionState.periodEnd));
    document.getElementById("loadModelPhase").textContent = "Pas encore de charge calculable";
    renderAccessibleChartTable("fitnessChartTable", ["Période","Charge chronique (unités MOMENTUM)","Charge récente (unités MOMENTUM)","Équilibre de charge (unités MOMENTUM)"], []);
    return;
  }
  const displaySeries = loadDisplaySeries(series);
  const phase = loadPhase(displaySeries);
  const today = displaySeries.at(-1);
  const granularity = progressionGranularity();
  progressionState.loadDisplaySeries = displaySeries;
  progressionState.loadChart?.destroy();
  const eventLabels = displaySeries.map((day) => day.eventLabels || []);
  progressionState.loadChart = new Chart(canvas,{ type:"line", data:{ labels:displaySeries.map((day) => progressionDateLabel(day.date, granularity)), datasets:[{label:"Charge chronique",data:displaySeries.map((day)=>day.chronic),segment:{borderDash:ctx=>displaySeries[ctx.p1DataIndex]?.partial?[6,4]:undefined},borderColor:"#273c31",backgroundColor:"rgba(39,60,49,.08)",fill:true,tension:.35,pointRadius:displaySeries.length > 45 ? 0 : 2,pointHoverRadius:6,pointHoverBorderWidth:3,borderWidth:2.5},{label:"Charge récente",data:displaySeries.map((day)=>day.acute),borderDash:[7,3],borderColor:"#d9763d",backgroundColor:"transparent",tension:.35,pointRadius:displaySeries.length > 45 ? 0 : 2,pointHoverRadius:6,pointHoverBorderWidth:3,borderWidth:2},{label:"Équilibre de charge",data:displaySeries.map((day)=>day.form),borderDash:[2,3],borderColor:"#6f63a6",backgroundColor:"transparent",tension:.3,pointRadius:displaySeries.length > 45 ? 0 : 2,pointHoverRadius:6,pointHoverBorderWidth:3,borderWidth:2},{label:"Événements",data:displaySeries.map((day,index)=>eventLabels[index].length?Math.max(day.chronic,day.acute)+6:null),borderColor:"#b27d42",backgroundColor:"#b27d42",showLine:false,pointRadius:5,pointHoverRadius:7,pointStyle:"rectRot"}] }, options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:"index",intersect:false},onClick:(_event,elements)=>{if(elements[0])openLoadDay(elements[0].index);},plugins:{legend:{position:"bottom",align:"start",labels:{usePointStyle:true,pointStyle:"circle",boxWidth:8,padding:16}},tooltip:progressionChartTooltip({label:(context)=>context.dataset.label==="Événements"?eventLabels[context.dataIndex].join(" • "):`${context.dataset.label} : ${Math.round(context.parsed.y)}`})},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:8,color:"#858178",maxRotation:0}},y:{grid:{color:"rgba(20,20,20,.07)"},ticks:{color:"#858178"}}}} });
  stageProgressionChart(progressionState.loadChart,"loadChartCard");
  renderAccessibleChartTable("fitnessChartTable", ["Période","Charge chronique (unités MOMENTUM)","Charge récente (unités MOMENTUM)","Équilibre de charge (unités MOMENTUM)"], displaySeries.map((day)=>[progressionDateLabel(day.date,granularity),day.chronic==null?"Non calculable":Math.round(day.chronic),day.acute==null?"Non calculable":Math.round(day.acute),`${day.form!=null&&day.form>=0?"+":""}${day.form==null?"Non calculable":Math.round(day.form)}`]), "load");
  document.getElementById("loadModelPhase").textContent=phase.label;
  document.getElementById("loadModelPhase").title=phase.detail;
  const loadStatus=document.getElementById("loadStatus");
  loadStatus.innerHTML=`<p>Fin de période mesurée · ${escapeHtml(today?.date || "")}</p><div>${today?.chronic==null?"Non calculable":progressionCounter(Math.round(today.chronic))}<span>Charge chronique</span></div><div>${today?.acute==null?"Non calculable":progressionCounter(Math.round(today.acute))}<span>Charge récente</span></div><div>${today?.form==null?"Non calculable":progressionCounter(Math.round(today.form),{prefix:today.form>=0?"+":""})}<span>Équilibre de charge</span></div>`;
  animateProgressionNumbers(loadStatus);
  document.getElementById("loadInsight").textContent=loadInterpretation(today);
  renderLoadCoverage(displaySeries);
  renderDateComparison();
}

function openLoadDay(index, selectedDate = null) {
  const bucket=progressionState.loadDisplaySeries[index];
  if(!bucket)return;
  if(!selectedDate && bucket.rangeStart && bucket.rangeStart!==bucket.date)return openAggregatedDays(bucket.rangeStart,bucket.date,date=>openLoadDay(index,date));
  const day=selectedDate?progressionState.loadSeries.find(item=>item.date===selectedDate):bucket;
  const content=document.getElementById("progressionDialogContent");
  const dialog=document.getElementById("progressionDialog");
  if(!day||!content||!dialog)return;
  selectComparisonDate(day.date);
  const events=day.eventLabels||[];
  const periodLabel=day.rangeStart&&day.rangeStart!==day.date?`${fmtDate(day.rangeStart)} — ${fmtDate(day.date)}`:fmtDate(day.date);
  content.innerHTML=`<span class="section-kicker">${escapeHtml(periodLabel)}</span><h2>Charge renseignée : ${Math.round(day.actualLoad)} unités</h2>${day.partial?'<p>Données partielles. Cette somme ne représente pas toute la charge enregistrée.</p>':''}<div class="progression-detail-kpis"><div><strong>${day.chronic==null?"Non calculable":Math.round(day.chronic)}</strong><span>Charge chronique</span></div><div><strong>${day.acute==null?"Non calculable":Math.round(day.acute)}</strong><span>Charge récente</span></div><div><strong>${day.form!=null&&day.form>=0?"+":""}${day.form==null?"Non calculable":Math.round(day.form)}</strong><span>Équilibre de charge</span></div></div>${events.length?`<p class="load-day-events">${events.map(escapeHtml).join(" • ")}</p>`:""}<div class="load-day-activities">${day.activities.length?day.activities.map((activity)=>`<article><strong>${escapeHtml(window.MomentumSports?.getLabel(activity.sport,activity.activity_type||"Activité")||"Activité")}</strong><span>${activityTrainingLoad(activity) == null ? "Charge non calculable" : `${Math.round(activityTrainingLoad(activity))} unités MOMENTUM`} · ${escapeHtml(window.MomentumDuration?.format(activity.duration_min||0) || `${Math.round(activity.duration_min||0)} min`)} · effort physique ${activity.rpe||"non renseigné"} / 10</span></article>`).join(""):'<p>Aucune activité enregistrée sur cette période.</p>'}</div>`;
  openHomeDialog(dialog);
}

function buildSportDistribution() {
  const groups = new Map();
  completedActivities().forEach((activity) => {
    if (progressionState.mode === "distance" && Number(activity.distance_km || 0) <= 0) return;
    const visual = window.MomentumSportVisuals.getGroup(activity.sport, activity.activity_category);
    if (!groups.has(visual.id)) groups.set(visual.id, { ...visual, activities:[], hours:0, distance:0 });
    const group = groups.get(visual.id);
    group.activities.push(activity);
    group.hours += activityValue(activity,"time");
    group.distance += activityValue(activity,"distance");
  });
  const valueKey = progressionState.mode === "distance" ? "distance" : "hours";
  progressionState.sportGroups = [...groups.values()].filter((group) => group[valueKey] > 0).sort((a,b) => b[valueKey]-a[valueKey]);
  return progressionState.sportGroups;
}

function renderSportChart() {
  const canvas=document.getElementById("sportChart");
  if(!canvas||!window.Chart)return;
  const groups=buildSportDistribution();
  const valueKey=progressionState.mode==="distance"?"distance":"hours";
  const unit=progressionState.mode==="distance"?"km":"h";
  const question=document.getElementById("activityDistributionQuestion");
  if(question)question.textContent=progressionState.mode==="distance"?"Où ai-je parcouru mes kilomètres ?":"Où ai-je passé mon temps ?";
  const hasCompleted = groups.some((group) => group[valueKey] > 0);
  setProgressionChartEmpty(canvas, !hasCompleted);
  const summary=document.getElementById("activityDistributionSummary");
  if (!hasCompleted) { progressionState.sportChart?.destroy(); if(summary)summary.textContent=progressionState.mode==="distance"?"Aucune activité avec distance sur cette période.":"Tes premières activités feront apparaître ta progression ici."; document.getElementById("sportInsight").textContent=""; renderAccessibleChartTable("sportChartTable",["Discipline",progressionState.mode==="distance"?"Distance":"Temps"],[]); return; }
  canvas.parentElement.style.height=`${Math.max(300,groups.length*48)}px`;
  progressionState.sportChart?.destroy();
  progressionState.sportChart=new Chart(canvas,{type:"bar",data:{labels:groups.map((group)=>group.label),datasets:[{label:progressionState.mode==="distance"?"Distance":"Temps",data:groups.map((group)=>group[valueKey]),backgroundColor:groups.map((group)=>group.color),borderRadius:8,borderSkipped:false,barThickness:22}]},options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,animation:false,onClick:(_event,elements)=>{if(elements[0])openSportDetail(elements[0].index);},plugins:{legend:{display:false},tooltip:progressionChartTooltip({label:(context)=>`${context.dataset.label} : ${context.parsed.x.toLocaleString("fr-CH",{maximumFractionDigits:1})} ${unit}`})},scales:{x:{beginAtZero:true,grid:{color:"rgba(20,20,20,.07)"},ticks:{color:"#858178",callback:(value)=>`${value} ${unit}`}},y:{grid:{display:false},ticks:{color:"#2f2f2f",font:{weight:"700"}}}}}});
  stageProgressionChart(progressionState.sportChart,"sportChartCard");
  renderAccessibleChartTable("sportChartTable",["Discipline",progressionState.mode==="distance"?"Distance":"Temps"],groups.map((group)=>[group.label,`${group[valueKey].toLocaleString("fr-CH",{maximumFractionDigits:1})} ${unit}`]),"sport");
  const total=groups.reduce((sum,group)=>sum+group[valueKey],0);
  const dominant=groups[0];
  const formattedTotal=total.toLocaleString("fr-CH",{maximumFractionDigits:1});
  if(summary)summary.innerHTML=progressionState.mode==="distance"?`<strong>${formattedTotal} km parcourus</strong><span> • ${groups.length} discipline${groups.length>1?"s":""} pratiquée${groups.length>1?"s":""}</span>`:`<strong>${formattedTotal} h d’activités</strong><span> • ${groups.length} discipline${groups.length>1?"s":""} pratiquée${groups.length>1?"s":""}</span>`;
  document.getElementById("sportInsight").textContent=dominant?`${dominant.label} représente ${Math.round(dominant[valueKey]/Math.max(total,.01)*100)} % ${progressionState.mode==="distance"?"de la distance":"du temps"} sur cette période.`:"";
}

function intensityLabel(rpe) {
  const value=Number(rpe);
  if(!value)return "Non renseignée";
  if(value<=3)return "Douce";
  if(value<=6)return "Modérée";
  if(value<=8)return "Soutenue";
  return "Très intense";
}

function openSportDetail(index) {
  const group=progressionState.sportGroups[index];
  const content=document.getElementById("progressionDialogContent");
  const dialog=document.getElementById("progressionDialog");
  if(!group||!content||!dialog)return;
  const subdisciplines=new Map();
  const intensities=new Map();
  const completed=completedActivities(group.activities);
  completed.forEach((activity)=>{
    const label=window.MomentumSports?.getLabel(activity.sport,activity.activity_type||group.label)||group.label;
    if(!subdisciplines.has(label))subdisciplines.set(label,{hours:0,distance:0,sessions:0});
    const sub=subdisciplines.get(label);sub.hours+=activityValue(activity,"time");sub.distance+=activityValue(activity,"distance");sub.sessions+=1;
    const intensity=intensityLabel(activity.rpe);intensities.set(intensity,(intensities.get(intensity)||0)+activityValue(activity,"time"));
  });
  content.innerHTML=`<span class="section-kicker">Discipline</span><h2>${escapeHtml(group.label)}</h2><div class="progression-detail-kpis"><div><strong>${group.hours.toFixed(1)} h</strong><span>Temps d’activité renseigné</span></div><div><strong>${group.distance.toFixed(1)} km</strong><span>Distance</span></div><div><strong>${completed.length}</strong><span>Séances réalisées</span></div></div><section class="sport-detail-section"><h3>Sous-disciplines</h3><div class="sport-breakdown">${[...subdisciplines.entries()].sort((a,b)=>b[1].hours-a[1].hours).map(([label,data])=>`<div><span>${escapeHtml(label)}</span><strong>${data.hours.toFixed(1)} h · ${data.distance.toFixed(1)} km · ${data.sessions} séance${data.sessions>1?"s":""}</strong></div>`).join("")}</div></section><button class="secondary intensity-toggle" id="showIntensity" type="button">Afficher la répartition par intensité</button><section class="sport-detail-section" id="intensityDetail" hidden><h3>Répartition par intensité</h3><div class="intensity-breakdown">${[...intensities.entries()].map(([label,hours])=>`<div><span>${escapeHtml(label)}</span><i><b style="width:${Math.round(hours/Math.max(group.hours,.01)*100)}%"></b></i><strong>${hours.toFixed(1)} h</strong></div>`).join("")}</div></section>`;
  document.getElementById("showIntensity")?.addEventListener("click",(event)=>{const detail=document.getElementById("intensityDetail");detail.hidden=!detail.hidden;event.currentTarget.textContent=detail.hidden?"Afficher la répartition par intensité":"Masquer la répartition par intensité";});
  openHomeDialog(dialog);
}

function normalizeSubjective(value) {
  if(value == null || value === "" || typeof value === "boolean") return null;
  const number=Number(value);
  if(!Number.isFinite(number))return null;
  return Math.max(0,Math.min(100,number<=10?number*10:number));
}

function subjectiveValueOutOfTen(value) {
  if(value == null || value === "" || typeof value === "boolean") return null;
  const number=Number(value);
  if(!Number.isFinite(number))return null;
  return Math.max(0,Math.min(10,number>10?number/10:number));
}

function physiologicalValue(value) {
  if(value == null || value === "" || typeof value === "boolean") return null;
  const number=Number(value);
  return Number.isFinite(number)&&number>=0?number:null;
}

function mergeWellbeingDays(dailyRows, legacyRows, start, end) {
  const dailyMap=new Map(dailyRows.map((row)=>[row.recorded_date,row]));
  const legacyMap=new Map(legacyRows.map((row)=>[row.day_date,row]));
  const sleepTarget=Number(progressionState.physiological?.preferred_sleep_hours||8);
  const dayCount=window.MomentumTrainingLoad.daysBetween(start,end)+1;
  return Array.from({length:dayCount},(_,index)=>{
    const date=iso(addDays(dateFromIso(start),index));
    const daily=dailyMap.get(date)||{};const legacy=legacyMap.get(date)||{};
    const resolved=window.MomentumWellbeingData.resolve(daily,legacy);
    const sleepHours=resolved.values.sleep_hours;
    const normalizedSleepHours=physiologicalValue(sleepHours);
    const sleepScore=normalizedSleepHours==null?null:Math.max(0,Math.min(100,normalizedSleepHours/sleepTarget*100));
    const motivationSource=resolved.values.motivation;
    const motivation=subjectiveValueOutOfTen(motivationSource);
    const motivationScore=normalizeSubjective(motivationSource);
    const recovery=sleepQualityLevel(resolved.values.sleep_quality_value,resolved.sleep_quality_unit);
    const recoveryScore=sleepQualityScore(resolved.values.sleep_quality_value,resolved.sleep_quality_unit);
    const available=[sleepScore,motivationScore,recoveryScore].filter((value)=>value!=null);
    return {date,sleepHours:normalizedSleepHours,sleepTarget,motivation,recovery,summary:available.length?available.reduce((sum,value)=>sum+value,0)/available.length:null,restingHr:resolved.values.resting_hr,hrv:resolved.values.hrv_ms,note:resolved.note||null,source:daily.source_label||"Journal historique",sources:resolved.sources,summaryInputs:available.length};
  });
}

function wellnessDefinition(mode) {
  return ({
    summary:{label:"Synthèse descriptive",dataKey:"summary",color:"#273c31",scale:{min:0,max:100}},
    sleep:{label:"Sommeil",dataKey:"sleepHours",color:"#5d7894",scale:{beginAtZero:true,suggestedMax:12}},
    motivation:{label:"Motivation",dataKey:"motivation",color:"#d49a3a",scale:{min:0,max:10}},
    recovery:{label:"Qualité du sommeil",dataKey:"recovery",color:"#66845b",scale:{min:1,max:5},stepSize:1},
    restingHr:{label:"FC au repos",dataKey:"restingHr",color:"#d4655c",scale:{suggestedMin:30,suggestedMax:100}},
    hrv:{label:"Variabilité de la FC",dataKey:"hrv",color:"#6f63a6",scale:{beginAtZero:true,suggestedMax:120}}
  })[mode];
}

function wellbeingDisplayDays(days, dataKey) {
  const granularity=progressionGranularity();
  if(granularity==="day")return days;
  const buckets=new Map();
  days.forEach((day)=>{
    const key=progressionBucketKey(day.date,granularity);
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(day);
  });
  return [...buckets.values()].map((bucket)=>{
    const values=bucket.map((day)=>day[dataKey]).filter((value)=>value!=null);
    return {...bucket.at(-1),rangeStart:bucket[0].date,measureCount:values.length,[dataKey]:values.length?values.reduce((sum,value)=>sum+Number(value),0)/values.length:null};
  });
}

function wellnessChartValue(mode, value) {
  if (value == null) return "Aucune donnée";
  if(mode==="sleep")return formatSleepDuration(value);
  if(mode==="motivation")return `${Number(value).toLocaleString("fr-CH",{maximumFractionDigits:1})} / 10`;
  if(mode==="recovery")return sleepQualityLabel(value,"qualitative-v1");
  if(mode==="restingHr")return `${Math.round(value)} bpm`;
  if(mode==="hrv")return `${Math.round(value)} ms`;
  return `${Math.round(value)} / 100`;
}

function wellnessAxisValue(mode, value) {
  if(mode==="sleep")return `${Number(value).toLocaleString("fr-CH",{maximumFractionDigits:1})} h`;
  if(mode==="motivation")return `${value} / 10`;
  if(mode==="recovery")return Number.isInteger(Number(value))?sleepQualityLabel(value,"qualitative-v1"):"";
  if(mode==="restingHr")return `${value} bpm`;
  if(mode==="hrv")return `${value} ms`;
  return value;
}

function renderWellnessChart() {
  const canvas=document.getElementById("wellnessChart");
  if(!canvas||!window.Chart)return;
  const definition=wellnessDefinition(progressionState.wellnessMode);
  const sourceDays=progressionState.wellbeingDays;
  const days=wellbeingDisplayDays(sourceDays,definition.dataKey);
  const granularity=progressionGranularity();
  progressionState.wellbeingDisplayDays=days;
  const availableCount=days.filter((day)=>day[definition.dataKey]!=null).length;
  setProgressionChartEmpty(canvas, availableCount === 0, "Aucune donnée ne correspond à cette période.", "Le bien-être apparaîtra après une saisie ou une source déclarée.");
  if (availableCount === 0) { progressionState.wellnessChart?.destroy(); document.getElementById("wellnessInsight").textContent=""; renderAccessibleChartTable("wellnessChartTable",["Date",definition.label],[]); return; }
  progressionState.wellnessChart?.destroy();
  progressionState.wellnessChart=new Chart(canvas,{type:"line",data:{labels:days.map((day)=>progressionDateLabel(day.date,granularity)),datasets:[{label:definition.label,data:days.map((day)=>day[definition.dataKey]),borderColor:definition.color,backgroundColor:`${definition.color}18`,fill:true,tension:.35,pointRadius:days.length>45?0:2,pointHoverRadius:6,pointHoverBorderWidth:3,spanGaps:false,borderWidth:2.5}]},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:"index",intersect:false},onClick:(_event,elements)=>{if(elements[0])openWellnessDay(elements[0].index);},plugins:{legend:{display:false},tooltip:progressionChartTooltip({label:(context)=>`${definition.label} : ${wellnessChartValue(progressionState.wellnessMode,context.parsed.y)}`})},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:8,maxRotation:0,color:"#858178"}},y:{...definition.scale,grid:{color:"rgba(20,20,20,.07)"},ticks:{color:"#858178",stepSize:definition.stepSize,callback:(value)=>wellnessAxisValue(progressionState.wellnessMode,value)}}}}});
  stageProgressionChart(progressionState.wellnessChart,"wellnessChartCard");
  renderAccessibleChartTable("wellnessChartTable",["Date",definition.label],days.map((day)=>[progressionDateLabel(day.date,granularity),day[definition.dataKey]==null?"Non renseigné":wellnessChartValue(progressionState.wellnessMode,day[definition.dataKey])]),"wellness");
  if(availableCount<5){progressionState.wellnessChart.data.datasets[0].pointRadius=4;progressionState.wellnessChart.update("none");}
  const recent=[...days].reverse().find((day)=>day[definition.dataKey]!=null);
  const insight=document.getElementById("wellnessInsight");
  renderDateComparison();
  insight.textContent=recent?`${definition.label} : ${wellnessChartValue(progressionState.wellnessMode,recent[definition.dataKey])} lors de la dernière journée renseignée.`:"Aucune donnée disponible pour cet indicateur. Aucune mesure n’a été renseignée pour cet indicateur.";
}

function wellnessValue(value,suffix=" / 100") { return value==null?"Non renseigné":`${Math.round(value)}${suffix}`; }

function openWellnessDay(index, selectedDate = null) {
  const bucket=progressionState.wellbeingDisplayDays[index];
  if(!bucket)return;
  if(!selectedDate && bucket.rangeStart && bucket.rangeStart!==bucket.date)return openAggregatedDays(bucket.rangeStart,bucket.date,date=>openWellnessDay(index,date));
  const day=selectedDate?progressionState.wellbeingDays.find(item=>item.date===selectedDate):bucket;
  if (!day) return;
  selectComparisonDate(day.date);
  const load=progressionState.loadSeries.find((item)=>item.date===day.date);
  const content=document.getElementById("progressionDialogContent");const dialog=document.getElementById("progressionDialog");
  if(!day||!content||!dialog)return;
  content.innerHTML=`<span class="section-kicker">${escapeHtml(day.rangeStart && day.rangeStart !== day.date ? `${fmtDate(day.rangeStart)} — ${fmtDate(day.date)}` : fmtDate(day.date))}</span><h2>Observations disponibles</h2><div class="wellness-detail-grid"><div><span>Sommeil</span><strong>${day.sleepHours==null?"Non renseigné":escapeHtml(formatSleepDuration(day.sleepHours))}</strong><small>${day.sleepHours==null?"Durée non renseignée":`Objectif ${escapeHtml(formatSleepDuration(day.sleepTarget))}`}</small></div><div><span>Motivation au réveil</span><strong>${day.motivation==null?"Non renseignée":`${day.motivation.toLocaleString("fr-CH",{maximumFractionDigits:1})} / 10`}</strong></div><div><span>Qualité du sommeil</span><strong>${day.recovery==null?"Non renseignée":escapeHtml(sleepQualityLabel(day.recovery,"qualitative-v1"))}</strong></div></div><div class="progression-detail-kpis"><div><strong>${load?.complete_recorded_load == null ? "Partielle ou non calculable" : Math.round(load.known_load)}</strong><span>Charge sportive</span></div><div><strong>${day.restingHr==null?"—":`${Math.round(day.restingHr)} bpm`}</strong><span>FC repos</span></div><div><strong>${day.hrv==null?"—":`${Math.round(day.hrv)} ms`}</strong><span>VFC</span></div></div><section class="wellness-note-detail"><span class="card-label">Note utilisateur</span><p>${escapeHtml(day.note||"Aucune note pour cette journée.")}</p>${day.source?`<small>Source : ${escapeHtml(day.source)}</small>`:""}</section>`;
  content.insertAdjacentHTML("beforeend",`<a class="secondary" href="index.html?wellbeing=${encodeURIComponent(day.date)}#today">Modifier les observations de cette journée</a>`);
  openHomeDialog(dialog);
}

async function applyProgressionPeriod(preset, customStart = null, customEnd = null, offset = 0) {
  const message = document.querySelector("[data-period-message]");
  const periodOffset = preset === "custom" ? 0 : Number(offset) || 0;
  const range = progressionPeriodRange(preset, customStart, customEnd, periodOffset);
  if (!range.start || !range.end || range.start > range.end) {
    if (message) message.textContent = "Choisis une date de début antérieure à la date de fin.";
    return;
  }

  progressionState.periodPreset = preset;
  progressionState.periodOffset = periodOffset;
  progressionState.periodStart = range.start;
  progressionState.periodEnd = range.end;
  renderProgressionPeriodControl(range);
  saveProgressionPreferences();
  if (message) message.textContent = "";
  await loadProgressionData();
}

function bindProgression() {
  const preferences = readProgressionPreferences();
  if (PROGRESSION_PERIODS[preferences.periodPreset]) progressionState.periodPreset = preferences.periodPreset;
  if (Number.isInteger(preferences.periodOffset)) progressionState.periodOffset = preferences.periodOffset;
  if (["time","distance"].includes(preferences.mode)) progressionState.mode = preferences.mode;
  if (["summary","motivation","sleep","restingHr","hrv"].includes(preferences.wellnessMode)) progressionState.wellnessMode = preferences.wellnessMode;
  if (progressionState.periodPreset === "custom" && preferences.periodStart && preferences.periodEnd) {
    progressionState.periodStart = preferences.periodStart;
    progressionState.periodEnd = preferences.periodEnd;
  }
  document.addEventListener("click", async (event) => {
    if (event.target.closest("[data-progression-retry]")) await loadProgressionData();
    if (event.target.closest("[data-progression-reset]")) {
      const custom = document.querySelector("[data-period-custom]");
      if (custom) custom.hidden = true;
      await applyProgressionPeriod("last-7-days", null, null, 0);
    }
    const toggle = event.target.closest("[data-chart-table-toggle]");
    if (toggle) {
      const table = document.getElementById(toggle.dataset.chartTableToggle);
      if (table) { table.hidden = !table.hidden; toggle.setAttribute("aria-expanded", String(!table.hidden)); toggle.textContent = table.hidden ? "Afficher les données" : "Masquer les données"; }
    }
    const detail = event.target.closest("[data-progression-detail]")?.dataset.progressionDetail;
    if (detail) {
      const [type,index] = detail.split(":");
      if (type === "sport") openSportDetail(Number(index));
      if (type === "load") openLoadDay(Number(index));
      if (type === "wellness") openWellnessDay(Number(index));
    }
  });
  document.querySelectorAll("[data-volume-mode]").forEach((button) => { button.classList.toggle("active",button.dataset.volumeMode===progressionState.mode); button.setAttribute("aria-pressed",String(button.dataset.volumeMode===progressionState.mode)); button.addEventListener("click", () => { progressionState.mode=button.dataset.volumeMode; document.querySelectorAll("[data-volume-mode]").forEach((item)=>{const active=item===button;item.classList.toggle("active",active);item.setAttribute("aria-pressed",String(active));}); saveProgressionPreferences(); renderSportChart(); renderVolumeChart(); }); });
  document.querySelectorAll("[data-wellness-mode]").forEach((button) => { button.classList.toggle("active",button.dataset.wellnessMode===progressionState.wellnessMode); button.setAttribute("aria-pressed",String(button.dataset.wellnessMode===progressionState.wellnessMode)); button.addEventListener("click",()=>{progressionState.wellnessMode=button.dataset.wellnessMode;document.querySelectorAll("[data-wellness-mode]").forEach((item)=>{const active=item===button;item.classList.toggle("active",active);item.setAttribute("aria-pressed",String(active));});saveProgressionPreferences();renderWellnessChart();}); });
  const custom = document.querySelector("[data-period-custom]");
  const customStart = document.querySelector("[data-period-start]");
  const customEnd = document.querySelector("[data-period-end]");
  if (custom) custom.hidden = progressionState.periodPreset !== "custom";

  document.querySelectorAll("[data-period-preset]").forEach((button) => {
    button.addEventListener("click", async () => {
      const preset = button.dataset.periodPreset;
      const isCustom = preset === "custom";
      if (custom) custom.hidden = !isCustom;
      if (isCustom) {
        progressionState.periodPreset = "custom";
        progressionState.periodOffset = 0;
        renderProgressionPeriodControl({ label:PROGRESSION_PERIODS.custom.label, start:customStart?.value, end:customEnd?.value });
      } else {
        await applyProgressionPeriod(preset, null, null, 0);
      }
    });
  });

  document.querySelectorAll("[data-period-shift]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (progressionState.periodPreset === "custom") return;
      const direction = Number(button.dataset.periodShift) || 0;
      await applyProgressionPeriod(progressionState.periodPreset, null, null, progressionState.periodOffset + direction);
    });
  });

  document.querySelector("[data-period-apply]")?.addEventListener("click", async () => {
    await applyProgressionPeriod("custom", customStart?.value, customEnd?.value);
  });

  const initialRange = progressionPeriodRange(progressionState.periodPreset, progressionState.periodStart, progressionState.periodEnd, progressionState.periodOffset);
  if (customStart) customStart.value = initialRange.start || progressionPeriodRange("current-week").start;
  if (customEnd) customEnd.value = initialRange.end || progressionPeriodRange("current-week").end;
  progressionState.periodStart = initialRange.start;
  progressionState.periodEnd = initialRange.end;
  renderProgressionPeriodControl(initialRange);

  document.getElementById("closeProgressionDialog")?.addEventListener("click", () => closeHomeDialog(document.getElementById("progressionDialog")));
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.momentumPageReady) await window.momentumPageReady;
  if (window.Chart && window.MomentumMotion?.chartHaloPlugin) {
    window.Chart.register(window.MomentumMotion.chartHaloPlugin);
  }
  bindProgression();
  loadProgressionData();
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await window.momentumDB.auth.signOut();
    window.location.href = "login.html";
  });
});

/* CDC : qualité de données et comparaison à date commune, sans nouvel indicateur physiologique. */
function renderLoadCoverage(series) {
  let host = document.getElementById("loadCoverage");
  if (!host) { host = document.createElement("div"); host.id = "loadCoverage"; document.getElementById("loadInsight")?.after(host); }
  const result = progressionState.loadResult;
  const items = (progressionState.loadSeries || []).filter(day => day.date >= progressionState.periodStart && day.date <= progressionState.periodEnd).flatMap(day => day.entries || []);
  const coverage = window.MomentumTrainingLoad.coverage(items);
  const allMissing = result?.coverage?.missing || [];
  const labels = { missing_rpe:"Effort non renseigné", missing_duration:"Durée non renseignée", invalid_input:"Valeur à vérifier", undetermined_type:"Nature à préciser" };
  host.innerHTML = `<p>${coverage.calculable} activités calculables sur ${coverage.eligible} admissibles${coverage.undetermined ? ` · ${coverage.undetermined} natures à préciser` : ""}${coverage.excluded ? ` · ${coverage.excluded} pratiques exclues` : ""}.</p>
    ${result?.source_start ? `<p>Historique utilisé : depuis le ${escapeHtml(result.source_start)} · ${result.history_days} jours. Initialisation à zéro ; les activités non enregistrées restent inconnues.</p>` : ""}
    ${coverage.undocumented ? `<p>${coverage.undocumented} efforts historiques d’origine non documentée, conservés sans modification.</p>` : ""}
    ${allMissing.length ? `<details><summary>Voir les données à compléter (${allMissing.length})</summary><ul>${allMissing.map(item => `<li><a href="index.html?activity=${encodeURIComponent(item.id || "")}#today">${escapeHtml(item.date || "Date à vérifier")} · ${escapeHtml(labels[item.reason] || "Données à compléter")}</a></li>`).join("")}</ul></details>` : ""}`;
}
function selectComparisonDate(date) {
  if (!window.MomentumTrainingLoad.dateKey(date) || date < progressionState.periodStart || date > progressionState.periodEnd) return;
  progressionState.selectedDate = date;
  renderDateComparison();
}
function renderDateComparison() {
  let host = document.getElementById("progressionDateComparison");
  if (!host) {
    host = document.createElement("section"); host.id = "progressionDateComparison"; host.className = "progression-date-comparison";
    document.getElementById("loadChartCard")?.closest(".progression-chart-group")?.after(host);
    if (!host.isConnected) document.getElementById("loadChartCard")?.parentElement?.after(host);
  }
  let date = progressionState.selectedDate;
  if (!date || date < progressionState.periodStart || date > progressionState.periodEnd) date = [progressionState.periodEnd, iso(new Date())].sort()[0];
  if (date < progressionState.periodStart) { host.textContent = "Cette période est à venir : aucune mesure observée."; return; }
  progressionState.selectedDate = date;
  const day = progressionState.loadSeries.find(item => item.date === date);
  const wellbeing = progressionState.wellbeingDays.find(item => item.date === date);
  const load = day?.chronic == null ? "Non calculable" : `${Math.round(day.known_load)} unités MOMENTUM${day.partial ? " · historique partiel" : ""}`;
  host.innerHTML = `<label>Charge et bien-être à la même date <input type="date" value="${escapeHtml(date)}" min="${escapeHtml(progressionState.periodStart)}" max="${escapeHtml([progressionState.periodEnd,iso(new Date())].sort()[0])}" aria-label="Date de comparaison"></label>
    <div><p><strong>Charge renseignée</strong><br>${escapeHtml(load)}</p><p><strong>Bien-être</strong><br>Sommeil : ${wellbeing?.sleepHours == null ? "Non renseigné" : escapeHtml(formatSleepDuration(wellbeing.sleepHours))} · FC repos : ${wellbeing?.restingHr == null ? "Non renseignée" : `${wellbeing.restingHr} bpm`} · VFC : ${wellbeing?.hrv == null ? "Non renseignée" : `${wellbeing.hrv} ms`}</p></div>
    <small>La lecture commune ne démontre pas de lien de cause à effet.</small>`;
  host.querySelector("input")?.addEventListener("change", event => selectComparisonDate(event.target.value));
  for (const [chart, values] of [[progressionState.loadChart,progressionState.loadDisplaySeries],[progressionState.wellnessChart,progressionState.wellbeingDisplayDays]]) {
    const index = values.findIndex(item => date >= (item.rangeStart || item.date) && date <= item.date);
    chart?.setActiveElements?.(index >= 0 ? [{ datasetIndex:0,index }] : []); chart?.update?.("none");
  }
}

function openAggregatedDays(start,end,onSelect){
 const content=document.getElementById("progressionDialogContent"),dialog=document.getElementById("progressionDialog");
 content.innerHTML=`<p class="section-kicker">${escapeHtml(fmtDate(start))} — ${escapeHtml(fmtDate(end))}</p><h2>Choisir une journée</h2><p>Le graphique présente une période agrégée. Choisis un jour pour consulter ses observations réelles.</p><label>Date<input type="date" id="detailDay" min="${start}" max="${end}" value="${end}"></label><button type="button" class="primary" id="viewDetailDay">Voir cette journée</button>`;
 document.getElementById("viewDetailDay").onclick=()=>{const value=document.getElementById("detailDay").value;if(value>=start&&value<=end)onSelect(value);};openHomeDialog(dialog);
}

async function renderPeriodStory(expectedRequest) {
 let host=document.getElementById("periodStory");if(!host){host=document.createElement("section");host.id="periodStory";host.className="period-story";document.getElementById("kpiStrip")?.after(host);}
 const activities=completedActivities(),chosen=activities.filter(a=>a.is_memorable).sort((a,b)=>String(b.activity_date).localeCompare(String(a.activity_date)))[0];
 const count=activities.length;let memory=null;
 if(chosen){try{const r=await window.momentumDB.from("activity_flow_assessments").select("retained_memory").eq("activity_id",chosen.id).eq("user_id",chosen.user_id).maybeSingle();if(!r.error)memory=r.data?.retained_memory||null;}catch(_){}}
 if(expectedRequest!==progressionState.requestVersion)return;
 const range=`${fmtDate(progressionState.periodStart)} — ${fmtDate(progressionState.periodEnd)}`;
 host.innerHTML=`<p class="section-kicker">Ta période · ${escapeHtml(range)}</p><h3>${count?`${count} Moment${count>1?"s":""} réalisé${count>1?"s":""}.`:"Aucun Moment réalisé enregistré sur cette période."}</h3>${memory?`<blockquote>${escapeHtml(memory)}</blockquote><p>Les mots que tu as conservés le ${escapeHtml(fmtDate(chosen.activity_date))}.</p><a href="index.html?activity=${encodeURIComponent(chosen.id)}#today">Retrouver ce Moment</a>`:""}<p>Quel Moment aimerais-tu vivre ensuite ?</p><a href="you.html?section=mission">Retrouver Mon Horizon</a>`;
}
