async function protectMomentum() {
  if (!window.momentumDB) return window.location.replace("login.html");
  const { data, error } = await window.momentumDB.auth.getUser();
  if (error || !data.user) return window.location.replace("login.html");
  const legal = await window.momentumDB.rpc('legal_account_status');
  if (legal.error || !legal.data?.enabled || !legal.data?.accepted) return window.location.replace('privacy-center.html');
  const { data: passport } = await window.momentumDB.from("passports").select("personalization").eq("user_id", data.user.id).maybeSingle();
  if (!passport?.personalization?.onboarding_completed) window.location.replace("welcome.html");
}

protectMomentum();
