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
      `${Math.round(duration)} min`
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
  const total = Number(durationMinutes);
  setFormValue(form, "duration_hours", Number.isFinite(total) ? Math.floor(total / 60) : "");
  setFormValue(form, "duration_minutes", Number.isFinite(total) ? Math.round(total % 60) : "");
}

function durationMinutesFromForm(values) {
  const hours = Number(values.get("duration_hours") || 0);
  const minutes = Number(values.get("duration_minutes") || 0);
  return hours || minutes ? hours * 60 + minutes : null;
}

function renderActivityList(date, sessions) {
  const element = $("#activityList");

  if (!element) return;

  if (!sessions.length) {
    element.innerHTML = `
      <div class="day-feed-empty">
        <h4>Aucun moment</h4>
        <p>
          Ajoute un sport, un moment de bien-être
          ou une aventure.
        </p>
      </div>
    `;

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

  form.dataset.initialised = "true";
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
}

function resetActivityDialogMode(form) {
  form.querySelectorAll('option[data-temporary="true"]')
    .forEach((option) => option.remove());

  delete form.dataset.editActivityId;
  delete form.dataset.existingSourceFileUrl;
  delete form.dataset.existingSourceFileType;
  delete form.dataset.existingGpxUrl;

  const title = $("#activityDialogTitle");
  const saveButton = $("#saveActivityButton");
  const existingFile = $("#existingActivityFile");

  if (title) title.textContent = "Ajouter un moment";
  if (saveButton) saveButton.textContent = "Enregistrer";
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

function openEditActivityDialog(activityId) {
  const session = (state.sessions || []).find(
    (item) => item.id === activityId
  );

  if (!session) {
    window.alert("Ce moment n'est plus disponible.");
    return;
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
  if (saveButton) saveButton.textContent = "Enregistrer les modifications";

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

  return String(
    values.get(fieldNames[category]) || ""
  ).trim();
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
        numberOrNull(
          values,
          "rpe"
        ),

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

    const shouldCollectFlow =
      !editingId &&
      payload.status === "done" &&
      savedActivity?.id &&
      window.MomentumFlow;

    if (shouldCollectFlow) {
      await window.MomentumFlow.offerAssessment(savedActivity.id, {
        returnToDay
      });
    } else if (returnToDay) {
      openDay(returnToDay);
    }
  } catch (error) {
    console.error(
      "HOME : moment non enregistré.",
      error
    );

    if (uploadedFile?.path) {
      await removeUploadedActivityFile(
        uploadedFile.path
      );
    }

    setActivityMessage(
      error.message ||
      "Impossible d’enregistrer le moment.",
      true
    );
  }
}

async function deleteActivity(activityId, activityDate) {
  const session = (state.sessions || []).find(
    (item) => item.id === activityId
  );

  if (!session) {
    window.alert("Ce moment n'est plus disponible.");
    return;
  }

  const confirmed = window.confirm(
    "Supprimer ce moment ?\n\n" +
    "Le moment et son éventuel fichier FIT ou GPX seront définitivement supprimés."
  );

  if (!confirmed) return;

  const dialog = $("#dayDialog");
  dialog?.classList.add("is-busy");

  try {
    const { error } = await window.momentumDB
      .from("activities")
      .delete()
      .eq("id", activityId);

    if (error) throw error;

    if (session.sourceFileUrl) {
      await removeUploadedActivityFile(session.sourceFileUrl);
    }

    await renderHome();
    openDay(activityDate);
  } catch (error) {
    console.error("HOME : suppression impossible.", error);
    window.alert(
      error.message || "Impossible de supprimer ce moment."
    );
  } finally {
    dialog?.classList.remove("is-busy");
  }
}
