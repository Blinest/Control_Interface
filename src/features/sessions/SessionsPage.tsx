import { Activity, Database } from "lucide-react";
import { EmptyState } from "../../components/data/EmptyState";
import { PathValue } from "../../components/data/PathValue";
import { ConfirmDialog } from "../../components/feedback/ConfirmDialog";
import { useSafeCommand } from "../device-workspace/useSafeCommand";
import { WorkbenchLayout } from "../../layouts/WorkbenchLayout";
import type { RecorderStatus, RuntimeSnapshot, SessionInfo } from "../../softuiTypes";
import { RecorderWorkbench } from "./RecorderWorkbench";
import { SessionsTable } from "./SessionsTable";
import "./sessions.css";

export interface SessionsPageProps {
  snapshot: RuntimeSnapshot;
  sessions: SessionInfo[];
  recorderStatus: RecorderStatus;
  onToggleRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, name: string) => void;
  onExportCsv: (id: string) => void;
  onLoadPlayback: (id: string) => void;
}

export default function SessionsPage({
  snapshot,
  sessions,
  recorderStatus,
  onToggleRecording,
  onPauseRecording,
  onResumeRecording,
  onDeleteSession,
  onRenameSession,
  onExportCsv,
  onLoadPlayback,
}: SessionsPageProps) {
  const safeCommand = useSafeCommand();
  const requestDelete = (session: SessionInfo) => {
    void safeCommand.execute(
      "deleteSession",
      { sessionId: session.id, sessionName: session.name },
      () => onDeleteSession(session.id),
    );
  };

  return (
    <WorkbenchLayout
      tabs={
        <div className="sessions-tabs-heading">
          <strong>会话与记录</strong>
        </div>
      }
      context={
        <RecorderWorkbench
          recorderStatus={recorderStatus}
          sessionsCount={sessions.length}
          onToggleRecording={onToggleRecording}
          onPauseRecording={onPauseRecording}
          onResumeRecording={onResumeRecording}
        />
      }
    >
      <div className="sessions-page-content">
        <header className="sessions-toolbar">
          <div>
            <div className="panel-kicker">sessions</div>
            <h2>历史会话</h2>
          </div>
          <PathValue value={snapshot.settings.dataDirectory} compact />
        </header>
        {sessions.length === 0 ? (
          <EmptyState
            title="暂无录制会话"
            reason="尚未开始录制，停止后会话会出现在这里。"
            context={`保存目录：${snapshot.settings.dataDirectory}`}
            action={
              <button type="button" className="primary-btn" onClick={onToggleRecording}>
                <Activity size={16} />
                <span>开始录制</span>
              </button>
            }
            icon={Database}
          />
        ) : (
          <SessionsTable
            sessions={sessions}
            onDeleteSession={requestDelete}
            onRenameSession={onRenameSession}
            onExportCsv={onExportCsv}
            onLoadPlayback={onLoadPlayback}
          />
        )}
      </div>
      <ConfirmDialog
        open={safeCommand.confirmation !== null}
        title={safeCommand.confirmation?.title ?? ""}
        details={safeCommand.confirmation?.details ?? []}
        confirmLabel={safeCommand.confirmation?.confirmLabel ?? ""}
        level={safeCommand.confirmation?.level ?? "warning"}
        onConfirm={() => void safeCommand.confirm()}
        onCancel={safeCommand.cancel}
      />
    </WorkbenchLayout>
  );
}
