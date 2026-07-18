const onboarding = {
  user: null,
  passport: null,
  progress: null,
  sports: [],
  selectedSports: new Set(),
  savedSportIds: new Set(),
  currentStep: 1,
  avatarUrl: null,
  estimate: null,
};

const form = document.getElementById("onboardingForm");
const steps = [...document.querySelectorAll(".onboarding-step")];
const previousButton = document.getElementById("previousStep");
const nextButton = document.getElementById("nextStep");
const stepMessage = document.getElementById("stepMessage");
const saveStatus = document.getElementById("onboardingStatus");

const choiceSets = {
  experience: [
    ["BEGINNER", "Je débute"], ["ONE_TWO", "1–2 ans"], ["THREE_FIVE", "3–5 ans"], ["FIVE_PLUS", "+ de 5 ans"],
  ],
  weeklyHours: [
    ["ONE_THREE", "1–3 h"], ["THREE_FIVE", "3–5 h"], ["FIVE_EIGHT", "5–8 h"], ["EIGHT_TWELVE", "8–12 h"], ["TWELVE_PLUS", "+ de 12 h"],
  ],
  objective: [["HEALTH", "Santé"], ["PLEASURE", "Plaisir"], ["PERFORMANCE", "Performance"], ["COMPETITION", "Compétition"]],
  events: [["HALF_MARATHON", "Semi-marathon"], ["MARATHON", "Marathon"], ["ULTRA_TRAIL", "Ultra-trail"], ["IRONMAN", "Ironman"], ["CYCLOSPORTIVE", "Cyclosportive"], ["NONE", "Aucune"]],
  watch: [["COROS", "COROS"], ["GARMIN", "Garmin"], ["POLAR", "Polar"], ["SUUNTO", "Suunto"], ["APPLE_WATCH", "Apple Watch"], ["NONE", "Aucune"]],
};

const sportIcons = {
  "course à pied": "running", trail: "trail-running", "vélo route": "cycling", gravel: "gravel", vtt: "mountain-bike",
  natation: "swimming", musculation: "strength-training", randonnée: "hiking", yoga: "yoga", "ski alpin": "alpine-skiing",
  "ski de fond": "cross-country-skiing", "ski de randonnée": "ski-touring", escalade: "climbing", golf: "golf", padel: "padel",
  surf: "surfing", kitesurf: "kitesurfing", "stand up paddle": "stand-up-paddle",
};

function setStatus(text, type = "") {
  saveStatus.textContent = text;
  saveStatus.className = `save-status${type ? ` ${type}` : ""}`;
}

function setError(message = "") {
  stepMessage.textContent = message;
}

function sportIcon(name) {
  return sportIcons[String(name).toLowerCase()] || "activity";
}

function selectedValue(name) {
  return form.querySelector(`input[name="${name}"]:checked`)?.value || null;
}

function selectedValues(name) {
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function weeklyHoursValue(code) {
  return ({ ONE_THREE: 2, THREE_FIVE: 4, FIVE_EIGHT: 6.5, EIGHT_TWELVE: 10, TWELVE_PLUS: 14 })[code] || 3;
}

function experienceLevel(code) {
  return ({ BEGINNER: "BEGINNER", ONE_TWO: "RETURNING", THREE_FIVE: "REGULAR", FIVE_PLUS: "EXPERT" })[code] || "BEGINNER";
}

function experienceLabel(code) {
  return ({ BEGINNER: "Découverte", ONE_TWO: "En construction", THREE_FIVE: "Confirmé", FIVE_PLUS: "Expérimenté" })[code] || "Découverte";
}

function objectiveLabel(code) {
  return ({ HEALTH: "Santé durable", PLEASURE: "Plaisir du mouvement", PERFORMANCE: "Progression", COMPETITION: "Compétition" })[code] || "Plaisir du mouvement";
}

function answerSnapshot() {
  return {
    ...(onboarding.progress?.answers || {}),
    experience: selectedValue("experience"),
    weekly_hours_range: selectedValue("weeklyHours"),
    objective: selectedValue("objective"),
    events: selectedValues("events"),
    watch: selectedValue("watch"),
    sport_ids: [...onboarding.selectedSports],
  };
}

function renderChoiceSets() {
  Object.entries(choiceSets).forEach(([name, choices]) => {
    const target = document.querySelector(`[data-choice="${name}"]`);
    const multiple = name === "events";
    target.innerHTML = choices.map(([value, label]) => `
      <label class="choice-pill"><input type="${multiple ? "checkbox" : "radio"}" name="${name}" value="${value}" /><span>${label}</span></label>
    `).join("");
  });

  form.querySelectorAll('input[name="events"]').forEach((input) => input.addEventListener("change", () => {
    if (input.value === "NONE" && input.checked) form.querySelectorAll('input[name="events"]:not([value="NONE"])').forEach((item) => { item.checked = false; });
    if (input.value !== "NONE" && input.checked) form.querySelector('input[name="events"][value="NONE"]').checked = false;
  }));
}

function renderSports() {
  const target = document.getElementById("sportsGrid");
  target.innerHTML = onboarding.sports.map((sport) => {
    const selected = onboarding.selectedSports.has(sport.id);
    return `<label class="choice-card${selected ? " selected" : ""}" data-sport-id="${sport.id}">
      <input type="checkbox" value="${sport.id}" ${selected ? "checked" : ""} />
      <span class="sport-icon"><img src="Assets/icons/sports/${sportIcon(sport.name)}.svg" alt="" /></span>
      <span>${sport.name}</span><span class="choice-check">✓</span>
    </label>`;
  }).join("");
  target.querySelectorAll(".choice-card").forEach((card) => card.addEventListener("change", () => {
    const checked = card.querySelector("input").checked;
    card.classList.toggle("selected", checked);
    checked ? onboarding.selectedSports.add(card.dataset.sportId) : onboarding.selectedSports.delete(card.dataset.sportId);
    updateSportCount();
  }));
  updateSportCount();
}

function updateSportCount() {
  const count = onboarding.selectedSports.size;
  document.querySelector(".selection-hint").innerHTML = `<strong id="sportCount">${count}</strong> discipline${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""} · Tu pourras modifier cette liste plus tard.`;
}

function restoreAnswers() {
  const answers = onboarding.progress?.answers || {};
  const values = {
    experience: answers.experience,
    weeklyHours: answers.weekly_hours_range,
    objective: answers.objective,
    watch: answers.watch,
  };
  Object.entries(values).forEach(([name, value]) => {
    const input = value && form.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
  });
  (answers.events || []).forEach((value) => {
    const input = form.querySelector(`input[name="events"][value="${value}"]`);
    if (input) input.checked = true;
  });
}

function populateIdentity() {
  const profile = onboarding.progress?.answers?.identity || {};
  const displayParts = String(onboarding.passport?.display_name || "").split(" ");
  form.firstName.value = profile.first_name || displayParts.shift() || "";
  form.lastName.value = profile.last_name || displayParts.join(" ") || "";
  form.birthDate.value = onboarding.passport?.birth_date || "";
  form.sex.value = onboarding.passport?.sex || "";
  form.city.value = onboarding.passport?.city || "";
  form.country.value = onboarding.passport?.country || "";
  onboarding.avatarUrl = onboarding.passport?.avatar_url || null;
  renderAvatarPreview();
}

function renderAvatarPreview(localUrl) {
  const preview = document.getElementById("avatarPreview");
  const source = localUrl || onboarding.avatarUrl;
  preview.replaceChildren();
  if (!source) {
    preview.textContent = "+";
    return;
  }
  const image = document.createElement("img");
  image.src = source;
  image.alt = "Aperçu de la photo";
  preview.append(image);
}

async function uploadAvatar() {
  const file = form.avatarFile.files[0];
  if (!file) return onboarding.avatarUrl;
  if (file.size > 5 * 1024 * 1024) throw new Error("La photo doit peser moins de 5 Mo.");
  const supportedTypes = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const extension = supportedTypes[file.type];
  if (!extension) throw new Error("Choisis une photo JPG, PNG ou WebP.");
  const path = `${onboarding.user.id}/passport-${Date.now()}.${extension}`;
  const { error } = await momentumDB.storage.from("avatars").upload(path, file, { contentType: file.type, cacheControl: "3600" });
  if (error) throw error;
  onboarding.avatarUrl = momentumDB.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  return onboarding.avatarUrl;
}

async function saveProgress(nextStep, answers = answerSnapshot()) {
  const payload = { user_id: onboarding.user.id, current_step: nextStep, answers, updated_at: new Date().toISOString() };
  const { data, error } = await momentumDB.from("onboarding_progress").upsert(payload, { onConflict: "user_id" }).select().single();
  if (error) throw error;
  onboarding.progress = data;
}

function validateIdentity() {
  const required = [form.firstName, form.birthDate, form.sex, form.city, form.country];
  const today = new Date().toISOString().slice(0, 10);
  required.forEach((input) => input.setAttribute("aria-invalid", String(!input.value.trim())));
  if (form.birthDate.value > today) form.birthDate.setAttribute("aria-invalid", "true");
  return required.every((input) => input.value.trim()) && form.birthDate.value <= today;
}

async function saveIdentity() {
  if (!validateIdentity()) throw new Error("Complète les repères essentiels pour continuer.");
  const avatarUrl = await uploadAvatar();
  const firstName = form.firstName.value.trim();
  const lastName = form.lastName.value.trim();
  const displayName = [firstName, lastName].filter(Boolean).join(" ");
  const birthDate = form.birthDate.value;
  const now = new Date().toISOString();
  const answers = { ...answerSnapshot(), identity: { first_name: firstName, last_name: lastName } };
  const results = await Promise.all([
    momentumDB.from("passports").update({ display_name: displayName, birth_date: birthDate, birth_year: Number(birthDate.slice(0, 4)), sex: form.sex.value, city: form.city.value.trim(), country: form.country.value.trim(), avatar_url: avatarUrl, updated_at: now }).eq("user_id", onboarding.user.id),
    momentumDB.from("profiles").upsert({ id: onboarding.user.id, email: onboarding.user.email, first_name: firstName, last_name: lastName || null, display_name: displayName, avatar_url: avatarUrl, updated_at: now }, { onConflict: "id" }),
    momentumDB.from("user_locations").upsert({ user_id: onboarding.user.id, city: form.city.value.trim(), country: form.country.value.trim(), updated_at: now }, { onConflict: "user_id" }),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
  onboarding.passport = { ...onboarding.passport, display_name: displayName, avatar_url: avatarUrl, birth_date: birthDate, sex: form.sex.value, city: form.city.value.trim(), country: form.country.value.trim() };
  await saveProgress(2, answers);
}

async function saveSports() {
  if (!onboarding.selectedSports.size) throw new Error("Choisis au moins un terrain d'aventure.");
  const rows = [...onboarding.selectedSports].map((sportId, index) => ({ user_id: onboarding.user.id, sport_id: sportId, role: index === 0 ? "Principal" : "Secondaire", active: true }));
  const { error: upsertError } = await momentumDB.from("user_sports").upsert(rows, { onConflict: "user_id,sport_id" });
  if (upsertError) throw upsertError;
  const removedSportIds = [...onboarding.savedSportIds].filter((sportId) => !onboarding.selectedSports.has(sportId));
  if (removedSportIds.length) {
    const { error: deleteError } = await momentumDB.from("user_sports").delete().eq("user_id", onboarding.user.id).in("sport_id", removedSportIds);
    if (deleteError) throw deleteError;
  }
  onboarding.savedSportIds = new Set(onboarding.selectedSports);
  await saveProgress(3);
}

function validateLevel() {
  const missing = ["experience", "weeklyHours", "objective", "watch"].filter((name) => !selectedValue(name));
  if (missing.length || !selectedValues("events").length) throw new Error("Réponds à chaque repère pour obtenir une estimation cohérente.");
}

function calculateEstimate() {
  const experience = selectedValue("experience");
  const hours = weeklyHoursValue(selectedValue("weeklyHours"));
  const level = experienceLevel(experience);
  const factor = ({ BEGINNER: .75, RETURNING: .85, REGULAR: 1, EXPERT: 1.25 })[level];
  const chronicLoad = Math.round(Math.max(12, Math.min(90, hours * 7 * factor)));
  const sports = onboarding.sports.filter((sport) => onboarding.selectedSports.has(sport.id));
  const primaryShare = sports.length === 1 ? 100 : Math.max(40, Math.floor(100 / sports.length));
  const secondaryBase = sports.length > 1 ? Math.floor((100 - primaryShare) / (sports.length - 1)) : 0;
  const secondaryRemainder = sports.length > 1 ? (100 - primaryShare) % (sports.length - 1) : 0;
  const distribution = Object.fromEntries(sports.map((sport, index) => [
    sport.name,
    index === 0 ? primaryShare : secondaryBase + (index <= secondaryRemainder ? 1 : 0),
  ]));
  return { chronic_load: chronicLoad, weekly_hours: hours, weekly_sessions: Math.max(2, Math.round(hours / 1.6)), experience_level: level, experience_label: experienceLabel(experience), primary_sport: sports[0]?.name || "Multi-sport", sport_distribution: distribution, objective: selectedValue("objective"), objective_label: objectiveLabel(selectedValue("objective")), confidence: 0, learning_days: 42 };
}

async function saveLevel() {
  validateLevel();
  const answers = answerSnapshot();
  const estimate = calculateEstimate();
  const watch = answers.watch;
  const connectedSources = watch && watch !== "NONE" ? { [watch]: false } : {};
  const objective = { primary: estimate.objective_label, code: estimate.objective };
  const now = new Date().toISOString();
  const results = await Promise.all([
    momentumDB.from("passports").update({ sport_level: estimate.experience_level, habits: { weekly_hours: estimate.weekly_hours, weekly_sessions: estimate.weekly_sessions, range: answers.weekly_hours_range }, objectives: objective, connected_sources: connectedSources, personalization: { ...(onboarding.passport?.personalization || {}), initial_estimate: estimate, onboarding_completed: false }, updated_at: now }).eq("user_id", onboarding.user.id),
    momentumDB.from("user_goals").upsert({ user_id: onboarding.user.id, primary_goal: estimate.objective, status: "INITIAL", updated_at: now }, { onConflict: "user_id" }),
    momentumDB.from("user_sport_preferences").upsert({ user_id: onboarding.user.id, experience_code: answers.experience, weekly_hours_range: answers.weekly_hours_range, events: answers.events, watch_provider: watch, updated_at: now }, { onConflict: "user_id" }),
    momentumDB.from("user_load_estimates").upsert({ user_id: onboarding.user.id, chronic_load: estimate.chronic_load, weekly_hours: estimate.weekly_hours, experience_level: estimate.experience_level, sport_distribution: estimate.sport_distribution, confidence: 0, source: "ONBOARDING", updated_at: now }, { onConflict: "user_id" }),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
  onboarding.estimate = estimate;
  onboarding.passport.personalization = { ...(onboarding.passport.personalization || {}), initial_estimate: estimate, onboarding_completed: false };
  await saveProgress(4, answers);
}

function renderEstimate() {
  onboarding.estimate = onboarding.estimate || onboarding.passport?.personalization?.initial_estimate || calculateEstimate();
  const estimate = onboarding.estimate;
  document.getElementById("estimatedLoad").textContent = estimate.chronic_load;
  document.getElementById("estimatedHours").textContent = `${estimate.weekly_hours} h / semaine`;
  document.getElementById("estimatedLevel").textContent = estimate.experience_label;
  document.getElementById("estimatedSport").textContent = estimate.primary_sport;
  document.getElementById("estimatedGoal").textContent = estimate.objective_label;
}

async function saveEstimate() {
  await saveProgress(5);
}

function renderWelcome() {
  const firstName = form.firstName.value.trim() || onboarding.passport?.display_name?.split(" ")[0] || "aventurier";
  const estimate = onboarding.estimate || onboarding.passport?.personalization?.initial_estimate;
  document.getElementById("welcomeName").textContent = `${firstName}.`;
  document.getElementById("welcomeSports").textContent = `${onboarding.selectedSports.size} terrain${onboarding.selectedSports.size > 1 ? "s" : ""} prêt${onboarding.selectedSports.size > 1 ? "s" : ""}`;
  document.getElementById("welcomeVolume").textContent = `${estimate?.weekly_hours || "—"} h / semaine`;
}

async function completeOnboarding() {
  const personalization = { ...(onboarding.passport?.personalization || {}), onboarding_completed: true, onboarding_completed_at: new Date().toISOString() };
  const [passportResult, progressResult] = await Promise.all([
    momentumDB.from("passports").update({ personalization, updated_at: new Date().toISOString() }).eq("user_id", onboarding.user.id),
    momentumDB.from("onboarding_progress").update({ completed_at: new Date().toISOString(), current_step: 5, updated_at: new Date().toISOString() }).eq("user_id", onboarding.user.id),
  ]);
  if (passportResult.error || progressResult.error) throw passportResult.error || progressResult.error;
  window.location.replace("index.html");
}

function showStep(step) {
  onboarding.currentStep = Math.max(1, Math.min(5, step));
  steps.forEach((section) => section.classList.toggle("active", Number(section.dataset.step) === onboarding.currentStep));
  const percentage = onboarding.currentStep * 20;
  document.getElementById("progressLabel").textContent = `Passeport · ${onboarding.currentStep} sur 5`;
  document.getElementById("progressPercent").textContent = `${percentage} %`;
  document.getElementById("progressBar").style.width = `${percentage}%`;
  previousButton.hidden = onboarding.currentStep === 1;
  nextButton.querySelector("span").textContent = onboarding.currentStep === 5 ? "Commencer" : onboarding.currentStep === 4 ? "Mon Passeport est prêt" : "Continuer";
  document.getElementById("storyLine").textContent = [
    "Quelques repères pour que Momentum te ressemble dès aujourd'hui.",
    "Tes disciplines dessinent les terrains sur lesquels ton histoire va s'écrire.",
    "Un rythme juste vaut mieux qu'un chiffre parfait. Les vraies données affineront tout.",
    "Une première esquisse, conçue pour disparaître à mesure que tu avances.",
    "Ton aventure possède maintenant un point de départ.",
  ][onboarding.currentStep - 1];
  if (onboarding.currentStep === 4) renderEstimate();
  if (onboarding.currentStep === 5) renderWelcome();
  setError();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function advance() {
  nextButton.disabled = true;
  setStatus("Sauvegarde en cours", "saving");
  try {
    if (onboarding.currentStep === 1) await saveIdentity();
    else if (onboarding.currentStep === 2) await saveSports();
    else if (onboarding.currentStep === 3) await saveLevel();
    else if (onboarding.currentStep === 4) await saveEstimate();
    else return await completeOnboarding();
    setStatus("Étape sauvegardée");
    showStep(onboarding.currentStep + 1);
  } catch (error) {
    console.error("ONBOARDING:", error);
    setError(window.MomentumUI.errorMessage(error, "save"));
    setStatus("Sauvegarde interrompue", "error");
  } finally {
    nextButton.disabled = false;
  }
}

async function initializeOnboarding() {
  renderChoiceSets();
  form.birthDate.max = new Date().toISOString().slice(0, 10);
  const { data: userData, error: userError } = await momentumDB.auth.getUser();
  if (userError || !userData.user) return window.location.replace("login.html");
  onboarding.user = userData.user;

  const [passportResult, progressResult, sportsResult, userSportsResult] = await Promise.all([
    momentumDB.from("passports").select("*").eq("user_id", onboarding.user.id).maybeSingle(),
    momentumDB.from("onboarding_progress").select("*").eq("user_id", onboarding.user.id).maybeSingle(),
    momentumDB.from("sports").select("id,name,order_index").order("order_index"),
    momentumDB.from("user_sports").select("sport_id").eq("user_id", onboarding.user.id),
  ]);
  if (passportResult.error || progressResult.error || sportsResult.error || userSportsResult.error) {
    setError("Ton Passeport n'a pas pu être ouvert. Recharge la page dans un instant.");
    setStatus("Connexion interrompue", "error");
    return;
  }
  onboarding.passport = passportResult.data || { personalization: {} };
  if (onboarding.passport.personalization?.onboarding_completed) return window.location.replace("index.html");
  onboarding.progress = progressResult.data || { answers: {}, current_step: 1 };
  onboarding.sports = sportsResult.data || [];
  const savedSportIds = userSportsResult.data?.map((item) => item.sport_id) || onboarding.progress.answers?.sport_ids || [];
  onboarding.selectedSports = new Set(savedSportIds);
  onboarding.savedSportIds = new Set(savedSportIds);
  populateIdentity();
  renderSports();
  restoreAnswers();
  showStep(onboarding.progress.current_step || 1);
}

form.addEventListener("submit", (event) => { event.preventDefault(); advance(); });
previousButton.addEventListener("click", () => showStep(onboarding.currentStep - 1));
form.avatarFile.addEventListener("change", () => {
  const file = form.avatarFile.files[0];
  if (file) renderAvatarPreview(URL.createObjectURL(file));
});
document.getElementById("onboardingLogout").addEventListener("click", async () => { await momentumDB.auth.signOut(); window.location.replace("login.html"); });

initializeOnboarding();
