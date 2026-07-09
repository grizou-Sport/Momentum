// js/you-mission.js

let currentMission = null;

const MISSION_CATEGORIES = [
  { value: "health", label: "Santé", icon: "❤️" },
  { value: "competition", label: "Compétition", icon: "🏁" },
  { value: "pleasure", label: "Plaisir", icon: "🌿" },
  { value: "adventure", label: "Aventure", icon: "🧭" },
];

const MISSION_INTENTIONS = [
  { value: "discovery", label: "Découverte" },
  { value: "challenge", label: "Challenge" },
  { value: "progression", label: "Progression" },
  { value: "performance", label: "Performance" },
  { value: "transformation", label: "Transformation" },
  { value: "sharing", label: "Partage" },
  { value: "wellbeing", label: "Bien-être" },
  { value: "escape", label: "Évasion" },
];

const MISSION_SPORTS = [
  "Course à pied",
  "Trail",
  "Vélo",
  "Gravel",
  "Natation",
  "Padel",
  "Randonnée",
  "Ski",
  "Autre",
];

function getMissionLabel(list, value) {
  return list.find((item) => item.value === value)?.label || value || "";
}

function getMissionIcon(value) {
  return MISSION_CATEGORIES.find((item) => item.value === value)?.icon || "";
}

function getOptionList(options, selectedValue = "") {
  return options
    .map((option) => `
      <option value="${option.value}" ${option.value === selectedValue ? "selected" : ""}>
        ${option.icon ? `${option.icon} ` : ""}${option.label}
      </option>
    `)
    .join("");
}

function getTextOptionList(options, selectedValue = "") {
  return options
    .map((option) => `
      <option value="${option}" ${option === selectedValue ? "selected" : ""}>
        ${option}
      </option>
    `)
    .join("");
}

function formatMissionDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue + "T00:00:00");

  return date.toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(seconds) {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

function timeToSeconds(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60;
}

function secondsToTime(seconds) {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function setMissionMenuTitle(title) {
  const menuTitle = document.getElementById("missionMenuTitle");
  if (!menuTitle) return;
  menuTitle.textContent = title?.trim() || "Aucun horizon";
}

function renderMissionEmpty() {
  const youDetail = document.getElementById("youDetail");
  if (!youDetail) return;

  setMissionMenuTitle("");

  youDetail.innerHTML = `
    <section class="you-panel">
      <div class="you-panel-header">
        <div>
          <p class="section-kicker">Mon Horizon</p>
          <h2>Aucun horizon défini</h2>
        </div>

        <button class="you-primary-btn" id="openMissionFormBtn" type="button">
          Créer mon horizon
        </button>
      </div>

      <p class="you-panel-text">
        Choisis une direction qui te donne envie d’avancer.
      </p>
    </section>
  `;

  document
    .getElementById("openMissionFormBtn")
    ?.addEventListener("click", () => openMissionModal());
}

function renderMissionView(mission) {
  const youDetail = document.getElementById("youDetail");
  if (!youDetail) return;

  setMissionMenuTitle(mission?.title);

  const categoryLabel = getMissionLabel(MISSION_CATEGORIES, mission.category);
  const categoryIcon = getMissionIcon(mission.category);
  const intentionLabel = getMissionLabel(MISSION_INTENTIONS, mission.subcategory);

  const detailItems = [];

  if (mission.category) detailItems.push(`${categoryIcon} ${categoryLabel}`);
  if (mission.subcategory) detailItems.push(`🎯 ${intentionLabel}`);
  if (mission.category !== "health" && mission.sport) detailItems.push(`🏃 ${mission.sport}`);
  if (mission.target_date) detailItems.push(`📅 ${formatMissionDate(mission.target_date)}`);

  if (mission.category === "competition") {
    if (mission.distance_km) detailItems.push(`📏 ${mission.distance_km} km`);
    if (mission.target_time_seconds) detailItems.push(`⏱ ${formatTime(mission.target_time_seconds)}`);
  }

  if (mission.category === "adventure" && mission.duration_days) {
    detailItems.push(`🗓 ${mission.duration_days} jour${mission.duration_days > 1 ? "s" : ""}`);
  }

  youDetail.innerHTML = `
    <section class="you-panel">
      <div class="you-panel-header">
        <div>
          <p class="section-kicker">Mon Horizon</p>
          <h2>${mission.title}</h2>
        </div>

        <button class="you-secondary-btn" id="editMissionBtn" type="button">
          Modifier
        </button>
      </div>

      <div class="you-panel-meta">
        ${detailItems.map((item) => `<span>${item}</span>`).join("")}
      </div>

      ${
        mission.description
          ? `
            <div class="you-horizon-intention">
              <p class="section-kicker">Pourquoi ?</p>
              <p class="you-panel-text">${mission.description}</p>
            </div>
          `
          : ""
      }
    </section>
  `;

  document
    .getElementById("editMissionBtn")
    ?.addEventListener("click", () => openMissionModal(mission));
}

function openMissionModal(mission = null) {
  closeMissionModal();

  const modal = document.createElement("div");
  modal.className = "you-modal";
  modal.id = "missionModal";

  modal.innerHTML = `
    <div class="you-modal-backdrop" id="missionModalBackdrop"></div>

    <section class="you-modal-panel">
      <div class="you-modal-header">
        <div>
          <p class="section-kicker">Mon Horizon</p>
          <h2>${mission ? "Modifier mon horizon" : "Créer mon horizon"}</h2>
        </div>

        <button class="you-modal-close" id="closeMissionModalBtn" type="button">×</button>
      </div>

      <form class="you-form" id="missionForm">
        <label>
          Catégorie
          <select id="missionCategoryInput" required>
            ${getOptionList(MISSION_CATEGORIES, mission?.category || "health")}
          </select>
        </label>

        <label>
          Intention
          <select id="missionIntentionInput" required>
            ${getOptionList(MISSION_INTENTIONS, mission?.subcategory || "progression")}
          </select>
        </label>

        <label>
          Titre
          <input
            id="missionTitleInput"
            type="text"
            value="${mission?.title || ""}"
            placeholder="Ex. Courir les 100 km de Bienne"
            required
          >
        </label>

        <label class="mission-conditional mission-sport-field">
          Sport / activité
          <select id="missionSportInput">
            <option value="">Choisir une activité</option>
            ${getTextOptionList(MISSION_SPORTS, mission?.sport || "")}
          </select>
        </label>

        <div class="mission-conditional mission-competition-fields">
          <label>
            Distance
            <input
              id="missionDistanceInput"
              type="number"
              step="0.1"
              min="0"
              value="${mission?.distance_km || ""}"
              placeholder="Ex. 100"
            >
          </label>

          <label>
            Temps visé
            <input
              id="missionTimeInput"
              type="time"
              value="${secondsToTime(mission?.target_time_seconds)}"
            >
          </label>
        </div>

        <label class="mission-conditional mission-adventure-field">
          Durée de l’aventure
          <input
            id="missionDurationInput"
            type="number"
            min="1"
            value="${mission?.duration_days || ""}"
            placeholder="Nombre de jours"
          >
        </label>

        <label>
          Date cible
          <input
            id="missionTargetDateInput"
            type="date"
            value="${mission?.target_date || ""}"
          >
        </label>

        <label>
          Pourquoi cet horizon compte-t-il pour toi ?
          <textarea
            id="missionDescriptionInput"
            rows="5"
            placeholder="Ex. Je veux découvrir jusqu’où je suis capable d’aller."
          >${mission?.description || ""}</textarea>
        </label>

        <div class="you-form-actions">
          ${
            mission
              ? `<button class="you-danger-btn" id="deleteMissionBtn" type="button">Supprimer</button>`
              : `<span></span>`
          }

          <div class="you-form-actions-right">
            <button class="you-secondary-btn" id="cancelMissionBtn" type="button">Annuler</button>
            <button class="you-primary-btn" type="submit">Enregistrer mon horizon</button>
          </div>
        </div>

        <p class="you-save-status" id="missionSaveStatus"></p>
      </form>
    </section>
  `;

  document.body.appendChild(modal);

  document.getElementById("missionCategoryInput")?.addEventListener("change", updateMissionConditionalFields);
  document.getElementById("missionForm")?.addEventListener("submit", saveMission);
  document.getElementById("deleteMissionBtn")?.addEventListener("click", deleteMission);
  document.getElementById("cancelMissionBtn")?.addEventListener("click", closeMissionModal);
  document.getElementById("closeMissionModalBtn")?.addEventListener("click", closeMissionModal);
  document.getElementById("missionModalBackdrop")?.addEventListener("click", closeMissionModal);

  updateMissionConditionalFields();
}

function closeMissionModal() {
  document.getElementById("missionModal")?.remove();
}

function updateMissionConditionalFields() {
  const category = document.getElementById("missionCategoryInput")?.value;

  document.querySelectorAll(".mission-conditional").forEach((item) => {
    item.style.display = "none";
  });

  if (category !== "health") {
    document.querySelector(".mission-sport-field").style.display = "block";
  }

  if (category === "competition") {
    document.querySelector(".mission-competition-fields").style.display = "grid";
  }

  if (category === "adventure") {
    document.querySelector(".mission-adventure-field").style.display = "block";
  }
}

async function getCurrentUser() {
  const { data, error } = await window.momentumDB.auth.getSession();
  if (error) return null;
  return data.session?.user || null;
}

async function loadMission() {
  const youDetail = document.getElementById("youDetail");
  if (!youDetail || !window.momentumDB) return;

  youDetail.innerHTML = `
    <section class="you-panel">
      <p class="you-panel-text">Chargement de ton horizon...</p>
    </section>
  `;

  const user = await getCurrentUser();

  if (!user) {
    renderMissionEmpty();
    return;
  }

  const { data, error } = await window.momentumDB
    .from("user_missions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erreur chargement horizon:", error);
    renderMissionEmpty();
    return;
  }

  currentMission = data || null;
  currentMission ? renderMissionView(currentMission) : renderMissionEmpty();
}

async function saveMission(event) {
  event.preventDefault();

  const status = document.getElementById("missionSaveStatus");
  const user = await getCurrentUser();

  if (!user) {
    if (status) status.textContent = "Utilisateur non connecté.";
    return;
  }

  const category = document.getElementById("missionCategoryInput")?.value;
  const subcategory = document.getElementById("missionIntentionInput")?.value;
  const title = document.getElementById("missionTitleInput")?.value.trim();
  const sport = document.getElementById("missionSportInput")?.value || null;
  const description = document.getElementById("missionDescriptionInput")?.value.trim() || null;
  const targetDate = document.getElementById("missionTargetDateInput")?.value || null;

  const distanceKm = document.getElementById("missionDistanceInput")?.value || null;
  const targetTime = document.getElementById("missionTimeInput")?.value || null;
  const durationDays = document.getElementById("missionDurationInput")?.value || null;

  if (!title) {
    if (status) status.textContent = "Ajoute un titre à ton horizon.";
    return;
  }

  if (status) status.textContent = "Enregistrement...";

  const payload = {
    user_id: user.id,
    category,
    subcategory,
    title,
    description,
    sport: category === "health" ? null : sport,
    distance_km: category === "competition" && distanceKm ? Number(distanceKm) : null,
    target_time_seconds: category === "competition" && targetTime ? timeToSeconds(targetTime) : null,
    duration_days: category === "adventure" && durationDays ? Number(durationDays) : null,
    target_date: targetDate,
    status: "active",
    updated_at: new Date().toISOString(),
  };

  const query = currentMission?.id
    ? window.momentumDB
        .from("user_missions")
        .update(payload)
        .eq("id", currentMission.id)
        .eq("user_id", user.id)
    : window.momentumDB.from("user_missions").insert(payload);

  const { data, error } = await query.select().single();

  if (error) {
    console.error("Erreur sauvegarde horizon:", error);
    if (status) status.textContent = error.message || "Erreur lors de l’enregistrement.";
    return;
  }

  currentMission = data;
  closeMissionModal();
  renderMissionView(currentMission);
}

async function deleteMission() {
  if (!currentMission?.id) return;
  if (!confirm("Supprimer cet horizon ?")) return;

  const user = await getCurrentUser();
  if (!user) return;

  const { error } = await window.momentumDB
    .from("user_missions")
    .delete()
    .eq("id", currentMission.id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Erreur suppression horizon:", error);
    return;
  }

  currentMission = null;
  closeMissionModal();
  renderMissionEmpty();
}

window.loadMission = loadMission;