/* =========================================================
   MOMENTUM — DurationPicker
   ---------------------------------------------------------
   Convention produit : une durée est toujours échangée en
   minutes et présentée dans un champ unique HH:MM.
   ========================================================= */

(function initializeDurationPicker() {
  function parseDuration(value) {
    const raw = String(value ?? "").trim().replace(/\s/g, "");
    if (!raw) return null;

    if (/^\d+$/.test(raw)) return Number(raw);

    const match = raw.match(/^(\d+):([0-5]?\d)$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function formatDuration(value) {
    const minutes = Math.max(0, Math.round(Number(value) || 0));
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }

  class DurationPicker extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready === "true") return;
      this.dataset.ready = "true";

      const name = this.getAttribute("name") || "duration";
      const initial = parseDuration(this.getAttribute("value"));
      const label = this.getAttribute("aria-label") || "Durée";

      this.innerHTML = `
        <div class="duration-picker-shell">
          <button class="duration-step" type="button" data-duration-delta="-5" aria-label="Retirer 5 minutes">−</button>
          <input class="duration-display" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" aria-label="${label}. Format heures deux-points minutes" placeholder="00:00" />
          <button class="duration-step" type="button" data-duration-delta="5" aria-label="Ajouter 5 minutes">+</button>
        </div>
        <input type="hidden" name="${name}" />
        <small class="duration-hint">Saisis 1:20 ou 80 min</small>
      `;

      this.display = this.querySelector(".duration-display");
      this.hiddenInput = this.querySelector('input[type="hidden"]');
      this.value = initial;

      this.querySelectorAll("[data-duration-delta]").forEach((button) => {
        button.addEventListener("click", () => {
          const current = this.value ?? 0;
          this.value = Math.max(0, current + Number(button.dataset.durationDelta));
          this.dispatchEvent(new Event("change", { bubbles:true }));
        });
      });

      this.display.addEventListener("focus", () => this.display.select());
      this.display.addEventListener("input", () => {
        const parsed = parseDuration(this.display.value);
        this.hiddenInput.value = parsed == null ? "" : String(parsed);
      });
      this.display.addEventListener("blur", () => {
        this.value = parseDuration(this.display.value);
      });
      this.display.addEventListener("keydown", (event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          this.value = Math.max(0, (this.value ?? 0) + (event.key === "ArrowUp" ? 5 : -5));
        }
      });
    }

    get value() {
      if (!this.hiddenInput) return parseDuration(this.getAttribute("value"));
      return this.hiddenInput.value === "" ? null : Number(this.hiddenInput.value);
    }

    set value(value) {
      const parsed = value === null || value === undefined || value === "" ? null : parseDuration(value);
      if (!this.hiddenInput || !this.display) {
        if (parsed == null) this.removeAttribute("value");
        else this.setAttribute("value", String(parsed));
        return;
      }
      this.hiddenInput.value = parsed == null ? "" : String(parsed);
      this.display.value = parsed == null ? "" : formatDuration(parsed);
    }
  }

  if (!customElements.get("duration-picker")) {
    customElements.define("duration-picker", DurationPicker);
  }

  window.MomentumDuration = Object.freeze({ parse:parseDuration, format:formatDuration });
})();
