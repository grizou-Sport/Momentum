/* =========================================================
   MOMENTUM — HOME ACTIVITIES v1.1
   ---------------------------------------------------------
   Pop-up, formulaire et enregistrement des moments.
   ========================================================= */

function sessionLabel(session) {
  return (
    session.type ||
    session.activity_type ||
    session.sport ||
    "Moment"
  );
}

function sessionMeta(session) {
  const parts = [];

  if (session.sport) {
    parts.push(session.sport);
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
    adventure: "Aventure"
  };

  return labels[category] || "Moment";
}

function renderActivityList(date, sessions) {
  const element = $("#activityList");

  if (!element) return;

  if (!sessions.length) {
    element.innerHTML = `
      <article class="home-card">
        <span class="card-label">Moments</span>
        <h2>Aucun moment</h2>
        <p>
          Ajoute un sport, un moment de bien-être
          ou une aventure.
        </p>
      </article>
    `;

    return;
  }

  element.innerHTML = sessions
    .map((session) => `
      <article class="home-card activity-card">
        <span class="card-label">
          ${
            session.status === "done"
              ? "Réalisé"
              : "Prévu"
          }
          ·
          ${escapeHtml(
            activityCategoryLabel(
              session.activity_category
            )
          )}
        </span>

        <h2>
          ${escapeHtml(sessionLabel(session))}
        </h2>

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
    element.hidden = category !== "sport";
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
      category !== "sport";
  }

  const fileInput =
    form.elements.activity_file;

  if (
    category !== "sport" &&
    fileInput
  ) {
    fileInput.value = "";
  }

  setActivityMessage("");
}

function initialiseActivityForm() {
  const form = $("#activityForm");

  if (!form || form.dataset.initialised === "true") {
    return;
  }

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

function openActivityDialog() {
  const dialog = $("#activityDialog");
  const form = $("#activityForm");

  if (!dialog || !form) return;

  initialiseActivityForm();

  form.reset();

  delete form.dataset.routeSummary;

  form.elements.activity_date.value =
    iso(new Date());

  form.elements.status.value = "done";

  const defaultCategory =
    form.querySelector(
      'input[name="activity_category"][value="sport"]'
    );

  if (defaultCategory) {
    defaultCategory.checked = true;
  }

  updateActivityFormCategory();
  setActivityMessage("");

  if (
    typeof dialog.showModal === "function"
  ) {
    dialog.showModal();
  }
}

function closeActivityDialog() {
  const dialog = $("#activityDialog");

  if (dialog?.open) {
    dialog.close();
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

  const sportCategory =
    form.querySelector(
      'input[name="activity_category"][value="sport"]'
    );

  if (sportCategory) {
    sportCategory.checked = true;
  }

  updateActivityFormCategory();

  setFormValue(
    form,
    "activity_date",
    data.date
  );

  setFormValue(
    form,
    "sport",
    data.sport
  );

  setFormValue(
    form,
    "sport_activity_type",
    data.type
  );

  setFormValue(
    form,
    "distance_km",
    data.distance
  );

  setFormValue(
    form,
    "duration_min",
    data.duration
  );

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
  if (category !== "sport") {
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
        category === "sport"
          ? numberOrNull(
              values,
              "distance_km"
            )
          : null,

      duration_min:
        numberOrNull(
          values,
          "duration_min"
        ),

      elevation_m:
        category === "sport"
          ? numberOrNull(
              values,
              "elevation_m"
            )
          : null,

      avg_hr:
        category === "sport"
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
        category === "sport"
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
        category === "sport"
          ? routeSummary
          : null,

      source_file_url:
        uploadedFile?.path || null,

      source_file_type:
        uploadedFile?.type || null,

      gpx_url:
        uploadedFile?.type === "gpx"
          ? uploadedFile.path
          : null
    };

    setActivityMessage(
      "Enregistrement du moment…"
    );

    const { error } =
      await window.momentumDB
        .from("activities")
        .insert(payload);

    if (error) {
      throw error;
    }

    closeActivityDialog();
    await renderHome();
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