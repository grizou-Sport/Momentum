/* =========================================================
   MOMENTUM — HOME BIEN-ÊTRE v1.0
   ---------------------------------------------------------
   Affiche les mesures brutes de la source, sans prétendre
   qu'un score Whoop et un score Coros sont interchangeables.
   ========================================================= */

function formatSleepDuration(hours) {
  const value = Number(hours);
  if (!Number.isFinite(value)) return "—";

  const totalMinutes = Math.round(value * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${wholeHours}h ${String(minutes).padStart(2, "0")}min`;
}

function splitSleepDuration(hours) {
  const value = Number(hours);
  if (!Number.isFinite(value)) return { hours:"", minutes:"" };
  const totalMinutes = Math.round(value * 60);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
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

function mapDailyWellbeingRow(row, dayRow = null) {
  if (!row && !dayRow) return null;

  return {
    id: row?.id,
    source: row?.source_label || row?.source || (dayRow ? "Journal Momentum" : "Source inconnue"),
    sourceKey: row?.source || "manual",
    sleep: row?.sleep_hours ?? dayRow?.sleep_hours ?? null,
    motivation: row?.motivation ?? null,
    mood: dayRow?.mood ?? null,
    energy: dayRow?.energy ?? row?.motivation ?? null,
    restHr: row?.resting_hr ?? dayRow?.rest_hr ?? null,
    hrv: row?.hrv_ms ?? dayRow?.hrv ?? null,
    sleepQuality: row?.sleep_quality_value ?? null,
    sleepQualityUnit: row?.sleep_quality_unit || "%",
    note: dayRow?.note || ""
  };
}

function wellbeingHasData(wellbeing) {
  if (!wellbeing) return false;
  return ["sleep", "motivation", "mood", "energy", "restHr", "hrv", "sleepQuality"]
    .some((key) => wellbeing[key] !== null && wellbeing[key] !== undefined && wellbeing[key] !== "");
}

function wellbeingSummaryHtml(wellbeing) {
  if (!wellbeingHasData(wellbeing)) {
    return `<p class="day-wellbeing-empty">Aucune donnée de bien-être pour cette journée.</p>`;
  }

  const recovery = wellbeing.sleepQuality;
  return `
    <div class="day-wellbeing-grid">
      <div><span>Sommeil</span><strong>${wellbeing.sleep == null ? "—" : escapeHtml(formatSleepDuration(wellbeing.sleep))}</strong></div>
      <div><span>Énergie</span><strong>${wellbeing.energy == null ? "—" : `${escapeHtml(wellbeing.energy)} / 10`}</strong></div>
      <div><span>Humeur</span><strong>${wellbeing.mood == null ? "—" : `${escapeHtml(wellbeing.mood)} / 10`}</strong></div>
      <div><span>Récupération</span><strong>${recovery == null ? "—" : `${escapeHtml(recovery)} ${escapeHtml(wellbeing.sleepQualityUnit || "%")}`}</strong></div>
    </div>
    ${(wellbeing.restHr != null || wellbeing.hrv != null) ? `
      <p class="day-wellbeing-physiology">
        ${wellbeing.restHr != null ? `FC repos ${escapeHtml(wellbeing.restHr)} bpm` : ""}
        ${(wellbeing.restHr != null && wellbeing.hrv != null) ? " · " : ""}
        ${wellbeing.hrv != null ? `VFC ${escapeHtml(wellbeing.hrv)} ms` : ""}
      </p>
    ` : ""}
    ${wellbeing.note ? `<p class="day-wellbeing-note">${escapeHtml(wellbeing.note)}</p>` : ""}
  `;
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

  const [dailyResult, dayResult] = await Promise.all([
    window.momentumDB
      .from("daily_wellbeing")
      .select("id,recorded_date,sleep_hours,motivation,resting_hr,hrv_ms,sleep_quality_value,sleep_quality_unit,source,source_label")
      .eq("user_id", user.id)
      .eq("recorded_date", date)
      .maybeSingle(),
    window.momentumDB
      .from("days")
      .select("day_date,note,mood,energy,sleep_hours,rest_hr,hrv")
      .eq("user_id", user.id)
      .eq("day_date", date)
      .maybeSingle()
  ]);

  if (dailyResult.error) {
    console.error("HOME : impossible de charger le bien-être quotidien.", dailyResult.error);
  }
  if (dayResult.error) {
    console.error("HOME : impossible de charger le résumé du journal.", dayResult.error);
  }
  if (dailyResult.error && dayResult.error) {
    return state.wellbeing?.[date] || null;
  }

  if (dailyResult.data || dayResult.data) {
    state.wellbeing = state.wellbeing || {};
    state.wellbeing[date] = mapDailyWellbeingRow(dailyResult.data, dayResult.data);
    return state.wellbeing[date];
  }

  const localWellbeing = state.wellbeing?.[date];
  if (!localWellbeing) return null;

  const normalizedLocal = {
    ...localWellbeing,
    source: localWellbeing.source || "Ajout manuel",
    sourceKey: localWellbeing.sourceKey || "manual"
  };

  const [migrationResult, dayMigrationResult] = await Promise.all([
    window.momentumDB
      .from("daily_wellbeing")
      .upsert(dailyWellbeingPayload(user.id, date, normalizedLocal), {
        onConflict: "user_id,recorded_date"
      })
      .select()
      .single(),
    saveDayWellbeing(user.id, date, normalizedLocal)
  ]);

  const migrationError = migrationResult.error || dayMigrationResult.error;
  if (migrationError) {
    console.error("HOME : migration de la saisie locale impossible.", migrationError);
    return localWellbeing;
  }

  state.wellbeing[date] = mapDailyWellbeingRow(migrationResult.data, dayMigrationResult.data);
  saveState();
  return state.wellbeing[date];
}

async function saveDayWellbeing(userId, date, wellbeing) {
  const payload = {
    user_id: userId,
    day_date: date,
    sleep_hours: wellbeing.sleep,
    mood: wellbeing.mood,
    energy: wellbeing.energy,
    rest_hr: wellbeing.restHr,
    hrv: wellbeing.hrv
  };

  const { data: existing, error: readError } = await window.momentumDB
    .from("days")
    .select("user_id,day_date")
    .eq("user_id", userId)
    .eq("day_date", date)
    .maybeSingle();

  if (readError) return { data:null, error:readError };

  const query = existing
    ? window.momentumDB.from("days").update(payload).eq("user_id", userId).eq("day_date", date)
    : window.momentumDB.from("days").insert(payload);

  return query.select("day_date,note,mood,energy,sleep_hours,rest_hr,hrv").single();
}

function renderWellbeingCard(date = iso(new Date())) {
  const element = $("#wellbeingCard");
  if (!element) return;

  const wellbeing = state.wellbeing?.[date] || {};
  const source = wellbeing.source || "Aucune source connectée";
  const sleepQuality = wellbeing.sleepQuality ?? wellbeing.sleep_quality;
  const sleepQualityUnit = wellbeing.sleepQualityUnit || wellbeing.sleep_quality_unit || "%";
  const sleepDuration = splitSleepDuration(wellbeing.sleep);
  const hasData = wellbeingHasData(wellbeing);

  element.innerHTML = `
    <div class="wellbeing-heading">
      <div>
        <span class="card-label">Bien-être · aujourd'hui</span>
        <h3 id="wellbeingCardTitle">Le corps au réveil</h3>
      </div>
      <div class="wellbeing-actions">
        <span class="wellbeing-source">${escapeHtml(source)}</span>
        <button class="round-btn wellbeing-manual-toggle" type="button" data-wellbeing-manual="add">
          Ajouter des données
        </button>
        <button class="round-btn wellbeing-manual-toggle" type="button" data-wellbeing-manual="edit">
          Modifier aujourd'hui
        </button>
      </div>
    </div>

    <div class="wellbeing-metrics">
      ${wellbeingMetric("Sommeil", wellbeing.sleep != null ? formatSleepDuration(wellbeing.sleep) : null)}
      ${wellbeingMetric("Motivation au réveil", wellbeing.motivation, wellbeing.motivation != null ? "/ 10" : "")}
      ${wellbeingMetric("Énergie", wellbeing.energy, wellbeing.energy != null ? "/ 10" : "")}
      ${wellbeingMetric("Humeur", wellbeing.mood, wellbeing.mood != null ? "/ 10" : "")}
      ${wellbeingMetric("FC au repos", wellbeing.restHr ?? wellbeing.rest_hr, "bpm")}
      ${wellbeingMetric("Variabilité de la FC", wellbeing.hrv, "ms")}
      ${wellbeingMetric("Qualité du sommeil", sleepQuality, sleepQuality != null ? sleepQualityUnit : "")}
    </div>

    <p class="wellbeing-note">
      La qualité reste affichée selon sa source. Une future note Momentum pourra la normaliser séparément, sans mélanger les échelles Whoop et Coros.
    </p>

    <p class="wellbeing-save-message" data-wellbeing-message aria-live="polite"></p>

    <form class="wellbeing-manual-form" data-wellbeing-form data-has-data="${hasData}" hidden>
      <label>Sommeil — heures<input name="sleepHours" type="number" min="0" max="24" step="1" value="${escapeHtml(sleepDuration.hours)}"></label>
      <label>Sommeil — minutes<input name="sleepMinutes" type="number" min="0" max="59" step="1" value="${escapeHtml(sleepDuration.minutes)}"></label>
      <label>Motivation (/10)<input name="motivation" type="number" min="1" max="10" step="1" value="${escapeHtml(wellbeing.motivation ?? "")}"></label>
      <label>Énergie (/10)<input name="energy" type="number" min="1" max="10" step="1" value="${escapeHtml(wellbeing.energy ?? "")}"></label>
      <label>Humeur (/10)<input name="mood" type="number" min="1" max="10" step="1" value="${escapeHtml(wellbeing.mood ?? "")}"></label>
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

    const toggle = event.target.closest("[data-wellbeing-manual]");
    if (toggle) {
      form.dataset.mode = toggle.dataset.wellbeingManual;
      if (toggle.dataset.wellbeingManual === "add") {
        form.querySelectorAll("input").forEach((input) => { input.value = ""; });
      } else {
        form.reset();
      }
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
    const isAdding = event.target.dataset.mode === "add";
    const existingWellbeing = state.wellbeing?.[date] || {};
    const valueOrExisting = (name, key = name) => value(name) ?? (isAdding ? existingWellbeing[key] ?? null : null);
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
      sleep: entries.sleepHours === "" && entries.sleepMinutes === "" ? (isAdding ? existingWellbeing.sleep ?? null : null) : (value("sleepHours") || 0) + (value("sleepMinutes") || 0) / 60,
      motivation: valueOrExisting("motivation"),
      energy: valueOrExisting("energy"),
      mood: valueOrExisting("mood"),
      restHr: valueOrExisting("restHr"),
      hrv: valueOrExisting("hrv"),
      sleepQuality: valueOrExisting("sleepQuality"),
      sleepQualityUnit: "%"
    };

    if (submitButton) submitButton.disabled = true;
    if (message) message.textContent = "Enregistrement…";

    const [dailyResult, dayResult] = await Promise.all([
      window.momentumDB
        .from("daily_wellbeing")
        .upsert(dailyWellbeingPayload(user.id, date, wellbeing), {
          onConflict: "user_id,recorded_date"
        })
        .select()
        .single(),
      saveDayWellbeing(user.id, date, wellbeing)
    ]);

    const error = dailyResult.error || dayResult.error;
    if (error) {
      console.error("HOME : impossible d'enregistrer le bien-être.", error);
      if (submitButton) submitButton.disabled = false;
      if (message) message.textContent = `Enregistrement impossible : ${error.message}`;
      return;
    }

    state.wellbeing = state.wellbeing || {};
    state.wellbeing[date] = mapDailyWellbeingRow(dailyResult.data, dayResult.data);
    saveState();
    renderWellbeingCard(date);
    await loadProgressionData();
  });
}
