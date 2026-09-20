export const webOrigin = 'https://momentum-alpha-rho.vercel.app';
const emailDestinations = new Set(['welcome.html', 'login.html?recovery=1']);

// Email verification and password recovery keep the existing HTTPS destinations.
// The owner chose to leave Supabase's redirect allowlist unchanged.
export function authRedirect(path) {
  if (!emailDestinations.has(path)) throw new Error('Invalid auth destination');
  return new URL(path, webOrigin + '/').href;
}

// Native HTTP is used only for the existing location endpoint, whose web API is same-origin.
export function locationsFetch(http, parameters, options = {}) {
  const signal = options.signal;
  signal?.throwIfAborted();
  return http.get({ url: `${webOrigin}/api/locations?${parameters}`, headers: { Accept: 'application/json' }, connectTimeout: 10000, readTimeout: 10000, responseType: 'json' }).then(result => {
    signal?.throwIfAborted();
    return { ok: result.status >= 200 && result.status < 300, status: result.status, json: async () => result.data };
  });
}
