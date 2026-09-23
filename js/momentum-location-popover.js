/* =========================================================
   MOMENTUM — Location popover
   ---------------------------------------------------------
   Détail léger d'un lieu, partagé entre souris et toucher.
   ========================================================= */

(function initialiseLocationPopover() {
  let popover = null;
  let currentTrigger = null;
  let closeTimer = 0;
  let requestId = 0;
  const reverseCache = new Map();

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
    })[character]);
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalise(location = {}) {
    return {
      name:String(location.name || location.locationName || "").trim(),
      address:String(location.address || "").trim(),
      postal_code:String(location.postal_code || "").trim(),
      city:String(location.city || "").trim(),
      country:String(location.country || "").trim(),
      latitude:numberOrNull(location.latitude),
      longitude:numberOrNull(location.longitude)
    };
  }

  function hasCoordinates(location) {
    return location.latitude !== null && location.longitude !== null;
  }

  function hasDetails(location) {
    return Boolean(location.address || location.postal_code || location.city || location.country || hasCoordinates(location));
  }

  function triggerHTML(location, options = {}) {
    const normalised = normalise(location);
    if (!normalised.name) return "";
    const label = String(options.label || "Lieu").trim();
    const className = String(options.className || "").trim();
    const content = `📍 <span>${escapeHTML(label)} :</span> <strong>${escapeHTML(normalised.name)}</strong>`;

    if (!hasDetails(normalised)) return `<span class="${escapeHTML(className)}">${content}</span>`;

    const payload = encodeURIComponent(JSON.stringify(normalised));
    return `<button type="button" class="momentum-location-trigger ${escapeHTML(className)}" data-location-popover="${payload}" aria-haspopup="dialog" aria-expanded="false" aria-label="Voir l’adresse de ${escapeHTML(normalised.name)}">${content}</button>`;
  }

  function ensurePopover(host) {
    if (!popover) {
      popover = document.createElement("aside");
      popover.className = "momentum-location-popover";
      popover.hidden = true;
      popover.setAttribute("role", "dialog");
      popover.setAttribute("aria-label", "Détails du lieu");
      popover.innerHTML = `<div class="momentum-location-popover-inner">
        <div class="momentum-location-popover-head"><div><span class="momentum-location-popover-kicker">Lieu</span><h3></h3></div><button class="momentum-location-popover-close" type="button" aria-label="Fermer">×</button></div>
        <address class="momentum-location-address"></address>
        <p class="momentum-location-status"></p>
        <div class="momentum-location-mini-map momentum-map" hidden aria-label="Carte du lieu"></div>
      </div>`;
      popover.querySelector(".momentum-location-popover-close").addEventListener("click", close);
      popover.addEventListener("pointerenter", () => window.clearTimeout(closeTimer));
      popover.addEventListener("pointerleave", scheduleClose);
    }
    if (popover.parentElement !== host) host.append(popover);
    return popover;
  }

  function addressLines(location) {
    const locality = [location.postal_code, location.city].filter(Boolean).join(" ");
    return [location.address, locality, location.country].filter(Boolean);
  }

  function positionPopover() {
    if (!currentTrigger || !popover || popover.hidden || window.innerWidth <= 700) return;
    const triggerBounds = currentTrigger.getBoundingClientRect();
    const popupBounds = popover.getBoundingClientRect();
    const margin = 12;
    const left = Math.max(margin, Math.min(window.innerWidth - popupBounds.width - margin, triggerBounds.left));
    const below = triggerBounds.bottom + 10;
    const top = below + popupBounds.height <= window.innerHeight - margin
      ? below
      : Math.max(margin, triggerBounds.top - popupBounds.height - 10);
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
  }

  function render(location, status = "") {
    popover.querySelector("h3").textContent = location.name;
    const address = popover.querySelector(".momentum-location-address");
    address.innerHTML = addressLines(location).map((line) => `<span>${escapeHTML(line)}</span>`).join("");
    popover.querySelector(".momentum-location-status").textContent = status;

    const map = popover.querySelector(".momentum-location-mini-map");
    window.MomentumMap?.clear(map);
    map.hidden = !hasCoordinates(location);
    if (!map.hidden) window.MomentumMap?.renderLocation(map, location, { zoom:15, zoomControl:false });
    window.requestAnimationFrame(positionPopover);
  }

  async function reverseGeocode(location, activeRequest) {
    if (!hasCoordinates(location) || location.address) return;
    const key = `${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`;
    let result = reverseCache.get(key);

    if (!reverseCache.has(key)) {
      const parameters = new URLSearchParams({
        latitude:String(location.latitude),
        longitude:String(location.longitude)
      });
      try {
        const request = window.MomentumNative?.fetchLocations
          ? (url, options) => window.MomentumNative.fetchLocations(parameters, options)
          : fetch;
        const response = await request(`/api/locations?${parameters}`, { headers:{ Accept:"application/json" } });
        const payload = await response.json().catch(() => ({}));
        result = response.ok ? payload.results?.[0] || null : null;
      } catch (_error) {
        result = null;
      }
      reverseCache.set(key, result);
    }

    if (activeRequest !== requestId || !currentTrigger) return;
    if (!result) {
      render(location, "Adresse non précisée.");
      return;
    }
    render({ ...location, ...result, name:location.name }, "");
  }

  function open(trigger) {
    window.clearTimeout(closeTimer);
    if (currentTrigger === trigger && popover && !popover.hidden) return;
    const location = normalise(JSON.parse(decodeURIComponent(trigger.dataset.locationPopover)));
    if (!location.name) return;

    if (currentTrigger && currentTrigger !== trigger) currentTrigger.setAttribute("aria-expanded", "false");
    currentTrigger = trigger;
    currentTrigger.setAttribute("aria-expanded", "true");
    const host = trigger.closest("dialog[open]") || document.body;
    ensurePopover(host);
    popover.hidden = false;
    const activeRequest = ++requestId;
    render(location, !location.address && hasCoordinates(location) ? "Recherche de l’adresse…" : "");
    reverseGeocode(location, activeRequest);
  }

  function close() {
    window.clearTimeout(closeTimer);
    requestId += 1;
    if (currentTrigger) currentTrigger.setAttribute("aria-expanded", "false");
    currentTrigger = null;
    if (!popover) return;
    window.MomentumMap?.clear(popover.querySelector(".momentum-location-mini-map"));
    popover.hidden = true;
  }

  function scheduleClose() {
    if (!window.matchMedia("(hover:hover) and (pointer:fine)").matches) return;
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(close, 180);
  }

  document.addEventListener("pointerover", (event) => {
    const trigger = event.target.closest?.("[data-location-popover]");
    if (trigger && window.matchMedia("(hover:hover) and (pointer:fine)").matches) open(trigger);
  });
  document.addEventListener("pointerout", (event) => {
    if (event.target.closest?.("[data-location-popover]") && !popover?.contains(event.relatedTarget)) scheduleClose();
  });
  document.addEventListener("focusin", (event) => {
    const trigger = event.target.closest?.("[data-location-popover]");
    if (trigger) open(trigger);
  });
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest?.("[data-location-popover]");
    if (trigger) {
      if (currentTrigger === trigger && !popover?.hidden && !window.matchMedia("(hover:hover) and (pointer:fine)").matches) close();
      else open(trigger);
      return;
    }
    if (popover && !popover.hidden && !popover.contains(event.target)) close();
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  document.addEventListener("close", close, true);
  document.addEventListener("scroll", positionPopover, true);
  window.addEventListener("resize", positionPopover);

  window.MomentumLocationPopover = Object.freeze({ triggerHTML, close });
})();
