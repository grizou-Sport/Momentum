const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const storeKey = 'momentum_v004'; // conservé pour garder tes données locales entre v0.04 et v0.05
const sports = ['Course à pied','Vélo','Gravel / VTT','Musculation','CrossFit','Hyrox','Natation','Marche','Randonnée','Mobilité','Récupération','Ski de fond','Ski alpin','Padel','Autre'];
const icons = {'Course à pied':'🏃','Vélo':'🚴','Gravel / VTT':'🚵','Musculation':'🏋️','CrossFit':'💪','Hyrox':'🔥','Natation':'🏊','Marche':'🚶','Randonnée':'⛰️','Mobilité':'🧘','Récupération':'💙','Ski de fond':'🎿','Ski alpin':'⛷️','Padel':'🎾','Autre':'✨'};
const weekdays = ['LUN','MAR','MER','JEU','VEN','SAM','DIM'];
const dayLong = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
let charts = {}, selectedDate = iso(new Date()), visibleMonth = new Date(), activeTab = 'resume', submitting = false;

function iso(d){ const x = new Date(d); x.setMinutes(x.getMinutes()-x.getTimezoneOffset()); return x.toISOString().slice(0,10); }
function addDays(d,n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function dateFromIso(s){ return new Date(`${s}T12:00:00`); }
function fmtDate(s){ const d=dateFromIso(s); return `${dayLong[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`; }
function fmtShort(s){ const d=dateFromIso(s); return `${d.getDate()} ${months[d.getMonth()].slice(0,3)}`; }
function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36); }
function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
function minutesToH(m){ if(!m) return '—'; return `${Math.floor(m/60)}h${String(Math.round(m%60)).padStart(2,'0')}`; }
function pace(km,min){ if(!km||!min) return '—'; const p=min/km; return `${Math.floor(p)}'${String(Math.round((p%1)*60)).padStart(2,'0')}/km`; }
function weekStart(d){ const x=new Date(d); const offset=(x.getDay()+6)%7; x.setDate(x.getDate()-offset); x.setHours(12,0,0,0); return x; }

const demo = () => {
  const today = new Date();
  const base = addDays(today,-18);
  const sessions = [
    [-17,'Course à pied','Endurance',8.2,46,132,3,'done','Footing facile, jambes légères.'],[-15,'Course à pied','Fractionné',6.1,33,154,7,'done','10 × 400 progressif.'],[-13,'Musculation','Renforcement',0,45,0,4,'done','Gainage, fentes, mollets.'],[-10,'Course à pied','Sortie longue',18,102,139,5,'done','Sortie longue maîtrisée.'],[-8,'Course à pied','Endurance',10,55,131,3,'done','Régulier, facile.'],[-3,'Course à pied','Repos',0,0,0,0,'done','Repos complet.'],[-2,'Course à pied','Endurance',12.4,62,132,3,'done','Très bonnes sensations pendant toute la sortie.'],[1,'Course à pied','Fractionné',0,0,0,0,'planned','10 × 1000 prévu.'],[2,'Musculation','Renfo haut corps',0,45,0,4,'planned','Renforcement prévu.'],[3,'Course à pied','Footing',10,0,0,3,'planned','Footing facile prévu.'],[5,'Course à pied','Sortie longue',24,0,0,5,'planned','Longue sortie progressive.']
  ].map(([off,sport,type,distance,duration,hr,rpe,status,comment])=>({id:uid(),date:iso(addDays(today,off)),sport,type,distance,duration,hr,rpe,status,comment,gear: sport==='Course à pied'?'ASICS Superblast 2':''}));
  const wellness = {};
  for(let i=-24;i<=4;i++){
    const score = i===-4 ? 5 : i===-3 ? 6 : 7 + ((i%3)===0?1:0);
    wellness[iso(addDays(today,i))]={mood:clamp(score,1,10),sleep:+(7.2+((i%5)*.18)).toFixed(1),restHr:47+(i%4),energy:clamp(score-1,1,10),stress: i%7===0?6:3,soreness:i%6===0?'Légères':'Aucune',note:i===0?'Envie de construire sans forcer.':''};
  }
  return {profile:{athlete:'Chris',project:'Marathon Amsterdam 2026',goal:'Sub 3h00',targetDate:'2026-10-18',targetTime:'2h59\'59',targetPace:"4'15/km",goalDistance:42.195,tagline:"Discipline aujourd'hui, liberté demain."},sessions,wellness};
};
let state = load();
function load(){ try{return JSON.parse(localStorage.getItem(storeKey)) || demo();}catch{return demo();} }
function save(){ localStorage.setItem(storeKey,JSON.stringify(state)); }

function sessionsOn(d){ return state.sessions.filter(s=>s.date===d).sort((a,b)=> (a.status==='done'?-1:1)); }
function sessionIcon(s){ return icons[s.sport] || '✨'; }
function wellnessScore(w){ if(!w) return null; const vals=[]; if(w.mood) vals.push(+w.mood); if(w.energy) vals.push(+w.energy); if(w.sleep) vals.push(Math.min(10,+w.sleep/8*8.5)); if(w.stress) vals.push(11-(+w.stress)); if(!vals.length) return null; return vals.reduce((a,b)=>a+b,0)/vals.length; }
function readinessClass(w){ const s=wellnessScore(w); if(s==null) return 'missing'; if(s>=8) return 'excellent'; if(s>=6.6) return 'good'; if(s>=5) return 'average'; return 'hard'; }
function readableReadiness(w){ const c=readinessClass(w); return {excellent:'Excellente journée',good:'Bonne journée',average:'Journée moyenne',hard:'Journée difficile',missing:'Donnée manquante'}[c]; }

function renderAll(){ renderHero(); renderToday(); renderLivingWeek(); renderMonth(); renderKpis(); renderCharts(); }
function renderHero(){
  const p=state.profile, today=new Date(), target=dateFromIso(p.targetDate);
  const days=Math.ceil((target-today)/(1000*60*60*24));
  const start=addDays(target,-140); const pct=clamp(Math.round(((today-start)/(target-start))*100),0,100);
  $('#heroTitle').textContent=p.project; $('#heroQuote').textContent=p.tagline; $('#daysLeft').textContent=days>=0?`J-${days}`:'Mission terminée';
  $('#targetDateLabel').textContent=target.toLocaleDateString('fr-CH',{day:'2-digit',month:'long',year:'numeric'});
  $('#missionProgress').textContent=`${pct}%`; $('#goalLabel').textContent=p.goal; $('#paceLabel').textContent=p.targetPace || '—';
}
function renderToday(){
  const d=iso(new Date()), ss=sessionsOn(d), w=state.wellness[d]||{}, main=ss[0];
  $('#todayTitle').textContent=`${fmtDate(d)}`;
  $('#todayNarrative').textContent = narrativeForDay(d, ss, w);
  $('#todayCard').innerHTML = `<h3>État du jour</h3><p class="analysis-text">${readableReadiness(w)}. ${w.note || 'Ajoute ton ressenti pour transformer cette journée en souvenir utile.'}</p><div class="day-mood"><span class="chip">😊 ${w.mood? w.mood+'/10':'—'}</span><span class="chip">😴 ${w.sleep? w.sleep+' h':'—'}</span><span class="chip">❤️ ${w.restHr? w.restHr+' bpm':'—'}</span><span class="chip">⚡ ${w.energy? w.energy+'/10':'—'}</span></div><button class="primary open-today" type="button">Ouvrir la page du jour</button>`;
  $('#plannedCard').innerHTML = main ? `<h3>${main.status==='planned'?'Séance prévue':'Séance du jour'}</h3><p class="analysis-text"><strong>${sessionIcon(main)} ${main.type}</strong><br>${main.distance?main.distance+' km':''} ${main.duration? '· '+minutesToH(main.duration):''}<br>${main.comment||''}</p><button class="secondary open-today" type="button">Voir / modifier</button>` : `<h3>Aucune séance</h3><p class="analysis-text">Aujourd'hui peut être une page de récupération, ou le début d'une séance prévue.</p><button class="primary open-today" type="button">Créer une séance</button>`;
  $$('.open-today').forEach(b=>b.onclick=()=>openDay(d));
}
function narrativeForDay(d,ss,w){
  const today = d===iso(new Date()); const score=wellnessScore(w); const done=ss.filter(s=>s.status==='done'), planned=ss.filter(s=>s.status==='planned');
  if(done.length) return `Aujourd'hui, la préparation a avancé avec ${done.map(s=>s.type.toLowerCase()).join(', ')}. ${score?`Le niveau de fraîcheur est autour de ${score.toFixed(1)}/10.`:''}`;
  if(planned.length) return `${today?'Aujourd’hui':'Cette journée'} porte une intention : ${planned[0].type}. L’objectif est de construire sans brûler les étapes.`;
  if(score) return `${today?'Aujourd’hui':'Cette journée'} raconte surtout l’état du corps : ${readableReadiness(w).toLowerCase()}.`;
  return `Aucune donnée encore. Clique sur la journée pour écrire la suite.`;
}
function renderLivingWeek(){
  const cont=$('#livingWeek'); cont.innerHTML=''; const today=new Date();
  for(let i=-3;i<=3;i++){
    const date=addDays(today,i), id=iso(date), ss=sessionsOn(id), w=state.wellness[id]||{}, main=ss[0];
    const card=document.createElement('article'); card.className=`live-card ${i===0?'today':''}`; card.innerHTML=`<div class="day">${i===0?'Aujourd’hui':dayLong[date.getDay()]}</div><div class="date">${date.getDate()} ${months[date.getMonth()].slice(0,3)}</div><div class="ico">${main?sessionIcon(main):'○'}</div><div class="title">${main?main.type:'Page vide'}</div><div class="sub">${main?(main.status==='planned'?'Prévu':`${main.distance||0} km · ${minutesToH(main.duration)}`):'À écrire'}</div><span class="readiness ${readinessClass(w)}"></span>`;
    card.onclick=()=>openDay(id); cont.appendChild(card);
  }
}
function renderMonth(){
  $('#monthTitle').textContent = `${months[visibleMonth.getMonth()]} ${visibleMonth.getFullYear()}`;
  const grid=$('#monthGrid'); grid.innerHTML=''; weekdays.forEach(w=>{const h=document.createElement('div');h.className='month-head';h.textContent=w;grid.appendChild(h);});
  const y=visibleMonth.getFullYear(), m=visibleMonth.getMonth(); const first=new Date(y,m,1); const offset=(first.getDay()+6)%7; const start=addDays(first,-offset);
  for(let i=0;i<42;i++){
    const d=addDays(start,i), id=iso(d), ss=sessionsOn(id), main=ss[0], w=state.wellness[id];
    const cell=document.createElement('div'); cell.className=`month-day ${d.getMonth()!==m?'out':''} ${id===iso(new Date())?'today':''} ${id===selectedDate?'selected':''}`;
    cell.innerHTML=`<span class="read-dot ${readinessClass(w)}"></span><div class="num">${d.getDate()}</div>${main?`<div class="mini"><span class="emoji">${sessionIcon(main)}</span><br>${main.status==='planned'?'prévu':main.distance?main.distance+' km':main.type}</div>`:''}`;
    cell.onclick=()=>{selectedDate=id; renderMonth(); openDay(id);}; grid.appendChild(cell);
  }
}
function renderKpis(){
  const ws=weekStart(new Date()), we=addDays(ws,6), weekSessions=state.sessions.filter(s=>s.status==='done'&&dateFromIso(s.date)>=ws&&dateFromIso(s.date)<=we);
  const km=weekSessions.reduce((a,s)=>a+(s.distance||0),0), min=weekSessions.reduce((a,s)=>a+(s.duration||0),0), load=weekSessions.reduce((a,s)=>a+(s.duration||0)*(s.rpe||0),0);
  const wellnessVals=Object.entries(state.wellness).filter(([d])=>dateFromIso(d)>=ws&&dateFromIso(d)<=we).map(([,w])=>wellnessScore(w)).filter(Boolean); const rhr=Object.entries(state.wellness).filter(([d])=>dateFromIso(d)>=ws&&dateFromIso(d)<=we).map(([,w])=>w.restHr).filter(Boolean);
  const kpis=[['Volume semaine',`${km.toFixed(1)} km`],['Temps',minutesToH(min)],['Charge',Math.round(load)],['Bien-être',wellnessVals.length?(wellnessVals.reduce((a,b)=>a+b,0)/wellnessVals.length).toFixed(1)+'/10':'—'],['FC repos',rhr.length?Math.round(rhr.reduce((a,b)=>a+b,0)/rhr.length)+' bpm':'—']];
  $('#kpiStrip').innerHTML=kpis.map(([a,b])=>`<div class="kpi"><span>${a}</span><strong>${b}</strong></div>`).join('');
}
function renderCharts(){
  const done = state.sessions.filter(s=>s.status==='done').map(s=>({...s, d:dateFromIso(s.date)})).sort((a,b)=>a.d-b.d);
  if(!done.length) return;
  const first=weekStart(done[0].d), last=weekStart(new Date(Math.max(new Date(), done.at(-1).d)));
  const weeks=[]; for(let d=new Date(first); d<=last; d=addDays(d,7)){ const start=new Date(d), end=addDays(start,6); const ss=done.filter(s=>s.d>=start&&s.d<=end); weeks.push({label:`${start.getDate()}.${start.getMonth()+1}`,km:ss.reduce((a,s)=>a+(s.distance||0),0),load:ss.reduce((a,s)=>a+(s.duration||0)*(s.rpe||0),0)}); }
  const shown=weeks.slice(-12);
  chart('volumeChart','bar',{labels:shown.map(x=>x.label),datasets:[{label:'km tous sports',data:shown.map(x=>+x.km.toFixed(1)),backgroundColor:'rgba(32,120,255,.55)',borderColor:'#2078ff'}]});
  let ctl=35,atl=35; const fit=shown.map(x=>{ctl=ctl*.82+(x.load/35)*.18; atl=atl*.55+(x.load/35)*.45; return {ctl:+ctl.toFixed(1),atl:+atl.toFixed(1),tsb:+(ctl-atl).toFixed(1)};});
  chart('fitnessChart','line',{labels:shown.map(x=>x.label),datasets:[{label:'CTL',data:fit.map(x=>x.ctl),borderColor:'#2078ff',tension:.35},{label:'ATL',data:fit.map(x=>x.atl),borderColor:'#ff9f1c',tension:.35},{label:'TSB',data:fit.map(x=>x.tsb),borderColor:'#35b86b',tension:.35}]});
  const since=addDays(new Date(),-60), by={}; done.filter(s=>s.d>=since).forEach(s=>by[s.sport]=(by[s.sport]||0)+(s.duration||0));
  chart('sportChart','doughnut',{labels:Object.keys(by),datasets:[{data:Object.values(by),backgroundColor:['#2078ff','#72c7ff','#35b86b','#ff9f1c','#8a63ff','#ff4d5a','#9fc5e8']}]});
  const days=Object.keys(state.wellness).sort().slice(-21); chart('wellnessChart','line',{labels:days.map(fmtShort),datasets:[{label:'Sommeil',data:days.map(d=>state.wellness[d]?.sleep||null),borderColor:'#7b61ff',tension:.35},{label:'Énergie',data:days.map(d=>state.wellness[d]?.energy||null),borderColor:'#35b86b',tension:.35},{label:'Stress',data:days.map(d=>state.wellness[d]?.stress||null),borderColor:'#ff4d5a',tension:.35}]});
}
function chart(id,type,data){ if(!window.Chart) return; if(charts[id]) charts[id].destroy(); const canvas=$('#'+id); if(!canvas) return; charts[id]=new Chart(canvas,{type,data,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:type==='doughnut'?{}:{x:{grid:{display:false}},y:{grid:{color:'rgba(32,120,255,.1)'}}}}}); }

function openDay(d){ selectedDate=d; activeTab='resume'; renderMonth(); const dlg=$('#dayDialog'); renderDayDialog(d); if(!dlg.open) dlg.showModal(); }
function renderDayDialog(d){
  const ss=sessionsOn(d), w=state.wellness[d]||{};
  $('#dayDialogContent').innerHTML=`<div class="day-inner"><p class="section-kicker">${d===iso(new Date())?'Aujourd’hui':'Page du journal'}</p><h2>${fmtDate(d)}</h2><p class="lead">${narrativeForDay(d,ss,w)}</p><div class="day-tabs"><button class="${activeTab==='resume'?'active':''}" data-tab="resume">Résumé</button><button class="${activeTab==='edit'?'active':''}" data-tab="edit">Écrire</button><button class="${activeTab==='analyse'?'active':''}" data-tab="analyse">Analyse</button></div><div id="tabContent"></div></div>`;
  $$('.day-tabs button').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab; renderDayDialog(d);});
  if(activeTab==='edit') renderEditTab(d, ss, w); else if(activeTab==='analyse') renderAnalyseTab(d,ss,w); else renderResumeTab(d,ss,w);
}
function renderResumeTab(d,ss,w){
  $('#tabContent').innerHTML=`<h3>État du jour</h3><div class="wellness-grid"><div><span>Humeur</span><strong>${w.mood?w.mood+'/10':'—'}</strong></div><div><span>Sommeil</span><strong>${w.sleep?w.sleep+' h':'—'}</strong></div><div><span>FC repos</span><strong>${w.restHr?w.restHr+' bpm':'—'}</strong></div><div><span>Énergie</span><strong>${w.energy?w.energy+'/10':'—'}</strong></div><div><span>Courbatures</span><strong>${w.soreness||'—'}</strong></div><div><span>Stress</span><strong>${w.stress?w.stress+'/10':'—'}</strong></div></div>${w.note?`<p class="analysis-text">${w.note}</p>`:''}<h3>Entraînement</h3>${ss.length?ss.map(sessionHtml).join(''):'<p class="analysis-text">Aucune séance. Cette journée peut rester une récupération, ou devenir une séance prévue.</p>'}<button class="primary" id="writeDay" type="button">Écrire / modifier cette journée</button>`;
  $('#writeDay').onclick=()=>{activeTab='edit'; renderDayDialog(d);};
}
function sessionHtml(s){ return `<div class="session-box"><div class="session-title"><span style="font-size:32px">${sessionIcon(s)}</span><h3>${s.type}</h3><span class="status ${s.status}">${s.status==='done'?'Réalisé':'Prévu'}</span></div><div class="session-stats"><div><span>Distance</span><strong>${s.distance||0} km</strong></div><div><span>Temps</span><strong>${minutesToH(s.duration)}</strong></div><div><span>Allure</span><strong>${pace(s.distance,s.duration)}</strong></div><div><span>FC moy.</span><strong>${s.hr?s.hr+' bpm':'—'}</strong></div><div><span>Charge</span><strong>${Math.round((s.duration||0)*(s.rpe||0))}</strong></div><div><span>RPE</span><strong>${s.rpe||'—'}/10</strong></div></div>${s.comment?`<p class="analysis-text">${s.comment}</p>`:''}${s.route?renderMap(s.route):''}</div>`; }
function renderMap(route){ const pts=route.points||[]; if(pts.length<2) return ''; const xs=pts.map(p=>p.lon), ys=pts.map(p=>p.lat), minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys); const path=pts.map((p,i)=>{const x=20+((p.lon-minX)/(maxX-minX||1))*620, y=190-((p.lat-minY)/(maxY-minY||1))*160; return `${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`}).join(' '); return `<div class="map-box"><svg viewBox="0 0 660 220"><path d="M0 155 C150 70 290 210 660 55" fill="none" stroke="rgba(32,120,255,.12)" stroke-width="38"/><path d="${path}" fill="none" stroke="#2078ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="190" r="7" fill="#35b86b"/></svg></div>`; }
function renderEditTab(d,ss,w){
  const cont=$('#tabContent'); cont.innerHTML=`<h3>Bien-être</h3><div id="wellnessFormHost"></div><h3>Séances</h3><div id="sessionsFormHost"></div><button class="secondary" id="addAnother" type="button">Ajouter une autre séance</button>`;
  cont.querySelector('#wellnessFormHost').appendChild(wellnessForm(d,w));
  const host=cont.querySelector('#sessionsFormHost'); if(ss.length) ss.forEach(s=>host.appendChild(sessionForm(d,s))); else host.appendChild(sessionForm(d,{}));
  $('#addAnother').onclick=()=>host.appendChild(sessionForm(d,{}));
}
function wellnessForm(d,w){ const node=$('#wellnessFormTemplate').content.cloneNode(true), form=node.querySelector('form'); Object.entries(w||{}).forEach(([k,v])=>{if(form.elements[k]) form.elements[k].value=v}); form.onsubmit=e=>{e.preventDefault(); const data=Object.fromEntries(new FormData(form)); Object.keys(data).forEach(k=>{if(data[k]==='') delete data[k]; else if(!['soreness','note'].includes(k)) data[k]=+data[k];}); state.wellness[d]=data; save(); renderAll(); activeTab='resume'; renderDayDialog(d);}; return node; }
function sessionForm(d,s={}){ const node=$('#sessionFormTemplate').content.cloneNode(true), form=node.querySelector('form'), sel=form.elements.sport; sports.forEach(sp=>sel.add(new Option(sp,sp))); form.elements.id.value=s.id||''; ['status','sport','type','distance','duration','hr','rpe','gear','comment'].forEach(k=>{if(form.elements[k]) form.elements[k].value=s[k] ?? (k==='status'?'planned':k==='sport'?'Course à pied':'');}); form.onsubmit=async e=>{e.preventDefault(); if(submitting) return; submitting=true; const btn=form.querySelector('button[type="submit"]'); btn.disabled=true; try{ const fd=new FormData(form); const obj={}; for(const [k,v] of fd.entries()){ if(k!=='gpx') obj[k]=v; } obj.date=d; ['distance','duration','hr','rpe'].forEach(k=>obj[k]=obj[k]?+obj[k]:0); if(!obj.id) obj.id=uid(); const file=form.elements.gpx.files[0]; if(file && file.size) obj.route=await parseGpx(file); else if(s.route) obj.route=s.route; const ix=state.sessions.findIndex(x=>x.id===obj.id); if(ix>=0) state.sessions[ix]=obj; else state.sessions.push(obj); save(); renderAll(); activeTab='resume'; renderDayDialog(d);} finally{submitting=false; btn.disabled=false;} };
  form.querySelector('.delete-session').onclick=()=>{ if(s.id){ state.sessions=state.sessions.filter(x=>x.id!==s.id); save(); renderAll(); activeTab='resume'; renderDayDialog(d);} else form.remove(); };
  return node; }
async function parseGpx(file){ const txt=await file.text(); const xml=new DOMParser().parseFromString(txt,'application/xml'); const points=[...xml.querySelectorAll('trkpt')].map(p=>({lat:+p.getAttribute('lat'),lon:+p.getAttribute('lon'),ele:+(p.querySelector('ele')?.textContent||0)})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)); return {name:file.name,points}; }
function renderAnalyseTab(d,ss,w){ const score=wellnessScore(w), load=ss.reduce((a,s)=>a+(s.duration||0)*(s.rpe||0),0); let text='Cette page manque encore de données. Ajoute le ressenti, le sommeil et la séance pour que Momentum raconte mieux la journée.'; if(ss.length || score) text=`Cette journée montre ${ss.length?`${ss.length} séance(s) et une charge de ${Math.round(load)}`:'aucune charge sportive'}. ${score?`Le bien-être ressort à ${score.toFixed(1)}/10.`:''} ${load>400 && score && score<6.5?'Signal utile : charge élevée avec récupération moyenne, donc prudence demain.':'L’équilibre général semble cohérent.'}`; $('#tabContent').innerHTML=`<h3>Lecture automatique</h3><p class="analysis-text">${text}</p>`; }

function bind(){
  $('#closeDay').onclick=()=>$('#dayDialog').close(); $('#dayDialog').addEventListener('click',e=>{ if(e.target.id==='dayDialog') $('#dayDialog').close(); });
  $('#centerToday').onclick=()=>{selectedDate=iso(new Date()); visibleMonth=new Date(); renderAll();}; $('#todayBtn').onclick=()=>{selectedDate=iso(new Date()); visibleMonth=new Date(); renderAll();}; $('#prevMonth').onclick=()=>{visibleMonth.setMonth(visibleMonth.getMonth()-1); renderMonth();}; $('#nextMonth').onclick=()=>{visibleMonth.setMonth(visibleMonth.getMonth()+1); renderMonth();};
  $('#profileForm').onsubmit=e=>{e.preventDefault(); state.profile=Object.fromEntries(new FormData(e.target)); state.profile.goalDistance=+state.profile.goalDistance||42.195; save(); renderAll();};
  $('#resetBtn').onclick=()=>{ if(confirm('Réinitialiser les données de démonstration ?')){ localStorage.removeItem(storeKey); state=demo(); save(); visibleMonth=new Date(); selectedDate=iso(new Date()); renderAll(); }};
  $('#exportBtn').onclick=()=>{ const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='momentum-data.json'; a.click(); URL.revokeObjectURL(a.href); };
  $('#importFile').onchange=async e=>{ const file=e.target.files[0]; if(!file) return; state=JSON.parse(await file.text()); save(); renderAll(); e.target.value=''; };
}
function fillProfileForm(){ const form=$('#profileForm'); Object.entries(state.profile).forEach(([k,v])=>{if(form.elements[k]) form.elements[k].value=v}); }

bind(); fillProfileForm(); renderAll();
