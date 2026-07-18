/* =========================================================
   MOMENTUM — CURSEUR PARTAGÉ
   ========================================================= */

(function initializeMomentumSlider() {
  class MomentumSlider extends HTMLElement {
    static formAssociated = true;
    static get observedAttributes() { return ["disabled", "required"]; }

    constructor() {
      super();
      this.internals = this.attachInternals();
      this.currentValue = null;
    }

    connectedCallback() {
      if (this.dataset.ready === "true") return;
      this.dataset.ready = "true";
      this.render();
      this.sync();
    }

    attributeChangedCallback() {
      if (this.dataset.ready === "true") this.sync();
    }

    get name() { return this.getAttribute("name") || ""; }

    get value() { return this.currentValue == null ? "" : String(this.currentValue); }

    set value(nextValue) {
      const numeric = Number(nextValue);
      const min = Number(this.getAttribute("min") || 1);
      const max = Number(this.getAttribute("max") || 10);
      this.currentValue = nextValue === "" || nextValue == null || !Number.isFinite(numeric)
        ? null
        : Math.max(min, Math.min(max, numeric));
      if (this.input && this.currentValue != null) this.input.value = String(this.currentValue);
      this.sync();
    }

    formResetCallback() { this.value = null; }

    formDisabledCallback(disabled) {
      if (disabled) this.setAttribute("disabled", "");
      else this.removeAttribute("disabled");
    }

    render() {
      const title = this.getAttribute("title") || "Valeur";
      const min = this.getAttribute("min") || "1";
      const max = this.getAttribute("max") || "10";
      const minLabel = this.getAttribute("min-label") || min;
      const maxLabel = this.getAttribute("max-label") || max;
      const inputId = `momentum-slider-${crypto.randomUUID()}`;

      this.innerHTML = `
        <label class="momentum-slider-label" for="${inputId}">${this.escape(title)}</label>
        <input id="${inputId}" class="momentum-slider-input" type="range" min="${this.escape(min)}" max="${this.escape(max)}" step="${this.escape(this.getAttribute("step") || "1")}" value="${Math.round((Number(min) + Number(max)) / 2)}" aria-describedby="${inputId}-state ${inputId}-scale" />
        <span class="momentum-slider-scale" id="${inputId}-scale"><small>${this.escape(minLabel)}</small><output id="${inputId}-state">Non renseigné</output><small>${this.escape(maxLabel)}</small></span>
      `;

      this.input = this.querySelector("input");
      this.output = this.querySelector("output");
      this.input.addEventListener("input", () => {
        this.currentValue = Number(this.input.value);
        this.sync();
        this.dispatchEvent(new Event("input", { bubbles:true }));
      });
      this.input.addEventListener("change", () => this.dispatchEvent(new Event("change", { bubbles:true })));
    }

    sync() {
      if (!this.input || !this.output) return;
      const disabled = this.hasAttribute("disabled");
      const missing = this.currentValue == null;
      this.input.disabled = disabled;
      this.input.setAttribute("aria-valuetext", missing ? "Non renseigné" : `${this.currentValue} sur ${this.getAttribute("max") || 10}`);
      this.output.textContent = missing ? "Non renseigné" : String(this.currentValue);
      this.classList.toggle("is-unset", missing);
      this.internals.setFormValue(disabled || missing ? null : String(this.currentValue));

      if (!disabled && missing && this.hasAttribute("required")) {
        this.internals.setValidity({ valueMissing:true }, `Renseigne « ${this.getAttribute("title") || "cette valeur"} ».`, this.input);
      } else {
        this.internals.setValidity({});
      }
    }

    escape(value) {
      return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
        "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
      })[character]);
    }
  }

  if (!customElements.get("momentum-slider")) customElements.define("momentum-slider", MomentumSlider);
})();
