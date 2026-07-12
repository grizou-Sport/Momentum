/* =========================================================
   MOMENTUM — HOME BIEN-ÊTRE v1.0
   ---------------------------------------------------------
   Affiche les mesures brutes de la source, sans prétendre
   qu'un score Whoop et un score Coros sont interchangeables.
   ========================================================= */

function formatSleepDuration(hours) {
  const value = Number(hours);
  if (!Number.isFinite(value)) return "—";

  const wholeHours = Math.floor(value);
  const minutes = Math.round((value - wholeHours) * 60);
  return `${wholeHours} h ${String(minutes).padStart(2, "0")}`;
}

function wellbeingMetric(label, value, unit = "") {
  const hasValue = value !== null && value !== undefined && value !== "";

  return `
    <div class="wellbeing-metric${hasValue ? "" : " is-empty"}">
      <span>${escapeHtml(label)}</span>
      <strong>${hasValue ? escapeHtml(value) : "—"}${hasValue && unit ? ` <small>${escapeHtml(unit)}</small>` : ""}</strong>
    </div>
  `;
}

function mapDailyWellbeingRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    source: row.source_label || row.source || "Source inconnue",
    sourceKey: row.source || "manual",
    sleep: row.sleep_hours,
    motivation: row.motivation,
    restHr: row.resting_hr,
    hrv: row.hrv_ms,
    sleepQuality: row.sleep_quality_value,
    sleepQualityUnit: row.sleep_quality_unit || "%"
  };
}

function dailyWellbeingPayload(userId, date, wellbeing) {
  return {
    user_id: userId,
    recorded_date: date,
    sleep_hours: wellbeing.sleep,
    motivation: wellbeing.motivation,
    resting_hr: wellbeing.restHr,
    hrv_ms: wellbeing.hrv,
    sleep_quality_value: wellbeing.sleepQuality,
    sleep_quality_unit: wellbeing.sleepQualityUnit || "%",
    source: wellbeing.sourceKey || "manual",
    source_label: wellbeing.source || "Ajout manuel",
    updated_at: new Date().toISOString()
  };
}

async function loadDailyWellbeing(date = iso(new Date())) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await window.momentumDB
    .from("daily_wellbeing")
    .select("id,recorded_date,sleep_hours,motivation,resting_hr,hrv_ms,sleep_quality_value,sleep_quality_unit,source,source_label")
    .eq("user_id", user.id)
    .eq("recorded_date", date)
    .maybeSingle();

  if (error) {
    console.error("HOME : impossible de charger le bien-être quotidien.", error);
    return state.wellbeing?.[date] || null;
  }

  if (data) {
    state.wellbeing = state.wellbeing || {};
    state.wellbeing[date] = mapDailyWellbeingRow(data);
    return state.wellbeing[date];
  }

  const localWellbeing = state.wellbeing?.[date];
  if (!localWellbeing) return null;

  const normalizedLocal = {
    ...localWellbeing,
    source: localWellbeing.source || "Ajout manuel",
    sourceKey: localWellbeing.sourceKey || "manual"
  };

  const { data: migrated, error: migrationError } = await window.momentumDB
    .from("daily_wellbeing")
    .upsert(dailyWellbeingPayload(user.id, date, normalizedLocal), {
      onConflict: "user_id,recorded_date"
    })
    .select()
    .single();

  if (migrationError) {
    console.error("HOME : migration de la saisie locale impossible.", migrationError);
    return localWellbeing;
  }

  state.wellbeing[date] = mapDailyWellbeingRow(migrated);
  saveState();
  return state.wellbeing[date];
}

function renderWellbeingCard(date = iso(new Date())) {
  const element = $("#wellbeingCard");
  if (!element) return;

  const wellbeing = state.wellbeing?.[date] || {};
  const source = wellbeing.source || "Aucune source connectée";
  const sleepQuality = wellbeing.sleepQuality ?? wellbeing.sleep_quality;
  const sleepQualityUnit = wellbeing.sleepQualityUnit || wellbeing.sleep_quality_unit || "%";

  element.innerHTML = `
    <div class="wellbeing-heading">
      <div>
        <span class="card-label">Bien-être · aujourd'hui</span>
        <h3 id="wellbeingCardTitle">Le corps au réveil</h3>
      </div>
      <div class="wellbeing-actions">
        <span class="wellbeing-source">${escapeHtml(source)}</span>
        <button class="round-btn wellbeing-manual-toggle" type="button" data-wellbeing-manual>
          Ajout manuel
        </button>
      </div>
    </div>

    <div class="wellbeing-metrics">
      ${wellbeingMetric("Sommeil", wellbeing.sleep !== undefined ? formatSleepDuration(wellbeing.sleep) : null)}
      ${wellbeingMetric("Motivation au réveil", wellbeing.motivation ?? wellbeing.mood, (wellbeing.motivation ?? wellbeing.mood) != null ? "/ 10" : "")}
      ${wellbeingMetric("FC au repos", wellbeing.restHr ?? wellbeing.rest_hr, "bpm")}
      ${wellbeingMetric("Variabilité de la FC", wellbeing.hrv, "ms")}
      ${wellbeingMetric("Qualité du sommeil", sleepQuality, sleepQuality != null ? sleepQualityUnit : "")}
    </div>

    <p class="wellbeing-note">
      La qualité reste affichée selon sa source. Une future note Momentum pourra la normaliser séparément, sans mélanger les échelles Whoop et Coros.
    </p>

    <p class="wellbeing-save-message" data-wellbeing-message aria-live="polite"></p>

    <form class="wellbeing-manual-form" data-wellbeing-form hidden>
      <label>Sommeil (heures)<input name="sleep" type="number" min="0" max="24" step="0.1" value="${escapeHtml(wellbeing.sleep ?? "")}"></label>
      <label>Motivation (/10)<input name="motivation" type="number" min="1" max="10" step="1" value="${escapeHtml(wellbeing.motivation ?? wellbeing.mood ?? "")}"></label>
      <label>FC au repos (bpm)<input name="restHr" type="number" min="20" max="220" step="1" value="${escapeHtml(wellbeing.restHr ?? wellbeing.rest_hr ?? "")}"></label>
      <label>VFC (ms)<input name="hrv" type="number" min="0" step="1" value="${escapeHtml(wellbeing.hrv ?? "")}"></label>
      <label>Qualité du sommeil (%)<input name="sleepQuality" type="number" min="0" max="100" step="1" value="${escapeHtml(sleepQuality ?? "")}"></label>
      <div class="wellbeing-form-actions">
        <button class="secondary" type="button" data-wellbeing-cancel>Annuler</button>
        <button class="primary" type="submit">Enregistrer</button>
      </div>
    </form>
  `;
}

function bindWellbeingCard() {
  const card = $("#wellbeingCard");
  if (!card) return;

  card.addEventListener("click", (event) => {
    const form = card.querySelector("[data-wellbeing-form]");
    if (!form) return;

    if (event.target.closest("[data-wellbeing-manual]")) {
      form.hidden = false;
      form.querySelector("input")?.focus();
    }

    if (event.target.closest("[data-wellbeing-cancel]")) {
      form.hidden = true;
    }
  });

  card.addEventListener("submit", async (event) => {
    if (!event.target.matches("[data-wellbeing-form]")) return;
    event.preventDefault();

    const date = iso(new Date());
    const entries = Object.fromEntries(new FormData(event.target));
    const value = (name) => entries[name] === "" ? null : Number(entries[name]);
    const submitButton = event.target.querySelector('[type="submit"]');
    const message = card.querySelector("[data-wellbeing-message]");
    const user = await getCurrentUser();

    if (!user) {
      if (message) message.textContent = "Session introuvable. Reconnecte-toi puis réessaie.";
      return;
    }

    const wellbeing = {
      source: "Ajout manuel",
      sourceKey: "manual",
      sleep: value("sleep"),
      motivation: value("motivation"),
      restHr: value("restHr"),
      hrv: value("hrv"),
      sleepQuality: value("sleepQuality"),
      sleepQualityUnit: "%"
    };

    if (submitButton) submitButton.disabled = true;
    if (message) message.textContent = "Enregistrement…";

    const { data, error } = await window.momentumDB
      .from("daily_wellbeing")
      .upsert(dailyWellbeingPayload(user.id, date, wellbeing), {
        onConflict: "user_id,recorded_date"
      })
      .select()
      .single();

    if (error) {
      console.error("HOME : impossible d'enregistrer le bien-être.", error);
      if (submitButton) submitButton.disabled = false;
      if (message) message.textContent = `Enregistrement impossible : ${error.message}`;
      return;
    }

    state.wellbeing = state.wellbeing || {};
    state.wellbeing[date] = mapDailyWellbeingRow(data);
    saveState();
    renderWellbeingCard(date);
  });
}
