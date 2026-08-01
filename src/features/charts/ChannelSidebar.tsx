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

export interface ChannelSidebarProps {
  channels: ChannelMeta[];
  subplotAssignments: string[];
  onToggleChannel: (name: string) => void;
  onToggleGroup: (type: ChannelGroup) => void;
  onAssignSubplot: (index: number, channelName: string) => void;
}

export function ChannelSidebar({
  channels,
  subplotAssignments,
  onToggleChannel,
  onToggleGroup,
  onAssignSubplot,
}: ChannelSidebarProps) {
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
              {channels.map((channel) => (
                <option key={channel.name} value={channel.name}>
                  {channel.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {(["motor", "bend", "sensor"] as ChannelGroup[]).map((group) => {
        const groupChannels = channels.filter((channel) => channel.type === group);
        if (groupChannels.length === 0) return null;
        const Icon = GROUP_ICONS[group];
        const allVisible = groupChannels.every((channel) => channel.visible);
        return (
          <div className="channel-group" key={group}>
            <button
              type="button"
              className={`channel-group-header ${allVisible ? "active" : ""}`}
              onClick={() => onToggleGroup(group)}
            >
              <Icon size={14} />
              <span>{GROUP_LABELS[group]}</span>
              <span className="channel-count">{groupChannels.length}</span>
            </button>
            <div className="channel-items">
              {groupChannels.map((channel) => (
                <label className={`channel-item ${channel.visible ? "active" : ""}`} key={channel.name}>
                  <input
                    type="checkbox"
                    checked={channel.visible}
                    onChange={() => onToggleChannel(channel.name)}
                  />
                  <span className="channel-dot" style={{ background: channel.color }} />
                  <span className="channel-name">{channel.name}</span>
                  <span className="channel-unit">{channel.unit}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
