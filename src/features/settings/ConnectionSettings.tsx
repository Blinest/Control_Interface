import { PathValue } from "../../components/data/PathValue";
import type { RuntimeSnapshot } from "../../softuiTypes";
import "./settings.css";

export function ConnectionSettings({ snapshot }: { snapshot: RuntimeSnapshot }) {
  return (
    <section className="settings-section">
      <header>
        <h2>连接配置</h2>
      </header>
      <div className="settings-kv-grid">
        <div>
          <span>状态</span>
          <strong>{snapshot.connection.state}</strong>
        </div>
        <div>
          <span>活动配置</span>
          <strong>{snapshot.connection.activeProfileName}</strong>
        </div>
        <div>
          <span>可用端口</span>
          <strong>{snapshot.connection.ports.join("、") || "无"}</strong>
        </div>
        <div>
          <span>握手步骤</span>
          <strong>{snapshot.connection.handshakeStep}</strong>
        </div>
      </div>
      <div className="settings-profile-list">
        {snapshot.connection.profiles.map((profile) => (
          <div key={profile.id}>
            <span>{profile.name}</span>
            <PathValue value={`${profile.port} @ ${profile.baudRate}`} compact />
          </div>
        ))}
      </div>
    </section>
  );
}
