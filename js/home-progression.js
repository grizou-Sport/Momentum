/* MOMENTUM — PROGRESSION v1.0 */
const progressionState = { activities:[], weeks:[], chart:null, loadChart:null, sportChart:null, wellnessChart:null, mode:"time", wellnessMode:"summary", passport:null, physiological:null, loadSeries:[], sportGroups:[], wellbeingDays:[] };

function progressionWeekStart(value) {
  const date = new Date(`${value}T12:00:00`);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return iso(date);
}

function progressionWeeks(count = 12) {
  const current = dateFromIso(progressionWeekStart(iso(new Date())));
  return Array.from({ length:count }, (_, index) => {
    const start = addDays(current, (index - count + 1) * 7);
    return { id:iso(start), start:iso(start), end:iso(addDays(start, 6)), label:new Intl.DateTimeFormat("fr-CH", { day:"numeric", month:"short" }).format(start), activities:[] };
  });
}

async function loadProgressionData() {
  const user = await getCurrentUser();
  if (!user) return;
  const start = progressionWeeks(12)[0].start;
  const [activitiesResult, passportResult, dailyResult, daysResult, physiologicalResult] = await Promise.all([
    window.momentumDB.from("activities").select("id,sport,activity_type,activity_category,activity_date,duration_min,distance_km,elevation_m,rpe,avg_hr,status").eq("user_id", user.id).gte("activity_date", start).order("activity_date"),
    window.momentumDB.from("passports").select("sport_level,habits,personalization").eq("user_id", user.id).maybeSingle(),
    window.momentumDB.from("daily_wellbeing").select("recorded_date,sleep_hours,motivation,resting_hr,hrv_ms,sleep_quality_value,source_label").eq("user_id",user.id).gte("recorded_date",start).order("recorded_date"),
    window.momentumDB.from("days").select("day_date,note,mood,energy,sleep_hours,stress,rest_hr,hrv").eq("user_id",user.id).gte("day_date",start).order("day_date"),
    window.momentumDB.from("wellbeing_profile").select("resting_hr,preferred_sleep_hours").eq("user_id",user.id).maybeSingle(),
  ]);
  if (activitiesResult.error) { console.error("HOME : progression indisponible.", activitiesResult.error); return; }
  progressionState.activities = activitiesResult.data || [];
  progressionState.passport = passportResult.data || null;
  progressionState.physiological = physiologicalResult.data || null;
  progressionState.wellbeingDays = mergeWellbeingDays(dailyResult.data || [], daysResult.data || [], start);
  progressionState.weeks = progressionWeeks(12);
  progressionState.activities.forEach((activity) => {
    const week = progressionState.weeks.find((item) => item.id === progressionWeekStart(activity.activity_date));
    if (week) week.activities.push(activity);
  });
  renderProgressionKpis();
  renderVolumeChart();
  renderLoadChart();
  renderSportChart();
  renderWellnessChart();
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
  const hours = progressionState.activities.reduce((sum, item) => sum + Number(item.duration_min || 0), 0) / 60;
  const distance = progressionState.activities.reduce((sum, item) => sum + Number(item.distance_km || 0), 0);
  const activeWeeks = progressionState.weeks.filter((week) => week.activities.length).length;
  strip.innerHTML = `<div><strong>${progressionState.activities.length}</strong><span>Séances · 12 semaines</span></div><div><strong>${hours.toFixed(1)} h</strong><span>Temps construit</span></div><div><strong>${distance.toFixed(0)} km</strong><span>Distance totale</span></div><div><strong>${activeWeeks}</strong><span>Semaines actives</span></div>`;
}

function renderVolumeChart() {
  const canvas = document.getElementById("volumeChart");
  if (!canvas || !window.Chart) return;
  progressionState.chart?.destroy();
  const groups = progressionGroups();
  const datasets = groups.map((group) => ({ label:group.label, backgroundColor:group.color, borderRadius:5, borderSkipped:false, data:progressionState.weeks.map((week) => week.activities.filter((activity) => window.MomentumSportVisuals.getGroup(activity.sport, activity.activity_category).id === group.id).reduce((sum, activity) => sum + activityValue(activity, progressionState.mode), 0)) }));
  progressionState.chart = new Chart(canvas, {
    type:"bar",
    data:{ labels:progressionState.weeks.map((week) => week.label), datasets },
    options:{ responsive:true, maintainAspectRatio:false, animation:{ duration:850, easing:"easeOutQuart" }, interaction:{ mode:"nearest", intersect:true }, onClick:(_event, elements) => { if (elements[0]) openProgressionWeek(elements[0].index, elements[0].datasetIndex); }, plugins:{ legend:{ position:"bottom", align:"start", labels:{ usePointStyle:true, pointStyle:"circle", boxWidth:8, color:"#666", padding:16 } }, tooltip:{ callbacks:{ label:(context) => `${context.dataset.label} : ${context.parsed.y.toFixed(1)} ${progressionState.mode === "time" ? "h" : "km"}` } } }, scales:{ x:{ stacked:true, grid:{ display:false }, ticks:{ color:"#858178", maxRotation:0, autoSkip:true } }, y:{ stacked:true, beginAtZero:true, grid:{ color:"rgba(20,20,20,.07)" }, ticks:{ color:"#858178", callback:(value) => `${value} ${progressionState.mode === "time" ? "h" : "km"}` } } } }
  });
  renderVolumeInsight();
  requestAnimationFrame(() => document.getElementById("volumeChartCard")?.classList.add("is-visible"));
}

function renderVolumeInsight() {
  const element = document.getElementById("volumeInsight");
  if (!element) return;
  const recent = progressionState.weeks.at(-1)?.activities || [];
  if (!recent.length) { element.textContent = "Cette semaine est encore une page blanche."; return; }
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
  const start = addDays(new Date(), -83);
  const firstActivity = progressionState.activities.find((activity) => activity.activity_date)?.activity_date || null;
  const baseline = passportBaselineLoad();
  const expectedActivities = Math.max(6, Number(progressionState.passport?.habits?.weekly_sessions || 3) * 6);
  let chronic = baseline;
  let acute = baseline;
  let observedActivities = 0;
  for (let index=0; index<84; index+=1) {
    const date = iso(addDays(start,index));
    const activities = progressionState.activities.filter((activity) => activity.activity_date === date);
    observedActivities += activities.length;
    const actualLoad = activities.reduce((sum,activity) => sum + activityTrainingLoad(activity),0);
    const learnedDays = firstActivity ? Math.max(0, Math.floor((dateFromIso(date)-dateFromIso(firstActivity))/86400000)+1) : 0;
    const confidence = Math.min(1, learnedDays / 42, observedActivities / expectedActivities);
    const modeledLoad = baseline * (1-confidence) + actualLoad * confidence;
    chronic += (modeledLoad-chronic) / 42;
    acute += (modeledLoad-acute) / 7;
    days.push({ date, activities, actualLoad, modeledLoad, chronic, acute, form:chronic-acute, confidence });
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
  const series = buildLoadSeries();
  const phase = loadPhase(series);
  const current = series.at(-1);
  progressionState.loadChart?.destroy();
  progressionState.loadChart = new Chart(canvas,{ type:"line", data:{ labels:series.map((day) => new Intl.DateTimeFormat("fr-CH",{day:"numeric",month:"short"}).format(dateFromIso(day.date))), datasets:[{label:"Charge chronique",data:series.map((day)=>day.chronic),borderColor:"#273c31",backgroundColor:"rgba(39,60,49,.08)",fill:true,tension:.35,pointRadius:0,borderWidth:2.5},{label:"Charge aiguë",data:series.map((day)=>day.acute),borderColor:"#d9763d",backgroundColor:"transparent",tension:.35,pointRadius:0,borderWidth:2}] }, options:{responsive:true,maintainAspectRatio:false,animation:{duration:850,easing:"easeOutQuart"},interaction:{mode:"index",intersect:false},onClick:(_event,elements)=>{if(elements[0])openLoadDay(elements[0].index);},plugins:{legend:{position:"bottom",align:"start",labels:{usePointStyle:true,pointStyle:"circle",boxWidth:8,padding:16}},tooltip:{callbacks:{label:(context)=>`${context.dataset.label} : ${Math.round(context.parsed.y)}`}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:8,color:"#858178",maxRotation:0}},y:{beginAtZero:true,grid:{color:"rgba(20,20,20,.07)"},ticks:{color:"#858178"}}}} });
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
  content.innerHTML=`<span class="section-kicker">${escapeHtml(fmtDate(day.date))}</span><h2>Charge ${Math.round(day.actualLoad)}</h2><div class="progression-detail-kpis"><div><strong>${Math.round(day.chronic)}</strong><span>Chronique</span></div><div><strong>${Math.round(day.acute)}</strong><span>Aiguë</span></div><div><strong>${day.form>=0?"+":""}${Math.round(day.form)}</strong><span>Forme</span></div></div><div class="load-day-activities">${day.activities.length?day.activities.map((activity)=>`<article><strong>${escapeHtml(window.MomentumSports?.getLabel(activity.sport,activity.activity_type||"Activité")||"Activité")}</strong><span>${Math.round(activityTrainingLoad(activity))} de charge · ${Math.round(activity.duration_min||0)} min · RPE ${activity.rpe||"estimé 5"}</span></article>`).join(""):'<p>Aucune activité enregistrée ce jour-là. Le modèle utilise encore la part estimée du Passeport.</p>'}</div>`;
  if(!dialog.open)dialog.showModal();
}

function buildSportDistribution() {
  const groups = new Map();
  progressionState.activities.forEach((activity) => {
    const visual = window.MomentumSportVisuals.getGroup(activity.sport, activity.activity_category);
    if (!groups.has(visual.id)) groups.set(visual.id, { ...visual, activities:[], hours:0, distance:0 });
    const group = groups.get(visual.id);
    group.activities.push(activity);
    group.hours += activityValue(activity,"time");
    group.distance += activityValue(activity,"distance");
  });
  progressionState.sportGroups = [...groups.values()].sort((a,b) => b.hours-a.hours);
  return progressionState.sportGroups;
}

function renderSportChart() {
  const canvas=document.getElementById("sportChart");
  if(!canvas||!window.Chart)return;
  const groups=buildSportDistribution();
  canvas.parentElement.style.height=`${Math.max(300,groups.length*48)}px`;
  progressionState.sportChart?.destroy();
  progressionState.sportChart=new Chart(canvas,{type:"bar",data:{labels:groups.map((group)=>group.label),datasets:[{label:"Temps",data:groups.map((group)=>group.hours),backgroundColor:groups.map((group)=>group.color),borderRadius:8,borderSkipped:false,barThickness:22}]},options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,animation:{duration:850,easing:"easeOutQuart"},onClick:(_event,elements)=>{if(elements[0])openSportDetail(elements[0].index);},plugins:{legend:{display:false},tooltip:{callbacks:{label:(context)=>`${context.parsed.x.toFixed(1)} h`}}},scales:{x:{beginAtZero:true,grid:{color:"rgba(20,20,20,.07)"},ticks:{color:"#858178",callback:(value)=>`${value} h`}},y:{grid:{display:false},ticks:{color:"#2f2f2f",font:{weight:"700"}}}}}});
  const total=groups.reduce((sum,group)=>sum+group.hours,0);
  const dominant=groups[0];
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
  group.activities.forEach((activity)=>{
    const label=window.MomentumSports?.getLabel(activity.sport,activity.activity_type||group.label)||group.label;
    if(!subdisciplines.has(label))subdisciplines.set(label,{hours:0,distance:0,sessions:0});
    const sub=subdisciplines.get(label);sub.hours+=activityValue(activity,"time");sub.distance+=activityValue(activity,"distance");sub.sessions+=1;
    const intensity=intensityLabel(activity.rpe);intensities.set(intensity,(intensities.get(intensity)||0)+activityValue(activity,"time"));
  });
  content.innerHTML=`<span class="section-kicker">Discipline</span><h2>${escapeHtml(group.label)}</h2><div class="progression-detail-kpis"><div><strong>${group.hours.toFixed(1)} h</strong><span>Temps</span></div><div><strong>${group.distance.toFixed(1)} km</strong><span>Distance</span></div><div><strong>${group.activities.length}</strong><span>Séances</span></div></div><section class="sport-detail-section"><h3>Sous-disciplines</h3><div class="sport-breakdown">${[...subdisciplines.entries()].sort((a,b)=>b[1].hours-a[1].hours).map(([label,data])=>`<div><span>${escapeHtml(label)}</span><strong>${data.hours.toFixed(1)} h · ${data.distance.toFixed(1)} km · ${data.sessions} séance${data.sessions>1?"s":""}</strong></div>`).join("")}</div></section><button class="secondary intensity-toggle" id="showIntensity" type="button">Afficher la répartition par intensité</button><section class="sport-detail-section" id="intensityDetail" hidden><h3>Répartition par intensité</h3><div class="intensity-breakdown">${[...intensities.entries()].map(([label,hours])=>`<div><span>${escapeHtml(label)}</span><i><b style="width:${Math.round(hours/Math.max(group.hours,.01)*100)}%"></b></i><strong>${hours.toFixed(1)} h</strong></div>`).join("")}</div></section>`;
  document.getElementById("showIntensity")?.addEventListener("click",(event)=>{const detail=document.getElementById("intensityDetail");detail.hidden=!detail.hidden;event.currentTarget.textContent=detail.hidden?"Afficher la répartition par intensité":"Masquer la répartition par intensité";});
  if(!dialog.open)dialog.showModal();
}

function normalizeSubjective(value) {
  const number=Number(value);
  if(!Number.isFinite(number))return null;
  return Math.max(0,Math.min(100,number<=5?number*20:number*10));
}

function mergeWellbeingDays(dailyRows, legacyRows, start) {
  const dailyMap=new Map(dailyRows.map((row)=>[row.recorded_date,row]));
  const legacyMap=new Map(legacyRows.map((row)=>[row.day_date,row]));
  const sleepTarget=Number(progressionState.physiological?.preferred_sleep_hours||8);
  return Array.from({length:84},(_,index)=>{
    const date=iso(addDays(dateFromIso(start),index));
    const daily=dailyMap.get(date)||{};const legacy=legacyMap.get(date)||{};
    const sleepHours=daily.sleep_hours??legacy.sleep_hours??null;
    const sleep=sleepHours==null?null:Math.max(0,Math.min(100,Number(sleepHours)/sleepTarget*100));
    const energy=legacy.energy!=null?normalizeSubjective(legacy.energy):(daily.motivation!=null?normalizeSubjective(daily.motivation):null);
    const mood=legacy.mood!=null?normalizeSubjective(legacy.mood):null;
    const recovery=daily.sleep_quality_value!=null?Math.max(0,Math.min(100,Number(daily.sleep_quality_value))):null;
    const available=[sleep,energy,mood,recovery].filter((value)=>value!=null);
    return {date,sleepHours,sleep,energy,mood,recovery,summary:available.length?available.reduce((sum,value)=>sum+value,0)/available.length:null,restingHr:daily.resting_hr??legacy.rest_hr??null,hrv:daily.hrv_ms??legacy.hrv??null,note:legacy.note||null,source:daily.source_label||null};
  });
}

function wellnessDefinition(mode) {
  return ({summary:{label:"Synthèse",color:"#273c31"},sleep:{label:"Sommeil",color:"#5d7894"},energy:{label:"Énergie",color:"#d49a3a"},mood:{label:"Humeur",color:"#b56f7e"},recovery:{label:"Récupération",color:"#66845b"}})[mode];
}

function renderWellnessChart() {
  const canvas=document.getElementById("wellnessChart");
  if(!canvas||!window.Chart)return;
  const definition=wellnessDefinition(progressionState.wellnessMode);
  const days=progressionState.wellbeingDays;
  const availableCount=days.filter((day)=>day[progressionState.wellnessMode]!=null).length;
  progressionState.wellnessChart?.destroy();
  progressionState.wellnessChart=new Chart(canvas,{type:"line",data:{labels:days.map((day)=>new Intl.DateTimeFormat("fr-CH",{day:"numeric",month:"short"}).format(dateFromIso(day.date))),datasets:[{label:definition.label,data:days.map((day)=>day[progressionState.wellnessMode]),borderColor:definition.color,backgroundColor:`${definition.color}18`,fill:true,tension:.35,pointRadius:days.length>45?0:2,pointHoverRadius:5,spanGaps:true,borderWidth:2.5}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:850,easing:"easeOutQuart"},interaction:{mode:"index",intersect:false},onClick:(_event,elements)=>{if(elements[0])openWellnessDay(elements[0].index);},plugins:{legend:{display:false},tooltip:{callbacks:{label:(context)=>context.parsed.y==null?"Aucune donnée":`${definition.label} : ${Math.round(context.parsed.y)} / 100`}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:8,maxRotation:0,color:"#858178"}},y:{min:0,max:100,grid:{color:"rgba(20,20,20,.07)"},ticks:{color:"#858178",callback:(value)=>`${value}`}}}}});
  if(availableCount<5){progressionState.wellnessChart.data.datasets[0].pointRadius=4;progressionState.wellnessChart.update("none");}
  const recent=[...days].reverse().find((day)=>day[progressionState.wellnessMode]!=null);
  const insight=document.getElementById("wellnessInsight");
  insight.textContent=recent?`${definition.label} : ${Math.round(recent[progressionState.wellnessMode])} / 100 lors de la dernière journée renseignée.`:"Aucune donnée disponible pour cet indicateur. MOMENTUM attend une saisie ou une source connectée.";
  requestAnimationFrame(()=>document.getElementById("wellnessChartCard")?.classList.add("is-visible"));
}

function wellnessValue(value,suffix=" / 100") { return value==null?"Non renseigné":`${Math.round(value)}${suffix}`; }

function openWellnessDay(index) {
  const day=progressionState.wellbeingDays[index];
  const load=progressionState.loadSeries.find((item)=>item.date===day.date);
  const content=document.getElementById("progressionDialogContent");const dialog=document.getElementById("progressionDialog");
  if(!day||!content||!dialog)return;
  content.innerHTML=`<span class="section-kicker">${escapeHtml(fmtDate(day.date))}</span><h2>${wellnessValue(day.summary)}</h2><div class="wellness-detail-grid"><div><span>Sommeil</span><strong>${day.sleepHours==null?"Non renseigné":`${Math.floor(day.sleepHours)} h ${String(Math.round((day.sleepHours%1)*60)).padStart(2,"0")}`}</strong><small>${wellnessValue(day.sleep)}</small></div><div><span>Énergie</span><strong>${wellnessValue(day.energy)}</strong></div><div><span>Humeur</span><strong>${wellnessValue(day.mood)}</strong></div><div><span>Récupération</span><strong>${wellnessValue(day.recovery)}</strong></div></div><div class="progression-detail-kpis"><div><strong>${Math.round(load?.actualLoad||0)}</strong><span>Charge sportive</span></div><div><strong>${day.restingHr??"—"}</strong><span>FC repos</span></div><div><strong>${day.hrv??"—"}</strong><span>VFC</span></div></div><section class="wellness-note-detail"><span class="card-label">Note utilisateur</span><p>${escapeHtml(day.note||"Aucune note pour cette journée.")}</p>${day.source?`<small>Source : ${escapeHtml(day.source)}</small>`:""}</section>`;
  if(!dialog.open)dialog.showModal();
}

function openProgressionWeek(index, datasetIndex) {
  const week = progressionState.weeks[index];
  const selectedGroup = progressionGroups()[datasetIndex];
  const content = document.getElementById("progressionDialogContent");
  const dialog = document.getElementById("progressionDialog");
  if (!week || !content || !dialog) return;
  const hours = week.activities.reduce((sum,item) => sum + activityValue(item,"time"),0);
  const distance = week.activities.reduce((sum,item) => sum + activityValue(item,"distance"),0);
  const groups = new Map();
  week.activities.forEach((activity) => { const group=window.MomentumSportVisuals.getGroup(activity.sport,activity.activity_category); if(!groups.has(group.id)) groups.set(group.id,{...group,activities:[]}); groups.get(group.id).activities.push(activity); });
  content.innerHTML = `<span class="section-kicker">Semaine du ${escapeHtml(fmtShortDate(week.start))}</span><h2>${hours.toFixed(1)} h construites</h2><div class="progression-detail-kpis"><div><strong>${distance.toFixed(1)} km</strong><span>Distance</span></div><div><strong>${week.activities.length}</strong><span>Séances</span></div><div><strong>${groups.size}</strong><span>Disciplines</span></div></div><div class="progression-sport-list">${[...groups.values()].map((group) => `<button data-progression-group="${group.id}" style="--sport-color:${group.color}"><span>${escapeHtml(group.label)}</span><strong>${group.activities.reduce((sum,item)=>sum+activityValue(item,"time"),0).toFixed(1)} h</strong></button><div class="progression-subdisciplines" data-subdisciplines="${group.id}" ${selectedGroup?.id === group.id ? "" : "hidden"}>${group.activities.map((activity) => `<p><span>${escapeHtml(window.MomentumSports?.getLabel(activity.sport, activity.activity_type || "Activité") || "Activité")}</span><strong>${activityValue(activity,"time").toFixed(1)} h · ${activityValue(activity,"distance").toFixed(1)} km</strong></p>`).join("")}</div>`).join("")}</div>`;
  content.querySelectorAll("[data-progression-group]").forEach((button) => button.addEventListener("click", () => { const detail=content.querySelector(`[data-subdisciplines="${button.dataset.progressionGroup}"]`); if(detail) detail.hidden=!detail.hidden; }));
  dialog.showModal();
}

function bindProgression() {
  document.querySelectorAll("[data-volume-mode]").forEach((button) => button.addEventListener("click", () => { progressionState.mode=button.dataset.volumeMode; document.querySelectorAll("[data-volume-mode]").forEach((item)=>item.classList.toggle("active",item===button)); renderVolumeChart(); }));
  document.querySelectorAll("[data-wellness-mode]").forEach((button) => button.addEventListener("click",()=>{progressionState.wellnessMode=button.dataset.wellnessMode;document.querySelectorAll("[data-wellness-mode]").forEach((item)=>item.classList.toggle("active",item===button));renderWellnessChart();}));
  document.getElementById("closeProgressionDialog")?.addEventListener("click", () => document.getElementById("progressionDialog")?.close());
}

document.addEventListener("DOMContentLoaded", () => { bindProgression(); loadProgressionData(); });
