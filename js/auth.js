const authForm = document.getElementById("authForm");
const authMessage = document.getElementById("authMessage");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");

async function redirectIfLoggedIn() {
  const { data } = await momentumDB.auth.getSession();

  if (data.session) {
    window.location.href = "index.html";
  }
}

redirectIfLoggedIn();

function getAuthValues() {
  const formData = new FormData(authForm);

  return {
    displayName: formData.get("displayName")?.trim(),
    email: formData.get("email")?.trim(),
    password: formData.get("password"),
  };
}

signupBtn.addEventListener("click", async () => {
  const { displayName, email, password } = getAuthValues();

  authMessage.textContent = "Création du compte...";

  const { data, error } = await momentumDB.auth.signUp({
    email,
    password,
    options: {emailRedirectTo: "https://momentum-alpha-rho.vercel.app/you.html",
      data: {
        display_name: displayName || email.split("@")[0],
      },
    },
  });

  if (error) {
    authMessage.textContent = error.message;
    return;
  }

  if (data.session) {
    window.location.href = "you.html";
    return;
  }

  authMessage.textContent = "Compte créé. Vérifie ton e-mail puis connecte-toi.";
});

loginBtn.addEventListener("click", async () => {
  const { email, password } = getAuthValues();

  authMessage.textContent = "Connexion...";

  const { error } = await momentumDB.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    authMessage.textContent = error.message;
    return;
  }

  window.location.href = "index.html";
});
