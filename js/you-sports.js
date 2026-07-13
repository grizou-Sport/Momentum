function renderSports() {
  const activeSports = YOU.sportProfile || [];

  YOU.detail.innerHTML = `
    <p class="section-kicker">Je vis pour</p>
    <h2>Tes terrains d’expression</h2>
    <p class="you-detail-lead">
      Ton questionnaire pose le point de départ. Tes activités racontent ensuite la place réelle de chaque sport dans ta vie.
    </p>

    ${
      activeSports.length
        ? `
          <div class="you-card-grid">
            ${activeSports
              .map((sport) => `
                <div class="you-small-card sport-practice-card${sport.level === "regular" ? " active" : ""}" data-practice-level="${sport.level}">
                  <span>${window.MomentumIcons?.renderSport(sport.id, { size: 28 }) || "•"}</span>
                  <strong>${sport.label}</strong>
                  <em>${sport.levelLabel} · ${sport.sessionCount ? `${sport.sessionCount} séance${sport.sessionCount > 1 ? "s" : ""} sur 12 mois` : sport.questionnaireRole === "Principal" ? "terrain principal du questionnaire" : "choisi lors du questionnaire"}</em>
                </div>
              `)
              .join("")}
          </div>
        `
        : `
          <div class="you-note-box">
            <span>Momentum observe</span>
            <p>Choisis tes premiers terrains dans le questionnaire. Ils évolueront ensuite naturellement avec tes activités.</p>
          </div>
        `
    }
  `;
}
