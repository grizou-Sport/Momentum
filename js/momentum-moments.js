/* =========================================================
   MOMENTUM — SHARED MOMENT RULES
   ---------------------------------------------------------
   Classement calendrier commun aux pages HOME et TOGETHER.
   ========================================================= */

(function initializeMomentumMoments() {
  function localDateKey(value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function calendarStatus(moment, today = new Date()) {
    if (["COMPLETED", "CANCELLED"].includes(moment?.status)) {
      return "past";
    }

    if (
      !moment?.start_at ||
      ["DRAFT", "PLANNING"].includes(moment.status)
    ) {
      return "planning";
    }

    const momentDate = localDateKey(moment.start_at);
    const todayDate = localDateKey(today);

    if (!momentDate || !todayDate) return "planning";
    if (momentDate === todayDate) return "today";
    return momentDate > todayDate ? "upcoming" : "past";
  }

  function isCompletedActivity(activity) {
    return String(activity?.status || "").toLowerCase() === "done";
  }

  window.MomentumMoments = Object.freeze({
    calendarStatus,
    localDateKey,
    isCompletedActivity
  });
})();
