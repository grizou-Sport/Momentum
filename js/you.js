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
};

function safe(value, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function calculateAge(birthYear) {
  if (!birthYear) return "—";
  return `${new Date().getFullYear() - Number(birthYear)} ans`;
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

  setText("sportsMenuSummary", activeSports || "Apparaîtra avec tes activités");
  setText(
    "wellbeingMenuSummary",
    `${YOU.passport?.weight_kg || "—"} kg · VO₂ ${YOU.wellbeingProfile?.vo2max || "—"}`
  );
  setText("equipmentMenuSummary", activeEquipment || "Ajouter ton matériel");
  setText("passportMenuName", YOU.passport?.display_name || "Ton passeport");
}

async function loadYou() {
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

  if (passportResult.error) {
    console.error("Erreur passeport:", passportResult.error);
    return;
  }

  if (userSportsResult.error) {
    console.error("Erreur sports:", userSportsResult.error);
  }

  if (activitiesResult.error) {
    console.error("Erreur activités pour le profil sportif:", activitiesResult.error);
  }

  if (equipmentCategoriesResult.error) {
    console.error("Erreur catégories matériel:", equipmentCategoriesResult.error);
  }

  if (userEquipmentResult.error) {
    console.error("Erreur matériel utilisateur:", userEquipmentResult.error);
  }

  if (wellbeingResult.error) {
    console.error("Erreur wellbeing:", wellbeingResult.error);
  }

  YOU.passport = passportResult.data;
  YOU.userSports = userSportsResult.data || [];
  YOU.activities = activitiesResult.data || [];
  YOU.sportProfile = window.MomentumSportProfile?.build(YOU.userSports, YOU.activities) || [];
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

setTimeout(() => {
  console.log("===== DEBUG MOMENTUM YOU =====");

  console.log("window.momentumDB =", window.momentumDB);
  console.log("window.supabaseClient =", window.supabaseClient);

  console.log("YOU =", YOU);

  console.log("Fonctions disponibles :");
  console.log("loadMission =", typeof loadMission);
  console.log("renderMission =", typeof renderMission);
  console.log("renderPassportCard =", typeof renderPassportCard);
  console.log("renderSports =", typeof renderSports);
  console.log("renderWellbeing =", typeof renderWellbeing);
  console.log("renderEquipment =", typeof renderEquipment);
  console.log("renderAbout =", typeof renderAbout);

  console.log("Éléments HTML :");
  console.log("youDetail =", document.getElementById("youDetail"));
  console.log("missionMenuTitle =", document.getElementById("missionMenuTitle"));
}, 1500);
