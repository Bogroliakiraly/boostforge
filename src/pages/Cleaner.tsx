import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Trash2, Sparkles } from "lucide-react";
import { cleanTargets, createRestorePoint, scanCleanTargets } from "../lib/api";
import type { CleanTarget } from "../lib/types";
import { Badge, Card, SectionTitle, Spinner, Toggle } from "../components/ui";
import { formatBytes } from "../lib/format";
import { useConfirm } from "../store/useConfirm";
import { toast } from "../store/useToast";
import { useT } from "../i18n";

export function Cleaner() {
  const { t } = useT();
  const [targets, setTargets] = useState<CleanTarget[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const ask = useConfirm((s) => s.ask);

  function localized(t_: CleanTarget) {
    return {
      name: t(`clean.t.${t_.id}.name`),
      description: t(`clean.t.${t_.id}.description`),
      benefit: t(`clean.t.${t_.id}.benefit`),
      downside: t(`clean.t.${t_.id}.downside`),
    };
  }

  async function scan() {
    setScanning(true);
    try {
      const found = await scanCleanTargets();
      setTargets(found);
      // Pre-select the obviously safe, recoverable categories.
      setSelected(
        new Set(
          found
            .filter((x) => !x.permanent && x.size_bytes > 0)
            .map((x) => x.id),
        ),
      );
    } catch (e) {
      toast.error(t("clean.toastScanFailed"), String(e));
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    scan();
  }, []);

  const totalSelected = useMemo(
    () =>
      targets
        .filter((t) => selected.has(t.id))
        .reduce((sum, t) => sum + t.size_bytes, 0),
    [targets, selected],
  );

  const anyPermanent = targets.some(
    (t) => selected.has(t.id) && t.permanent,
  );

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectableIds = targets.filter((t) => t.size_bytes > 0).map((t) => t.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  }

  async function runClean() {
    const ids = [...selected];
    if (ids.length === 0) return;

    const { ok, restore } = await ask({
      title: t("clean.confirmTitle"),
      what: t("clean.confirmWhat", { size: formatBytes(totalSelected), n: ids.length }),
      why: t("clean.confirmWhy"),
      benefit: t("clean.confirmBenefit", { size: formatBytes(totalSelected) }),
      downside: anyPermanent
        ? t("clean.confirmDownsidePermanent")
        : t("clean.confirmDownsideSafe"),
      confirmLabel: t("clean.confirmLabel"),
      danger: anyPermanent,
      offerRestorePoint: anyPermanent,
    });
    if (!ok) return;

    setCleaning(true);
    try {
      if (restore) {
        try {
          await createRestorePoint("BoostForge — before cleanup");
          toast.success(t("clean.toastRestoreCreated"));
        } catch (e) {
          toast.warn(t("clean.toastRestoreSkipped"), String(e));
        }
      }
      const result = await cleanTargets(ids);
      toast.success(
        t("clean.toastComplete"),
        `${formatBytes(result.freed_bytes)} · ${result.removed_files} ${t("clean.files")}`,
      );
      if (result.errors.length) {
        toast.warn(
          t("clean.toastSkippedTitle", { n: result.errors.length }),
          t("clean.toastSkippedMsg"),
        );
      }
      await scan();
    } catch (e) {
      toast.error(t("clean.toastFailed"), String(e));
    } finally {
      setCleaning(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle
          title={t("clean.title")}
          subtitle={t("clean.subtitle")}
          action={
            <div className="flex items-center gap-2">
              {!scanning && selectableIds.length > 0 && (
                <button className="btn-outline" onClick={toggleAll}>
                  {allSelected ? t("clean.deselectAll") : t("clean.selectAll")}
                </button>
              )}
              <button className="btn-ghost" onClick={scan} disabled={scanning}>
                <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
                {t("common.rescan")}
              </button>
            </div>
          }
        />

        {scanning ? (
          <Spinner label={t("clean.scanning")} />
        ) : (
          <div className="space-y-2">
            {targets.map((target) => {
              const loc = localized(target);
              return (
                <div
                  key={target.id}
                  className="flex items-start gap-3 rounded-xl border border-border-subtle p-3.5"
                >
                  <Toggle
                    checked={selected.has(target.id)}
                    onChange={() => toggle(target.id)}
                    disabled={target.size_bytes === 0}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{loc.name}</span>
                      {target.permanent ? (
                        <Badge tone="warn">{t("clean.permanent")}</Badge>
                      ) : (
                        <Badge tone="good">{t("clean.recoverable")}</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-text-secondary">{loc.description}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      <span className="text-good">{t("clean.benefit")}</span> {loc.benefit}{" "}
                      <span className="text-warn">{t("clean.downside")}</span> {loc.downside}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">
                      {formatBytes(target.size_bytes)}
                    </p>
                    <p className="text-xs text-text-muted">
                      {target.file_count} {t("clean.files")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="sticky bottom-0 flex items-center justify-between rounded-2xl border border-border-subtle bg-bg-elevated/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-text-secondary">{t("clean.selectedToFree")}</span>
          <span className="font-semibold">{formatBytes(totalSelected)}</span>
        </div>
        <button
          className="btn-primary"
          disabled={cleaning || selected.size === 0}
          onClick={runClean}
        >
          {cleaning ? (
            <Spinner />
          ) : (
            <>
              <Trash2 className="h-4 w-4" />
              {t("clean.cleanButton")} {selected.size > 0 ? `(${selected.size})` : ""}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
