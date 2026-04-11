import { RegisterProgressPanel } from "./register-progress-panel";
import type { RegisterConfig } from "../types/api";

type RegisterTaskPanelProps = {
  config: RegisterConfig;
  onConfigChange: (config: RegisterConfig) => void;
  isRegistering: boolean;
  taskId: number | null;
  onStart: () => void;
  onComplete: () => void;
};

export function RegisterTaskPanel({
  config,
  onConfigChange,
  isRegistering,
  taskId,
  onStart,
  onComplete,
}: RegisterTaskPanelProps) {
  const handleBrowserChange = (browser: string) => {
    onConfigChange({ ...config, browser });
  };

  const handleConcurrentChange = (value: number) => {
    onConfigChange({ ...config, concurrent_flows: value });
  };

  const handleMaxTasksChange = (value: number) => {
    onConfigChange({ ...config, max_tasks: value });
  };

  const handleEnableOAuth2Change = (enabled: boolean) => {
    onConfigChange({ ...config, enable_oauth2: enabled });
  };

  return (
    <div className="register-task-panel">
      {/* 配置区域 */}
      <div className="panel">
        <div className="panel-header">
          <h3>注册配置</h3>
          <p className="field-hint">配置批量注册的基本参数</p>
        </div>

        <div className="form-grid">
          <label>
            <span className="field-label">注册数量</span>
            <input
              className="text-input"
              disabled={isRegistering}
              max={100}
              min={1}
              onChange={(e) => handleMaxTasksChange(parseInt(e.target.value) || 1)}
              type="number"
              value={config.max_tasks}
            />
          </label>

          <label>
            <span className="field-label">并发数: {config.concurrent_flows}</span>
            <input
              className="slider"
              disabled={isRegistering}
              max={10}
              min={1}
              onChange={(e) => handleConcurrentChange(parseInt(e.target.value))}
              type="range"
              value={config.concurrent_flows}
            />
          </label>

          <div className="form-group">
            <span className="field-label">浏览器选择</span>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  checked={config.browser === "patchright"}
                  disabled={isRegistering}
                  name="browser"
                  onChange={() => handleBrowserChange("patchright")}
                  type="radio"
                  value="patchright"
                />
                <span>Patchright（推荐，更好的反检测）</span>
              </label>
              <label className="radio-label">
                <input
                  checked={config.browser === "playwright"}
                  disabled={isRegistering}
                  name="browser"
                  onChange={() => handleBrowserChange("playwright")}
                  type="radio"
                  value="playwright"
                />
                <span>Playwright</span>
              </label>
            </div>
          </div>

          <label className="checkbox-label">
            <input
              checked={config.enable_oauth2}
              disabled={isRegistering}
              onChange={(e) => handleEnableOAuth2Change(e.target.checked)}
              type="checkbox"
            />
            <span>注册完成后自动获取 OAuth2 Token</span>
          </label>
        </div>
      </div>

      {/* 操作区域 */}
      <div className="panel">
        <div className="panel-header">
          <h3>操作</h3>
        </div>
        <div className="panel-actions">
          <button
            className={`primary-button ${isRegistering ? "danger" : ""}`}
            disabled={isRegistering && !taskId}
            onClick={onStart}
            type="button"
          >
            {isRegistering ? "停止注册" : "开始批量注册"}
          </button>
        </div>
      </div>

      {/* 进度区域 */}
      {taskId && (
        <RegisterProgressPanel taskId={taskId} onComplete={onComplete} />
      )}
    </div>
  );
}
