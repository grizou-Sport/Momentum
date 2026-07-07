// js/you-mission.js
// MOMENTUM — YOU / En ligne de mire
// Une ligne de mire active + un historique

(() => {
  "use strict";

  let missions = [];
  let selectedCategory = "competition";
  let currentUser = null;

  /* =========================================================
     POINT D’ENTRÉE
  ========================================================= */

  async function renderMission() {
    const detail = document.getElementById("youDetail");

    if (!detail) {
      console.error("Mission : #youDetail est introuvable.");
      return;
    }

    detail.innerHTML = `
      <section class="you-panel mission-panel">
        <div class="you-panel-head">
          <div>
            <p class="section-kicker">En ligne de mire</p>
            <h2>Ce qui t’appelle maintenant</h2>
            <p class="you-muted">
              Une compétition, un objectif santé ou une aventure plaisir.
            </p>
          </div>

          <button
            class="you-action-btn"
            id="openMissionModalBtn"
            type="button"
          >
            + Nouvelle ligne de mire
          </button>
        </div>

        <div class="mission-block">
          <div id="activeMissionContainer">
            <p class="you-empty">Chargement de ta ligne de mire...</p>
          </div>
        </div>

        <div class="mission-block">
          <h3>Historique</h3>

          <div id="missionHistoryList" class="mission-list">
            <p class="you-empty">Chargement de l’historique...</p>
          </div>
        </div>
      </section>
    `;

    injectMissionModal();
    bindMissionEvents();

    await loadMissions();
  }

  /* =========================================================
     SUPABASE
  ========================================================= */

 function getSupabaseClient() {
  const candidates = [
    window.sb,
    window.supabaseClient,
    window.momentumSupabase,
    typeof supabaseClient !== "undefined" ? supabaseClient : null,
    typeof sb !== "undefined" ? sb : null,
  ];

  const client = candidates.find(
    (item) =>
      item &&
      item.auth &&
      typeof item.auth.getUser === "function" &&
      typeof item.from === "function"
  );

  if (!client) {
    console.error("Mission : aucun client Supabase valide trouvé.", {
      windowSb: window.sb,
      windowSupabaseClient: window.supabaseClient,
      windowMomentumSupabase: window.momentumSupabase,
      supabaseLibrary: window.supabase,
    });

    return null;
  }

  return client;
}

  async function getAuthenticatedUser() {
    const supabase = getSupabaseClient();

    if (!supabase) return null;

    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error("Mission : erreur de lecture utilisateur.", error);
      return null;
    }

    if (!data?.user) {
      console.error("Mission : aucun utilisateur connecté.");
      return null;
    }

    return data.user;
  }

  async function loadMissions() {
    const activeContainer = document.getElementById(
      "activeMissionContainer"
    );

    const historyContainer = document.getElementById(
      "missionHistoryList"
    );

    const supabase = getSupabaseClient();

    if (!supabase) {
      showLoadingError(
        activeContainer,
        historyContainer,
        "Connexion à Supabase indisponible."
      );
      return;
    }

    currentUser = await getAuthenticatedUser();

    if (!currentUser) {
      showLoadingError(
        activeContainer,
        historyContainer,
        "Utilisateur non connecté."
      );
      return;
    }

    const { data, error } = await supabase
      .from("user_missions")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        "Mission : erreur de chargement des lignes de mire.",
        error
      );

      showLoadingError(
        activeContainer,
        historyContainer,
        "Impossible de charger les lignes de mire."
      );

      return;
    }

    missions = Array.isArray(data) ? data : [];

    renderMissionContent();
  }

  function showLoadingError(
    activeContainer,
    historyContainer,
    message
  ) {
    if (activeContainer) {
      activeContainer.innerHTML = `
        <p class="you-empty">${escapeHtml(message)}</p>
      `;
    }

    if (historyContainer) {
      historyContainer.innerHTML = `
        <p class="you-empty">L’historique n’a pas pu être chargé.</p>
      `;
    }
  }

  /* =========================================================
     AFFICHAGE
  ========================================================= */

  function renderMissionContent() {
    const activeContainer = document.getElementById(
      "activeMissionContainer"
    );

    const historyContainer = document.getElementById(
      "missionHistoryList"
    );

    if (!activeContainer || !historyContainer) return;

    const activeMissions = missions.filter(
      (mission) => mission.status === "active"
    );

    const historicalMissions = missions.filter(
      (mission) => mission.status === "history"
    );

    /*
     * Si plusieurs anciennes lignes sont encore marquées "active"
     * dans Supabase, seule la plus récente est affichée comme active.
     * Les autres sont affichées dans l’historique sans modifier
     * automatiquement la base de données.
     */
    const activeMission = activeMissions[0] || null;

    const additionalOldActiveMissions = activeMissions.slice(1);

    const history = [
      ...historicalMissions,
      ...additionalOldActiveMissions,
    ].sort(sortMissionsByDateDescending);

    if (activeMission) {
      activeContainer.innerHTML = renderMissionCard(
        activeMission,
        true
      );
    } else {
      activeContainer.innerHTML = `
        <div class="mission-empty-card">
          <p class="you-empty">
            Tu n’as pas encore défini ta ligne de mire.
          </p>

          <button
            class="you-action-btn"
            id="openMissionModalEmptyBtn"
            type="button"
          >
            Créer ma ligne de mire
          </button>
        </div>
      `;
    }

    historyContainer.innerHTML = history.length
      ? history
          .map((mission) => renderMissionCard(mission, false))
          .join("")
      : `
        <p class="you-empty">
          Ton historique est encore vide.
        </p>
      `;

    updateMissionMenuLabel(activeMission);
    bindRenderedMissionEvents();
  }

  function renderMissionCard(mission, isActive) {
    const icon = getMissionIcon(mission.category);
    const category = getMissionLabel(mission.category);
    const date = formatDateCH(mission.target_date);

    const metadata = [];

    if (mission.sport) {
      metadata.push(escapeHtml(mission.sport));
    }

    if (mission.distance_km) {
      metadata.push(`${formatDistance(mission.distance_km)} km`);
    }

    if (mission.target_time_seconds) {
      metadata.push(formatTime(mission.target_time_seconds));
    }

    if (mission.target_pace_seconds_per_km) {
      metadata.push(
        `${formatPace(
          mission.target_pace_seconds_per_km
        )} /km`
      );
    }

    if (date) {
      metadata.push(date);
    }

    return `
      <article
        class="mission-card${isActive ? " mission-card--active" : ""}"
        data-mission-id="${escapeHtml(mission.id)}"
      >
        <div class="mission-card-top">
          <span class="mission-icon" aria-hidden="true">
            ${icon}
          </span>

          <span class="mission-type">
            ${category}
          </span>
        </div>

        <h3>${escapeHtml(mission.title)}</h3>

        ${
          mission.subcategory
            ? `
              <p class="mission-subtitle">
                ${escapeHtml(mission.subcategory)}
              </p>
            `
            : ""
        }

        ${
          metadata.length
            ? `
              <div class="mission-meta">
                ${metadata
                  .map((item) => `<span>${item}</span>`)
                  .join("")}
              </div>
            `
            : ""
        }

        ${
          mission.description
            ? `
              <p class="mission-description">
                ${escapeHtml(mission.description)}
              </p>
            `
            : ""
        }

        ${
          mission.story_note
            ? `
              <p class="mission-note">
                “${escapeHtml(mission.story_note)}”
              </p>
            `
            : ""
        }

        ${
          isActive
            ? `
              <div class="mission-card-actions">
                <button
                  class="you-secondary-btn"
                  data-mission-to-history="${escapeHtml(mission.id)}"
                  type="button"
                >
                  Ajouter à l’historique
                </button>

                <button
                  class="you-secondary-btn"
                  data-edit-mission="${escapeHtml(mission.id)}"
                  type="button"
                >
                  Modifier
                </button>
              </div>
            `
            : ""
        }
      </article>
    `;
  }

  function updateMissionMenuLabel(activeMission) {
    const menuLabel = document.querySelector(
      '[data-you-section="mission"] strong'
    );

    if (!menuLabel) return;

    menuLabel.textContent = activeMission?.title || "À définir";
  }

  function sortMissionsByDateDescending(a, b) {
    const dateA =
      a.moved_to_history_at ||
      a.updated_at ||
      a.created_at ||
      "";

    const dateB =
      b.moved_to_history_at ||
      b.updated_at ||
      b.created_at ||
      "";

    return new Date(dateB) - new Date(dateA);
  }

  /* =========================================================
     MODAL
  ========================================================= */

  function injectMissionModal() {
    document.getElementById("missionModal")?.remove();

    document.body.insertAdjacentHTML(
      "beforeend",
      `
        <div
          id="missionModal"
          class="mission-modal"
          aria-hidden="true"
        >
          <div
            class="mission-modal-backdrop"
            data-close-mission-modal
          ></div>

          <div
            class="mission-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="missionModalTitle"
          >
            <div class="mission-modal-head">
              <div>
                <p class="section-kicker">
                  En ligne de mire
                </p>

                <h2 id="missionModalTitle">
                  Qu’est-ce qui t’appelle ?
                </h2>
              </div>

              <button
                class="mission-modal-close"
                type="button"
                data-close-mission-modal
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <form id="missionForm" class="mission-form">
              <input
                id="missionId"
                type="hidden"
                value=""
              >

              <div class="mission-tabs">
                <button
                  class="active"
                  type="button"
                  data-mission-category="competition"
                >
                  🏁 Compétition
                </button>

                <button
                  type="button"
                  data-mission-category="health"
                >
                  ❤️ Santé
                </button>

                <button
                  type="button"
                  data-mission-category="pleasure"
                >
                  🌄 Plaisir
                </button>
              </div>

              <div class="mission-form-grid">
                <label>
                  Titre

                  <input
                    id="missionTitle"
                    type="text"
                    placeholder="Ex. Marathon de Lausanne"
                    required
                  >
                </label>

                <label>
                  Type

                  <input
                    id="missionSubcategory"
                    type="text"
                    placeholder="Ex. Marathon, reprise, bikepacking..."
                  >
                </label>

                <label>
                  Sport ou activité

                  <input
                    id="missionSport"
                    type="text"
                    placeholder="Ex. Course à pied"
                  >
                </label>

                <label>
                  Date cible

                  <input
                    id="missionTargetDate"
                    type="date"
                  >
                </label>
              </div>

              <div id="competitionFields">
                <div class="mission-form-grid">
                  <label>
                    Distance en km

                    <input
                      id="missionDistance"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="42.2"
                    >
                  </label>

                  <label>
                    Temps visé

                    <input
                      id="missionTargetTime"
                      type="text"
                      inputmode="numeric"
                      placeholder="Ex. 3:30:00"
                    >
                  </label>
                </div>

                <div class="mission-pace-preview">
                  Allure cible :
                  <strong id="missionPacePreview">—</strong>
                </div>
              </div>

              <label>
                Description

                <textarea
                  id="missionDescription"
                  rows="3"
                  placeholder="Décris cette ligne de mire..."
                ></textarea>
              </label>

              <label>
                Pourquoi elle compte ?

                <textarea
                  id="missionStoryNote"
                  rows="3"
                  placeholder="Ce qu’elle représente pour toi..."
                ></textarea>
              </label>

              <p
                id="missionFormMessage"
                class="mission-form-message"
                aria-live="polite"
              ></p>

              <div class="mission-modal-actions">
                <button
                  class="you-secondary-btn"
                  type="button"
                  data-close-mission-modal
                >
                  Annuler
                </button>

                <button
                  class="you-action-btn"
                  id="saveMissionBtn"
                  type="submit"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      `
    );
  }

  function openMissionModal(mission = null) {
    const modal = document.getElementById("missionModal");
    const form = document.getElementById("missionForm");
    const title = document.getElementById("missionModalTitle");

    if (!modal || !form) return;

    form.reset();
    clearFormMessage();

    if (mission) {
      document.getElementById("missionId").value =
        mission.id || "";

      document.getElementById("missionTitle").value =
        mission.title || "";

      document.getElementById("missionSubcategory").value =
        mission.subcategory || "";

      document.getElementById("missionSport").value =
        mission.sport || "";

      document.getElementById("missionTargetDate").value =
        mission.target_date || "";

      document.getElementById("missionDistance").value =
        mission.distance_km || "";

      document.getElementById("missionTargetTime").value =
        mission.target_time_seconds
          ? formatTimeForInput(mission.target_time_seconds)
          : "";

      document.getElementById("missionDescription").value =
        mission.description || "";

      document.getElementById("missionStoryNote").value =
        mission.story_note || "";

      selectedCategory = mission.category || "competition";

      if (title) {
        title.textContent = "Modifier ma ligne de mire";
      }
    } else {
      document.getElementById("missionId").value = "";
      selectedCategory = "competition";

      if (title) {
        title.textContent = "Qu’est-ce qui t’appelle ?";
      }
    }

    selectMissionCategory(selectedCategory);
    updatePacePreview();

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");

    document.body.classList.add("mission-modal-is-open");

    window.setTimeout(() => {
      document.getElementById("missionTitle")?.focus();
    }, 50);
  }

  function closeMissionModal() {
    const modal = document.getElementById("missionModal");

    if (!modal) return;

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");

    document.body.classList.remove("mission-modal-is-open");

    clearFormMessage();
  }

  function selectMissionCategory(category) {
    const allowedCategories = [
      "competition",
      "health",
      "pleasure",
    ];

    selectedCategory = allowedCategories.includes(category)
      ? category
      : "competition";

    document
      .querySelectorAll("[data-mission-category]")
      .forEach((button) => {
        button.classList.toggle(
          "active",
          button.dataset.missionCategory === selectedCategory
        );
      });

    const competitionFields = document.getElementById(
      "competitionFields"
    );

    if (competitionFields) {
      competitionFields.hidden =
        selectedCategory !== "competition";
    }

    updatePacePreview();
  }

  /* =========================================================
     ÉVÉNEMENTS
  ========================================================= */

  function bindMissionEvents() {
    document
      .getElementById("openMissionModalBtn")
      ?.addEventListener("click", () => {
        openMissionModal();
      });

    document
      .getElementById("missionForm")
      ?.addEventListener("submit", saveMission);

    document
      .querySelectorAll("[data-close-mission-modal]")
      .forEach((button) => {
        button.addEventListener("click", closeMissionModal);
      });

    document
      .querySelectorAll("[data-mission-category]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          selectMissionCategory(
            button.dataset.missionCategory
          );
        });
      });

    document
      .getElementById("missionDistance")
      ?.addEventListener("input", updatePacePreview);

    document
      .getElementById("missionTargetTime")
      ?.addEventListener("input", updatePacePreview);

    document.addEventListener("keydown", handleMissionEscape);
  }

  function bindRenderedMissionEvents() {
    document
      .getElementById("openMissionModalEmptyBtn")
      ?.addEventListener("click", () => {
        openMissionModal();
      });

    document
      .querySelectorAll("[data-mission-to-history]")
      .forEach((button) => {
        button.addEventListener("click", async () => {
          await moveMissionToHistory(
            button.dataset.missionToHistory
          );
        });
      });

    document
      .querySelectorAll("[data-edit-mission]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const mission = missions.find(
            (item) => item.id === button.dataset.editMission
          );

          if (mission) {
            openMissionModal(mission);
          }
        });
      });
  }

  function handleMissionEscape(event) {
    if (event.key !== "Escape") return;

    const modal = document.getElementById("missionModal");

    if (modal?.classList.contains("open")) {
      closeMissionModal();
    }
  }

  /* =========================================================
     ENREGISTREMENT
  ========================================================= */

  async function saveMission(event) {
    event.preventDefault();

    const supabase = getSupabaseClient();

    if (!supabase) {
      setFormMessage(
        "Connexion à Supabase indisponible.",
        true
      );
      return;
    }

    currentUser = currentUser || (await getAuthenticatedUser());

    if (!currentUser) {
      setFormMessage(
        "Impossible d’identifier l’utilisateur connecté.",
        true
      );
      return;
    }

    const title = getValue("missionTitle");
    const missionId = getValue("missionId");

    if (!title) {
      setFormMessage(
        "Ajoute un titre à ta ligne de mire.",
        true
      );

      document.getElementById("missionTitle")?.focus();
      return;
    }

    const distance =
      selectedCategory === "competition"
        ? parsePositiveNumber(getValue("missionDistance"))
        : null;

    const targetTime =
      selectedCategory === "competition"
        ? parseTimeToSeconds(getValue("missionTargetTime"))
        : null;

    if (
      selectedCategory === "competition" &&
      getValue("missionTargetTime") &&
      !targetTime
    ) {
      setFormMessage(
        "Le temps doit être saisi au format 3:30:00.",
        true
      );
      return;
    }

    const targetPace =
      distance && targetTime
        ? Math.round(targetTime / distance)
        : null;

    const payload = {
      user_id: currentUser.id,
      category: selectedCategory,
      subcategory:
        getValue("missionSubcategory") || null,
      title,
      description:
        getValue("missionDescription") || null,
      sport:
        getValue("missionSport") || null,
      distance_km: distance,
      target_time_seconds: targetTime,
      target_pace_seconds_per_km: targetPace,
      target_date:
        getValue("missionTargetDate") || null,
      status: "active",
      story_note:
        getValue("missionStoryNote") || null,
      moved_to_history_at: null,
    };

    setSavingState(true);

    try {
      /*
       * Une seule ligne de mire active :
       * si l’utilisateur crée une nouvelle ligne,
       * l’ancienne rejoint d’abord l’historique.
       */
      if (!missionId) {
        const { error: historyError } = await supabase
          .from("user_missions")
          .update({
            status: "history",
            moved_to_history_at: new Date().toISOString(),
          })
          .eq("user_id", currentUser.id)
          .eq("status", "active");

        if (historyError) {
          throw historyError;
        }

        const { error: insertError } = await supabase
          .from("user_missions")
          .insert(payload);

        if (insertError) {
          throw insertError;
        }
      } else {
        const { error: updateError } = await supabase
          .from("user_missions")
          .update(payload)
          .eq("id", missionId)
          .eq("user_id", currentUser.id);

        if (updateError) {
          throw updateError;
        }
      }

      closeMissionModal();
      await loadMissions();
    } catch (error) {
      console.error(
        "Mission : erreur lors de l’enregistrement.",
        error
      );

      setFormMessage(
        error?.message ||
          "Impossible d’enregistrer la ligne de mire.",
        true
      );
    } finally {
      setSavingState(false);
    }
  }

  async function moveMissionToHistory(missionId) {
    const supabase = getSupabaseClient();

    if (!supabase || !missionId) return;

    currentUser = currentUser || (await getAuthenticatedUser());

    if (!currentUser) return;

    const { error } = await supabase
      .from("user_missions")
      .update({
        status: "history",
        moved_to_history_at: new Date().toISOString(),
      })
      .eq("id", missionId)
      .eq("user_id", currentUser.id);

    if (error) {
      console.error(
        "Mission : impossible d’ajouter à l’historique.",
        error
      );

      window.alert(
        "Impossible d’ajouter cette ligne de mire à l’historique."
      );

      return;
    }

    await loadMissions();
  }

  /* =========================================================
     ALLURE ET FORMATS
  ========================================================= */

  function updatePacePreview() {
    const preview = document.getElementById(
      "missionPacePreview"
    );

    if (!preview) return;

    if (selectedCategory !== "competition") {
      preview.textContent = "—";
      return;
    }

    const distance = parsePositiveNumber(
      getValue("missionDistance")
    );

    const targetTime = parseTimeToSeconds(
      getValue("missionTargetTime")
    );

    if (!distance || !targetTime) {
      preview.textContent = "—";
      return;
    }

    const pace = Math.round(targetTime / distance);

    preview.textContent = `${formatPace(pace)} /km`;
  }

  function parsePositiveNumber(value) {
    if (!value) return null;

    const normalizedValue = value.replace(",", ".");
    const number = Number(normalizedValue);

    return Number.isFinite(number) && number > 0
      ? number
      : null;
  }

  function parseTimeToSeconds(value) {
    if (!value) return null;

    const parts = value
      .trim()
      .split(":")
      .map((part) => Number(part));

    if (
      parts.some((part) => !Number.isFinite(part)) ||
      parts.length < 2 ||
      parts.length > 3
    ) {
      return null;
    }

    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    if (parts.length === 2) {
      [minutes, seconds] = parts;
    } else {
      [hours, minutes, seconds] = parts;
    }

    if (
      minutes < 0 ||
      seconds < 0 ||
      minutes >= 60 ||
      seconds >= 60 ||
      hours < 0
    ) {
      return null;
    }

    return hours * 3600 + minutes * 60 + seconds;
  }

  function formatPace(totalSeconds) {
    const seconds = Number(totalSeconds);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      return "—";
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);

    return `${minutes}:${String(remainingSeconds).padStart(
      2,
      "0"
    )}`;
  }

  function formatTime(totalSeconds) {
    const seconds = Number(totalSeconds);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      return "";
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(
      (seconds % 3600) / 60
    );
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(
        2,
        "0"
      )}:${String(remainingSeconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(remainingSeconds).padStart(
      2,
      "0"
    )}`;
  }

  function formatTimeForInput(totalSeconds) {
    const seconds = Number(totalSeconds);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      return "";
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(
      (seconds % 3600) / 60
    );
    const remainingSeconds = Math.floor(seconds % 60);

    return `${hours}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  function formatDateCH(dateString) {
    if (!dateString) return "";

    const dateParts = String(dateString)
      .slice(0, 10)
      .split("-");

    if (dateParts.length !== 3) return "";

    const [year, month, day] = dateParts;

    return `${day}.${month}.${year}`;
  }

  function formatDistance(value) {
    const distance = Number(value);

    if (!Number.isFinite(distance)) return "";

    return Number.isInteger(distance)
      ? String(distance)
      : distance.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  /* =========================================================
     INTERFACE ET OUTILS
  ========================================================= */

  function getMissionIcon(category) {
    const icons = {
      health: "❤️",
      competition: "🏁",
      pleasure: "🌄",
    };

    return icons[category] || "🎯";
  }

  function getMissionLabel(category) {
    const labels = {
      health: "Santé",
      competition: "Compétition",
      pleasure: "Plaisir",
    };

    return labels[category] || "Ligne de mire";
  }

  function getValue(id) {
    const element = document.getElementById(id);

    return element?.value?.trim() || "";
  }

  function setSavingState(isSaving) {
    const button = document.getElementById(
      "saveMissionBtn"
    );

    if (!button) return;

    button.disabled = isSaving;
    button.textContent = isSaving
      ? "Enregistrement..."
      : "Enregistrer";
  }

  function setFormMessage(message, isError = false) {
    const element = document.getElementById(
      "missionFormMessage"
    );

    if (!element) return;

    element.textContent = message;
    element.classList.toggle("is-error", isError);
  }

  function clearFormMessage() {
    setFormMessage("");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* =========================================================
     EXPOSITION AU MODULE PRINCIPAL YOU
  ========================================================= */

  window.renderMission = renderMission;
  window.renderYouMission = renderMission;
})();