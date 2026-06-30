console.log("GUARD: fichier chargé");

async function protectPage() {
  console.log("GUARD: protectPage démarre");

  if (!window.momentumDB) {
    console.error("GUARD: momentumDB introuvable");
    alert("Erreur: Supabase n'est pas chargé");
    return;
  }

  const { data, error } = await momentumDB.auth.getSession();

  console.log("GUARD: session", data.session);
  console.log("GUARD: error", error);

  if (error || !data.session) {
    console.log("GUARD: redirection login");
    window.location.href = "login.html";
    return;
  }

  console.log("GUARD: utilisateur connecté");
}

protectPage();