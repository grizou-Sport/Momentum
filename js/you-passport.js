function renderPassportCard() {
  const name = YOU.passport?.display_name || YOU.currentUser?.email || "—";

  document.getElementById("passportName").textContent = name;
  document.getElementById("passportLocation").textContent =
    [YOU.passport?.city, YOU.passport?.country].filter(Boolean).join(", ") || "—";
  document.getElementById("passportQuote").textContent =
    `“${YOU.passport?.quote || "Écris la prochaine ligne."}”`;

  document.getElementById("passportAge").textContent =
    calculateAge(YOU.passport?.birth_date, YOU.passport?.birth_year);
  document.getElementById("passportHeight").textContent =
    YOU.passport?.height_cm ? `${YOU.passport.height_cm} cm` : "—";
  document.getElementById("passportWeight").textContent =
    YOU.passport?.weight_kg ? `${YOU.passport.weight_kg} kg` : "—";

  const avatar = document.getElementById("passportAvatar");
  const fallback = nameInitials(name);

  if (YOU.passport?.avatar_url) {
    const image = document.createElement("img");
    image.src = YOU.passport.avatar_url;
    image.alt = name;
    image.addEventListener("error", () => {
      avatar.replaceChildren();
      avatar.textContent = fallback;
    }, { once:true });
    avatar.replaceChildren(image);
  } else {
    avatar.textContent = fallback;
  }
}

function renderAbout() {
  YOU.detail.innerHTML = `
    <p class="section-kicker">Passeport</p>
    <h2>Qui tu es</h2>

    <form id="passportForm" class="you-form">
      <label>Nom complet
        <input name="display_name" value="${YOU.passport?.display_name || ""}" />
      </label>

      <label>Ville
        <input name="city" value="${YOU.passport?.city || ""}" />
      </label>

      <label>Pays
        <input name="country" value="${YOU.passport?.country || ""}" />
      </label>

      <label>Date de naissance
        <input name="birth_date" type="date" value="${YOU.passport?.birth_date || ""}" />
      </label>

      <label>Sexe
        <select name="sex"><option value="">Ne pas préciser</option><option value="FEMALE" ${YOU.passport?.sex === "FEMALE" ? "selected" : ""}>Femme</option><option value="MALE" ${YOU.passport?.sex === "MALE" ? "selected" : ""}>Homme</option><option value="OTHER" ${YOU.passport?.sex === "OTHER" ? "selected" : ""}>Autre</option><option value="UNDISCLOSED" ${YOU.passport?.sex === "UNDISCLOSED" ? "selected" : ""}>Préfère ne pas répondre</option></select>
      </label>

      <label>Taille cm
        <input name="height_cm" type="number" value="${YOU.passport?.height_cm || ""}" />
      </label>

      <label>Poids kg
        <input name="weight_kg" type="number" step="0.1" value="${YOU.passport?.weight_kg || ""}" />
      </label>

      <div class="full you-form-divider"><span class="section-kicker">Profil sportif</span></div>
      <label>Niveau déclaré
        <select name="sport_level"><option value="">Choisir</option><option value="BEGINNER" ${YOU.passport?.sport_level === "BEGINNER" ? "selected" : ""}>Débutant</option><option value="RETURNING" ${YOU.passport?.sport_level === "RETURNING" ? "selected" : ""}>Reprise</option><option value="REGULAR" ${YOU.passport?.sport_level === "REGULAR" ? "selected" : ""}>Régulier</option><option value="COMPETITOR" ${YOU.passport?.sport_level === "COMPETITOR" ? "selected" : ""}>Compétiteur</option><option value="EXPERT" ${YOU.passport?.sport_level === "EXPERT" ? "selected" : ""}>Expert</option></select>
      </label>
      <label>Séances moyennes par semaine<input name="weekly_sessions" type="number" min="0" max="30" value="${YOU.passport?.habits?.weekly_sessions ?? ""}" /></label>
      <label>Heures moyennes par semaine<input name="weekly_hours" type="number" min="0" max="100" step="0.5" value="${YOU.passport?.habits?.weekly_hours ?? ""}" /></label>
      <label>Jours favoris<input name="favorite_days" value="${(YOU.passport?.habits?.favorite_days || []).join(", ")}" placeholder="Mardi, jeudi, dimanche" /></label>

      <div class="full you-form-divider"><span class="section-kicker">Objectifs & sources</span></div>
      <label>Objectif principal<select name="primary_objective"><option value="">Choisir</option>${["Santé","Performance","Compétition","Aventure","Plaisir"].map((item) => `<option ${YOU.passport?.objectives?.primary === item ? "selected" : ""}>${item}</option>`).join("")}</select></label>
      <label>Sources déclarées<input name="connected_sources" value="${Object.keys(YOU.passport?.connected_sources || {}).filter((key) => YOU.passport.connected_sources[key]).join(", ")}" placeholder="COROS, Garmin, Strava…" /></label>

      <label class="full">Phrase
        <textarea name="quote" rows="3">${YOU.passport?.quote || ""}</textarea>
      </label>

      <div class="full you-avatar-field">
        <div class="you-avatar-form-preview" data-avatar-form-preview>
          ${YOU.passport?.avatar_url ? `<img src="${YOU.passport.avatar_url}" alt="" />` : `<span>${nameInitials(YOU.passport?.display_name || YOU.currentUser?.email)}</span>`}
        </div>
        <label>Photo de profil
          <span class="you-avatar-help">Choisis une image, puis zoome et déplace-la pour définir le cadrage.</span>
          <input name="avatar_file" type="file" accept="image/jpeg,image/png,image/webp" />
        </label>
      </div>

      <button class="login-primary full" type="submit">Enregistrer</button>
      <p id="passportMessage" class="login-message full"></p>
    </form>
  `;

  const passportForm = document.getElementById("passportForm");
  YOU.pendingAvatarBlob = null;
  passportForm.addEventListener("submit", savePassport);
  passportForm.elements.avatar_file.addEventListener("change", prepareAvatarCrop);
  const formPreviewImage = passportForm.querySelector("[data-avatar-form-preview] img");
  formPreviewImage?.addEventListener("error", () => {
    const preview = passportForm.querySelector("[data-avatar-form-preview]");
    preview.replaceChildren();
    preview.textContent = nameInitials(YOU.passport?.display_name || YOU.currentUser?.email);
  }, { once:true });
}

function nameInitials(name) {
  return String(name || "YOU").trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

async function prepareAvatarCrop(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const cropped = await window.MomentumAvatarCropper.open(file);
    if (!cropped) {
      input.value = "";
      return;
    }
    YOU.pendingAvatarBlob = cropped;
    const preview = document.querySelector("[data-avatar-form-preview]");
    const url = URL.createObjectURL(cropped);
    preview.innerHTML = `<img src="${url}" alt="Aperçu de la nouvelle photo" />`;
    preview.querySelector("img").addEventListener("load", () => URL.revokeObjectURL(url), { once:true });
  } catch (error) {
    console.error("YOU : impossible de préparer cette photo.", error);
    const message = document.getElementById("passportMessage");
    if (message) message.textContent = "Cette photo n’a pas pu être préparée. Essaie à nouveau ou choisis une autre image.";
    input.value = "";
  }
}

async function uploadAvatar(file) {
  if (!file) return YOU.passport?.avatar_url || null;

  const fileName = `${YOU.currentUser.id}-${Date.now()}.jpg`;
  const filePath = `${YOU.currentUser.id}/${fileName}`;

  const { error } = await window.momentumDB.storage
    .from("avatars")
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: "image/jpeg",
      upsert: false,
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
    const avatarFile = YOU.pendingAvatarBlob;

    const avatarUrl =
      avatarFile && avatarFile.size > 0
        ? await uploadAvatar(avatarFile)
        : YOU.passport?.avatar_url || null;

    const updates = {
      display_name: form.get("display_name")?.trim(),
      avatar_url: avatarUrl,
      city: form.get("city")?.trim(),
      country: form.get("country")?.trim(),
      quote: form.get("quote")?.trim(),
      birth_date: form.get("birth_date") || null,
      birth_year: form.get("birth_date") ? Number(String(form.get("birth_date")).slice(0, 4)) : null,
      sex: form.get("sex") || null,
      sport_level: form.get("sport_level") || null,
      habits: {
        weekly_sessions: form.get("weekly_sessions") ? Number(form.get("weekly_sessions")) : null,
        weekly_hours: form.get("weekly_hours") ? Number(form.get("weekly_hours")) : null,
        favorite_days: String(form.get("favorite_days") || "").split(",").map((item) => item.trim()).filter(Boolean),
      },
      objectives: { ...(YOU.passport?.objectives || {}), primary: form.get("primary_objective") || null },
      connected_sources: Object.fromEntries(String(form.get("connected_sources") || "").split(",").map((item) => item.trim()).filter(Boolean).map((item) => [item, true])),
      height_cm: form.get("height_cm") ? Number(form.get("height_cm")) : null,
      weight_kg: form.get("weight_kg") ? Number(form.get("weight_kg")) : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await window.momentumDB
      .from("passports")
      .update(updates)
      .eq("user_id", YOU.currentUser.id)
      .select()
      .single();

    if (error) throw error;

    YOU.passport = data;

    renderPassportCard();
    renderMenuPreviews();
    YOU.pendingAvatarBlob = null;
    window.dispatchEvent(new CustomEvent("momentum:avatar-updated"));

    message.textContent = "Sauvegardé.";
    setTimeout(() => {
      message.textContent = "";
    }, 1800);
  } catch (error) {
    console.error(error);
    message.textContent = window.MomentumUI.errorMessage(error, "save");
  }
}
