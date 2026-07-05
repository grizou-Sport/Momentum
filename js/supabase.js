const SUPABASE_URL = "https://njcqcpyiiibudlalnzoa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_seh3MhAWh4Ov0DWYtAeH1w_TKHMCb5f";

  window.momentumDB = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
