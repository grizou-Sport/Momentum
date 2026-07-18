(function initializeMomentumUI() {
  const messages = {
    load: "Impossible de charger les données pour le moment.",
    save: "Enregistrement interrompu. Réessaie dans un instant.",
    delete: "Suppression impossible pour le moment.",
    connection: "Connexion momentanément indisponible.",
    action: "Action impossible pour le moment.",
    upload: "Envoi interrompu. Réessaie dans un instant."
  };

  function errorMessage(_error, context = "action") {
    return messages[context] || messages.action;
  }

  function createDialog({ title, message, confirmLabel = "Continuer", cancelLabel = "Annuler", inputLabel = "", inputValue = "", danger = false }) {
    const dialog = document.createElement("dialog");
    dialog.className = "momentum-ui-dialog";
    dialog.innerHTML = `<form method="dialog"><span class="section-kicker">MOMENTUM</span><h2>${escapeText(title)}</h2><p>${escapeText(message)}</p>${inputLabel ? `<label>${escapeText(inputLabel)}<input name="value" value="${escapeAttribute(inputValue)}" /></label>` : ""}<div><button value="cancel" type="submit">${escapeText(cancelLabel)}</button><button class="${danger ? "is-danger" : ""}" value="confirm" type="submit">${escapeText(confirmLabel)}</button></div></form>`;
    document.body.append(dialog);
    return dialog;
  }

  function escapeText(value) {
    const node = document.createElement("span");
    node.textContent = String(value || "");
    return node.innerHTML;
  }

  function escapeAttribute(value) {
    return escapeText(value).replace(/`/g, "&#96;");
  }

  function confirmAction(options) {
    return new Promise((resolve) => {
      const dialog = createDialog(options);
      dialog.addEventListener("close", () => {
        resolve(dialog.returnValue === "confirm");
        dialog.remove();
      }, { once: true });
      dialog.showModal();
      dialog.querySelector('[value="cancel"]')?.focus();
    });
  }

  function promptText(options) {
    return new Promise((resolve) => {
      const dialog = createDialog({ ...options, inputLabel: options.inputLabel || "Texte" });
      dialog.addEventListener("close", () => {
        const value = dialog.returnValue === "confirm" ? dialog.querySelector('[name="value"]')?.value.trim() || "" : null;
        resolve(value);
        dialog.remove();
      }, { once: true });
      dialog.showModal();
      dialog.querySelector("input")?.focus();
    });
  }

  window.MomentumUI = { errorMessage, confirm: confirmAction, prompt: promptText };
})();
