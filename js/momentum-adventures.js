// =====================================================
// MOMENTUM — RÉFÉRENTIEL DES AVENTURES
// =====================================================

(function initializeMomentumAdventures() {
  const ACTIVITIES = [
    { id: "photography", label: "Photographie", icon: "camera", fields: ["date", "duration", "location", "notes", "photos"], aliases: ["photographie", "photo", "photography"], active: true, order: 10 },
    { id: "sunrise", label: "Lever de soleil", icon: "sunrise", fields: ["date", "duration", "location", "notes", "photos"], aliases: ["lever de soleil", "sunrise", "aube"], active: true, order: 20 },
    { id: "nature_outing", label: "Sortie nature", icon: "leaf", fields: ["date", "duration", "location", "notes", "photos"], aliases: ["sortie nature", "nature", "outdoor"], active: true, order: 30 },
    { id: "exploration", label: "Exploration", icon: "compass", fields: ["date", "duration", "location", "notes", "photos"], aliases: ["exploration", "découverte", "decouverte"], active: true, order: 40 },
    { id: "road_trip", label: "Road trip", icon: "route", fields: ["date", "duration", "location", "notes", "photos"], aliases: ["road trip", "roadtrip"], active: true, order: 50 },
    { id: "travel", label: "Voyage", icon: "plane", fields: ["date", "duration", "location", "notes", "photos"], aliases: ["voyage", "travel", "trip"], active: true, order: 60 },
    { id: "bivouac", label: "Bivouac", icon: "tent", fields: ["date", "duration", "location", "notes", "photos"], aliases: ["bivouac", "camping", "camp"], active: true, order: 70 },
    { id: "reading", label: "Lecture", icon: "book-open", fields: ["date", "duration", "location", "notes"], aliases: ["lecture", "reading", "livre"], active: true, order: 80 },
    { id: "cooking", label: "Cuisine", icon: "utensils", fields: ["date", "duration", "location", "notes", "photos"], aliases: ["cuisine", "cooking"], active: true, order: 90 },
    { id: "personal_project", label: "Projet personnel", icon: "sparkles", fields: ["date", "duration", "location", "notes", "photos"], aliases: ["projet personnel", "personal project", "projet"], active: true, order: 100 },
    { id: "other", label: "Autre", icon: "circle-ellipsis", fields: ["date", "duration", "location", "notes", "photos"], aliases: ["autre", "other"], active: true, order: 999 }
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
  function getIcon(value, fallback = "circle-ellipsis") { return resolve(value)?.icon || fallback; }
  function getFields(value) { return [...(resolve(value)?.fields || [])]; }
  function getOptions(options = {}) {
    return getAll(options).map((activity) => ({ value: activity.id, label: activity.label, icon: activity.icon, fields: [...activity.fields] }));
  }

  window.MomentumAdventures = Object.freeze({ getAll, getById, resolve, resolveId, getLabel, getIcon, getFields, getOptions });
})();
