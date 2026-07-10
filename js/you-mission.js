// js/you-mission.js

let currentMission = null;

// =====================================================
// CONFIGURATION
// =====================================================

const MISSION_CATEGORIES = [
  { value: "health", label: "Santé" },
  { value: "competition", label: "Compétition" },
  { value: "pleasure", label: "Plaisir" },
  { value: "adventure", label: "Aventure" },
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

// =====================================================
// UTILITAIRES
// =====================================================

function getMissionLabel(list, value) {
  return list.find((item) => item.value === value)?.label || value || "";
}

function getMissionIcon(value) {
  return MISSION_CATEGORIES.find((item) => item.value === value)?.icon || "";
}

function getOptionList(options, selectedValue = "") {
  return options
    .map(
      (option) => `
        <option value="${option.value}" ${option.value === selectedValue ? "selected" : ""}>
          ${option.label}
        </option>
      `
    )
    .join("");
}

function getMissionSport(value) {
  if (!window.MomentumSports) return null;
  return window.MomentumSports.resolve(value);
}

function getMissionSportLabel(value) {
  return getMissionSport(value)?.label || value || "";
}

function getMissionSportOptionList(selectedValue = "") {
  if (!window.MomentumSports) {
    console.error(
      "MomentumSports n’est pas chargé. Vérifie que momentum-sports.js est placé avant you-mission.js."
    );
    return "";
  }

  const selectedSportId =
    window.MomentumSports.resolveId(selectedValue) || selectedValue || "";

  return window.MomentumSports.getGroupedOptions()
    .map(
      (group) => `
        <optgroup label="${group.label}">
          ${group.sports
            .map(
              (sport) => `
                <option
                  value="${sport.id}"
                  ${sport.id === selectedSportId ? "selected" : ""}
                >
                  ${sport.label}
                </option>
              `
            )
            .join("")}
        </optgroup>
      `
    )
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

// =====================================================
// BASE DE DONNÉES
// =====================================================

async function getCurrentUser() {
  const { data, error } = await window.momentumDB.auth.getSession();
  if (error) return null;

  return data.session?.user || null;
}
async function hasMissionHistory(userId) {
  const { data, error } = await window.momentumDB
    .from("user_missions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "history")
    .limit(1);

  if (error) {
    console.error("Erreur vérification Mon Chemin:", error);
    return false;
  }

  return data && data.length > 0;
}
async function loadMission() {
  const youDetail = document.getElementById("youDetail");
  if (!youDetail || !window.momentumDB) return;

  if (!window.MomentumSports || !window.MomentumIcons) {
    console.error(
      "MomentumSports ou MomentumIcons n’est pas chargé. Vérifie l’ordre des scripts dans you.html."
    );

    youDetail.innerHTML = `
      <section class="you-panel">
        <p class="you-panel-text">
          Impossible de charger le référentiel des sports ou les icônes.
        </p>
      </section>
    `;
    return;
  }

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

  currentMission ? renderMissionCard(currentMission) : renderMissionEmpty();
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
  const selectedSport =
    document.getElementById("missionSportInput")?.value || null;

  const sport = selectedSport
    ? window.MomentumSports.resolveId(selectedSport) || selectedSport
    : null;
  const description =
    document.getElementById("missionDescriptionInput")?.value.trim() || null;
  const targetDate =
    document.getElementById("missionTargetDateInput")?.value || null;

  const distanceKm =
    document.getElementById("missionDistanceInput")?.value || null;
  const targetTime =
    document.getElementById("missionTimeInput")?.value || null;
  const durationDays =
    document.getElementById("missionDurationInput")?.value || null;

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
    distance_km:
      category === "competition" && distanceKm ? Number(distanceKm) : null,
    target_time_seconds:
      category === "competition" && targetTime
        ? timeToSeconds(targetTime)
        : null,
    duration_days:
      category === "adventure" && durationDays ? Number(durationDays) : null,
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
    if (status) {
      status.textContent = error.message || "Erreur lors de l’enregistrement.";
    }
    return;
  }

  currentMission = data;
  closeMissionModal();
  renderMissionCard(currentMission);
}

async function closeCurrentMission() {
  if (!currentMission?.id) return;

  const status = document.getElementById("closeMissionStatus");
  const user = await getCurrentUser();

  if (!user) {
    if (status) status.textContent = "Utilisateur non connecté.";
    return;
  }

  if (status) status.textContent = "Clôture en cours...";

  const { error } = await window.momentumDB
    .from("user_missions")
    .update({
      status: "history",
      moved_to_history_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", currentMission.id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Erreur clôture horizon:", error);
    if (status) {
      status.textContent = error.message || "Erreur lors de la clôture.";
    }
    return;
  }

  currentMission = null;
  closeCloseMissionModal();
  renderMissionEmpty();
}

async function deleteHistoryMission(missionId) {
  if (!missionId) return;

  const confirmed = confirm("Supprimer définitivement cet horizon ?");
  if (!confirmed) return;

  const user = await getCurrentUser();
  if (!user) return;

  const { error } = await window.momentumDB
    .from("user_missions")
    .delete()
    .eq("id", missionId)
    .eq("user_id", user.id)
    .eq("status", "history");

  if (error) {
    console.error("Erreur suppression horizon:", error);
    return;
  }

  renderMissionPath();
}

/// =====================================================
// AFFICHAGE
// =====================================================

async function renderMissionEmpty() {
  const youDetail = document.getElementById("youDetail");
  if (!youDetail) return;

  setMissionMenuTitle("");

  const user = await getCurrentUser();
  const showPathButton = user ? await hasMissionHistory(user.id) : false;

  youDetail.innerHTML = `
    <section class="you-panel mission-card">
      <div class="mission-cover">
        <p class="section-kicker">Mon Horizon</p>
        <h2>Aucun horizon défini</h2>
      </div>

      <div class="mission-separator"></div>

      <p class="you-panel-text">
        Choisis une direction qui te donne envie d’avancer.
      </p>

      <div class="mission-actions">
        <button class="you-primary-btn" id="openMissionFormBtn" type="button">
          Créer mon horizon
        </button>

        ${
          showPathButton
            ? `
              <button class="you-secondary-btn" id="openMissionPathBtn" type="button">
                Mon Chemin
              </button>
            `
            : ""
        }
      </div>
    </section>
  `;

  document
    .getElementById("openMissionFormBtn")
    ?.addEventListener("click", () => openMissionModal());

  document
    .getElementById("openMissionPathBtn")
    ?.addEventListener("click", renderMissionPath);
}

async function renderMissionCard(mission) {
  const youDetail = document.getElementById("youDetail");
  if (!youDetail) return;

  setMissionMenuTitle(mission?.title);

  const user = await getCurrentUser();
  const showPathButton = user ? await hasMissionHistory(user.id) : false;

  const categoryLabel = getMissionLabel(MISSION_CATEGORIES, mission.category);
  const categoryIcon = getMissionIcon(mission.category);
  const intentionLabel = getMissionLabel(
    MISSION_INTENTIONS,
    mission.subcategory
  );

  const identityItems = [];

  if (mission.category) {
    identityItems.push(`
      <span class="mission-meta-label">Catégorie</span>
      <span>${categoryLabel}</span>
    `);
  }

  if (mission.subcategory) {
    identityItems.push(`
      <span class="mission-meta-label">Intention</span>
      <span>${intentionLabel}</span>
    `);
  }

  if (mission.category !== "health" && mission.sport) {
    const sportIcon = window.MomentumIcons.renderSport(mission.sport, {
      size: 20,
      className: "mission-inline-icon",
      decorative: true,
    });

    identityItems.push(`
      ${sportIcon}
      <span>${getMissionSportLabel(mission.sport)}</span>
    `);
  }

  const targetItems = [];

  if (mission.target_date) {
    targetItems.push(`
      <span class="mission-meta-label">Date</span>
      <span>${formatMissionDate(mission.target_date)}</span>
    `);
  }

  if (mission.category === "competition") {
    if (mission.distance_km) {
      targetItems.push(`
        <span class="mission-meta-label">Distance</span>
        <span>${mission.distance_km} km</span>
      `);
    }

    if (mission.target_time_seconds) {
      targetItems.push(`
        <span class="mission-meta-label">Temps visé</span>
        <span>${formatTime(mission.target_time_seconds)}</span>
      `);
    }
  }

  if (mission.category === "adventure" && mission.duration_days) {
    targetItems.push(`
      <span class="mission-meta-label">Durée</span>
      <span>
        ${mission.duration_days} jour${mission.duration_days > 1 ? "s" : ""}
      </span>
    `);
  }

  youDetail.innerHTML = `
    <section class="you-panel mission-card">
      <div class="mission-cover">
        <p class="section-kicker">Mon Horizon</p>
        <h2>${mission.title}</h2>
      </div>

      <div class="mission-separator"></div>

      <div class="mission-info-block">
        ${identityItems
          .map((item) => `<div class="mission-line">${item}</div>`)
          .join("")}
      </div>

      ${
        targetItems.length
          ? `
            <div class="mission-info-block">
              ${targetItems
                .map((item) => `<div class="mission-line">${item}</div>`)
                .join("")}
            </div>
          `
          : ""
      }

      ${
        mission.description
          ? `
            <div class="mission-intention">
              <p class="section-kicker">Pourquoi ?</p>
              <p>${mission.description}</p>
            </div>
          `
          : ""
      }

      <div class="mission-actions">
        <button class="you-secondary-btn" id="editMissionBtn" type="button">
          Modifier
        </button>

        <button class="you-primary-btn" id="closeMissionBtn" type="button">
          Clore cet horizon
        </button>

        ${
          showPathButton
            ? `
              <button class="you-secondary-btn" id="openMissionPathBtn" type="button">
                Mon Chemin
              </button>
            `
            : ""
        }
      </div>
    </section>
  `;

  document
    .getElementById("editMissionBtn")
    ?.addEventListener("click", () => openMissionModal(mission));

  document
    .getElementById("closeMissionBtn")
    ?.addEventListener("click", openCloseMissionModal);

  document
    .getElementById("openMissionPathBtn")
    ?.addEventListener("click", renderMissionPath);
}

async function renderMissionPath() {
  const youDetail = document.getElementById("youDetail");
  if (!youDetail) return;

  const user = await getCurrentUser();

  if (!user) {
    renderMissionEmpty();
    return;
  }

  youDetail.innerHTML = `
    <section class="you-panel">
      <div class="you-panel-header">
        <div>
          <p class="section-kicker">Mon Horizon</p>
          <h2>Mon Chemin</h2>
        </div>

        <button class="you-secondary-btn" id="backToMissionBtn" type="button">
          Retour
        </button>
      </div>

      <p class="you-panel-text">Chargement de ton chemin...</p>
    </section>
  `;

  const { data, error } = await window.momentumDB
    .from("user_missions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "history")
    .order("moved_to_history_at", { ascending: false });

  if (error) {
    console.error("Erreur chargement Mon Chemin:", error);
    youDetail.innerHTML = `
      <section class="you-panel">
        <p class="you-panel-text">Impossible de charger Mon Chemin.</p>
      </section>
    `;
    return;
  }

  const items = data || [];

  youDetail.innerHTML = `
    <section class="you-panel">
      <div class="you-panel-header">
        <div>
          <p class="section-kicker">Mon Horizon</p>
          <h2>Mon Chemin</h2>
        </div>

        <button class="you-secondary-btn" id="backToMissionBtn" type="button">
          Retour
        </button>
      </div>

      ${
        items.length
          ? `
            <div class="mission-path-list">
              ${items.map(renderMissionPathItem).join("")}
            </div>
          `
          : `
            <p class="you-panel-text">
              Aucun horizon clos pour le moment.
            </p>
          `
      }
    </section>
  `;

  document
    .getElementById("backToMissionBtn")
    ?.addEventListener("click", loadMission);

  document.querySelectorAll("[data-delete-history-mission]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteHistoryMission(button.dataset.deleteHistoryMission);
    });
  });
}

function renderMissionPathItem(mission) {
  const categoryLabel = getMissionLabel(
    MISSION_CATEGORIES,
    mission.category
  );

  const intentionLabel = getMissionLabel(
    MISSION_INTENTIONS,
    mission.subcategory
  );

  const closedDate = mission.moved_to_history_at
    ? formatMissionDate(mission.moved_to_history_at.slice(0, 10))
    : "";

  const sportLine = mission.sport
    ? `
      <span class="mission-path-meta-item">
        ${window.MomentumIcons.renderSport(mission.sport, {
          size: 18,
          className: "mission-inline-icon mission-inline-icon-small",
          decorative: true,
        })}
        <span>${getMissionSportLabel(mission.sport)}</span>
      </span>
    `
    : "";

  return `
    <article class="mission-path-item">
      <p class="section-kicker">
        ${closedDate ? `Clos le ${closedDate}` : "Horizon clos"}
      </p>

      <h3>${mission.title}</h3>

      <div class="you-panel-meta mission-path-meta">
        ${
          mission.category
            ? `
              <span class="mission-path-meta-item">
                <span class="mission-meta-label">Catégorie</span>
                <span>${categoryLabel}</span>
              </span>
            `
            : ""
        }

        ${
          mission.subcategory
            ? `
              <span class="mission-path-meta-item">
                <span class="mission-meta-label">Intention</span>
                <span>${intentionLabel}</span>
              </span>
            `
            : ""
        }

        ${sportLine}
      </div>

      ${
        mission.description
          ? `<p class="you-panel-text">${mission.description}</p>`
          : ""
      }

      <div class="mission-path-actions">
        <button
          class="you-danger-btn"
          type="button"
          data-delete-history-mission="${mission.id}"
        >
          Supprimer définitivement
        </button>
      </div>
    </article>
  `;
}

// =====================================================
// MODALES — CRÉATION / MODIFICATION
// =====================================================

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
            ${getOptionList(
              MISSION_INTENTIONS,
              mission?.subcategory || "progression"
            )}
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
            ${getMissionSportOptionList(mission?.sport || "")}
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
          <span></span>

          <div class="you-form-actions-right">
            <button class="you-secondary-btn" id="cancelMissionBtn" type="button">
              Annuler
            </button>

            <button class="you-primary-btn" type="submit">
              Enregistrer mon horizon
            </button>
          </div>
        </div>

        <p class="you-save-status" id="missionSaveStatus"></p>
      </form>
    </section>
  `;

  document.body.appendChild(modal);

  document
    .getElementById("missionCategoryInput")
    ?.addEventListener("change", updateMissionConditionalFields);

  document.getElementById("missionForm")?.addEventListener("submit", saveMission);
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
    const sportField = document.querySelector(".mission-sport-field");
    if (sportField) sportField.style.display = "block";
  }

  if (category === "competition") {
    const competitionFields = document.querySelector(
      ".mission-competition-fields"
    );
    if (competitionFields) competitionFields.style.display = "grid";
  }

  if (category === "adventure") {
    const adventureField = document.querySelector(
      ".mission-adventure-field"
    );
    if (adventureField) adventureField.style.display = "block";
  }
}

// =====================================================
// MODALE — CLÔTURE
// =====================================================

function openCloseMissionModal() {
  if (!currentMission?.id) return;

  closeCloseMissionModal();

  const modal = document.createElement("div");
  modal.className = "you-modal";
  modal.id = "closeMissionModal";

  modal.innerHTML = `
    <div class="you-modal-backdrop" id="closeMissionBackdrop"></div>

    <section class="you-modal-panel">
      <div class="you-modal-header">
        <div>
          <p class="section-kicker">Mon Horizon</p>
          <h2>Clore cet horizon ?</h2>
        </div>

        <button class="you-modal-close" id="cancelCloseMissionX" type="button">×</button>
      </div>

      <p class="you-panel-text">
        Cet horizon rejoindra <strong>Mon Chemin</strong>.
        Tu pourras ensuite créer un nouvel horizon.
      </p>

      <div class="you-form-actions">
        <button class="you-secondary-btn" id="cancelCloseMissionBtn" type="button">
          Annuler
        </button>

        <button class="you-primary-btn" id="confirmCloseMissionBtn" type="button">
          Clore cet horizon
        </button>
      </div>

      <p class="you-save-status" id="closeMissionStatus"></p>
    </section>
  `;

  document.body.appendChild(modal);

  document
    .getElementById("closeMissionBackdrop")
    ?.addEventListener("click", closeCloseMissionModal);

  document
    .getElementById("cancelCloseMissionX")
    ?.addEventListener("click", closeCloseMissionModal);

  document
    .getElementById("cancelCloseMissionBtn")
    ?.addEventListener("click", closeCloseMissionModal);

  document
    .getElementById("confirmCloseMissionBtn")
    ?.addEventListener("click", closeCurrentMission);
}

function closeCloseMissionModal() {
  document.getElementById("closeMissionModal")?.remove();
}

// =====================================================
// INITIALISATION
// =====================================================

window.loadMission = loadMission;