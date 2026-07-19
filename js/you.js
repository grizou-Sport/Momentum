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
  pendingAvatarBlob: null,
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
    settingsResult,
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

    window.momentumDB
      .from("user_settings")
      .select("*")
      .eq("user_id", YOU.currentUser.id)
      .maybeSingle(),
  ]);

  YOU.loadErrors = {
    about: passportResult.error || null,
    sports: userSportsResult.error || activitiesResult.error || null,
    equipment: equipmentCategoriesResult.error || userEquipmentResult.error || null,
    wellbeing: wellbeingResult.error || null,
    account: settingsResult.error || null,
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
  if (!settingsResult.error) YOU.userSettings = settingsResult.data || null;
  YOU.loading = false;

  renderPassportCard();
  renderMenuPreviews();
  const requestedSection = new URLSearchParams(window.location.search).get("section");
  renderSection(["mission", "sports", "wellbeing", "equipment", "about", "account"].includes(requestedSection) ? requestedSection : "mission");
}

YOU.buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const section = button.dataset.youSection;
    renderSection(section);
    window.history.replaceState({}, "", `you.html?section=${section}`);
    window.MomentumNavigation?.setSubsection(section);
  });
});

YOU.detail?.addEventListener("click", async (event) => {
  if (event.target.closest("[data-account-logout]")) {
    await window.momentumDB.auth.signOut({ scope:"local" });
    window.location.href = "login.html";
  }

  if (event.target.closest("[data-account-export]")) exportAccountData();
});

loadYou();

function renderAccount() {
  const settings = YOU.userSettings || {};
  const notifications = settings.notifications || {};
  const sources = YOU.passport?.connected_sources || {};
  const connectionNames = ["COROS", "Garmin", "Strava"];

  YOU.detail.innerHTML = `
    <p class="section-kicker">Mon compte</p>
    <h2>À ta façon</h2>
    <p class="you-detail-lead">Tes préférences, tes connexions et tes données sont réunies ici.</p>

    <form id="accountForm" class="you-account-form">
      <section class="you-account-section">
        <div><span class="you-kicker">Notifications</span><h3>Rester dans le mouvement</h3></div>
        <label class="you-account-toggle"><span>Notifications par e-mail</span><input name="notification_email" type="checkbox" ${notifications.email !== false ? "checked" : ""}></label>
        <label class="you-account-toggle"><span>Notifications push</span><input name="notification_push" type="checkbox" ${notifications.push !== false ? "checked" : ""}></label>
        <label class="you-account-toggle"><span>Rappels d’aventure</span><input name="adventure_reminders" type="checkbox" ${notifications.adventure_reminders !== false ? "checked" : ""}></label>
      </section>

      <section class="you-account-section">
        <div><span class="you-kicker">Paramètres</span><h3>Langue & unités</h3></div>
        <label>Langue<select name="language"><option value="fr" ${settings.language === "fr" ? "selected" : ""}>Français</option><option value="en" ${settings.language === "en" ? "selected" : ""}>English</option></select></label>
        <label>Unités<select name="units"><option value="METRIC" ${settings.units !== "IMPERIAL" ? "selected" : ""}>Kilomètres</option><option value="IMPERIAL" ${settings.units === "IMPERIAL" ? "selected" : ""}>Miles</option></select></label>
      </section>

      <section class="you-account-section">
        <div><span class="you-kicker">Connexions</span><h3>Services sportifs</h3></div>
        ${connectionNames.map((name) => `<label class="you-account-toggle"><span>${name}</span><input name="connection_${name.toLowerCase()}" type="checkbox" ${sources[name] || sources[name.toLowerCase()] ? "checked" : ""}></label>`).join("")}
      </section>

      <section class="you-account-section you-account-links">
        <div><span class="you-kicker">Confidentialité</span><h3>Tes données</h3></div>
        <a href="confidentialite.html">Lire la politique de confidentialité</a>
        <button type="button" data-account-export>Exporter mes données</button>
      </section>

      <div class="you-account-actions">
        <button class="login-primary" type="submit">Enregistrer les paramètres</button>
        <p id="accountMessage" class="login-message"></p>
      </div>
    </form>

    <section class="you-account-danger">
      <div><span class="you-kicker">Session</span><h3>Déconnexion</h3></div>
      <button class="secondary" type="button" data-account-logout>Se déconnecter</button>
    </section>`;

  document.getElementById("accountForm")?.addEventListener("submit", saveAccount);
}

async function saveAccount(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const message = document.getElementById("accountMessage");
  message.textContent = "Sauvegarde…";

  const notifications = {
    email:form.has("notification_email"),
    push:form.has("notification_push"),
    adventure_reminders:form.has("adventure_reminders")
  };
  const connectedSources = {
    ...(YOU.passport?.connected_sources || {}),
    COROS:form.has("connection_coros"),
    Garmin:form.has("connection_garmin"),
    Strava:form.has("connection_strava")
  };

  try {
    const [{ data:settings, error:settingsError }, { data:passport, error:passportError }] = await Promise.all([
      window.momentumDB.from("user_settings").upsert({
        user_id:YOU.currentUser.id,
        language:form.get("language") || "fr",
        units:form.get("units") || "METRIC",
        notifications,
        updated_at:new Date().toISOString()
      }, { onConflict:"user_id" }).select().single(),
      window.momentumDB.from("passports").update({ connected_sources:connectedSources, updated_at:new Date().toISOString() }).eq("user_id", YOU.currentUser.id).select().single()
    ]);
    if (settingsError) throw settingsError;
    if (passportError) throw passportError;
    YOU.userSettings = settings;
    YOU.passport = passport;
    message.textContent = "Paramètres enregistrés.";
  } catch (error) {
    console.error("YOU : sauvegarde du compte interrompue.", error);
    message.textContent = window.MomentumUI.errorMessage(error, "save");
  }
}

function exportAccountData() {
  const data = {
    exported_at:new Date().toISOString(),
    profile:YOU.passport,
    settings:YOU.userSettings,
    sports:YOU.userSports,
    activities:YOU.activities,
    equipment:YOU.userEquipment,
    wellbeing:YOU.wellbeingProfile
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type:"application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `momentum-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
