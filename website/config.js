/* Public BoostForge site config.
 *
 * Fill these in after creating your Supabase project (Project Settings → API).
 * The anon key is a PUBLIC key and is safe to commit / ship in the browser.
 * Leaving them blank keeps the site working as a plain marketing page (the
 * account area will explain that sign-up isn't available yet).
 */
window.BF_CONFIG = {
  SUPABASE_URL: "https://unpaishxbfrtbkkxrcxq.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_M2RB1FF5KwFP7DoKwgkCDA_RuXNDfEm", // publishable (public) key
  DOWNLOAD_URL: "download/BoostForge-Setup.exe", // direct download, hosted on the site
  // Only this account (email+password) may open the support admin inbox (also
  // enforced by RLS in supabase/support.sql, so it's not just a UI check).
  ADMIN_EMAIL: "miujdonsagok@gmail.com",
};
