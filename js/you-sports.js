function renderSports() {
  const activeSports = YOU.userSports
    .filter((item) => item.active !== false)
    .map((item) => item.sports)
    .filter(Boolean);

  YOU.detail.innerHTML = `
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