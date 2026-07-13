async function protectMomentum() {
  if (!window.momentumDB) return window.location.replace("login.html");
  const { data, error } = await window.momentumDB.auth.getUser();
  if (error || !data.user) return window.location.replace("login.html");
  const { data: passport } = await window.momentumDB.from("passports").select("personalization").eq("user_id", data.user.id).maybeSingle();
  if (!passport?.personalization?.onboarding_completed) window.location.replace("welcome.html");
}

protectMomentum();
