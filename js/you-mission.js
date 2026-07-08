// js/you-mission.js

let currentMission = null;

function formatMissionDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue + "T00:00:00");

  return date.toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
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
        <button class="you-primary-btn" id="openMissionFormBtn" type="button">Créer</button>
      </div>

      <p class="you-panel-text">
        Choisis une direction qui te donne envie d’avancer.
      </p>
    </section>
  `;

  document.getElementById("openMissionFormBtn")
    ?.addEventListener("click", () => renderMissionForm());
}

function renderMissionView(mission) {
  const youDetail = document.getElementById("youDetail");
  if (!youDetail) return;

  setMissionMenuTitle(mission?.title);

  youDetail.innerHTML = `
    <section class="you-panel">
      <div class="you-panel-header">
        <div>
          <p class="section-kicker">Mon Horizon</p>
          <h2>${mission.title}</h2>
        </div>
        <button class="you-secondary-btn" id="editMissionBtn" type="button">Modifier</button>
      </div>

      <p class="you-panel-text">
        ${mission.description || "Choisis une direction qui te donne envie d’avancer."}
      </p>

      ${mission.target_date ? `<p class="you-panel-meta">Horizon cible · ${formatMissionDate(mission.target_date)}</p>` : ""}
    </section>
  `;

  document.getElementById("editMissionBtn")
    ?.addEventListener("click", () => renderMissionForm(mission));
}

function renderMissionForm(mission = null) {
  const youDetail = document.getElementById("youDetail");
  if (!youDetail) return;

  youDetail.innerHTML = `
    <section class="you-panel">
      <div class="you-panel-header">
        <div>
          <p class="section-kicker">Mon Horizon</p>
          <h2>${mission ? "Modifier mon horizon" : "Créer mon horizon"}</h2>
        </div>
      </div>

      <form class="you-form" id="missionForm">
        <label>
          Titre
          <input id="missionTitleInput" type="text" value="${mission?.title || ""}" required>
        </label>

        <label>
          Description
          <textarea id="missionDescriptionInput" rows="5">${mission?.description || ""}</textarea>
        </label>

        <label>
          Date cible
          <input id="missionTargetDateInput" type="date" value="${mission?.target_date || ""}">
        </label>

        <div class="you-form-actions">
          ${mission ? `<button class="you-danger-btn" id="deleteMissionBtn" type="button">Supprimer</button>` : `<span></span>`}

          <div class="you-form-actions-right">
            <button class="you-secondary-btn" id="cancelMissionBtn" type="button">Annuler</button>
            <button class="you-primary-btn" type="submit">Enregistrer</button>
          </div>
        </div>

        <p class="you-save-status" id="missionSaveStatus"></p>
      </form>
    </section>
  `;

  document.getElementById("missionForm")
    ?.addEventListener("submit", saveMission);

  document.getElementById("cancelMissionBtn")
    ?.addEventListener("click", () => {
      currentMission ? renderMissionView(currentMission) : renderMissionEmpty();
    });

  document.getElementById("deleteMissionBtn")
    ?.addEventListener("click", deleteMission);
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

  const title = document.getElementById("missionTitleInput")?.value.trim();
  const description = document.getElementById("missionDescriptionInput")?.value.trim() || null;
  const targetDate = document.getElementById("missionTargetDateInput")?.value || null;

  if (!title) {
    if (status) status.textContent = "Ajoute un titre à ton horizon.";
    return;
  }

  if (status) status.textContent = "Enregistrement...";

  console.log("Utilisateur connecté :", user);
console.log("user.id =", user.id);

console.log("Payload =", payload);

  const payload = {
    user_id: user.id,
    title,
    description,
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
    : window.momentumDB
        .from("user_missions")
        .insert(payload);

  const { data, error } = await query.select().single();

 if (error) {
  console.error("Erreur sauvegarde horizon:", error);

  if (status) {
    status.textContent =
      error.message || "Erreur lors de l’enregistrement.";
  }

  return;
}

  currentMission = data;
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
  renderMissionEmpty();
}

window.loadMission = loadMission;
