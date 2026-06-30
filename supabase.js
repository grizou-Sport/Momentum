const SUPABASE_URL = "sb_publishable_seh3MhAWh4Ov0DWYtAeH1w_TKHMCb5f";
const SUPABASE_ANON_KEY = "sb_secret_AsdaENC-c8a1YhjdaM8Qaw_xDj5iOkfY";

window.momentumDB = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("Supabase chargé :", window.momentumDB);