// =====================================================
// MOMENTUM — RÉFÉRENTIEL BIEN-ÊTRE
// =====================================================

(function initializeMomentumWellbeing() {
  const ACTIVITIES = [
    { id: "massage", label: "Massage", icon: "massage", fields: ["date", "duration", "location", "notes"], aliases: ["massage", "massothérapie", "massotherapie"], active: true, order: 10 },
    { id: "nap", label: "Sieste", icon: "nap", fields: ["date", "duration", "notes"], aliases: ["sieste", "nap"], active: true, order: 20 },
    { id: "physiotherapy", label: "Physiothérapie", icon: "physiotherapy", fields: ["date", "duration", "location", "notes"], aliases: ["physiothérapie", "physiotherapie", "physio", "physical therapy"], active: true, order: 30 },
    { id: "osteopathy", label: "Ostéopathie", icon: "osteopathy", fields: ["date", "duration", "location", "notes"], aliases: ["ostéopathie", "osteopathie", "osteo", "osteopathy"], active: true, order: 40 },
    { id: "sauna", label: "Sauna", icon: "sauna", fields: ["date", "duration", "location", "notes"], aliases: ["sauna"], active: true, order: 50 },
    { id: "cold_bath", label: "Bain froid", icon: "cold", fields: ["date", "duration", "location", "notes"], aliases: ["bain froid", "cold bath", "ice bath", "bain glacé", "bain glace"], active: true, order: 60 },
    { id: "meditation", label: "Méditation", icon: "meditation", fields: ["date", "duration", "notes"], aliases: ["méditation", "meditation"], active: true, order: 70 },
    { id: "breathing", label: "Respiration", icon: "breathing", fields: ["date", "duration", "notes"], aliases: ["respiration", "breathing", "breathwork"], active: true, order: 80 },
    { id: "mobility", label: "Mobilité", icon: "mobility", fields: ["date", "duration", "notes"], aliases: ["mobilité", "mobilite", "mobility"], active: true, order: 90 },
    { id: "stretching", label: "Étirements", icon: "stretching", fields: ["date", "duration", "notes"], aliases: ["étirements", "etirements", "stretching"], active: true, order: 100 },
    { id: "recovery", label: "Récupération", icon: "recovery", fields: ["date", "duration", "location", "notes"], aliases: ["récupération", "recuperation", "recovery", "relaxation", "repos", "rest"], active: true, order: 110 },
    { id: "sleep", label: "Sommeil", icon: "sleep", fields: ["date", "duration", "notes"], aliases: ["sommeil", "sleep"], active: true, order: 120 },
    { id: "other", label: "Autre", icon: "wellbeing", fields: ["date", "duration", "location", "notes"], aliases: ["autre", "other"], active: true, order: 999 }
  ];

  function normalize(value) {
    return String(value || "").trim().toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function getAll(options = {}) {
    const { activeOnly = true } = options;
    return [...(activeOnly ? ACTIVITIES.filter((activity) => activity.active) : ACTIVITIES)].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }

  function getById(id) {
    if (!id) return null;
    return ACTIVITIES.find((activity) => activity.id === id) || null;
  }

  function resolve(value) {
    if (!value) return null;
    const directMatch = getById(value);
    if (directMatch) return directMatch;
    const normalizedValue = normalize(value);
    return ACTIVITIES.find((activity) => normalize(activity.label) === normalizedValue || activity.aliases.some((alias) => normalize(alias) === normalizedValue)) || null;
  }

  function resolveId(value) { return resolve(value)?.id || null; }
  function getLabel(value, fallback = "") { return resolve(value)?.label || fallback || value || ""; }
  const warnedFallbacks = new Set();
  function getIcon(value, fallback = "wellbeing") {
    const activity = resolve(value);
    if (activity) return activity.icon;
    const key = String(value || "(vide)");
    if (!warnedFallbacks.has(key)) {
      warnedFallbacks.add(key);
      console.warn(`MOMENTUM Bien-être : type inconnu « ${key} », icône générique utilisée.`);
    }
    return fallback;
  }
  function getFields(value) { return [...(resolve(value)?.fields || [])]; }
  function getOptions(options = {}) {
    return getAll(options).map((activity) => ({ value: activity.id, label: activity.label, icon: activity.icon, fields: [...activity.fields] }));
  }

  window.MomentumWellbeing = Object.freeze({ getAll, getById, resolve, resolveId, getLabel, getIcon, getFields, getOptions });
})();
