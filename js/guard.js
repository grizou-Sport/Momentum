async function protectPage() {
  if (!window.momentumDB) {
    console.error("GUARD: momentumDB introuvable");
    window.location.href = "login.html";
    return;
  }

  const { data, error } = await window.momentumDB.auth.getSession();

  if (error || !data.session) {
    window.location.href = "login.html";
    return;
  }
}

protectPage();