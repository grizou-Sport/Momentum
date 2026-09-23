const authForm = document.getElementById("authForm");
const recoveryForm = document.getElementById("recoveryForm");
const newPasswordForm = document.getElementById("newPasswordForm");
const authTabs = document.getElementById("authTabs");
const signupFields = document.getElementById("signupFields");
const forgotBtn = document.getElementById("forgotBtn");
const submitBtn = document.getElementById("submitBtn");
const authTitle = document.getElementById("authTitle");
const authLead = document.getElementById("authLead");
let authMode = "login";
let recoveringPassword = false;
let signupRelease = null;
let submitting = false;
let signupSession = null;
async function loadSignupLegal() {
  const output = document.getElementById('signupLegalStatus');
  signupRelease = null; output.hidden = false; output.textContent = 'Chargement des conditions…';
  try {
    const release = await window.MomentumLegal.status(momentumDB, false);
    await window.MomentumLegal.verifyDocuments(release);
    signupRelease = release;
    document.getElementById('signupTermsLink').href = window.MomentumLegal.documentPath(release.terms);
    document.getElementById('signupTermsVersion').textContent = `(version ${release.terms.version}, ${new Date(release.terms.effective_at).toLocaleDateString('fr-CH')})`;
    output.textContent = 'Après confirmation de ton e-mail, confirme les conditions dans ton espace sécurisé pour finaliser ton compte.';
  } catch (error) { output.textContent = error.message; }
}

function appUrl(path) {
  return new URL(path, window.location.href).href;
}

function setMessage(element, message = "", type = "") {
  element.textContent = message;
  element.className = `login-message${type ? ` is-${type}` : ""}`;
}

function friendlyAuthError(error) {
  const value = String(error?.message || "").toLowerCase();
  if (value.includes("invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (value.includes("email not confirmed")) return "Confirme d'abord ton adresse depuis l'e-mail reçu.";
  if (value.includes("already registered") || value.includes("already been registered")) return "Un compte existe déjà avec cette adresse.";
  if (value.includes("password should be")) return "Choisis un mot de passe d'au moins 8 caractères.";
  if (value.includes("rate limit")) return "Trop de tentatives. Attends un instant avant de réessayer.";
  return "Connexion momentanément indisponible. Réessaie dans un instant.";
}

function callbackErrorMessage() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const code = query.get("error_code") || hash.get("error_code");
  const description = query.get("error_description") || hash.get("error_description");
  if (!code && !description) return "";
  if (code === "otp_expired") return "Ce lien a expiré. Demande un nouvel e-mail pour reprendre ton aventure.";
  return "Ce lien n'est plus valide. Demande un nouvel e-mail puis réessaie.";
}

async function destinationForUser(user) {
  if (!user) throw new Error("Session indisponible.");
  const legal = await window.MomentumLegal.status(momentumDB);
  if (!legal.enabled || !legal.accepted) return 'privacy-center.html?returnTo=' + encodeURIComponent(window.MomentumAccess.safeReturn(new URLSearchParams(location.search).get('returnTo'), location.origin));
  const { data, error } = await momentumDB.from("passports").select("personalization").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  const target = window.MomentumAccess.safeReturn(new URLSearchParams(location.search).get("returnTo"), location.origin);
  return window.MomentumAccess.complete(data) ? target : `welcome.html?returnTo=${encodeURIComponent(target)}`;
}

async function redirectIfLoggedIn() {
  const { data } = await momentumDB.auth.getSession();
  if (data.session && !recoveringPassword) {
    window.location.replace(await destinationForUser(data.session.user));
  }
}

function showMode(mode) {
  if (submitting) return;
  authMode = mode;
  if (mode === 'signup') loadSignupLegal();
  else document.getElementById('signupLegalStatus').hidden = true;
  authForm.hidden = false;
  recoveryForm.hidden = true;
  newPasswordForm.hidden = true;
  authTabs.hidden = false;
  signupFields.hidden = mode !== "signup";
  forgotBtn.hidden = mode !== "login";
  submitBtn.textContent = mode === "signup" ? "Créer mon espace" : "Continuer";
  authTitle.innerHTML = mode === "signup" ? "Prépare ton<br />aventure." : "Heureux de<br />te revoir.";
  authLead.textContent = mode === "signup"
    ? "Trente secondes maintenant. Un compagnon d'aventure qui apprend à te connaître ensuite."
    : "Retrouve ton histoire, tes horizons et tout ce que tu construis.";
  authForm.password.autocomplete = mode === "signup" ? "new-password" : "current-password";
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    const selected = button.dataset.authMode === mode;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  authForm.setAttribute("aria-labelledby", mode === "signup" ? "signupTab" : "loginTab");
  setMessage(document.getElementById("authMessage"));
}

function showRecovery() {
  if (submitting) return;
  authForm.hidden = true;
  recoveryForm.hidden = false;
  newPasswordForm.hidden = true;
  authTabs.hidden = true;
  authTitle.innerHTML = "Retrouve ton<br />chemin.";
  authLead.textContent = "Nous t'envoyons un lien sécurisé pour choisir un nouveau mot de passe.";
  recoveryForm.email.value = authForm.email.value;
  recoveryForm.email.focus();
}

function showNewPassword() {
  recoveringPassword = true;
  authForm.hidden = true;
  recoveryForm.hidden = true;
  newPasswordForm.hidden = false;
  authTabs.hidden = true;
  authTitle.innerHTML = "Un nouveau<br />départ.";
  authLead.textContent = "Choisis un nouveau mot de passe pour reprendre ton aventure.";
  document.getElementById("newPassword").focus();
}

document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => showMode(button.dataset.authMode)));
authTabs.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const tabs = [...authTabs.querySelectorAll('[role="tab"]')];
  const current = tabs.indexOf(document.activeElement);
  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();
  showMode(tabs[next].dataset.authMode);
});
document.querySelectorAll("[data-back-login]").forEach((button) => button.addEventListener("click", () => showMode("login")));
document.querySelectorAll("[data-password-toggle]").forEach((button) => button.addEventListener("click", () => {
  const input = document.getElementById(button.dataset.passwordToggle);
  input.type = input.type === "password" ? "text" : "password";
  button.textContent = input.type === "password" ? "Voir" : "Cacher";
}));
forgotBtn.addEventListener("click", showRecovery);

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting) return;
  const message = document.getElementById("authMessage");
  const email = authForm.email.value.trim();
  const password = authForm.password.value;
  const confirmation = authForm.confirmPassword.value;

  if (!email || !authForm.email.validity.valid) return setMessage(message, "Entre une adresse e-mail valide.", "error");
  if (password.length < 8) return setMessage(message, "Choisis un mot de passe d'au moins 8 caractères.", "error");
  if (authMode === "signup" && password !== confirmation) return setMessage(message, "Les deux mots de passe ne correspondent pas.", "error");
  if (authMode === "signup" && !authForm.terms.checked) return setMessage(message, "Ton accord est nécessaire pour créer ton espace.", "error");

  if (authMode === 'signup' && !signupRelease) return setMessage(message, 'Les inscriptions sont temporairement fermées tant que les documents ne sont pas disponibles.', 'error');
  if (authMode === 'signup' && signupSession && signupSession.user.email?.toLowerCase() !== email.toLowerCase()) return setMessage(message, 'Ton premier compte a déjà été créé. Reprends avec son adresse e-mail pour finaliser les conditions.', 'error');
  const submittedMode = authMode, submittedRelease = signupRelease;
  submitting = true;
  submitBtn.disabled = true;
  setMessage(message, authMode === "signup" ? "Création de ton espace…" : "Ouverture de ton espace…");
  try {
    const result = signupSession && submittedMode === "signup" ? { data: signupSession } : submittedMode === "signup"
      ? await momentumDB.auth.signUp({ email, password, options: { emailRedirectTo: appUrl("welcome.html") } })
      : await momentumDB.auth.signInWithPassword({ email, password });
    if (result.error) return setMessage(message, friendlyAuthError(result.error), "error");

    if (submittedMode === "signup" && !result.data.session) {
      authForm.reset();
      authTitle.innerHTML = "Regarde ta<br />boîte mail.";
      authLead.textContent = "Clique sur le lien envoyé pour valider ton compte. Ton Passeport t'attendra juste après.";
      authForm.hidden = true;
      authTabs.hidden = true;
      return;
    }

    if (submittedMode === 'signup') {
      signupSession = result.data;
      await window.MomentumLegal.accept(momentumDB, submittedRelease);
    }
    window.location.replace(await destinationForUser(result.data.user || result.data.session.user));
  } catch (error) {
    setMessage(message, signupSession ? error.message : friendlyAuthError(error), "error");
  } finally {
    submitting = false;
    submitBtn.disabled = false;
  }
});

recoveryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.getElementById("recoveryMessage");
  const email = recoveryForm.email.value.trim();
  if (!email || !recoveryForm.email.validity.valid) return setMessage(message, "Entre une adresse e-mail valide.", "error");
  const button = recoveryForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage(message, "Envoi du lien sécurisé…");
  try {
    const { error } = await momentumDB.auth.resetPasswordForEmail(email, { redirectTo: appUrl("login.html?recovery=1") });
    setMessage(message, error ? friendlyAuthError(error) : "Lien envoyé. Consulte ta boîte mail.", error ? "error" : "success");
  } catch (error) {
    setMessage(message, friendlyAuthError(error), "error");
  } finally {
    button.disabled = false;
  }
});

newPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.getElementById("newPasswordMessage");
  const password = newPasswordForm.password.value;
  if (password.length < 8) return setMessage(message, "Choisis au moins 8 caractères.", "error");
  if (password !== newPasswordForm.confirmPassword.value) return setMessage(message, "Les deux mots de passe ne correspondent pas.", "error");
  const button = newPasswordForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage(message, "Mise à jour…");
  let passwordUpdated = false;
  try {
    const { error } = await momentumDB.auth.updateUser({ password });
    if (error) return setMessage(message, friendlyAuthError(error), "error");
    passwordUpdated = true;
    const { data, error: userError } = await momentumDB.auth.getUser();
    if (userError) throw userError;
    const destination = await destinationForUser(data.user);
    setMessage(message, "Mot de passe mis à jour. Ton espace s'ouvre…", "success");
    setTimeout(() => window.location.replace(destination), 650);
  } catch (error) {
    if (passwordUpdated) {
      recoveringPassword = false;
      showMode("login");
      setMessage(document.getElementById("authMessage"), "Ton mot de passe est mis à jour. Ton espace est momentanément indisponible ; utilise ton nouveau mot de passe pour réessayer avec Continuer.", "error");
    } else setMessage(message, friendlyAuthError(error), "error");
  } finally {
    button.disabled = false;
  }
});

momentumDB.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") showNewPassword();
});

if (new URLSearchParams(window.location.search).get("recovery") === "1") recoveringPassword = true;
const callbackMessage = callbackErrorMessage();
if (callbackMessage) setMessage(document.getElementById("authMessage"), callbackMessage, "error");
redirectIfLoggedIn().catch(() => setMessage(document.getElementById("authMessage"), "Impossible de charger ton espace pour le moment. Réessaie avec Continuer.", "error"));

if (new URLSearchParams(location.search).get("mode") === "signup" && !recoveringPassword) showMode("signup");
