async function protectPage() {
  const { data } = await momentumDB.auth.getSession();

  if (!data.session) {
    window.location.href = "login.html";
  }
}

protectPage();
