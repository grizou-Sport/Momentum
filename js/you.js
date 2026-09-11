// js/you.js

const YOU = {
  detail: document.getElementById("youDetail"),
  buttons: document.querySelectorAll("[data-you-section]"),

  currentUser: null,
  passport: null,
  userSports: [],
  activities: [],
  sportProfile: [],
  equipmentCategories: [],
  userEquipment: [],
  wellbeingProfile: null,
  userSettings: null,
  userLocation: null,
  pendingAvatarBlob: null,
  loadErrors: {},
  loading: true,
  loadGeneration: 0,
  activeSection: "overview",
  memories: [],
  media: [],
};

function escapeHTML(value) { return window.MomentumUI.escapeText(value); }

function safe(value, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function calculateAge(birthDate, legacyBirthYear = null, today = new Date()) {
  const value = birthDate || (legacyBirthYear ? `${legacyBirthYear}-01-01` : "");
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "—";
  const [, year, month, day] = match.map(Number);
  let age = today.getFullYear() - year;
  const birthdayPassed = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayPassed) age -= 1;
  return age >= 0 ? `${age} ans` : "—";
}

function renderYouSectionError(section) {
  const labels = { sports:"les pratiques", equipment:"le matériel", wellbeing:"le bien-être", about:"le Passeport" };
  YOU.detail.innerHTML = `<div class="you-note-box" role="alert"><span>Chargement interrompu</span><p>Impossible de charger ${labels[section] || "cette section"} pour le moment.</p><button class="primary" type="button" data-you-retry>Réessayer</button></div>`;
  YOU.detail.querySelector("[data-you-retry]")?.addEventListener("click", loadYou);
}

function setText(id, value, fallback = "—") {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = safe(value, fallback);
}

function setActiveSection(section) {
  YOU.buttons.forEach((button) => button.classList.remove("active"));

  document
    .querySelector(`[data-you-section="${section}"]`)
    ?.classList.add("active");
}

function renderSection(section) {
  YOU.activeSection = section;
  setActiveSection(section);

  if (YOU.loadErrors[section]) return renderYouSectionError(section);

  if (section === "overview") return renderPersonalOverview();
  if (section === "path") return renderPersonalPath();
  if (section === "mission") return renderPersonalHorizon();
  if (section === "sports") return renderSports();
  if (section === "wellbeing") return renderWellbeing();
  if (section === "equipment") return renderEquipment();
  if (section === "about") return renderAbout();
  if (section === "account") return renderAccount();
}

function renderMenuPreviews() {
  const activeSports = YOU.sportProfile
    .map((item) => item.label)
    .slice(0, 3)
    .join(" · ");

  const activeEquipment = YOU.userEquipment
    .filter((item) => item.active !== false)
    .map((item) => item.nickname || item.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");

  setText("sportsMenuSummary", activeSports || "Tes pratiques apparaîtront ici");
  setText(
    "wellbeingMenuSummary",
    "Tes repères personnels, facultatifs"
  );
  setText("equipmentMenuSummary", activeEquipment || "Ajouter ton matériel");
  setText("missionMenuTitle", YOU.passport?.personalization?.open_intention || "Tes intentions et objectifs");
  setText("passportMenuName", YOU.passport?.display_name || "Ton passeport");
}

async function loadYou() {
  YOU.loading = true;
  if (YOU.detail && !YOU.passport) YOU.detail.innerHTML = '<div class="you-note-box" role="status"><span>Chargement</span><p>Ton histoire se prépare…</p></div>';
  YOU.currentUser = await window.momentumPageReady;
  const generation = ++YOU.loadGeneration;
  if (!YOU.currentUser) return;
  const settle = promise => Promise.resolve(promise).catch(() => ({data:null,error:{code:'LOAD_FAILED'}}));

  const [
    passportResult,
    userSportsResult,
    activitiesResult,
    equipmentCategoriesResult,
    userEquipmentResult,
    wellbeingResult,
    settingsResult,
    locationResult,
    memoriesResult,
    mediaResult,
  ] = await Promise.all([
    window.momentumDB
      .from("passports")
      .select("*")
      .eq("user_id", YOU.currentUser.id)
      .single(),

    window.momentumDB
      .from("user_sports")
      .select("*, sports(*)")
      .eq("user_id", YOU.currentUser.id),

    window.MomentumData.history(YOU.currentUser.id, {refresh:true}),

    window.momentumDB
      .from("equipment_categories")
      .select("*")
      .order("order_index", { ascending: true }),

    window.momentumDB
      .from("user_equipment")
      .select("*, equipment_categories(*)")
      .eq("user_id", YOU.currentUser.id)
      .order("created_at", { ascending: false }),

    window.momentumDB
      .from("wellbeing_profile")
      .select("*")
      .eq("user_id", YOU.currentUser.id)
      .maybeSingle(),

    window.momentumDB
      .from("user_settings")
      .select("*")
      .eq("user_id", YOU.currentUser.id)
      .maybeSingle(),

    window.momentumDB
      .from("user_locations")
      .select("city,country,latitude,longitude,timezone")
      .eq("user_id", YOU.currentUser.id)
      .maybeSingle(),
    window.MomentumData.all(() => window.momentumDB.from("activity_flow_assessments").select("id,activity_id,retained_memory", {count:"exact"}).eq("user_id",YOU.currentUser.id).order("id")),
    window.MomentumData.all(() => window.momentumDB.from("activity_media").select("id,activity_id,file_path", {count:"exact"}).eq("user_id",YOU.currentUser.id).order("id")),
  ].map(settle));
  if (generation !== YOU.loadGeneration || !YOU.currentUser) return;

  YOU.loadErrors = {
    overview: passportResult.error || userSportsResult.error || activitiesResult.error || memoriesResult.error || null,
    path: activitiesResult.error || memoriesResult.error || mediaResult.error || null,
    mission: passportResult.error || null,
    about: passportResult.error || locationResult.error || null,
    sports: userSportsResult.error || activitiesResult.error || null,
    equipment: equipmentCategoriesResult.error || userEquipmentResult.error || null,
    wellbeing: wellbeingResult.error || null,
    account: settingsResult.error || null,
  };
  Object.entries(YOU.loadErrors).forEach(([section, sectionError]) => {
    if (sectionError) console.warn(`YOU : chargement ${section} interrompu.`);
  });

  if (!passportResult.error) YOU.passport = passportResult.data;
  if (!userSportsResult.error) YOU.userSports = userSportsResult.data || [];
  if (!activitiesResult.error) YOU.activities = activitiesResult.data || [];
  YOU.sportProfile = window.MomentumSportProfile?.build(YOU.userSports, YOU.activities) || [];
  if (!equipmentCategoriesResult.error) YOU.equipmentCategories = equipmentCategoriesResult.data || [];
  if (!userEquipmentResult.error) YOU.userEquipment = userEquipmentResult.data || [];
  if (!wellbeingResult.error) YOU.wellbeingProfile = wellbeingResult.data || null;
  if (!settingsResult.error) YOU.userSettings = settingsResult.data || null;
  if (!locationResult.error) YOU.userLocation = locationResult.data || null;
  if (!memoriesResult.error) YOU.memories = memoriesResult.data || [];
  if (!mediaResult.error) YOU.media = mediaResult.data || [];
  YOU.loading = false;

  renderPassportCard();
  renderMenuPreviews();
  const requestedSection = new URLSearchParams(window.location.search).get("section");
  renderSection(YOU_SECTIONS.includes(requestedSection) ? requestedSection : "overview");
}

const YOU_SECTIONS = ["overview", "path", "mission", "sports", "wellbeing", "equipment", "about", "account"];
function navigateYou(section, push = true) {
  if (!YOU_SECTIONS.includes(section)) return;
  if (push) window.history.pushState({}, "", `you.html?section=${section}`);
  renderSection(section);
  YOU.detail.tabIndex = -1; YOU.detail.focus();
  window.MomentumNavigation?.setSubsection(section);
}
YOU.buttons.forEach(button => button.addEventListener("click", () => navigateYou(button.dataset.youSection)));
window.addEventListener("popstate", () => navigateYou(new URLSearchParams(location.search).get("section") || "overview", false));
window.addEventListener("momentum:session-cleared", () => {
  YOU.loadGeneration++; YOU.currentUser = null; YOU.passport = null; YOU.activities = []; YOU.memories = []; YOU.media = [];
  YOU.userSports = []; YOU.sportProfile = []; YOU.userEquipment = []; YOU.userSettings = null; YOU.wellbeingProfile = null; YOU.userLocation = null; YOU.pendingAvatarBlob = null;
  YOU.detail?.replaceChildren();
  document.querySelectorAll("#passportAvatar, #passportName, #passportQuote, #passportLocation, #passportAge, #passportHeight, #passportWeight").forEach(node => node.replaceChildren());
});
loadYou();
