function renderWellbeing() {
  YOU.detail.innerHTML = `
    <p class="section-kicker">Mon équilibre</p>
    <h2>Ton état du moment</h2>
    <p class="you-detail-lead">Sommeil, récupération, poids, sensations et énergie.</p>

    <div class="you-detail-stats">
      <div><span>Âge</span><strong>${calculateAge(YOU.passport?.birth_date, YOU.passport?.birth_year)}</strong></div>
      <div><span>Taille</span><strong>${YOU.passport?.height_cm ? YOU.passport.height_cm + " cm" : "—"}</strong></div>
      <div><span>Poids</span><strong>${YOU.passport?.weight_kg ? YOU.passport.weight_kg + " kg" : "—"}</strong></div>
      <div><span>FC max</span><strong>${YOU.wellbeingProfile?.max_hr ? YOU.wellbeingProfile.max_hr + " bpm" : "—"}</strong></div>
      <div><span>FC repos</span><strong>${YOU.wellbeingProfile?.resting_hr ? YOU.wellbeingProfile.resting_hr + " bpm" : "—"}</strong></div>
      <div><span>VO₂max</span><strong>${safe(YOU.wellbeingProfile?.vo2max)}</strong></div>
    </div>

    <button class="primary" id="editWellbeingBtn" type="button">
      Modifier
    </button>
  `;

  document.getElementById("editWellbeingBtn").addEventListener("click", renderWellbeingForm);
}

function renderWellbeingForm() {
  YOU.detail.innerHTML = `
    <p class="section-kicker">Mon équilibre</p>
    <h2>Profil physiologique</h2>

    <form id="wellbeingForm" class="you-form">
      <label>FC max
        <input name="max_hr" type="number" value="${YOU.wellbeingProfile?.max_hr || ""}" />
      </label>

      <label>FC repos
        <input name="resting_hr" type="number" value="${YOU.wellbeingProfile?.resting_hr || ""}" />
      </label>

      <label>VO₂max
        <input name="vo2max" type="number" step="0.1" value="${YOU.wellbeingProfile?.vo2max || ""}" />
      </label>

      <label>Sommeil cible
        <duration-picker name="preferred_sleep_minutes" value="${YOU.wellbeingProfile?.preferred_sleep_hours == null ? "" : Math.round(YOU.wellbeingProfile.preferred_sleep_hours * 60)}" aria-label="Durée de sommeil cible"></duration-picker>
      </label>

      <label class="full">Notes
        <textarea name="notes" rows="3">${YOU.wellbeingProfile?.notes || ""}</textarea>
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
    user_id: YOU.currentUser.id,
    max_hr: form.get("max_hr") ? Number(form.get("max_hr")) : null,
    resting_hr: form.get("resting_hr") ? Number(form.get("resting_hr")) : null,
    vo2max: form.get("vo2max") ? Number(form.get("vo2max")) : null,
    preferred_sleep_hours: form.get("preferred_sleep_minutes")
      ? Number(form.get("preferred_sleep_minutes")) / 60
      : null,
    notes: form.get("notes")?.trim(),
    updated_at: new Date().toISOString(),
  };

  const result = YOU.wellbeingProfile?.id
    ? await window.momentumDB
        .from("wellbeing_profile")
        .update(payload)
        .eq("id", YOU.wellbeingProfile.id)
        .select()
        .single()
    : await window.momentumDB
        .from("wellbeing_profile")
        .insert(payload)
        .select()
        .single();

  if (result.error) {
    console.error(result.error);
    message.textContent = window.MomentumUI.errorMessage(result.error, "save");
    return;
  }

  YOU.wellbeingProfile = result.data;
  renderMenuPreviews();

  message.textContent = "Sauvegardé.";
  setTimeout(renderWellbeing, 700);
}
