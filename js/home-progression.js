/* MOMENTUM — PROGRESSION v1.0 */
const PROGRESSION_PERIODS = {
  "current-week": { label:"Semaine en cours", kind:"rolling-days", amount:7 },
  "4-weeks": { label:"4 semaines", kind:"rolling-days", amount:28 },
  "12-weeks": { label:"12 semaines", kind:"rolling-days", amount:84 },
  "6-months": { label:"6 mois", kind:"rolling-months", amount:6 },
  "1-year": { label:"1 année", kind:"rolling-months", amount:12 },
  custom: { label:"Période personnalisée", kind:"custom" }
};

const progressionState = {
  activities:[], historyActivities:[], weeks:[], loadChart:null, sportChart:null,
  wellnessChart:null, mode:"time", wellnessMode:"summary", passport:null,
  physiological:null, loadSeries:[], loadDisplaySeries:[], sportGroups:[], wellbeingDays:[], wellbeingDisplayDays:[], dayRows:[], eventsByDate:new Map(),
  periodPreset:"current-week", periodStart:null, periodEnd:null, requestVersion:0
};

function progressionPeriodRange(preset = progressionState.periodPreset, customStart = null, customEnd = null) {
  const definition = PROGRESSION_PERIODS[preset] || PROGRESSION_PERIODS["current-week"];
  if (definition.kind === "custom") {
    return { start:customStart, end:customEnd, label:definition.label };
  }

  const today = new Date();
  const mondayIndex = (today.getDay() + 6) % 7;
  const end = addDays(today, 6 - mondayIndex);
  let start;

  if (definition.kind === "rolling-days") {
    start = addDays(end, -(definition.amount - 1));
  } else {
    const targetMonth = new Date(
      end.getFullYear(),
      end.getMonth() - definition.amount,
      1,
      12
    );
    const lastTargetDay = new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth() + 1,
      0,
      12
    ).getDate();
    targetMonth.setDate(Math.min(end.getDate(), lastTargetDay));
    start = addDays(targetMonth, 1);
  }

  return { start:iso(start), end:iso(end), label:definition.label };
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
      progressionState.periodEnd
    );
    const start = range.start;
    const end = range.end;
    if (!start || !end) return;
    progressionState.periodStart = start;
    progressionState.periodEnd = end;
    const historyEnd = [end, iso(new Date())].sort().at(-1);
    const [activitiesResult, passportResult, dailyResult, daysResult, physiologicalResult] = await Promise.all([
      window.momentumDB.from("activities").select("id,sport,activity_type,activity_category,activity_date,duration_min,distance_km,elevation_m,rpe,avg_hr,status,notes").eq("user_id", user.id).eq("status", "done").lte("activity_date", historyEnd).order("activity_date"),
      window.momentumDB.from("passports").select("sport_level,habits,personalization").eq("user_id", user.id).maybeSingle(),
      window.momentumDB.from("daily_wellbeing").select("recorded_date,sleep_hours,motivation,resting_hr,hrv_ms,sleep_quality_value,sleep_quality_unit,source_label").eq("user_id",user.id).gte("recorded_date",start).lte("recorded_date",end).order("recorded_date"),
      window.momentumDB.from("days").select("day_date,note,mood,energy,sleep_hours,stress,rest_hr,hrv").eq("user_id",user.id).gte("day_date",start).lte("day_date",end).order("day_date"),
      window.momentumDB.from("wellbeing_profile").select("resting_hr,preferred_sleep_hours").eq("user_id",user.id).maybeSingle(),
    ]);
    const firstError = activitiesResult.error || passportResult.error || dailyResult.error || daysResult.error || physiologicalResult.error;
    if (firstError) throw firstError;
    if (requestVersion !== progressionState.requestVersion) return;
    progressionState.historyActivities = activitiesResult.data || [];
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
    renderSportChart();
    renderLoadChart();
    renderWellnessChart();
  } catch (error) {
    if (requestVersion !== progressionState.requestVersion) return;
    console.error("PROGRESSION : impossible de charger les indicateurs.", error);
    if (message) message.innerHTML = 'Les indicateurs n’ont pas pu être chargés. <button type="button" data-progression-retry>Réessayer</button>';
    document.querySelectorAll(".progression-reveal").forEach((card) => card.classList.add("is-visible"));
  }
}

function completedActivities(activities = progressionState.activities) {
  return activities.filter((activity) => window.MomentumMoments?.isCompletedActivity(activity) ?? activity.status === "done");
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
  return mode === "distance" ? Number(activity.distance_km || 0) : Number(activity.duration_min || 0) / 60;
}

function renderProgressionKpis() {
  const strip = document.getElementById("kpiStrip");
  if (!strip) return;
  const completed = completedActivities();
  const hours = completed.reduce((sum, item) => sum + Number(item.duration_min || 0), 0) / 60;
  const distance = completed.reduce((sum, item) => sum + Number(item.distance_km || 0), 0);
  const activeWeeks = progressionState.weeks.filter((week) => completedActivities(week.activities).length).length;
  const periodLabel = PROGRESSION_PERIODS[progressionState.periodPreset]?.label || "Période";
  strip.innerHTML = `<div><strong>${completed.length}</strong><span>Séances réalisées · ${escapeHtml(periodLabel)}</span></div><div><strong>${hours.toFixed(1)} h</strong><span>Temps construit</span></div><div><strong>${distance.toFixed(0)} km</strong><span>Distance totale</span></div><div><strong>${activeWeeks}</strong><span>Semaines actives</span></div>`;
}

function passportBaselineLoad() {
  const hours = Number(progressionState.passport?.habits?.weekly_hours || 3);
  const levelFactor = ({ BEGINNER:.75, RETURNING:.7, REGULAR:1, COMPETITOR:1.2, EXPERT:1.35 })[progressionState.passport?.sport_level] || .85;
  return Math.max(12, Math.min(90, hours * 7 * levelFactor));
}

function activityTrainingLoad(activity) {
  const duration = Number(activity.duration_min || 0);
  const perceivedEffort = Number(activity.rpe || 5);
  return duration * Math.max(1, Math.min(10, perceivedEffort)) / 6;
}

function progressionGranularity(startValue = progressionState.periodStart, endValue = progressionState.periodEnd) {
  const dayCount = Math.floor((dateFromIso(endValue) - dateFromIso(startValue)) / 86400000) + 1;
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

function normalizeProgressionText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function buildProgressionEvents(activities, dayRows) {
  const events = new Map();
  const add = (date, label) => {
    if (!date || !label) return;
    if (!events.has(date)) events.set(date, []);
    if (!events.get(date).includes(label)) events.get(date).push(label);
  };
  activities.forEach((activity) => {
    const text = normalizeProgressionText(`${activity.activity_type} ${activity.sport} ${activity.notes}`);
    const activityLabel = window.MomentumSports?.getLabel(activity.sport, activity.activity_type || "Activité") || activity.activity_type || activity.sport || "Activité";
    if (activity.activity_category === "adventure") add(activity.activity_date, `Aventure · ${activityLabel}`);
    else if (/competition|race|epreuve|dossard/.test(text)) add(activity.activity_date, `Compétition · ${activityLabel}`);
    else if (/groupe|group|club|collectif/.test(text)) add(activity.activity_date, `Sortie de groupe · ${activityLabel}`);
    else if (/massage/.test(text)) add(activity.activity_date, `Massage · ${activityLabel}`);
  });
  dayRows.forEach((day) => {
    const note = normalizeProgressionText(day.note);
    if (/maladie|malade|fievre|infection/.test(note)) add(day.day_date, "Maladie");
    if (/vacances|vacance|conge/.test(note)) add(day.day_date, "Vacances");
  });
  return events;
}

function buildLoadSeries() {
  const days = [];
  const history = completedActivities(progressionState.historyActivities);
  const historyStart = history[0]?.activity_date || progressionState.periodStart;
  const calculationEnd = [progressionState.periodEnd, iso(new Date())].sort().at(-1);
  const start = dateFromIso(historyStart);
  const end = dateFromIso(calculationEnd);
  const dayCount = Math.floor((end - start) / 86400000) + 1;
  const firstActivity = history[0]?.activity_date || null;
  const baseline = passportBaselineLoad();
  const expectedActivities = Math.max(6, Number(progressionState.passport?.habits?.weekly_sessions || 3) * 6);
  const activitiesByDate = new Map();
  history.forEach((activity) => {
    if (!activitiesByDate.has(activity.activity_date)) activitiesByDate.set(activity.activity_date, []);
    activitiesByDate.get(activity.activity_date).push(activity);
  });
  let chronic = baseline;
  let acute = baseline;
  let observedActivities = 0;
  for (let index=0; index<dayCount; index+=1) {
    const date = iso(addDays(start,index));
    const activities = activitiesByDate.get(date) || [];
    const completed = completedActivities(activities);
    observedActivities += completed.length;
    const actualLoad = completed.reduce((sum,activity) => sum + activityTrainingLoad(activity),0);
    const learnedDays = firstActivity ? Math.max(0, Math.floor((dateFromIso(date)-dateFromIso(firstActivity))/86400000)+1) : 0;
    const confidence = Math.min(1, learnedDays / 42, observedActivities / expectedActivities);
    const modeledLoad = baseline * (1-confidence) + actualLoad * confidence;
    chronic += (modeledLoad-chronic) / 42;
    acute += (modeledLoad-acute) / 7;
    days.push({ date, activities:completed, actualLoad, modeledLoad, chronic, acute, form:chronic-acute, confidence });
  }
  progressionState.loadSeries = days;
  return days;
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
  const confidence = series.at(-1)?.confidence || 0;
  if (confidence === 0) return { label:"Estimation", detail:"Initialisée depuis ton Passeport" };
  if (confidence < 1) return { label:"Apprentissage", detail:`Modèle personnalisé à ${Math.round(confidence*100)} %` };
  return { label:"Personnalisation", detail:"Modèle entièrement fondé sur tes données" };
}

function loadInterpretation(current) {
  if (!current) return "Le modèle attend ses premières données.";
  if (current.form > 10) return "Bonne fraîcheur : ton corps semble disponible pour construire.";
  if (current.form < -15) return "Charge élevée : une respiration peut consolider le travail accompli.";
  if (current.acute > current.chronic * 1.15) return "La charge récente monte plus vite que ton socle habituel.";
  return "Progression maîtrisée : la charge récente reste proche de ton socle.";
}

function renderLoadChart() {
  const canvas = document.getElementById("fitnessChart");
  if (!canvas || !window.Chart) return;
  const hasCompleted = completedActivities().length > 0;
  setProgressionChartEmpty(canvas, !hasCompleted);
  if (!hasCompleted) {
    progressionState.loadChart?.destroy();
    document.getElementById("loadStatus").innerHTML = "";
    document.getElementById("loadInsight").textContent = "Tes premières activités feront apparaître ta progression ici.";
    requestAnimationFrame(()=>document.getElementById("loadChartCard")?.classList.add("is-visible"));
    return;
  }
  const series = buildLoadSeries();
  const displaySeries = loadDisplaySeries(series);
  const phase = loadPhase(series);
  const today = series.find((day) => day.date === iso(new Date())) || series.at(-1);
  const granularity = progressionGranularity();
  progressionState.loadDisplaySeries = displaySeries;
  progressionState.loadChart?.destroy();
  const eventLabels = displaySeries.map((day) => day.eventLabels || []);
  progressionState.loadChart = new Chart(canvas,{ type:"line", data:{ labels:displaySeries.map((day) => progressionDateLabel(day.date, granularity)), datasets:[{label:"Charge chronique (CTL)",data:displaySeries.map((day)=>day.chronic),borderColor:"#273c31",backgroundColor:"rgba(39,60,49,.08)",fill:true,tension:.35,pointRadius:displaySeries.length > 45 ? 0 : 2,borderWidth:2.5},{label:"Fatigue (ATL)",data:displaySeries.map((day)=>day.acute),borderColor:"#d9763d",backgroundColor:"transparent",tension:.35,pointRadius:displaySeries.length > 45 ? 0 : 2,borderWidth:2},{label:"Forme (TSB)",data:displaySeries.map((day)=>day.form),borderColor:"#6f63a6",backgroundColor:"transparent",tension:.3,pointRadius:displaySeries.length > 45 ? 0 : 2,borderWidth:2},{label:"Événements",data:displaySeries.map((day,index)=>eventLabels[index].length?Math.max(day.chronic,day.acute)+6:null),borderColor:"#b27d42",backgroundColor:"#b27d42",showLine:false,pointRadius:5,pointHoverRadius:7,pointStyle:"rectRot"}] }, options:{responsive:true,maintainAspectRatio:false,animation:{duration:850,easing:"easeOutQuart"},interaction:{mode:"index",intersect:false},onClick:(_event,elements)=>{if(elements[0])openLoadDay(elements[0].index);},plugins:{legend:{position:"bottom",align:"start",labels:{usePointStyle:true,pointStyle:"circle",boxWidth:8,padding:16}},tooltip:{callbacks:{label:(context)=>context.dataset.label==="Événements"?eventLabels[context.dataIndex].join(" • "):`${context.dataset.label} : ${Math.round(context.parsed.y)}`}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:8,color:"#858178",maxRotation:0}},y:{grid:{color:"rgba(20,20,20,.07)"},ticks:{color:"#858178"}}}} });
  document.getElementById("loadModelPhase").textContent=phase.label;
  document.getElementById("loadModelPhase").title=phase.detail;
  document.getElementById("loadStatus").innerHTML=`<p>Aujourd’hui</p><div><strong>${Math.round(today?.chronic||0)}</strong><span>Charge chronique</span></div><div><strong>${Math.round(today?.acute||0)}</strong><span>Fatigue</span></div><div><strong>${today?.form>=0?"+":""}${Math.round(today?.form||0)}</strong><span>Forme</span></div>`;
  document.getElementById("loadInsight").textContent=loadInterpretation(today);
  requestAnimationFrame(()=>document.getElementById("loadChartCard")?.classList.add("is-visible"));
}

function openLoadDay(index) {
  const day=progressionState.loadDisplaySeries[index];
  const content=document.getElementById("progressionDialogContent");
  const dialog=document.getElementById("progressionDialog");
  if(!day||!content||!dialog)return;
  const events=day.eventLabels||[];
  const periodLabel=day.rangeStart!==day.date?`${fmtDate(day.rangeStart)} — ${fmtDate(day.date)}`:fmtDate(day.date);
  content.innerHTML=`<span class="section-kicker">${escapeHtml(periodLabel)}</span><h2>Charge ${Math.round(day.actualLoad)}</h2><div class="progression-detail-kpis"><div><strong>${Math.round(day.chronic)}</strong><span>CTL</span></div><div><strong>${Math.round(day.acute)}</strong><span>ATL</span></div><div><strong>${day.form>=0?"+":""}${Math.round(day.form)}</strong><span>Forme (TSB)</span></div></div>${events.length?`<p class="load-day-events">${events.map(escapeHtml).join(" • ")}</p>`:""}<div class="load-day-activities">${day.activities.length?day.activities.map((activity)=>`<article><strong>${escapeHtml(window.MomentumSports?.getLabel(activity.sport,activity.activity_type||"Activité")||"Activité")}</strong><span>${Math.round(activityTrainingLoad(activity))} de charge · ${escapeHtml(window.MomentumDuration?.format(activity.duration_min||0) || `${Math.round(activity.duration_min||0)} min`)} · effort physique ${activity.rpe||"non renseigné"} / 10</span></article>`).join(""):'<p>Aucune activité enregistrée sur cette période.</p>'}</div>`;
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
  if (!hasCompleted) { progressionState.sportChart?.destroy(); if(summary)summary.textContent=progressionState.mode==="distance"?"Aucune activité avec distance sur cette période.":"Tes premières activités feront apparaître ta progression ici."; document.getElementById("sportInsight").textContent=""; requestAnimationFrame(()=>document.getElementById("sportChartCard")?.classList.add("is-visible")); return; }
  canvas.parentElement.style.height=`${Math.max(300,groups.length*48)}px`;
  progressionState.sportChart?.destroy();
  progressionState.sportChart=new Chart(canvas,{type:"bar",data:{labels:groups.map((group)=>group.label),datasets:[{label:progressionState.mode==="distance"?"Distance":"Temps",data:groups.map((group)=>group[valueKey]),backgroundColor:groups.map((group)=>group.color),borderRadius:8,borderSkipped:false,barThickness:22}]},options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,animation:{duration:850,easing:"easeOutQuart"},onClick:(_event,elements)=>{if(elements[0])openSportDetail(elements[0].index);},plugins:{legend:{display:false},tooltip:{callbacks:{label:(context)=>`${context.dataset.label} : ${context.parsed.x.toLocaleString("fr-CH",{maximumFractionDigits:1})} ${unit}`}}},scales:{x:{beginAtZero:true,grid:{color:"rgba(20,20,20,.07)"},ticks:{color:"#858178",callback:(value)=>`${value} ${unit}`}},y:{grid:{display:false},ticks:{color:"#2f2f2f",font:{weight:"700"}}}}}});
  const total=groups.reduce((sum,group)=>sum+group[valueKey],0);
  const dominant=groups[0];
  const formattedTotal=total.toLocaleString("fr-CH",{maximumFractionDigits:1});
  if(summary)summary.innerHTML=progressionState.mode==="distance"?`<strong>${formattedTotal} km parcourus</strong><span> • ${groups.length} discipline${groups.length>1?"s":""} pratiquée${groups.length>1?"s":""}</span>`:`<strong>${formattedTotal} h d’activités</strong><span> • ${groups.length} discipline${groups.length>1?"s":""} pratiquée${groups.length>1?"s":""}</span>`;
  document.getElementById("sportInsight").textContent=dominant?`${dominant.label} représente ${Math.round(dominant[valueKey]/Math.max(total,.01)*100)} % ${progressionState.mode==="distance"?"de la distance":"du temps"} sur cette période.`:"";
  requestAnimationFrame(()=>document.getElementById("sportChartCard")?.classList.add("is-visible"));
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
  content.innerHTML=`<span class="section-kicker">Discipline</span><h2>${escapeHtml(group.label)}</h2><div class="progression-detail-kpis"><div><strong>${group.hours.toFixed(1)} h</strong><span>Temps réalisé</span></div><div><strong>${group.distance.toFixed(1)} km</strong><span>Distance</span></div><div><strong>${completed.length}</strong><span>Séances réalisées</span></div></div><section class="sport-detail-section"><h3>Sous-disciplines</h3><div class="sport-breakdown">${[...subdisciplines.entries()].sort((a,b)=>b[1].hours-a[1].hours).map(([label,data])=>`<div><span>${escapeHtml(label)}</span><strong>${data.hours.toFixed(1)} h · ${data.distance.toFixed(1)} km · ${data.sessions} séance${data.sessions>1?"s":""}</strong></div>`).join("")}</div></section><button class="secondary intensity-toggle" id="showIntensity" type="button">Afficher la répartition par intensité</button><section class="sport-detail-section" id="intensityDetail" hidden><h3>Répartition par intensité</h3><div class="intensity-breakdown">${[...intensities.entries()].map(([label,hours])=>`<div><span>${escapeHtml(label)}</span><i><b style="width:${Math.round(hours/Math.max(group.hours,.01)*100)}%"></b></i><strong>${hours.toFixed(1)} h</strong></div>`).join("")}</div></section>`;
  document.getElementById("showIntensity")?.addEventListener("click",(event)=>{const detail=document.getElementById("intensityDetail");detail.hidden=!detail.hidden;event.currentTarget.textContent=detail.hidden?"Afficher la répartition par intensité":"Masquer la répartition par intensité";});
  openHomeDialog(dialog);
}

function normalizeSubjective(value) {
  const number=Number(value);
  if(!Number.isFinite(number))return null;
  return Math.max(0,Math.min(100,number<=10?number*10:number));
}

function subjectiveValueOutOfTen(value) {
  const number=Number(value);
  if(!Number.isFinite(number))return null;
  return Math.max(0,Math.min(10,number>10?number/10:number));
}

function physiologicalValue(value) {
  const number=Number(value);
  return Number.isFinite(number)&&number>=0?number:null;
}

function mergeWellbeingDays(dailyRows, legacyRows, start, end) {
  const dailyMap=new Map(dailyRows.map((row)=>[row.recorded_date,row]));
  const legacyMap=new Map(legacyRows.map((row)=>[row.day_date,row]));
  const sleepTarget=Number(progressionState.physiological?.preferred_sleep_hours||8);
  const dayCount=Math.floor((dateFromIso(end)-dateFromIso(start))/86400000)+1;
  return Array.from({length:dayCount},(_,index)=>{
    const date=iso(addDays(dateFromIso(start),index));
    const daily=dailyMap.get(date)||{};const legacy=legacyMap.get(date)||{};
    const sleepHours=daily.sleep_hours??legacy.sleep_hours??null;
    const normalizedSleepHours=physiologicalValue(sleepHours);
    const sleepScore=normalizedSleepHours==null?null:Math.max(0,Math.min(100,normalizedSleepHours/sleepTarget*100));
    const motivationSource=daily.motivation??legacy.energy??null;
    const motivation=subjectiveValueOutOfTen(motivationSource);
    const motivationScore=normalizeSubjective(motivationSource);
    const recovery=sleepQualityLevel(daily.sleep_quality_value,daily.sleep_quality_unit);
    const recoveryScore=sleepQualityScore(daily.sleep_quality_value,daily.sleep_quality_unit);
    const available=[sleepScore,motivationScore,recoveryScore].filter((value)=>value!=null);
    return {date,sleepHours:normalizedSleepHours,sleepTarget,motivation,recovery,summary:available.length?available.reduce((sum,value)=>sum+value,0)/available.length:null,restingHr:physiologicalValue(daily.resting_hr??legacy.rest_hr),hrv:physiologicalValue(daily.hrv_ms??legacy.hrv),note:legacy.note||null,source:daily.source_label||null};
  });
}

function wellnessDefinition(mode) {
  return ({
    summary:{label:"Bien-être",dataKey:"summary",color:"#273c31",scale:{min:0,max:100}},
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
    return {...bucket.at(-1),[dataKey]:values.length?values.reduce((sum,value)=>sum+Number(value),0)/values.length:null};
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
  setProgressionChartEmpty(canvas, availableCount === 0, "Aucune donnée ne correspond à cette période.", "Le bien-être apparaîtra après une saisie ou une source connectée.");
  if (availableCount === 0) { progressionState.wellnessChart?.destroy(); document.getElementById("wellnessInsight").textContent=""; requestAnimationFrame(()=>document.getElementById("wellnessChartCard")?.classList.add("is-visible")); return; }
  progressionState.wellnessChart?.destroy();
  progressionState.wellnessChart=new Chart(canvas,{type:"line",data:{labels:days.map((day)=>progressionDateLabel(day.date,granularity)),datasets:[{label:definition.label,data:days.map((day)=>day[definition.dataKey]),borderColor:definition.color,backgroundColor:`${definition.color}18`,fill:true,tension:.35,pointRadius:days.length>45?0:2,pointHoverRadius:5,spanGaps:true,borderWidth:2.5}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:850,easing:"easeOutQuart"},interaction:{mode:"index",intersect:false},onClick:(_event,elements)=>{if(elements[0])openWellnessDay(elements[0].index);},plugins:{legend:{display:false},tooltip:{callbacks:{label:(context)=>`${definition.label} : ${wellnessChartValue(progressionState.wellnessMode,context.parsed.y)}`}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:8,maxRotation:0,color:"#858178"}},y:{...definition.scale,grid:{color:"rgba(20,20,20,.07)"},ticks:{color:"#858178",stepSize:definition.stepSize,callback:(value)=>wellnessAxisValue(progressionState.wellnessMode,value)}}}}});
  if(availableCount<5){progressionState.wellnessChart.data.datasets[0].pointRadius=4;progressionState.wellnessChart.update("none");}
  const recent=[...days].reverse().find((day)=>day[definition.dataKey]!=null);
  const insight=document.getElementById("wellnessInsight");
  insight.textContent=recent?`${definition.label} : ${wellnessChartValue(progressionState.wellnessMode,recent[definition.dataKey])} lors de la dernière journée renseignée.`:"Aucune donnée disponible pour cet indicateur. MOMENTUM attend une saisie ou une source connectée.";
  requestAnimationFrame(()=>document.getElementById("wellnessChartCard")?.classList.add("is-visible"));
}

function wellnessValue(value,suffix=" / 100") { return value==null?"Non renseigné":`${Math.round(value)}${suffix}`; }

function openWellnessDay(index) {
  const day=progressionState.wellbeingDisplayDays[index];
  const load=progressionState.loadSeries.find((item)=>item.date===day.date);
  const content=document.getElementById("progressionDialogContent");const dialog=document.getElementById("progressionDialog");
  if(!day||!content||!dialog)return;
  content.innerHTML=`<span class="section-kicker">${escapeHtml(fmtDate(day.date))}</span><h2>${wellnessValue(day.summary)}</h2><div class="wellness-detail-grid"><div><span>Sommeil</span><strong>${day.sleepHours==null?"Non renseigné":escapeHtml(formatSleepDuration(day.sleepHours))}</strong><small>${day.sleepHours==null?"Durée non renseignée":`Objectif ${escapeHtml(formatSleepDuration(day.sleepTarget))}`}</small></div><div><span>Motivation au réveil</span><strong>${day.motivation==null?"Non renseignée":`${day.motivation.toLocaleString("fr-CH",{maximumFractionDigits:1})} / 10`}</strong></div><div><span>Qualité du sommeil</span><strong>${day.recovery==null?"Non renseignée":escapeHtml(sleepQualityLabel(day.recovery,"qualitative-v1"))}</strong></div></div><div class="progression-detail-kpis"><div><strong>${Math.round(load?.actualLoad||0)}</strong><span>Charge sportive</span></div><div><strong>${day.restingHr==null?"—":`${Math.round(day.restingHr)} bpm`}</strong><span>FC repos</span></div><div><strong>${day.hrv==null?"—":`${Math.round(day.hrv)} ms`}</strong><span>VFC</span></div></div><section class="wellness-note-detail"><span class="card-label">Note utilisateur</span><p>${escapeHtml(day.note||"Aucune note pour cette journée.")}</p>${day.source?`<small>Source : ${escapeHtml(day.source)}</small>`:""}</section>`;
  openHomeDialog(dialog);
}

async function applyProgressionPeriod(preset, customStart = null, customEnd = null) {
  const message = document.querySelector("[data-period-message]");
  const range = progressionPeriodRange(preset, customStart, customEnd);
  if (!range.start || !range.end || range.start > range.end) {
    if (message) message.textContent = "Choisis une date de début antérieure à la date de fin.";
    return;
  }

  progressionState.periodPreset = preset;
  progressionState.periodStart = range.start;
  progressionState.periodEnd = range.end;
  if (message) message.textContent = "";
  await loadProgressionData();
}

function bindProgression() {
  document.addEventListener("click", async (event) => {
    if (event.target.closest("[data-progression-retry]")) await loadProgressionData();
    if (event.target.closest("[data-progression-reset]")) {
      const preset = document.querySelector("[data-period-preset]");
      if (preset) preset.value = "current-week";
      const custom = document.querySelector("[data-period-custom]");
      if (custom) custom.hidden = true;
      await applyProgressionPeriod("current-week");
    }
  });
  document.querySelectorAll("[data-volume-mode]").forEach((button) => button.addEventListener("click", () => { progressionState.mode=button.dataset.volumeMode; document.querySelectorAll("[data-volume-mode]").forEach((item)=>item.classList.toggle("active",item===button)); renderSportChart(); }));
  document.querySelectorAll("[data-wellness-mode]").forEach((button) => button.addEventListener("click",()=>{progressionState.wellnessMode=button.dataset.wellnessMode;document.querySelectorAll("[data-wellness-mode]").forEach((item)=>item.classList.toggle("active",item===button));renderWellnessChart();}));
  const preset = document.querySelector("[data-period-preset]");
  const custom = document.querySelector("[data-period-custom]");
  const customStart = document.querySelector("[data-period-start]");
  const customEnd = document.querySelector("[data-period-end]");

  preset?.addEventListener("change", async () => {
    const isCustom = preset.value === "custom";
    if (custom) custom.hidden = !isCustom;
    if (!isCustom) await applyProgressionPeriod(preset.value);
  });

  document.querySelector("[data-period-apply]")?.addEventListener("click", async () => {
    await applyProgressionPeriod("custom", customStart?.value, customEnd?.value);
  });

  const initialRange = progressionPeriodRange("current-week");
  if (customStart) customStart.value = initialRange.start;
  if (customEnd) customEnd.value = initialRange.end;

  document.getElementById("closeProgressionDialog")?.addEventListener("click", () => closeHomeDialog(document.getElementById("progressionDialog")));
}

document.addEventListener("DOMContentLoaded", () => {
  bindProgression();
  loadProgressionData();
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await window.momentumDB.auth.signOut();
    window.location.href = "login.html";
  });
});
