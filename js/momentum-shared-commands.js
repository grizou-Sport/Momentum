(function (root) {
  'use strict';
  function publicError(error) {
    const messages = {
      '40001':'Le Moment ou ses réponses ont changé. Recharge-le avant de réessayer.',
      '42501':'Ce Moment, ce lieu ou un participant n’est plus accessible pour cette action.',
      '23514':'Vérifie les valeurs saisies. La capacité doit conserver les places déjà confirmées.',
      '23505':'Cet enregistrement existe déjà. Recharge le Moment.',
    };
    const allowed = new Set([
      'Un créneau ayant reçu des réponses doit être conservé.',
      'Ce créneau a reçu des réponses. Conserve-le et propose une nouvelle date.'
    ]);
    if (error.code === '22023' && allowed.has(error.message)) return error.message;
    return messages[error.code] || 'Enregistrement refusé. Vérifie le titre, les dates et les participants avant de réessayer.';
  }
  // Keep the exact request after a lost response. A retry must never create a second Moment.
  function request(rpc, action, data, revision = null, operationId = crypto.randomUUID(), timeoutMs = 15000) {
    const args = JSON.parse(JSON.stringify({p_operation_id:operationId,p_data:data,p_expected_revision:revision}));
    const method = action === 'save' ? 'save_shared_moment' : 'shared_moment_action';
    if (action !== 'save') args.p_action = action;
    let running = null, settled = null;
    return Object.freeze({
      operationId,
      run() {
        if (settled) return Promise.resolve(settled);
        if (running) return running;
        running = (async () => {
          let timer;
          try {
            const reply = await Promise.race([
              Promise.resolve().then(() => rpc(method, JSON.parse(JSON.stringify(args)))),
              new Promise((_, reject) => {timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);})
            ]);
            if (!reply.error && reply.data?.id) {
              settled = {ok:true, data:reply.data};
              return settled;
            }
            const error = reply.error || {};
            const definitive = /^(?:(?:22|23|40|42|55)[A-Z0-9]{3}|PGRST\d+)$/.test(error.code || '');
            const failure = {ok:false, uncertain:!definitive, conflict:error.code === '40001', message:definitive ? publicError(error) : 'La réponse manque. Réessaie pour vérifier le même enregistrement.'};
            if (definitive) settled = failure;
            return failure;
          } catch {
            return {ok:false, uncertain:true, message:'La connexion a été interrompue. Réessaie pour vérifier le même enregistrement.'};
          } finally { clearTimeout(timer); running = null; }
        })();
        return running;
      }
    });
  }
  const api = Object.freeze({request});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MomentumSharedCommands = api;
})(typeof window === 'object' ? window : globalThis);
