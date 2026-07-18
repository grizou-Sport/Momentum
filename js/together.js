const TOGETHER = {
  user: null,
  moments: [],
  clubs: [],
  relationships: [],
  circle: { received: [], sent: [], members: [] },
  clubMemberships: [],
  passports: new Map(),
  logoUrls: new Map(),
  view: "circle",
  section: "circle",
};

const elements = {
  tabs: document.querySelectorAll("[data-view]"),
  momentsView: document.getElementById("momentsView"),
  circleView: document.getElementById("circleView"),
  status: document.getElementById("togetherStatus"),
  primaryAction: document.getElementById("primaryTogetherAction"),
  momentDialog: document.getElementById("momentDialog"),
  clubDialog: document.getElementById("clubDialog"),
  momentForm: document.getElementById("momentForm"),
  momentDialogKicker: document.getElementById("momentDialogKicker"),
  momentDialogTitle: document.getElementById("momentDialogTitle"),
  saveMoment: document.getElementById("saveMoment"),
  momentVisibility: document.getElementById("momentVisibility"),
  momentClubField: document.getElementById("momentClubField"),
  momentParticipantPicker: document.getElementById("momentParticipantPicker"),
  momentParticipantOptions: document.getElementById("momentParticipantOptions"),
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
  circleInviteDialog: document.getElementById("circleInviteDialog"),
  circleInviteForm: document.getElementById("circleInviteForm"),
  circleSearchResult: document.getElementById("circleSearchResult"),
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

function localDateTimeValue(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
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

function momentStatusLabel(value) {
  return ({ DRAFT:"Brouillon", PLANNING:"À finaliser", CONFIRMED:"Confirmé", ONGOING:"En cours", COMPLETED:"Terminé", CANCELLED:"Annulé" })[value] || value;
}

function visibilityLabel(value) {
  return ({ PRIVATE:"Privé", PARTICIPANTS:"Participants", CIRCLE:"Cercle", SELECTED_USERS:"Personnes choisies", DISCOVERABLE:"Visible sur recherche" })[value] || value;
}

function invitationStatusLabel(value) {
  return ({ PENDING:"En attente", ACCEPTED:"Accepté", DECLINED:"Refusé", REMOVED:"Retiré" })[value] || value;
}

function renderMomentParticipantOptions(selectedIds = []) {
  const selected = new Set(selectedIds);
  const members = TOGETHER.circle.members || [];
  elements.momentParticipantOptions.innerHTML = members.length ? members.map((member) => `<label class="participant-option"><input name="participant_ids" type="checkbox" value="${member.user_id}" ${selected.has(member.user_id) ? "checked" : ""} /><span>${circleIdentity(member, "mini-avatar")}<span><strong>${escapeHTML(member.display_name || "Membre MOMENTUM")}</strong><small>Dans ton Cercle</small></span></span></label>`).join("") : '<p class="participant-picker-empty">Ton Cercle est encore vide. Tu pourras inviter des participants plus tard.</p>';
}

function syncMomentVisibility() {
  const clubMode = elements.momentVisibility.value === "CLUB";
  elements.momentClubField.hidden = !clubMode;
  elements.momentClub.required = clubMode;
  if (!clubMode) elements.momentClub.value = "";
}

function openMomentForm(moment = null, options = {}) {
  const duplicate = Boolean(options.duplicate);
  const participantIds = options.participantIds || [];
  elements.momentForm.reset();
  elements.dateOptions.innerHTML = "";
  elements.momentForm.elements.moment_id.value = moment && !duplicate ? moment.id : "";
  elements.momentDialogKicker.textContent = duplicate ? "Nouvelle aventure" : moment ? "Organisation" : "Nouveau";
  elements.momentDialogTitle.textContent = duplicate ? "Dupliquer le Moment" : moment ? "Modifier le Moment" : "Créer un Moment";
  elements.saveMoment.textContent = moment && !duplicate ? "Enregistrer" : "Créer le Moment";
  if (moment) {
    elements.momentForm.elements.title.value = duplicate ? `Copie — ${moment.title}` : moment.title;
    elements.momentForm.elements.moment_type.value = moment.moment_type || "OTHER";
    elements.momentForm.elements.start_at.value = localDateTimeValue(moment.start_at);
    elements.momentForm.elements.location_name.value = moment.location_name || "";
    elements.momentForm.elements.capacity.value = moment.capacity || "";
    elements.momentForm.elements.description.value = moment.description || "";
    elements.momentVisibility.value = moment.club_id ? "CLUB" : moment.visibility === "CIRCLE" ? "CIRCLE" : "PRIVATE";
    elements.momentClub.value = moment.club_id || "";
  } else if (options.clubId) {
    elements.momentVisibility.value = "CLUB";
    elements.momentClub.value = options.clubId;
  }
  renderMomentParticipantOptions(participantIds);
  syncMomentVisibility();
  if (moment?.club_id) elements.momentClub.value = moment.club_id;
  elements.momentDialog.showModal();
  window.setTimeout(() => elements.momentForm.elements.title.focus(), 0);
}

function memberRoleLabel(value) {
  return ({ OWNER:"Propriétaire", ADMIN:"Administrateur", ORGANIZER:"Organisateur", MEMBER:"Membre" })[value] || value;
}

function membershipStatusLabel(value) {
  return ({ PENDING:"En attente", ACCEPTED:"Accepté", DECLINED:"Refusé", REMOVED:"Retiré", BLOCKED:"Bloqué" })[value] || value;
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
  return window.MomentumMoments.calendarStatus(moment);
}

function momentCard(moment) {
  const participantCount = moment.moment_participants?.[0]?.count || 0;
  const colors = { SPORT: "#71806d", ADVENTURE: "#b68650", TRAVEL: "#668394", SOCIAL: "#9a756b", OTHER: "#77766f" };
  return `
    <article class="moment-card" style="--moment-color:${colors[moment.moment_type] || colors.OTHER}">
      <div class="moment-card-copy">
        <span class="moment-status">${escapeHTML(momentStatusLabel(moment.status))}</span>
        <h3>${escapeHTML(moment.title)}</h3>
        <p>${escapeHTML(moment.description || "Un Moment à écrire ensemble.")}</p>
      </div>
      <div class="moment-card-details">
        <div class="moment-meta"><span>${escapeHTML(formatDate(moment.start_at))}</span><span>·</span><span>${escapeHTML(moment.location_name || "Lieu à définir")}</span></div>
        <div class="moment-card-footer">
          <span>${participantCount} participant${participantCount > 1 ? "s" : ""}</span>
          <button class="card-action" data-open-moment="${moment.id}" type="button">Ouvrir</button>
        </div>
      </div>
    </article>`;
}

function emptyCard(title, text) {
  return `<div class="together-empty"><strong>${escapeHTML(title)}</strong><span>${escapeHTML(text)}</span></div>`;
}

function renderMoments() {
  const sections = [
    ["planning", "À finaliser", "Une date ou une réponse est encore attendue."],
    ["today", "Aujourd’hui", "Les Moments que l’on vit maintenant."],
    ["upcoming", "À venir", "Les prochaines histoires déjà confirmées."],
    ["past", "Passés", "Quelques traces de ce qui a été vécu."],
  ];
  elements.momentsView.innerHTML = sections.map(([bucket, title, subtitle]) => {
    const moments = TOGETHER.moments.filter((moment) => momentBucket(moment) === bucket);
    if (!moments.length) return "";
    return `<section class="together-section"><div class="together-section-head"><div><div class="together-section-title"><h2>${title}</h2><span class="section-count" aria-label="${moments.length} Moment${moments.length > 1 ? "s" : ""}">${moments.length}</span></div><p>${subtitle}</p></div></div><div class="moment-grid">${moments.map(momentCard).join("")}</div></section>`;
  }).join("");
  elements.momentsView.querySelectorAll("[data-open-moment]").forEach((button) => button.addEventListener("click", () => openMomentDetail(button.dataset.openMoment)));
}

function clubCard(club) {
  const count = club.club_members?.[0]?.count || 0;
  const next = TOGETHER.moments.filter((moment) => moment.club_id === club.id && ["PLANNING", "CONFIRMED"].includes(moment.status)).sort((a, b) => new Date(a.start_at || 8640000000000000) - new Date(b.start_at || 8640000000000000))[0];
  const logo = TOGETHER.logoUrls.get(club.id);
  return `<article class="club-card"><div class="club-card-head"><div class="club-symbol">${logo ? `<img src="${escapeHTML(logo)}" alt="Logo ${escapeHTML(club.name)}" />` : "△"}</div><div><h3>${escapeHTML(club.name)}</h3><div class="club-meta"><span>${escapeHTML(sportLabel(club.category))}</span><span>·</span><span>${escapeHTML(club.location_name)}</span><span>·</span><span>${count} membre${count > 1 ? "s" : ""}</span></div></div></div><div class="club-next">${next ? `<strong>Prochain Moment</strong><span>${escapeHTML(next.title)} · ${escapeHTML(formatDate(next.start_at))}</span>` : `<strong>Prochain Moment</strong><span>Aucun Moment prévu</span>`}</div><button class="club-open" data-open-club="${club.id}" type="button">Ouvrir le Club</button></article>`;
}

function circleIdentity(person, size = "portrait") {
  const name = person.display_name || "Membre MOMENTUM";
  const avatar = person.avatar_url ? `<img src="${escapeHTML(person.avatar_url)}" alt="" />` : initials(name);
  return `<span class="${size}">${avatar}</span>`;
}

function personCard(person) {
  return `<article class="circle-card member-card">
    ${circleIdentity(person)}
    <div class="circle-card-copy"><h3>${escapeHTML(person.display_name || "Membre MOMENTUM")}</h3><span class="moment-status">Dans ton Cercle</span></div>
    <div class="member-actions" aria-label="Actions pour ${escapeHTML(person.display_name || "ce membre")}">
      <button class="card-action" data-end-circle="${person.user_id}" type="button">Retirer</button>
      <button class="card-action danger" data-block-circle="${person.user_id}" type="button">Bloquer</button>
    </div>
  </article>`;
}

function circleInvitationCard(invitation, direction) {
  const received = direction === "received";
  return `<article class="circle-card invitation-card">
    <div class="invitation-person">${circleIdentity(invitation, "mini-avatar")}<div><span class="card-label">${received ? "Invitation reçue" : "Invitation envoyée"}</span><h3>${escapeHTML(invitation.display_name || "Membre MOMENTUM")}</h3><p>${escapeHTML(formatDate(invitation.created_at))}</p></div></div>
    <div class="inline-actions">
      ${received ? `<button class="together-primary compact" data-circle-answer="${invitation.id}" data-answer="accept" type="button">Accepter</button><button class="together-secondary compact" data-circle-answer="${invitation.id}" data-answer="decline" type="button">Refuser</button>` : `<span class="moment-status">En attente</span><button class="card-action" data-circle-answer="${invitation.id}" data-answer="cancel" type="button">Annuler</button>`}
    </div>
  </article>`;
}

function renderCircle() {
  const { received, sent, members } = TOGETHER.circle;
  const pendingClubs = TOGETHER.clubMemberships.filter((item) => item.membership_status === "PENDING").map((membership) => ({ membership, club: TOGETHER.clubs.find((club) => club.id === membership.club_id) })).filter((item) => item.club);
  const receivedInvitations = [
    ...received.map((item) => circleInvitationCard(item, "received")),
    ...pendingClubs.map(({ membership, club }) => `<article class="club-card invitation-card"><div><span class="card-label">Club</span><h3>${escapeHTML(club.name)}</h3><p>${escapeHTML(sportLabel(club.category))} · ${escapeHTML(club.location_name)}</p></div><div class="inline-actions"><button class="light-button" data-club-invite="${membership.id}" data-answer="ACCEPTED">Rejoindre</button><button class="ghost-light-button" data-club-invite="${membership.id}" data-answer="DECLINED">Refuser</button></div></article>`)
  ];
  const hasCircleContent = receivedInvitations.length || sent.length || members.length || TOGETHER.clubs.length;
  elements.primaryAction.hidden = TOGETHER.view === "circle" && !hasCircleContent;

  if (!hasCircleContent) {
    elements.circleView.innerHTML = `<div class="together-empty-state">
      <div><span class="card-label">Ton espace partagé</span><h2>Commence par créer ton Cercle</h2><p>Invite une personne ou réunis un groupe dans un Club pour préparer vos premiers Moments.</p></div>
      <div class="together-empty-actions">
        <button class="together-primary" id="openEmptyCircleInvite" type="button">Inviter dans mon Cercle</button>
        <button class="together-secondary" id="openEmptyCreateClub" type="button">Créer un Club</button>
      </div>
    </div>`;
  } else {
    elements.circleView.innerHTML = [
      receivedInvitations.length || sent.length ? `<div id="togetherInvitations" class="together-section-group">${receivedInvitations.length ? `<section class="together-section"><div class="together-section-head"><div><div class="together-section-title"><h2>Invitations reçues</h2><span class="section-count">${received.length + pendingClubs.length}</span></div><p>Les demandes qui attendent ta réponse.</p></div></div><div class="circle-grid">${receivedInvitations.join("")}</div></section>` : ""}${sent.length ? `<section class="together-section"><div class="together-section-head"><div><div class="together-section-title"><h2>Invitations envoyées</h2><span class="section-count">${sent.length}</span></div><p>Tu peux annuler une demande tant qu’elle n’a pas été acceptée.</p></div></div><div class="circle-grid">${sent.map((item) => circleInvitationCard(item, "sent")).join("")}</div></section>` : ""}</div>` : "",
      members.length ? `<section class="together-section" id="togetherCircle"><div class="together-section-head"><div><div class="together-section-title"><h2>Mon Cercle</h2><span class="section-count">${members.length}</span></div><p>Les personnes avec lesquelles tu choisis de partager.</p></div></div><div class="circle-grid">${members.map(personCard).join("")}</div></section>` : "",
      TOGETHER.clubs.length ? `<section class="together-section" id="togetherClubs"><div class="together-section-head"><div><div class="together-section-title"><h2>Mes Clubs</h2><span class="section-count">${TOGETHER.clubs.length}</span></div><p>Les communautés auxquelles tu appartiens.</p></div><button class="together-secondary" id="openCreateClub" type="button">Créer un Club</button></div><div class="club-grid">${TOGETHER.clubs.map(clubCard).join("")}</div></section>` : "",
    ].join("");
  }
  document.getElementById("openCreateClub")?.addEventListener("click", () => openClubForm());
  document.getElementById("openEmptyCreateClub")?.addEventListener("click", () => openClubForm());
  document.getElementById("openEmptyCircleInvite")?.addEventListener("click", () => openCircleInviteForm());
  elements.circleView.querySelectorAll("[data-open-club]").forEach((button) => button.addEventListener("click", () => openClubDetail(button.dataset.openClub)));
  elements.circleView.querySelectorAll("[data-circle-answer]").forEach((button) => button.addEventListener("click", () => answerCircleInvitation(button.dataset.circleAnswer, button.dataset.answer, button)));
  elements.circleView.querySelectorAll("[data-end-circle]").forEach((button) => button.addEventListener("click", () => endCircleConnection(button.dataset.endCircle, false, button)));
  elements.circleView.querySelectorAll("[data-block-circle]").forEach((button) => button.addEventListener("click", () => endCircleConnection(button.dataset.blockCircle, true, button)));
  elements.circleView.querySelectorAll("[data-club-invite]").forEach((button) => button.addEventListener("click", () => answerClubInvitation(button.dataset.clubInvite, button.dataset.answer)));
}

function renderClubOptions() {
  elements.momentClub.innerHTML = `<option value="">Choisir un Club</option>${TOGETHER.clubs.map((club) => `<option value="${club.id}">${escapeHTML(club.name)}</option>`).join("")}`;
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
    <div class="detail-facts"><span>${escapeHTML(club.location_name)}</span><span>${members?.filter((member) => member.membership_status === "ACCEPTED").length || 0} membres</span><span>${escapeHTML(visibilityLabel(club.visibility))}</span></div>
    ${canManage ? '<button class="together-secondary" id="editClub" type="button">Modifier le Club</button>' : ""}
    <section class="detail-section"><div class="detail-title"><h3>Membres</h3>${canManage && acceptedFriends.length ? `<select id="clubInviteUser"><option value="">Inviter un proche…</option>${acceptedFriends.map((id) => `<option value="${id}">${escapeHTML(TOGETHER.passports.get(id)?.display_name || "Membre du Cercle")}</option>`).join("")}</select>` : ""}</div>
      <div class="member-list">${(members || []).map((member) => { const profile = profiles.get(member.user_id) || {}; const roleControl = canManage && member.role !== "OWNER" && member.membership_status === "ACCEPTED" ? `<select class="member-role-select" data-member-role="${member.id}">${[["MEMBER","Membre"],["ORGANIZER","Organisateur"],["ADMIN","Administrateur"]].map(([value,label]) => `<option value="${value}" ${member.role === value ? "selected" : ""}>${label}</option>`).join("")}</select>` : `<small>${escapeHTML(memberRoleLabel(member.role))} · ${escapeHTML(membershipStatusLabel(member.membership_status))}</small>`; return `<div class="member-row"><span class="mini-avatar">${profile.avatar_url ? `<img src="${escapeHTML(profile.avatar_url)}" alt="" />` : initials(profile.display_name || "?")}</span><span><strong>${escapeHTML(profile.display_name || (member.user_id === TOGETHER.user.id ? "Toi" : "Membre"))}</strong>${roleControl}</span></div>`; }).join("")}</div>
    </section>
    <section class="detail-section"><div class="detail-title"><h3>Moments du Club</h3><button class="together-secondary" id="clubCreateMoment" type="button">Créer un Moment</button></div><div class="detail-moments">${TOGETHER.moments.filter((moment) => moment.club_id === club.id).slice(0, 5).map((moment) => `<button data-detail-moment="${moment.id}"><strong>${escapeHTML(moment.title)}</strong><span>${escapeHTML(formatDate(moment.start_at))}</span></button>`).join("") || "Aucun Moment pour l’instant."}</div></section>
  </div>`;
  elements.clubDetail.querySelector(".detail-close")?.addEventListener("click", () => elements.clubDetailDialog.close());
  document.getElementById("editClub")?.addEventListener("click", () => { elements.clubDetailDialog.close(); openClubForm(club); });
  document.getElementById("clubInviteUser")?.addEventListener("change", (event) => inviteClubMember(club.id, event.target.value));
  elements.clubDetail.querySelectorAll("[data-member-role]").forEach((select) => select.addEventListener("change", () => updateClubMemberRole(club.id, select.dataset.memberRole, select.value)));
  document.getElementById("clubCreateMoment")?.addEventListener("click", () => { elements.clubDetailDialog.close(); openMomentForm(null, { clubId: club.id }); });
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
  const [mediaResult, linksResult, activitiesResult, reactionsResult, presetsResult, participantsResult] = await Promise.all([
    window.momentumDB.from("moment_media").select("*").eq("moment_id", moment.id).order("created_at", { ascending: false }),
    window.momentumDB.from("moment_activities").select("*, activities(*)").eq("moment_id", moment.id).order("created_at", { ascending: false }),
    window.momentumDB.from("activities").select("id,sport,activity_type,activity_date,distance_km,duration_min,elevation_m").eq("user_id", TOGETHER.user.id).order("activity_date", { ascending: false }).limit(50),
    window.momentumDB.from("reactions").select("*").eq("moment_id", moment.id),
    window.momentumDB.from("preset_messages").select("*").eq("is_active", true).order("display_order"),
    window.momentumDB.from("moment_participants").select("*").eq("moment_id", moment.id).neq("invitation_status", "REMOVED").order("created_at"),
  ]);
  const loadError = mediaResult.error || linksResult.error || activitiesResult.error || reactionsResult.error || presetsResult.error || participantsResult.error;
  if (loadError) return elements.momentDetail.innerHTML = `<div class="dialog-shell"><button class="dialog-close detail-close" type="button">×</button><p>${escapeHTML(loadError.message)}</p></div>`;

  const signedMedia = await Promise.all((mediaResult.data || []).map(async (media) => {
    const { data } = await window.momentumDB.storage.from("moment-media").createSignedUrl(media.file_path, 3600);
    return { ...media, signed_url: data?.signedUrl || null };
  }));
  const options = (moment.moment_date_options || []).sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  const canManage = moment.created_by === TOGETHER.user.id;
  const participants = participantsResult.data || [];
  const participantIds = participants.map((participant) => participant.user_id);
  const { data: participantProfiles } = participantIds.length ? await window.momentumDB.from("passports").select("user_id,display_name,avatar_url").in("user_id", participantIds) : { data: [] };
  const participantProfileMap = new Map((participantProfiles || []).map((profile) => [profile.user_id, profile]));
  const myParticipation = participants.find((participant) => participant.user_id === TOGETHER.user.id);
  const linkedIds = new Set((linksResult.data || []).map((link) => link.activity_id));
  const availableActivities = (activitiesResult.data || []).filter((activity) => !linkedIds.has(activity.id));
  const myReaction = (reactionsResult.data || []).find((reaction) => reaction.user_id === TOGETHER.user.id);
  const emojis = [["HEART","❤️"],["APPLAUSE","👏"],["FIRE","🔥"],["SPARKLES","✨"],["MOUNTAIN","🏔️"],["TENNIS","🎾"],["COFFEE","☕"]];
  elements.momentDetail.innerHTML = `<div class="dialog-shell moment-memory-shell"><button class="dialog-close detail-close" type="button">×</button><span class="card-label">${escapeHTML(moment.status)}</span><h2>${escapeHTML(moment.title)}</h2><p class="detail-lead">${escapeHTML(moment.description || "Un Moment partagé.")}</p><div class="detail-facts"><span>${escapeHTML(formatDate(moment.start_at))}</span><span>${escapeHTML(moment.location_name || "Lieu à définir")}</span><span>${escapeHTML(visibilityLabel(moment.club_id ? "Club" : moment.visibility))}</span></div>
    ${canManage ? '<div class="moment-owner-actions"><button class="together-secondary" id="editMoment" type="button">Modifier</button><button class="together-secondary" id="duplicateMoment" type="button">Dupliquer</button><button class="moment-danger-action" id="deleteMoment" type="button">Supprimer</button></div>' : ""}
    ${myParticipation?.invitation_status === "PENDING" ? '<section class="moment-invitation-answer"><div><strong>Ton invitation attend une réponse</strong><span>Ta décision sera immédiatement visible par l’organisateur.</span></div><div><button class="together-primary" data-answer-moment="ACCEPTED" type="button">Accepter</button><button class="together-secondary" data-answer-moment="DECLINED" type="button">Refuser</button></div></section>' : ""}
    ${canManage && moment.status === "CONFIRMED" ? '<button class="together-secondary" id="completeMoment" type="button">Marquer comme terminé</button>' : ""}
    <section class="detail-section"><div class="detail-title"><h3>Participants</h3><span class="section-count">${participants.length}</span></div><div class="moment-participant-list">${participants.length ? participants.map((participant) => { const profile = participantProfileMap.get(participant.user_id) || {}; const name = participant.user_id === TOGETHER.user.id ? "Toi" : profile.display_name || "Membre MOMENTUM"; return `<div class="moment-participant-row">${circleIdentity(profile, "mini-avatar")}<span><strong>${escapeHTML(name)}</strong><small>${escapeHTML(participant.role === "OWNER" ? "Organisateur" : "Participant")}</small></span><span class="participant-invitation-status status-${participant.invitation_status.toLowerCase()}">${escapeHTML(invitationStatusLabel(participant.invitation_status))}</span></div>`; }).join("") : '<p class="memory-empty">Aucun participant invité.</p>'}</div></section>
    ${options.length ? `<section class="detail-section"><div class="detail-title"><h3>Créneaux</h3></div><div class="option-list">${options.map((option) => { const mine = option.moment_availability?.find((item) => item.user_id === TOGETHER.user.id)?.availability_status || "NO_RESPONSE"; const yes = option.moment_availability?.filter((item) => item.availability_status === "AVAILABLE").length || 0; return `<article class="date-option ${option.is_selected ? "selected" : ""}"><div><strong>${escapeHTML(formatDate(option.start_at))}</strong><small>${escapeHTML(option.location_name || moment.location_name || "Lieu à définir")} · ${yes} disponible${yes > 1 ? "s" : ""}</small></div><div class="availability-actions">${[["AVAILABLE","Oui"],["MAYBE","Peut-être"],["UNAVAILABLE","Non"]].map(([value,label]) => `<button class="${mine === value ? "active" : ""}" data-availability="${option.id}" data-value="${value}" type="button">${label}</button>`).join("")}</div>${canManage && !option.is_selected && moment.status === "PLANNING" ? `<button class="confirm-option" data-confirm-option="${option.id}" type="button">Confirmer ce créneau</button>` : option.is_selected ? '<span class="confirmed-label">Créneau confirmé</span>' : ""}</article>`; }).join("")}</div></section>` : ""}
    <section class="detail-section"><div class="detail-title"><h3>Photos</h3><label class="memory-upload">Ajouter une photo<input id="momentPhoto" type="file" accept="image/png,image/jpeg,image/webp" /></label></div><div class="memory-gallery">${signedMedia.length ? signedMedia.map((media) => `<figure>${media.signed_url ? `<img src="${escapeHTML(media.signed_url)}" alt="${escapeHTML(media.caption || "Photo du Moment")}" />` : ""}${media.caption ? `<figcaption>${escapeHTML(media.caption)}</figcaption>` : ""}</figure>`).join("") : '<p class="memory-empty">Aucune photo pour l’instant.</p>'}</div></section>
    <section class="detail-section"><div class="detail-title"><h3>Activités liées</h3>${availableActivities.length ? `<select id="linkActivity"><option value="">Lier une activité HOME…</option>${availableActivities.map((activity) => `<option value="${activity.id}">${escapeHTML(sportLabel(activity.sport) || activity.activity_type || "Activité")} · ${escapeHTML(activity.activity_date || "Sans date")}</option>`).join("")}</select>` : ""}</div><div class="linked-activities">${(linksResult.data || []).length ? (linksResult.data || []).map((link) => activityMemoryCard(link.activities)).join("") : '<p class="memory-empty">Aucune activité liée.</p>'}</div></section>
    <section class="detail-section"><div class="detail-title"><h3>Encourager</h3></div><div class="reaction-picker">${emojis.map(([value,label]) => `<button class="${myReaction?.reaction_type === value ? "active" : ""}" data-reaction="${value}" type="button">${label}</button>`).join("")}</div><div class="preset-picker">${(presetsResult.data || []).map((preset) => `<button class="${myReaction?.preset_message_id === preset.id ? "active" : ""}" data-preset="${preset.id}" type="button">${escapeHTML(preset.label)}</button>`).join("")}</div>${myReaction ? '<button class="remove-reaction" id="removeReaction" type="button">Retirer ma réaction</button>' : ""}</section>
  </div>`;
  elements.momentDetail.querySelector(".detail-close")?.addEventListener("click", () => elements.momentDetailDialog.close());
  const statusLabel = elements.momentDetail.querySelector(".card-label");
  if (statusLabel) statusLabel.textContent = momentStatusLabel(moment.status);
  elements.momentDetail.querySelectorAll("[data-availability]").forEach((button) => button.addEventListener("click", () => saveAvailability(button.dataset.availability, button.dataset.value, moment.id)));
  elements.momentDetail.querySelectorAll("[data-confirm-option]").forEach((button) => button.addEventListener("click", () => confirmDateOption(moment, button.dataset.confirmOption)));
  elements.momentDetail.querySelectorAll("[data-answer-moment]").forEach((button) => button.addEventListener("click", () => answerMomentInvitation(moment.id, button.dataset.answerMoment)));
  document.getElementById("editMoment")?.addEventListener("click", () => { elements.momentDetailDialog.close(); openMomentForm(moment, { participantIds: participants.filter((participant) => participant.role !== "OWNER").map((participant) => participant.user_id) }); });
  document.getElementById("duplicateMoment")?.addEventListener("click", () => { elements.momentDetailDialog.close(); openMomentForm(moment, { duplicate: true, participantIds: participants.filter((participant) => participant.role !== "OWNER").map((participant) => participant.user_id) }); });
  document.getElementById("deleteMoment")?.addEventListener("click", () => deleteMoment(moment));
  document.getElementById("completeMoment")?.addEventListener("click", () => completeMoment(moment.id));
  document.getElementById("momentPhoto")?.addEventListener("change", (event) => addMomentPhoto(moment.id, event.target.files?.[0]));
  document.getElementById("linkActivity")?.addEventListener("change", (event) => linkMomentActivity(moment.id, event.target.value));
  elements.momentDetail.querySelectorAll("[data-reaction]").forEach((button) => button.addEventListener("click", () => saveReaction(moment.id, button.dataset.reaction, null)));
  elements.momentDetail.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => saveReaction(moment.id, "MESSAGE", button.dataset.preset)));
  document.getElementById("removeReaction")?.addEventListener("click", () => removeReaction(moment.id));
}

function activityMemoryCard(activity = {}) {
  const details = [activity.distance_km ? `${Number(activity.distance_km).toFixed(1)} km` : null, activity.duration_min ? (window.MomentumDuration?.format(activity.duration_min) || `${Math.round(activity.duration_min)} min`) : null, activity.elevation_m ? `${Math.round(activity.elevation_m)} m D+` : null].filter(Boolean).join(" · ");
  return `<article><strong>${escapeHTML(sportLabel(activity.sport) || activity.activity_type || "Activité")}</strong><span>${escapeHTML(activity.activity_date || "Sans date")}${details ? ` · ${escapeHTML(details)}` : ""}</span></article>`;
}

async function completeMoment(momentId) {
  const { error } = await window.momentumDB.from("moments").update({ status: "COMPLETED", updated_at: new Date().toISOString() }).eq("id", momentId);
  if (error) return setStatus(`Moment non terminé : ${error.message}`, true);
  elements.momentDetailDialog.close(); setStatus("Le Moment rejoint maintenant les souvenirs."); await loadTogether();
}

async function answerMomentInvitation(momentId, answer) {
  const values = answer === "ACCEPTED"
    ? { invitation_status: "ACCEPTED", participation_status: "REGISTERED", updated_at: new Date().toISOString() }
    : { invitation_status: "DECLINED", participation_status: "DECLINED", updated_at: new Date().toISOString() };
  const { error } = await window.momentumDB.from("moment_participants").update(values).eq("moment_id", momentId).eq("user_id", TOGETHER.user.id);
  if (error) return setStatus(`Réponse non enregistrée : ${error.message}`, true);
  elements.momentDetailDialog.close();
  setStatus(answer === "ACCEPTED" ? "Invitation acceptée." : "Invitation refusée.");
  await loadTogether();
}

async function deleteMoment(moment) {
  if (!window.confirm(`Supprimer définitivement « ${moment.title} » ? Les invitations et souvenirs liés seront également supprimés.`)) return;
  const { data: media } = await window.momentumDB.from("moment_media").select("file_path").eq("moment_id", moment.id);
  const { error } = await window.momentumDB.from("moments").delete().eq("id", moment.id);
  if (error) return setStatus(`Moment non supprimé : ${error.message}`, true);
  const paths = (media || []).map((item) => item.file_path).filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await window.momentumDB.storage.from("moment-media").remove(paths);
    if (storageError) console.warn("MOMENTUM: fichiers du Moment non nettoyés", storageError);
  }
  elements.momentDetailDialog.close();
  setStatus("Le Moment a été supprimé.");
  await loadTogether();
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

  const [momentsResult, clubsResult, circleResult, membershipsResult] = await Promise.all([
    window.momentumDB.from("moments").select("*, moment_participants(count), moment_date_options(*, moment_availability(*))").order("start_at", { ascending: true, nullsFirst: true }),
    window.momentumDB.from("clubs").select("*, club_members(count)").eq("status", "ACTIVE").order("created_at", { ascending: false }),
    window.momentumDB.rpc("get_circle_overview"),
    window.momentumDB.from("club_members").select("*").eq("user_id", TOGETHER.user.id),
  ]);

  const firstError = momentsResult.error || clubsResult.error || circleResult.error || membershipsResult.error;
  if (firstError) {
    console.error("TOGETHER:", firstError);
    setStatus(firstError.code === "42P01" || firstError.code === "PGRST205" ? "Le module est prêt. La migration Supabase TOGETHER doit encore être appliquée pour activer les données." : `Impossible de charger TOGETHER : ${firstError.message}`, true);
  } else setStatus("");

  TOGETHER.moments = momentsResult.data || [];
  TOGETHER.clubs = clubsResult.data || [];
  TOGETHER.circle = circleResult.data || { received: [], sent: [], members: [] };
  TOGETHER.relationships = (TOGETHER.circle.members || []).map((member) => ({
    requester_id: TOGETHER.user.id,
    recipient_id: member.user_id,
    status: "ACCEPTED",
  }));
  TOGETHER.clubMemberships = membershipsResult.data || [];

  const logoClubs = TOGETHER.clubs.filter((club) => club.logo_url);
  const signedLogos = await Promise.all(logoClubs.map(async (club) => {
    const { data } = await window.momentumDB.storage.from("club-logos").createSignedUrl(club.logo_url, 3600);
    return [club.id, data?.signedUrl || null];
  }));
  TOGETHER.logoUrls = new Map(signedLogos.filter(([, url]) => url));

  TOGETHER.passports = new Map((TOGETHER.circle.members || []).map((member) => [member.user_id, member]));
  renderClubOptions();
  renderMoments();
  renderCircle();

  const requestedMomentId = new URLSearchParams(window.location.search).get("moment");
  if (requestedMomentId) {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("moment");
    window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);

    if (TOGETHER.moments.some((moment) => moment.id === requestedMomentId)) {
      await openMomentDetail(requestedMomentId);
    } else {
      setStatus("Ce Moment n’est plus disponible ou tu n’y as pas accès.", true);
    }
  }
}

async function syncMomentParticipants(momentId, selectedIds) {
  const { data: existing, error: existingError } = await window.momentumDB.from("moment_participants").select("id,user_id,role,invitation_status").eq("moment_id", momentId);
  if (existingError) return existingError;
  const selected = new Set(selectedIds.filter((id) => id !== TOGETHER.user.id));
  const current = new Map((existing || []).map((participant) => [participant.user_id, participant]));
  const inserts = [...selected].filter((id) => !current.has(id)).map((userId) => ({ moment_id: momentId, user_id: userId, role: "PARTICIPANT", invitation_status: "PENDING", participation_status: "INVITED" }));
  if (inserts.length) {
    const { error } = await window.momentumDB.from("moment_participants").insert(inserts);
    if (error) return error;
  }
  for (const participant of existing || []) {
    if (participant.role === "OWNER") continue;
    const shouldInvite = selected.has(participant.user_id);
    if (shouldInvite && participant.invitation_status === "REMOVED") {
      const { error } = await window.momentumDB.from("moment_participants").update({ invitation_status: "PENDING", participation_status: "INVITED", updated_at: new Date().toISOString() }).eq("id", participant.id);
      if (error) return error;
    } else if (!shouldInvite && participant.invitation_status !== "REMOVED") {
      const { error } = await window.momentumDB.from("moment_participants").update({ invitation_status: "REMOVED", participation_status: "DECLINED", updated_at: new Date().toISOString() }).eq("id", participant.id);
      if (error) return error;
    }
  }
  return null;
}

async function createMoment(form) {
  const values = Object.fromEntries(new FormData(form));
  const editingId = values.moment_id || null;
  const proposedDates = [values.start_at, ...Array.from(form.querySelectorAll('[name="date_option"]')).map((input) => input.value)].filter(Boolean);
  const participantIds = new FormData(form).getAll("participant_ids");
  const payload = {
    user_id: TOGETHER.user.id,
    created_by: TOGETHER.user.id,
    club_id: values.visibility === "CLUB" ? values.club_id || null : null,
    title: values.title.trim(), description: values.description.trim() || null,
    moment_type: values.moment_type,
    start_at: proposedDates.length === 1 || editingId ? (proposedDates[0] ? new Date(proposedDates[0]).toISOString() : null) : null,
    location_name: values.location_name.trim() || null,
    capacity: values.capacity ? Number(values.capacity) : null,
    visibility: values.visibility === "CLUB" ? "PARTICIPANTS" : values.visibility,
  };
  if (editingId) {
    delete payload.user_id;
    delete payload.created_by;
    const { data, error } = await window.momentumDB.from("moments").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editingId).select().single();
    if (error) return setStatus(`Moment non modifié : ${error.message}`, true);
    const participantError = await syncMomentParticipants(data.id, participantIds);
    if (participantError) return setStatus(`Moment modifié, mais invitations incomplètes : ${participantError.message}`, true);
    form.reset(); elements.momentDialog.close(); setStatus("Le Moment a été modifié."); await loadTogether(); return;
  }
  payload.status = proposedDates.length === 1 ? "CONFIRMED" : "PLANNING";
  const { data, error } = await window.momentumDB.from("moments").insert(payload).select().single();
  if (error) return setStatus(`Moment non créé : ${error.message}`, true);
  const participantResult = await window.momentumDB.from("moment_participants").insert({ moment_id: data.id, user_id: TOGETHER.user.id, role: "OWNER", invitation_status: "ACCEPTED", participation_status: "REGISTERED" });
  if (participantResult.error) return setStatus(`Moment créé, mais organisateur non lié : ${participantResult.error.message}`, true);
  const inviteError = await syncMomentParticipants(data.id, participantIds);
  if (inviteError) return setStatus(`Moment créé, mais invitations incomplètes : ${inviteError.message}`, true);
  if (proposedDates.length) {
    const { error: optionsError } = await window.momentumDB.from("moment_date_options").insert(proposedDates.map((date, index) => ({ moment_id: data.id, start_at: new Date(date).toISOString(), location_name: payload.location_name, created_by: TOGETHER.user.id, is_selected: proposedDates.length === 1 && index === 0 })));
    if (optionsError) return setStatus(`Moment créé, mais créneaux non enregistrés : ${optionsError.message}`, true);
  }
  form.reset(); elements.momentDialog.close(); setStatus(participantIds.length ? "Le Moment a été créé et les invitations ont été envoyées." : "Le Moment a été créé."); await loadTogether();
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

async function answerCircleInvitation(id, answer, button) {
  button.disabled = true;
  const { error } = await window.momentumDB.rpc("answer_circle_invitation", { target_invitation: id, answer });
  if (error) {
    button.disabled = false;
    return setStatus(`Réponse non enregistrée : ${error.message}`, true);
  }
  setStatus(answer === "accept" ? "La personne fait maintenant partie de ton Cercle." : answer === "decline" ? "L’invitation a été refusée." : "L’invitation a été annulée.");
  await loadTogether();
}

async function endCircleConnection(userId, shouldBlock, button) {
  const message = shouldBlock
    ? "Bloquer cette personne ? Elle sera retirée du Cercle et ne pourra plus t’inviter."
    : "Retirer cette personne de ton Cercle ? Les Moments déjà vécus seront conservés.";
  if (!window.confirm(message)) return;
  button.disabled = true;
  const { error } = await window.momentumDB.rpc("end_circle_connection", { target_user: userId, should_block: shouldBlock });
  if (error) {
    button.disabled = false;
    return setStatus(`Action non enregistrée : ${error.message}`, true);
  }
  setStatus(shouldBlock ? "La personne a été bloquée et retirée du Cercle." : "La personne a été retirée du Cercle.");
  await loadTogether();
}

function renderCircleSearchResult(result) {
  if (!result?.available) {
    elements.circleSearchResult.innerHTML = '<div class="search-neutral" role="status"><strong>Aucune personne disponible pour cette invitation.</strong><span>Vérifie l’adresse saisie ou demande à ton proche de rendre son profil découvrable.</span></div>';
    return;
  }
  const labels = { connected: "Déjà dans ton Cercle", pending: "Invitation déjà en attente" };
  const canInvite = result.relationship_status === "available";
  elements.circleSearchResult.innerHTML = `<article class="search-person">
    ${circleIdentity(result)}
    <div><strong>${escapeHTML(result.display_name || "Membre MOMENTUM")}</strong><span>${escapeHTML(labels[result.relationship_status] || "Compte MOMENTUM trouvé")}</span></div>
    ${canInvite ? `<button class="together-primary compact" data-invite-circle="${result.user_id}" type="button">Envoyer l’invitation</button>` : ""}
  </article>`;
  elements.circleSearchResult.querySelector("[data-invite-circle]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const { data, error } = await window.momentumDB.rpc("send_circle_invitation", { target_user: button.dataset.inviteCircle });
    if (error) {
      button.disabled = false;
      return setStatus(`Invitation non envoyée : ${error.message}`, true);
    }
    if (data?.status === "connected") setStatus("Cette personne est déjà dans ton Cercle.");
    else if (data?.status === "pending") setStatus("Une invitation est déjà en attente.");
    else setStatus("Invitation envoyée.");
    elements.circleInviteDialog.close();
    elements.circleInviteForm.reset();
    elements.circleSearchResult.innerHTML = "";
    await loadTogether();
  });
}

async function searchCircleUser(form) {
  const email = new FormData(form).get("email")?.trim();
  elements.circleSearchResult.innerHTML = '<div class="search-loading" role="status">Recherche sécurisée…</div>';
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  const { data, error } = await window.momentumDB.rpc("search_circle_user", { target_email: email });
  submit.disabled = false;
  if (error) {
    elements.circleSearchResult.innerHTML = "";
    return setStatus(`Recherche impossible : ${error.message}`, true);
  }
  renderCircleSearchResult(data);
}

function setTogetherView(view) {
  TOGETHER.view = view;
  elements.tabs.forEach((item) => { const active = item.dataset.view === view; item.classList.toggle("active", active); item.setAttribute("aria-selected", String(active)); });
  elements.momentsView.hidden = view !== "moments";
  elements.circleView.hidden = view !== "circle";
  if (elements.primaryAction) elements.primaryAction.textContent = view === "moments" ? "Créer un Moment" : "Inviter dans mon Cercle";
  if (elements.primaryAction) elements.primaryAction.hidden = view === "circle" && elements.circleView.querySelector(".together-empty-state");
}

function openTogetherSection(section, updateHistory = true) {
  const valid = ["moments", "circle", "clubs", "invitations"];
  const next = valid.includes(section) ? section : "circle";
  TOGETHER.section = next;
  setTogetherView(next === "moments" ? "moments" : "circle");
  window.MomentumNavigation?.setSubsection(next);
  if (elements.primaryAction) {
    elements.primaryAction.hidden = false;
    elements.primaryAction.textContent = next === "moments" ? "Créer un Moment" : next === "clubs" ? "Créer un Club" : "Inviter dans mon Cercle";
  }
  if (updateHistory) window.history.replaceState({}, "", `together.html?view=${next}`);
  const targetId = next === "clubs" ? "togetherClubs" : next === "invitations" ? "togetherInvitations" : next === "circle" ? "togetherCircle" : null;
  if (targetId) window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

window.MomentumTogetherNavigation = { open: openTogetherSection };

function openCircleInviteForm() {
  elements.circleInviteForm.reset();
  elements.circleSearchResult.innerHTML = "";
  elements.circleInviteDialog.showModal();
  window.setTimeout(() => elements.circleInviteForm.elements.email.focus(), 0);
}

elements.tabs.forEach((tab) => tab.addEventListener("click", () => {
  openTogetherSection(tab.dataset.view);
}));
elements.primaryAction?.addEventListener("click", () => {
  if (TOGETHER.section === "moments") return openMomentForm();
  if (TOGETHER.section === "clubs") return openClubForm();
  openCircleInviteForm();
});
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
elements.momentVisibility?.addEventListener("change", syncMomentVisibility);
elements.momentForm?.addEventListener("submit", (event) => { event.preventDefault(); if (event.submitter?.value !== "cancel" && elements.momentForm.reportValidity()) createMoment(elements.momentForm); else elements.momentDialog.close(); });
elements.clubForm?.addEventListener("submit", (event) => { event.preventDefault(); if (event.submitter?.value !== "cancel" && elements.clubForm.reportValidity()) createClub(elements.clubForm); else elements.clubDialog.close(); });
elements.circleInviteForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") return elements.circleInviteDialog.close();
  if (elements.circleInviteForm.reportValidity()) searchCircleUser(elements.circleInviteForm);
});
document.getElementById("logoutBtn")?.addEventListener("click", async () => { await window.momentumDB.auth.signOut(); window.location.href = "login.html"; });

renderSportOptions();
loadTogether().then(() => openTogetherSection(new URLSearchParams(window.location.search).get("view") || "circle", false));
