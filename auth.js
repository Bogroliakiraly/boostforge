/* Shared Supabase auth helper for the BoostForge site.
 *
 * Loads after the supabase-js UMD bundle (which exposes a global `supabase`)
 * and after config.js. Exposes `window.bfAuth` with a tiny promise-based API
 * used by account.html. Degrades gracefully when the project isn't configured.
 */
(function () {
  const cfg = window.BF_CONFIG || {};
  const configured = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  let client = null;
  if (configured && window.supabase && typeof window.supabase.createClient === "function") {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  window.bfAuth = {
    configured: Boolean(client),

    async user() {
      if (!client) return null;
      const { data } = await client.auth.getUser();
      return data.user || null;
    },

    async signUp(email, password) {
      if (!client) throw new Error("Accounts are not available yet.");
      const { data, error } = await client.auth.signUp({
        email: String(email).trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      return { needsConfirmation: !data.session };
    },

    async signIn(email, password) {
      if (!client) throw new Error("Accounts are not available yet.");
      const { error } = await client.auth.signInWithPassword({
        email: String(email).trim().toLowerCase(),
        password,
      });
      if (error) throw error;
    },

    async signOut() {
      if (client) await client.auth.signOut();
    },

    /** Newest active (non-revoked, unexpired) license for the signed-in user. */
    async activeLicense() {
      if (!client) return null;
      const { data: u } = await client.auth.getUser();
      const email = u.user && u.user.email;
      if (!email) return null;
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await client
        .from("licenses")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("revoked", false)
        .gte("expires", today)
        .order("expires", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data && data[0]) || null;
    },
  };
})();
