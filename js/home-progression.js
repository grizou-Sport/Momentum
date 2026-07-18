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
  activities:[], weeks:[], chart:null, loadChart:null, sportChart:null,
  wellnessChart:null, mode:"time", wellnessMode:"summary", passport:null,
  physiological:null, loadSeries:[], sportGroups:[], wellbeingDays:[],
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
    const [activitiesResult, passportResult, dailyResult, daysResult, physiologicalResult] = await Promise.all([
      window.momentumDB.from("activities").select("id,sport,activity_type,activity_category,activity_date,duration_min,distance_km,elevation_m,rpe,avg_hr,status").eq("user_id", user.id).in("status", ["done", "planned"]).gte("activity_date", start).lte("activity_date", end).order("activity_date"),
      window.momentumDB.from("passports").select("sport_level,habits,personalization").eq("user_id", user.id).maybeSingle(),
      window.momentumDB.from("daily_wellbeing").select("recorded_date,sleep_hours,motivation,resting_hr,hrv_ms,sleep_quality_value,sleep_quality_unit,source_label").eq("user_id",user.id).gte("recorded_date",start).lte("recorded_date",end).order("recorded_date"),
      window.momentumDB.from("days").select("day_date,note,mood,energy,sleep_hours,stress,rest_hr,hrv").eq("user_id",user.id).gte("day_date",start).lte("day_date",end).order("day_date"),
      window.momentumDB.from("wellbeing_profile").select("resting_hr,preferred_sleep_hours").eq("user_id",user.id).maybeSingle(),
    ]);
    const firstError = activitiesResult.error || passportResult.error || dailyResult.error || daysResult.error || physiologicalResult.error;
    if (firstError) throw firstError;
    if (requestVersion !== progressionState.requestVersion) return;
    progressionState.activities = activitiesResult.data || [];
    progressionState.passport = passportResult.data || null;
    progressionState.physiological = physiologicalResult.data || null;
    progressionState.wellbeingDays = mergeWellbeingDays(dailyResult.data || [], daysResult.data || [], start, end);
    progressionState.weeks = progressionWeeks(start, end);
    progressionState.activities.forEach((activity) => {
      const week = progressionState.weeks.find((item) => item.id === progressionWeekStart(activity.activity_date));
      if (week) week.activities.push(activity);
    });
    if (message) message.textContent = "";
    renderProgressionKpis();
    renderVolumeChart();
    renderLoadChart();
    renderSportChart();
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

function plannedActivities(activities = progressionState.activities) {
  return activities.filter((activity) => activity.status === "planned");
}

function colorWithAlpha(color, alphaHex = "55") {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alphaHex}` : color;
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

function progressionGroups() {
  const groups = new Map();
  progressionState.activities.forEach((activity) => {
    const group = window.MomentumSportVisuals.getGroup(activity.sport, activity.activity_category);
    if (!groups.has(group.id)) groups.set(group.id, group);
  });
  return [...groups.values()];
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

function renderVolumeChart() {
  const canvas = document.getElementById("volumeChart");
  if (!canvas || !window.Chart) return;
  progressionState.chart?.destroy();
  const hasCompleted = completedActivities().length > 0;
  setProgressionChartEmpty(canvas, !hasCompleted);
  if (!hasCompleted) { renderVolumeInsight(); requestAnimationFrame(() => document.getElementById("volumeChartCard")?.classList.add("is-visible")); return; }
  const groups = progressionGroups();
  const datasets = groups.flatMap((group) => [
    { label:group.label, stack:"volume", backgroundColor:group.color, borderRadius:5, borderSkipped:false, data:progressionState.weeks.map((week) => completedActivities(week.activities).filter((activity) => window.MomentumSportVisuals.getGroup(activity.sport, activity.activity_category).id === group.id).reduce((sum, activity) => sum + activityValue(activity, progressionState.mode), 0)) },
    { label:`${group.label} · Prévu`, stack:"volume", backgroundColor:colorWithAlpha(group.color), borderColor:group.color, borderWidth:1, borderRadius:5, borderSkipped:false, data:progressionState.weeks.map((week) => plannedActivities(week.activities).filter((activity) => window.MomentumSportVisuals.getGroup(activity.sport, activity.activity_category).id === group.id).reduce((sum, activity) => sum + activityValue(activity, progressionState.mode), 0)) }
  ]);
  progressionState.chart = new Chart(canvas, {
    type:"bar",
    data:{ labels:progressionState.weeks.map((week) => week.label), datasets },
    options:{ responsive:true, maintainAspectRatio:false, animation:{ duration:850, easing:"easeOutQuart" }, interaction:{ mode:"nearest", intersect:true }, onClick:(_event, elements) => { if (elements[0]) openProgressionWeek(elements[0].index, elements[0].datasetIndex); }, plugins:{ legend:{ position:"bottom", align:"start", labels:{ usePointStyle:true, pointStyle:"circle", boxWidth:8, color:"#666", padding:16, filter:(item, data) => data.datasets[item.datasetIndex].data.some((value) => Number(value) > 0) } }, tooltip:{ callbacks:{ label:(context) => `${context.dataset.label} : ${context.parsed.y.toFixed(1)} ${progressionState.mode === "time" ? "h" : "km"}` } } }, scales:{ x:{ stacked:true, grid:{ display:false }, ticks:{ color:"#858178", maxRotation:0, autoSkip:true } }, y:{ stacked:true, beginAtZero:true, grid:{ color:"rgba(20,20,20,.07)" }, ticks:{ color:"#858178", callback:(value) => `${value} ${progressionState.mode === "time" ? "h" : "km"}` } } } }
  });
  renderVolumeInsight();
  requestAnimationFrame(() => document.getElementById("volumeChartCard")?.classList.add("is-visible"));
}

function renderVolumeInsight() {
  const element = document.getElementById("volumeInsight");
  if (!element) return;
  const recent = completedActivities(progressionState.weeks.at(-1)?.activities || []);
  if (!recent.length) { element.textContent = "Aucune activité réalisée cette semaine."; return; }
  const totals = new Map();
  recent.forEach((activity) => { const group = window.MomentumSportVisuals.getGroup(activity.sport, activity.activity_category); totals.set(group.label, (totals.get(group.label) || 0) + activityValue(activity, "time")); });
  const dominant = [...totals.entries()].sort((a,b) => b[1] - a[1])[0]?.[0];
  const hours = recent.reduce((sum, activity) => sum + activityValue(activity, "time"), 0);
  element.textContent = `Une semaine de ${hours.toFixed(1)} h, portée par ${dominant || "la régularité"}.`;
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

function buildLoadSeries() {
  const days = [];
  const start = dateFromIso(progressionState.periodStart);
  const end = dateFromIso(progressionState.periodEnd);
  const dayCount = Math.floor((end - start) / 86400000) + 1;
  const firstActivity = completedActivities().find((activity) => activity.activity_date)?.activity_date || null;
  const baseline = passportBaselineLoad();
  const expectedActivities = Math.max(6, Number(progressionState.passport?.habits?.weekly_sessions || 3) * 6);
  let chronic = baseline;
  let acute = baseline;
  let observedActivities = 0;
  for (let index=0; index<dayCount; index+=1) {
    const date = iso(addDays(start,index));
    const activities = progressionState.activities.filter((activity) => activity.activity_date === date);
    const completed = completedActivities(activities);
    const planned = plannedActivities(activities);
    observedActivities += completed.length;
    const actualLoad = completed.reduce((sum,activity) => sum + activityTrainingLoad(activity),0);
    const plannedLoad = planned.reduce((sum,activity) => sum + activityTrainingLoad(activity),0);
    const learnedDays = firstActivity ? Math.max(0, Math.floor((dateFromIso(date)-dateFromIso(firstActivity))/86400000)+1) : 0;
    const confidence = Math.min(1, learnedDays / 42, observedActivities / expectedActivities);
    const modeledLoad = baseline * (1-confidence) + actualLoad * confidence;
    chronic += (modeledLoad-chronic) / 42;
    acute += (modeledLoad-acute) / 7;
    days.push({ date, activities, actualLoad, plannedLoad, modeledLoad, chronic, acute, form:chronic-acute, confidence });
  }
  progressionState.loadSeries = days;
  return days;
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
  const phase = loadPhase(series);
  const current = series.at(-1);
  progressionState.loadChart?.destroy();
  progressionState.loadChart = new Chart(canvas,{ type:"line", data:{ labels:series.map((day) => new Intl.DateTimeFormat("fr-CH",{day:"numeric",month:"short"}).format(dateFromIso(day.date))), datasets:[{label:"Charge chronique",data:series.map((day)=>day.chronic),borderColor:"#273c31",backgroundColor:"rgba(39,60,49,.08)",fill:true,tension:.35,pointRadius:0,borderWidth:2.5},{label:"Charge aiguë",data:series.map((day)=>day.acute),borderColor:"#d9763d",backgroundColor:"transparent",tension:.35,pointRadius:0,borderWidth:2},{type:"bar",label:"Charge prévue",data:series.map((day)=>day.plannedLoad),backgroundColor:"rgba(217,118,61,.24)",borderColor:"rgba(217,118,61,.55)",borderWidth:1,borderRadius:4}] }, options:{responsive:true,maintainAspectRatio:false,animation:{duration:850,easing:"easeOutQuart"},interaction:{mode:"index",intersect:false},onClick:(_event,elements)=>{if(elements[0])openLoadDay(elements[0].index);},plugins:{legend:{position:"bottom",align:"start",labels:{usePointStyle:true,pointStyle:"circle",boxWidth:8,padding:16}},tooltip:{callbacks:{label:(context)=>`${context.dataset.label} : ${Math.round(context.parsed.y)}`}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:8,color:"#858178",maxRotation:0}},y:{beginAtZero:true,grid:{color:"rgba(20,20,20,.07)"},ticks:{color:"#858178"}}}} });
  document.getElementById("loadModelPhase").textContent=phase.label;
  document.getElementById("loadModelPhase").title=phase.detail;
  document.getElementById("loadStatus").innerHTML=`<div><strong>${Math.round(current?.chronic||0)}</strong><span>Charge</span></div><div><strong>${current?.form>=0?"+":""}${Math.round(current?.form||0)}</strong><span>Forme</span></div><div><strong>${Math.round((current?.confidence||0)*100)} %</strong><span>Confiance</span></div>`;
  document.getElementById("loadInsight").textContent=loadInterpretation(current);
  requestAnimationFrame(()=>document.getElementById("loadChartCard")?.classList.add("is-visible"));
}

function openLoadDay(index) {
  const day=progressionState.loadSeries[index];
  const content=document.getElementById("progressionDialogContent");
  const dialog=document.getElementById("progressionDialog");
  if(!day||!content||!dialog)return;
  content.innerHTML=`<span class="section-kicker">${escapeHtml(fmtDate(day.date))}</span><h2>Charge ${Math.round(day.actualLoad)}</h2><div class="progression-detail-kpis"><div><strong>${Math.round(day.chronic)}</strong><span>Chronique</span></div><div><strong>${Math.round(day.acute)}</strong><span>Aiguë</span></div><div><strong>${day.form>=0?"+":""}${Math.round(day.form)}</strong><span>Forme</span></div></div><div class="load-day-activities">${day.activities.length?day.activities.map((activity)=>`<article><strong>${escapeHtml(window.MomentumSports?.getLabel(activity.sport,activity.activity_type||"Activité")||"Activité")}</strong><span>${Math.round(activityTrainingLoad(activity))} de charge · ${escapeHtml(window.MomentumDuration?.format(activity.duration_min||0) || `${Math.round(activity.duration_min||0)} min`)} · effort physique ${activity.rpe||"estimé à 5"} / 10</span></article>`).join(""):'<p>Aucune activité enregistrée ce jour-là. Le modèle utilise encore la part estimée du Passeport.</p>'}</div>`;
  openHomeDialog(dialog);
}

function buildSportDistribution() {
  const groups = new Map();
  progressionState.activities.forEach((activity) => {
    const visual = window.MomentumSportVisuals.getGroup(activity.sport, activity.activity_category);
    if (!groups.has(visual.id)) groups.set(visual.id, { ...visual, activities:[], hours:0, plannedHours:0, distance:0 });
    const group = groups.get(visual.id);
    group.activities.push(activity);
    if (activity.status === "planned") {
      group.plannedHours += activityValue(activity,"time");
    } else if (completedActivities([activity]).length) {
      group.hours += activityValue(activity,"time");
      group.distance += activityValue(activity,"distance");
    }
  });
  progressionState.sportGroups = [...groups.values()].sort((a,b) => b.hours-a.hours);
  return progressionState.sportGroups;
}

function renderSportChart() {
  const canvas=document.getElementById("sportChart");
  if(!canvas||!window.Chart)return;
  const groups=buildSportDistribution();
  const hasCompleted = groups.some((group) => group.hours > 0);
  setProgressionChartEmpty(canvas, !hasCompleted);
  if (!hasCompleted) { progressionState.sportChart?.destroy(); document.getElementById("sportInsight").textContent="Tes premières activités feront apparaître ta progression ici."; requestAnimationFrame(()=>document.getElementById("sportChartCard")?.classList.add("is-visible")); return; }
  canvas.parentElement.style.height=`${Math.max(300,groups.length*48)}px`;
  progressionState.sportChart?.destroy();
  progressionState.sportChart=new Chart(canvas,{type:"bar",data:{labels:groups.map((group)=>group.label),datasets:[{label:"Réalisé",stack:"time",data:groups.map((group)=>group.hours),backgroundColor:groups.map((group)=>group.color),borderRadius:8,borderSkipped:false,barThickness:22},{label:"Prévu",stack:"time",data:groups.map((group)=>group.plannedHours),backgroundColor:groups.map((group)=>colorWithAlpha(group.color)),borderColor:groups.map((group)=>group.color),borderWidth:1,borderRadius:8,borderSkipped:false,barThickness:22}]},options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,animation:{duration:850,easing:"easeOutQuart"},onClick:(_event,elements)=>{if(elements[0])openSportDetail(elements[0].index);},plugins:{legend:{position:"bottom",align:"start",labels:{usePointStyle:true,pointStyle:"circle",boxWidth:8,padding:16}},tooltip:{callbacks:{label:(context)=>`${context.dataset.label} : ${context.parsed.x.toFixed(1)} h`}}},scales:{x:{stacked:true,beginAtZero:true,grid:{color:"rgba(20,20,20,.07)"},ticks:{color:"#858178",callback:(value)=>`${value} h`}},y:{stacked:true,grid:{display:false},ticks:{color:"#2f2f2f",font:{weight:"700"}}}}}});
  const total=groups.reduce((sum,group)=>sum+group.hours,0);
  const dominant=groups[0];
  const periodLabel=document.getElementById("sportPeriodLabel");
  if(periodLabel)periodLabel.textContent=PROGRESSION_PERIODS[progressionState.periodPreset]?.label||"Période";
  document.getElementById("sportInsight").textContent=dominant?`${dominant.label} représente ${Math.round(dominant.hours/Math.max(total,.01)*100)} % de ton temps d'entraînement sur cette période.`:"Les disciplines apparaîtront après tes premières activités.";
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
  const planned=plannedActivities(group.activities);
  completed.forEach((activity)=>{
    const label=window.MomentumSports?.getLabel(activity.sport,activity.activity_type||group.label)||group.label;
    if(!subdisciplines.has(label))subdisciplines.set(label,{hours:0,distance:0,sessions:0});
    const sub=subdisciplines.get(label);sub.hours+=activityValue(activity,"time");sub.distance+=activityValue(activity,"distance");sub.sessions+=1;
    const intensity=intensityLabel(activity.rpe);intensities.set(intensity,(intensities.get(intensity)||0)+activityValue(activity,"time"));
  });
  content.innerHTML=`<span class="section-kicker">Discipline</span><h2>${escapeHtml(group.label)}</h2><div class="progression-detail-kpis"><div><strong>${group.hours.toFixed(1)} h</strong><span>Temps réalisé</span></div><div><strong>${group.distance.toFixed(1)} km</strong><span>Distance</span></div><div><strong>${completed.length}</strong><span>Séances réalisées</span></div></div>${planned.length?`<p class="planned-detail">${planned.length} séance${planned.length>1?"s":""} prévue${planned.length>1?"s":""} · ${group.plannedHours.toFixed(1)} h</p>`:""}<section class="sport-detail-section"><h3>Sous-disciplines</h3><div class="sport-breakdown">${[...subdisciplines.entries()].sort((a,b)=>b[1].hours-a[1].hours).map(([label,data])=>`<div><span>${escapeHtml(label)}</span><strong>${data.hours.toFixed(1)} h · ${data.distance.toFixed(1)} km · ${data.sessions} séance${data.sessions>1?"s":""}</strong></div>`).join("")}</div></section><button class="secondary intensity-toggle" id="showIntensity" type="button">Afficher la répartition par intensité</button><section class="sport-detail-section" id="intensityDetail" hidden><h3>Répartition par intensité</h3><div class="intensity-breakdown">${[...intensities.entries()].map(([label,hours])=>`<div><span>${escapeHtml(label)}</span><i><b style="width:${Math.round(hours/Math.max(group.hours,.01)*100)}%"></b></i><strong>${hours.toFixed(1)} h</strong></div>`).join("")}</div></section>`;
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
    summary:{label:"Synthèse",dataKey:"summary",color:"#273c31",scale:{min:0,max:100}},
    sleep:{label:"Sommeil",dataKey:"sleepHours",color:"#5d7894",scale:{beginAtZero:true,suggestedMax:12}},
    motivation:{label:"Motivation",dataKey:"motivation",color:"#d49a3a",scale:{min:0,max:10}},
    recovery:{label:"Qualité du sommeil",dataKey:"recovery",color:"#66845b",scale:{min:1,max:5},stepSize:1},
    restingHr:{label:"FC au repos",dataKey:"restingHr",color:"#d4655c",scale:{suggestedMin:30,suggestedMax:100}},
    hrv:{label:"Variabilité de la FC",dataKey:"hrv",color:"#6f63a6",scale:{beginAtZero:true,suggestedMax:120}}
  })[mode];
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
  const days=progressionState.wellbeingDays;
  const availableCount=days.filter((day)=>day[definition.dataKey]!=null).length;
  setProgressionChartEmpty(canvas, availableCount === 0, "Aucune donnée ne correspond à cette période.", "Le bien-être apparaîtra après une saisie ou une source connectée.");
  if (availableCount === 0) { progressionState.wellnessChart?.destroy(); document.getElementById("wellnessInsight").textContent=""; requestAnimationFrame(()=>document.getElementById("wellnessChartCard")?.classList.add("is-visible")); return; }
  progressionState.wellnessChart?.destroy();
  progressionState.wellnessChart=new Chart(canvas,{type:"line",data:{labels:days.map((day)=>new Intl.DateTimeFormat("fr-CH",{day:"numeric",month:"short"}).format(dateFromIso(day.date))),datasets:[{label:definition.label,data:days.map((day)=>day[definition.dataKey]),borderColor:definition.color,backgroundColor:`${definition.color}18`,fill:true,tension:.35,pointRadius:days.length>45?0:2,pointHoverRadius:5,spanGaps:true,borderWidth:2.5}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:850,easing:"easeOutQuart"},interaction:{mode:"index",intersect:false},onClick:(_event,elements)=>{if(elements[0])openWellnessDay(elements[0].index);},plugins:{legend:{display:false},tooltip:{callbacks:{label:(context)=>`${definition.label} : ${wellnessChartValue(progressionState.wellnessMode,context.parsed.y)}`}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:8,maxRotation:0,color:"#858178"}},y:{...definition.scale,grid:{color:"rgba(20,20,20,.07)"},ticks:{color:"#858178",stepSize:definition.stepSize,callback:(value)=>wellnessAxisValue(progressionState.wellnessMode,value)}}}}});
  if(availableCount<5){progressionState.wellnessChart.data.datasets[0].pointRadius=4;progressionState.wellnessChart.update("none");}
  const recent=[...days].reverse().find((day)=>day[definition.dataKey]!=null);
  const insight=document.getElementById("wellnessInsight");
  insight.textContent=recent?`${definition.label} : ${wellnessChartValue(progressionState.wellnessMode,recent[definition.dataKey])} lors de la dernière journée renseignée.`:"Aucune donnée disponible pour cet indicateur. MOMENTUM attend une saisie ou une source connectée.";
  requestAnimationFrame(()=>document.getElementById("wellnessChartCard")?.classList.add("is-visible"));
}

function wellnessValue(value,suffix=" / 100") { return value==null?"Non renseigné":`${Math.round(value)}${suffix}`; }

function openWellnessDay(index) {
  const day=progressionState.wellbeingDays[index];
  const load=progressionState.loadSeries.find((item)=>item.date===day.date);
  const content=document.getElementById("progressionDialogContent");const dialog=document.getElementById("progressionDialog");
  if(!day||!content||!dialog)return;
  content.innerHTML=`<span class="section-kicker">${escapeHtml(fmtDate(day.date))}</span><h2>${wellnessValue(day.summary)}</h2><div class="wellness-detail-grid"><div><span>Sommeil</span><strong>${day.sleepHours==null?"Non renseigné":escapeHtml(formatSleepDuration(day.sleepHours))}</strong><small>${day.sleepHours==null?"Durée non renseignée":`Objectif ${escapeHtml(formatSleepDuration(day.sleepTarget))}`}</small></div><div><span>Motivation au réveil</span><strong>${day.motivation==null?"Non renseignée":`${day.motivation.toLocaleString("fr-CH",{maximumFractionDigits:1})} / 10`}</strong></div><div><span>Qualité du sommeil</span><strong>${day.recovery==null?"Non renseignée":escapeHtml(sleepQualityLabel(day.recovery,"qualitative-v1"))}</strong></div></div><div class="progression-detail-kpis"><div><strong>${Math.round(load?.actualLoad||0)}</strong><span>Charge sportive</span></div><div><strong>${day.restingHr==null?"—":`${Math.round(day.restingHr)} bpm`}</strong><span>FC repos</span></div><div><strong>${day.hrv==null?"—":`${Math.round(day.hrv)} ms`}</strong><span>VFC</span></div></div><section class="wellness-note-detail"><span class="card-label">Note utilisateur</span><p>${escapeHtml(day.note||"Aucune note pour cette journée.")}</p>${day.source?`<small>Source : ${escapeHtml(day.source)}</small>`:""}</section>`;
  openHomeDialog(dialog);
}

function openProgressionWeek(index, datasetIndex) {
  const week = progressionState.weeks[index];
  const selectedGroup = progressionGroups()[Math.floor(datasetIndex / 2)];
  const content = document.getElementById("progressionDialogContent");
  const dialog = document.getElementById("progressionDialog");
  if (!week || !content || !dialog) return;
  const completed=completedActivities(week.activities);
  const planned=plannedActivities(week.activities);
  const hours = completed.reduce((sum,item) => sum + activityValue(item,"time"),0);
  const distance = completed.reduce((sum,item) => sum + activityValue(item,"distance"),0);
  const groups = new Map();
  week.activities.forEach((activity) => { const group=window.MomentumSportVisuals.getGroup(activity.sport,activity.activity_category); if(!groups.has(group.id)) groups.set(group.id,{...group,activities:[]}); groups.get(group.id).activities.push(activity); });
  content.innerHTML = `<span class="section-kicker">Semaine du ${escapeHtml(fmtShortDate(week.start))}</span><h2>${hours.toFixed(1)} h construites</h2><div class="progression-detail-kpis"><div><strong>${distance.toFixed(1)} km</strong><span>Distance</span></div><div><strong>${completed.length}</strong><span>Séances réalisées</span></div><div><strong>${groups.size}</strong><span>Disciplines</span></div></div>${planned.length?`<p class="planned-detail">${planned.length} séance${planned.length>1?"s":""} prévue${planned.length>1?"s":""}</p>`:""}<div class="progression-sport-list">${[...groups.values()].map((group) => `<button data-progression-group="${group.id}" style="--sport-color:${group.color}"><span>${escapeHtml(group.label)}</span><strong>${completedActivities(group.activities).reduce((sum,item)=>sum+activityValue(item,"time"),0).toFixed(1)} h</strong></button><div class="progression-subdisciplines" data-subdisciplines="${group.id}" ${selectedGroup?.id === group.id ? "" : "hidden"}>${group.activities.map((activity) => `<p class="${activity.status==="planned"?"is-planned":""}"><span>${escapeHtml(window.MomentumSports?.getLabel(activity.sport, activity.activity_type || "Activité") || "Activité")}</span><strong>${activity.status==="planned"?"Prévu · ":""}${activityValue(activity,"time").toFixed(1)} h · ${activityValue(activity,"distance").toFixed(1)} km</strong></p>`).join("")}</div>`).join("")}</div>`;
  content.querySelectorAll("[data-progression-group]").forEach((button) => button.addEventListener("click", () => { const detail=content.querySelector(`[data-subdisciplines="${button.dataset.progressionGroup}"]`); if(detail) detail.hidden=!detail.hidden; }));
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
  document.querySelectorAll("[data-volume-mode]").forEach((button) => button.addEventListener("click", () => { progressionState.mode=button.dataset.volumeMode; document.querySelectorAll("[data-volume-mode]").forEach((item)=>item.classList.toggle("active",item===button)); renderVolumeChart(); }));
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
