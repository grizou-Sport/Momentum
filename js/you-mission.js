// js/you-mission.js
// MOMENTUM — YOU / Mission v1.0
// Lignes de mire actives + historique

let youMissions = [];
let selectedMissionCategory = "competition";

async function renderMission() {
  const detail = document.getElementById("youDetail");
  if (!detail) return;

  detail.innerHTML = `
    <section class="you-panel mission-panel">
      <div class="you-panel-head">
        <div>
          <p class="section-kicker">En ligne de mire</p>
          <h2>Ce qui t’appelle maintenant</h2>
          <p class="you-muted">
            Une ligne de mire peut être une compétition, un objectif santé ou une aventure plaisir.
          </p>
        </div>

        <button class="you-action-btn" id="openMissionModalBtn" type="button">
          + Nouvelle ligne de mire
        </button>
      </div>

      <div class="mission-block">
        <h3>Actives</h3>
        <div id="activeMissionsList" class="mission-list">
          <p class="you-empty">Chargement...</p>
        </div>
      </div>

      <div class="mission-block">
        <h3>Historique</h3>
        <div id="missionHistoryList" class="mission-list">
          <p class="you-empty">Chargement...</p>
        </div>
      </div>
    </section>
  `;

  injectMissionModal();
  bindMissionBaseEvents();
  await loadMissions();
}

async function loadMissions() {
  const supabase = window.supabaseClient || window.supabase;
  if (!supabase) return;

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    console.error("Utilisateur non connecté:", userError);
    return;
  }

  const { data, error } = await supabase
    .from("user_missions")
    .select("*")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur chargement lignes de mire:", error);
    return;
  }

  youMissions = data || [];
  renderMissionLists();
}

function renderMissionLists() {
  const activeContainer = document.getElementById("activeMissionsList");
  const historyContainer = document.getElementById("missionHistoryList");

  if (!activeContainer || !historyContainer) return;

  const active = youMissions.filter((m) => m.status === "active");
  const history = youMissions.filter((m) => m.status === "history");

  activeContainer.innerHTML = active.length
    ? active.map(renderMissionCard).join("")
    : `<p class="you-empty">Aucune ligne de mire active pour le moment.</p>`;

  historyContainer.innerHTML = history.length
    ? history.map(renderMissionCard).join("")
    : `<p class="you-empty">L’historique est encore vide.</p>`;

  bindMissionCardEvents();
}

function renderMissionCard(mission) {
  const icon = getMissionIcon(mission.category);
  const label = getMissionLabel(mission.category);
  const date = formatDateCH(mission.target_date);

  const distance = mission.distance_km
    ? `<span>${Number(mission.distance_km)} km</span>`
    : "";

  const time = mission.target_time_seconds
    ? `<span>${formatTime(mission.target_time_seconds)}</span>`
    : "";

  const pace = mission.target_pace_seconds_per_km
    ? `<span>${formatPace(mission.target_pace_seconds_per_km)} /km</span>`
    : "";

  return `
    <article class="mission-card">
      <div class="mission-card-top">
        <span class="mission-icon">${icon}</span>
        <span class="mission-type">${label}</span>
      </div>

      <h3>${escapeHtml(mission.title)}</h3>

      ${
        mission.subcategory
          ? `<p class="mission-subtitle">${escapeHtml(mission.subcategory)}</p>`
          : ""
      }

      <div class="mission-meta">
        ${mission.sport ? `<span>${escapeHtml(mission.sport)}</span>` : ""}
        ${distance}
        ${time}
        ${pace}
        ${date ? `<span>${date}</span>` : ""}
      </div>

      ${
        mission.story_note
          ? `<p class="mission-note">“${escapeHtml(mission.story_note)}”</p>`
          : ""
      }

      ${
        mission.status === "active"
          ? `
            <button class="you-secondary-btn" data-mission-history="${mission.id}" type="button">
              Ajouter à l’historique
            </button>
          `
          : ""
      }
    </article>
  `;
}

/* MODAL */

function injectMissionModal() {
  const existing = document.getElementById("missionModal");
  if (existing) existing.remove();

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div id="missionModal" class="mission-modal" aria-hidden="true">
      <div class="mission-modal-backdrop" data-close-mission-modal></div>

      <div class="mission-modal-panel" role="dialog" aria-modal="true">
        <div class="mission-modal-head">
          <div>
            <p class="section-kicker">Nouvelle ligne de mire</p>
            <h2>Qu’est-ce qui t’appelle ?</h2>
          </div>

          <button class="mission-modal-close" type="button" data-close-mission-modal>
            ×
          </button>
        </div>

        <form id="missionForm" class="mission-form">
          <div class="mission-tabs">
            <button class="active" type="button" data-mission-category="competition">🏁 Compétition</button>
            <button type="button" data-mission-category="health">❤️ Santé</button>
            <button type="button" data-mission-category="pleasure">🌄 Plaisir</button>
          </div>

          <div class="mission-form-grid">
            <label>
              Titre
              <input id="missionTitle" type="text" placeholder="Semi-marathon de Lausanne" required>
            </label>

            <label>
              Type
              <input id="missionSubcategory" type="text" placeholder="Course, perte de poids, bikepacking...">
            </label>

            <label>
              Sport / activité
              <input id="missionSport" type="text" placeholder="Course à pied, vélo, randonnée...">
            </label>

            <label>
              Date cible
              <input id="missionTargetDate" type="date">
            </label>
          </div>

          <div id="competitionFields">
            <div class="mission-form-grid">
              <label>
                Distance en km
                <input id="missionDistance" type="number" step="0.01" placeholder="21.1">
              </label>

              <label>
                Temps visé
                <input id="missionTargetTime" type="text" placeholder="1:45:00">
              </label>
            </div>

            <div class="mission-pace-preview">
              Allure cible : <strong id="missionPacePreview">—</strong>
            </div>
          </div>

          <label>
            Description
            <textarea id="missionDescription" rows="3" placeholder="Décris cette ligne de mire..."></textarea>
          </label>

          <label>
            Pourquoi elle compte ?
            <textarea id="missionStoryNote" rows="3" placeholder="Ce que cette aventure représente pour toi..."></textarea>
          </label>

          <div class="mission-modal-actions">
            <button class="you-secondary-btn" type="button" data-close-mission-modal>
              Annuler
            </button>

            <button class="you-action-btn" type="submit">
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
    `
  );
}

function bindMissionBaseEvents() {
  const openBtn = document.getElementById("openMissionModalBtn");
  const form = document.getElementById("missionForm");

  if (openBtn) openBtn.addEventListener("click", openMissionModal);

  document.querySelectorAll("[data-close-mission-modal]").forEach((btn) => {
    btn.addEventListener("click", closeMissionModal);
  });

  document.querySelectorAll("[data-mission-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectMissionCategory(btn.dataset.missionCategory);
    });
  });

  ["missionDistance", "missionTargetTime"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.addEventListener("input", updatePacePreview);
  });

  if (form) form.addEventListener("submit", saveMission);
}

function bindMissionCardEvents() {
  document.querySelectorAll("[data-mission-history]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await moveMissionToHistory(btn.dataset.missionHistory);
    });
  });
}

function openMissionModal() {
  const modal = document.getElementById("missionModal");
  if (!modal) return;

  const form = document.getElementById("missionForm");
  if (form) form.reset();

  selectedMissionCategory = "competition";
  selectMissionCategory("competition");
  updatePacePreview();

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeMissionModal() {
  const modal = document.getElementById("missionModal");
  if (!modal) return;

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function selectMissionCategory(category) {
  selectedMissionCategory = category;

  document.querySelectorAll("[data-mission-category]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.missionCategory === category);
  });

  const competitionFields = document.getElementById("competitionFields");
  if (competitionFields) {
    competitionFields.style.display = category === "competition" ? "block" : "none";
  }

  updatePacePreview();
}

/* SAVE */

async function saveMission(event) {
  event.preventDefault();

  const supabase = window.supabaseClient || window.supabase;
  if (!supabase) return;

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    alert("Utilisateur non connecté.");
    return;
  }

  const distanceKm = parseFloat(getValue("missionDistance")) || null;
  const targetTimeSeconds = parseTimeToSeconds(getValue("missionTargetTime"));

  const targetPace =
    selectedMissionCategory === "competition" && distanceKm && targetTimeSeconds
      ? Math.round(targetTimeSeconds / distanceKm)
      : null;

  const payload = {
    user_id: userData.user.id,
    category: selectedMissionCategory,
    subcategory: getValue("missionSubcategory") || null,
    title: getValue("missionTitle"),
    description: getValue("missionDescription") || null,
    sport: getValue("missionSport") || null,
    distance_km: selectedMissionCategory === "competition" ? distanceKm : null,
    target_time_seconds: selectedMissionCategory === "competition" ? targetTimeSeconds : null,
    target_pace_seconds_per_km: targetPace,
    target_date: getValue("missionTargetDate") || null,
    status: "active",
    story_note: getValue("missionStoryNote") || null,
  };

  if (!payload.title) {
    alert("Ajoute un titre à ta ligne de mire.");
    return;
  }

  const { error } = await supabase.from("user_missions").insert(payload);

  if (error) {
    console.error("Erreur création ligne de mire:", error);
    alert("Impossible de créer la ligne de mire.");
    return;
  }

  closeMissionModal();
  await loadMissions();
}

async function moveMissionToHistory(id) {
  const supabase = window.supabaseClient || window.supabase;
  if (!supabase) return;

  const { error } = await supabase
    .from("user_missions")
    .update({
      status: "history",
      moved_to_history_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Erreur historique:", error);
    return;
  }

  await loadMissions();
}

/* HELPERS */

function updatePacePreview() {
  const preview = document.getElementById("missionPacePreview");
  if (!preview) return;

  if (selectedMissionCategory !== "competition") {
    preview.textContent = "—";
    return;
  }

  const distance = parseFloat(getValue("missionDistance"));
  const time = parseTimeToSeconds(getValue("missionTargetTime"));

  if (!distance || !time) {
    preview.textContent = "—";
    return;
  }

  preview.textContent = `${formatPace(Math.round(time / distance))} /km`;
}

function getValue(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function parseTimeToSeconds(value) {
  if (!value) return null;

  const parts = value.split(":").map(Number);

  if (parts.some(Number.isNaN)) return null;

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return null;
}

function formatPace(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDateCH(dateString) {
  if (!dateString) return "";

  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return "";

  return `${day}.${month}.${year}`;
}

function getMissionIcon(category) {
  return {
    health: "❤️",
    competition: "🏁",
    pleasure: "🌄",
  }[category] || "🎯";
}

function getMissionLabel(category) {
  return {
    health: "Santé",
    competition: "Compétition",
    pleasure: "Plaisir",
  }[category] || "Ligne de mire";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* Compatibilité avec you.js */
window.renderMission = renderMission;
window.renderYouMission = renderMission;