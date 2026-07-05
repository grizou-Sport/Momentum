const youDetail = document.getElementById("youDetail");
const youButtons = document.querySelectorAll("[data-you-section]");
const logoutBtn = document.getElementById("logoutBtn");

let currentUser = null;
let passport = null;

function calculateAge(birthYear) {
  if (!birthYear) return "—";
  return `${new Date().getFullYear() - birthYear} ans`;
}

function safe(value, fallback = "—") {
  return value || fallback;
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
    mission: passport?.mission_name || "Mission à définir",
    sports: "Course · Vélo · Trail",
    equipment: "Montre · Chaussures · Vélo",
    wellbeing: `${passport?.weight_kg || "—"} kg · ${passport?.height_cm || "—"} cm`,
    data: "Import FIT / GPX bientôt",
    collections: "Souvenirs sportifs",
    about: passport?.display_name || "Ton identité",
  };

  youButtons.forEach((button) => {
    const section = button.dataset.youSection;
    const strong = button.querySelector("strong");

    if (strong && !button.querySelector("small")) {
      const small = document.createElement("small");
      small.textContent = previews[section] || "";
      strong.after(small);
    } else if (button.querySelector("small")) {
      button.querySelector("small").textContent = previews[section] || "";
    }
  });
}

async function loadYou() {
  const { data } = await window.momentumDB.auth.getSession();
  currentUser = data.session?.user;

  if (!currentUser) return;

  const { data: passportData, error } = await window.momentumDB
    .from("passports")
    .select("*")
    .eq("user_id", currentUser.id)
    .single();

  if (error) {
    console.error(error);
    return;
  }

  passport = passportData;
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

  if (section === "about") return renderAbout();
  if (section === "mission") return renderMission();
  if (section === "sports") return renderSports();
  if (section === "equipment") return renderEquipment();
  if (section === "wellbeing") return renderWellbeing();
  if (section === "data") return renderData();
  if (section === "collections") return renderCollections();
}

function renderMission() {
  youDetail.innerHTML = `
    <p class="section-kicker">Mission actuelle</p>
    <h2>${safe(passport?.mission_name, "Mission à définir")}</h2>
    <p class="you-detail-lead">
      L’objectif qui donne une direction à ton entraînement.
    </p>

    <div class="you-progress-line">
      <i style="width:${passport?.mission_progress || 12}%"></i>
    </div>

    <div class="you-detail-stats">
      <div><span>Objectif</span><strong>${safe(passport?.mission_goal, "À définir")}</strong></div>
      <div><span>Échéance</span><strong>${safe(passport?.mission_date, "Libre")}</strong></div>
      <div><span>Progression</span><strong>${passport?.mission_progress || 12} %</strong></div>
      <div><span>Statut</span><strong>En construction</strong></div>
    </div>

    <div class="you-note-box">
      <span>Lecture Momentum</span>
      <p>${safe(passport?.quote, "La mission n’est pas encore écrite, mais le passeport existe déjà.")}</p>
    </div>
  `;
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
    <p class="you-detail-lead">Bientôt, tes fichiers FIT / GPX alimenteront ton récit.</p>

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
        <input id="avatarFile" name="avatar_file" type="file" accept="image/*" />
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