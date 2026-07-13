document.documentElement.style.visibility = "hidden";

async function protectPage() {
  if (!window.momentumDB) {
    window.location.replace("login.html");
    return null;
  }

  const { data, error } = await window.momentumDB.auth.getUser();
  if (error || !data.user) {
    await window.momentumDB.auth.signOut({ scope: "local" });
    window.location.replace("login.html");
    return null;
  }

  const { data: passport, error: passportError } = await window.momentumDB
    .from("passports")
    .select("personalization")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (passportError || !passport?.personalization?.onboarding_completed) {
    window.location.replace("welcome.html");
    return null;
  }

  document.documentElement.style.visibility = "visible";
  return data.user;
}

window.momentumPageReady = protectPage();
