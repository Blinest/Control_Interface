import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { Crosshair } from "lucide-react";
import type { DeviceSnapshot, RuntimeSnapshot, SessionInfo } from "../../softuiTypes";
import { ChartLayout } from "../../layouts/ChartLayout";
import { createSerialRunner } from "../../lib/serialRunner";
import { tauriClient } from "../../services/tauriClient";
import { ChannelSidebar, type ChannelGroup, type ChannelMeta } from "./ChannelSidebar";
import { ChartToolbar } from "./ChartToolbar";

const SERIES_COLORS = [
  "#4fc3f7", "#81c784", "#ffb74d", "#f06292", "#ba68c8", "#4dd0e1",
  "#aed581", "#ff8a65", "#9575cd", "#4db6ac", "#dce775", "#e57373",
  "#90a4ae", "#7986cb", "#64b5f6",
];

function groupChannels(snapshot: RuntimeSnapshot): ChannelMeta[] {
  const byType: Record<string, ChannelMeta[]> = {};
  for (const ch of snapshot.charts.channels) {
    const colorIdx = (byType[ch.channelType]?.length ?? 0) % SERIES_COLORS.length;
    const meta: ChannelMeta = {
      name: ch.name,
      unit: ch.unit,
      type: (ch.channelType as ChannelGroup) || "motor",
      index: ch.channelIndex,
      visible: defaultChannelVisible(ch.name, ch.channelType),
      color: SERIES_COLORS[colorIdx],
    };
    (byType[ch.channelType] ??= []).push(meta);
  }
  return Object.values(byType).flat();
}

interface ChartTimestamps {
  timestamps: number[];
  series: Record<string, number[]>;
}

interface CursorValue {
  name: string;
  unit: string;
  color: string;
  value: number | null;
}

interface CursorReadout {
  index: number;
  time: number;
  values: CursorValue[];
}

interface ZoomWindow {
  min: number;
  max: number;
}

const MAX_RENDER_POINTS = 900;
const SUBPLOT_COUNT = 6;

async function loadLiveWindow(count: number, deviceId?: string): Promise<DeviceSnapshot[]> {
  const frames = await tauriClient.invoke<DeviceSnapshot[]>("fetch_live_window", { count, deviceId });
  // Device windows are chronological; the optional global window is newest-first.
  return deviceId ? frames : [...frames].reverse();
}

function defaultChannelVisible(channelName: string, channelType: string) {
  if (channelType === "bend") return true;
  if (channelType !== "motor") return false;
  return channelName.endsWith(" vel") || !/\s(pos|acc)$/.test(channelName);
}

function makeTimestamps(snap: RuntimeSnapshot): ChartTimestamps {
  const len = snap.charts.channels[0]?.points.length ?? 0;
  const timestamps: number[] = new Array(len);
  for (let i = 0; i < len; i++) {
    timestamps[i] = Number(((i - Math.max(len - 1, 0)) * 0.05).toFixed(2));
  }
  const series: Record<string, number[]> = {};
  for (const ch of snap.charts.channels) {
    series[ch.name] = ch.points;
  }
  return { timestamps, series };
}

function asAlignedData(
  ts: ChartTimestamps,
  visible: ChannelMeta[],
): uPlot.AlignedData {
  const data: uPlot.AlignedData = [ts.timestamps];
  for (const ch of visible) {
    data.push(ts.series[ch.name] ?? []);
  }
  return data;
}

function normalizeSubplotAssignments(previous: string[], channels: ChannelMeta[]) {
  const available = channels.map((channel) => channel.name);
  return Array.from({ length: SUBPLOT_COUNT }, (_, index) => {
    const current = previous[index];
    if (current && available.includes(current)) return current;
    return channels[index % Math.max(channels.length, 1)]?.name ?? "";
  });
}

function formatValue(value: number | null, unit = "") {
  if (value === null || !Number.isFinite(value)) return "--";
  const abs = Math.abs(value);
  const precision = abs >= 100 ? 1 : abs >= 10 ? 2 : 3;
  return `${value.toFixed(precision)}${unit ? ` ${unit}` : ""}`;
}

function fullTimeWindow(timestamps: number[]): ZoomWindow | null {
  const min = timestamps[0];
  const max = timestamps[timestamps.length - 1];
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return null;
  return { min, max };
}

function isFullWindow(window: ZoomWindow, full: ZoomWindow) {
  const span = Math.max(0.001, full.max - full.min);
  return Math.abs(window.min - full.min) < span * 0.001
    && Math.abs(window.max - full.max) < span * 0.001;
}

function sameChannelShape(prev: ChannelMeta[], next: ChannelMeta[]) {
  if (prev.length !== next.length) return false;
  return prev.every((channel, index) => {
    const candidate = next[index];
    return candidate
      && channel.name === candidate.name
      && channel.unit === candidate.unit
      && channel.type === candidate.type
      && channel.index === candidate.index;
  });
}

function downsampleFrames(frames: DeviceSnapshot[], maxPoints: number) {
  if (frames.length <= maxPoints) return frames;
  const step = Math.max(1, Math.ceil(frames.length / maxPoints));
  return frames.filter((_, index) => index % step === 0);
}

function chartsFromFrames(frames: DeviceSnapshot[]): RuntimeSnapshot["charts"] | null {
  const ordered = downsampleFrames(frames, MAX_RENDER_POINTS);
  const first = ordered[0];
  if (!first) return null;
  const channels: RuntimeSnapshot["charts"]["channels"] = [];
  for (const motor of first.motors) {
    channels.push({
      name: `Motor ${motor.id} pos`,
      unit: "mm",
      channelType: "motor",
      channelIndex: motor.id,
      points: ordered.map((frame) => frame.motors.find((item) => item.id === motor.id)?.positionMm ?? 0),
    });
    channels.push({
      name: `Motor ${motor.id} vel`,
      unit: "mm/s",
      channelType: "motor",
      channelIndex: motor.id,
      points: ordered.map((frame) => frame.motors.find((item) => item.id === motor.id)?.velocityMmPerSec ?? 0),
    });
    channels.push({
      name: `Motor ${motor.id} acc`,
      unit: "mm/s²",
      channelType: "motor",
      channelIndex: motor.id,
      points: ordered.map((frame) => frame.motors.find((item) => item.id === motor.id)?.accelerationMmPerSec2 ?? 0),
    });
  }
  channels.push({
    name: "Bend S1",
    unit: "deg",
    channelType: "bend",
    channelIndex: 1,
    points: ordered.map((frame) => frame.bend.section1.angleDeg),
  });
  channels.push({
    name: "Bend S2",
    unit: "deg",
    channelType: "bend",
    channelIndex: 2,
    points: ordered.map((frame) => frame.bend.section2.angleDeg),
  });
  for (const sensor of first.sensors) {
    sensor.alias.forEach((axis, axisIndex) => {
      channels.push({
        name: `Sensor ${sensor.id} ${axis}`,
        unit: sensor.unit,
        channelType: "sensor",
        channelIndex: sensor.id,
        points: ordered.map((frame) => frame.sensors.find((item) => item.id === sensor.id)?.filtered[axisIndex] ?? 0),
      });
    });
  }
  return { windowSize: ordered.length, channels };
}

export default function ChartsPage({ snapshot, currentDeviceId }: { snapshot: RuntimeSnapshot; currentDeviceId?: string }) {
  const mainRef = useRef<HTMLDivElement | null>(null);
  const containerRefs = useRef<Array<HTMLElement | null>>([]);
  const chartRefs = useRef<Array<uPlot | null>>([]);
  const cursorFrameRef = useRef<number | null>(null);
  const lastRenderedChartKeyRef = useRef("");
  const refreshRunnerRef = useRef(createSerialRunner());
  const [paused, setPaused] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("live");
  const [historyFrames, setHistoryFrames] = useState<DeviceSnapshot[]>([]);
  const [exportPath, setExportPath] = useState("");
  const [chartError, setChartError] = useState("");
  const [cursorReadout] = useState<CursorReadout | null>(null);
  const [zoomWindow, setZoomWindow] = useState<ZoomWindow | null>(null);
  const liveDeviceId = currentDeviceId ?? snapshot.live.selectedDeviceId;
  const historyCharts = useMemo(() => chartsFromFrames(historyFrames), [historyFrames]);
  const activeSnapshot = useMemo<RuntimeSnapshot>(() => {
    const charts = historyCharts ?? snapshot.charts;
    return {
      ...snapshot,
      charts,
      playbackMode: selectedSessionId !== "live",
    };
  }, [historyCharts, selectedSessionId, snapshot]);
  const [channels, setChannels] = useState<ChannelMeta[]>(() => groupChannels(snapshot));
  const [subplotAssignments, setSubplotAssignments] = useState<string[]>(() =>
    normalizeSubplotAssignments([], groupChannels(snapshot)),
  );

  const visibleSeries = useMemo(() => channels.filter((c) => c.visible), [channels]);
  const subplotAssignmentsKey = useMemo(() => subplotAssignments.join("|"), [subplotAssignments]);
  const assignedSubplots = useMemo(
    () => subplotAssignments.map((name, index) =>
      channels.find((channel) => channel.name === name) ?? channels[index % Math.max(channels.length, 1)] ?? null,
    ),
    [channels, subplotAssignmentsKey],
  );
  const assignedSubplotsKey = useMemo(
    () => assignedSubplots.map((channel) => channel?.name ?? "").join("|"),
    [assignedSubplots],
  );
  const chartData = useMemo(() => makeTimestamps(activeSnapshot), [activeSnapshot.charts]);
  const chartDataKey = useMemo(() => {
    const timestamps = chartData.timestamps;
    const lastIndex = timestamps.length - 1;
    const lastTime = lastIndex >= 0 ? timestamps[lastIndex] : 0;
    const seriesKeys = assignedSubplots
      .map((channel) => {
        if (!channel) return "empty";
        const values = chartData.series[channel.name] ?? [];
        const lastValue = values[values.length - 1] ?? 0;
        return `${channel.name}:${values.length}:${lastValue}`;
      })
      .join("|");
    return `${selectedSessionId}:${timestamps.length}:${lastTime}:${seriesKeys}`;
  }, [assignedSubplots, chartData, selectedSessionId]);
  const chartDataRef = useRef(chartData);

  const getChartSize = (index: number) => {
    const el = containerRefs.current[index];
    if (!el) return { width: 800, height: 360 };
    return {
      width: Math.max(320, el.clientWidth),
      height: Math.max(140, el.clientHeight || 180),
    };
  };

  useEffect(() => {
    chartDataRef.current = chartData;
  }, [chartData]);

  const renderCursorReadout = useCallback((index: number | null, time: number | null, values: CursorValue[]) => {
    const root = mainRef.current;
    const head = root?.querySelector<HTMLSpanElement>(".charts-readout-head span:last-child");
    const valuesNode = root?.querySelector<HTMLDivElement>(".charts-readout-values");

    if (head) {
      head.textContent =
        index === null || time === null
          ? "移动鼠标查看垂直光标读数"
          : `t=${time.toFixed(2)}s · #${index + 1}`;
    }

    if (!valuesNode) return;
    valuesNode.replaceChildren(
      ...values.map((item) => {
        const chip = document.createElement("span");
        chip.className = "charts-readout-chip";

        const dot = document.createElement("span");
        dot.className = "channel-dot";
        dot.style.background = item.color;

        const name = document.createElement("span");
        name.className = "charts-readout-name";
        name.textContent = item.name;

        const value = document.createElement("strong");
        value.textContent = formatValue(item.value, item.unit);

        chip.append(dot, name, value);
        return chip;
      }),
    );
  }, []);

  const updateCursorReadout = useCallback((plot: uPlot, readoutChannels: ChannelMeta[]) => {
    if (cursorFrameRef.current !== null) {
      window.cancelAnimationFrame(cursorFrameRef.current);
    }

    const idx = typeof plot.cursor.idx === "number" ? plot.cursor.idx : null;
    const timestamps = chartDataRef.current.timestamps;
    const visible = readoutChannels;

    cursorFrameRef.current = window.requestAnimationFrame(() => {
      if (idx === null || idx < 0 || idx >= timestamps.length) {
        renderCursorReadout(null, null, visible.map((channel) => ({
          name: channel.name,
          unit: channel.unit,
          color: channel.color,
          value: null,
        })));
        cursorFrameRef.current = null;
        return;
      }

      const values = visible.map((channel, seriesIndex) => {
        const series = plot.data[seriesIndex + 1] as number[] | undefined;
        const value = series?.[idx];
        return {
          name: channel.name,
          unit: channel.unit,
          color: channel.color,
          value: typeof value === "number" && Number.isFinite(value) ? value : null,
        };
      });

      renderCursorReadout(idx, timestamps[idx], values);
      cursorFrameRef.current = null;
    });
  }, [renderCursorReadout]);

  useEffect(() => {
    renderCursorReadout(null, null, assignedSubplots.filter((channel): channel is ChannelMeta => Boolean(channel)).map((channel) => ({
      name: channel.name,
      unit: channel.unit,
      color: channel.color,
      value: null,
    })));
  }, [assignedSubplotsKey, renderCursorReadout]);

  useEffect(() => {
    return () => {
      if (cursorFrameRef.current !== null) {
        window.cancelAnimationFrame(cursorFrameRef.current);
      }
    };
  }, []);

  const setChartZoom = useCallback((next: ZoomWindow) => {
    const full = fullTimeWindow(chartDataRef.current.timestamps);
    if (!full) return;
    chartRefs.current.forEach((plot) => plot?.setScale("x", next));
    setZoomWindow(isFullWindow(next, full) ? null : next);
  }, []);

  const resetZoom = useCallback(() => {
    const full = fullTimeWindow(chartDataRef.current.timestamps);
    if (!full) return;
    setChartZoom(full);
  }, [setChartZoom]);

  // Initialize chart
  useEffect(() => {
    const next = groupChannels(activeSnapshot);
    setChannels((prev) => {
      if (sameChannelShape(prev, next)) {
        return prev;
      }
      const previous = new Map(prev.map((channel) => [channel.name, channel.visible]));
      return next.map((channel) => ({
        ...channel,
        visible: previous.get(channel.name) ?? channel.visible,
      }));
    });
    setSubplotAssignments((prev) => normalizeSubplotAssignments(prev, next));
  }, [activeSnapshot.charts]);

  useEffect(() => {
    void tauriClient.invoke<SessionInfo[]>("list_sessions")
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    if (selectedSessionId === "live") {
      setHistoryFrames([]);
      return;
    }
    void tauriClient.invoke<DeviceSnapshot[]>("read_session_frames", {
      id: selectedSessionId,
      maxCount: 5000,
    })
      .then((frames) => {
        setHistoryFrames(frames);
        setChartError("");
      })
      .catch((error) => {
        setHistoryFrames([]);
        setChartError(error instanceof Error ? error.message : String(error));
      });
  }, [selectedSessionId]);

  useEffect(() => {
    if (selectedSessionId !== "live" || paused) return;
    let cancelled = false;
    const refresh = async () => {
      await refreshRunnerRef.current(async () => {
        try {
          const frames = await loadLiveWindow(240, liveDeviceId);
          if (!cancelled) {
            setHistoryFrames(frames);
            setChartError("");
          }
        } catch (error) {
          if (!cancelled) setChartError(error instanceof Error ? error.message : String(error));
        }
      });
    };
    void refresh();
    const id = window.setInterval(() => void refresh(), 500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [liveDeviceId, paused, selectedSessionId]);

  const exportVisibleChannels = async () => {
    try {
      const path = await tauriClient.invoke<string>("export_chart_csv", {
        sessionId: selectedSessionId === "live" ? null : selectedSessionId,
        channelNames: visibleSeries.map((channel) => channel.name),
        maxCount: 5000,
      });
      setExportPath(path);
      setChartError("");
    } catch (error) {
      setChartError(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    chartRefs.current.forEach((plot) => plot?.destroy());
    chartRefs.current = assignedSubplots.map((channel, index) => {
      const container = containerRefs.current[index];
      if (!container || !channel) return null;
      const scaleKey = channel.type === "sensor" ? "N" : channel.unit || "value";
      const size = getChartSize(index);
      const opts: uPlot.Options = {
        width: size.width,
        height: size.height,
        cursor: {
          show: true,
          x: true,
          y: false,
          drag: { x: true, y: false, setScale: true },
          points: { show: false },
        },
        legend: { show: false },
        scales: {
          x: { time: false },
          [scaleKey]: {},
        },
        series: [
          {} as uPlot.Series,
          {
            label: channel.name,
            scale: scaleKey,
            stroke: channel.color,
            width: 1.5,
            points: { show: false },
          },
        ],
        axes: [
          {
            label: "时间",
            scale: "x",
            stroke: "#888",
            grid: { stroke: "rgba(255,255,255,0.06)" },
          },
          {
            label: scaleKey,
            scale: scaleKey,
            stroke: "#888",
            grid: { stroke: "rgba(255,255,255,0.06)" },
            side: 1,
          },
        ],
        hooks: {
          setCursor: [(plot) => updateCursorReadout(plot, [channel])],
          setScale: [
            (plot, scaleName) => {
              if (scaleName !== "x") return;
              const min = plot.scales.x.min;
              const max = plot.scales.x.max;
              const full = fullTimeWindow(chartDataRef.current.timestamps);
              if (typeof min !== "number" || typeof max !== "number" || !full) return;
              const next = { min, max };
              setZoomWindow(isFullWindow(next, full) ? null : next);
            },
          ],
        },
      };
      return new uPlot(opts, asAlignedData(chartData, [channel]), container);
    });
    lastRenderedChartKeyRef.current = chartDataKey;
    return () => {
      chartRefs.current.forEach((plot) => plot?.destroy());
      chartRefs.current = [];
    };
    // Only recreate when subplot assignments change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedSubplotsKey, selectedSessionId, updateCursorReadout]);

  useEffect(() => {
    const cleanups = chartRefs.current.flatMap((plot, index) => {
      const channel = assignedSubplots[index];
      if (!plot || !channel) return [];
      const handleWheel = (event: WheelEvent) => {
      const full = fullTimeWindow(chartDataRef.current.timestamps);
      if (!full) return;
      event.preventDefault();

      plot.syncRect();
      const rect = plot.over.getBoundingClientRect();
      const relativeLeft = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
      const focal = plot.posToVal(relativeLeft, "x");
      const currentMin = typeof plot.scales.x.min === "number" ? plot.scales.x.min : full.min;
      const currentMax = typeof plot.scales.x.max === "number" ? plot.scales.x.max : full.max;
      const currentSpan = Math.max(0.001, currentMax - currentMin);
      const fullSpan = full.max - full.min;
      const minSpan = Math.max(fullSpan / 500, 0.05);
      const zoomFactor = event.deltaY < 0 ? 0.78 : 1.28;
      const nextSpan = Math.min(fullSpan, Math.max(minSpan, currentSpan * zoomFactor));
      const ratio = currentSpan > 0 ? (focal - currentMin) / currentSpan : 0.5;
      let nextMin = focal - nextSpan * ratio;
      let nextMax = nextMin + nextSpan;

      if (nextMin < full.min) {
        nextMin = full.min;
        nextMax = full.min + nextSpan;
      }
      if (nextMax > full.max) {
        nextMax = full.max;
        nextMin = full.max - nextSpan;
      }

        setChartZoom({ min: nextMin, max: nextMax });
        updateCursorReadout(plot, [channel]);
      };

      plot.over.addEventListener("wheel", handleWheel, { passive: false });
      return [() => plot.over.removeEventListener("wheel", handleWheel)];
    });
    return () => cleanups.forEach((cleanupWheel) => cleanupWheel());
  }, [assignedSubplots, assignedSubplotsKey, selectedSessionId, setChartZoom, updateCursorReadout]);

  // Update data on snapshot change (unless paused)
  useEffect(() => {
    if (paused || chartRefs.current.length === 0) return;
    if (lastRenderedChartKeyRef.current === chartDataKey) return;
    chartRefs.current.forEach((plot, index) => {
      const channel = assignedSubplots[index];
      if (!plot || !channel) return;
      try {
        plot.setData(asAlignedData(chartData, [channel]), zoomWindow === null);
        if (zoomWindow) {
          const full = fullTimeWindow(chartData.timestamps);
          if (full) {
            const span = Math.min(zoomWindow.max - zoomWindow.min, full.max - full.min);
            const max = full.max;
            const min = Math.max(full.min, max - span);
            setChartZoom({ min, max });
          }
        }
        updateCursorReadout(plot, [channel]);
      } catch {
        // Ignore transient mismatches while live windows are refreshing.
      }
    });
    lastRenderedChartKeyRef.current = chartDataKey;
  }, [assignedSubplots, chartData, paused, setChartZoom, updateCursorReadout, zoomWindow]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      chartRefs.current.forEach((plot, index) => plot?.setSize(getChartSize(index)));
    };
    const observer = new ResizeObserver(handleResize);
    containerRefs.current.forEach((container) => {
      if (container) observer.observe(container);
    });
    window.addEventListener("resize", handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [assignedSubplotsKey]);

  const toggleChannel = (name: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.name === name ? { ...c, visible: !c.visible } : c)),
    );
  };

  const toggleGroup = (type: ChannelGroup) => {
    const group = channels.filter((c) => c.type === type);
    const allVisible = group.every((c) => c.visible);
    setChannels((prev) =>
      prev.map((c) => (c.type === type ? { ...c, visible: !allVisible } : c)),
    );
  };

  const assignSubplot = (index: number, channelName: string) => {
    setSubplotAssignments((prev) => prev.map((name, currentIndex) => (
      currentIndex === index ? channelName : name
    )));
  };

  return (
    <ChartLayout
      channelsLabel="曲线通道"
      toolbarLabel="曲线工具栏"
      channels={
        <ChannelSidebar
          channels={channels}
          subplotAssignments={subplotAssignments}
          onAssignSubplot={assignSubplot}
          onToggleChannel={toggleChannel}
          onToggleGroup={toggleGroup}
        />
      }
      toolbar={
        <ChartToolbar
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          paused={paused}
          playbackMode={activeSnapshot.playbackMode}
          status={chartError || exportPath || (zoomWindow ? `时间轴 ${zoomWindow.min.toFixed(2)}s ~ ${zoomWindow.max.toFixed(2)}s` : "滚轮缩放时间轴")}
          onSessionChange={setSelectedSessionId}
          onPauseChange={setPaused}
          onRefresh={() => setPaused(false)}
          onResetZoom={resetZoom}
          onExportCsv={() => void exportVisibleChannels()}
        />
      }
    >
      <div className="charts-main" ref={mainRef}>
        <div className="charts-readout" aria-live="polite">
          <div className="charts-readout-head">
            <Crosshair size={14} />
            <span>
              {cursorReadout
                ? `t=${cursorReadout.time.toFixed(2)}s · #${cursorReadout.index + 1}`
                : "移动鼠标查看垂直光标读数"}
            </span>
          </div>
          <div className="charts-readout-values" />
        </div>
        <div className="charts-subplot-grid">
          {assignedSubplots.map((channel, index) => (
            <section
              aria-label={`子图 ${index + 1} 曲线 ${channel?.name ?? "未分配"}`}
              className="chart-subplot"
              key={index}
            >
              <header className="chart-subplot-header">
                <span>子图 {index + 1}</span>
                <strong>{channel?.name ?? "未分配"}</strong>
                <span>{channel?.unit ?? "--"}</span>
              </header>
              <div
                className="chart-subplot-canvas"
                ref={(node) => {
                  containerRefs.current[index] = node;
                }}
              />
            </section>
          ))}
        </div>
        {paused ? <div className="charts-paused-overlay">已暂停 — 数据不再更新</div> : null}
        {activeSnapshot.playbackMode ? <div className="charts-playback-overlay">历史会话 — 已加载 {historyFrames.length} 帧</div> : null}
      </div>
    </ChartLayout>
  );
}
