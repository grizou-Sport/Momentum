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

const SLEEP_QUALITY_LEVELS = [
  { value:1, label:"Mauvais" },
  { value:2, label:"Moins bien" },
  { value:3, label:"Bien" },
  { value:4, label:"Très bien" },
  { value:5, label:"Excellent" }
];

function sleepQualityLevel(value, unit = "%") {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;

  const normalizedUnit = String(unit || "").toLowerCase();
  const level = normalizedUnit === "qualitative-v1" || numericValue <= 5
    ? Math.round(numericValue)
    : Math.ceil(Math.max(0, Math.min(100, numericValue)) / 20);

  return Math.max(1, Math.min(5, level));
}

function sleepQualityLabel(value, unit = "%") {
  const level = sleepQualityLevel(value, unit);
  return SLEEP_QUALITY_LEVELS.find((item) => item.value === level)?.label || "—";
}

function sleepQualityScore(value, unit = "%") {
  const level = sleepQualityLevel(value, unit);
  return level == null ? null : level * 20;
}

function sleepQualityOptions(selectedLevel = null) {
  return [
    `<option value="">Non renseignée</option>`,
    ...SLEEP_QUALITY_LEVELS.map((item) => `
      <option value="${item.value}"${item.value === selectedLevel ? " selected" : ""}>
        ${escapeHtml(item.label)}
      </option>
    `)
  ].join("");
}

function mapDailyWellbeingRow(row, dayRow = null) {
  if (!row && !dayRow) return null;

  return {
    id: row?.id,
    source: row?.source_label || row?.source || (dayRow ? "Journal Momentum" : "Source inconnue"),
    sourceKey: row?.source || "manual",
    sleep: row?.sleep_hours ?? dayRow?.sleep_hours ?? null,
    motivation: row?.motivation ?? dayRow?.energy ?? null,
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
  return ["sleep", "motivation", "restHr", "hrv", "sleepQuality"]
    .some((key) => wellbeing[key] !== null && wellbeing[key] !== undefined && wellbeing[key] !== "");
}

function wellbeingSummaryHtml(wellbeing) {
  if (!wellbeingHasData(wellbeing)) {
    return `<p class="day-wellbeing-empty">Aucune donnée de bien-être pour cette journée.</p>`;
  }

  return `
    <div class="day-wellbeing-grid">
      <div><span>Sommeil</span><strong>${wellbeing.sleep == null ? "—" : escapeHtml(formatSleepDuration(wellbeing.sleep))}</strong></div>
      <div><span>Motivation au réveil</span><strong>${wellbeing.motivation == null ? "—" : `${escapeHtml(wellbeing.motivation)} / 10`}</strong></div>
      <div><span>Qualité du sommeil</span><strong>${escapeHtml(sleepQualityLabel(wellbeing.sleepQuality, wellbeing.sleepQualityUnit))}</strong></div>
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
  const hasData = wellbeingHasData(wellbeing);

  element.innerHTML = `
    <div class="wellbeing-heading">
      <div>
        <span class="card-label">Bien-être · aujourd'hui</span>
        <h3 id="wellbeingCardTitle">Le corps au réveil</h3>
      </div>
      <div class="wellbeing-actions">
        <span class="wellbeing-source">${escapeHtml(source)}</span>
        <button class="round-btn wellbeing-manual-toggle" type="button" data-wellbeing-open data-date="${escapeHtml(date)}">
          Ajouter des données
        </button>
      </div>
    </div>

    <div class="wellbeing-metrics">
      ${wellbeingMetric("Sommeil", wellbeing.sleep != null ? formatSleepDuration(wellbeing.sleep) : null)}
      ${wellbeingMetric("Motivation au réveil", wellbeing.motivation, wellbeing.motivation != null ? "/ 10" : "")}
      ${wellbeingMetric("FC au repos", wellbeing.restHr ?? wellbeing.rest_hr, "bpm")}
      ${wellbeingMetric("Variabilité de la FC", wellbeing.hrv, "ms")}
      ${wellbeingMetric("Qualité du sommeil", sleepQuality == null ? null : sleepQualityLabel(sleepQuality, wellbeing.sleepQualityUnit || wellbeing.sleep_quality_unit))}
    </div>
  `;

  element.querySelector("[data-wellbeing-open]").textContent = hasData
    ? "Modifier les données"
    : "Ajouter des données";
}

function bindWellbeingCard() {
  const card = $("#wellbeingCard");
  if (!card) return;

  card.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-wellbeing-open]");
    if (!button) return;
    await openWellbeingDialog(button.dataset.date || iso(new Date()));
  });
}

async function openWellbeingDialog(date, returnToDay = false) {
  const dialog = $("#wellbeingDialog");
  const form = $("#wellbeingDialogForm");
  const title = $("#wellbeingDialogTitle");
  const deleteButton = $("#deleteWellbeing");
  if (!dialog || !form) return;

  const wellbeing = await loadDailyWellbeing(date) || {};
  const sleepDuration = splitSleepDuration(wellbeing.sleep);
  const qualityLevel = sleepQualityLevel(
    wellbeing.sleepQuality ?? wellbeing.sleep_quality,
    wellbeing.sleepQualityUnit || wellbeing.sleep_quality_unit
  );

  form.reset();
  form.elements.recordedDate.value = date;
  form.elements.sleepHours.value = sleepDuration.hours;
  form.elements.sleepMinutes.value = sleepDuration.minutes;
  form.elements.motivation.value = wellbeing.motivation ?? "";
  form.elements.restHr.value = wellbeing.restHr ?? wellbeing.rest_hr ?? "";
  form.elements.hrv.value = wellbeing.hrv ?? "";
  form.elements.sleepQuality.innerHTML = sleepQualityOptions(qualityLevel);
  form.dataset.returnToDay = returnToDay ? date : "";

  const hasData = wellbeingHasData(wellbeing);
  if (title) title.textContent = hasData ? "Modifier le bien-être" : "Ajouter le bien-être";
  if (deleteButton) deleteButton.hidden = !hasData;
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = false;
  setWellbeingDialogMessage("");
  openHomeDialog(dialog);
}

function setWellbeingDialogMessage(message, isError = false) {
  const element = $("#wellbeingDialogMessage");
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

async function saveWellbeing(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const date = form.elements.recordedDate.value;
    const entries = Object.fromEntries(new FormData(form));
    const value = (name) => entries[name] === "" ? null : Number(entries[name]);
    const submitButton = form.querySelector('[type="submit"]');
    const user = await getCurrentUser();

    if (!user) {
      setWellbeingDialogMessage("Session introuvable. Reconnecte-toi puis réessaie.", true);
      return;
    }

    const wellbeing = {
      source: "Ajout manuel",
      sourceKey: "manual",
      sleep: entries.sleepHours === "" && entries.sleepMinutes === "" ? null : (value("sleepHours") || 0) + (value("sleepMinutes") || 0) / 60,
      motivation: value("motivation"),
      energy: value("motivation"),
      mood: null,
      restHr: value("restHr"),
      hrv: value("hrv"),
      sleepQuality: value("sleepQuality"),
      sleepQualityUnit: "qualitative-v1"
    };

    if (submitButton) submitButton.disabled = true;
    setWellbeingDialogMessage("Enregistrement…");

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
      setWellbeingDialogMessage(`Enregistrement impossible : ${error.message}`, true);
      return;
    }

    state.wellbeing = state.wellbeing || {};
    state.wellbeing[date] = mapDailyWellbeingRow(dailyResult.data, dayResult.data);
    saveState();
    const returnToDay = form.dataset.returnToDay;
    closeHomeDialog($("#wellbeingDialog"));
    await renderHome();
    await loadProgressionData();

    if (returnToDay) await openDay(returnToDay);
}

async function deleteWellbeing(date, returnToDay = null) {
  const user = await getCurrentUser();
  if (!user || !window.confirm("Supprimer les données de bien-être de cette journée ?")) return;

  const editorDialog = $("#wellbeingDialog");
  const dayDialog = $("#dayDialog");
  dayDialog?.classList.add("is-busy");
  setWellbeingDialogMessage("Suppression…");
  const [dailyResult, dayResult] = await Promise.all([
    window.momentumDB
      .from("daily_wellbeing")
      .delete()
      .eq("user_id", user.id)
      .eq("recorded_date", date),
    window.momentumDB
      .from("days")
      .update({ sleep_hours:null, mood:null, energy:null, rest_hr:null, hrv:null })
      .eq("user_id", user.id)
      .eq("day_date", date)
  ]);

  const error = dailyResult.error || dayResult.error;
  if (error) {
    console.error("HOME : impossible de supprimer le bien-être.", error);
    if (editorDialog?.open) {
      setWellbeingDialogMessage(`Suppression impossible : ${error.message}`, true);
    } else {
      window.alert(error.message || "Impossible de supprimer les données de bien-être.");
    }
    dayDialog?.classList.remove("is-busy");
    return;
  }

  const returnDate = returnToDay ?? $("#wellbeingDialogForm")?.dataset.returnToDay;
  if (state.wellbeing) delete state.wellbeing[date];
  saveState();
  closeHomeDialog($("#wellbeingDialog"));
  await renderHome();
  await loadProgressionData();
  if (returnDate) await openDay(returnDate);
  dayDialog?.classList.remove("is-busy");
}

function bindWellbeingDialog() {
  $("#wellbeingDialogForm")?.addEventListener("submit", saveWellbeing);
  $("#closeWellbeingDialog")?.addEventListener("click", () => closeHomeDialog($("#wellbeingDialog")));
  $("#cancelWellbeing")?.addEventListener("click", () => closeHomeDialog($("#wellbeingDialog")));
  $("#deleteWellbeing")?.addEventListener("click", () => {
    const date = $("#wellbeingDialogForm")?.elements.recordedDate.value;
    if (date) deleteWellbeing(date);
  });
}
