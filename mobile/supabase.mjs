import { createClient } from '@supabase/supabase-js';
// Email links finish on the existing website; the app signs in with email/password.
// Never accept an authentication session from a URL inside the native WebView.
window.supabase = {
  createClient: (url, key, options = {}) => createClient(url, key, {
    ...options,
    auth: { ...options.auth, flowType: 'implicit', detectSessionInUrl: false }
  })
};
