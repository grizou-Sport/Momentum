// js/you.js

const YOU = {
  detail: document.getElementById("youDetail"),
  buttons: document.querySelectorAll("[data-you-section]"),
  logoutBtn: document.getElementById("logoutBtn"),

  currentUser: null,
  passport: null,
  userSports: [],
  activities: [],
  sportProfile: [],
  equipmentCategories: [],
  userEquipment: [],
  wellbeingProfile: null,
  loadErrors: {},
  loading: true,
};

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
  setActiveSection(section);

  if (YOU.loadErrors[section]) return renderYouSectionError(section);

  if (section === "mission") return loadMission();
  if (section === "sports") return renderSports();
  if (section === "wellbeing") return renderWellbeing();
  if (section === "equipment") return renderEquipment();
  if (section === "about") return renderAbout();
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
    `${YOU.passport?.weight_kg || "—"} kg · VO₂ ${YOU.wellbeingProfile?.vo2max || "—"}`
  );
  setText("equipmentMenuSummary", activeEquipment || "Ajouter ton matériel");
  setText("passportMenuName", YOU.passport?.display_name || "Ton passeport");
}

async function loadYou() {
  YOU.loading = true;
  if (YOU.detail && !YOU.passport) YOU.detail.innerHTML = '<div class="you-note-box" role="status"><span>Chargement</span><p>Ton histoire se prépare…</p></div>';
  const { data, error } = await window.momentumDB.auth.getSession();

  if (error) {
    console.error("Erreur session:", error);
    window.location.href = "login.html";
    return;
  }

  YOU.currentUser = data.session?.user;

  if (!YOU.currentUser) {
    window.location.href = "login.html";
    return;
  }

  const [
    passportResult,
    userSportsResult,
    activitiesResult,
    equipmentCategoriesResult,
    userEquipmentResult,
    wellbeingResult,
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

    window.momentumDB
      .from("activities")
      .select("sport,activity_type,activity_date,status")
      .eq("user_id", YOU.currentUser.id)
      .gte("activity_date", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order("activity_date", { ascending: false }),

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
  ]);

  YOU.loadErrors = {
    about: passportResult.error || null,
    sports: userSportsResult.error || activitiesResult.error || null,
    equipment: equipmentCategoriesResult.error || userEquipmentResult.error || null,
    wellbeing: wellbeingResult.error || null,
  };
  Object.entries(YOU.loadErrors).forEach(([section, sectionError]) => {
    if (sectionError) console.error(`YOU : chargement ${section} interrompu.`, sectionError);
  });

  if (!passportResult.error) YOU.passport = passportResult.data;
  if (!userSportsResult.error) YOU.userSports = userSportsResult.data || [];
  if (!activitiesResult.error) YOU.activities = activitiesResult.data || [];
  YOU.sportProfile = window.MomentumSportProfile?.build(YOU.userSports, YOU.activities) || [];
  if (!equipmentCategoriesResult.error) YOU.equipmentCategories = equipmentCategoriesResult.data || [];
  if (!userEquipmentResult.error) YOU.userEquipment = userEquipmentResult.data || [];
  if (!wellbeingResult.error) YOU.wellbeingProfile = wellbeingResult.data || null;
  YOU.loading = false;

  renderPassportCard();
  renderMenuPreviews();
  renderSection("mission");
}

YOU.buttons.forEach((button) => {
  button.addEventListener("click", () => {
    renderSection(button.dataset.youSection);
  });
});

YOU.logoutBtn?.addEventListener("click", async () => {
  await window.momentumDB.auth.signOut();
  window.location.href = "login.html";
});

loadYou();
