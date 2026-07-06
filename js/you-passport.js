function renderPassportCard() {
  const name = YOU.passport?.display_name || YOU.currentUser?.email || "—";

  document.getElementById("passportName").textContent = name;
  document.getElementById("passportLocation").textContent =
    [YOU.passport?.city, YOU.passport?.country].filter(Boolean).join(", ") || "—";
  document.getElementById("passportQuote").textContent =
    `“${YOU.passport?.quote || "Écris la prochaine ligne."}”`;

  document.getElementById("passportAge").textContent =
    calculateAge(YOU.passport?.birth_year);
  document.getElementById("passportHeight").textContent =
    YOU.passport?.height_cm ? `${YOU.passport.height_cm} cm` : "—";
  document.getElementById("passportWeight").textContent =
    YOU.passport?.weight_kg ? `${YOU.passport.weight_kg} kg` : "—";

  const avatar = document.getElementById("passportAvatar");

  if (YOU.passport?.avatar_url) {
    avatar.innerHTML = `<img src="${YOU.passport.avatar_url}" alt="${name}" />`;
  } else {
    avatar.textContent = name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
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

      <label>Année de naissance
        <input name="birth_year" type="number" value="${YOU.passport?.birth_year || ""}" />
      </label>

      <label>Taille cm
        <input name="height_cm" type="number" value="${YOU.passport?.height_cm || ""}" />
      </label>

      <label>Poids kg
        <input name="weight_kg" type="number" step="0.1" value="${YOU.passport?.weight_kg || ""}" />
      </label>

      <label class="full">Phrase
        <textarea name="quote" rows="3">${YOU.passport?.quote || ""}</textarea>
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
  if (!file) return YOU.passport?.avatar_url || null;

  const fileExt = file.name.split(".").pop();
  const fileName = `${YOU.currentUser.id}-${Date.now()}.${fileExt}`;
  const filePath = `${YOU.currentUser.id}/${fileName}`;

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
        : YOU.passport?.avatar_url || null;

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
      .eq("user_id", YOU.currentUser.id)
      .select()
      .single();

    if (error) throw error;

    YOU.passport = data;

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