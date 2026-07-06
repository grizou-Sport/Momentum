function renderActivities() {
  YOU.detail.innerHTML = `
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
