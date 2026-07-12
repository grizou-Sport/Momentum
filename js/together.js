const TOGETHER = {
  user: null,
  moments: [],
  clubs: [],
  relationships: [],
  clubMemberships: [],
  passports: new Map(),
  logoUrls: new Map(),
  view: "moments",
};

const elements = {
  tabs: document.querySelectorAll("[data-view]"),
  momentsView: document.getElementById("momentsView"),
  circleView: document.getElementById("circleView"),
  status: document.getElementById("togetherStatus"),
  momentDialog: document.getElementById("momentDialog"),
  clubDialog: document.getElementById("clubDialog"),
  momentForm: document.getElementById("momentForm"),
  clubForm: document.getElementById("clubForm"),
  momentClub: document.getElementById("momentClub"),
  clubSport: document.getElementById("clubSport"),
  clubLogo: document.getElementById("clubLogo"),
  clubLogoPreview: document.getElementById("clubLogoPreview"),
  clubEditId: document.getElementById("clubEditId"),
  clubDialogKicker: document.getElementById("clubDialogKicker"),
  clubDialogTitle: document.getElementById("clubDialogTitle"),
  saveClub: document.getElementById("saveClub"),
  clubDetailDialog: document.getElementById("clubDetailDialog"),
  clubDetail: document.getElementById("clubDetail"),
  momentDetailDialog: document.getElementById("momentDetailDialog"),
  momentDetail: document.getElementById("momentDetail"),
  dateOptions: document.getElementById("dateOptions"),
};

function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function setStatus(message = "", isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function formatDate(value) {
  if (!value) return "Date à choisir";
  return new Intl.DateTimeFormat("fr-CH", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function initials(name = "?") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function renderSportOptions() {
  if (!window.MomentumSports || !elements.clubSport) return;
  elements.clubSport.innerHTML = '<option value="">Choisir un sport</option>' + window.MomentumSports.getGroupedOptions().map((group) =>
    `<optgroup label="${escapeHTML(group.label)}">${group.sports.map((sport) => `<option value="${sport.id}">${escapeHTML(sport.label)}</option>`).join("")}</optgroup>`
  ).join("");
}

function sportLabel(value) {
  return window.MomentumSports?.getLabel(value, value) || value;
}

function openClubForm(club = null) {
  elements.clubForm.reset();
  elements.clubLogoPreview.textContent = "△";
  elements.clubEditId.value = club?.id || "";
  elements.clubDialogKicker.textContent = club ? "Administration" : "Nouveau";
  elements.clubDialogTitle.textContent = club ? "Modifier le Club" : "Créer un Club";
  elements.saveClub.textContent = club ? "Enregistrer" : "Créer le Club";
  if (club) {
    elements.clubForm.elements.name.value = club.name || "";
    elements.clubForm.elements.category.value = club.category || "";
    elements.clubForm.elements.location_name.value = club.location_name || "";
    elements.clubForm.elements.visibility.value = club.visibility || "PRIVATE";
    elements.clubForm.elements.description.value = club.description || "";
    const logo = TOGETHER.logoUrls.get(club.id);
    if (logo) elements.clubLogoPreview.innerHTML = `<img src="${escapeHTML(logo)}" alt="Logo actuel" />`;
  }
  elements.clubDialog.showModal();
}

function momentBucket(moment) {
  if (moment.status === "COMPLETED" || moment.status === "CANCELLED") return "past";
  if (["DRAFT", "PLANNING"].includes(moment.status) || !moment.start_at) return "planning";
  const date = new Date(moment.start_at);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "today";
  return date > today ? "upcoming" : "past";
}

function momentCard(moment) {
  const club = TOGETHER.clubs.find((item) => item.id === moment.club_id);
  const participantCount = moment.moment_participants?.[0]?.count || 0;
  const colors = { SPORT: "#71806d", ADVENTURE: "#b68650", TRAVEL: "#668394", SOCIAL: "#9a756b", OTHER: "#77766f" };
  return `
    <article class="moment-card" style="--moment-color:${colors[moment.moment_type] || colors.OTHER}">
      <div>
        <span class="moment-status">${escapeHTML(moment.status)}</span>
        <h3>${escapeHTML(moment.title)}</h3>
        <p>${escapeHTML(moment.description || (club ? `Un Moment de ${club.name}` : "Un Moment à écrire ensemble."))}</p>
      </div>
      <div>
        <div class="moment-meta"><span>${escapeHTML(formatDate(moment.start_at))}</span><span>·</span><span>${escapeHTML(moment.location_name || "Lieu à définir")}</span></div>
        <div class="moment-participants"><span>${club ? escapeHTML(club.name) : "Moment personnel"}</span><strong>${participantCount} participant${participantCount > 1 ? "s" : ""}</strong></div>
        <button class="card-action" data-open-moment="${moment.id}" type="button">Ouvrir le Moment</button>
      </div>
    </article>`;
}

function emptyCard(title, text) {
  return `<div class="together-empty"><strong>${escapeHTML(title)}</strong>${escapeHTML(text)}</div>`;
}

function renderMoments() {
  const sections = [
    ["planning", "À organiser", "Une date ou une réponse est encore attendue."],
    ["today", "Aujourd’hui", "Les Moments que l’on vit maintenant."],
    ["upcoming", "À venir", "Les prochaines histoires déjà confirmées."],
    ["past", "Passés", "Quelques traces de ce qui a été vécu."],
  ];
  elements.momentsView.innerHTML = sections.map(([bucket, title, subtitle]) => {
    const moments = TOGETHER.moments.filter((moment) => momentBucket(moment) === bucket);
    return `<section class="together-section"><div class="together-section-head"><div><span class="card-label">${moments.length} Moment${moments.length > 1 ? "s" : ""}</span><h2>${title}</h2></div><p>${subtitle}</p></div><div class="moment-grid">${moments.length ? moments.map(momentCard).join("") : emptyCard("Rien pour le moment", bucket === "planning" ? "Crée un Moment pour lancer la prochaine aventure." : "Cet espace se remplira naturellement.")}</div></section>`;
  }).join("");
  elements.momentsView.querySelectorAll("[data-open-moment]").forEach((button) => button.addEventListener("click", () => openMomentDetail(button.dataset.openMoment)));
}

function clubCard(club) {
  const count = club.club_members?.[0]?.count || 0;
  const next = TOGETHER.moments.filter((moment) => moment.club_id === club.id && ["PLANNING", "CONFIRMED"].includes(moment.status)).sort((a, b) => new Date(a.start_at || 8640000000000000) - new Date(b.start_at || 8640000000000000))[0];
  const logo = TOGETHER.logoUrls.get(club.id);
  return `<article class="club-card"><div class="club-symbol">${logo ? `<img src="${escapeHTML(logo)}" alt="Logo ${escapeHTML(club.name)}" />` : "△"}</div><h3>${escapeHTML(club.name)}</h3><div class="club-meta"><span>${escapeHTML(sportLabel(club.category))}</span><span>·</span><span>${escapeHTML(club.location_name)}</span><span>·</span><span>${count} membre${count > 1 ? "s" : ""}</span></div><p>${escapeHTML(club.description || "Un Club Momentum")}</p><div class="club-next">${next ? `<strong>Prochain Moment</strong><br>${escapeHTML(next.title)} — ${escapeHTML(formatDate(next.start_at))}` : "Aucun Moment prévu"}</div><button class="club-open" data-open-club="${club.id}" type="button">Ouvrir le Club</button></article>`;
}

function personCard(relationship) {
  const memberId = relationship.requester_id === TOGETHER.user.id ? relationship.recipient_id : relationship.requester_id;
  const passport = TOGETHER.passports.get(memberId) || {};
  const name = passport.display_name || "Membre du Cercle";
  const pinned = passport.is_pinned ? " pinned" : "";
  const avatar = passport.avatar_url ? `<img src="${escapeHTML(passport.avatar_url)}" alt="" />` : initials(name);
  return `<article class="circle-card${pinned}"><div class="portrait">${avatar}</div><h3>${escapeHTML(name)}</h3><p>${escapeHTML([passport.city, passport.country].filter(Boolean).join(", ") || "Lieu non renseigné")}</p><span class="moment-status">Dans ton Cercle</span></article>`;
}

function renderCircle() {
  const accepted = TOGETHER.relationships.filter((item) => item.status === "ACCEPTED");
  const pending = TOGETHER.relationships.filter((item) => item.status === "PENDING" && item.recipient_id === TOGETHER.user.id);
  const pendingClubs = TOGETHER.clubMemberships.filter((item) => item.membership_status === "PENDING").map((membership) => ({ membership, club: TOGETHER.clubs.find((club) => club.id === membership.club_id) })).filter((item) => item.club);
  elements.circleView.innerHTML = `
    ${pending.length ? `<section class="together-section"><div class="together-section-head"><div><span class="card-label">Action attendue</span><h2>Invitations</h2></div></div><div class="circle-grid">${pending.map((item) => `<article class="circle-card"><h3>Invitation reçue</h3><p>Une personne souhaite rejoindre ton Cercle.</p><button class="together-primary" data-accept-relationship="${item.id}">Accepter</button></article>`).join("")}</div></section>` : ""}
    ${pendingClubs.length ? `<section class="together-section"><div class="together-section-head"><div><span class="card-label">Action attendue</span><h2>Invitations Clubs</h2></div></div><div class="club-grid">${pendingClubs.map(({ membership, club }) => `<article class="club-card"><h3>${escapeHTML(club.name)}</h3><p>${escapeHTML(sportLabel(club.category))} · ${escapeHTML(club.location_name)}</p><div class="inline-actions"><button class="light-button" data-club-invite="${membership.id}" data-answer="ACCEPTED">Rejoindre</button><button class="ghost-light-button" data-club-invite="${membership.id}" data-answer="DECLINED">Refuser</button></div></article>`).join("")}</div></section>` : ""}
    <section class="together-section"><div class="together-section-head"><div><span class="card-label">Relations réciproques</span><h2>Mes proches</h2></div><p>Les personnes avec lesquelles tu choisis de partager.</p></div><div class="circle-grid">${accepted.length ? accepted.map(personCard).join("") : emptyCard("Ton Cercle est encore calme", "Les invitations apparaîtront ici après acceptation.")}</div></section>
    <section class="together-section"><div class="together-section-head"><div><span class="card-label">Espaces collectifs</span><h2>Mes Clubs</h2></div><button class="together-secondary" id="openCreateClub" type="button">Créer un Club</button></div><div class="club-grid">${TOGETHER.clubs.length ? TOGETHER.clubs.map(clubCard).join("") : emptyCard("Créer le premier Club", "Réunis un petit groupe autour d’une pratique ou d’une envie commune.")}</div></section>`;
  document.getElementById("openCreateClub")?.addEventListener("click", () => openClubForm());
  elements.circleView.querySelectorAll("[data-open-club]").forEach((button) => button.addEventListener("click", () => openClubDetail(button.dataset.openClub)));
  elements.circleView.querySelectorAll("[data-accept-relationship]").forEach((button) => button.addEventListener("click", () => acceptRelationship(button.dataset.acceptRelationship)));
  elements.circleView.querySelectorAll("[data-club-invite]").forEach((button) => button.addEventListener("click", () => answerClubInvitation(button.dataset.clubInvite, button.dataset.answer)));
}

function renderClubOptions() {
  elements.momentClub.innerHTML = `<option value="">Moment personnel</option>${TOGETHER.clubs.map((club) => `<option value="${club.id}">${escapeHTML(club.name)}</option>`).join("")}`;
}

async function openClubDetail(clubId) {
  const club = TOGETHER.clubs.find((item) => item.id === clubId);
  if (!club) return;
  elements.clubDetail.innerHTML = '<div class="detail-loading">Ouverture du Club…</div>';
  if (!elements.clubDetailDialog.open) elements.clubDetailDialog.showModal();
  const { data: members, error } = await window.momentumDB.from("club_members").select("*").eq("club_id", clubId).in("membership_status", ["PENDING", "ACCEPTED"]).order("created_at");
  if (error) return elements.clubDetail.innerHTML = `<div class="dialog-shell"><p>${escapeHTML(error.message)}</p></div>`;
  const userIds = [...new Set((members || []).map((member) => member.user_id))];
  const { data: passports } = userIds.length ? await window.momentumDB.from("passports").select("user_id,display_name,avatar_url,city").in("user_id", userIds) : { data: [] };
  const profiles = new Map((passports || []).map((profile) => [profile.user_id, profile]));
  const acceptedFriends = TOGETHER.relationships.filter((item) => item.status === "ACCEPTED").map((item) => item.requester_id === TOGETHER.user.id ? item.recipient_id : item.requester_id).filter((id) => !userIds.includes(id));
  const canManage = club.owner_id === TOGETHER.user.id || members?.some((member) => member.user_id === TOGETHER.user.id && ["OWNER", "ADMIN"].includes(member.role));
  const logo = TOGETHER.logoUrls.get(club.id);
  elements.clubDetail.innerHTML = `<div class="dialog-shell">
    <div class="club-detail-hero">${logo ? `<img src="${escapeHTML(logo)}" alt="" />` : "△"}</div>
    <button class="dialog-close detail-close" type="button" aria-label="Fermer">×</button>
    <span class="card-label">${escapeHTML(sportLabel(club.category))}</span><h2>${escapeHTML(club.name)}</h2>
    <p class="detail-lead">${escapeHTML(club.description || "Un Club pour vivre des Moments ensemble.")}</p>
    <div class="detail-facts"><span>${escapeHTML(club.location_name)}</span><span>${members?.filter((member) => member.membership_status === "ACCEPTED").length || 0} membres</span><span>${escapeHTML(club.visibility)}</span></div>
    ${canManage ? '<button class="together-secondary" id="editClub" type="button">Modifier le Club</button>' : ""}
    <section class="detail-section"><div class="detail-title"><h3>Membres</h3>${canManage && acceptedFriends.length ? `<select id="clubInviteUser"><option value="">Inviter un proche…</option>${acceptedFriends.map((id) => `<option value="${id}">${escapeHTML(TOGETHER.passports.get(id)?.display_name || "Membre du Cercle")}</option>`).join("")}</select>` : ""}</div>
      <div class="member-list">${(members || []).map((member) => { const profile = profiles.get(member.user_id) || {}; const roleControl = canManage && member.role !== "OWNER" && member.membership_status === "ACCEPTED" ? `<select class="member-role-select" data-member-role="${member.id}">${[["MEMBER","Membre"],["ORGANIZER","Organisateur"],["ADMIN","Administrateur"]].map(([value,label]) => `<option value="${value}" ${member.role === value ? "selected" : ""}>${label}</option>`).join("")}</select>` : `<small>${escapeHTML(member.role)} · ${escapeHTML(member.membership_status)}</small>`; return `<div class="member-row"><span class="mini-avatar">${profile.avatar_url ? `<img src="${escapeHTML(profile.avatar_url)}" alt="" />` : initials(profile.display_name || "?")}</span><span><strong>${escapeHTML(profile.display_name || (member.user_id === TOGETHER.user.id ? "Toi" : "Membre"))}</strong>${roleControl}</span></div>`; }).join("")}</div>
    </section>
    <section class="detail-section"><div class="detail-title"><h3>Moments du Club</h3><button class="together-secondary" id="clubCreateMoment" type="button">Créer un Moment</button></div><div class="detail-moments">${TOGETHER.moments.filter((moment) => moment.club_id === club.id).slice(0, 5).map((moment) => `<button data-detail-moment="${moment.id}"><strong>${escapeHTML(moment.title)}</strong><span>${escapeHTML(formatDate(moment.start_at))}</span></button>`).join("") || "Aucun Moment pour l’instant."}</div></section>
  </div>`;
  elements.clubDetail.querySelector(".detail-close")?.addEventListener("click", () => elements.clubDetailDialog.close());
  document.getElementById("editClub")?.addEventListener("click", () => { elements.clubDetailDialog.close(); openClubForm(club); });
  document.getElementById("clubInviteUser")?.addEventListener("change", (event) => inviteClubMember(club.id, event.target.value));
  elements.clubDetail.querySelectorAll("[data-member-role]").forEach((select) => select.addEventListener("change", () => updateClubMemberRole(club.id, select.dataset.memberRole, select.value)));
  document.getElementById("clubCreateMoment")?.addEventListener("click", () => { elements.clubDetailDialog.close(); elements.momentForm.reset(); elements.momentClub.value = club.id; elements.momentDialog.showModal(); });
  elements.clubDetail.querySelectorAll("[data-detail-moment]").forEach((button) => button.addEventListener("click", () => { elements.clubDetailDialog.close(); openMomentDetail(button.dataset.detailMoment); }));
}

async function inviteClubMember(clubId, userId) {
  if (!userId) return;
  const { error } = await window.momentumDB.from("club_members").insert({ club_id: clubId, user_id: userId, invited_by: TOGETHER.user.id, role: "MEMBER", membership_status: "PENDING" });
  if (error) return setStatus(`Invitation non envoyée : ${error.message}`, true);
  setStatus("Invitation au Club envoyée.");
  elements.clubDetailDialog.close(); await loadTogether();
}

async function updateClubMemberRole(clubId, membershipId, role) {
  const { error } = await window.momentumDB.from("club_members").update({ role }).eq("id", membershipId).eq("club_id", clubId);
  if (error) return setStatus(`Rôle non modifié : ${error.message}`, true);
  setStatus("Le rôle du membre a été mis à jour.");
  await loadTogether(); openClubDetail(clubId);
}

async function answerClubInvitation(id, answer) {
  const { error } = await window.momentumDB.from("club_members").update({ membership_status: answer, joined_at: answer === "ACCEPTED" ? new Date().toISOString() : null }).eq("id", id).eq("user_id", TOGETHER.user.id);
  if (error) return setStatus(`Réponse non enregistrée : ${error.message}`, true);
  await loadTogether();
}

async function openMomentDetail(momentId) {
  const moment = TOGETHER.moments.find((item) => item.id === momentId);
  if (!moment) return;
  elements.momentDetail.innerHTML = '<div class="detail-loading">Ouverture du Moment…</div>';
  if (!elements.momentDetailDialog.open) elements.momentDetailDialog.showModal();
  const [mediaResult, linksResult, activitiesResult, reactionsResult, presetsResult] = await Promise.all([
    window.momentumDB.from("moment_media").select("*").eq("moment_id", moment.id).order("created_at", { ascending: false }),
    window.momentumDB.from("moment_activities").select("*, activities(*)").eq("moment_id", moment.id).order("created_at", { ascending: false }),
    window.momentumDB.from("activities").select("id,sport,activity_type,activity_date,distance_km,duration_min,elevation_m").eq("user_id", TOGETHER.user.id).order("activity_date", { ascending: false }).limit(50),
    window.momentumDB.from("reactions").select("*").eq("moment_id", moment.id),
    window.momentumDB.from("preset_messages").select("*").eq("is_active", true).order("display_order"),
  ]);
  const loadError = mediaResult.error || linksResult.error || activitiesResult.error || reactionsResult.error || presetsResult.error;
  if (loadError) return elements.momentDetail.innerHTML = `<div class="dialog-shell"><button class="dialog-close detail-close" type="button">×</button><p>${escapeHTML(loadError.message)}</p></div>`;

  const signedMedia = await Promise.all((mediaResult.data || []).map(async (media) => {
    const { data } = await window.momentumDB.storage.from("moment-media").createSignedUrl(media.file_path, 3600);
    return { ...media, signed_url: data?.signedUrl || null };
  }));
  const options = (moment.moment_date_options || []).sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  const canManage = moment.created_by === TOGETHER.user.id;
  const linkedIds = new Set((linksResult.data || []).map((link) => link.activity_id));
  const availableActivities = (activitiesResult.data || []).filter((activity) => !linkedIds.has(activity.id));
  const myReaction = (reactionsResult.data || []).find((reaction) => reaction.user_id === TOGETHER.user.id);
  const emojis = [["HEART","❤️"],["APPLAUSE","👏"],["FIRE","🔥"],["SPARKLES","✨"],["MOUNTAIN","🏔️"],["TENNIS","🎾"],["COFFEE","☕"]];
  elements.momentDetail.innerHTML = `<div class="dialog-shell moment-memory-shell"><button class="dialog-close detail-close" type="button">×</button><span class="card-label">${escapeHTML(moment.status)}</span><h2>${escapeHTML(moment.title)}</h2><p class="detail-lead">${escapeHTML(moment.description || "Un Moment partagé.")}</p><div class="detail-facts"><span>${escapeHTML(formatDate(moment.start_at))}</span><span>${escapeHTML(moment.location_name || "Lieu à définir")}</span></div>
    ${canManage && moment.status === "CONFIRMED" ? '<button class="together-secondary" id="completeMoment" type="button">Marquer comme terminé</button>' : ""}
    ${options.length ? `<section class="detail-section"><div class="detail-title"><h3>Créneaux</h3></div><div class="option-list">${options.map((option) => { const mine = option.moment_availability?.find((item) => item.user_id === TOGETHER.user.id)?.availability_status || "NO_RESPONSE"; const yes = option.moment_availability?.filter((item) => item.availability_status === "AVAILABLE").length || 0; return `<article class="date-option ${option.is_selected ? "selected" : ""}"><div><strong>${escapeHTML(formatDate(option.start_at))}</strong><small>${escapeHTML(option.location_name || moment.location_name || "Lieu à définir")} · ${yes} disponible${yes > 1 ? "s" : ""}</small></div><div class="availability-actions">${[["AVAILABLE","Oui"],["MAYBE","Peut-être"],["UNAVAILABLE","Non"]].map(([value,label]) => `<button class="${mine === value ? "active" : ""}" data-availability="${option.id}" data-value="${value}" type="button">${label}</button>`).join("")}</div>${canManage && !option.is_selected && moment.status === "PLANNING" ? `<button class="confirm-option" data-confirm-option="${option.id}" type="button">Confirmer ce créneau</button>` : option.is_selected ? '<span class="confirmed-label">Créneau confirmé</span>' : ""}</article>`; }).join("")}</div></section>` : ""}
    <section class="detail-section"><div class="detail-title"><h3>Photos</h3><label class="memory-upload">Ajouter une photo<input id="momentPhoto" type="file" accept="image/png,image/jpeg,image/webp" /></label></div><div class="memory-gallery">${signedMedia.length ? signedMedia.map((media) => `<figure>${media.signed_url ? `<img src="${escapeHTML(media.signed_url)}" alt="${escapeHTML(media.caption || "Photo du Moment")}" />` : ""}${media.caption ? `<figcaption>${escapeHTML(media.caption)}</figcaption>` : ""}</figure>`).join("") : '<p class="memory-empty">Aucune photo pour l’instant.</p>'}</div></section>
    <section class="detail-section"><div class="detail-title"><h3>Activités liées</h3>${availableActivities.length ? `<select id="linkActivity"><option value="">Lier une activité HOME…</option>${availableActivities.map((activity) => `<option value="${activity.id}">${escapeHTML(sportLabel(activity.sport) || activity.activity_type || "Activité")} · ${escapeHTML(activity.activity_date || "Sans date")}</option>`).join("")}</select>` : ""}</div><div class="linked-activities">${(linksResult.data || []).length ? (linksResult.data || []).map((link) => activityMemoryCard(link.activities)).join("") : '<p class="memory-empty">Aucune activité liée.</p>'}</div></section>
    <section class="detail-section"><div class="detail-title"><h3>Encourager</h3></div><div class="reaction-picker">${emojis.map(([value,label]) => `<button class="${myReaction?.reaction_type === value ? "active" : ""}" data-reaction="${value}" type="button">${label}</button>`).join("")}</div><div class="preset-picker">${(presetsResult.data || []).map((preset) => `<button class="${myReaction?.preset_message_id === preset.id ? "active" : ""}" data-preset="${preset.id}" type="button">${escapeHTML(preset.label)}</button>`).join("")}</div>${myReaction ? '<button class="remove-reaction" id="removeReaction" type="button">Retirer ma réaction</button>' : ""}</section>
  </div>`;
  elements.momentDetail.querySelector(".detail-close")?.addEventListener("click", () => elements.momentDetailDialog.close());
  elements.momentDetail.querySelectorAll("[data-availability]").forEach((button) => button.addEventListener("click", () => saveAvailability(button.dataset.availability, button.dataset.value, moment.id)));
  elements.momentDetail.querySelectorAll("[data-confirm-option]").forEach((button) => button.addEventListener("click", () => confirmDateOption(moment, button.dataset.confirmOption)));
  document.getElementById("completeMoment")?.addEventListener("click", () => completeMoment(moment.id));
  document.getElementById("momentPhoto")?.addEventListener("change", (event) => addMomentPhoto(moment.id, event.target.files?.[0]));
  document.getElementById("linkActivity")?.addEventListener("change", (event) => linkMomentActivity(moment.id, event.target.value));
  elements.momentDetail.querySelectorAll("[data-reaction]").forEach((button) => button.addEventListener("click", () => saveReaction(moment.id, button.dataset.reaction, null)));
  elements.momentDetail.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => saveReaction(moment.id, "MESSAGE", button.dataset.preset)));
  document.getElementById("removeReaction")?.addEventListener("click", () => removeReaction(moment.id));
}

function activityMemoryCard(activity = {}) {
  const details = [activity.distance_km ? `${Number(activity.distance_km).toFixed(1)} km` : null, activity.duration_min ? `${Math.round(activity.duration_min)} min` : null, activity.elevation_m ? `${Math.round(activity.elevation_m)} m D+` : null].filter(Boolean).join(" · ");
  return `<article><strong>${escapeHTML(sportLabel(activity.sport) || activity.activity_type || "Activité")}</strong><span>${escapeHTML(activity.activity_date || "Sans date")}${details ? ` · ${escapeHTML(details)}` : ""}</span></article>`;
}

async function completeMoment(momentId) {
  const { error } = await window.momentumDB.from("moments").update({ status: "COMPLETED", updated_at: new Date().toISOString() }).eq("id", momentId);
  if (error) return setStatus(`Moment non terminé : ${error.message}`, true);
  elements.momentDetailDialog.close(); setStatus("Le Moment rejoint maintenant les souvenirs."); await loadTogether();
}

async function addMomentPhoto(momentId, file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) return setStatus("La photo dépasse 10 Mo.", true);
  const caption = window.prompt("Une courte légende ?", "")?.trim() || null;
  const extension = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${momentId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await window.momentumDB.storage.from("moment-media").upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (uploadError) return setStatus(`Photo non envoyée : ${uploadError.message}`, true);
  const { error } = await window.momentumDB.from("moment_media").insert({ moment_id: momentId, user_id: TOGETHER.user.id, file_path: path, caption });
  if (error) return setStatus(`Photo envoyée mais non liée : ${error.message}`, true);
  setStatus("La photo a été ajoutée."); await openMomentDetail(momentId);
}

async function linkMomentActivity(momentId, activityId) {
  if (!activityId) return;
  const { error } = await window.momentumDB.from("moment_activities").insert({ moment_id: momentId, activity_id: activityId, added_by: TOGETHER.user.id });
  if (error) return setStatus(`Activité non liée : ${error.message}`, true);
  setStatus("L’activité HOME est liée au Moment."); await openMomentDetail(momentId);
}

async function saveReaction(momentId, type, presetId) {
  const { data: existing } = await window.momentumDB.from("reactions").select("id").eq("moment_id", momentId).eq("user_id", TOGETHER.user.id).maybeSingle();
  const values = { reaction_type: type, preset_message_id: presetId, updated_at: new Date().toISOString() };
  const query = existing ? window.momentumDB.from("reactions").update(values).eq("id", existing.id) : window.momentumDB.from("reactions").insert({ ...values, moment_id: momentId, user_id: TOGETHER.user.id });
  const { error } = await query;
  if (error) return setStatus(`Réaction non enregistrée : ${error.message}`, true);
  await openMomentDetail(momentId);
}

async function removeReaction(momentId) {
  const { error } = await window.momentumDB.from("reactions").delete().eq("moment_id", momentId).eq("user_id", TOGETHER.user.id);
  if (error) return setStatus(`Réaction non retirée : ${error.message}`, true);
  await openMomentDetail(momentId);
}

async function saveAvailability(optionId, status, momentId) {
  const { data: existing } = await window.momentumDB.from("moment_availability").select("id").eq("date_option_id", optionId).eq("user_id", TOGETHER.user.id).maybeSingle();
  const query = existing ? window.momentumDB.from("moment_availability").update({ availability_status: status, updated_at: new Date().toISOString() }).eq("id", existing.id) : window.momentumDB.from("moment_availability").insert({ date_option_id: optionId, user_id: TOGETHER.user.id, availability_status: status });
  const { error } = await query;
  if (error) return setStatus(`Disponibilité non enregistrée : ${error.message}`, true);
  await loadTogether(); openMomentDetail(momentId);
}

async function confirmDateOption(moment, optionId) {
  const option = moment.moment_date_options.find((item) => item.id === optionId);
  if (!option) return;
  const { error: optionError } = await window.momentumDB.from("moment_date_options").update({ is_selected: true }).eq("id", optionId);
  if (optionError) return setStatus(`Créneau non confirmé : ${optionError.message}`, true);
  const { error } = await window.momentumDB.from("moments").update({ start_at: option.start_at, end_at: option.end_at, location_name: option.location_name || moment.location_name, status: "CONFIRMED", updated_at: new Date().toISOString() }).eq("id", moment.id);
  if (error) return setStatus(`Moment non confirmé : ${error.message}`, true);
  elements.momentDetailDialog.close(); setStatus("Le créneau est confirmé."); await loadTogether();
}

async function loadTogether() {
  setStatus("Chargement de ton espace partagé…");
  const { data: sessionData, error: sessionError } = await window.momentumDB.auth.getSession();
  if (sessionError || !sessionData.session) return window.location.href = "login.html";
  TOGETHER.user = sessionData.session.user;

  const [momentsResult, clubsResult, relationshipsResult, membershipsResult] = await Promise.all([
    window.momentumDB.from("moments").select("*, moment_participants(count), moment_date_options(*, moment_availability(*))").order("start_at", { ascending: true, nullsFirst: true }),
    window.momentumDB.from("clubs").select("*, club_members(count)").eq("status", "ACTIVE").order("created_at", { ascending: false }),
    window.momentumDB.from("circle_relationships").select("*").or(`requester_id.eq.${TOGETHER.user.id},recipient_id.eq.${TOGETHER.user.id}`).order("created_at", { ascending: false }),
    window.momentumDB.from("club_members").select("*").eq("user_id", TOGETHER.user.id),
  ]);

  const firstError = momentsResult.error || clubsResult.error || relationshipsResult.error || membershipsResult.error;
  if (firstError) {
    console.error("TOGETHER:", firstError);
    setStatus(firstError.code === "42P01" || firstError.code === "PGRST205" ? "Le module est prêt. La migration Supabase TOGETHER doit encore être appliquée pour activer les données." : `Impossible de charger TOGETHER : ${firstError.message}`, true);
  } else setStatus("");

  TOGETHER.moments = momentsResult.data || [];
  TOGETHER.clubs = clubsResult.data || [];
  TOGETHER.relationships = relationshipsResult.data || [];
  TOGETHER.clubMemberships = membershipsResult.data || [];

  const logoClubs = TOGETHER.clubs.filter((club) => club.logo_url);
  const signedLogos = await Promise.all(logoClubs.map(async (club) => {
    const { data } = await window.momentumDB.storage.from("club-logos").createSignedUrl(club.logo_url, 3600);
    return [club.id, data?.signedUrl || null];
  }));
  TOGETHER.logoUrls = new Map(signedLogos.filter(([, url]) => url));

  const memberIds = [...new Set(TOGETHER.relationships.flatMap((item) => [item.requester_id, item.recipient_id]).filter((id) => id !== TOGETHER.user.id))];
  if (memberIds.length) {
    const { data: passports } = await window.momentumDB.from("passports").select("user_id, display_name, city, country, avatar_url").in("user_id", memberIds);
    (passports || []).forEach((passport) => TOGETHER.passports.set(passport.user_id, passport));
  }
  renderClubOptions();
  renderMoments();
  renderCircle();
}

async function createMoment(form) {
  const values = Object.fromEntries(new FormData(form));
  const proposedDates = [values.start_at, ...Array.from(form.querySelectorAll('[name="date_option"]')).map((input) => input.value)].filter(Boolean);
  const payload = {
    user_id: TOGETHER.user.id,
    created_by: TOGETHER.user.id,
    club_id: values.club_id || null,
    title: values.title.trim(), description: values.description.trim() || null,
    moment_type: values.moment_type, status: proposedDates.length === 1 ? "CONFIRMED" : "PLANNING",
    start_at: proposedDates.length === 1 ? new Date(proposedDates[0]).toISOString() : null,
    location_name: values.location_name.trim() || null,
    capacity: values.capacity ? Number(values.capacity) : null, visibility: values.visibility,
  };
  const { data, error } = await window.momentumDB.from("moments").insert(payload).select().single();
  if (error) return setStatus(`Moment non créé : ${error.message}`, true);
  const participantResult = await window.momentumDB.from("moment_participants").insert({ moment_id: data.id, user_id: TOGETHER.user.id, role: "OWNER", invitation_status: "ACCEPTED", participation_status: "REGISTERED" });
  if (participantResult.error) return setStatus(`Moment créé, mais organisateur non lié : ${participantResult.error.message}`, true);
  if (proposedDates.length) {
    const { error: optionsError } = await window.momentumDB.from("moment_date_options").insert(proposedDates.map((date, index) => ({ moment_id: data.id, start_at: new Date(date).toISOString(), location_name: payload.location_name, created_by: TOGETHER.user.id, is_selected: proposedDates.length === 1 && index === 0 })));
    if (optionsError) return setStatus(`Moment créé, mais créneaux non enregistrés : ${optionsError.message}`, true);
  }
  form.reset(); elements.momentDialog.close(); setStatus("Le Moment a été créé."); await loadTogether();
}

async function uploadClubLogo(clubId, file) {
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error("Le logo dépasse 5 Mo.");
  const extension = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${clubId}/logo-${Date.now()}.${extension}`;
  const { error } = await window.momentumDB.storage.from("club-logos").upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (error) throw error;
  return path;
}

async function createClub(form) {
  const values = Object.fromEntries(new FormData(form));
  const payload = { owner_id: TOGETHER.user.id, name: values.name.trim(), slug: `${slugify(values.name)}-${crypto.randomUUID().slice(0, 6)}`, category: values.category, location_name: values.location_name.trim(), visibility: values.visibility, description: values.description.trim() || null };
  if (values.club_id) {
    const existingClub = TOGETHER.clubs.find((club) => club.id === values.club_id);
    if (!existingClub) return setStatus("Club introuvable.", true);
    const updatePayload = { name: payload.name, category: payload.category, location_name: payload.location_name, visibility: payload.visibility, description: payload.description, updated_at: new Date().toISOString() };
    const logo = elements.clubLogo?.files?.[0];
    if (logo) {
      try { updatePayload.logo_url = await uploadClubLogo(existingClub.id, logo); }
      catch (logoError) { return setStatus(`Logo non enregistré : ${logoError.message}`, true); }
    }
    const { error: updateError } = await window.momentumDB.from("clubs").update(updatePayload).eq("id", existingClub.id);
    if (updateError) return setStatus(`Club non modifié : ${updateError.message}`, true);
    form.reset(); elements.clubDialog.close(); setStatus("Le Club a été modifié."); await loadTogether(); return;
  }
  const { data: club, error } = await window.momentumDB.from("clubs").insert(payload).select().single();
  if (error) return setStatus(`Club non créé : ${error.message}`, true);
  const logo = elements.clubLogo?.files?.[0];
  if (logo) {
    try {
      const logoPath = await uploadClubLogo(club.id, logo);
      const { error: updateError } = await window.momentumDB.from("clubs").update({ logo_url: logoPath, updated_at: new Date().toISOString() }).eq("id", club.id);
      if (updateError) throw updateError;
    } catch (logoError) {
      console.error("TOGETHER logo:", logoError);
      setStatus(`Club créé, mais logo non enregistré : ${logoError.message}`, true);
      await loadTogether(); return;
    }
  }
  form.reset(); elements.clubDialog.close(); setStatus("Le Club a été créé."); await loadTogether();
}

async function acceptRelationship(id) {
  const { error } = await window.momentumDB.from("circle_relationships").update({ status: "ACCEPTED", accepted_at: new Date().toISOString() }).eq("id", id).eq("recipient_id", TOGETHER.user.id);
  if (error) return setStatus(`Invitation non acceptée : ${error.message}`, true);
  await loadTogether();
}

elements.tabs.forEach((tab) => tab.addEventListener("click", () => {
  TOGETHER.view = tab.dataset.view;
  elements.tabs.forEach((item) => { const active = item === tab; item.classList.toggle("active", active); item.setAttribute("aria-selected", String(active)); });
  elements.momentsView.hidden = TOGETHER.view !== "moments";
  elements.circleView.hidden = TOGETHER.view !== "circle";
}));
document.getElementById("openCreateMoment")?.addEventListener("click", () => elements.momentDialog.showModal());
document.getElementById("addDateOption")?.addEventListener("click", () => {
  const row = document.createElement("div");
  row.className = "date-option-input";
  row.innerHTML = '<input name="date_option" type="datetime-local" required /><button type="button" aria-label="Supprimer ce créneau">×</button>';
  row.querySelector("button").addEventListener("click", () => row.remove());
  elements.dateOptions.appendChild(row);
});
elements.clubLogo?.addEventListener("change", () => {
  const file = elements.clubLogo.files?.[0];
  if (!file) { elements.clubLogoPreview.textContent = "△"; return; }
  const url = URL.createObjectURL(file);
  elements.clubLogoPreview.innerHTML = `<img src="${url}" alt="Aperçu du logo" />`;
});
elements.momentForm?.addEventListener("submit", (event) => { event.preventDefault(); if (event.submitter?.value !== "cancel" && elements.momentForm.reportValidity()) createMoment(elements.momentForm); else elements.momentDialog.close(); });
elements.clubForm?.addEventListener("submit", (event) => { event.preventDefault(); if (event.submitter?.value !== "cancel" && elements.clubForm.reportValidity()) createClub(elements.clubForm); else elements.clubDialog.close(); });
document.getElementById("logoutBtn")?.addEventListener("click", async () => { await window.momentumDB.auth.signOut(); window.location.href = "login.html"; });

renderSportOptions();
loadTogether();
