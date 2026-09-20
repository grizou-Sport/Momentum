/* =========================================================
   MOMENTUM — LocationPicker V1
   ---------------------------------------------------------
   Geoapify découvre. MOMENTUM normalise, nomme et mémorise.
   ========================================================= */

(() => {
  const MINIMUM_QUERY_LENGTH = 3;
  const SEARCH_DELAY = 350;
  let sharedProximityPromise = null;

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[character]);
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizedText(value) {
    return clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function locationSubtitle(location) {
    const locality = [location.postal_code, location.city].filter(Boolean).join(" ");
    return [location.address, locality, location.country].filter(Boolean).join(" · ");
  }

  function normalizeLocation(location = {}) {
    return {
      id: clean(location.id) || null,
      name: clean(location.name || location.location_name),
      address: clean(location.address) || null,
      postal_code: clean(location.postal_code) || null,
      city: clean(location.city) || null,
      country: clean(location.country) || null,
      country_code: clean(location.country_code).toUpperCase() || null,
      latitude: numberOrNull(location.latitude),
      longitude: numberOrNull(location.longitude),
      source: ["geoapify", "manual"].includes(location.source) ? location.source : "manual",
      provider_place_id: clean(location.provider_place_id) || null,
      visibility: location.visibility === "public" ? "public" : "private",
      owner_user_id: clean(location.owner_user_id) || null,
      created_by: clean(location.created_by) || null,
      structured: Boolean(location.structured || location.id || location.address || location.city || location.latitude !== undefined)
    };
  }

  function sameLocation(left, right) {
    if (!left || !right) return false;
    if (left.provider_place_id && right.provider_place_id) {
      return left.provider_place_id === right.provider_place_id;
    }
    const sameIdentity = normalizedText(left.name) === normalizedText(right.name)
      && normalizedText(left.address) === normalizedText(right.address)
      && normalizedText(left.city) === normalizedText(right.city)
      && normalizedText(left.country_code || left.country) === normalizedText(right.country_code || right.country);
    if (sameIdentity) return true;
    if (left.latitude === null || left.longitude === null || right.latitude === null || right.longitude === null) return false;
    return Math.abs(left.latitude - right.latitude) < 0.00015
      && Math.abs(left.longitude - right.longitude) < 0.00015
      && normalizedText(left.name) === normalizedText(right.name);
  }

  async function loadUserProximity() {
    if (sharedProximityPromise) return sharedProximityPromise;
    sharedProximityPromise = (async () => {
      if (!window.momentumDB) return null;
      const { data, error } = await window.momentumDB
        .from("user_locations")
        .select("latitude,longitude")
        .maybeSingle();
      if (error) return null;
      const latitude = numberOrNull(data?.latitude);
      const longitude = numberOrNull(data?.longitude);
      return latitude === null || longitude === null ? null : { latitude, longitude };
    })();
    return sharedProximityPromise;
  }

  function setUserProximity(location) {
    const latitude = numberOrNull(location?.latitude);
    const longitude = numberOrNull(location?.longitude);
    sharedProximityPromise = Promise.resolve(
      latitude === null || longitude === null ? null : { latitude, longitude }
    );
  }

  async function providerSearch(text, explicitProximity = null) {
    const parameters = new URLSearchParams({ text });
    const proximity = explicitProximity || await loadUserProximity();
    if (proximity && proximity.latitude !== null && proximity.longitude !== null) {
      parameters.set("latitude", String(proximity.latitude));
      parameters.set("longitude", String(proximity.longitude));
    }
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const request = window.MomentumNative?.fetchLocations
          ? (url, options) => window.MomentumNative.fetchLocations(parameters, options)
          : fetch;
        const response = await request(`/api/locations?${parameters}`, {
          headers: { Accept: "application/json" }
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(payload.error || "Recherche externe indisponible.");
          error.status = response.status;
          throw error;
        }
        return (payload.results || []).map((location) => normalizeLocation({
          ...location,
          visibility: "private",
          structured: true
        }));
      } catch (error) {
        lastError = error;
        const retryable = !error?.status || error.status === 429 || error.status >= 500;
        if (attempt === 0 && retryable) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        throw error;
      }
    }
    throw lastError || new Error("Recherche externe indisponible.");
  }

  async function momentumSearch(text) {
    if (!window.momentumDB) return [];
    const { data, error } = await window.momentumDB.rpc("search_locations", {
      search_term: text,
      result_limit: 10
    });
    if (error) {
      if (["42883", "PGRST202"].includes(error.code)) return [];
      throw error;
    }
    return (data || []).map(normalizeLocation);
  }

  class MomentumLocationPicker extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready === "true") return;
      this.dataset.ready = "true";
      this._selection = null;
      this._matches = [];
      this._requestId = 0;
      this._searchTimer = null;
      this._manualAddressTimer = null;
      this._manualAddressMatches = [];
      this._manualCoordinates = null;
      this._render();
      this._bind();
    }

    _render() {
      const name = this.getAttribute("name") || "location_name";
      const idName = this.getAttribute("location-id-name") || "location_id";
      const placeholder = this.getAttribute("placeholder") || "Rechercher un lieu, une adresse ou une ville…";
      const required = this.hasAttribute("required") ? "required" : "";
      const unique = `location-visibility-${crypto.randomUUID()}`;
      const referenceMode = this.getAttribute("mode") === "reference";

      this.innerHTML = `
        <div class="location-picker-shell">
          <input class="location-picker-input" type="search" autocomplete="off" spellcheck="false"
            placeholder="${escapeHTML(placeholder)}" aria-label="${escapeHTML(placeholder)}"
            aria-autocomplete="list" aria-expanded="false" ${required} />
          <input class="location-picker-name" type="hidden" name="${escapeHTML(name)}" />
          <input class="location-picker-id" type="hidden" name="${escapeHTML(idName)}" />
          <button class="location-picker-clear" type="button" aria-label="Effacer le lieu" hidden>×</button>
          <div class="location-picker-results" role="listbox" hidden></div>
          <div class="location-picker-meta">
            <p class="location-picker-status" aria-live="polite"></p>
            <button class="location-picker-edit" type="button" data-location-action="edit-selection" hidden>Corriger l’adresse</button>
          </div>
          <section class="location-picker-manual" hidden aria-label="Ajouter un nouveau lieu">
            <div class="location-picker-manual-head">
              <div><span>${referenceMode ? "Profil" : "Nouveau lieu"}</span><strong>${referenceMode ? "Définir mon lieu de référence" : "Créer un lieu MOMENTUM"}</strong></div>
              <button type="button" data-location-action="close-manual" aria-label="Fermer">×</button>
            </div>
            <label>Nom du lieu<input data-location-manual="name" maxlength="120" placeholder="Padel House Studen" /></label>
            <label>Adresse
              <input data-location-manual="address" autocomplete="street-address" placeholder="Büetigenstrasse 80" />
              <div class="location-picker-address-results" hidden></div>
            </label>
            <div class="location-picker-manual-grid">
              <label>NPA<input data-location-manual="postal_code" autocomplete="postal-code" /></label>
              <label>Ville<input data-location-manual="city" autocomplete="address-level2" /></label>
            </div>
            <label>Pays<input data-location-manual="country" autocomplete="country-name" /></label>
            <fieldset ${referenceMode ? "hidden" : ""}>
              <legend>Visibilité</legend>
              <label><input type="radio" name="${unique}" value="private" checked /> <span><strong>Lieu personnel</strong><small>Visible uniquement par vous</small></span></label>
              <label><input type="radio" name="${unique}" value="public" /> <span><strong>Lieu public MOMENTUM</strong><small>Établissement ou lieu accessible publiquement</small></span></label>
            </fieldset>
            <p class="location-picker-manual-error" aria-live="polite"></p>
            <div class="location-picker-manual-actions">
              <button type="button" data-location-action="close-manual">Annuler</button>
              <button type="button" data-location-action="save-manual">Utiliser ce lieu</button>
            </div>
          </section>
        </div>`;

      this._input = this.querySelector(".location-picker-input");
      this._nameInput = this.querySelector(".location-picker-name");
      this._idInput = this.querySelector(".location-picker-id");
      this._clearButton = this.querySelector(".location-picker-clear");
      this._results = this.querySelector(".location-picker-results");
      this._status = this.querySelector(".location-picker-status");
      this._editButton = this.querySelector(".location-picker-edit");
      this._manual = this.querySelector(".location-picker-manual");
    }

    _bind() {
      this._input.addEventListener("input", () => {
        if (clean(this._input.value) !== this._selection?.name) this._selection = null;
        this._editButton.hidden = !this._selection;
        this._syncHiddenInputs();
        clearTimeout(this._searchTimer);
        const text = clean(this._input.value);
        if (text.length < MINIMUM_QUERY_LENGTH) {
          this._closeResults();
          this._status.textContent = text ? `Encore ${MINIMUM_QUERY_LENGTH - text.length} caractère${text.length === 2 ? "" : "s"}…` : "";
          return;
        }
        this._status.textContent = "Recherche…";
        this._searchTimer = setTimeout(() => this._search(text), SEARCH_DELAY);
      });

      this._input.addEventListener("keydown", (event) => {
        if (event.key === "Escape") this._closeResults();
      });

      this._clearButton.addEventListener("click", () => this.clear());
      this._editButton.addEventListener("click", () => this._openManual(this._selection));

      this._results.addEventListener("click", (event) => {
        const resultButton = event.target.closest("[data-location-result]");
        if (resultButton) {
          const match = this._matches[Number(resultButton.dataset.locationResult)];
          if (match) this.setLocation(match);
          return;
        }
        if (event.target.closest('[data-location-action="open-manual"]')) this._openManual();
      });

      this._manual.addEventListener("click", (event) => {
        const addressButton = event.target.closest("[data-location-address-result]");
        if (addressButton) {
          const match = this._manualAddressMatches[Number(addressButton.dataset.locationAddressResult)];
          if (match) this._applyManualAddress(match);
          return;
        }
        const action = event.target.closest("[data-location-action]")?.dataset.locationAction;
        if (action === "close-manual") this._closeManual();
        if (action === "save-manual") this._saveManual();
      });

      this._manual.querySelector('[data-location-manual="address"]').addEventListener("input", (event) => {
        clearTimeout(this._manualAddressTimer);
        this._manualCoordinates = null;
        const text = clean(event.target.value);
        const container = this._manual.querySelector(".location-picker-address-results");
        if (text.length < MINIMUM_QUERY_LENGTH) {
          container.hidden = true;
          return;
        }
        this._manualAddressTimer = setTimeout(() => this._searchManualAddress(text), SEARCH_DELAY);
      });

      this._manual.querySelectorAll('[data-location-manual="postal_code"], [data-location-manual="city"], [data-location-manual="country"]').forEach((input) => {
        input.addEventListener("input", () => {
          this._manualCoordinates = null;
        });
      });

      const form = this.closest("form");
      form?.addEventListener("reset", () => this.clear());
    }

    async _search(text) {
      const requestId = ++this._requestId;
      const explicitLatitude = numberOrNull(this.getAttribute("latitude"));
      const explicitLongitude = numberOrNull(this.getAttribute("longitude"));
      const explicitProximity = explicitLatitude === null || explicitLongitude === null
        ? null
        : { latitude: explicitLatitude, longitude: explicitLongitude };

      let known = [];
      try {
        known = await momentumSearch(text);
      } catch {
        known = [];
      }
      if (requestId !== this._requestId || clean(this._input.value) !== text) return;

      const personal = known.filter((location) => location.visibility === "private");
      const publicLocations = known.filter((location) => location.visibility === "public");
      const exactPersonalMatch = personal.some((location) =>
        normalizedText(location.name) === normalizedText(text)
      );

      this._renderResults(personal, publicLocations, []);
      if (exactPersonalMatch) {
        this._status.textContent = "Lieu personnel déjà connu de MOMENTUM.";
        return;
      }

      try {
        const provider = await providerSearch(text, explicitProximity);
        if (requestId !== this._requestId || clean(this._input.value) !== text) return;
        this._renderResults(personal, publicLocations, provider);
        this._status.textContent = "";
      } catch {
        this._status.textContent = !known.length
          ? "Geoapify ne répond pas pour le moment. Réessaie ou crée le lieu manuellement."
          : "";
      }
    }

    _renderResults(personal, publicLocations, provider) {
      this._matches = [];
      const sections = [];
      const addSection = (title, locations) => {
        if (!locations.length) return;
        const buttons = locations.map((location) => {
          const index = this._matches.push(location) - 1;
          return `<button type="button" role="option" data-location-result="${index}">
            <strong>${escapeHTML(location.name)}</strong>
            <small>${escapeHTML(locationSubtitle(location) || "Lieu enregistré")}</small>
          </button>`;
        }).join("");
        sections.push(`<section><span>${title}</span>${buttons}</section>`);
      };

      addSection("Mes lieux", personal);
      addSection("Lieux MOMENTUM", publicLocations);
      addSection("Résultats", provider);
      sections.push('<button class="location-picker-add" type="button" data-location-action="open-manual">+ Ajouter un nouveau lieu</button>');
      this._results.innerHTML = sections.join("");
      this._results.hidden = false;
      this._input.setAttribute("aria-expanded", "true");
    }

    _closeResults() {
      this._results.hidden = true;
      this._input.setAttribute("aria-expanded", "false");
    }

    _openManual(location = null) {
      this._closeResults();
      this._manual.hidden = false;
      const selected = location ? normalizeLocation(location) : null;
      this._manual.querySelector('[data-location-manual="name"]').value = selected?.name || clean(this._input.value);
      ["address", "postal_code", "city", "country"].forEach((field) => {
        this._manual.querySelector(`[data-location-manual="${field}"]`).value = selected?.[field] || "";
      });
      this._manualCoordinates = selected && selected.latitude !== null && selected.longitude !== null
        ? {
            latitude: selected.latitude,
            longitude: selected.longitude,
            provider_place_id: selected.provider_place_id,
            country_code: selected.country_code
          }
        : null;
      const visibility = this.getAttribute("mode") === "reference" ? "private" : selected?.visibility || "private";
      const visibilityInput = this._manual.querySelector(`input[type="radio"][value="${visibility}"]`);
      if (visibilityInput) visibilityInput.checked = true;
      this._manual.querySelector('[data-location-manual="name"]').focus();
    }

    _closeManual() {
      this._manual.hidden = true;
      this._manual.querySelector(".location-picker-manual-error").textContent = "";
      this._input.focus();
    }

    async _searchManualAddress(text) {
      const container = this._manual.querySelector(".location-picker-address-results");
      try {
        this._manualAddressMatches = await providerSearch(text);
        container.innerHTML = this._manualAddressMatches.map((location, index) => `
          <button type="button" data-location-address-result="${index}">
            <strong>${escapeHTML(location.address || location.name)}</strong>
            <small>${escapeHTML(locationSubtitle(location))}</small>
          </button>`).join("");
        container.hidden = !this._manualAddressMatches.length;
      } catch {
        container.hidden = true;
      }
    }

    _applyManualAddress(location) {
      const fields = ["address", "postal_code", "city", "country"];
      fields.forEach((field) => {
        this._manual.querySelector(`[data-location-manual="${field}"]`).value = location[field] || "";
      });
      this._manualCoordinates = {
        latitude: location.latitude,
        longitude: location.longitude,
        provider_place_id: location.provider_place_id,
        country_code: location.country_code
      };
      this._manual.querySelector(".location-picker-address-results").hidden = true;
    }

    _saveManual() {
      const read = (field) => clean(this._manual.querySelector(`[data-location-manual="${field}"]`).value);
      const name = read("name");
      const address = read("address");
      const city = read("city");
      const country = read("country");
      const error = this._manual.querySelector(".location-picker-manual-error");
      if (!name || (!address && !city)) {
        error.textContent = "Ajoute un nom et au moins une adresse ou une ville.";
        return;
      }
      const visibility = this.getAttribute("mode") === "reference"
        ? "private"
        : this._manual.querySelector('input[type="radio"]:checked')?.value || "private";
      this.setLocation({
        name,
        address: address || null,
        postal_code: read("postal_code") || null,
        city: city || null,
        country: country || null,
        country_code: this._manualCoordinates?.country_code ?? null,
        latitude: this._manualCoordinates?.latitude ?? null,
        longitude: this._manualCoordinates?.longitude ?? null,
        provider_place_id: this._manualCoordinates?.provider_place_id ?? null,
        source: this._manualCoordinates ? "geoapify" : "manual",
        visibility,
        structured: true
      });
      this._closeManual();
    }

    _syncHiddenInputs() {
      this._nameInput.value = clean(this._input.value);
      this._idInput.value = this._selection?.id || "";
      this._clearButton.hidden = !clean(this._input.value);
    }

    setLocation(location) {
      const normalized = normalizeLocation(location);
      if (!normalized.name) return;
      this._selection = normalized;
      this._input.value = normalized.name;
      this._syncHiddenInputs();
      this._closeResults();
      this._status.textContent = locationSubtitle(normalized);
      this._editButton.hidden = !normalized.structured;
      this.dispatchEvent(new CustomEvent("locationchange", {
        bubbles: true,
        detail: { location: this.getLocation() }
      }));
    }

    getLocation() {
      const typedName = clean(this._input.value);
      if (this._selection && typedName === this._selection.name) return { ...this._selection };
      return typedName ? normalizeLocation({ name: typedName, structured: false }) : null;
    }

    clear() {
      this._selection = null;
      if (this._input) this._input.value = "";
      if (this._status) this._status.textContent = "";
      if (this._editButton) this._editButton.hidden = true;
      if (this._manual) this._manual.hidden = true;
      this._syncHiddenInputs();
      this._closeResults();
    }
  }

  async function findDuplicate(location) {
    if (location.provider_place_id && window.momentumDB) {
      const { data, error } = await window.momentumDB
        .from("locations")
        .select("id,name,address,postal_code,city,country,country_code,latitude,longitude,source,provider_place_id,visibility,owner_user_id,created_by")
        .eq("provider_place_id", location.provider_place_id)
        .eq("visibility", location.visibility)
        .limit(1)
        .maybeSingle();
      if (!error && data) return normalizeLocation(data);
    }
    const candidates = await momentumSearch(location.name);
    return candidates.find((candidate) => {
      if (candidate.visibility !== location.visibility) return false;
      return sameLocation(candidate, location);
    }) || null;
  }

  async function resolveForSave(picker, userId) {
    if (!picker) return { location: null, created: false };
    const location = picker.getLocation();
    if (!location?.name) return { location: null, created: false };
    if (location.id || !location.structured) return { location, created: false };

    const duplicate = await findDuplicate(location);
    if (duplicate) {
      picker.setLocation(duplicate);
      return { location: duplicate, created: false };
    }

    const payload = {
      name: location.name,
      address: location.address,
      postal_code: location.postal_code,
      city: location.city,
      country: location.country,
      country_code: location.country_code,
      latitude: location.latitude,
      longitude: location.longitude,
      source: location.source,
      provider_place_id: location.provider_place_id,
      visibility: location.visibility,
      owner_user_id: location.visibility === "private" ? userId : null,
      created_by: userId
    };

    const { data, error } = await window.momentumDB
      .from("locations")
      .insert(payload)
      .select("id,name,address,postal_code,city,country,country_code,latitude,longitude,source,provider_place_id,visibility,owner_user_id,created_by")
      .single();

    if (error?.code === "23505") {
      const concurrentDuplicate = await findDuplicate(location);
      if (concurrentDuplicate) {
        picker.setLocation(concurrentDuplicate);
        return { location: concurrentDuplicate, created: false };
      }
    }
    if (error) throw error;

    const persisted = normalizeLocation(data);
    picker.setLocation(persisted);
    return { location: persisted, created: true };
  }

  async function rollbackCreated(result) {
    if (!result?.created || !result.location?.id || !window.momentumDB) return;
    await window.momentumDB.from("locations").delete().eq("id", result.location.id);
  }

  window.MomentumLocations = {
    MINIMUM_QUERY_LENGTH,
    SEARCH_DELAY,
    normalizeLocation,
    sameLocation,
    providerSearch,
    momentumSearch,
    setUserProximity,
    resolveForSave,
    rollbackCreated
  };

  if (!customElements.get("momentum-location-picker")) {
    customElements.define("momentum-location-picker", MomentumLocationPicker);
  }
})();
