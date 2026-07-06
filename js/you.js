const YOU = {
  detail: document.getElementById("youDetail"),
  buttons: document.querySelectorAll("[data-you-section]"),
  logoutBtn: document.getElementById("logoutBtn"),

  currentUser: null,
  passport: null,
  currentMission: null,
  userSports: [],
  equipmentCategories: [],
  userEquipment: [],
  wellbeingProfile: null,
};

function safe(value, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function calculateAge(birthYear) {
  if (!birthYear) return "—";
  return `${new Date().getFullYear() - Number(birthYear)} ans`;
}

function setActiveSection(section) {
  YOU.buttons.forEach((button) => button.classList.remove("active"));
  document.querySelector(`[data-you-section="${section}"]`)?.classList.add("active");
}

function renderSection(section) {
  setActiveSection(section);

  if (section === "mission") return renderMission();
  if (section === "sports") return renderSports();
  if (section === "wellbeing") return renderWellbeing();
  if (section === "equipment") return renderEquipment();
  if (section === "data") return renderActivities();
  if (section === "about") return renderAbout();
}

function renderMenuPreviews() {
  const activeSports = YOU.userSports
    .filter((item) => item.active !== false)
    .map((item) => item.sports?.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");

  const activeEquipment = YOU.userEquipment
    .filter((item) => item.active !== false)
    .map((item) => item.nickname || item.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");

  const previews = {
    mission: YOU.currentMission?.title || "Aucun objectif",
    sports: activeSports || "Apparaîtra avec tes activités",
    wellbeing: `${YOU.passport?.weight_kg || "—"} kg · VO₂ ${YOU.wellbeingProfile?.vo2max || "—"}`,
    equipment: activeEquipment || "Ajouter ton matériel",
    data: "FIT / GPX / export",
    about: YOU.passport?.display_name || "Ton passeport",
  };

  const labels = {
    mission: "En ligne de mire",
    sports: "Je vis pour",
    wellbeing: "Mon équilibre",
    equipment: "Mon matériel",
    data: "Mes activités",
    about: "Passeport",
  };

  YOU.buttons.forEach((button) => {
    const section = button.dataset.youSection;
    const span = button.querySelector("span");
    const strong = button.querySelector("strong");

    if (span) span.textContent = labels[section] || section;
    if (strong) strong.textContent = previews[section] || "";
  });
}

async function loadYou() {
  const { data } = await window.momentumDB.auth.getSession();
  YOU.currentUser = data.session?.user;

  if (!YOU.currentUser) {
    window.location.href = "login.html";
    return;
  }

  const [
    passportResult,
    missionResult,
    userSportsResult,
    equipmentCategoriesResult,
    userEquipmentResult,
    wellbeingResult,
  ] = await Promise.all([
    window.momentumDB.from("passports").select("*").eq("user_id", YOU.currentUser.id).single(),

    window.momentumDB
      .from("missions")
      .select("*")
      .eq("user_id", YOU.currentUser.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    window.momentumDB
      .from("user_sports")
      .select("*, sports(*)")
      .eq("user_id", YOU.currentUser.id),

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

  if (passportResult.error) {
    console.error(passportResult.error);
    return;
  }

  YOU.passport = passportResult.data;
  YOU.currentMission = missionResult.data || null;
  YOU.userSports = userSportsResult.data || [];
  YOU.equipmentCategories = equipmentCategoriesResult.data || [];
  YOU.userEquipment = userEquipmentResult.data || [];
  YOU.wellbeingProfile = wellbeingResult.data || null;

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