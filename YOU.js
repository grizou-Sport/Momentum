async function loadPassport() {
  const { data: sessionData } = await momentumDB.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) return;

  const { data, error } = await momentumDB
    .from("passports")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) {
    console.error("Erreur passeport :", error);
    return;
  }

  document.getElementById("passportName").textContent =
    data.display_name || user.email;

  document.getElementById("passportLocation").textContent =
    data.country || "—";

  document.getElementById("passportQuote").textContent =
    `“${data.quote || "Écris la prochaine ligne."}”`;
}

loadPassport();

const youDetail = document.getElementById("youDetail");
const youButtons = document.querySelectorAll("[data-you-section]");

const youSections = {
  mission: `
    <p class="section-kicker">Mission actuelle</p>
    <h2>Amsterdam Marathon 2026</h2>
    <p class="you-detail-lead">Objectif principal de la saison.</p>
    <div class="you-progress-line"><i style="width:67%"></i></div>
    <div class="you-detail-stats">
      <div><span>Distance objectif</span><strong>42,195 km</strong></div>
      <div><span>Temps objectif</span><strong>2h59'59</strong></div>
      <div><span>Allure cible</span><strong>4'15/km</strong></div>
      <div><span>Progression</span><strong>67 %</strong></div>
    </div>
    <div class="you-note-box">
      <span>Notes personnelles</span>
      <p>Discipline aujourd’hui, liberté demain.</p>
    </div>
  `,

  sports: `
    <p class="section-kicker">Sports</p>
    <h2>Tes terrains d’expression</h2>
    <div class="you-list">
      <p><strong>Course à pied</strong><span>Principal</span></p>
      <p><strong>Vélo</strong><span>Secondaire</span></p>
      <p><strong>Randonnée</strong><span>Ponctuel</span></p>
    </div>
  `,

  equipment: `
    <p class="section-kicker">Équipement</p>
    <h2>Ton matériel</h2>
    <div class="you-list">
      <p><strong>COROS Apex 4</strong><span>Montre</span></p>
      <p><strong>WHOOP 4.0</strong><span>Capteur</span></p>
      <p><strong>Adidas Adizero Pro 4</strong><span>Chaussures</span></p>
      <p><strong>BMC Roadmachine</strong><span>Vélo</span></p>
    </div>
  `,

  wellbeing: `
    <p class="section-kicker">Bien-être</p>
    <h2>Ton état intérieur</h2>
    <div class="you-list">
      <p><strong>Sommeil</strong><span>7h42</span></p>
      <p><strong>Énergie</strong><span>72 %</span></p>
      <p><strong>Humeur</strong><span>Positive</span></p>
      <p><strong>Stress</strong><span>Modéré</span></p>
      <p><strong>VFC moyenne</strong><span>68 ms</span></p>
    </div>
  `,

  data: `
    <p class="section-kicker">Données</p>
    <h2>Ajouter une activité</h2>
    <div class="you-list">
      <p><strong>Remplir manuellement</strong><span>Disponible</span></p>
      <p><strong>Importer un fichier</strong><span>.fit, .gpx, .tcx</span></p>
      <p><strong>Exporter mes données</strong><span>Sauvegarde</span></p>
    </div>
  `,

  collections: `
    <p class="section-kicker">Collections</p>
    <h2>Les chapitres importants</h2>
    <div class="you-list">
      <p><strong>Levers de soleil</strong><span>18</span></p>
      <p><strong>100 km de Bienne</strong><span>1</span></p>
      <p><strong>Courses</strong><span>12</span></p>
      <p><strong>Lieux</strong><span>7</span></p>
    </div>
  `,

  about: `
    <p class="section-kicker">À propos de toi</p>
    <h2>Ton passeport</h2>
    <div class="you-list">
      <p><strong>Nom</strong><span>Chris Gyger</span></p>
      <p><strong>Lieu</strong><span>Suisse 🇨🇭</span></p>
      <p><strong>Âge</strong><span>48 ans</span></p>
      <p><strong>Taille</strong><span>177 cm</span></p>
      <p><strong>Poids</strong><span>76 kg</span></p>
    </div>
  `,
};

youButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const section = button.dataset.youSection;

    youButtons.forEach((b) => b.classList.remove("active"));
    button.classList.add("active");

    youDetail.innerHTML = youSections[section];
  });
});
