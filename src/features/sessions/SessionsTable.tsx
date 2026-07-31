import { useMemo, useState } from "react";
import { Download, Edit3, Play, Search, Trash2, X } from "lucide-react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import type { SessionInfo } from "../../softuiTypes";
import "./sessions.css";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface SessionsTableProps {
  sessions: SessionInfo[];
  onDeleteSession: (session: SessionInfo) => void;
  onRenameSession: (id: string, name: string) => void;
  onExportCsv: (id: string) => void;
  onLoadPlayback: (id: string) => void;
}

export function SessionsTable({
  sessions,
  onDeleteSession,
  onRenameSession,
  onExportCsv,
  onLoadPlayback,
}: SessionsTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const columnHelper = createColumnHelper<SessionInfo>();

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "会话名称",
        cell: (info) => (
          <span className="text-truncate" title={info.getValue()} style={{ fontWeight: 600 }}>
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("frameCount", {
        header: "帧数",
        cell: (info) => info.getValue().toLocaleString(),
      }),
      columnHelper.accessor("fileSize", {
        header: "大小",
        cell: (info) => formatBytes(info.getValue()),
      }),
      columnHelper.accessor("operator", {
        header: "操作员",
        cell: (info) => info.getValue() ?? "无",
      }),
      columnHelper.accessor("startTime", {
        header: "开始时间",
        cell: (info) => {
          const value = info.getValue();
          if (!value) return "无";
          try {
            return new Date(value).toLocaleString("zh-CN");
          } catch {
            return value;
          }
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "操作",
        cell: (info) => {
          const session = info.row.original;
          const isRenaming = renamingId === session.id;
          return (
            <div className="session-actions">
              {isRenaming ? (
                <div className="session-rename-inline">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && renameValue.trim()) {
                        onRenameSession(session.id, renameValue.trim());
                        setRenamingId(null);
                      }
                      if (event.key === "Escape") setRenamingId(null);
                    }}
                    autoFocus
                    onClick={(event) => event.stopPropagation()}
                  />
                  <button
                    type="button"
                    className="ghost-btn-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (renameValue.trim()) {
                        onRenameSession(session.id, renameValue.trim());
                        setRenamingId(null);
                      }
                    }}
                    title="确认"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="ghost-btn-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onLoadPlayback(session.id);
                    }}
                    title="加载回放"
                  >
                    <Play size={12} />
                  </button>
                  <button
                    type="button"
                    className="ghost-btn-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onExportCsv(session.id);
                    }}
                    title="导出 CSV"
                  >
                    <Download size={12} />
                  </button>
                  <button
                    type="button"
                    className="ghost-btn-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      setRenamingId(session.id);
                      setRenameValue(session.name);
                    }}
                    title="重命名"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button
                    type="button"
                    className="ghost-btn-sm danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteSession(session);
                    }}
                    title="删除"
                    aria-label={`删除 ${session.name}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          );
        },
      }),
    ],
    [columnHelper, onDeleteSession, onExportCsv, onLoadPlayback, onRenameSession, renamingId, renameValue],
  );

  const table = useReactTable({
    data: sessions,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="sessions-table-shell">
      <div className="sessions-search">
        <Search size={14} />
        <input
          type="text"
          placeholder="搜索名称/操作员..."
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
        />
        {globalFilter ? (
          <button type="button" className="ghost-btn-sm" onClick={() => setGlobalFilter("")}>
            <X size={12} />
          </button>
        ) : null}
      </div>
      <div className="sessions-table-region">
        <table className="sessions-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="sessions-table-footer">
        <span>显示 {table.getRowModel().rows.length} / {sessions.length} 个会话</span>
      </footer>
    </div>
  );
}
