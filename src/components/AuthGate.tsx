import { useState } from "react";
import { LogIn, UserPlus, Mail, Zap } from "lucide-react";
import { useAuth } from "../store/useAuth";
import { isSupabaseConfigured } from "../lib/supabase";
import { toast } from "../store/useToast";
import { useT } from "../i18n";

/**
 * Full-screen sign-in prompt shown right at startup — registering or signing
 * in is required to use BoostForge. Supabase persists the session through
 * Tauri's own Store plugin (see lib/supabase.ts), so once signed in this
 * never reappears on later launches. Renders nothing when Supabase isn't
 * configured (should not happen in production, but keeps local dev usable).
 */
export function AuthGate() {
  const { t } = useT();
  const auth = useAuth();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const visible = isSupabaseConfigured && auth.ready && !auth.user;
  if (!visible) return null;

  async function submit() {
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      if (mode === "signUp") {
        const { needsConfirmation } = await auth.signUp(email, password);
        if (needsConfirmation) {
          toast.success(t("auth.signedUpTitle"), t("auth.signedUpMsg"));
          setMode("signIn");
          return;
        }
      } else {
        await auth.signIn(email, password);
      }
      setPassword("");
    } catch (e) {
      toast.error(t("common.error"), String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-bg-base p-6">
      <div className="w-full max-w-sm card p-6">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/15">
            <Zap className="h-6 w-6 text-accent" />
          </div>
          <h2 className="text-lg font-semibold">{t("auth.title")}</h2>
          <p className="text-sm text-text-secondary">{t("auth.subtitle")}</p>
        </div>

        <div className="mb-3 flex gap-1 rounded-xl border border-border-subtle p-1 text-sm">
          <button
            className={`flex-1 rounded-lg px-3 py-1.5 transition-colors ${
              mode === "signIn" ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-bg-hover"
            }`}
            onClick={() => setMode("signIn")}
          >
            {t("auth.tabSignIn")}
          </button>
          <button
            className={`flex-1 rounded-lg px-3 py-1.5 transition-colors ${
              mode === "signUp" ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-bg-hover"
            }`}
            onClick={() => setMode("signUp")}
          >
            {t("auth.tabSignUp")}
          </button>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.email")}
              className="selectable w-full rounded-xl border border-border-subtle bg-bg-elevated py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("auth.password")}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="selectable w-full rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            className="btn-primary w-full justify-center"
            onClick={submit}
            disabled={busy || !email.trim() || !password}
          >
            {mode === "signUp" ? (
              <><UserPlus className="h-4 w-4" /> {t("auth.signUp")}</>
            ) : (
              <><LogIn className="h-4 w-4" /> {t("auth.signIn")}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
