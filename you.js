const youDetail = document.getElementById("youDetail");
const youButtons = document.querySelectorAll("[data-you-section]");
const logoutBtn = document.getElementById("logoutBtn");

let currentUser = null;
let passport = null;

function calculateAge(birthYear) {
  if (!birthYear) return "—";
  return `${new Date().getFullYear() - birthYear} ans`;
}

function renderPassportCard() {
  const name = passport?.display_name || currentUser?.email || "—";

  document.getElementById("passportName").textContent = name;

  document.getElementById("passportLocation").textContent =
    [passport?.city, passport?.country].filter(Boolean).join(", ") || "—";

  document.getElementById("passportQuote").textContent =
    `“${passport?.quote || "Écris la prochaine ligne."}”`;

  document.getElementById("passportAge").textContent =
    calculateAge(passport?.birth_year);

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
  renderSection("about");
}

function renderSection(section) {
  youButtons.forEach((b) => b.classList.remove("active"));
  document
    .querySelector(`[data-you-section="${section}"]`)
    ?.classList.add("active");

  if (section === "about") {
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

        <label class="full">Photo / avatar URL
  <input name="avatar_url" value="${passport?.avatar_url || ""}" />
</label>

        <button class="login-primary full" type="submit">Enregistrer</button>
        <p id="passportMessage" class="login-message full"></p>
      </form>
    `;

    document.getElementById("passportForm").addEventListener("submit", savePassport);
    return;
  }

  const sections = {
    mission: ["Mission actuelle", "Amsterdam Marathon 2026"],
    sports: ["Sports", "Tes terrains d’expression."],
    equipment: ["Équipement", "Ton matériel."],
    wellbeing: ["Bien-être", "Ton état intérieur."],
    data: ["Données", "Ajouter une activité, importer ou exporter."],
    collections: ["Collections", "Les chapitres importants."],
  };

  const [title, text] = sections[section];

  youDetail.innerHTML = `
    <p class="section-kicker">${title}</p>
    <h2>${title}</h2>
    <p class="you-detail-lead">${text}</p>
  `;
}

async function savePassport(event) {
  event.preventDefault();

  const form = new FormData(event.target);
  const message = document.getElementById("passportMessage");

  const updates = {
    display_name: form.get("display_name")?.trim(),
    avatar_url: form.get("avatar_url")?.trim(),
    city: form.get("city")?.trim(),
    country: form.get("country")?.trim(),
    quote: form.get("quote")?.trim(),
    birth_year: form.get("birth_year") ? Number(form.get("birth_year")) : null,
    height_cm: form.get("height_cm") ? Number(form.get("height_cm")) : null,
    weight_kg: form.get("weight_kg") ? Number(form.get("weight_kg")) : null,
    updated_at: new Date().toISOString(),
  };

  message.textContent = "Sauvegardé.";

setTimeout(() => {
  message.textContent = "";
}, 1800);

  const { data, error } = await window.momentumDB
    .from("passports")
    .update(updates)
    .eq("user_id", currentUser.id)
    .select()
    .single();

  if (error) {
    message.textContent = error.message;
    return;
  }

  passport = data;
  renderPassportCard();
  message.textContent = "Sauvegardé.";
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