// MOMENTUM — profil de pratique sportive
// Fusionne les terrains déclarés à l'inscription avec les activités réalisées.
(function initializeYouSportProfile() {
  const DAY_MS = 24 * 60 * 60 * 1000;

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function resolveSport(value) {
    const resolved = window.MomentumSports?.resolve(value);
    const wellbeing = resolved ? null : window.MomentumWellbeing?.resolve(value);
    const label = resolved?.label || wellbeing?.label || String(value || "").trim();
    if (!label) return null;
    return {
      id: resolved?.id || wellbeing?.id || normalize(label).replace(/[^a-z0-9]+/g, "-"),
      label,
      icon: resolved?.icon || wellbeing?.icon || "activity",
      iconCollection: wellbeing ? "wellbeing" : "sports",
      traits: resolved?.traits || (wellbeing ? ["wellbeing"] : []),
    };
  }

  function isCompletedActivity(activity) {
    const status = normalize(activity.status);
    return !["planned", "cancelled", "canceled", "prevu", "annule"].includes(status);
  }

  function practiceLevel(dates, now, sport) {
    if (!dates.length) return { id: "declared", label: "Déclaré" };

    const recentLimit = new Date(now.getTime() - 90 * DAY_MS);
    const recentSessions = dates.filter((date) => date >= recentLimit).length;
    const activeMonths = new Set(dates.map((date) => `${date.getFullYear()}-${date.getMonth()}`)).size;
    const ordered = [...dates].sort((a, b) => a - b);
    const spanDays = (ordered.at(-1) - ordered[0]) / DAY_MS;

    if (sport.traits.includes("winter") && dates.length >= 3 && activeMonths <= 6) {
      return { id: "seasonal", label: "Saisonnier" };
    }
    if (recentSessions >= 6 || (dates.length >= 12 && activeMonths >= 5)) {
      return { id: "regular", label: "Régulier" };
    }
    if (dates.length >= 4 && activeMonths >= 2 && activeMonths <= 4 && spanDays >= 30) {
      return { id: "seasonal", label: "Saisonnier" };
    }
    return { id: "occasional", label: "Occasionnel" };
  }

  function build(userSports = [], activities = [], options = {}) {
    const now = options.now instanceof Date ? options.now : new Date();
    const historyLimit = new Date(now.getTime() - 365 * DAY_MS);
    const profiles = new Map();

    userSports
      .filter((item) => item.active !== false)
      .forEach((item) => {
        const sport = resolveSport(item.sports?.name);
        if (!sport) return;
        profiles.set(sport.id, {
          ...sport,
          questionnaire: true,
          questionnaireRole: item.role || "Secondaire",
          dates: [],
        });
      });

    activities
      .filter(isCompletedActivity)
      .forEach((activity) => {
        const date = new Date(activity.activity_date);
        if (!Number.isFinite(date.getTime()) || date < historyLimit || date > now) return;
        const sport = resolveSport(activity.sport || activity.activity_type);
        if (!sport) return;
        const profile = profiles.get(sport.id) || {
          ...sport,
          questionnaire: false,
          questionnaireRole: null,
          dates: [],
        };
        profile.dates.push(date);
        profiles.set(sport.id, profile);
      });

    const order = { regular: 0, seasonal: 1, occasional: 2, declared: 3 };
    return [...profiles.values()]
      .map((profile) => {
        const level = practiceLevel(profile.dates, now, profile);
        return {
          id: profile.id,
          label: profile.label,
          icon: profile.icon,
          iconCollection: profile.iconCollection,
          level: level.id,
          levelLabel: level.label,
          sessionCount: profile.dates.length,
          questionnaire: profile.questionnaire,
          questionnaireRole: profile.questionnaireRole,
        };
      })
      .sort((a, b) => order[a.level] - order[b.level] || b.sessionCount - a.sessionCount || a.label.localeCompare(b.label, "fr"));
  }

  window.MomentumSportProfile = Object.freeze({ build });
})();
