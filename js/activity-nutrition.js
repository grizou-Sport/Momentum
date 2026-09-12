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
    "id", "activity_id", "product_id", "quantity", "phase", "snapshot_origin", "serving_size_snapshot", "serving_volume_ml_snapshot", "product_name_snapshot",
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

  function nutrientValue(value) {
    if(value === null || value === undefined || String(value).trim() === "") return null;
    const n=Number(value);return Number.isFinite(n) && n>=0 ? n : null;
  }
  function durationBasis(activity = {}) {
    const raw=activity.original || activity;
    const override=nutrientValue(activity.nutrition_elapsed_override_seconds ?? raw.nutrition_elapsed_override_seconds);
    if(override>0)return {hours:override/3600,label:"Durée de ravitaillement corrigée"};
    const elapsed=nutrientValue(activity.elapsedDurationSeconds ?? raw.elapsed_duration_seconds ?? activity.totalDurationSeconds ?? activity.total_duration_seconds ?? raw.route_summary?.source_durations?.elapsed_seconds);
    if(elapsed>0)return {hours:elapsed/3600,label:"Calculé sur la durée écoulée"};
    const duration=nutrientValue(activity.duration ?? activity.duration_min);
    return {hours:duration>0?duration/60:0,label:duration>0?"Calculé sur la durée d’activité disponible":"Durée absente : valeurs horaires non calculables"};
  }
  function durationHours(activity={}) {return durationBasis(activity).hours;}
  function defaultPhase(activity={}) {return String(activity.status || '').toLowerCase()==='planned'?'planned':'consumed';}
  function phaseData(items=[],activity={}) {
    const products=items.map(productFromSnapshot);
    return {products,quantities:new Map(items.map(i=>[i.product_id,numberValue(i.quantity)])),snapshotProducts:new Map(products.map(p=>[p.id,p])),dirty:false,copy:new Set()};
  }
  function clonePhase(data) {return {...data,products:[...data.products],quantities:new Map(data.quantities),snapshotProducts:new Map(data.snapshotProducts),copy:new Set(data.copy)};}
  function applyPhase(owner,phase) {
    const data=owner.phases[phase];owner.phase=phase;owner.quantities=data.quantities;owner.snapshotProducts=data.snapshotProducts;
  }
  function phasePayload(owner) {
    const result={};for(const phase of ['planned','consumed']){const data=owner.phases[phase];if(!data.dirty)continue;
      result[phase]=[...data.quantities].filter(([,q])=>q>0).map(([product_id,quantity])=>({product_id,quantity,...(data.copy.has(product_id)?{copy_from_planned:true}:{})}));}
    if(owner.contextDirty)result.context={note:owner.note||null,elapsed_override_seconds:owner.durationOverride==null?null:owner.durationOverride};
    return Object.keys(result).length?result:null;
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
      serving_size:item.serving_size_snapshot, serving_volume_ml:item.serving_volume_ml_snapshot, snapshot_origin:item.snapshot_origin,
      extra_nutrients: item.extra_nutrients_snapshot || {}
    };

    NUTRIENT_FIELDS.forEach((field) => {
      product[field] = nutrientValue(item[`${field}_snapshot`]);
    });
    return product;
  }

  function calculateTotals(products=[],quantities={},activity={},snapshots=new Map()) {
    const totals=Object.fromEntries(NUTRIENT_FIELDS.map(f=>[f,0])),known=Object.fromEntries(NUTRIENT_FIELDS.map(f=>[f,0])),missing=Object.fromEntries(NUTRIENT_FIELDS.map(f=>[f,0])),items=[];
    const seen=new Set();for(const product of products){if(seen.has(product.id))continue;seen.add(product.id);const quantity=quantityFrom(quantities,product.id);if(quantity<=0)continue;
      const nutrition=snapshots.get?.(product.id)||product;for(const f of NUTRIENT_FIELDS){const v=nutrientValue(nutrition[f]);if(v===null)missing[f]++;else{totals[f]+=v*quantity;known[f]++;}}
      items.push({product:nutrition,quantity});}
    const partial={};for(const f of NUTRIENT_FIELDS){partial[f]=missing[f]>0;if(items.length && !known[f])totals[f]=null;}
    const basis=durationBasis(activity),hourly=v=>basis.hours>0&&v!==null?v/basis.hours:null;
    return {...totals,partial,known,missing,carbs_total_g:totals.carbohydrates_g,carbs_per_hour:hourly(totals.carbohydrates_g),sodium_total_mg:totals.sodium_mg,sodium_per_hour:hourly(totals.sodium_mg),caffeine_total_mg:totals.caffeine_mg,potassium_total_mg:totals.potassium_mg,magnesium_total_mg:totals.magnesium_mg,calcium_total_mg:totals.calcium_mg,duration_hours:basis.hours,duration_label:basis.label,items};
  }
  function nutrientTotal(totals,field,unit) {return totals[field]===null?'Non renseigné':`${formatNumber(totals[field])} ${unit}${totals.partial[field]?' · partiel':''}`;}
  function formatNumber(value, maximumFractionDigits = 1) {
    if(value===null || value===undefined)return "Non renseigné";
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

  function summaryFromItems(items=[],activity={}) {
    const phases={planned:phaseData(items.filter(i=>i.phase==='planned')),consumed:phaseData(items.filter(i=>(i.phase||'consumed')==='consumed'))};
    const phase=defaultPhase(activity),data=phases[phase];return {items,phases,...data,totals:calculateTotals(data.products,data.quantities,activity,data.snapshotProducts)};
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
      summary.textContent = `${draft?.phase==='planned'?"Prépare ce que tu souhaites emporter.":"Indique ce que tu as réellement consommé."} Le prévu ne devient jamais automatiquement consommé.`;
      button.textContent = "Ajouter la nutrition";
      return;
    }

    host.classList.add("has-nutrition");
    summary.textContent = `${draft.phase==='planned'?'Prévu':'Consommé'} · ${count} produit${count>1?'s':''} · Glucides : ${nutrientTotal(totals,'carbohydrates_g','g')}. Prévu : ${[...draft.phases.planned.quantities.values()].filter(q=>q>0).length} produits ; consommé : ${[...draft.phases.consumed.quantities.values()].filter(q=>q>0).length}.`;
    button.textContent = "Modifier la nutrition";
  }

  async function beginActivityForm(activity={}) {
    const revision=++activityFormRevision,activityId=activity.id||"";
    activityFormDraft={activityId,activity:{...activity},phases:{planned:phaseData(),consumed:phaseData()},products:[],dirty:false,loading:Boolean(activityId),error:null,note:activity.original?.nutrition_note||activity.nutrition_note||"",durationOverride:activity.original?.nutrition_elapsed_override_seconds??activity.nutrition_elapsed_override_seconds??null,contextDirty:false};
    applyPhase(activityFormDraft,defaultPhase(activity));updateActivityFormNutrition();if(!activityId)return;
    if(summaries.get(activityId)?.error)summaries.delete(activityId);
    await ensureActivities([activity]);if(revision!==activityFormRevision||activityFormDraft?.activityId!==activityId)return;
    const stored=summaries.get(activityId)||{items:[]},normal=summaryFromItems(stored.items||[],activity);
    Object.assign(activityFormDraft,{phases:normal.phases,products:[...new Map((stored.items||[]).map(i=>[i.product_id,productFromSnapshot(i)])).values()],loading:false,error:stored.error||null});
    applyPhase(activityFormDraft,defaultPhase(activity));updateActivityFormNutrition();
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
    let data=[],error=null;
    try{for(let i=0;i<missing.length;i+=100){const ids=missing.slice(i,i+100).map(a=>a.id);
      const page=await window.MomentumData.all(()=>window.momentumDB.from("activity_nutrition_items").select(ITEM_FIELDS,{count:"exact"}).in("activity_id",ids).order("id"));data.push(...page.data);}}
    catch(e){error=e;}

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

  function renderActivitySection(activity,date="") {
    const summary=summaries.get(activity.id);if(summary?.error)return `<section class="activity-nutrition" role="status"><h4>Ravitaillement indisponible</h4><p>Les données enregistrées n’ont pas été modifiées.</p><button type="button" data-action="edit-nutrition" data-activity-id="${escapeHtml(activity.id)}" data-date="${escapeHtml(date)}">Réessayer</button></section>`;
    const data=summaryFromItems(summary?.items||[],activity);
    const sections=['planned','consumed'].map(phase=>{const d=data.phases[phase],total=calculateTotals(d.products,d.quantities,activity,d.snapshotProducts);return `<div><h5>${phase==='planned'?'Prévu':'Consommé'}</h5>${total.items.length?`<ul class="activity-nutrition-products">${total.items.map(({product,quantity})=>`<li><span>${escapeHtml(fullProductName(product))}</span><strong>× ${escapeHtml(formatQuantity(quantity))} ${escapeHtml(product.unit_label)}</strong></li>`).join('')}</ul><p>Glucides : ${escapeHtml(nutrientTotal(total,'carbohydrates_g','g'))}${total.carbs_per_hour===null?'':` · ${escapeHtml(hourlyLabel(total.carbs_per_hour,'g'))}`}</p><p>Sodium : ${escapeHtml(nutrientTotal(total,'sodium_mg','mg'))}</p>`:'<p>Non renseigné</p>'}</div>`;}).join('');
    return `<section class="activity-nutrition"><h4>Pendant l’activité</h4><div class="nutrition-phase-summaries">${sections}</div><p>${escapeHtml(durationBasis(activity).label)}</p>${activity.original?.nutrition_note?`<p>${escapeHtml(activity.original.nutrition_note)}</p>`:''}<button type="button" class="nutrition-open" data-action="edit-nutrition" data-activity-id="${escapeHtml(activity.id)}" data-date="${escapeHtml(date)}">Modifier le ravitaillement</button></section>`;
  }
  async function loadLibrary(){
    if(!libraryPromise)libraryPromise=window.MomentumData.all(()=>window.momentumDB.from("nutrition_products").select(PRODUCT_FIELDS,{count:"exact"}).eq("is_active",true).order("id")).then(result=>result.data).catch(e=>{libraryPromise=null;throw e;});return libraryPromise;
  }
  async function loadFrequencies(){
    if(!frequencyPromise)frequencyPromise=window.MomentumData.all(()=>window.momentumDB.from("activity_nutrition_items").select("id,product_id,quantity",{count:"exact"}).eq("phase","consumed").order("id")).then(result=>{const map=new Map();for(const row of result.data)map.set(row.product_id,(map.get(row.product_id)||0)+numberValue(row.quantity));return map;}).catch(()=>{frequencyPromise=null;return new Map();});return frequencyPromise;
  }
  async function loadActivityItems(activityId){return window.MomentumData.all(()=>window.momentumDB.from("activity_nutrition_items").select(ITEM_FIELDS,{count:"exact"}).eq("activity_id",activityId).order("id")).then(result=>result.data);}
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
    const values = [product.carbohydrates_g==null?"Glucides non renseignés":`${approximate}${formatNumber(product.carbohydrates_g)} g glucides`];
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
    if (product.serving_size != null && numberValue(product.serving_size) !== 1) parts.push(`${formatNumber(product.serving_size, 2)} g`);
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
          <div class="nutrition-quantity" aria-label="Quantité ${active.phase==='planned'?'prévue':'consommée'}">
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
      <span class="card-label">${active.phase==='planned'?'Ravitaillement prévu':'Ravitaillement consommé'}</span>
      <p><strong>${escapeHtml(nutrientTotal(totals,"carbohydrates_g","g"))}</strong> glucides${escapeHtml(carbsHourly)}</p>
      <p><strong>${escapeHtml(nutrientTotal(totals,"sodium_mg","mg"))}</strong> sodium${escapeHtml(sodiumHourly)}</p>
      ${totals.caffeine_total_mg > 0 ? `<p class="nutrition-summary-secondary">${escapeHtml(formatNumber(totals.caffeine_total_mg))} mg caféine</p>` : ""}
      <p>${escapeHtml(totals.duration_label)}</p><small>${totals.items.length} produit${totals.items.length > 1 ? "s" : ""} sélectionné${totals.items.length > 1 ? "s" : ""}</small>`;

    const action = active.mode === "activity-form" ? "Appliquer au Moment" : "Enregistrer";
    saveButton.textContent = action;
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
          <label>Glucides (g)<input name="carbohydrates_g" type="number" min="0" step="0.1" placeholder="Non renseigné" /></label>
          <label>Sodium (mg)<input name="sodium_mg" type="number" min="0" step="0.1" placeholder="Non renseigné" /></label>
          <label>Caféine (mg)<input name="caffeine_mg" type="number" min="0" step="0.1" placeholder="Non renseigné" /></label>
          <label>Potassium (mg)<input name="potassium_mg" type="number" min="0" step="0.1" placeholder="Non renseigné" /></label>
          <label>Magnésium (mg)<input name="magnesium_mg" type="number" min="0" step="0.1" placeholder="Non renseigné" /></label>
          <label>Calcium (mg)<input name="calcium_mg" type="number" min="0" step="0.1" placeholder="Non renseigné" /></label>
          <label>Bicarbonates (mg)<input name="bicarbonate_mg" type="number" min="0" step="0.1" placeholder="Non renseigné" /></label>
          <label>Zinc (mg)<input name="zinc_mg" type="number" min="0" step="0.1" placeholder="Non renseigné" /></label>
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
        <div class="nutrition-phase-controls" role="group" aria-label="Nature du ravitaillement">
          <button type="button" data-nutrition-phase="planned" aria-pressed="${active.phase==='planned'}">Prévu</button>
          <button type="button" data-nutrition-phase="consumed" aria-pressed="${active.phase==='consumed'}">Consommé</button>
          ${active.phase==='consumed'?'<button type="button" data-copy-planned>Reprendre le prévu comme point de départ</button>':''}
        </div>
        <p class="nutrition-library-state" role="status">${active.libraryError?'Bibliothèque indisponible : les produits déjà enregistrés restent modifiables.':''}</p>
        <details class="nutrition-context"><summary>Durée de ravitaillement et ce que tu retiens</summary>
          <label>Durée de ravitaillement corrigée, en minutes (facultatif)<input id="nutritionDurationOverride" type="number" min="0.01" step="0.01" value="${active.durationOverride==null?'':escapeHtml(active.durationOverride/60)}" placeholder="Durée écoulée si disponible" /></label>
          <label>Ce qui a fonctionné, ou ce que tu souhaites modifier<textarea id="nutritionNote" maxlength="2000">${escapeHtml(active.note||'')}</textarea></label>
        </details>
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

  async function open(activity,date="") {
    if(typeof openEditActivityById!=="function")return;
    await openEditActivityById(activity.id);
    const form=document.getElementById('activityForm');
    if(form?.dataset.editActivityId!==activity.id)return;
    await openActivityForm(activity);
  }

  async function openActivityForm(activity = {}) {
    const dialog = document.getElementById("nutritionDialog");
    const activityId = activity.id || "";
    if (!dialog || !window.momentumDB) return;

    if (!activityFormDraft || activityFormDraft.activityId !== activityId || activityFormDraft.error) {
      await beginActivityForm(activity);
    }
    if (!activityFormDraft || activityFormDraft.loading || activityFormDraft.error) return;

    const request=++activityFormRevision;
    active = {
      mode:"activity-form",
      phases:{planned:clonePhase(activityFormDraft.phases.planned),consumed:clonePhase(activityFormDraft.phases.consumed)},
      note:activityFormDraft.note,durationOverride:activityFormDraft.durationOverride,contextDirty:activityFormDraft.contextDirty,
      activity:{ ...activityFormDraft.activity, ...activity },
      date:activity.date || activityFormDraft.activity.date || "",
      products:[],
      quantities:new Map(activityFormDraft.quantities),
      snapshotProducts:new Map(activityFormDraft.snapshotProducts),
      frequencies:new Map(),
      category:"favorites",
      search:""
    };
    applyPhase(active,defaultPhase(activity));
    renderLoading();
    if (!dialog.open) {
      if (typeof openHomeDialog === "function") openHomeDialog(dialog);
      else dialog.showModal();
    }

    try {
      const [library, frequencies] = await Promise.allSettled([loadLibrary(), loadFrequencies()]);
      if(request!==activityFormRevision||!active)return;
      const products=library.status==='fulfilled'?library.value:[];active.libraryError=library.status!=='fulfilled';
      if (!active || active.mode !== "activity-form") return;
      const productsById = new Map(products.map((product) => [product.id, product]));
      activityFormDraft.products.forEach((product) => {
        if (!productsById.has(product.id)) {
          productsById.set(product.id, { ...product, category:product.category || "other", is_global:false });
        }
      });
      active.products = [...productsById.values()];
      active.frequencies = frequencies.status==='fulfilled'?frequencies.value:new Map();
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
    const normalized = Math.max(0, Math.min(10000,Math.round(numberValue(value) / STEP) * STEP));
    active.phases[active.phase].dirty=true;
    active.quantities.set(productId, normalized);
    renderProductArea();
    renderStickySummary();
  }

  async function save() {
    if(!active || active.mode!=="activity-form")return;
    activityFormDraft={activityId:active.activity.id||"",activity:{...active.activity},products:[...active.products],phases:{planned:clonePhase(active.phases.planned),consumed:clonePhase(active.phases.consumed)},note:active.note,durationOverride:active.durationOverride,contextDirty:active.contextDirty,dirty:Boolean(phasePayload(active)),loading:false,error:null};
    applyPhase(activityFormDraft,defaultPhase(active.activity));updateActivityFormNutrition();
    const form=document.getElementById('activityForm');if(form)form.dataset.dirty='true';
    close();
  }
  // Compatibility entry point: only the atomic parent form may write activity nutrition.
  async function saveActivityForm(){throw new Error("Enregistre le Moment dans son formulaire unique pour appliquer le ravitaillement.");}

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
      product[field] = nutrientValue(formData.get(field));
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
      const phaseButton=event.target.closest('[data-nutrition-phase]');
      if(phaseButton&&active){applyPhase(active,phaseButton.dataset.nutritionPhase);renderDialog();return;}
      if(event.target.closest('[data-copy-planned]')&&active){
        const hasConsumed=[...active.phases.consumed.quantities.values()].some(q=>q>0);
        if(hasConsumed && !await window.MomentumUI.confirm({title:"Reprendre le prévu ?",message:"Les quantités consommées du brouillon seront remplacées par les quantités prévues. Tu pourras les ajuster avant d’enregistrer le Moment.",confirmLabel:"Reprendre le prévu"}))return;
        const plan=active.phases.planned;active.phases.consumed={...clonePhase(plan),dirty:true,copy:new Set([...plan.quantities.keys()].filter(id=>plan.quantities.get(id)>0))};
        applyPhase(active,'consumed');renderDialog();return;
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
      if(active && event.target.id==='nutritionNote'){active.note=event.target.value;active.contextDirty=true;}
      if(active && event.target.id==='nutritionDurationOverride'){
        const value=nutrientValue(event.target.value);active.durationOverride=value>0?value*60:null;active.contextDirty=true;
        active.activity.nutrition_elapsed_override_seconds=active.durationOverride;renderStickySummary();
      }
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

  window.addEventListener("momentum:session-cleared",()=>{summaries.clear();libraryPromise=null;frequencyPromise=null;activityFormRevision++;activityFormDraft=null;close();});
  window.MomentumNutrition = {
    STEP,
    beginActivityForm,
    calculateTotals,
    cancelActivityForm,
    durationHours,
    durationBasis,
    nutrientValue,
    phasePayload,
    ensureActivities,
    formatQuantity,
    open,
    openActivityForm,
    renderActivitySection,
    saveActivityForm,
    draftPayload() {
      if (!activityFormDraft?.dirty) return null;
      if (activityFormDraft.loading || activityFormDraft.error) throw new Error("Le ravitaillement ne peut pas être sauvegardé tant que sa lecture a échoué.");
      return phasePayload(activityFormDraft);
    },
    parentSaved(activityId) { summaries.delete(activityId); frequencyPromise = null; cancelActivityForm(); },
    summaryFromItems
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once:true });
  } else {
    bind();
  }
})();
