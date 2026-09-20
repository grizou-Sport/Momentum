/* Le contenu privé reste masqué jusqu'à confirmation ; une panne offre une reprise sans déconnexion. */
(function initializeGuard() {
  "use strict";
  const style = document.createElement("style");
  style.textContent = 'html[data-access-pending] body > :not(#momentumAccessStatus):not(script):not(style){display:none!important}#momentumAccessStatus{max-width:36rem;margin:15vh auto;padding:2rem;font:1rem/1.6 system-ui}#momentumAccessStatus button,#momentumAccessStatus a{margin:1rem .7rem 0 0;min-height:44px}';
  document.head.append(style);
  document.documentElement.dataset.accessPending = "true";
  const panel = document.createElement("section");
  panel.id = "momentumAccessStatus";
  panel.setAttribute("role", "status"); panel.setAttribute("aria-live", "polite");
  document.body.append(panel);
  let attempt = 0;
  let resolveReady;
  // Le même Promise est résolu après une reprise : tous les consommateurs attendent le bon compte.
  window.momentumPageReady = new Promise(resolve => { resolveReady = resolve; });
  function message(failed) {
    panel.replaceChildren();
    const title = document.createElement("h1"), text = document.createElement("p");
    title.textContent = "MOMENTUM";
    text.textContent = failed ? "Impossible de charger ton espace pour le moment." : "Ouverture de ton espace…";
    panel.append(title, text);
    if (failed) {
      const retry = document.createElement("button"); retry.type = "button"; retry.textContent = "Réessayer"; retry.onclick = protectPage;
      const back = document.createElement("a"); back.href = "discover.html"; back.textContent = "Retour à la découverte";
      panel.append(retry, back);
    }
  }
  async function protectPage() {
    const version = ++attempt;
    message(false);
    let timeout;
    const result = await Promise.race([
      window.MomentumAccess.check(window.momentumDB),
      new Promise(resolve => { timeout = setTimeout(() => resolve({ status:"temporary_error" }), 12000); })
    ]);
    clearTimeout(timeout);
    if (version !== attempt) return;
    const requested = window.MomentumAccess.safeReturn(location.pathname + location.search + location.hash, window.MomentumNative?.origin || location.origin);
    if (["anonymous", "expired"].includes(result.status)) {
      if (result.status === "expired") await window.momentumDB.auth.signOut({ scope:"local" });
      location.replace(`login.html?returnTo=${encodeURIComponent(requested)}`); return;
    }
    if (result.status === "onboarding") { location.replace(`welcome.html?returnTo=${encodeURIComponent(requested)}`); return; }
    if (result.status !== "ready") { message(true); return; }
    window.MomentumSession?.activate(result.user.id);
    await Promise.race([window.MomentumPreferences?.load(result.user.id),new Promise(resolve=>setTimeout(resolve,2500))]);
    if (version !== attempt) return;
    panel.remove(); delete document.documentElement.dataset.accessPending;
    resolveReady(result.user);
  }
  protectPage();
})();
