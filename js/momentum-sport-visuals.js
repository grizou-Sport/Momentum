(function initializeMomentumSportVisuals() {
  const COLORS = Object.freeze({
    running: "#d9763d", trail_running: "#c45f35",
    cycling: "#3979a8", gravel_cycling: "#557f9c", mountain_biking: "#2f688d",
    swimming: "#2f9d9b", open_water_swimming: "#238a91",
    hiking: "#66845b", walking: "#829477", trekking: "#536f4d",
    strength_training: "#a47b3e", fitness: "#b08c52", crossfit: "#8f6838",
    wellbeing: "#8b7aa3", adventure: "#9b7653", other: "#77766f",
  });
  const CATEGORY_COLORS = Object.freeze({ endurance:"#d9763d", mountain:"#66845b", water:"#2f9d9b", strength_fitness:"#a47b3e", racket:"#b45f6d", team:"#6f69a5", combat:"#9a5549", precision:"#988451", movement:"#627d91", other:"#77766f" });

  function resolveRoot(value) {
    let sport = window.MomentumSports?.resolve(value);
    if (!sport) return null;
    while (sport.parent && window.MomentumSports?.getById(sport.parent)) sport = window.MomentumSports.getById(sport.parent);
    return sport;
  }
  function getColor(value, category) {
    if (category === "wellbeing") return COLORS.wellbeing;
    if (category === "adventure") return COLORS.adventure;
    const sport = window.MomentumSports?.resolve(value);
    const root = resolveRoot(value);
    return COLORS[sport?.id] || COLORS[root?.id] || CATEGORY_COLORS[sport?.category] || COLORS.other;
  }
  function getGroup(value, category) {
    if (category === "wellbeing") return { id:"wellbeing", label:"Bien-être", color:COLORS.wellbeing };
    if (category === "adventure") return { id:"adventure", label:"Aventure", color:COLORS.adventure };
    const root = resolveRoot(value);
    return { id:root?.id || "other", label:root?.label || "Autre", color:getColor(value, category) };
  }
  window.MomentumSportVisuals = Object.freeze({ COLORS, getColor, getGroup });
})();
