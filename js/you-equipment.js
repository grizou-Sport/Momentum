function renderEquipment() {
  const activeEquipment = YOU.userEquipment.filter((item) => item.active !== false);

  YOU.detail.innerHTML = `
    <p class="section-kicker">Mon matériel</p>
    <h2>Ce qui t’accompagne</h2>
    <p class="you-detail-lead">
      Montres, chaussures, vélos, nutrition, capteurs et compagnons de route.
    </p>

    ${
      activeEquipment.length
        ? `
          <div class="equipment-list">
            ${YOU.equipmentCategories.map((category) => {
              const items = activeEquipment.filter((item) => item.category_id === category.id);
              if (!items.length) return "";

              return `
                <section class="equipment-group">
                  <div class="equipment-group-head">
                    <span>${category.name}</span>
                  </div>

                  <div class="equipment-items">
                    ${items.map((item) => `
                      <button class="equipment-row" type="button" data-equipment-detail="${item.id}">
                        <div>
                          <strong>${item.nickname || item.name}</strong>
                          <em>${[item.brand, item.model].filter(Boolean).join(" ") || "Compagnon de route"}</em>
                        </div>
                        <span>${item.favorite ? "Favori" : "Actif"}</span>
                      </button>
                    `).join("")}
                  </div>
                </section>
              `;
            }).join("")}
          </div>
        `
        : `
          <div class="you-note-box">
            <span>Ton matériel</span>
            <p>Aucun compagnon de route n’est encore enregistré.</p>
          </div>
        `
    }

    <button class="primary" id="addEquipmentBtn" type="button">Ajouter</button>
  `;

  document.getElementById("addEquipmentBtn")?.addEventListener("click", () => {
    openEquipmentModal();
  });

  document.querySelectorAll("[data-equipment-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = YOU.userEquipment.find((eq) => eq.id === button.dataset.equipmentDetail);
      if (item) openEquipmentModal(item);
    });
  });
}

function openEquipmentModal(item = null) {
  const isEdit = !!item;

  const categoriesOptions = YOU.equipmentCategories
    .map((category) => `
      <option value="${category.id}" ${item?.category_id === category.id ? "selected" : ""}>
        ${category.name}
      </option>
    `)
    .join("");

  const modal = document.createElement("div");
  modal.className = "equipment-modal-backdrop";

  modal.innerHTML = `
    <div class="equipment-modal">
      <button class="equipment-modal-close" type="button">×</button>

      <p class="section-kicker">${isEdit ? "Modifier" : "Ajouter"}</p>
      <h2>${isEdit ? item.nickname || item.name : "Un compagnon de route"}</h2>

      <form id="equipmentForm" class="you-form">
        <label class="full">Catégorie
          <select name="category_id" required>
            <option value="">Choisir</option>
            ${categoriesOptions}
          </select>
        </label>

        <label>Nom
          <input name="name" value="${item?.name || ""}" required />
        </label>

        <label>Surnom
          <input name="nickname" value="${item?.nickname || ""}" />
        </label>

        <label>Marque
          <input name="brand" value="${item?.brand || ""}" />
        </label>

        <label>Modèle
          <input name="model" value="${item?.model || ""}" />
        </label>

        <label>Date d’achat
          <input name="purchase_date" type="date" value="${item?.purchase_date || ""}" />
        </label>

        <label>Première utilisation
          <input name="first_used_at" type="date" value="${item?.first_used_at || ""}" />
        </label>

        <label class="full">Photo URL
          <input name="photo_url" value="${item?.photo_url || ""}" />
        </label>

        <label class="full">Notes
          <textarea name="notes" rows="4">${item?.notes || ""}</textarea>
        </label>

        <label class="equipment-check full">
          <input name="favorite" type="checkbox" ${item?.favorite ? "checked" : ""} />
          Favori
        </label>

        <div class="equipment-modal-actions full">
          ${isEdit ? `<button class="equipment-danger" type="button" id="deleteEquipmentBtn">Supprimer</button>` : ""}
          <button class="primary" type="submit">${isEdit ? "Enregistrer" : "Ajouter"}</button>
        </div>

        <p id="equipmentFormMessage" class="login-message full"></p>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector(".equipment-modal-close").addEventListener("click", closeEquipmentModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeEquipmentModal();
  });

  modal.querySelector("#equipmentForm").addEventListener("submit", (event) => {
    saveEquipment(event, item);
  });

  modal.querySelector("#deleteEquipmentBtn")?.addEventListener("click", () => {
    deleteEquipment(item);
  });
}

function closeEquipmentModal() {
  document.querySelector(".equipment-modal-backdrop")?.remove();
}

async function saveEquipment(event, item = null) {
  event.preventDefault();

  const form = new FormData(event.target);
  const message = document.getElementById("equipmentFormMessage");

  message.textContent = "Sauvegarde…";

  const payload = {
    user_id: YOU.currentUser.id,
    category_id: form.get("category_id"),
    name: form.get("name")?.trim(),
    nickname: form.get("nickname")?.trim() || null,
    brand: form.get("brand")?.trim() || null,
    model: form.get("model")?.trim() || null,
    purchase_date: form.get("purchase_date") || null,
    first_used_at: form.get("first_used_at") || null,
    photo_url: form.get("photo_url")?.trim() || null,
    notes: form.get("notes")?.trim() || null,
    favorite: form.get("favorite") === "on",
    active: true,
    updated_at: new Date().toISOString(),
  };

  const result = item?.id
    ? await window.momentumDB
        .from("user_equipment")
        .update(payload)
        .eq("id", item.id)
        .select("*, equipment_categories(*)")
        .single()
    : await window.momentumDB
        .from("user_equipment")
        .insert(payload)
        .select("*, equipment_categories(*)")
        .single();

  if (result.error) {
    console.error(result.error);
    message.textContent = window.MomentumUI.errorMessage(result.error, "save");
    return;
  }

  if (item?.id) {
    YOU.userEquipment = YOU.userEquipment.map((eq) => eq.id === item.id ? result.data : eq);
  } else {
    YOU.userEquipment.unshift(result.data);
  }

  closeEquipmentModal();
  renderMenuPreviews();
  renderEquipment();
}

async function deleteEquipment(item) {
  if (!item?.id) return;

  if (!await window.MomentumUI.confirm({ title:"Supprimer ce matériel ?", message:"Ce compagnon de route sera retiré de ton profil.", confirmLabel:"Supprimer", danger:true })) return;

  const { error } = await window.momentumDB
    .from("user_equipment")
    .delete()
    .eq("id", item.id);

  if (error) {
    console.error(error);
    renderYouSectionError("equipment");
    return;
  }

  YOU.userEquipment = YOU.userEquipment.filter((eq) => eq.id !== item.id);

  closeEquipmentModal();
  renderMenuPreviews();
  renderEquipment();
}
