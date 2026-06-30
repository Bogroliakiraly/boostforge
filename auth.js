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

    /** Starts the GitHub OAuth flow (used for the owner-only support admin). */
    async signInWithGitHub(redirectTo) {
      if (!client) throw new Error("Accounts are not available yet.");
      const { error } = await client.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: redirectTo || window.location.href },
      });
      if (error) throw error;
    },

    /** True if the signed-in user is the configured admin GitHub account. */
    async isAdmin() {
      const u = await this.user();
      const login = u && u.user_metadata && (u.user_metadata.user_name || u.user_metadata.preferred_username);
      return Boolean(login && login === (cfg.ADMIN_GITHUB_LOGIN || ""));
    },

    /** Submit a support message (any signed-in user). */
    async sendSupport(message) {
      if (!client) throw new Error("Accounts are not available yet.");
      const u = await this.user();
      if (!u) throw new Error("Please sign in first.");
      const { error } = await client.from("support_messages").insert({
        message: String(message),
        email: u.email || null,
        user_id: u.id,
      });
      if (error) throw error;
    },

    /** Admin-only: list all support messages (RLS returns rows only to admin). */
    async listSupport() {
      if (!client) return [];
      const { data, error } = await client
        .from("support_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    /** Admin-only: mark a message handled / unhandled. */
    async setHandled(id, handled) {
      if (!client) return;
      const { error } = await client
        .from("support_messages")
        .update({ handled: Boolean(handled) })
        .eq("id", id);
      if (error) throw error;
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
