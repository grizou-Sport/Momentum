/* MOMENTUM — état vide partagé, volontairement simple. */
(function initializeMomentumEmptyState() {
  function escape(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
    })[character]);
  }

  function render({ title, text = "", action = "", actionAttributes = "", compact = false } = {}) {
    return `<div class="momentum-empty-state${compact ? " is-compact" : ""}">
      <strong>${escape(title)}</strong>
      ${text ? `<p>${escape(text)}</p>` : ""}
      ${action ? `<button class="secondary" type="button" ${actionAttributes}>${escape(action)}</button>` : ""}
    </div>`;
  }

  window.MomentumEmptyState = Object.freeze({ render });
})();
