const youDetail = document.getElementById("youDetail");
const youButtons = document.querySelectorAll("[data-you-section]");
const logoutBtn = document.getElementById("logoutBtn");

let currentUser = null;
let passport = null;
let currentMission = null;

function calculateAge(birthYear) {
  if (!birthYear) return "—";
  return `${new Date().getFullYear() - Number(birthYear)} ans`;
}

function safe(value, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function renderPassportCard() {
  const name = passport?.display_name || currentUser?.email || "—";

  document.getElementById("passportName").textContent = name;
  document.getElementById("passportLocation").textContent =
    [passport?.city, passport?.country].filter(Boolean).join(", ") || "—";
  document.getElementById("passportQuote").textContent =
    `“${passport?.quote || "Écris la prochaine ligne."}”`;

  document.getElementById("passportAge").textContent = calculateAge(passport?.birth_year);
  document.getElementById("passportHeight").textContent =
    passport?.height_cm ? `${passport.height_cm} cm` : "—";
  document.getElementById("passportWeight").textContent =
    passport?.weight_kg ? `${passport.weight_kg} kg` : "—";

  const avatar = document.getElementById("passportAvatar");

  if (passport?.avatar_url) {
    avatar.innerHTML = `<img src="${passport.avatar_url}" alt="${name}" />`;
  } else {
    avatar.textContent = name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
}

function renderMenuPreviews() {
  const previews = {
    mission: currentMission?.title || "Mission à définir",
    sports: "Course · Vélo · Trail",
    equipment: "Montre · Chaussures · Vélo",
    wellbeing: `${passport?.weight_kg || "—"} kg · ${passport?.height_cm || "—"} cm`,
    data: "FIT / GPX / export",
    collections: "Souvenirs sportifs",
    about: passport?.display_name || "Ton identité",
  };

  youButtons.forEach((button) => {
    const section = button.dataset.youSection;
    const strong = button.querySelector("strong");
    if (!strong) return;

    let small = button.querySelector("small");

    if (!small) {
      small = document.createElement("small");
      strong.after(small);
    }

    small.textContent = previews[section] || "";
  });
}

async function loadYou() {
  const { data } = await window.momentumDB.auth.getSession();
  currentUser = data.session?.user;

  if (!currentUser) return;

  const { data: passportData, error: passportError } = await window.momentumDB
    .from("passports")
    .select("*")
    .eq("user_id", currentUser.id)
    .single();

  if (passportError) {
    console.error(passportError);
    return;
  }

  passport = passportData;

  const { data: missionData, error: missionError } = await window.momentumDB
    .from("missions")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (missionError) {
    console.error(missionError);
  }

  currentMission = missionData;

  renderPassportCard();
  renderMenuPreviews();
  renderSection("mission");
}

function setActiveSection(section) {
  youButtons.forEach((button) => button.classList.remove("active"));
  document.querySelector(`[data-you-section="${section}"]`)?.classList.add("active");
}

function renderSection(section) {
  setActiveSection(section);

  if (section === "mission") return renderMission();
  if (section === "sports") return renderSports();
  if (section === "equipment") return renderEquipment();
  if (section === "wellbeing") return renderWellbeing();
  if (section === "data") return renderData();
  if (section === "collections") return renderCollections();
  if (section === "about") return renderAbout();
}

function renderMission() {
  youDetail.innerHTML = `
    <p class="section-kicker">Mission actuelle</p>
    <h2>${safe(currentMission?.title, "Créer une mission")}</h2>
    <p class="you-detail-lead">
      ${safe(currentMission?.tagline, "L’objectif qui donne une direction à ton entraînement.")}
    </p>

    <div class="you-progress-line">
      <i style="width:${currentMission ? 22 : 8}%"></i>
    </div>

    <div class="you-detail-stats">
      <div><span>Objectif</span><strong>${safe(currentMission?.goal, "À définir")}</strong></div>
      <div><span>Date cible</span><strong>${safe(currentMission?.target_date, "Libre")}</strong></div>
      <div><span>Temps cible</span><strong>${safe(currentMission?.target_time, "—")}</strong></div>
      <div><span>Allure cible</span><strong>${safe(currentMission?.target_pace, "—")}</strong></div>
    </div>

    <div class="you-note-box">
      <span>Lecture Momentum</span>
      <p>
        ${
          currentMission
            ? "Cette mission devient le fil rouge de ton passeport."
            : "Aucune mission n’est encore enregistrée. Crée le premier objectif de ton aventure."
        }
      </p>
    </div>

    <button class="primary" id="editMissionBtn" type="button">
      ${currentMission ? "Modifier la mission" : "Créer une mission"}
    </button>
  `;

  document.getElementById("editMissionBtn").addEventListener("click", renderMissionForm);
}

function renderMissionForm() {
  youDetail.innerHTML = `
    <p class="section-kicker">Mission actuelle</p>
    <h2>${currentMission ? "Modifier la mission" : "Créer une mission"}</h2>

    <form id="missionForm" class="you-form">
      <label class="full">Titre de la mission
        <input name="title" value="${currentMission?.title || ""}" placeholder="100 km de Bienne" />
      </label>

      <label class="full">Objectif
        <input name="goal" value="${currentMission?.goal || ""}" placeholder="Terminer, sub 10h, sub 3h..." />
      </label>

      <label>Date cible
        <input name="target_date" type="date" value="${currentMission?.target_date || ""}" />
      </label>

      <label>Temps cible
        <input name="target_time" value="${currentMission?.target_time || ""}" placeholder="2h59'59" />
      </label>

      <label>Allure cible
        <input name="target_pace" value="${currentMission?.target_pace || ""}" placeholder="4'15/km" />
      </label>

      <label class="full">Phrase / intention
        <textarea name="tagline" rows="3">${currentMission?.tagline || ""}</textarea>
      </label>

      <button class="login-primary full" type="submit">Enregistrer la mission</button>
      <p id="missionMessage" class="login-message full"></p>
    </form>
  `;

  document.getElementById("missionForm").addEventListener("submit", saveMission);
}

async function saveMission(event) {
  event.preventDefault();

  const form = new FormData(event.target);
  const message = document.getElementById("missionMessage");

  message.textContent = "Sauvegarde…";

  const payload = {
    user_id: currentUser.id,
    title: form.get("title")?.trim(),
    goal: form.get("goal")?.trim(),
    target_date: form.get("target_date") || null,
    target_time: form.get("target_time")?.trim(),
    target_pace: form.get("target_pace")?.trim(),
    tagline: form.get("tagline")?.trim(),
  };

  let result;

  if (currentMission?.id) {
    result = await window.momentumDB
      .from("missions")
      .update(payload)
      .eq("id", currentMission.id)
      .select()
      .single();
  } else {
    result = await window.momentumDB
      .from("missions")
      .insert(payload)
      .select()
      .single();
  }

  if (result.error) {
    console.error(result.error);
    message.textContent = result.error.message;
    return;
  }

  currentMission = result.data;
  renderMenuPreviews();

  message.textContent = "Mission sauvegardée.";

  setTimeout(() => {
    renderMission();
  }, 700);
}

function renderSports() {
  youDetail.innerHTML = `
    <p class="section-kicker">Sports</p>
    <h2>Tes terrains d’expression</h2>
    <p class="you-detail-lead">Les sports qui construisent ton identité.</p>

    <div class="you-card-grid">
      <div class="you-small-card active"><span>🏃</span><strong>Course à pied</strong><em>Principal</em></div>
      <div class="you-small-card"><span>🚴</span><strong>Vélo</strong><em>Complément</em></div>
      <div class="you-small-card"><span>⛰️</span><strong>Trail</strong><em>Aventure</em></div>
      <div class="you-small-card"><span>🏋️</span><strong>Renforcement</strong><em>Structure</em></div>
    </div>
  `;
}

function renderEquipment() {
  youDetail.innerHTML = `
    <p class="section-kicker">Équipement</p>
    <h2>Ton matériel</h2>
    <p class="you-detail-lead">Les objets qui accompagnent le chemin.</p>

    <div class="you-card-grid">
      <div class="you-small-card"><span>⌚</span><strong>Montre</strong><em>COROS Apex 4</em></div>
      <div class="you-small-card"><span>👟</span><strong>Chaussures</strong><em>À compléter</em></div>
      <div class="you-small-card"><span>🚴</span><strong>Vélo</strong><em>À compléter</em></div>
      <div class="you-small-card"><span>🎒</span><strong>Accessoires</strong><em>À compléter</em></div>
    </div>
  `;
}

function renderWellbeing() {
  youDetail.innerHTML = `
    <p class="section-kicker">Bien-être</p>
    <h2>Ton état intérieur</h2>
    <p class="you-detail-lead">Le corps ne ment pas. Il donne le rythme.</p>

    <div class="you-detail-stats">
      <div><span>Âge</span><strong>${calculateAge(passport?.birth_year)}</strong></div>
      <div><span>Taille</span><strong>${passport?.height_cm ? passport.height_cm + " cm" : "—"}</strong></div>
      <div><span>Poids</span><strong>${passport?.weight_kg ? passport.weight_kg + " kg" : "—"}</strong></div>
      <div><span>FC max</span><strong>À compléter</strong></div>
    </div>
  `;
}

function renderData() {
  youDetail.innerHTML = `
    <p class="section-kicker">Données</p>
    <h2>Importer le réel</h2>
    <p class="you-detail-lead">Tes fichiers FIT / GPX alimenteront ton récit.</p>

    <div class="you-card-grid">
      <div class="you-small-card"><span>📥</span><strong>Importer FIT</strong><em>Bientôt</em></div>
      <div class="you-small-card"><span>🗺️</span><strong>Importer GPX</strong><em>Bientôt</em></div>
      <div class="you-small-card"><span>📤</span><strong>Exporter</strong><em>Bientôt</em></div>
      <div class="you-small-card"><span>🔗</span><strong>Synchroniser</strong><em>Plus tard</em></div>
    </div>
  `;
}

function renderCollections() {
  youDetail.innerHTML = `
    <p class="section-kicker">Collections</p>
    <h2>Les chapitres importants</h2>
    <p class="you-detail-lead">Pas des badges. Des souvenirs.</p>

    <div class="you-card-grid">
      <div class="you-small-card"><span>🌙</span><strong>Course de nuit</strong><em>À débloquer</em></div>
      <div class="you-small-card"><span>🏔️</span><strong>Premier sommet</strong><em>À débloquer</em></div>
      <div class="you-small-card"><span>🏁</span><strong>Premier marathon</strong><em>À débloquer</em></div>
      <div class="you-small-card"><span>🔥</span><strong>Retour difficile</strong><em>À débloquer</em></div>
    </div>
  `;
}

function renderAbout() {
  youDetail.innerHTML = `
    <p class="section-kicker">À propos de toi</p>
    <h2>Ton passeport</h2>

    <form id="passportForm" class="you-form">
      <label>Nom complet
        <input name="display_name" value="${passport?.display_name || ""}" />
      </label>

      <label>Ville
        <input name="city" value="${passport?.city || ""}" />
      </label>

      <label>Pays
        <input name="country" value="${passport?.country || ""}" />
      </label>

      <label>Année de naissance
        <input name="birth_year" type="number" value="${passport?.birth_year || ""}" />
      </label>

      <label>Taille cm
        <input name="height_cm" type="number" value="${passport?.height_cm || ""}" />
      </label>

      <label>Poids kg
        <input name="weight_kg" type="number" step="0.1" value="${passport?.weight_kg || ""}" />
      </label>

      <label class="full">Phrase
        <textarea name="quote" rows="3">${passport?.quote || ""}</textarea>
      </label>

      <label class="full">Photo de profil
        <input name="avatar_file" type="file" accept="image/*" />
      </label>

      <button class="login-primary full" type="submit">Enregistrer</button>
      <p id="passportMessage" class="login-message full"></p>
    </form>
  `;

  document.getElementById("passportForm").addEventListener("submit", savePassport);
}

async function uploadAvatar(file) {
  if (!file) return passport?.avatar_url || null;

  const fileExt = file.name.split(".").pop();
  const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
  const filePath = `${currentUser.id}/${fileName}`;

  const { error } = await window.momentumDB.storage
    .from("avatars")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) throw error;

  const { data } = window.momentumDB.storage
    .from("avatars")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function savePassport(event) {
  event.preventDefault();

  const form = new FormData(event.target);
  const message = document.getElementById("passportMessage");

  message.textContent = "Sauvegarde…";

  try {
    const avatarFile = form.get("avatar_file");

    const avatarUrl =
      avatarFile && avatarFile.size > 0
        ? await uploadAvatar(avatarFile)
        : passport?.avatar_url || null;

    const updates = {
      display_name: form.get("display_name")?.trim(),
      avatar_url: avatarUrl,
      city: form.get("city")?.trim(),
      country: form.get("country")?.trim(),
      quote: form.get("quote")?.trim(),
      birth_year: form.get("birth_year") ? Number(form.get("birth_year")) : null,
      height_cm: form.get("height_cm") ? Number(form.get("height_cm")) : null,
      weight_kg: form.get("weight_kg") ? Number(form.get("weight_kg")) : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await window.momentumDB
      .from("passports")
      .update(updates)
      .eq("user_id", currentUser.id)
      .select()
      .single();

    if (error) throw error;

    passport = data;

    renderPassportCard();
    renderMenuPreviews();

    message.textContent = "Sauvegardé.";

    setTimeout(() => {
      message.textContent = "";
    }, 1800);
  } catch (error) {
    console.error(error);
    message.textContent =
      error.message || "Impossible de sauvegarder pour le moment.";
  }
}

youButtons.forEach((button) => {
  button.addEventListener("click", () => {
    renderSection(button.dataset.youSection);
  });
});

logoutBtn?.addEventListener("click", async () => {
  await window.momentumDB.auth.signOut();
  window.location.href = "login.html";
});

loadYou();
