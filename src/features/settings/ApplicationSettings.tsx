import { PathValue } from "../../components/data/PathValue";
import type { RuntimeSnapshot } from "../../softuiTypes";
import "./settings.css";

export function ApplicationSettings({ snapshot }: { snapshot: RuntimeSnapshot }) {
  return (
    <section className="settings-section">
      <header>
        <h2>应用与路径</h2>
      </header>
      <div className="settings-kv-grid">
        <div>
          <span>应用名称</span>
          <strong>{snapshot.appInfo.name}</strong>
        </div>
        <div>
          <span>版本</span>
          <strong>{snapshot.appInfo.version}</strong>
        </div>
        <div>
          <span>后端</span>
          <strong>{snapshot.appInfo.backend}</strong>
        </div>
        <div>
          <span>前端</span>
          <strong>{snapshot.appInfo.frontend}</strong>
        </div>
        <div>
          <span>数据目录</span>
          <PathValue value={snapshot.settings.dataDirectory} />
        </div>
        <div>
          <span>模型目录</span>
          <PathValue value={snapshot.settings.modelDirectory} />
        </div>
        <div>
          <span>自动重连</span>
          <strong>{snapshot.settings.autoReconnect ? "启用" : "关闭"}</strong>
        </div>
        <div>
          <span>诊断级别</span>
          <strong>{snapshot.settings.diagnosticsLevel}</strong>
        </div>
      </div>
    </section>
  );
}
