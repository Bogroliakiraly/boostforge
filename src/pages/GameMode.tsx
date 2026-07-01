import { useEffect, useState } from "react";
import { Gamepad2, Zap, RotateCcw } from "lucide-react";
import {
  applyGameMode,
  getGameModeStatus,
  listPowerPlans,
  restoreGameMode,
  setPowerPlan,
} from "../lib/api";
import type { GameModeStatus, PowerPlan } from "../lib/types";
import { Badge, Card, SectionTitle, Spinner } from "../components/ui";
import { ProGate } from "../components/ProGate";
import { useConfirm } from "../store/useConfirm";
import { toast } from "../store/useToast";
import { useT } from "../i18n";

export function GameMode() {
  const { t } = useT();
  const [status, setStatus] = useState<GameModeStatus | null>(null);
  const [plans, setPlans] = useState<PowerPlan[]>([]);
  const [busy, setBusy] = useState(false);
  const ask = useConfirm((s) => s.ask);

  async function refresh() {
    try {
      const [s, p] = await Promise.all([getGameModeStatus(), listPowerPlans()]);
      setStatus(s);
      setPlans(p);
    } catch (e) {
      toast.error(t("game.toastFailedRead"), String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function enable() {
    const { ok } = await ask({
      title: t("game.confirmTitle"),
      what: t("game.confirmWhat"),
      why: t("game.confirmWhy"),
      benefit: t("game.confirmBenefit"),
      downside: t("game.confirmDownside"),
      confirmLabel: t("game.confirmLabel"),
    });
    if (!ok) return;
    setBusy(true);
    try {
      setStatus(await applyGameMode());
      toast.success(t("game.toastEngaged"), t("game.toastEngagedDesc"));
    } catch (e) {
      toast.error(t("game.toastEngageFailed"), String(e));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      setStatus(await restoreGameMode());
      toast.success(t("game.toastDisabled"), t("game.toastDisabledDesc"));
    } catch (e) {
      toast.error(t("game.toastRestoreFailed"), String(e));
    } finally {
      setBusy(false);
    }
  }

  async function choosePlan(guid: string) {
    try {
      await setPowerPlan(guid);
      await refresh();
      toast.success(t("game.toastPlanChanged"));
    } catch (e) {
      toast.error(t("game.toastPlanFailed"), String(e));
    }
  }

  const active = status?.active ?? false;
  const detected = status?.detected_games ?? [];

  return (
    <ProGate>
    <div className="space-y-5">
      {!active && detected.length > 0 && (
        <Card className="border-accent/40 bg-accent/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">
                {t("game.detectedPrefix")} {detected.join(", ")}
              </p>
              <p className="text-xs text-text-secondary">{t("game.detectedNote")}</p>
            </div>
            <button className="btn-primary shrink-0" onClick={enable} disabled={busy}>
              {busy ? <Spinner /> : <><Zap className="h-4 w-4" /> {t("game.engageNow")}</>}
            </button>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className={`grid h-14 w-14 place-items-center rounded-2xl ${
                active ? "bg-accent/20 text-accent" : "bg-bg-hover text-text-muted"
              }`}
            >
              <Gamepad2 className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {t("game.heading")} {active && <Badge tone="good">{t("game.active")}</Badge>}
              </h2>
              <p className="text-sm text-text-secondary">{t("game.description")}</p>
            </div>
          </div>
          {active ? (
            <button className="btn-outline" onClick={disable} disabled={busy}>
              {busy ? <Spinner /> : <><RotateCcw className="h-4 w-4" /> {t("game.restore")}</>}
            </button>
          ) : (
            <button className="btn-primary" onClick={enable} disabled={busy}>
              {busy ? <Spinner /> : <><Zap className="h-4 w-4" /> {t("game.engage")}</>}
            </button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
          <Effect
            title={t("game.effectPowerPlan")}
            on={t("game.effectPowerPlanOn")}
            off={t("game.effectPowerPlanOff")}
            whenOffLabel={t("game.whenOff")}
          />
          <Effect
            title={t("game.effectParking")}
            on={t("game.effectParkingOn")}
            off={t("game.effectParkingOff")}
            whenOffLabel={t("game.whenOff")}
          />
          <Effect
            title={t("game.effectClose")}
            on={t("game.effectCloseOn")}
            off="—"
            whenOffLabel={t("game.whenOff")}
          />
          <Effect
            title={t("game.effectDvr")}
            on={t("game.effectDvrOn")}
            off={t("game.effectDvrOff")}
            whenOffLabel={t("game.whenOff")}
          />
          <Effect
            title={t("game.effectGpu")}
            on={t("game.effectGpuOn")}
            off={t("game.effectGpuOff")}
            whenOffLabel={t("game.whenOff")}
          />
          <Effect
            title={t("game.effectPriority")}
            on={t("game.effectPriorityOn")}
            off={t("game.effectPriorityOff")}
            whenOffLabel={t("game.whenOff")}
          />
        </div>
        <p className="mt-4 text-xs text-text-muted">{t("game.note")}</p>
      </Card>

      <Card>
        <SectionTitle title={t("game.plansTitle")} subtitle={t("game.plansSubtitle")} />
        <div className="space-y-1.5">
          {plans.length === 0 && <Spinner label={t("game.readingPlans")} />}
          {plans.map((p) => (
            <button
              key={p.guid}
              onClick={() => choosePlan(p.guid)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left transition-colors ${
                p.active
                  ? "border-accent bg-accent/10"
                  : "border-border-subtle hover:bg-bg-hover"
              }`}
            >
              <span className="text-sm font-medium">{p.name}</span>
              {p.active && <Badge tone="accent">{t("game.active")}</Badge>}
            </button>
          ))}
        </div>
      </Card>
    </div>
    </ProGate>
  );
}

function Effect({
  title,
  on,
  off,
  whenOffLabel,
}: {
  title: string;
  on: string;
  off: string;
  whenOffLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border-subtle p-3">
      <p className="text-xs uppercase tracking-wide text-text-muted">{title}</p>
      <p className="mt-1 text-text-primary">{on}</p>
      <p className="text-xs text-text-secondary">
        {whenOffLabel} {off}
      </p>
    </div>
  );
}
