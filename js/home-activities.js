/* =========================================================
   MOMENTUM — HOME ACTIVITIES v1.1
   ---------------------------------------------------------
   Pop-up, formulaire et enregistrement des moments.
   ========================================================= */

function sessionLabel(session) {
  return (
    session.type ||
    session.activity_type ||
    activitySportLabel(session.sport) ||
    "Moment"
  );
}

function activitySportLabel(value) {
  if (!value) return "";

  return window.MomentumSports?.getLabel(
    value,
    String(value)
  ) || String(value);
}

function sessionMeta(session) {
  if (session?.source === "shared_moment") {
    const typeLabels = {
      SPORT: "Sport",
      ADVENTURE: "Aventure",
      TRAVEL: "Voyage",
      SOCIAL: "Rencontre",
      OTHER: "Moment"
    };
    const parts = [typeLabels[session.momentType] || "Moment partagé"];

    if (session.startAt) {
      parts.push(new Intl.DateTimeFormat("fr-CH", {
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(session.startAt)));
    }

    return parts.join(" · ");
  }

  const parts = [];

  if (session.time) parts.push(String(session.time).slice(0, 5));

  if (session.sport) {
    parts.push(activitySportLabel(session.sport));
  }

  const distance =
    session.distance ??
    session.distance_km;

  const duration =
    session.duration ??
    session.duration_min;

  if (Number(distance) > 0) {
    parts.push(
      `${formatNumber(distance)} km`
    );
  }

  if (Number(duration) > 0) {
    parts.push(
      window.MomentumDuration?.format(duration) || `${Math.round(duration)} min`
    );
  }

  return parts.join(" · ");
}

function formatNumber(value) {
  return Number(value).toLocaleString(
    "fr-CH",
    {
      maximumFractionDigits: 2
    }
  );
}

function activityCategoryLabel(category) {
  const labels = {
    sport: "Sport",
    wellbeing: "Bien-être",
    adventure: "Aventure",
    shared: "Moment partagé"
  };

  return labels[category] || "Moment";
}

function setDurationFormValues(form, durationMinutes) {
  const picker = form.querySelector('duration-picker[name="duration_min"]');
  const hasDuration = durationMinutes !== null && durationMinutes !== undefined && durationMinutes !== "" && Number.isFinite(Number(durationMinutes));
  if (picker) picker.value = hasDuration ? Number(durationMinutes) : null;
}

function durationMinutesFromForm(values) {
  const raw = values.get("duration_min");
  return raw === null || raw === "" ? null : Number(raw);
}

function activityNutritionContext(form) {
  const values = new FormData(form);
  return {
    ...(form._originalActivity || {}),
    original:form._originalActivity || {},
    status:String(values.get("status") || "done"),
    id:form.dataset.editActivityId || "",
    date:String(values.get("activity_date") || ""),
    duration:durationMinutesFromForm(values)
  };
}

async function openActivityFormNutrition() {
  const form = $("#activityForm");
  if (!form) return;
  if (form._pendingCommand) {setActivityMessage("Termine la reprise de la sauvegarde avant de modifier la nutrition.",true);return;}
  await window.MomentumNutrition?.openActivityForm(activityNutritionContext(form));
}

function updateExperienceVisibility(form) {
  const experience = form.querySelector("[data-activity-experience]");
  if (!experience) return;
  const completed = form.elements.status?.value === "done";
  experience.hidden = !completed;
  form.querySelectorAll("[data-completed-only]").forEach(section=>{section.hidden=!completed;});
  experience.querySelectorAll("input,textarea,select,momentum-slider").forEach((control) => {
    control.disabled = !completed;
    if (control.matches("momentum-slider")) control.toggleAttribute("disabled", !completed);
  });
}

async function loadActivityExperience(form, activityId) {
  const user = await getCurrentUser();
  if (!user) return;
  const version = form.dataset.formVersion;
  const { data, error } = await window.momentumDB
    .from("activity_flow_assessments")
    .select("perceived_challenge,perceived_mastery,retained_memory")
    .eq("activity_id", activityId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (version !== form.dataset.formVersion) return;
  setFormValue(form, "perceived_challenge", data?.perceived_challenge ?? "");
  setFormValue(form, "perceived_mastery", data?.perceived_mastery ?? "");
  setFormValue(form, "retained_memory", data?.retained_memory ?? "");
}

function renderActivityList(date, sessions) {
  const element = $("#activityList");

  if (!element) return;

  if (!sessions.length) {
    element.innerHTML = window.MomentumEmptyState?.render({
      title:"Aucun Moment inscrit aujourd’hui.",
      text:"Une journée calme fait aussi partie du chemin.",
      compact:true
    }) || '<div class="day-feed-empty"><h4>Aucun Moment inscrit aujourd’hui.</h4><p>Une journée calme fait aussi partie du chemin.</p></div>';

    return;
  }

  element.innerHTML = sessions
    .map((session) => {
      const hasLocationPoint = Number.isFinite(Number(session.locationDetails?.latitude)) &&
        Number.isFinite(Number(session.locationDetails?.longitude));
      const locationName = session.locationName || session.location_name || session.placeName ||
        (hasLocationPoint ? "Position GPS" : "Lieu à définir");
      const locationMarkup = window.MomentumLocationPopover?.triggerHTML(
        { ...session.locationDetails, name:session.locationDetails?.name || locationName },
        { className:"day-feed-location", label:"Lieu" }
      ) || `<span class="day-feed-location">📍 Lieu : ${escapeHtml(locationName)}</span>`;
      return `
      <article class="day-feed-item">
        <div class="day-feed-icon">${sessionIconHtml(session, "day-feed-sport-icon")}</div>
        <div class="day-feed-content">
        <span class="card-label">
          ${
            sessionStatusLabel(session)
          }
          ·
          ${escapeHtml(
            activityCategoryLabel(
              session.category ||
              session.activity_category
            )
          )}
        </span>

        <h4>
          ${escapeHtml(sessionLabel(session))}
        </h4>

        <p>
          ${escapeHtml(sessionMeta(session))}
        </p>

        <p class="muted">${locationMarkup}</p>
        ${session.source === "shared_moment" ? `
          <a class="shared-moment-link" href="together.html?moment=${encodeURIComponent(session.momentId)}">
            Ouvrir dans TOGETHER
          </a>
        ` : ""}
        </div>
      </article>
    `;})
    .join("");
}

function getSelectedActivityCategory(form) {
  return (
    form.elements.activity_category?.value ||
    "sport"
  );
}

function updateActivityFormCategory() {
  const form = $("#activityForm");

  if (!form) return;

  const category =
    getSelectedActivityCategory(form);

  const sportFields =
    form.querySelectorAll(
      '[data-activity-category="sport"]'
    );

  const wellbeingFields =
    form.querySelectorAll(
      '[data-activity-category="wellbeing"]'
    );

  const adventureFields =
    form.querySelectorAll(
      '[data-activity-category="adventure"]'
    );

  sportFields.forEach((element) => {
    element.hidden = !["sport", "adventure"].includes(category);
  });

  wellbeingFields.forEach((element) => {
    element.hidden = category !== "wellbeing";
  });

  adventureFields.forEach((element) => {
    element.hidden = category !== "adventure";
  });

  const sportSelect =
    form.elements.sport;

  const sportType =
    form.elements.sport_activity_type;

  const wellbeingType =
    form.elements.wellbeing_activity_type;

  const adventureType =
    form.elements.adventure_activity_type;

  if (sportSelect) {
    sportSelect.required = false;
  }

  if (sportType) {
    sportType.required = false;
  }

  if (wellbeingType) {
    wellbeingType.required = false;
  }

  if (adventureType) {
    adventureType.required = false;
  }

  const fileZone =
    $("#activityFileZone");

  if (fileZone) {
    fileZone.hidden =
      !["sport", "adventure"].includes(category);
  }

  const fileInput =
    form.elements.activity_file;

  if (
    category === "wellbeing" &&
    fileInput
  ) {
    fileInput.value = "";
  }

  setActivityMessage("");
}

function initialiseActivityForm() {
  const form = $("#activityForm");

  if (!form) return;

  populateActivitySportOptions(form);
  populateWellbeingOptions(form);
  window.MomentumMomentForm?.setup(form);

  if (form.dataset.initialised === "true") return;

  form
    .querySelectorAll(
      'input[name="activity_category"]'
    )
    .forEach((input) => {
      input.addEventListener(
        "change",
        updateActivityFormCategory
      );
    });

  form.elements.status?.addEventListener("change", () => updateExperienceVisibility(form));
  form.elements.wellbeing_activity_type?.addEventListener("change", () => updateWellbeingPreview(form));
  form.addEventListener("input", event => {
    form.dataset.dirty = "true";
    const name = event.target.name || event.target.closest("momentum-slider,duration-picker")?.getAttribute("name");
    if (name === "rpe") form.dataset.rpeDirty = "true";
    if (name === "duration_min") form.dataset.durationDirty = "true";
  });
  form.addEventListener("change", () => { form.dataset.dirty = "true"; });
  form.elements.activity_date?.addEventListener("change", () => {
    if (!form.dataset.editActivityId) form.elements.status.value = form.elements.activity_date.value > iso(new Date()) ? "planned" : "done";
    updateExperienceVisibility(form);
  });
  form.dataset.initialised = "true";
}

function populateWellbeingOptions(form) {
  const field = form.elements.wellbeing_activity_type;
  if (!field || field.dataset.populated === "true" || !window.MomentumWellbeing) return;
  field.replaceChildren(new Option("Choisir", ""));
  window.MomentumWellbeing.getOptions().forEach((activity) => field.add(new Option(activity.label, activity.id)));
  field.dataset.populated = "true";
  updateWellbeingPreview(form);
}

function updateWellbeingPreview(form) {
  const preview = form.querySelector("[data-wellbeing-icon-preview]");
  const value = form.elements.wellbeing_activity_type?.value;
  if (!preview || !window.MomentumIcons) return;
  const activity = window.MomentumWellbeing?.resolve(value);
  preview.innerHTML = window.MomentumIcons.render(activity?.icon || "wellbeing", {
    collection:"wellbeing",
    size:24,
    decorative:true
  });
  preview.title = activity?.label || "Bien-être";
}

function populateActivitySportOptions(form) {
  const field = form.elements.sport;

  if (
    !field ||
    field.dataset.populated === "true" ||
    !window.MomentumSports
  ) {
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choisir une activité";

  field.replaceChildren(placeholder);

  window.MomentumSports
    .getGroupedOptions()
    .forEach((group) => {
      const optionGroup = document.createElement("optgroup");
      optionGroup.label = group.label;

      group.sports.forEach((sport) => {
        const option = document.createElement("option");
        option.value = sport.id;
        option.textContent = sport.label;
        optionGroup.append(option);
      });

      field.append(optionGroup);
    });

  field.dataset.populated = "true";
}

function setSelectValue(form, name, value) {
  const field = form.elements[name];

  if (!field || !value) return;

  const normalizedValue =
    name === "sport"
      ? (window.MomentumSports?.resolveId(value) || String(value))
      : name === "wellbeing_activity_type"
        ? (window.MomentumWellbeing?.resolveId(value) || String(value))
      : String(value);

  const hasOption = [...field.options]
    .some((option) => option.value === normalizedValue);

  if (!hasOption) {
    const option = document.createElement("option");
    option.value = normalizedValue;
    option.textContent =
      name === "sport"
        ? activitySportLabel(value)
        : String(value);
    option.dataset.temporary = "true";
    field.append(option);
  }

  field.value = normalizedValue;
  if (name === "wellbeing_activity_type") updateWellbeingPreview(form);
}

function resetActivityDialogMode(form) {
  form.querySelectorAll('option[data-temporary="true"]')
    .forEach((option) => option.remove());

  delete form.dataset.editActivityId;
  delete form.dataset.existingSourceFileUrl;
  delete form.dataset.existingSourceFileType;
  delete form.dataset.existingGpxUrl;
  delete form.dataset.activityTimeline;
  delete form.dataset.importedActivity;
  delete form.dataset.importedActivityTime;

  const title = $("#activityDialogTitle");
  const saveButton = $("#saveActivityButton");
  const existingFile = $("#existingActivityFile");

  if (title) title.textContent = "Ajouter un moment";
  if (saveButton) saveButton.textContent = "Enregistrer le Moment";
  if (existingFile) {
    existingFile.hidden = true;
    existingFile.textContent = "";
  }
}

function openActivityDialog(date = null, returnToDay = false) {
  const dialog = $("#activityDialog");
  const form = $("#activityForm");

  if (!dialog || !form) return;

  initialiseActivityForm();

  resetActivityDialogMode(form);
  form.reset();
  form.dataset.formVersion = crypto.randomUUID();
  form.dataset.newActivityId = crypto.randomUUID();
  form.dataset.operationId = crypto.randomUUID();
  form.dataset.dirty = "false";
  form._pendingCommand = null;
  form._originalActivity = null;
  form._uploadedSource = null;
  form._uploadedPhoto = new Set();
  form.dataset.experienceLoaded = "true";
  form.querySelectorAll("momentum-slider,textarea[name=retained_memory]").forEach(control=>{control.disabled=false;control.removeAttribute("disabled");});
  delete form.dataset.rpeDirty;
  delete form.dataset.durationDirty;
  delete form.dataset.expectedRevision;
  delete form.dataset.sourceHash;
  for (const key of ["importedSourceInstant","importedTimezone","timelineSaved","importVersion","durationDirty"]) delete form.dataset[key];

  delete form.dataset.routeSummary;

  const selectedDate =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : iso(new Date());

  form.elements.activity_date.value = selectedDate;

  form.elements.status.value = selectedDate > iso(new Date()) ? "planned" : "done";
  setDurationFormValues(form, null);
  setFormValue(form, "rpe", "");
  setFormValue(form, "perceived_challenge", "");
  setFormValue(form, "perceived_mastery", "");
  updateExperienceVisibility(form);
  window.MomentumNutrition?.beginActivityForm(activityNutritionContext(form));
  form.dataset.returnToDay = returnToDay ? selectedDate : "";

  const defaultCategory =
    form.querySelector(
      'input[name="activity_category"][value="sport"]'
    );

  if (defaultCategory) {
    defaultCategory.checked = true;
  }

  updateActivityFormCategory();
  window.MomentumMomentForm?.syncNature(form, true);
  form.querySelectorAll(".moment-details").forEach(section=>{section.open=false;});
  setActivityMessage("");

  if (!dialog.dataset.cancelBound) {
    dialog.addEventListener("cancel", event => { event.preventDefault(); closeActivityDialog(); });
    dialog.dataset.cancelBound = "true";
  }
  openHomeDialog(dialog);
}

async function openEditActivityDialog(activityId) {
  let session = (state.sessions || []).find(
    (item) => item.id === activityId
  );

  if (!session) {
    const user = await getCurrentUser();
    const { data, error } = await queryActivitiesWithFieldFallback(
      (fields) => window.momentumDB
        .from("activities")
        .select(fields)
        .eq("id", activityId)
        .eq("user_id", user?.id || "")
        .maybeSingle()
    );
    if (error) console.error("HOME : Moment historique indisponible.", error);
    session = data ? mapActivityRow(data) : null;
    if (!session) {
      await window.MomentumUI.confirm({ title:"Moment indisponible", message:"Ce Moment n’est plus disponible ou n’a pas pu être chargé.", confirmLabel:"Fermer", cancelLabel:"Retour" });
      return;
    }
  }

  openActivityDialog(session.date, true);

  const form = $("#activityForm");
  if (!form) return;

  form.dataset.editActivityId = session.id;
  form.dataset.expectedRevision = String(session.revision ?? 0);
  form._originalActivity = session.original || {};
  const formVersion = form.dataset.formVersion;
  form.dataset.experienceLoaded = "false";
  form.dataset.existingSourceFileUrl = session.sourceFileUrl || "";
  form.dataset.existingSourceFileType = session.sourceFileType || "";
  form.dataset.existingGpxUrl = session.gpxUrl || "";
  form.dataset.routeSummary = session.routeSummary
    ? JSON.stringify(session.routeSummary)
    : "";

  const category = session.category || "sport";
  const categoryInput = form.querySelector(
    `input[name="activity_category"][value="${category}"]`
  );

  if (categoryInput) categoryInput.checked = true;
  updateActivityFormCategory();

  setFormValue(form, "activity_date", session.date);
  setFormValue(form, "activity_time", session.time);
  setFormValue(form, "status", session.status);
  setSelectValue(form, "sport", session.sport);
  setFormValue(form, "distance_km", session.distance);
  setDurationFormValues(form, session.duration);
  setFormValue(form, "elevation_m", session.elevation);
  setFormValue(form, "avg_hr", session.hr);
  setFormValue(form, "rpe", session.rpe);
  setFormValue(form, "gear", session.gear);
  if (session.locationName) {
    setActivityLocation(form, {
      id:session.locationId || null,
      name:session.locationName,
      structured:Boolean(session.locationId)
    });
  }
  setFormValue(form, "notes", session.comment);
  updateExperienceVisibility(form);

  try {
    await loadActivityExperience(form, session.id);
    if (form.dataset.formVersion !== formVersion) return;
    form.dataset.experienceLoaded = "true";
  } catch (error) {
    setActivityMessage("Le ressenti n’a pas pu être chargé. Il sera conservé sans modification. Rouvre ce Moment pour le modifier.", true);
    form.querySelectorAll("momentum-slider,textarea[name=retained_memory]").forEach(control => control.setAttribute("disabled", ""));
  }

  if (form.dataset.formVersion !== formVersion) return;
  await window.MomentumNutrition?.beginActivityForm({
    ...session,
    duration:session.duration
  });

  if (form.dataset.formVersion !== formVersion) return;
  const typeFields = {
    sport: "sport_activity_type",
    wellbeing: "wellbeing_activity_type",
    adventure: "adventure_activity_type"
  };

  setSelectValue(form, typeFields[category], session.type);

  const title = $("#activityDialogTitle");
  const saveButton = $("#saveActivityButton");
  const existingFile = $("#existingActivityFile");

  window.MomentumMomentForm?.syncNature(form, true);
  if (title) title.textContent = "Modifier le moment";
  if (saveButton) saveButton.textContent = "Enregistrer le Moment";

  if (existingFile && session.sourceFileType) {
    existingFile.hidden = false;
    existingFile.textContent =
      `Fichier ${session.sourceFileType.toUpperCase()} actuellement associé. ` +
      "Choisis un nouveau fichier uniquement pour le remplacer.";
  }
}

async function closeActivityDialog(force = false) {
  const dialog = $("#activityDialog"), form = $("#activityForm");
  if (!dialog?.open) return;
  if (form?.dataset.saving === "true") return;
  if (force !== true && form?.dataset.dirty === "true") {
    const confirmed = await window.MomentumUI.confirm({ title:"Quitter ce Moment ?", message:"Les changements non enregistrés seront abandonnés.", confirmLabel:"Quitter sans enregistrer", cancelLabel:"Continuer l’édition" });
    if (!confirmed) return;
  }
  window.MomentumNutrition?.cancelActivityForm();
  form.dataset.formVersion = crypto.randomUUID();
  closeHomeDialog(dialog);
}

function setActivityMessage(
  message,
  isError = false
) {
  const element = $("#activityMessage");

  if (!element) return;

  element.textContent = message;

  element.classList.toggle(
    "is-error",
    isError
  );
}

function setFormValue(form, name, value) {
  const field = form.elements[name];

  if (
    !field ||
    value === undefined
  ) {
    return;
  }

  field.value = value ?? "";
}

function setActivityLocation(form, location) {
  if (!location?.name) return;
  const picker = typeof document === "undefined"
    ? null
    : document.getElementById("activityLocationPicker");
  if (picker) picker.setLocation(location);
  else setFormValue(form, "location_name", location.name);
}

function fillActivityForm(data) {
  const form = $("#activityForm");

  if (!form) return;

  const category = getSelectedActivityCategory(form);
  const isPlannedGpx =
    data.sourceFileType === "gpx" &&
    form.elements.status?.value === "planned";

  updateActivityFormCategory();

  const localStart = activityLocalDateTime(data.startedAt);
  const timeField = form.elements.activity_time;
  const previousImportedTime = form.dataset.importedActivityTime || "";
  const hasManualTime = Boolean(timeField?.value) &&
    timeField.value !== previousImportedTime;

  if (localStart && timeField && !isPlannedGpx && !hasManualTime) {
    timeField.value = localStart.time;
    form.dataset.importedActivityTime = localStart.time;
  }

  if (!isPlannedGpx) {
    setFormValue(
      form,
      "activity_date",
      data.date || form.elements.activity_date.value
    );

    if (data.sport) setSelectValue(form, "sport", data.sport);

    const typeFields = {
      sport: "sport_activity_type",
      wellbeing: "wellbeing_activity_type",
      adventure: "adventure_activity_type"
    };

    setSelectValue(form, typeFields[category], data.type);
  }

  setFormValue(
    form,
    "distance_km",
    data.distance
  );

  if (!isPlannedGpx) {
    setDurationFormValues(form, data.duration);
  }

  setFormValue(
    form,
    "elevation_m",
    data.elevation
  );

  setFormValue(
    form,
    "avg_hr",
    data.avgHr
  );

  if (data.locationName) {
    setActivityLocation(form, {
      name:data.locationName,
      structured:false
    });
  }

  data.routeSummary ||= { file_name:form.elements.activity_file?.files?.[0]?.name || null };
  data.routeSummary.source_durations = {
    timer_seconds:data.timerDurationSeconds ?? null,
    elapsed_seconds:data.totalDurationSeconds ?? null,
    moving_seconds:data.actualMovingSeconds ?? null
  };
  form.dataset.importedSourceInstant = data.startedAt ? new Date(data.startedAt).toISOString() : "";
  form.dataset.importedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Zurich";
  form.dataset.routeSummary =
    data.routeSummary
      ? JSON.stringify(data.routeSummary)
      : "";

  form.dataset.activityTimeline = data.timeline
    ? JSON.stringify(data.timeline)
    : "";

  form.dataset.importedActivity = JSON.stringify({
    started_at:data.startedAt ?? null,
    ended_at:data.endedAt ?? null,
    total_duration_seconds:data.totalDurationSeconds ?? null,
    moving_time_seconds:data.movingTimeSeconds ?? null,
    paused_time_seconds:data.pausedTimeSeconds ?? null,
    distance_m:data.distanceMeters ?? null,
    total_ascent_m:data.totalAscentMeters ?? null,
    average_heart_rate_bpm:data.averageHeartRateBpm ?? null
  });
}

const NORMALIZED_FIT_ACTIVITY_FIELDS = [
  "started_at",
  "ended_at",
  "total_duration_seconds",
  "moving_time_seconds",
  "paused_time_seconds",
  "distance_m",
  "total_ascent_m",
  "average_heart_rate_bpm"
];

function normalizedFitActivityPayload(form, file, hasActivityMetrics) {
  if (
    !file ||
    !hasActivityMetrics ||
    activityFileExtension(file) !== "fit" ||
    !form.dataset.importedActivity
  ) {
    return {};
  }

  try {
    return JSON.parse(form.dataset.importedActivity);
  } catch {
    return {};
  }
}

function withoutNormalizedFitActivityFields(payload) {
  const legacyPayload = { ...payload };

  NORMALIZED_FIT_ACTIVITY_FIELDS.forEach((field) => {
    delete legacyPayload[field];
  });

  return legacyPayload;
}

function activityTimelineForSave(form, file, completed) {
  if (
    !file ||
    !completed ||
    !["fit", "gpx"].includes(activityFileExtension(file)) ||
    !form.dataset.activityTimeline
  ) {
    return null;
  }

  try {
    return JSON.parse(form.dataset.activityTimeline);
  } catch {
    return null;
  }
}

async function saveActivityTimelineSafely(activityId, userId, timeline) {
  if (!activityId || !timeline?.events?.length) return false;

  try {
    await window.MomentumTimeline.save(activityId, userId, timeline);
    return true;
  } catch (error) {
    console.warn(
      "HOME : Moment enregistré sans Timeline.",
      error
    );
    throw new Error("La chronologie n’a pas pu être enregistrée.");
  }
}

function numberOrNull(formData, name) {
  const raw =
    String(
      formData.get(name) || ""
    ).trim();

  if (raw === "") return null;

  const value = Number(raw);

  return Number.isFinite(value)
    ? value
    : null;
}

function getActivityType(values, category) {
  const fieldNames = {
    sport: "sport_activity_type",
    wellbeing: "wellbeing_activity_type",
    adventure: "adventure_activity_type"
  };

  const value = String(
    values.get(fieldNames[category]) || ""
  ).trim();
  return category === "wellbeing"
    ? (window.MomentumWellbeing?.getLabel(value, value) || value)
    : value || (category === "sport" ? "Libre" : "Autre");
}

function getActivitySport(values, category) {
  if (!["sport", "adventure"].includes(category)) {
    return null;
  }

  return (
    String(
      values.get("sport") || ""
    ).trim() || null
  );
}

async function saveActivity(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.saving === "true") return;
  const user = await getCurrentUser();
  if (!user) return setActivityMessage("Ta session n’est pas disponible. Réessaie sans fermer ce Moment.", true);
  const values = new FormData(form);
  const date = String(values.get("activity_date") || "");
  const category = String(values.get("activity_category") || "sport");
  const status = String(values.get("status") || "done");
  const completed = status === "done";
  const sport = getActivitySport(values, category);
  const type = getActivityType(values, category);
  if (!window.MomentumTrainingLoad.dateKey(date) || !type || category === "sport" && !sport) return setActivityMessage("Choisis une nature et une date valides.", true);
  if (completed && date > iso(new Date())) return setActivityMessage("Ce Moment est à venir. Garde le statut Prévu ou corrige sa date.", true);
  const version = form.dataset.formVersion;
  const button = $("#saveActivityButton");
  form.dataset.saving = "true"; form.inert=true; form.setAttribute("aria-busy", "true"); if (button) button.disabled = true;
  let structuredSaved = false;
  let stage = "les données du Moment";
  try {
    const original = form._originalActivity || {};
    if (!form._pendingCommand) {
      const file = form.elements.activity_file?.files?.[0] || null;
      const location = await window.MomentumLocations.resolveForSave(document.getElementById("activityLocationPicker"), user.id);
      if (version !== form.dataset.formVersion) return;
      if (file && form._uploadedSource?.file !== file) {
        stage = "le fichier source"; setActivityMessage("Téléversement du fichier…");
        const upload = await uploadActivityFile(file, user.id, date);
        form._uploadedSource = { ...upload,file };
      }
      const source = form._uploadedSource;
      const route = form.dataset.routeSummary ? JSON.parse(form.dataset.routeSummary) : original.route_summary || null;
      const metrics = ["sport", "adventure"].includes(category);
      const duration = durationMinutesFromForm(values);
      const effort = completed && form.dataset.experienceLoaded === "true" ? numberOrNull(values, "rpe") : original.rpe ?? null;
      const payload = {
        id:form.dataset.editActivityId || form.dataset.newActivityId,
        user_id:user.id,activity_date:date,activity_time:String(values.get("activity_time") || "").trim() || null,
        activity_category:category,sport,activity_type:type,status,
        distance_km:metrics ? numberOrNull(values,"distance_km") : null,duration_min:duration,
        elevation_m:metrics ? numberOrNull(values,"elevation_m") : null,avg_hr:metrics ? numberOrNull(values,"avg_hr") : null,
        rpe:effort,rpe_source:form.dataset.rpeDirty === "true" ? "user" : original.rpe_source || "undocumented",
        duration_source:form.dataset.durationDirty === "true" ? "manual" : file ? "import" : original.duration_source || "manual",
        timer_duration_seconds:file ? route?.source_durations?.timer_seconds ?? null : original.timer_duration_seconds ?? null,
        elapsed_duration_seconds:file ? route?.source_durations?.elapsed_seconds ?? null : original.elapsed_duration_seconds ?? null,
        moving_duration_seconds:file ? route?.source_durations?.moving_seconds ?? null : original.moving_duration_seconds ?? null,
        source_instant:form.dataset.importedSourceInstant || original.source_instant || null,
        source_timezone:form.dataset.importedTimezone || original.source_timezone || null,
        source_hash:form.dataset.sourceHash || original.source_hash || null,
        qualifiers:form.querySelector('[name="qualifiers"]') ? values.getAll("qualifiers") : original.qualifiers || [],is_memorable:form.elements.is_memorable ? values.has("is_memorable") : original.is_memorable || false,
        gear:metrics ? String(values.get("gear") || "").trim() || null : null,
        notes:String(values.get("notes") || "").trim() || null,
        location_name:location.location?.name || String(values.get("location_name") || "").trim() || null,
        location_id:location.location?.id || null,
        route_summary:route,
        source_file_url:source?.path || original.source_file_url || form.dataset.existingSourceFileUrl || null,
        source_file_type:source?.type || original.source_file_type || form.dataset.existingSourceFileType || null,
        gpx_url:source?.type === "gpx" ? source.path : original.gpx_url || null
      };
      const assessment = completed && form.dataset.experienceLoaded === "true" ? {
        perceived_challenge:numberOrNull(values,"perceived_challenge"),perceived_mastery:numberOrNull(values,"perceived_mastery"),
        retained_memory:String(values.get("retained_memory") || "").trim() || null
      } : null;
      form._pendingCommand = { p_operation_id:form.dataset.operationId,p_activity:payload,p_assessment:assessment,
        p_nutrition:window.MomentumNutrition?.draftPayload() ?? null,
        p_expected_revision:form.dataset.editActivityId ? Number(form.dataset.expectedRevision) : null };
    }
    stage = "les données du Moment"; setActivityMessage("Enregistrement du Moment…");
    const { data, error } = await window.momentumDB.rpc("save_personal_moment", form._pendingCommand);
    if (error) {
      // A server rejection is definitive; a lost response is not. Keep the exact request for a safe replay.
      if (error.code) { form._pendingCommand = null; form.dataset.operationId = crypto.randomUUID(); }
      if (error.code === "23505") throw new Error("Ce fichier est déjà associé à un Moment. Ouvre l’activité existante depuis le Journal.");
      if (error.code === "40001") throw new Error("Ce Moment a été modifié ailleurs ou la demande a changé. Rouvre-le avant de remplacer des données.");
      throw error;
    }
    if (version !== form.dataset.formVersion) return;
    structuredSaved = true;
    const savedPayload = form._pendingCommand.p_activity;
    form.dataset.editActivityId = data.id; form.dataset.expectedRevision = String(data.revision);
    form._originalActivity = { ...savedPayload,revision:data.revision };
    form._pendingCommand = null; form.dataset.operationId = crypto.randomUUID();
    window.MomentumNutrition?.parentSaved(data.id);
    window.dispatchEvent(new Event("momentum:activities-changed"));
    stage = "la chronologie";
    const file = form.elements.activity_file?.files?.[0] || null;
    const timeline = activityTimelineForSave(form,file,completed);
    if (timeline && form.dataset.timelineSaved !== "true") {
      await saveActivityTimelineSafely(data.id,user.id,timeline); form.dataset.timelineSaved = "true";
    }
    stage = "la photo";
    const photos = completed ? Array.from(form.elements.activity_photo?.files || []) : [];
    for (const photo of photos) { if (!form._uploadedPhoto.has(photo)) { await uploadActivityPhoto(photo,data.id,user.id); form._uploadedPhoto.add(photo); } }
    form.dataset.dirty = "false";
    delete form.dataset.saving; form.inert=false; form.removeAttribute("aria-busy"); if (button) button.disabled = false;
    const returnToDay = form.dataset.returnToDay;
    await closeActivityDialog(true);
    await renderHome();
    await window.MomentumFlow?.reload();
    if (returnToDay) openDay(date);
  } catch (error) {
    if (version !== form.dataset.formVersion) return;
    const detail = error?.code ? "Vérifie les champs puis réessaie." : error?.message || "Réessaie sans fermer le formulaire.";
    setActivityMessage(structuredSaved
      ? `Le Moment et son ressenti sont enregistrés. Échec pour ${stage}. Réessaie pour terminer : ${detail}`
      : `L’enregistrement n’est pas confirmé. ${detail}`, true);
  } finally {
    if (version === form.dataset.formVersion) { delete form.dataset.saving; form.inert=false; form.removeAttribute("aria-busy"); if (button) button.disabled = false; }
  }
}

async function uploadActivityPhoto(file, activityId, userId) {
  const supported = { "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp" };
  const extension = supported[file.type];
  if (!extension) throw new Error("Choisis une photo JPG, PNG ou WebP.");
  if (file.size > 10 * 1024 * 1024) throw new Error("La photo dépasse 10 Mo.");

  const path = `${userId}/${activityId}/${crypto.randomUUID()}.${extension}`;
  const { error:uploadError } = await window.momentumDB.storage
    .from("activity-media")
    .upload(path, file, { contentType:file.type, cacheControl:"3600", upsert:false });
  if (uploadError) throw uploadError;

  const { error:mediaError } = await window.momentumDB
    .from("activity_media")
    .insert({ activity_id:activityId, user_id:userId, file_path:path });
  if (mediaError) {
    const { error:cleanupError } = await window.momentumDB.rpc("discard_uploaded_file", {p_bucket:"activity-media",p_path:path});
    if (cleanupError) throw new Error("La photo n’est pas rattachée au Moment. Son fichier sera vérifié par le nettoyage automatique après 24 heures.");
    throw mediaError;
  }
}

async function deleteActivity(activityId, activityDate) {
  const session = (state.sessions || []).find(
    (item) => item.id === activityId
  );

  if (!session) {
    setActivityMessage("Ce Moment n’est plus disponible.", true);
    return;
  }

  const confirmed = await window.MomentumUI.confirm({ title:"Supprimer ce Moment ?", message:"Le Moment, ses photos et son éventuel fichier FIT ou GPX seront définitivement supprimés.", confirmLabel:"Supprimer", danger:true });

  if (!confirmed) return;

  const dialog = $("#dayDialog");
  dialog?.classList.add("is-busy");

  try {
    const { data:result, error } = await window.momentumDB.rpc("delete_personal_activity", {
      p_id:activityId, p_expected_revision:session.revision
    });
    if (error) throw error;

    window.dispatchEvent(new Event("momentum:activities-changed"));
    await renderHome();
    openDay(activityDate);
    const notice=document.createElement('p');notice.setAttribute('role','status');
    notice.textContent=result.pending_files
      ? "Moment retiré. Le nettoyage de ses fichiers est en cours et sera repris automatiquement si nécessaire."
      : "Moment supprimé.";
    $("#dayDialogContent")?.prepend(notice);
  } catch (error) {
    console.error("HOME : suppression impossible.", error);
    setActivityMessage(window.MomentumUI.errorMessage(error, "delete"), true);
  } finally {
    dialog?.classList.remove("is-busy");
  }
}

// Every entry point opens the same editor and fetches the complete owned row.
async function openEditActivityById(id) {
  const user = await getCurrentUser();
  if (!user) return;
  const result = await window.momentumDB.from("activities").select("*").eq("user_id",user.id).eq("id",id).maybeSingle();
  if (result.error || !result.data) { await window.MomentumUI.confirm({title:"Moment indisponible",message:"Impossible de retrouver ce Moment pour ce compte.",confirmLabel:"Fermer",cancelLabel:"Fermer"}); return; }
  const row=mapActivityRow(result.data);
  state.sessions=(state.sessions || []).filter(item=>item.id!==row.id).concat(row);
  await openEditActivityDialog(row.id);
}
