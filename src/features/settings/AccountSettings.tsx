import { useState, type FormEvent } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { StatusBadge, type StatusBadgeTone } from "../../components/data/StatusBadge";
import type { Role, UserAccount } from "../../softuiTypes";
import "./settings.css";

export interface AccountSettingsProps {
  users: UserAccount[];
  currentUsername: string;
  canManageUsers: boolean;
  onCreateUser: (username: string, password: string, role: Role) => Promise<void>;
  onResetUserPassword: (username: string, newPassword: string) => Promise<void>;
  onSetUserDisabled: (username: string, disabled: boolean) => Promise<void>;
}

const userTone = (disabled: boolean): StatusBadgeTone => (disabled ? "error" : "ok");

export function AccountSettings({
  users,
  currentUsername,
  canManageUsers,
  onCreateUser,
  onResetUserPassword,
  onSetUserDisabled,
}: AccountSettingsProps) {
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<Role>("operator");
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState("");

  const runAccountAction = async (action: () => Promise<void>, successMessage: string) => {
    setAccountMessage("");
    try {
      await action();
      setAccountMessage(successMessage);
    } catch (invokeError) {
      setAccountMessage(invokeError instanceof Error ? invokeError.message : String(invokeError));
    }
  };

  const submitCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    await runAccountAction(async () => {
      await onCreateUser(newUsername, newUserPassword, newUserRole);
      setNewUsername("");
      setNewUserPassword("");
      setNewUserRole("operator");
    }, "用户已创建");
  };

  const submitResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    await runAccountAction(async () => {
      await onResetUserPassword(resetUsername, resetPassword);
      setResetPassword("");
    }, "密码已重置");
  };

  return (
    <section className="settings-section">
      <header>
        <h2>账户与权限</h2>
      </header>
      <div className="settings-kv-grid account-summary">
        <div>
          <span>当前用户</span>
          <strong>{currentUsername || "未登录"}</strong>
        </div>
        <div>
          <span>用户数量</span>
          <strong>{users.length}</strong>
        </div>
      </div>
      {canManageUsers ? (
        <>
          <div className="settings-user-list">
            {users.map((user) => (
              <div className="settings-user-row" key={user.username}>
                <div className="settings-user-main">
                  <strong>{user.username}</strong>
                  <span>{user.role}{user.mustChangePassword ? " / 需改密" : ""}</span>
                </div>
                <StatusBadge label={user.disabled ? "停用" : "启用"} tone={userTone(user.disabled)} />
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => void runAccountAction(
                    () => onSetUserDisabled(user.username, !user.disabled),
                    user.disabled ? "用户已启用" : "用户已停用",
                  )}
                  disabled={user.username === currentUsername}
                >
                  <span>{user.disabled ? "启用" : "停用"}</span>
                </button>
              </div>
            ))}
          </div>
          <form className="account-form" onSubmit={submitCreateUser}>
            <label>
              <span>新用户</span>
              <input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} placeholder="operator_1" />
            </label>
            <label>
              <span>初始密码</span>
              <input type="password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} />
            </label>
            <label>
              <span>角色</span>
              <select value={newUserRole} onChange={(event) => setNewUserRole(event.target.value as Role)}>
                <option value="operator">operator</option>
                <option value="maintainer">maintainer</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <button type="submit" className="primary-btn full" disabled={!newUsername.trim() || newUserPassword.length < 8}>
              <CheckCircle2 size={16} />
              <span>创建用户</span>
            </button>
          </form>
          <form className="account-form" onSubmit={submitResetPassword}>
            <label>
              <span>重置用户</span>
              <select value={resetUsername} onChange={(event) => setResetUsername(event.target.value)}>
                <option value="">选择用户</option>
                {users.map((user) => (
                  <option value={user.username} key={user.username}>{user.username}</option>
                ))}
              </select>
            </label>
            <label>
              <span>新密码</span>
              <input type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
            </label>
            <button type="submit" className="ghost-btn full" disabled={!resetUsername || resetPassword.length < 8}>
              <Save size={16} />
              <span>重置密码</span>
            </button>
          </form>
        </>
      ) : (
        <p className="settings-note">当前角色没有用户管理权限。</p>
      )}
      {accountMessage ? <p className="settings-note">{accountMessage}</p> : null}
    </section>
  );
}
