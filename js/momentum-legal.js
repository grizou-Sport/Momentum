/* Public document versions are server-owned. Nothing is accepted in local storage. */
(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MomentumLegal = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  async function status(db, account = true) {
    const { data, error } = await db.rpc(account ? 'legal_account_status' : 'legal_public_status');
    if (error || !data || typeof data.enabled !== 'boolean') throw new Error('Informations juridiques indisponibles. Réessaie.');
    return data;
  }
  function documentPath(document) {
    if (!document || !/^legal\/versions\/[a-zA-Z0-9._-]+\.html$/.test(document.path) || !/^[a-f0-9]{64}$/.test(document.sha256)) throw new Error('Document indisponible.');
    return document.path;
  }
  async function verifyDocument(doc, fetchImpl = fetch, cryptoImpl = crypto) {
      const path = documentPath(doc);
      const response = await fetchImpl(path, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('Document indisponible. Réessaie.');
      const digest = await cryptoImpl.subtle.digest('SHA-256', await response.arrayBuffer());
      if (Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') !== doc.sha256) throw new Error('Les documents ont changé. Recharge la page avant de continuer.');
    return doc;
  }
  async function verifyDocuments(release, fetchImpl = fetch, cryptoImpl = crypto) {
    if (!release.enabled) throw new Error('Les inscriptions sont temporairement fermées.');
    for (const kind of ['terms', 'privacy']) await verifyDocument(release[kind], fetchImpl, cryptoImpl);
    return release;
  }
  async function accept(db, release) {
    if (!release?.enabled) throw new Error('Les inscriptions sont temporairement fermées.');
    const { data, error } = await db.rpc('accept_current_terms', {
      p_version: release.terms.version, p_sha256: release.terms.sha256,
      p_privacy_version: release.privacy.version, p_privacy_sha256: release.privacy.sha256
    });
    if (error || !data?.accepted) throw new Error(error?.code === '40001' ? 'Les documents ont changé. Recharge la page et consulte la nouvelle version.' : 'Acceptation non confirmée. Réessaie : aucun nouvel accord ne sera créé en double.');
    return data;
  }
  return Object.freeze({ status, documentPath, verifyDocument, verifyDocuments, accept });
});
