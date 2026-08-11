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

interface MotorChannelParts {
  motorId: number;
  parameter: "pos" | "vel" | "acc";
}

interface SubplotOption {
  value: string;
  label: string;
}

const MAX_RENDER_POINTS = 900;
const SUBPLOT_COUNT = 6;
const MOTOR_PARAMETER_ORDER = ["pos", "vel", "acc"] as const;

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
  const options = buildSubplotOptions(channels);
  const available = options.map((option) => option.value);
  return Array.from({ length: SUBPLOT_COUNT }, (_, index) => {
    const current = previous[index];
    if (current && available.includes(current)) return current;
    const currentAsChannel = current && channels.some((channel) => channel.name === current)
      ? channelAssignmentId(current)
      : null;
    if (currentAsChannel && available.includes(currentAsChannel)) return currentAsChannel;
    return options[index % Math.max(options.length, 1)]?.value ?? "";
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

function channelAssignmentId(channelName: string) {
  return `channel:${channelName}`;
}

function parseMotorChannel(channelName: string): MotorChannelParts | null {
  const match = /^Motor\s+(\d+)\s+(pos|vel|acc)$/.exec(channelName);
  if (!match) return null;
  return {
    motorId: Number(match[1]),
    parameter: match[2] as MotorChannelParts["parameter"],
  };
}

function channelScaleKey(channel: ChannelMeta) {
  if (channel.type === "sensor") return "N";
  return channel.unit || "value";
}

function uniqueUnits(channels: ChannelMeta[]) {
  return Array.from(new Set(channels.map((channel) => channel.unit || "--")));
}

function buildSeriesAxes(subplotChannels: ChannelMeta[]): {
  axes: uPlot.Axis[];
  scales: Record<string, uPlot.Scale>;
  series: uPlot.Series[];
} {
  const scaleKeys = Array.from(new Set(subplotChannels.map(channelScaleKey)));
  return {
    scales: Object.fromEntries(scaleKeys.map((scaleKey) => [scaleKey, {}])) as Record<string, uPlot.Scale>,
    series: subplotChannels.map((channel) => ({
      label: channel.name,
      scale: channelScaleKey(channel),
      stroke: channel.color,
      width: 1.5,
      points: { show: false },
    })) as uPlot.Series[],
    axes: scaleKeys.map((scaleKey, index) => ({
      label: scaleKey,
      scale: scaleKey,
      stroke: "#888",
      grid: { stroke: index === 0 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0)" },
      side: 1,
      size: 44,
    })) as uPlot.Axis[],
  };
}

function buildSubplotOptions(channels: ChannelMeta[]): SubplotOption[] {
  const options: SubplotOption[] = channels.map((channel) => ({
    value: channelAssignmentId(channel.name),
    label: channel.name,
  }));
  const motorChannels = channels
    .map((channel) => ({ channel, parts: parseMotorChannel(channel.name) }))
    .filter((item): item is { channel: ChannelMeta; parts: MotorChannelParts } => item.parts !== null);
  const motorIds = Array.from(new Set(motorChannels.map((item) => item.parts.motorId))).sort((a, b) => a - b);
  for (const motorId of motorIds) {
    if (motorChannels.filter((item) => item.parts.motorId === motorId).length > 1) {
      options.push({ value: `motor:${motorId}:all`, label: `Motor ${motorId} 全部参数` });
    }
  }
  for (const parameter of MOTOR_PARAMETER_ORDER) {
    if (motorChannels.filter((item) => item.parts.parameter === parameter).length > 1) {
      options.push({ value: `motor-param:${parameter}`, label: `全部电机 ${parameter}` });
    }
  }
  return options;
}

function resolveSubplotChannels(assignment: string, channels: ChannelMeta[]): ChannelMeta[] {
  const directName = assignment.startsWith("channel:") ? assignment.slice("channel:".length) : assignment;
  const direct = channels.find((channel) => channel.name === directName);
  if (direct) return [direct];

  const motorMatch = /^motor:(\d+):all$/.exec(assignment);
  if (motorMatch) {
    const motorId = Number(motorMatch[1]);
    return channels
      .filter((channel) => {
        const parts = parseMotorChannel(channel.name);
        return parts?.motorId === motorId;
      })
      .sort((a, b) => {
        const aParameter = parseMotorChannel(a.name)?.parameter;
        const bParameter = parseMotorChannel(b.name)?.parameter;
        return MOTOR_PARAMETER_ORDER.indexOf(aParameter ?? "pos") - MOTOR_PARAMETER_ORDER.indexOf(bParameter ?? "pos");
      });
  }

  const parameterMatch = /^motor-param:(pos|vel|acc)$/.exec(assignment);
  if (parameterMatch) {
    return channels
      .filter((channel) => parseMotorChannel(channel.name)?.parameter === parameterMatch[1])
      .sort((a, b) => a.index - b.index);
  }

  return [];
}

function describeSubplotAssignment(assignment: string, channels: ChannelMeta[]) {
  const resolved = resolveSubplotChannels(assignment, channels);
  if (resolved.length === 0) return "未分配";
  if (resolved.length === 1) return resolved[0].name;
  const option = buildSubplotOptions(channels).find((candidate) => candidate.value === assignment);
  return option?.label ?? `${resolved.length} 条曲线`;
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
  const activeCursorSubplotRef = useRef<number | null>(null);
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
  const [subplotZoomWindows, setSubplotZoomWindows] = useState<Array<ZoomWindow | null>>(
    () => Array.from({ length: SUBPLOT_COUNT }, () => null),
  );
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

  const visibleSeries = channels;
  const subplotAssignmentsKey = useMemo(() => subplotAssignments.join("|"), [subplotAssignments]);
  const subplotOptions = useMemo(() => buildSubplotOptions(channels), [channels]);
  const assignedSubplots = useMemo(
    () => subplotAssignments.map((assignment) => resolveSubplotChannels(assignment, channels)),
    [channels, subplotAssignmentsKey],
  );
  const assignedSubplotsKey = useMemo(
    () => assignedSubplots.map((subplotChannels) => subplotChannels.map((channel) => channel.name).join(",")).join("|"),
    [assignedSubplots],
  );
  const chartData = useMemo(() => makeTimestamps(activeSnapshot), [activeSnapshot.charts]);
  const chartDataKey = useMemo(() => {
    const timestamps = chartData.timestamps;
    const lastIndex = timestamps.length - 1;
    const lastTime = lastIndex >= 0 ? timestamps[lastIndex] : 0;
    const seriesKeys = assignedSubplots
      .map((subplotChannels) => {
        if (subplotChannels.length === 0) return "empty";
        return subplotChannels.map((channel) => {
          const values = chartData.series[channel.name] ?? [];
          const lastValue = values[values.length - 1] ?? 0;
          return `${channel.name}:${values.length}:${lastValue}`;
        }).join(",");
      })
      .join("|");
    return `${selectedSessionId}:${timestamps.length}:${lastTime}:${seriesKeys}`;
  }, [assignedSubplots, chartData, selectedSessionId]);
  const chartDataRef = useRef(chartData);
  const activeZoomWindow = useMemo(
    () => subplotZoomWindows.find((window): window is ZoomWindow => window !== null) ?? null,
    [subplotZoomWindows],
  );

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

  const updateCursorReadout = useCallback((subplotIndex: number, plot: uPlot, readoutChannels: ChannelMeta[]) => {
    if (cursorFrameRef.current !== null) {
      window.cancelAnimationFrame(cursorFrameRef.current);
    }

    const idx = typeof plot.cursor.idx === "number" ? plot.cursor.idx : null;
    const timestamps = chartDataRef.current.timestamps;
    const visible = readoutChannels;

    cursorFrameRef.current = window.requestAnimationFrame(() => {
      if (idx === null || idx < 0 || idx >= timestamps.length) {
        if (activeCursorSubplotRef.current !== subplotIndex) {
          cursorFrameRef.current = null;
          return;
        }
        activeCursorSubplotRef.current = null;
        renderCursorReadout(null, null, visible.map((channel) => ({
          name: channel.name,
          unit: channel.unit,
          color: channel.color,
          value: null,
        })));
        cursorFrameRef.current = null;
        return;
      }

      activeCursorSubplotRef.current = subplotIndex;
      const values = visible.map((channel, seriesIndex) => {
        const series = chartDataRef.current.series[channel.name] ?? (plot.data[seriesIndex + 1] as number[] | undefined);
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
    activeCursorSubplotRef.current = null;
    renderCursorReadout(null, null, assignedSubplots.flat().map((channel) => ({
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

  const setChartZoom = useCallback((index: number, next: ZoomWindow) => {
    const full = fullTimeWindow(chartDataRef.current.timestamps);
    if (!full) return;
    chartRefs.current[index]?.setScale("x", next);
    setSubplotZoomWindows((previous) => {
      const updated = Array.from({ length: SUBPLOT_COUNT }, (_, subplotIndex) => previous[subplotIndex] ?? null);
      updated[index] = isFullWindow(next, full) ? null : next;
      return updated;
    });
  }, []);

  const resetZoom = useCallback(() => {
    const full = fullTimeWindow(chartDataRef.current.timestamps);
    if (!full) return;
    chartRefs.current.forEach((plot) => plot?.setScale("x", full));
    setSubplotZoomWindows(Array.from({ length: SUBPLOT_COUNT }, () => null));
  }, []);

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
    chartRefs.current = assignedSubplots.map((subplotChannels, index) => {
      const container = containerRefs.current[index];
      if (!container || subplotChannels.length === 0) return null;
      const seriesAxes = buildSeriesAxes(subplotChannels);
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
          ...seriesAxes.scales,
        },
        series: [
          {} as uPlot.Series,
          ...seriesAxes.series,
        ],
        axes: [
          {
            label: "时间",
            scale: "x",
            stroke: "#888",
            grid: { stroke: "rgba(255,255,255,0.06)" },
          },
          ...seriesAxes.axes,
        ],
        hooks: {
          setCursor: [(plot) => updateCursorReadout(index, plot, subplotChannels)],
          setScale: [
            (plot, scaleName) => {
              if (scaleName !== "x") return;
              const min = plot.scales.x.min;
              const max = plot.scales.x.max;
              const full = fullTimeWindow(chartDataRef.current.timestamps);
              if (typeof min !== "number" || typeof max !== "number" || !full) return;
              const next = { min, max };
              setSubplotZoomWindows((previous) => {
                const updated = Array.from({ length: SUBPLOT_COUNT }, (_, subplotIndex) => previous[subplotIndex] ?? null);
                updated[index] = isFullWindow(next, full) ? null : next;
                return updated;
              });
            },
          ],
        },
      };
      return new uPlot(opts, asAlignedData(chartData, subplotChannels), container);
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
      const subplotChannels = assignedSubplots[index];
      if (!plot || subplotChannels.length === 0) return [];
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

        setChartZoom(index, { min: nextMin, max: nextMax });
        updateCursorReadout(index, plot, subplotChannels);
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
      const subplotChannels = assignedSubplots[index];
      if (!plot || subplotChannels.length === 0) return;
      try {
        const zoomWindow = subplotZoomWindows[index] ?? null;
        plot.setData(asAlignedData(chartData, subplotChannels), zoomWindow === null);
        if (zoomWindow) {
          const full = fullTimeWindow(chartData.timestamps);
          if (full) {
            const span = Math.min(zoomWindow.max - zoomWindow.min, full.max - full.min);
            const max = full.max;
            const min = Math.max(full.min, max - span);
            setChartZoom(index, { min, max });
          }
        }
        updateCursorReadout(index, plot, subplotChannels);
      } catch {
        // Ignore transient mismatches while live windows are refreshing.
      }
    });
    lastRenderedChartKeyRef.current = chartDataKey;
  }, [assignedSubplots, chartData, paused, setChartZoom, subplotZoomWindows, updateCursorReadout]);

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
          subplotOptions={subplotOptions}
          onAssignSubplot={assignSubplot}
        />
      }
      toolbar={
        <ChartToolbar
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          paused={paused}
          playbackMode={activeSnapshot.playbackMode}
          status={chartError || exportPath || (activeZoomWindow ? `时间轴 ${activeZoomWindow.min.toFixed(2)}s ~ ${activeZoomWindow.max.toFixed(2)}s` : "滚轮缩放时间轴")}
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
          {assignedSubplots.map((subplotChannels, index) => {
            const assignmentLabel = describeSubplotAssignment(subplotAssignments[index] ?? "", channels);
            const units = uniqueUnits(subplotChannels).join(" / ");
            return (
              <section
                aria-label={`子图 ${index + 1} 曲线 ${assignmentLabel}`}
                className="chart-subplot"
                key={index}
              >
                <header className="chart-subplot-header">
                  <span>子图 {index + 1}</span>
                  <strong>{assignmentLabel}</strong>
                  <span>{units || "--"}</span>
                </header>
                <div
                  className="chart-subplot-canvas"
                  ref={(node) => {
                    containerRefs.current[index] = node;
                  }}
                />
              </section>
            );
          })}
        </div>
        {paused ? <div className="charts-paused-overlay">已暂停 — 数据不再更新</div> : null}
        {activeSnapshot.playbackMode ? <div className="charts-playback-overlay">历史会话 — 已加载 {historyFrames.length} 帧</div> : null}
      </div>
    </ChartLayout>
  );
}
