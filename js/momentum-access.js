/* Accès : erreurs temporaires ≠ absence de compte. Aucune redirection externe. */
(function exposeAccess(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MomentumAccess = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const allowed = new Set(["index.html", "you.html", "progression.html", "together.html"]);
  function safeReturn(value, origin = "https://momentum.invalid") {
    if (typeof value !== "string" || /[\\\u0000-\u001f]/.test(value)) return "index.html";
    try {
      const url = new URL(value, origin);
      const base = new URL(origin);
      if (url.protocol !== base.protocol || url.host !== base.host || url.origin !== base.origin || url.username || url.password) return "index.html";
      const path = url.pathname.replace(/^\//, "");
      if (!allowed.has(path)) return "index.html";
      return path + url.search + url.hash;
    } catch (_) { return "index.html"; }
  }
  function complete(passport) {
    return passport?.personalization?.onboarding_completed === true || Number(passport?.personalization?.minimal_onboarding_version) >= 1;
  }
  async function check(db) {
    if (!db) return { status:"temporary_error" };
    try {
      const session = await db.auth.getSession();
      if (session.error) return { status:"temporary_error" };
      if (!session.data?.session) return { status:"anonymous" };
      const result = await db.auth.getUser();
      if (result.error) {
        const confirmedInvalid = ["session_not_found", "refresh_token_not_found", "refresh_token_already_used", "bad_jwt", "user_not_found"].includes(result.error.code);
        return { status:confirmedInvalid ? "expired" : "temporary_error" };
      }
      if (!result.data?.user) return { status:"expired" };
      const user = result.data.user;
      const profile = await db.from("passports").select("personalization,display_name").eq("user_id", user.id).maybeSingle();
      if (profile.error) return { status:"temporary_error" };
      return { status:complete(profile.data) ? "ready" : "onboarding", user, passport:profile.data };
    } catch (_) { return { status:"temporary_error" }; }
  }
  return Object.freeze({ safeReturn, complete, check });
});
