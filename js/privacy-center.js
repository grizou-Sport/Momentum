(function () {
  'use strict';
  const status = document.getElementById('privacyStatus'), form = document.getElementById('legalAcceptance');
  const account = document.getElementById('privacyAccount'), history = document.getElementById('legalHistory');
  let release = null, busy = false, exportController = null, owner = null, generation = 0;
  async function initialize() {
    const request = ++generation;
    release = null; account.hidden = true; history.replaceChildren();
    document.getElementById('legalContinue').hidden = true;
    document.getElementById('privacyCurrentNotice').hidden = true;
    form.hidden = true; status.textContent = 'Vérification de ta session…';
    try {
      const { data, error } = await window.momentumDB.auth.getUser();
      if (request !== generation) return;
      if (error || !data.user) throw new Error('Connecte-toi pour consulter ton historique, exporter tes données ou supprimer ton compte.');
      owner = data.user.id;
      account.hidden = false; // Rights remain available even when the legal service fails.
      const current = await window.MomentumLegal.status(window.momentumDB);
      if (request !== generation) return;
      release = current;
      history.replaceChildren();
      for (const item of release.history || []) {
        const row = document.createElement('li');
        row.textContent = `${item.event_type === 'terms_accept' ? 'Conditions acceptées' : 'Information confidentialité présentée'} · ${item.version} · ${new Date(item.occurred_at).toLocaleString('fr-CH')} · SHA-256 ${item.document_sha256}`;
        const link = document.createElement('a'); link.href = window.MomentumLegal.documentPath({ ...item, sha256: item.document_sha256 });
        link.textContent = 'Consulter cette version'; link.target = '_blank'; link.rel = 'noopener';
        row.append(document.createTextNode(' · '), link);
        history.append(row);
      }
      if (!release.enabled) { status.textContent = 'L’accès au service est temporairement suspendu. Tu peux exporter tes données ou demander la suppression de ton compte.'; return; }
      await window.MomentumLegal.verifyDocuments(release);
      if (request !== generation) return;
      const terms = document.getElementById('currentTerms'), privacy = document.getElementById('currentPrivacy');
      terms.href = window.MomentumLegal.documentPath(release.terms);
      terms.textContent = `Conditions générales d’utilisation (version ${release.terms.version}, ${new Date(release.terms.effective_at).toLocaleDateString('fr-CH')})`;
      privacy.href = window.MomentumLegal.documentPath(release.privacy);
      form.hidden = release.accepted;
      document.getElementById('legalContinue').hidden = !release.accepted;
      const updated = !(release.history || []).some(item => item.event_type === 'notice_delivered' && item.version === release.privacy.version);
      status.textContent = release.accepted ? (updated ? 'Tes conditions sont à jour. La politique de confidentialité a été mise à jour : consulte les informations ci-dessous. Aucune nouvelle acceptation des conditions n’est demandée.' : 'Tes conditions sont à jour.') : 'Consulte les conditions pour continuer. Tu peux les refuser et conserver l’accès à tes démarches ci-dessous.';
      const policy = document.getElementById('privacyCurrentNotice'); policy.hidden = false;
      policy.href = window.MomentumLegal.documentPath(release.privacy); policy.textContent = `Politique de confidentialité en vigueur · version ${release.privacy.version}`;
    } catch (error) { if (request === generation) status.textContent = error.message || 'Vérification interrompue. Réessaie.'; }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !form.reportValidity()) return;
    busy = true; form.inert = true;
    try {
      await window.MomentumLegal.accept(window.momentumDB, release);
      location.replace('login.html?returnTo=' + encodeURIComponent(window.MomentumAccess.safeReturn(new URLSearchParams(location.search).get('returnTo'), location.origin)));
    } catch (error) { status.textContent = error.message; }
    finally { busy = false; form.inert = false; }
  });
  document.getElementById('privacyRetry').onclick = initialize;
  document.getElementById('privacyDelete').onclick = () => window.MomentumAccountDeletion.open();
  document.getElementById('privacyExport').onclick = async () => {
    if (exportController) return;
    const controller = new AbortController(), exportOwner = owner; exportController = controller;
    const output = document.getElementById('privacyExportStatus'), button = document.getElementById('privacyExport');
    const cancel = document.getElementById('privacyExportCancel'); button.disabled = true; cancel.hidden = false;
    output.textContent = 'Préparation de tes données…';
    try {
      const result = await window.MomentumExport.collect(window.momentumDB, { withFiles: document.getElementById('privacyExportFiles').checked, signal: controller.signal });
      if (!controller.signal.aborted && owner === exportOwner) { window.MomentumExport.download(result); output.textContent = 'Export complet téléchargé. Les fichiers sont fournis sous forme de liens temporaires si tu as choisi cette option.'; }
    } catch (_) { output.textContent = controller.signal.aborted ? 'Export annulé.' : 'Export interrompu. Aucun export complet annoncé. Tu peux réessayer.'; }
    finally { exportController = null; button.disabled = false; cancel.hidden = true; }
  };
  document.getElementById('privacyExportCancel').onclick = () => exportController?.abort();
  document.getElementById('privacyLogout').onclick = async () => {
    const result = await window.momentumDB.auth.signOut({ scope: 'local' });
    if (result.error) status.textContent = 'Déconnexion interrompue. Réessaie.';
    else location.replace('login.html');
  };
  window.momentumDB.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || owner && session?.user?.id && owner !== session.user.id) {
      generation++;
      exportController?.abort(); history.replaceChildren(); form.hidden = true; account.hidden = true; release = null; owner = null;
      document.getElementById('legalContinue').hidden = true;
      document.getElementById('privacyCurrentNotice').hidden = true;
      status.textContent = 'La session a changé. Recharge cette page pour continuer.';
    }
  });
  window.addEventListener('pagehide', () => exportController?.abort());
  initialize();
})();
