/* =========================================================
   MOMENTUM — NUTRITION PENDANT L’ACTIVITÉ V1
   ---------------------------------------------------------
   Carte de ravitaillement, calculs locaux et snapshots.
   ========================================================= */

(function createActivityNutritionModule() {
  const STEP = 0.25;
  const CATEGORY_LABELS = {
    favorites: "Favoris",
    drink: "Boissons",
    gel: "Gels",
    bar: "Barres & gaufres",
    puree: "Purées",
    fruit: "Fruits",
    other: "Autres"
  };
  const CATEGORY_ICONS = {
    drink: "◒",
    gel: "◇",
    bar: "▤",
    puree: "◐",
    fruit: "○",
    other: "✦"
  };
  const NUTRIENT_FIELDS = [
    "carbohydrates_g",
    "sodium_mg",
    "caffeine_mg",
    "potassium_mg",
    "magnesium_mg",
    "calcium_mg",
    "bicarbonate_mg",
    "zinc_mg"
  ];
  const PRODUCT_FIELDS = [
    "id", "name", "brand", "category", "unit_label", "serving_size",
    "serving_volume_ml", ...NUTRIENT_FIELDS, "extra_nutrients",
    "is_approximate", "is_global", "created_by"
  ].join(",");
  const ITEM_FIELDS = [
    "id", "activity_id", "product_id", "quantity", "product_name_snapshot",
    "brand_snapshot", "unit_label_snapshot",
    ...NUTRIENT_FIELDS.map((field) => `${field}_snapshot`),
    "extra_nutrients_snapshot", "is_approximate_snapshot", "created_at"
  ].join(",");

  const summaries = new Map();
  let libraryPromise = null;
  let frequencyPromise = null;
  let active = null;
  let activityFormDraft = null;
  let activityFormRevision = 0;

  function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function durationHours(activity = {}) {
    const seconds = numberValue(
      activity.totalDurationSeconds ?? activity.total_duration_seconds
    );
    if (seconds > 0) return seconds / 3600;

    const minutes = numberValue(
      activity.duration ?? activity.duration_min
    );
    return minutes > 0 ? minutes / 60 : 0;
  }

  function quantityFrom(collection, id) {
    if (collection instanceof Map) return numberValue(collection.get(id));
    return numberValue(collection?.[id]);
  }

  function productFromSnapshot(item) {
    const product = {
      id: item.product_id,
      name: item.product_name_snapshot,
      brand: item.brand_snapshot,
      category: item.category || "other",
      unit_label: item.unit_label_snapshot,
      is_approximate: Boolean(item.is_approximate_snapshot),
      extra_nutrients: item.extra_nutrients_snapshot || {}
    };

    NUTRIENT_FIELDS.forEach((field) => {
      product[field] = numberValue(item[`${field}_snapshot`]);
    });
    return product;
  }

  function calculateTotals(products = [], quantities = {}, activity = {}, snapshots = new Map()) {
    const totals = NUTRIENT_FIELDS.reduce((values, field) => {
      values[field] = 0;
      return values;
    }, {});
    const items = [];

    products.forEach((product) => {
      const quantity = quantityFrom(quantities, product.id);
      if (quantity <= 0) return;

      const nutritionalProduct = snapshots.get?.(product.id) || product;
      NUTRIENT_FIELDS.forEach((field) => {
        totals[field] += numberValue(nutritionalProduct[field]) * quantity;
      });
      items.push({ product:nutritionalProduct, quantity });
    });

    const hours = durationHours(activity);
    return {
      ...totals,
      carbs_total_g: totals.carbohydrates_g,
      carbs_per_hour: hours > 0 ? totals.carbohydrates_g / hours : null,
      sodium_total_mg: totals.sodium_mg,
      sodium_per_hour: hours > 0 ? totals.sodium_mg / hours : null,
      caffeine_total_mg: totals.caffeine_mg,
      potassium_total_mg: totals.potassium_mg,
      magnesium_total_mg: totals.magnesium_mg,
      calcium_total_mg: totals.calcium_mg,
      duration_hours: hours,
      items
    };
  }

  function formatNumber(value, maximumFractionDigits = 1) {
    return numberValue(value).toLocaleString("fr-CH", {
      maximumFractionDigits,
      minimumFractionDigits: 0
    });
  }

  function formatQuantity(value) {
    return formatNumber(value, 2);
  }

  function hourlyLabel(value, unit) {
    if (value === null || value === undefined) return "";
    return `${formatNumber(value)} ${unit}/h`;
  }

  function summaryFromItems(items, activity) {
    const products = items.map(productFromSnapshot);
    const quantities = new Map(items.map((item) => [item.product_id, numberValue(item.quantity)]));
    const snapshots = new Map(products.map((product) => [product.id, product]));
    return {
      items,
      products,
      quantities,
      totals:calculateTotals(products, quantities, activity, snapshots)
    };
  }

  function updateActivityFormNutrition() {
    const host = document.querySelector("[data-activity-form-nutrition]");
    const summary = host?.querySelector("[data-activity-form-nutrition-summary]");
    const button = host?.querySelector("#activityNutritionButton");
    if (!host || !summary || !button) return;

    const draft = activityFormDraft;
    host.classList.remove("has-nutrition", "is-loading", "has-error");
    button.disabled = Boolean(draft?.loading);

    if (draft?.loading) {
      host.classList.add("is-loading");
      summary.textContent = "Chargement du ravitaillement…";
      button.textContent = "Chargement…";
      return;
    }

    if (draft?.error) {
      host.classList.add("has-error");
      summary.textContent = "Le ravitaillement existant n’a pas pu être chargé.";
      button.textContent = "Réessayer";
      button.disabled = false;
      return;
    }

    const totals = draft
      ? calculateTotals(draft.products, draft.quantities, draft.activity, draft.snapshotProducts)
      : null;
    const count = totals?.items.length || 0;
    if (!count) {
      summary.textContent = "Ajoute ce que tu as consommé pendant ce Moment.";
      button.textContent = "Ajouter la nutrition";
      return;
    }

    host.classList.add("has-nutrition");
    summary.textContent = `${count} produit${count > 1 ? "s" : ""} · ${formatNumber(totals.carbs_total_g)} g de glucides · ${formatNumber(totals.sodium_total_mg)} mg de sodium`;
    button.textContent = "Modifier la nutrition";
  }

  async function beginActivityForm(activity = {}) {
    const revision = ++activityFormRevision;
    const activityId = activity.id || "";
    activityFormDraft = {
      activityId,
      activity:{ ...activity },
      products:[],
      quantities:new Map(),
      snapshotProducts:new Map(),
      dirty:false,
      loading:Boolean(activityId),
      error:null
    };
    updateActivityFormNutrition();
    if (!activityId) return;

    await ensureActivities([activity]);
    if (revision !== activityFormRevision || activityFormDraft?.activityId !== activityId) return;

    const stored = summaries.get(activityId) || { items:[] };
    const products = stored.products || (stored.items || []).map(productFromSnapshot);
    activityFormDraft = {
      activityId,
      activity:{ ...activity },
      products:[...products],
      quantities:new Map(stored.quantities || (stored.items || []).map((item) => [item.product_id, numberValue(item.quantity)])),
      snapshotProducts:new Map(products.map((product) => [product.id, product])),
      dirty:false,
      loading:false,
      error:stored.error || null
    };
    updateActivityFormNutrition();
  }

  function cancelActivityForm() {
    activityFormRevision += 1;
    activityFormDraft = null;
    updateActivityFormNutrition();
  }

  async function ensureActivities(activities = []) {
    const ownActivities = activities.filter((activity) => activity?.id && activity.source !== "shared_moment");
    const missing = ownActivities.filter((activity) => !summaries.has(activity.id));
    if (!missing.length || !window.momentumDB) return;

    const activityById = new Map(missing.map((activity) => [activity.id, activity]));
    const { data, error } = await window.momentumDB
      .from("activity_nutrition_items")
      .select(ITEM_FIELDS)
      .in("activity_id", [...activityById.keys()]);

    if (error) {
      console.warn("HOME : nutrition momentanément indisponible.", error);
      missing.forEach((activity) => summaries.set(activity.id, { items:[], error }));
      return;
    }

    const grouped = new Map(missing.map((activity) => [activity.id, []]));
    (data || []).forEach((item) => grouped.get(item.activity_id)?.push(item));
    grouped.forEach((items, activityId) => {
      summaries.set(activityId, summaryFromItems(items, activityById.get(activityId)));
    });
  }

  function renderActivitySection(activity, date = "") {
    const summary = summaries.get(activity.id);
    const items = summary?.items || [];
    const action = items.length ? "Modifier le ravitaillement" : "Ajouter le ravitaillement";

    if (!items.length) {
      return `
        <section class="activity-nutrition activity-nutrition-empty" aria-labelledby="nutrition-${activity.id}">
          <div>
            <span class="card-label">Pendant l’activité</span>
            <h4 id="nutrition-${activity.id}">Nutrition</h4>
            <p>Recompose ton ravitaillement, MOMENTUM calcule le reste.</p>
          </div>
          <button
            type="button"
            class="nutrition-open"
            data-action="edit-nutrition"
            data-activity-id="${escapeHtml(activity.id)}"
            data-date="${escapeHtml(date)}"
          >${action}</button>
        </section>
      `;
    }

    const totals = summaryFromItems(items, activity).totals;
    const productLines = totals.items.slice(0, 4).map(({ product, quantity }) => `
      <li>
        <span>${escapeHtml([product.brand, product.name].filter(Boolean).join(" "))}</span>
        <strong>× ${escapeHtml(formatQuantity(quantity))}</strong>
      </li>
    `).join("");
    const remaining = Math.max(0, totals.items.length - 4);

    return `
      <section class="activity-nutrition" aria-labelledby="nutrition-${activity.id}">
        <div class="activity-nutrition-heading">
          <div>
            <span class="card-label">Pendant l’activité</span>
            <h4 id="nutrition-${activity.id}">Nutrition</h4>
          </div>
          ${totals.caffeine_total_mg > 0
            ? `<span class="nutrition-caffeine">${escapeHtml(formatNumber(totals.caffeine_total_mg))} mg caféine</span>`
            : ""}
        </div>
        <dl class="activity-nutrition-totals">
          <div>
            <dt>Glucides consommés</dt>
            <dd><strong>${escapeHtml(formatNumber(totals.carbs_total_g))} g</strong>${totals.carbs_per_hour === null ? "" : `<span>${escapeHtml(hourlyLabel(totals.carbs_per_hour, "g"))}</span>`}</dd>
          </div>
          <div>
            <dt>Sodium</dt>
            <dd><strong>${escapeHtml(formatNumber(totals.sodium_total_mg))} mg</strong>${totals.sodium_per_hour === null ? "" : `<span>${escapeHtml(hourlyLabel(totals.sodium_per_hour, "mg"))}</span>`}</dd>
          </div>
        </dl>
        <ul class="activity-nutrition-products">${productLines}${remaining ? `<li><span>Et ${remaining} autre${remaining > 1 ? "s" : ""}</span></li>` : ""}</ul>
        <button
          type="button"
          class="nutrition-open"
          data-action="edit-nutrition"
          data-activity-id="${escapeHtml(activity.id)}"
          data-date="${escapeHtml(date)}"
        >Modifier le ravitaillement</button>
      </section>
    `;
  }

  async function loadLibrary() {
    if (!libraryPromise) {
      libraryPromise = window.momentumDB
        .from("nutrition_products")
        .select(PRODUCT_FIELDS)
        .eq("is_active", true)
        .order("brand", { ascending:true, nullsFirst:false })
        .order("name")
        .then(({ data, error }) => {
          if (error) throw error;
          return data || [];
        })
        .catch((error) => {
          libraryPromise = null;
          throw error;
        });
    }
    return libraryPromise;
  }

  async function loadFrequencies() {
    if (!frequencyPromise) {
      frequencyPromise = window.momentumDB
        .from("activity_nutrition_items")
        .select("product_id,quantity")
        .then(({ data, error }) => {
          if (error) throw error;
          const frequencies = new Map();
          (data || []).forEach((item) => {
            frequencies.set(
              item.product_id,
              numberValue(frequencies.get(item.product_id)) + numberValue(item.quantity)
            );
          });
          return frequencies;
        })
        .catch((error) => {
          console.warn("HOME : favoris nutrition indisponibles.", error);
          return new Map();
        });
    }
    return frequencyPromise;
  }

  async function loadActivityItems(activityId) {
    const { data, error } = await window.momentumDB
      .from("activity_nutrition_items")
      .select(ITEM_FIELDS)
      .eq("activity_id", activityId)
      .order("created_at");
    if (error) throw error;
    return data || [];
  }

  function renderLoading() {
    const content = document.getElementById("nutritionDialogContent");
    if (!content) return;
    content.innerHTML = `
      <div class="nutrition-loading" role="status">
        <span class="nutrition-loading-mark" aria-hidden="true">M</span>
        <p>La carte de ravitaillement se prépare…</p>
      </div>`;
  }

  function renderError() {
    const content = document.getElementById("nutritionDialogContent");
    if (!content) return;
    content.innerHTML = `
      <div class="nutrition-error" role="alert">
        <button type="button" class="nutrition-close" data-nutrition-close aria-label="Fermer">×</button>
        <span class="section-kicker">Nutrition</span>
        <h2>La carte n’a pas pu être chargée.</h2>
        <p>Le ravitaillement enregistré n’a pas été modifié.</p>
        <button class="primary" type="button" data-nutrition-retry>Réessayer</button>
      </div>`;
  }

  function fullProductName(product) {
    return [product.brand, product.name].filter(Boolean).join(" ");
  }

  function nutrientLine(product) {
    const approximate = product.is_approximate ? "≈ " : "";
    const values = [`${approximate}${formatNumber(product.carbohydrates_g)} g glucides`];
    if (numberValue(product.sodium_mg) > 0) values.push(`${formatNumber(product.sodium_mg)} mg sodium`);
    if (numberValue(product.caffeine_mg) > 0) values.push(`${formatNumber(product.caffeine_mg)} mg caféine`);
    return values.join(" · ");
  }

  function extendedNutrients(product) {
    const values = [
      ["Potassium", product.potassium_mg],
      ["Magnésium", product.magnesium_mg],
      ["Calcium", product.calcium_mg],
      ["Bicarbonates", product.bicarbonate_mg],
      ["Zinc", product.zinc_mg]
    ].filter(([, value]) => numberValue(value) > 0);
    if (!values.length) return "";
    return `
      <details class="nutrition-product-details">
        <summary>Composition complète</summary>
        <p>${values.map(([label, value]) => `${escapeHtml(label)} ${escapeHtml(formatNumber(value))} mg`).join(" · ")}</p>
      </details>`;
  }

  function referenceLine(product) {
    const parts = [];
    if (numberValue(product.serving_size) !== 1) parts.push(`${formatNumber(product.serving_size, 2)} g`);
    if (numberValue(product.serving_volume_ml) > 0) parts.push(`${formatNumber(product.serving_volume_ml)} ml préparés`);
    return parts.length ? `1 ${escapeHtml(product.unit_label)} = ${escapeHtml(parts.join(" dans "))}` : escapeHtml(product.unit_label);
  }

  function productCard(product) {
    const quantity = numberValue(active.quantities.get(product.id));
    return `
      <article class="nutrition-product${quantity > 0 ? " is-selected" : ""}" data-product-card="${escapeHtml(product.id)}">
        <div class="nutrition-product-visual visual-${escapeHtml(product.category)}" aria-hidden="true">
          <span>${CATEGORY_ICONS[product.category] || "✦"}</span>
          <small>${escapeHtml(product.brand || CATEGORY_LABELS[product.category] || "MOMENTUM")}</small>
        </div>
        <div class="nutrition-product-copy">
          <div class="nutrition-product-title">
            <div>
              ${product.brand ? `<span>${escapeHtml(product.brand)}</span>` : ""}
              <h3>${escapeHtml(product.name)}</h3>
            </div>
            ${product.is_global ? "" : '<span class="nutrition-personal-chip">Personnel</span>'}
          </div>
          <p class="nutrition-product-main">${escapeHtml(nutrientLine(product))}</p>
          <p class="nutrition-product-reference">${referenceLine(product)}</p>
          ${extendedNutrients(product)}
          <div class="nutrition-quantity" aria-label="Quantité consommée">
            <button type="button" data-quantity-change="-1" data-product-id="${escapeHtml(product.id)}" aria-label="Retirer 0,25 ${escapeHtml(product.unit_label)} de ${escapeHtml(fullProductName(product))}">−</button>
            <label>
              <span class="sr-only">Quantité de ${escapeHtml(fullProductName(product))}</span>
              <input type="number" min="0" step="0.25" inputmode="decimal" value="${quantity}" data-quantity-input="${escapeHtml(product.id)}" aria-label="Quantité de ${escapeHtml(fullProductName(product))}" />
              <small>${escapeHtml(product.unit_label)}</small>
            </label>
            <button type="button" data-quantity-change="1" data-product-id="${escapeHtml(product.id)}" aria-label="Ajouter 0,25 ${escapeHtml(product.unit_label)} de ${escapeHtml(fullProductName(product))}">+</button>
          </div>
        </div>
      </article>`;
  }

  function visibleProducts() {
    const query = active.search.trim().toLocaleLowerCase("fr");
    let products = active.products;

    if (query) {
      products = products.filter((product) =>
        `${product.brand || ""} ${product.name}`.toLocaleLowerCase("fr").includes(query)
      );
    } else if (active.category === "favorites") {
      products = products
        .filter((product) => numberValue(active.frequencies.get(product.id)) > 0)
        .sort((a, b) => numberValue(active.frequencies.get(b.id)) - numberValue(active.frequencies.get(a.id)));
    } else {
      products = products.filter((product) => product.category === active.category);
    }

    return products;
  }

  function renderProductArea() {
    const list = document.getElementById("nutritionProductList");
    if (!list || !active) return;
    const products = visibleProducts();
    list.innerHTML = products.length
      ? products.map(productCard).join("")
      : `<div class="nutrition-no-products" role="status"><strong>${active.search ? "Aucun produit trouvé" : "Tes favoris se construiront ici"}</strong><p>${active.search ? "Essaie un nom ou une marque différente." : "Les produits les plus utilisés remonteront automatiquement."}</p></div>`;

    document.querySelectorAll("[data-nutrition-category]").forEach((button) => {
      const selected = button.dataset.nutritionCategory === active.category;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
    });
  }

  function currentTotals() {
    return calculateTotals(
      active.products,
      active.quantities,
      active.activity,
      active.snapshotProducts
    );
  }

  function renderStickySummary() {
    const host = document.getElementById("nutritionStickySummary");
    const saveButton = document.getElementById("saveNutrition");
    if (!host || !saveButton || !active) return;
    const totals = currentTotals();
    const carbsHourly = totals.carbs_per_hour === null ? "" : ` · ${hourlyLabel(totals.carbs_per_hour, "g")}`;
    const sodiumHourly = totals.sodium_per_hour === null ? "" : ` · ${hourlyLabel(totals.sodium_per_hour, "mg")}`;

    host.innerHTML = `
      <span class="card-label">Ton ravitaillement</span>
      <p><strong>${escapeHtml(formatNumber(totals.carbs_total_g))} g</strong> glucides${escapeHtml(carbsHourly)}</p>
      <p><strong>${escapeHtml(formatNumber(totals.sodium_total_mg))} mg</strong> sodium${escapeHtml(sodiumHourly)}</p>
      ${totals.caffeine_total_mg > 0 ? `<p class="nutrition-summary-secondary">${escapeHtml(formatNumber(totals.caffeine_total_mg))} mg caféine</p>` : ""}
      <small>${totals.items.length} produit${totals.items.length > 1 ? "s" : ""} sélectionné${totals.items.length > 1 ? "s" : ""}</small>`;

    const action = active.mode === "activity-form" ? "Valider" : "Enregistrer";
    saveButton.textContent = `${action} — ${formatNumber(totals.carbs_total_g)} g${totals.carbs_per_hour === null ? "" : ` · ${formatNumber(totals.carbs_per_hour)} g/h`}`;
  }

  function customProductForm() {
    return `
      <form id="customNutritionProductForm" class="nutrition-custom-form" hidden>
        <div class="nutrition-custom-head">
          <div><span class="card-label">Produit personnel</span><h3>Ajouter à ma carte</h3></div>
          <button type="button" data-custom-product-close aria-label="Fermer le formulaire">×</button>
        </div>
        <div class="nutrition-custom-grid">
          <label>Nom<input name="name" required maxlength="160" /></label>
          <label>Marque <span>(facultatif)</span><input name="brand" maxlength="120" /></label>
          <label>Catégorie<select name="category" required>${Object.entries(CATEGORY_LABELS).filter(([value]) => value !== "favorites").map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
          <label>Unité<input name="unit_label" required placeholder="gel, bidon, portion…" /></label>
          <label>Quantité de référence<input name="serving_size" type="number" min="0.01" step="0.01" value="1" required /></label>
          <label>Volume préparé (ml)<input name="serving_volume_ml" type="number" min="0" step="1" /></label>
          <label>Glucides (g)<input name="carbohydrates_g" type="number" min="0" step="0.1" value="0" required /></label>
          <label>Sodium (mg)<input name="sodium_mg" type="number" min="0" step="0.1" value="0" required /></label>
          <label>Caféine (mg)<input name="caffeine_mg" type="number" min="0" step="0.1" value="0" /></label>
          <label>Potassium (mg)<input name="potassium_mg" type="number" min="0" step="0.1" value="0" /></label>
          <label>Magnésium (mg)<input name="magnesium_mg" type="number" min="0" step="0.1" value="0" /></label>
          <label>Calcium (mg)<input name="calcium_mg" type="number" min="0" step="0.1" value="0" /></label>
          <label>Bicarbonates (mg)<input name="bicarbonate_mg" type="number" min="0" step="0.1" value="0" /></label>
          <label>Zinc (mg)<input name="zinc_mg" type="number" min="0" step="0.1" value="0" /></label>
        </div>
        <p class="nutrition-form-message" data-custom-product-message aria-live="polite"></p>
        <div class="nutrition-custom-actions">
          <button type="button" class="secondary" data-custom-product-close>Annuler</button>
          <button type="submit" class="primary">Ajouter le produit</button>
        </div>
      </form>`;
  }

  function renderDialog() {
    const content = document.getElementById("nutritionDialogContent");
    if (!content || !active) return;
    content.innerHTML = `
      <div class="nutrition-menu-shell">
        <header class="nutrition-menu-header">
          <div>
            <span class="section-kicker">Pendant l’activité</span>
            <h2 id="nutritionDialogTitle">La carte de ravitaillement</h2>
            <p>${active.mode === "activity-form" ? "Prépare le ravitaillement avant d’enregistrer le Moment." : "Indique ce que tu as réellement consommé. Les calculs suivent."}</p>
          </div>
          <button type="button" class="nutrition-close" data-nutrition-close aria-label="Fermer">×</button>
        </header>
        <div class="nutrition-menu-layout">
          <main class="nutrition-menu-main">
            <div class="nutrition-toolbar">
              <label class="nutrition-search">
                <span class="sr-only">Rechercher un produit</span>
                <input id="nutritionSearch" type="search" placeholder="Rechercher un produit…" autocomplete="off" />
              </label>
              <button type="button" class="nutrition-add-product" data-custom-product-open>+ Ajouter un produit</button>
            </div>
            ${customProductForm()}
            <nav class="nutrition-categories" role="tablist" aria-label="Catégories de produits">
              ${Object.entries(CATEGORY_LABELS).map(([value, label]) => `<button type="button" role="tab" data-nutrition-category="${value}" aria-selected="${value === active.category}">${label}</button>`).join("")}
            </nav>
            <section id="nutritionProductList" class="nutrition-product-list" aria-live="polite"></section>
          </main>
          <aside class="nutrition-summary-panel" aria-label="Résumé du ravitaillement">
            <div id="nutritionStickySummary"></div>
            <p id="nutritionSaveMessage" class="nutrition-save-message" role="alert" aria-live="assertive"></p>
            <button id="saveNutrition" class="primary nutrition-save" type="button"></button>
          </aside>
        </div>
      </div>`;
    renderProductArea();
    renderStickySummary();
    document.getElementById("nutritionSearch")?.focus();
  }

  async function open(activity, date = "") {
    const dialog = document.getElementById("nutritionDialog");
    if (!dialog || !activity?.id || !window.momentumDB) return;

    active = { activity, date, products:[], quantities:new Map(), snapshotProducts:new Map(), frequencies:new Map(), category:"favorites", search:"" };
    renderLoading();
    if (!dialog.open) {
      if (typeof openHomeDialog === "function") openHomeDialog(dialog);
      else dialog.showModal();
    }

    try {
      const [products, items, frequencies] = await Promise.all([
        loadLibrary(),
        loadActivityItems(activity.id),
        loadFrequencies()
      ]);
      const productsById = new Map(products.map((product) => [product.id, product]));
      const snapshotProducts = new Map();

      items.forEach((item) => {
        const snapshot = productFromSnapshot(item);
        snapshotProducts.set(item.product_id, snapshot);
        if (!productsById.has(item.product_id)) {
          productsById.set(item.product_id, { ...snapshot, category:"other", is_global:false });
        }
      });

      active.products = [...productsById.values()];
      active.quantities = new Map(items.map((item) => [item.product_id, numberValue(item.quantity)]));
      active.snapshotProducts = snapshotProducts;
      active.frequencies = frequencies;
      renderDialog();
    } catch (error) {
      console.error("HOME : impossible de charger la carte de ravitaillement.", error);
      renderError();
    }
  }

  async function openActivityForm(activity = {}) {
    const dialog = document.getElementById("nutritionDialog");
    const activityId = activity.id || "";
    if (!dialog || !window.momentumDB) return;

    if (!activityFormDraft || activityFormDraft.activityId !== activityId || activityFormDraft.error) {
      await beginActivityForm(activity);
    }
    if (!activityFormDraft || activityFormDraft.loading || activityFormDraft.error) return;

    active = {
      mode:"activity-form",
      activity:{ ...activityFormDraft.activity, ...activity },
      date:activity.date || activityFormDraft.activity.date || "",
      products:[],
      quantities:new Map(activityFormDraft.quantities),
      snapshotProducts:new Map(activityFormDraft.snapshotProducts),
      frequencies:new Map(),
      category:"favorites",
      search:""
    };
    renderLoading();
    if (!dialog.open) {
      if (typeof openHomeDialog === "function") openHomeDialog(dialog);
      else dialog.showModal();
    }

    try {
      const [products, frequencies] = await Promise.all([loadLibrary(), loadFrequencies()]);
      if (!active || active.mode !== "activity-form") return;
      const productsById = new Map(products.map((product) => [product.id, product]));
      activityFormDraft.products.forEach((product) => {
        if (!productsById.has(product.id)) {
          productsById.set(product.id, { ...product, category:product.category || "other", is_global:false });
        }
      });
      active.products = [...productsById.values()];
      active.frequencies = frequencies;
      renderDialog();
    } catch (error) {
      console.error("HOME : impossible de préparer la nutrition du Moment.", error);
      renderError();
    }
  }

  function close() {
    const dialog = document.getElementById("nutritionDialog");
    if (typeof closeHomeDialog === "function") closeHomeDialog(dialog);
    else dialog?.close();
    active = null;
  }

  function setQuantity(productId, value) {
    if (!active) return;
    const normalized = Math.max(0, Math.round(numberValue(value) / STEP) * STEP);
    active.quantities.set(productId, normalized);
    renderProductArea();
    renderStickySummary();
  }

  async function save() {
    if (!active) return;
    const button = document.getElementById("saveNutrition");
    const message = document.getElementById("nutritionSaveMessage");
    const payload = [...active.quantities.entries()]
      .filter(([, quantity]) => numberValue(quantity) > 0)
      .map(([product_id, quantity]) => ({ product_id, quantity:numberValue(quantity) }));

    button.disabled = true;
    button.dataset.originalLabel = button.textContent;
    button.textContent = "Enregistrement…";
    if (message) message.textContent = "";

    if (active.mode === "activity-form") {
      activityFormDraft = {
        activityId:active.activity.id || "",
        activity:{ ...active.activity },
        products:[...active.products],
        quantities:new Map(active.quantities),
        snapshotProducts:new Map(active.snapshotProducts),
        dirty:true,
        loading:false,
        error:null
      };
      updateActivityFormNutrition();
      close();
      return;
    }

    const { data, error } = await window.momentumDB.rpc("save_activity_nutrition", {
      p_activity_id:active.activity.id,
      p_items:payload
    });

    if (error) {
      console.error("HOME : enregistrement du ravitaillement impossible.", error);
      button.disabled = false;
      button.textContent = button.dataset.originalLabel;
      if (message) message.textContent = "Impossible d’enregistrer le ravitaillement. Réessayer.";
      return;
    }

    summaries.set(active.activity.id, summaryFromItems(data || [], active.activity));
    frequencyPromise = null;
    const activityDate = active.date || active.activity.date;
    close();
    if (activityDate && typeof openDay === "function") await openDay(activityDate);
  }

  async function saveActivityForm(activityId, activity = {}) {
    const draft = activityFormDraft;
    if (!draft) return [];
    if (!draft.dirty) {
      cancelActivityForm();
      return [];
    }
    if (!activityId) throw new Error("Le Moment doit être enregistré avant sa nutrition.");

    const payload = [...draft.quantities.entries()]
      .filter(([, quantity]) => numberValue(quantity) > 0)
      .map(([product_id, quantity]) => ({ product_id, quantity:numberValue(quantity) }));
    const { data, error } = await window.momentumDB.rpc("save_activity_nutrition", {
      p_activity_id:activityId,
      p_items:payload
    });
    if (error) throw error;

    summaries.set(activityId, summaryFromItems(data || [], { ...draft.activity, ...activity, id:activityId }));
    frequencyPromise = null;
    cancelActivityForm();
    return data || [];
  }

  async function createCustomProduct(form) {
    if (!active) return;
    const message = form.querySelector("[data-custom-product-message]");
    const submit = form.querySelector('[type="submit"]');
    const formData = new FormData(form);
    const user = await getCurrentUser();
    if (!user) {
      message.textContent = "Ta session a expiré. Reconnecte-toi pour ajouter ce produit.";
      return;
    }

    const product = {
      name:String(formData.get("name") || "").trim(),
      brand:String(formData.get("brand") || "").trim() || null,
      category:String(formData.get("category") || "other"),
      unit_label:String(formData.get("unit_label") || "unité").trim(),
      serving_size:numberValue(formData.get("serving_size")) || 1,
      serving_volume_ml:numberValue(formData.get("serving_volume_ml")) || null,
      is_global:false,
      is_active:true,
      created_by:user.id
    };
    NUTRIENT_FIELDS.forEach((field) => {
      product[field] = numberValue(formData.get(field));
    });

    submit.disabled = true;
    submit.textContent = "Ajout…";
    message.textContent = "";
    const { data, error } = await window.momentumDB
      .from("nutrition_products")
      .insert(product)
      .select(PRODUCT_FIELDS)
      .single();

    if (error) {
      console.error("HOME : création du produit personnel impossible.", error);
      message.textContent = "Impossible d’ajouter ce produit. Vérifie les valeurs et réessaie.";
      submit.disabled = false;
      submit.textContent = "Ajouter le produit";
      return;
    }

    active.products.push(data);
    active.category = data.category;
    active.search = "";
    libraryPromise = Promise.resolve(active.products.filter((item) => item.is_active !== false));
    form.hidden = true;
    renderProductArea();
    renderStickySummary();
  }

  function bind() {
    const dialog = document.getElementById("nutritionDialog");
    if (!dialog) return;

    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });

    dialog.addEventListener("click", async (event) => {
      if (event.target === dialog || event.target.closest("[data-nutrition-close]")) {
        close();
        return;
      }
      if (event.target.closest("[data-nutrition-retry]")) {
        if (active?.mode === "activity-form") await openActivityForm(active.activity);
        else if (active) await open(active.activity, active.date);
        return;
      }
      const categoryButton = event.target.closest("[data-nutrition-category]");
      if (categoryButton && active) {
        active.category = categoryButton.dataset.nutritionCategory;
        active.search = "";
        const search = document.getElementById("nutritionSearch");
        if (search) search.value = "";
        renderProductArea();
        return;
      }
      const quantityButton = event.target.closest("[data-quantity-change]");
      if (quantityButton && active) {
        const productId = quantityButton.dataset.productId;
        const direction = numberValue(quantityButton.dataset.quantityChange);
        setQuantity(productId, numberValue(active.quantities.get(productId)) + direction * STEP);
        return;
      }
      if (event.target.closest("[data-custom-product-open]")) {
        const form = document.getElementById("customNutritionProductForm");
        if (form) {
          form.hidden = false;
          form.querySelector('[name="name"]')?.focus();
        }
        return;
      }
      if (event.target.closest("[data-custom-product-close]")) {
        const form = document.getElementById("customNutritionProductForm");
        if (form) form.hidden = true;
        return;
      }
      if (event.target.closest("#saveNutrition")) await save();
    });

    dialog.addEventListener("input", (event) => {
      if (event.target.id === "nutritionSearch" && active) {
        active.search = event.target.value;
        renderProductArea();
      }
    });

    dialog.addEventListener("change", (event) => {
      if (event.target.matches("[data-quantity-input]")) {
        setQuantity(event.target.dataset.quantityInput, event.target.value);
      }
    });

    dialog.addEventListener("submit", async (event) => {
      if (event.target.id !== "customNutritionProductForm") return;
      event.preventDefault();
      await createCustomProduct(event.target);
    });
  }

  window.MomentumNutrition = {
    STEP,
    beginActivityForm,
    calculateTotals,
    cancelActivityForm,
    durationHours,
    ensureActivities,
    formatQuantity,
    open,
    openActivityForm,
    renderActivitySection,
    saveActivityForm,
    summaryFromItems
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once:true });
  } else {
    bind();
  }
})();
