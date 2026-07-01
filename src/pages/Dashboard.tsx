import { useEffect, useState } from "react";
import { Cpu, HardDrive, MemoryStick, Network, Microchip, HeartPulse, Rocket } from "lucide-react";
import { useMonitor } from "../hooks/useMonitor";
import {
  diskHealth,
  getDailyStats,
  getGpuInfo,
  listDisks,
  listStartupItems,
} from "../lib/api";
import type { DailyStat, DiskInfo, GpuInfo, PhysicalDiskHealth, StartupItem } from "../lib/types";
import { Gauge } from "../components/Gauge";
import { Sparkline } from "../components/Sparkline";
import { Badge, Card, SectionTitle } from "../components/ui";
import { useNav } from "../store/useNav";
import {
  formatBytes,
  formatBytesPerSec,
  formatUptime,
} from "../lib/format";
import { useT } from "../i18n";

export function Dashboard() {
  const { t } = useT();
  const { snapshot, history } = useMonitor(1000);
  const [gpus, setGpus] = useState<GpuInfo[]>([]);
  const [disks, setDisks] = useState<DiskInfo[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [diskHealthList, setDiskHealthList] = useState<PhysicalDiskHealth[]>([]);
  const [startupItems, setStartupItems] = useState<StartupItem[]>([]);
  const go = useNav((s) => s.go);

  useEffect(() => {
    getGpuInfo().then(setGpus).catch(() => {});
    listDisks().then(setDisks).catch(() => {});
    getDailyStats().then(setDailyStats).catch(() => {});
    diskHealth().then(setDiskHealthList).catch(() => {});
    listStartupItems().then(setStartupItems).catch(() => {});
  }, []);

  const mem = snapshot?.memory;
  const memPct = mem && mem.total ? (mem.used / mem.total) * 100 : 0;
  const gpu = gpus[0];
  const netMax = Math.max(1, ...history.net);

  const todayKey = new Date().toISOString().slice(0, 10);
  const today = dailyStats.find((d) => d.date === todayKey);
  const last7 = dailyStats.slice(-7);
  const last7Max = Math.max(1, ...last7.map((d) => d.disk_freed_bytes + d.memory_freed_bytes));
  const unhealthyDisks = diskHealthList.filter((d) => d.health_status !== "Healthy").length;
  const enabledStartup = startupItems.filter((s) => s.enabled).length;
  const ramFreePct = mem && mem.total ? (mem.available / mem.total) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Headline gauges */}
        <Card className="lg:col-span-2">
          <SectionTitle
            title={t("dash.overview")}
            subtitle={
              snapshot
                ? `${snapshot.cpu.brand} · ${snapshot.process_count} ${t("dash.processesSuffix")} · ${t(
                    "dash.upPrefix",
                  )} ${formatUptime(snapshot.uptime_secs)}`
                : t("dash.reading")
            }
          />
          <div className="flex flex-wrap items-center justify-around gap-4">
            <Gauge
              value={snapshot?.cpu.usage ?? 0}
              label={t("dash.cpu")}
              sub={
                snapshot?.cpu.logical_cores
                  ? `${snapshot.cpu.logical_cores} ${t("dash.threads")}`
                  : undefined
              }
            />
            <Gauge
              value={memPct}
              label={t("dash.memory")}
              sub={
                mem
                  ? `${formatBytes(mem.used)} / ${formatBytes(mem.total)}`
                  : undefined
              }
            />
            <Gauge
              value={gpu?.utilization ?? 0}
              available={gpu?.utilization != null}
              label="GPU"
              sub={gpu ? gpu.name : t("dash.detecting")}
            />
          </div>
        </Card>

        {/* Network */}
        <Card>
          <SectionTitle title={t("dash.network")} />
          <div className="flex items-center gap-2 text-text-secondary">
            <Network className="h-4 w-4" />
            <span className="text-sm">{t("dash.throughput")}</span>
          </div>
          <Sparkline data={history.net} max={netMax} color="#3ddc84" width={260} />
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-text-secondary">
              ↓ {formatBytesPerSec(snapshot?.network.rx_per_sec ?? 0)}
            </span>
            <span className="text-text-secondary">
              ↑ {formatBytesPerSec(snapshot?.network.tx_per_sec ?? 0)}
            </span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Today's reclaimed space */}
        <Card>
          <SectionTitle title={t("dash.reclaimedTitle")} subtitle={t("dash.reclaimedSubtitle")} />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border-subtle p-3 text-center">
              <p className="text-xl font-semibold tabular-nums text-accent">
                {formatBytes(today?.disk_freed_bytes ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-text-secondary">{t("dash.reclaimedDisk")}</p>
            </div>
            <div className="rounded-xl border border-border-subtle p-3 text-center">
              <p className="text-xl font-semibold tabular-nums text-warn">
                {formatBytes(today?.memory_freed_bytes ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-text-secondary">{t("dash.reclaimedMemory")}</p>
            </div>
          </div>
          {last7.length > 1 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs uppercase tracking-wide text-text-muted">
                {t("dash.reclaimedLast7")}
              </p>
              <div className="flex h-12 items-end gap-1.5">
                {last7.map((d) => {
                  const total = d.disk_freed_bytes + d.memory_freed_bytes;
                  const pct = Math.max(4, (total / last7Max) * 100);
                  return (
                    <div
                      key={d.date}
                      className="flex-1 rounded-t bg-accent/60"
                      style={{ height: `${pct}%` }}
                      title={`${d.date} · ${formatBytes(total)}`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* System health — aggregates real, already-measured data only */}
        <Card>
          <SectionTitle title={t("dash.healthTitle")} />
          <div className="space-y-2">
            <button
              onClick={() => go("memory")}
              className="flex w-full items-center justify-between rounded-xl border border-border-subtle px-3 py-2.5 text-left hover:bg-bg-hover"
            >
              <span className="flex items-center gap-2 text-sm">
                <MemoryStick className="h-4 w-4 text-text-muted" /> {t("dash.healthRam")}
              </span>
              <Badge tone={ramFreePct > 20 ? "good" : ramFreePct > 8 ? "accent" : "warn"}>
                {ramFreePct.toFixed(0)}% {t("dash.free")}
              </Badge>
            </button>
            <button
              onClick={() => go("tools")}
              className="flex w-full items-center justify-between rounded-xl border border-border-subtle px-3 py-2.5 text-left hover:bg-bg-hover"
            >
              <span className="flex items-center gap-2 text-sm">
                <HeartPulse className="h-4 w-4 text-text-muted" /> {t("dash.healthDisks")}
              </span>
              {diskHealthList.length === 0 ? (
                <Badge>{t("common.notAvailable")}</Badge>
              ) : (
                <Badge tone={unhealthyDisks === 0 ? "good" : "warn"}>
                  {unhealthyDisks === 0
                    ? t("dash.healthAllGood", { n: diskHealthList.length })
                    : t("dash.healthSomeIssues", { n: unhealthyDisks })}
                </Badge>
              )}
            </button>
            <button
              onClick={() => go("startup")}
              className="flex w-full items-center justify-between rounded-xl border border-border-subtle px-3 py-2.5 text-left hover:bg-bg-hover"
            >
              <span className="flex items-center gap-2 text-sm">
                <Rocket className="h-4 w-4 text-text-muted" /> {t("dash.healthStartup")}
              </span>
              <Badge>{t("dash.healthStartupCount", { n: enabledStartup })}</Badge>
            </button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center gap-2 text-text-secondary">
            <Cpu className="h-4 w-4" />
            <span className="text-sm font-medium">{t("dash.cpuHistory")}</span>
          </div>
          <Sparkline data={history.cpu} max={100} color="#5b8cff" width={420} />
        </Card>
        <Card>
          <div className="mb-2 flex items-center gap-2 text-text-secondary">
            <MemoryStick className="h-4 w-4" />
            <span className="text-sm font-medium">{t("dash.memHistory")}</span>
          </div>
          <Sparkline data={history.mem} max={100} color="#f5b14c" width={420} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Top processes */}
        <Card>
          <SectionTitle title={t("dash.topProcesses")} subtitle={t("dash.byCpu")} />
          <div className="space-y-1.5">
            {snapshot?.top_processes.slice(0, 8).map((p) => (
              <div
                key={p.pid}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-bg-hover"
              >
                <span className="truncate text-sm">{p.name}</span>
                <div className="flex items-center gap-4 text-xs tabular-nums text-text-secondary">
                  <span>{formatBytes(p.memory)}</span>
                  <span className="w-12 text-right">
                    {p.cpu_usage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Storage + GPU detail */}
        <div className="space-y-5">
          <Card>
            <SectionTitle title={t("dash.storage")} />
            <div className="space-y-3">
              {disks.map((d) => {
                const used = d.total - d.available;
                const pct = d.total ? (used / d.total) * 100 : 0;
                return (
                  <div key={d.mount_point}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <HardDrive className="h-3.5 w-3.5 text-text-muted" />
                        {d.mount_point} · {d.kind}
                      </span>
                      <span className="text-text-secondary">
                        {formatBytes(d.available)} {t("dash.free")}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-bg-hover">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <div className="mb-2 flex items-center gap-2 text-text-secondary">
              <Microchip className="h-4 w-4" />
              <span className="text-sm font-medium">{t("dash.graphics")}</span>
            </div>
            {gpus.length === 0 ? (
              <p className="text-sm text-text-muted">{t("dash.detectingGpu")}</p>
            ) : (
              gpus.map((g, i) => (
                <div key={i} className="text-sm">
                  <p className="font-medium">{g.name}</p>
                  <p className="text-text-secondary">
                    {t("dash.driver")} {g.driver_version ?? t("common.unknown")}
                    {g.vram_total ? ` · ${formatBytes(g.vram_total)} ${t("dash.vram")}` : ""}
                  </p>
                  {g.utilization == null && (
                    <p className="mt-1 text-xs text-text-muted">{t("dash.gpuNote")}</p>
                  )}
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
