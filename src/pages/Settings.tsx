import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Info,
  Crown,
  RefreshCw,
  CheckCircle2,
  KeyRound,
  CalendarClock,
  PlayCircle,
  Check,
  Lock,
} from "lucide-react";
import { Badge, Card, SectionTitle, Spinner } from "../components/ui";
import { AccountCard } from "../components/AccountCard";
import { AdminPanel } from "../components/AdminPanel";
import { ProGate } from "../components/ProGate";
import {
  activateLicense,
  deactivateLicense,
  getCleanupSchedule,
  runScheduledCleanupNow,
  setCleanupSchedule,
} from "../lib/api";
import type { CleanupScheduleStatus } from "../lib/types";
import { useLicense } from "../store/useLicense";
import { useUpdate } from "../store/useUpdate";
import { useConfirm } from "../store/useConfirm";
import { useT, LANGUAGES, type Lang } from "../i18n";
import { toast } from "../store/useToast";
import { formatBytes, formatDate } from "../lib/format";

export function Settings({ elevated }: { elevated: boolean | null }) {
  const { t, lang, setLang } = useT();
  const license = useLicense();
  const update = useUpdate();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  async function activate() {
    if (!key.trim()) return;
    setBusy(true);
    try {
      const status = await activateLicense(key.trim());
      license.set(status);
      toast.success(t("license.activated"));
      setKey("");
    } catch (e) {
      toast.error(t("common.error"), String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    try {
      const status = await deactivateLicense();
      license.set(status);
    } catch (e) {
      toast.error(t("common.error"), String(e));
    } finally {
      setBusy(false);
    }
  }

  const s = license.status;
  const tierTone =
    s?.tier === "pro" ? "good" : s?.tier === "trial" ? "accent" : "neutral";

  return (
    <div className="space-y-5">
      {/* Language */}
      <Card>
        <SectionTitle title={t("settings.language")} />
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code as Lang)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors ${
                lang === l.code
                  ? "border-accent bg-accent/10"
                  : "border-border-subtle hover:bg-bg-hover"
              }`}
            >
              <span className="text-base">{l.flag}</span>
              {l.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Online account (Supabase) — hidden when not configured */}
      <AccountCard />

      {/* Subscription */}
      <Card>
        <SectionTitle title={t("settings.account")} subtitle={t("license.subtitle")} />
        <div className="mb-4 flex items-center gap-3">
          <Crown className={`h-6 w-6 ${s?.tier === "pro" ? "text-warn" : "text-text-muted"}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{t("license.status")}:</span>
              <Badge tone={tierTone as "good" | "accent" | "neutral"}>
                {s?.tier === "pro"
                  ? t("common.pro")
                  : s?.tier === "trial"
                    ? t("common.trial")
                    : t("common.free")}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-text-secondary">
              {s?.tier === "trial" && s.trial_days_remaining != null
                ? t("license.trialRemaining", { n: s.trial_days_remaining })
                : s?.tier === "pro" && s.days_remaining != null
                  ? `${t("license.daysRemaining", { n: s.days_remaining })} · ${t("license.expires")}: ${formatDate(s.expires)}`
                  : s?.reason ?? ""}
            </p>
          </div>
          {s?.tier === "pro" && (
            <button className="btn-ghost" onClick={deactivate} disabled={busy}>
              {t("license.deactivate")}
            </button>
          )}
        </div>

        {s?.tier !== "pro" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={t("license.keyPlaceholder")}
                  className="selectable w-full rounded-xl border border-border-subtle bg-bg-base py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
                />
              </div>
              <button className="btn-primary" onClick={activate} disabled={busy || !key.trim()}>
                {busy ? <Spinner /> : t("license.activate")}
              </button>
            </div>
            <a
              href="https://bogroliakiraly.github.io/boostforge/#pricing"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
            >
              <Crown className="h-4 w-4" /> {t("license.getPro")}
            </a>
          </div>
        )}
      </Card>

      {/* Updates */}
      <Card>
        <SectionTitle title={t("update.check")} />
        <div className="flex items-center gap-3">
          <button
            className="btn-outline"
            onClick={() => update.check(false)}
            disabled={update.phase === "checking"}
          >
            <RefreshCw className={`h-4 w-4 ${update.phase === "checking" ? "animate-spin" : ""}`} />
            {t("update.check")}
          </button>
          <span className="text-sm text-text-secondary">
            {update.phase === "checking" && t("update.checking")}
            {update.phase === "uptodate" && (
              <span className="flex items-center gap-1.5 text-good">
                <CheckCircle2 className="h-4 w-4" /> {t("update.upToDate")}
              </span>
            )}
            {update.phase === "available" &&
              t("update.newVersion", { v: update.version ?? "" })}
            {update.phase === "error" && t("common.notAvailable")}
          </span>
          {update.phase === "available" && (
            <button className="btn-primary ml-auto" onClick={update.install}>
              {t("update.install")}
            </button>
          )}
        </div>
      </Card>

      <PlansCard />

      <ProGate>
        <AutoCleanupCard />
      </ProGate>

      {/* Admin: issue Pro license keys (vendor-only, hidden when unconfigured) */}
      <AdminPanel />

      {/* About */}
      <Card>
        <SectionTitle title={t("settings.about")} />
        <p className="text-sm text-text-secondary leading-relaxed">{t("settings.aboutBody")}</p>
        <div className="mt-4 flex items-center gap-2 text-sm">
          <Info className="h-4 w-4 text-accent" />
          <span className="text-text-secondary">{t("settings.version")}</span>
        </div>
      </Card>

      {/* Permissions */}
      <Card>
        <SectionTitle title={t("settings.permissions")} />
        <div className="flex items-center gap-3 text-sm">
          <ShieldCheck className={`h-5 w-5 ${elevated ? "text-good" : "text-warn"}`} />
          <p className="font-medium">
            {elevated ? t("common.administrator") : t("common.notAdministrator")}
          </p>
        </div>
      </Card>

      {/* Principles */}
      <Card>
        <SectionTitle title={t("settings.willNot")} />
        <ul className="space-y-2 text-sm text-text-secondary">
          {[
            t("settings.willNot.1"),
            t("settings.willNot.2"),
            t("settings.willNot.3"),
            t("settings.willNot.4"),
            t("settings.willNot.5"),
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span className="text-bad">✕</span>
              {line}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function PlansCard() {
  const { t } = useT();
  const freeItems = [1, 2, 3, 4].map((i) => t(`plans.free.${i}`));
  const proItems = [1, 2, 3, 4, 5].map((i) => t(`plans.pro.${i}`));
  return (
    <Card>
      <SectionTitle title={t("plans.title")} subtitle={t("plans.subtitle")} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border-subtle p-4">
          <p className="mb-3 text-sm font-semibold text-text-secondary">{t("plans.freeTitle")}</p>
          <ul className="space-y-2 text-sm">
            {freeItems.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-good" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-accent/40 bg-accent/5 p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-accent">
            <Crown className="h-4 w-4" /> {t("plans.proTitle")}
          </p>
          <ul className="space-y-2 text-sm">
            {proItems.map((item, i) => (
              <li key={item} className="flex items-start gap-2">
                {i === 0 ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-good" />
                ) : (
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                )}
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function AutoCleanupCard() {
  const { t } = useT();
  const ask = useConfirm((s) => s.ask);
  const [status, setStatus] = useState<CleanupScheduleStatus | null>(null);
  const [time, setTime] = useState("03:00");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCleanupSchedule()
      .then((s) => {
        setStatus(s);
        setTime(s.schedule.time);
      })
      .catch(() => {});
  }, []);

  async function toggle(enabled: boolean) {
    if (enabled) {
      const { ok } = await ask({
        title: t("settings.autoclean.confirmTitle"),
        what: t("settings.autoclean.confirmWhat", { time }),
        why: t("settings.autoclean.confirmWhy"),
        benefit: t("settings.autoclean.confirmBenefit"),
        downside: t("settings.autoclean.confirmDownside"),
        confirmLabel: t("settings.autoclean.confirmLabel"),
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const targetIds = status?.schedule.target_ids ?? ["user_temp", "windows_temp", "shader_cache"];
      const s = await setCleanupSchedule(enabled, time, targetIds);
      setStatus(s);
      toast.success(enabled ? t("settings.autoclean.toastScheduled") : t("settings.autoclean.toastDisabled"));
    } catch (e) {
      toast.error(t("settings.autoclean.toastFailedUpdate"), String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    setBusy(true);
    try {
      const result = await runScheduledCleanupNow();
      toast.success(
        t("settings.autoclean.toastFinished"),
        t("settings.autoclean.toastFinishedMsg", {
          size: formatBytes(result.freed_bytes),
          n: result.removed_files,
        }),
      );
      const s = await getCleanupSchedule();
      setStatus(s);
    } catch (e) {
      toast.error(t("settings.autoclean.toastFailed"), String(e));
    } finally {
      setBusy(false);
    }
  }

  const enabled = status?.schedule.enabled ?? false;

  return (
    <Card>
      <SectionTitle
        title={t("settings.autoclean.title")}
        subtitle={t("settings.autoclean.subtitle")}
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-text-muted" />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-xl border border-border-subtle bg-bg-base px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          className={enabled ? "btn-outline" : "btn-primary"}
          onClick={() => toggle(!enabled)}
          disabled={busy}
        >
          {busy ? <Spinner /> : enabled ? t("settings.autoclean.disable") : t("settings.autoclean.enable")}
        </button>
        <button className="btn-ghost" onClick={runNow} disabled={busy}>
          <PlayCircle className="h-4 w-4" /> {t("settings.autoclean.runNow")}
        </button>
        {enabled && <Badge tone="good">{t("settings.autoclean.scheduled", { time })}</Badge>}
      </div>
      {status?.last_run && (
        <p className="mt-3 text-xs text-text-secondary">
          {t("settings.autoclean.lastRun", {
            date: formatDate(status.last_run),
            size: formatBytes(status.last_freed_bytes ?? 0),
            n: status.last_removed_files ?? 0,
          })}
        </p>
      )}
    </Card>
  );
}
