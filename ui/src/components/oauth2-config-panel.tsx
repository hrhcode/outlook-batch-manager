import type { OAuth2Settings } from "../types/api";

type OAuth2ConfigPanelProps = {
  form: OAuth2Settings;
  onChange: (form: OAuth2Settings) => void;
  onSave: () => void;
  isSaving: boolean;
  saveSuccess: boolean;
  saveError: Error | null;
};

const DEFAULT_SCOPES = [
  "offline_access",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/User.Read",
];

export function OAuth2ConfigPanel({
  form,
  onChange,
  onSave,
  isSaving,
  saveSuccess,
  saveError,
}: OAuth2ConfigPanelProps) {
  const handleReset = () => {
    onChange({
      client_id: "",
      redirect_url: "",
      scopes: DEFAULT_SCOPES,
    });
  };

  return (
    <div className="oauth2-config-panel">
      <div className="panel">
        <div className="panel-header">
          <h3>OAuth2 配置</h3>
          <p className="field-hint">
            配置用于批量注册时获取 OAuth2 Token 的全局设置
          </p>
        </div>

        <div className="form-grid">
          <label>
            <span className="field-label">Client ID</span>
            <input
              className="text-input"
              onChange={(e) => onChange({ ...form, client_id: e.target.value })}
              placeholder="Azure 应用程序 client_id"
              value={form.client_id}
            />
          </label>

          <label>
            <span className="field-label">Redirect URL</span>
            <input
              className="text-input"
              onChange={(e) =>
                onChange({ ...form, redirect_url: e.target.value })
              }
              placeholder="如 http://localhost:53682/"
              value={form.redirect_url}
            />
          </label>

          <label>
            <span className="field-label">Scopes（每行一个）</span>
            <textarea
              className="text-area"
              onChange={(e) =>
                onChange({
                  ...form,
                  scopes: e.target.value.split("\n").filter(Boolean),
                })
              }
              placeholder="输入OAuth2 scopes，每行一个"
              rows={6}
              value={form.scopes.join("\n")}
            />
          </label>
        </div>

        <div className="panel-actions">
          <button
            className="primary-button"
            disabled={isSaving}
            onClick={onSave}
            type="button"
          >
            {isSaving ? "保存中..." : "保存配置"}
          </button>
          <button
            className="secondary-button"
            onClick={handleReset}
            type="button"
          >
            重置
          </button>
        </div>

        {saveSuccess ? (
          <div className="notice notice-success" data-prefix="i">
            <p>配置已保存</p>
          </div>
        ) : null}

        {saveError ? (
          <div className="notice notice-error" data-prefix="!">
            <p>
              保存失败：
              {saveError instanceof Error
                ? saveError.message
                : "未知错误"}
            </p>
          </div>
        ) : null}
      </div>

      <div className="panel panel-muted">
        <div className="panel-header">
          <h3>配置说明</h3>
        </div>
        <div className="info-content">
          <p>
            <strong>Client ID：</strong>
            在 Azure Active Directory 中注册的应用程序 ID
          </p>
          <p>
            <strong>Redirect URL：</strong>
            OAuth2 授权回调地址，需要与 Azure 应用配置一致
          </p>
          <p>
            <strong>Scopes：</strong>
            申请的权限范围，用于获取访问令牌
          </p>
          <p className="field-hint">
            提示：配置完成后，在注册任务标签页勾选"自动获取 OAuth2 Token"即可在注册完成后自动获取Token。
          </p>
        </div>
      </div>
    </div>
  );
}
