import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, BarChart3 } from "lucide-react";
import "./charts.css";

export type ChannelGroup = "motor" | "bend" | "sensor";

export interface ChannelMeta {
  name: string;
  unit: string;
  type: ChannelGroup;
  index: number;
  visible: boolean;
  color: string;
}

export interface SubplotOption {
  value: string;
  label: string;
}

const GROUP_LABELS: Record<ChannelGroup, string> = {
  motor: "电机",
  bend: "弯曲",
  sensor: "传感器",
};

const GROUP_ICONS: Record<ChannelGroup, LucideIcon> = {
  motor: BarChart3,
  bend: Activity,
  sensor: Activity,
};

function assignmentIncludesChannel(assignment: string, channel: ChannelMeta) {
  if (assignment === channel.name || assignment === `channel:${channel.name}`) return true;

  const motorParts = /^Motor\s+(\d+)\s+(pos|vel|acc)$/.exec(channel.name);
  if (!motorParts) return false;

  const [, motorId, parameter] = motorParts;
  return assignment === `motor:${motorId}:all` || assignment === `motor-param:${parameter}`;
}

function assignedSubplotsForChannel(channel: ChannelMeta, subplotAssignments: string[]) {
  return subplotAssignments
    .map((assignment, index) => (assignmentIncludesChannel(assignment, channel) ? index + 1 : null))
    .filter((index): index is number => index !== null);
}

export interface ChannelSidebarProps {
  channels: ChannelMeta[];
  subplotAssignments: string[];
  subplotOptions: SubplotOption[];
  onAssignSubplot: (index: number, channelName: string) => void;
}

export function ChannelSidebar({
  channels,
  subplotAssignments,
  subplotOptions,
  onAssignSubplot,
}: ChannelSidebarProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredChannels = useMemo(
    () => channels.filter((channel) => (
      normalizedQuery.length === 0
        || channel.name.toLowerCase().includes(normalizedQuery)
        || channel.unit.toLowerCase().includes(normalizedQuery)
    )),
    [channels, normalizedQuery],
  );

  return (
    <div className="charts-sidebar">
      <div className="charts-sidebar-header">
        <strong>通道列表</strong>
      </div>
      <div className="subplot-assignment-list" aria-label="子图曲线分配">
        {subplotAssignments.map((channelName, index) => (
          <label className="subplot-assignment" key={index}>
            <span>子图 {index + 1}</span>
            <select
              aria-label={`子图 ${index + 1} 曲线`}
              value={channelName}
              onChange={(event) => onAssignSubplot(index, event.target.value)}
            >
              {subplotOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <input
        aria-label="过滤通道"
        className="channel-filter"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索通道或单位"
      />
      {(["motor", "bend", "sensor"] as ChannelGroup[]).map((group) => {
        const groupChannels = filteredChannels.filter((channel) => channel.type === group);
        if (groupChannels.length === 0) return null;
        const Icon = GROUP_ICONS[group];
        return (
          <div className="channel-group" key={group}>
            <div className="channel-group-header">
              <Icon size={14} />
              <span>{GROUP_LABELS[group]}</span>
              <span className="channel-count">{groupChannels.length}</span>
            </div>
            <div className="channel-items">
              {groupChannels.map((channel) => {
                const assignedSubplots = assignedSubplotsForChannel(channel, subplotAssignments);
                return (
                  <div
                    className={`channel-item${assignedSubplots.length > 0 ? " is-assigned" : ""}`}
                    data-assigned-subplots={assignedSubplots.join(",") || undefined}
                    key={channel.name}
                  >
                    <span className="channel-dot" style={{ background: channel.color }} />
                    <span className="channel-name">{channel.name}</span>
                    {assignedSubplots.length > 0 ? (
                      <span className="channel-assignment">子图 {assignedSubplots.join(",")}</span>
                    ) : null}
                    <span className="channel-unit">{channel.unit}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
