import { useState } from "react";
import { ShieldHalf, KeyRound, Copy, Check, ChevronDown, Sparkles } from "lucide-react";
import { Card, Spinner } from "./ui";
import { isSupabaseConfigured, issueLicense, type IssuedLicense } from "../lib/supabase";
import { activateLicense } from "../lib/api";
import { useLicense } from "../store/useLicense";
import { toast } from "../store/useToast";
import { useT } from "../i18n";

const TOKEN_STORAGE_KEY = "bf.admin.token";

/**
 * Vendor-only panel for minting Pro license keys. Collapsed by default and
 * unlocked by pasting the admin token (matched server-side by the
 * `issue-license` edge function — the signing key itself never ships here).
 * The token is remembered locally so it only has to be entered once.
 */
export function AdminPanel() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) ?? "");
  const [email, setEmail] = useState("");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<IssuedLicense | null>(null);
  const [copied, setCopied] = useState(false);
  const [activating, setActivating] = useState(false);
  const license = useLicense();

  if (!isSupabaseConfigured) return null;

  async function activateHere() {
    if (!issued) return;
    setActivating(true);
    try {
      const status = await activateLicense(issued.key);
      license.set(status);
      toast.success(t("license.activated"));
    } catch (e) {
      toast.error(t("common.error"), String(e instanceof Error ? e.message : e));
    } finally {
      setActivating(false);
    }
  }

  async function generate() {
    if (!token.trim() || !email.trim() || days < 1) return;
    setBusy(true);
    setIssued(null);
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
      const result = await issueLicense({
        email: email.trim(),
        days,
        tier: "pro",
        adminToken: token.trim(),
      });
      setIssued(result);
      toast.success(t("admin.generatedTitle"), t("admin.generatedMsg", { email: result.email, n: result.days }));
    } catch (e) {
      toast.error(t("common.error"), String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable; the key is still selectable below */
    }
  }

  return (
    <Card>
      <button
        className="flex w-full items-center gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-warn/15 text-warn">
          <ShieldHalf className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{t("admin.title")}</h3>
          <p className="text-xs text-text-secondary">{t("admin.subtitle")}</p>
        </div>
        <ChevronDown className={`h-5 w-5 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t("admin.token")}
              className="selectable w-full rounded-xl border border-border-subtle bg-bg-base py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("admin.email")}
              className="selectable min-w-[200px] flex-1 rounded-xl border border-border-subtle bg-bg-base px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                title={t("admin.days")}
                className="w-24 rounded-xl border border-border-subtle bg-bg-base px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <span className="text-sm text-text-secondary">{t("admin.days")}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[7, 30, 90, 365].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                  days === d
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border-subtle text-text-secondary hover:bg-bg-hover"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <button
            className="btn-primary"
            onClick={generate}
            disabled={busy || !token.trim() || !email.trim() || days < 1}
          >
            {busy ? <Spinner /> : <><KeyRound className="h-4 w-4" /> {t("admin.generate")}</>}
          </button>

          {issued && (
            <div className="rounded-xl border border-border-subtle bg-bg-base p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs text-text-secondary">
                  {t("admin.issuedFor", { email: issued.email })} · {t("license.expires")}: {issued.expires}
                </p>
                <button
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  onClick={copyKey}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t("admin.copied") : t("admin.copy")}
                </button>
              </div>
              <code className="selectable block break-all rounded-lg bg-bg-elevated p-2 text-xs">
                {issued.key}
              </code>
              <button className="btn-outline mt-2 w-full justify-center" onClick={activateHere} disabled={activating}>
                {activating ? <Spinner /> : <><Sparkles className="h-4 w-4" /> {t("admin.activateHere")}</>}
              </button>
              <p className="mt-1.5 text-xs text-text-muted">{t("admin.activateHereHint")}</p>
            </div>
          )}

          <p className="text-xs text-text-muted">{t("admin.note")}</p>
        </div>
      )}
    </Card>
  );
}
