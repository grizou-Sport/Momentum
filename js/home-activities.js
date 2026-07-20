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

function updateExperienceVisibility(form) {
  const experience = form.querySelector("[data-activity-experience]");
  if (!experience) return;
  const completed = form.elements.status?.value === "done";
  experience.hidden = !completed;
  experience.querySelectorAll("input,textarea,select,momentum-slider").forEach((control) => {
    control.disabled = !completed;
    if (control.matches("momentum-slider")) control.toggleAttribute("disabled", !completed);
  });
}

async function loadActivityExperience(form, activityId) {
  const user = await getCurrentUser();
  if (!user) return;
  const { data, error } = await window.momentumDB
    .from("activity_flow_assessments")
    .select("perceived_challenge,perceived_mastery,retained_memory")
    .eq("activity_id", activityId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
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
    .map((session) => `
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

        <p class="muted">
          ${escapeHtml(
            session.locationName ||
            session.location_name ||
            session.placeName ||
            "Lieu à définir"
          )}
        </p>
        ${session.source === "shared_moment" ? `
          <a class="shared-moment-link" href="together.html?moment=${encodeURIComponent(session.momentId)}">
            Ouvrir dans TOGETHER
          </a>
        ` : ""}
        </div>
      </article>
    `)
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
    sportSelect.required =
      category === "sport";
  }

  if (sportType) {
    sportType.required =
      category === "sport";
  }

  if (wellbeingType) {
    wellbeingType.required =
      category === "wellbeing";
  }

  if (adventureType) {
    adventureType.required =
      category === "adventure";
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

  delete form.dataset.routeSummary;

  const selectedDate =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : iso(new Date());

  form.elements.activity_date.value = selectedDate;

  form.elements.status.value = "done";
  setDurationFormValues(form, null);
  setFormValue(form, "rpe", "");
  setFormValue(form, "perceived_challenge", "");
  setFormValue(form, "perceived_mastery", "");
  updateExperienceVisibility(form);
  form.dataset.returnToDay = returnToDay ? selectedDate : "";

  const defaultCategory =
    form.querySelector(
      'input[name="activity_category"][value="sport"]'
    );

  if (defaultCategory) {
    defaultCategory.checked = true;
  }

  updateActivityFormCategory();
  setActivityMessage("");

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
  setFormValue(form, "location_name", session.locationName);
  setFormValue(form, "notes", session.comment);
  updateExperienceVisibility(form);

  try {
    await loadActivityExperience(form, session.id);
  } catch (error) {
    console.warn("HOME : ressenti du Moment indisponible.", error);
  }

  const typeFields = {
    sport: "sport_activity_type",
    wellbeing: "wellbeing_activity_type",
    adventure: "adventure_activity_type"
  };

  setSelectValue(form, typeFields[category], session.type);

  const title = $("#activityDialogTitle");
  const saveButton = $("#saveActivityButton");
  const existingFile = $("#existingActivityFile");

  if (title) title.textContent = "Modifier le moment";
  if (saveButton) saveButton.textContent = "Enregistrer le Moment";

  if (existingFile && session.sourceFileType) {
    existingFile.hidden = false;
    existingFile.textContent =
      `Fichier ${session.sourceFileType.toUpperCase()} actuellement associé. ` +
      "Choisis un nouveau fichier uniquement pour le remplacer.";
  }
}

function closeActivityDialog() {
  const dialog = $("#activityDialog");

  if (dialog?.open) {
    closeHomeDialog(dialog);
  }
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
    value === undefined ||
    value === null
  ) {
    return;
  }

  field.value = value;
}

function fillActivityForm(data) {
  const form = $("#activityForm");

  if (!form) return;

  const category = getSelectedActivityCategory(form);
  updateActivityFormCategory();

  setFormValue(
    form,
    "activity_date",
    data.date
  );

  setSelectValue(form, "sport", data.sport);

  const typeFields = {
    sport: "sport_activity_type",
    wellbeing: "wellbeing_activity_type",
    adventure: "adventure_activity_type"
  };

  setSelectValue(form, typeFields[category], data.type);

  setFormValue(
    form,
    "distance_km",
    data.distance
  );

  setDurationFormValues(form, data.duration);

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

  setFormValue(
    form,
    "location_name",
    data.locationName
  );

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
    : value;
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
  const values = new FormData(form);
  const user = await getCurrentUser();

  if (!user) {
    setActivityMessage(
      "Aucun utilisateur connecté.",
      true
    );

    return;
  }

  const activityDate =
    String(
      values.get("activity_date") || ""
    ).trim();

  const category =
    String(
      values.get("activity_category") ||
      "sport"
    ).trim();

  const completed = String(values.get("status") || "done") === "done";

  const sport =
    getActivitySport(values, category);

  const activityType =
    getActivityType(values, category);

  if (!activityDate) {
    setActivityMessage(
      "La date est obligatoire.",
      true
    );

    return;
  }

  if (
    !["sport", "wellbeing", "adventure"]
      .includes(category)
  ) {
    setActivityMessage(
      "La catégorie du moment est invalide.",
      true
    );

    return;
  }

  if (
    category === "sport" &&
    !sport
  ) {
    setActivityMessage(
      "Choisis un sport.",
      true
    );

    return;
  }

  if (!activityType) {
    setActivityMessage(
      "Choisis le type de moment.",
      true
    );

    return;
  }

  let routeSummary = null;

  if (form.dataset.routeSummary) {
    try {
      routeSummary =
        JSON.parse(
          form.dataset.routeSummary
        );
    } catch {
      routeSummary = null;
    }
  }

  const file =
    form.elements.activity_file
      ?.files?.[0] || null;

  let uploadedFile = null;
  const editingId = form.dataset.editActivityId || "";
  let persistedActivityId = editingId;
  const existingSourceFileUrl =
    form.dataset.existingSourceFileUrl || "";
  const existingSourceFileType =
    form.dataset.existingSourceFileType || "";
  const existingGpxUrl =
    form.dataset.existingGpxUrl || "";

  try {
    if (file) {
      setActivityMessage(
        "Téléversement du fichier…"
      );

      uploadedFile =
        await uploadActivityFile(
          file,
          user.id,
          activityDate
        );
    }

    const hasActivityMetrics =
      ["sport", "adventure"].includes(category);

    const retainedSourceFileUrl = hasActivityMetrics
      ? (uploadedFile?.path || existingSourceFileUrl || null)
      : null;

    const retainedSourceFileType = hasActivityMetrics
      ? (uploadedFile?.type || existingSourceFileType || null)
      : null;

    const payload = {
      user_id: user.id,
      activity_date: activityDate,
      activity_time:String(values.get("activity_time") || "").trim() || null,
      activity_category: category,
      sport,
      activity_type: activityType,

      status:
        String(
          values.get("status") ||
          "done"
        ),

      distance_km:
        hasActivityMetrics
          ? numberOrNull(
              values,
              "distance_km"
            )
          : null,

      duration_min: durationMinutesFromForm(values),

      elevation_m:
        hasActivityMetrics
          ? numberOrNull(
              values,
              "elevation_m"
            )
          : null,

      avg_hr:
        hasActivityMetrics
          ? numberOrNull(
              values,
              "avg_hr"
            )
          : null,

      rpe:
        completed ? numberOrNull(values, "rpe") : null,

      gear:
        hasActivityMetrics
          ? (
              String(
                values.get("gear") || ""
              ).trim() || null
            )
          : null,

      location_name:
        String(
          values.get("location_name") ||
          ""
        ).trim() || null,

      notes:
        String(
          values.get("notes") || ""
        ).trim() || null,

      route_summary:
        hasActivityMetrics
          ? routeSummary
          : null,

      source_file_url:
        retainedSourceFileUrl,

      source_file_type:
        retainedSourceFileType,

      gpx_url:
        retainedSourceFileType === "gpx"
          ? (uploadedFile?.path || existingGpxUrl || retainedSourceFileUrl)
          : null
    };

    if (file && hasActivityMetrics && form.dataset.importedActivity) {
      try {
        Object.assign(payload, JSON.parse(form.dataset.importedActivity));
      } catch {
        // Le formulaire visible reste enregistrable si les donnees internes
        // d'import ont ete invalidees dans le navigateur.
      }
    }

    setActivityMessage(
      editingId
        ? "Mise à jour du moment…"
        : "Enregistrement du moment…"
    );

    let query = window.momentumDB
        .from("activities")
        [editingId ? "update" : "insert"](payload);

    if (editingId) {
      query = query
        .eq("id", editingId)
        .eq("user_id", user.id)
        .select("id")
        .single();
    } else {
      query = query
        .select("id")
        .single();
    }

    const { data:savedActivity, error } = await query;

    if (error) {
      throw error;
    }
    persistedActivityId = savedActivity?.id || editingId;
    if (persistedActivityId) form.dataset.editActivityId = persistedActivityId;

    let timeline = null;
    if (file && form.dataset.activityTimeline) {
      timeline = JSON.parse(form.dataset.activityTimeline);
    } else if (completed && hasActivityMetrics && !retainedSourceFileType && payload.activity_time) {
      const startTime = new Date(`${activityDate}T${payload.activity_time}`);
      const durationSeconds = Math.max(0, Number(payload.duration_min) || 0) * 60;
      timeline = window.MomentumTimeline.build({
        source:"manual",
        startTime,
        endTime:new Date(startTime.getTime() + durationSeconds * 1000),
        totalElapsedSeconds:durationSeconds
      });
    }
    if (persistedActivityId && timeline?.events?.length) {
      await window.MomentumTimeline.save(persistedActivityId, user.id, timeline);
    }

    if (completed && savedActivity?.id) {
      const assessmentPayload = {
        activity_id:savedActivity.id,
        user_id:user.id,
        perceived_challenge:numberOrNull(values, "perceived_challenge"),
        perceived_mastery:numberOrNull(values, "perceived_mastery"),
        retained_memory:String(values.get("retained_memory") || "").trim() || null,
        analysis_context:window.MomentumFlow?.analysisContext({
          ...payload,
          id:savedActivity.id
        }) || { version:2, source:"moment-form" },
        assessment_version:2
      };
      const { error:assessmentError } = await window.momentumDB
        .from("activity_flow_assessments")
        .upsert(assessmentPayload, { onConflict:"activity_id,user_id" });
      if (assessmentError) throw assessmentError;
    } else if (editingId && savedActivity?.id) {
      const { error:assessmentError } = await window.momentumDB
        .from("activity_flow_assessments")
        .delete()
        .eq("activity_id", savedActivity.id)
        .eq("user_id", user.id);
      if (assessmentError) throw assessmentError;
    }

    const photo = completed ? (form.elements.activity_photo?.files?.[0] || null) : null;
    if (photo && savedActivity?.id) await uploadActivityPhoto(photo, savedActivity.id, user.id);

    if (
      editingId &&
      existingSourceFileUrl &&
      existingSourceFileUrl !== retainedSourceFileUrl
    ) {
      await removeUploadedActivityFile(existingSourceFileUrl);
    }

    const returnToDay = editingId
      ? activityDate
      : (form.dataset.returnToDay || "");

    closeActivityDialog();
    await renderHome();

    if (returnToDay) {
      openDay(returnToDay);
    }
  } catch (error) {
    console.error(
      "HOME : moment non enregistré.",
      error
    );

    if (uploadedFile?.path && !persistedActivityId) {
      await removeUploadedActivityFile(
        uploadedFile.path
      );
    }

    setActivityMessage(window.MomentumUI.errorMessage(error, "save"), true);
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
    await window.momentumDB.storage.from("activity-media").remove([path]);
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
    const { data:media } = await window.momentumDB
      .from("activity_media")
      .select("file_path")
      .eq("activity_id", activityId);

    const { error } = await window.momentumDB
      .from("activities")
      .delete()
      .eq("id", activityId);

    if (error) throw error;

    if (session.sourceFileUrl) {
      await removeUploadedActivityFile(session.sourceFileUrl);
    }
    const photoPaths = (media || []).map((item) => item.file_path).filter(Boolean);
    if (photoPaths.length) {
      const { error:photoError } = await window.momentumDB.storage.from("activity-media").remove(photoPaths);
      if (photoError) console.warn("HOME : photos du Moment non supprimées du stockage.", photoError);
    }

    await renderHome();
    openDay(activityDate);
  } catch (error) {
    console.error("HOME : suppression impossible.", error);
    setActivityMessage(window.MomentumUI.errorMessage(error, "delete"), true);
  } finally {
    dialog?.classList.remove("is-busy");
  }
}
