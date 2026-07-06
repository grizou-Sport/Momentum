const youDetail = document.getElementById("youDetail");
const youButtons = document.querySelectorAll("[data-you-section]");
const logoutBtn = document.getElementById("logoutBtn");

let currentUser = null;
let passport = null;
let currentMission = null;

let sportsCatalog = [];
let userSports = [];

let equipmentCatalog = [];
let userEquipment = [];

let wellbeingProfile = null;

function safe(value, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function calculateAge(birthYear) {
  if (!birthYear) return "—";
  return `${new Date().getFullYear() - Number(birthYear)} ans`;
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
  const activeSports = userSports
    .filter((item) => item.active !== false)
    .map((item) => item.sports?.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");

  const activeEquipment = userEquipment
    .filter((item) => item.active !== false)
    .map((item) => {
      const eq = item.equipment;
      if (!eq) return null;
      return `${eq.brand ? eq.brand + " " : ""}${eq.name}`;
    })
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");

  const previews = {
    mission: currentMission?.title || "Aucun objectif",
    sports: activeSports || "Apparaîtra avec tes activités",
    wellbeing: `${passport?.weight_kg || "—"} kg · VO₂ ${wellbeingProfile?.vo2max || "—"}`,
    equipment: activeEquipment || "Ajouter ton matériel",
    data: "FIT / GPX / export",
    about: passport?.display_name || "Ton passeport",
  };

  const labels = {
    mission: "En ligne de mire",
    sports: "Je vis pour",
    wellbeing: "Mon équilibre",
    equipment: "Mon matériel",
    data: "Mes activités",
    about: "Passeport",
  };

  youButtons.forEach((button) => {
    const section = button.dataset.youSection;
    const span = button.querySelector("span");
    const strong = button.querySelector("strong");
    let small = button.querySelector("small");

    if (span) span.textContent = labels[section] || section;
    if (strong) strong.textContent = previews[section] || "";

    if (!small) {
      small = document.createElement("small");
      strong?.after(small);
    }

    small.textContent = "";
  });
}

async function loadYou() {
  const { data } = await window.momentumDB.auth.getSession();
  currentUser = data.session?.user;

  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  const [
    passportResult,
    missionResult,
    sportsResult,
    userSportsResult,
    equipmentResult,
    userEquipmentResult,
    wellbeingResult,
  ] = await Promise.all([
    window.momentumDB
      .from("passports")
      .select("*")
      .eq("user_id", currentUser.id)
      .single(),

    window.momentumDB
      .from("missions")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    window.momentumDB
      .from("sports")
      .select("*")
      .order("order_index", { ascending: true }),

    window.momentumDB
      .from("user_sports")
      .select("*, sports(*)")
      .eq("user_id", currentUser.id),

    window.momentumDB
      .from("equipment")
      .select("*")
      .order("order_index", { ascending: true }),

    window.momentumDB
      .from("user_equipment")
      .select("*, equipment(*)")
      .eq("user_id", currentUser.id),

    window.momentumDB
      .from("wellbeing_profile")
      .select("*")
      .eq("user_id", currentUser.id)
      .maybeSingle(),
  ]);

  if (passportResult.error) {
    console.error(passportResult.error);
    return;
  }

  passport = passportResult.data;
  currentMission = missionResult.data || null;

  sportsCatalog = sportsResult.data || [];
  userSports = userSportsResult.data || [];

  equipmentCatalog = equipmentResult.data || [];
  userEquipment = userEquipmentResult.data || [];

  wellbeingProfile = wellbeingResult.data || null;

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
  if (section === "wellbeing") return renderWellbeing();
  if (section === "equipment") return renderEquipment();
  if (section === "data") return renderData();
  if (section === "about") return renderAbout();
}

/* -------------------- EN LIGNE DE MIRE -------------------- */

function renderMission() {
  youDetail.innerHTML = `
    <p class="section-kicker">En ligne de mire</p>
    <h2>${safe(currentMission?.title, "Aucun objectif")}</h2>
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
      <p>${currentMission ? "Cet objectif donne une direction à ton aventure." : "Aucun objectif n’est encore enregistré."}</p>
    </div>

    <button class="primary" id="editMissionBtn" type="button">
      ${currentMission ? "Modifier" : "Créer"}
    </button>
  `;

  document.getElementById("editMissionBtn").addEventListener("click", renderMissionForm);
}

function renderMissionForm() {
  youDetail.innerHTML = `
    <p class="section-kicker">En ligne de mire</p>
    <h2>${currentMission ? "Modifier l’objectif" : "Créer un objectif"}</h2>

    <form id="missionForm" class="you-form">
      <label class="full">Nom de l’objectif
        <input name="title" value="${currentMission?.title || ""}" placeholder="Marathon" />
      </label>

      <label class="full">Objectif
        <input name="goal" value="${currentMission?.goal || ""}" placeholder="Terminer, sub 3h, retrouver du plaisir..." />
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

      <button class="login-primary full" type="submit">Enregistrer</button>
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

  const result = currentMission?.id
    ? await window.momentumDB.from("missions").update(payload).eq("id", currentMission.id).select().single()
    : await window.momentumDB.from("missions").insert(payload).select().single();

  if (result.error) {
    console.error(result.error);
    message.textContent = result.error.message;
    return;
  }

  currentMission = result.data;
  renderMenuPreviews();

  message.textContent = "Sauvegardé.";
  setTimeout(renderMission, 700);
}

/* -------------------- JE VIS POUR -------------------- */

function renderSports() {
  const activeSports = userSports
    .filter((item) => item.active !== false)
    .map((item) => item.sports)
    .filter(Boolean);

  youDetail.innerHTML = `
    <p class="section-kicker">Je vis pour</p>
    <h2>Tes terrains d’expression</h2>
    <p class="you-detail-lead">
      Les sports apparaîtront ici naturellement, au fil des activités enregistrées.
    </p>

    ${
      activeSports.length
        ? `
          <div class="you-card-grid">
            ${activeSports
              .map((sport) => `
                <div class="you-small-card active">
                  <span>${sport.emoji || "•"}</span>
                  <strong>${sport.name}</strong>
                  <em>Pratiqué</em>
                </div>
              `)
              .join("")}
          </div>
        `
        : `
          <div class="you-note-box">
            <span>Momentum observe</span>
            <p>Aucun sport n’est encore lié à tes activités. Ils apparaîtront automatiquement après tes premiers imports.</p>
          </div>
        `
    }
  `;
}

/* -------------------- MON ÉQUILIBRE -------------------- */

function renderWellbeing() {
  youDetail.innerHTML = `
    <p class="section-kicker">Mon équilibre</p>
    <h2>Ton état du moment</h2>
    <p class="you-detail-lead">Sommeil, récupération, poids, sensations et énergie.</p>

    <div class="you-detail-stats">
      <div><span>Âge</span><strong>${calculateAge(passport?.birth_year)}</strong></div>
      <div><span>Taille</span><strong>${passport?.height_cm ? passport.height_cm + " cm" : "—"}</strong></div>
      <div><span>Poids</span><strong>${passport?.weight_kg ? passport.weight_kg + " kg" : "—"}</strong></div>
      <div><span>FC max</span><strong>${wellbeingProfile?.max_hr ? wellbeingProfile.max_hr + " bpm" : "—"}</strong></div>
      <div><span>FC repos</span><strong>${wellbeingProfile?.resting_hr ? wellbeingProfile.resting_hr + " bpm" : "—"}</strong></div>
      <div><span>VO₂max</span><strong>${safe(wellbeingProfile?.vo2max)}</strong></div>
    </div>

    <button class="primary" id="editWellbeingBtn" type="button">
      Modifier
    </button>
  `;

  document.getElementById("editWellbeingBtn").addEventListener("click", renderWellbeingForm);
}

function renderWellbeingForm() {
  youDetail.innerHTML = `
    <p class="section-kicker">Mon équilibre</p>
    <h2>Profil physiologique</h2>

    <form id="wellbeingForm" class="you-form">
      <label>FC max
        <input name="max_hr" type="number" value="${wellbeingProfile?.max_hr || ""}" />
      </label>

      <label>FC repos
        <input name="resting_hr" type="number" value="${wellbeingProfile?.resting_hr || ""}" />
      </label>

      <label>VO₂max
        <input name="vo2max" type="number" step="0.1" value="${wellbeingProfile?.vo2max || ""}" />
      </label>

      <label>Sommeil cible
        <input name="preferred_sleep_hours" type="number" step="0.1" value="${wellbeingProfile?.preferred_sleep_hours || ""}" />
      </label>

      <label class="full">Notes
        <textarea name="notes" rows="3">${wellbeingProfile?.notes || ""}</textarea>
      </label>

      <button class="login-primary full" type="submit">Enregistrer</button>
      <p id="wellbeingMessage" class="login-message full"></p>
    </form>
  `;

  document.getElementById("wellbeingForm").addEventListener("submit", saveWellbeing);
}

async function saveWellbeing(event) {
  event.preventDefault();

  const form = new FormData(event.target);
  const message = document.getElementById("wellbeingMessage");

  message.textContent = "Sauvegarde…";

  const payload = {
    user_id: currentUser.id,
    max_hr: form.get("max_hr") ? Number(form.get("max_hr")) : null,
    resting_hr: form.get("resting_hr") ? Number(form.get("resting_hr")) : null,
    vo2max: form.get("vo2max") ? Number(form.get("vo2max")) : null,
    preferred_sleep_hours: form.get("preferred_sleep_hours")
      ? Number(form.get("preferred_sleep_hours"))
      : null,
    notes: form.get("notes")?.trim(),
    updated_at: new Date().toISOString(),
  };

  const result = wellbeingProfile?.id
    ? await window.momentumDB
        .from("wellbeing_profile")
        .update(payload)
        .eq("id", wellbeingProfile.id)
        .select()
        .single()
    : await window.momentumDB
        .from("wellbeing_profile")
        .insert(payload)
        .select()
        .single();

  if (result.error) {
    console.error(result.error);
    message.textContent = result.error.message;
    return;
  }

  wellbeingProfile = result.data;
  renderMenuPreviews();

  message.textContent = "Sauvegardé.";
  setTimeout(renderWellbeing, 700);
}

/* -------------------- MON MATÉRIEL -------------------- */

function renderEquipment() {
  const selectedIds = userEquipment.map((item) => String(item.equipment_id));

  youDetail.innerHTML = `
    <p class="section-kicker">Mon matériel</p>
    <h2>Les objets de route</h2>
    <p class="you-detail-lead">Montres, chaussures, vélos, capteurs, nutrition et accessoires.</p>

    <div class="you-card-grid">
      ${equipmentCatalog
        .map((item) => {
          const selected = selectedIds.includes(String(item.id));
          const link = userEquipment.find((eq) => String(eq.equipment_id) === String(item.id));

          return `
            <button class="you-small-card ${selected && link?.active !== false ? "active" : ""}" data-equipment-id="${item.id}" type="button">
              <span>${item.emoji || "•"}</span>
              <strong>${item.brand ? item.brand + " " : ""}${item.name}</strong>
              <em>${selected ? safe(link?.usage, item.category) : item.category || "Ajouter"}</em>
            </button>
          `;
        })
        .join("")}
    </div>

    <p id="equipmentMessage" class="login-message"></p>
  `;

  document.querySelectorAll("[data-equipment-id]").forEach((button) => {
    button.addEventListener("click", () => toggleEquipment(button.dataset.equipmentId));
  });
}

async function toggleEquipment(equipmentId) {
  const existing = userEquipment.find((item) => String(item.equipment_id) === String(equipmentId));

  if (existing) {
    const { error } = await window.momentumDB
      .from("user_equipment")
      .delete()
      .eq("id", existing.id);

    if (error) {
      console.error(error);
      return;
    }

    userEquipment = userEquipment.filter((item) => item.id !== existing.id);
  } else {
    const { data, error } = await window.momentumDB
      .from("user_equipment")
      .insert({
        user_id: currentUser.id,
        equipment_id: equipmentId,
        usage: "Principal",
        active: true,
      })
      .select("*, equipment(*)")
      .single();

    if (error) {
      console.error(error);
      return;
    }

    userEquipment.push(data);
  }

  renderMenuPreviews();
  renderEquipment();
}

/* -------------------- MES ACTIVITÉS -------------------- */

function renderData() {
  youDetail.innerHTML = `
    <p class="section-kicker">Mes activités</p>
    <h2>Ce que tu as vécu</h2>
    <p class="you-detail-lead">Les activités importées construiront progressivement ton histoire.</p>

    <div class="you-card-grid">
      <div class="you-small-card">
        <span>FIT</span>
        <strong>Importer une activité</strong>
        <em>Bientôt</em>
      </div>

      <div class="you-small-card">
        <span>GPX</span>
        <strong>Importer un tracé</strong>
        <em>Bientôt</em>
      </div>

      <div class="you-small-card">
        <span>Journal</span>
        <strong>Voir les activités</strong>
        <em>À venir</em>
      </div>
    </div>
  `;
}

/* -------------------- PASSEPORT -------------------- */

function renderAbout() {
  youDetail.innerHTML = `
    <p class="section-kicker">Passeport</p>
    <h2>Qui tu es</h2>

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

/* -------------------- EVENTS -------------------- */

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
