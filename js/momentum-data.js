/* Accès partagé aux listes : chargement complet explicite, ordre stable et cache par compte.
 * Le cache ne persiste jamais sur disque. Les écritures invalident les résultats dérivés.
 */
(function initializeMomentumData() {
  "use strict";
  const histories = new Map();
  let generation = 0;
  async function all(queryFactory, { pageSize = 500, key = "id" } = {}) {
    const data = [], seen = new Set();
    let expected = null;
    for (let offset = 0; ; offset += pageSize) {
      const result = await queryFactory().range(offset, offset + pageSize - 1);
      if (result.error) throw result.error;
      if (!Array.isArray(result.data)) throw new Error("Réponse de données incomplète.");
      if (Number.isInteger(result.count)) {
        if (expected != null && expected !== result.count) throw new Error("Les données ont changé pendant leur lecture. Réessaie.");
        expected = result.count;
      }
      for (const row of result.data) {
        if (row[key] == null || seen.has(row[key])) throw new Error("Pagination incohérente. Réessaie.");
        seen.add(row[key]); data.push(row);
      }
      if (result.data.length < pageSize) {
        if (expected != null && data.length !== expected) throw new Error("L'historique n'a pas été chargé intégralement.");
        return { data, error:null, complete:true, count:data.length };
      }
      if (offset > 1000000) throw new Error("Volume trop important pour ce chargement interactif.");
    }
  }
  async function history(userId, { refresh = false } = {}) {
    if (!userId) throw new Error("Session requise.");
    if (!refresh && histories.has(userId)) return histories.get(userId);
    const revision = generation;
    const promise = all(() => window.momentumDB.from("activities").select("*", { count:"exact" })
      .eq("user_id", userId).order("activity_date", { ascending:true, nullsFirst:true }).order("id"));
    histories.set(userId, promise);
    try {
      const result = await promise;
      if (revision !== generation) throw new Error("Historique modifié pendant le chargement. Réessaie.");
      return result;
    } catch (error) { if (histories.get(userId) === promise) histories.delete(userId); throw error; }
  }
  function invalidate() { generation += 1; histories.clear(); }
  window.addEventListener("momentum:activities-changed", invalidate);
  window.addEventListener("momentum:session-cleared", invalidate);
  function trainingActivity(activity) {
    const value = activity.practice_id || activity.sport || activity.activity_type;
    const resolved = (activity.activity_category === "wellbeing" ? window.MomentumWellbeing?.resolveId(value) : null)
      || window.MomentumSports?.resolveId(value) || window.MomentumWellbeing?.resolveId(value);
    return { ...activity, practice_id:resolved || value };
  }
  window.MomentumData = Object.freeze({ all, history, invalidate, trainingActivity });
})();
