import type { RegisterConfig } from "../types/api";

type AdvancedConfigPanelProps = {
  config: RegisterConfig;
  onChange: (config: RegisterConfig) => void;
};

export function AdvancedConfigPanel({
  config,
  onChange,
}: AdvancedConfigPanelProps) {
  const handleWaitChange = (value: number) => {
    onChange({ ...config, bot_protection_wait: value });
  };

  const handleRetriesChange = (value: number) => {
    onChange({ ...config, max_captcha_retries: value });
  };

  return (
    <div className="advanced-config-panel">
      <div className="panel">
        <div className="panel-header">
          <h3>高级设置</h3>
          <p className="field-hint">配置批量注册的高级参数，一般情况下使用默认值即可</p>
        </div>

        <div className="form-grid">
          <label>
            <span className="field-label">
              人机验证等待时间: {config.bot_protection_wait} 秒
            </span>
            <input
              className="slider"
              max={30}
              min={5}
              onChange={(e) => handleWaitChange(parseInt(e.target.value))}
              type="range"
              value={config.bot_protection_wait}
            />
            <p className="field-hint">
              注册过程中等待页面加载的时间，用于绕过人机验证检测
            </p>
          </label>

          <label>
            <span className="field-label">
              验证码重试次数: {config.max_captcha_retries} 次
            </span>
            <input
              className="slider"
              max={5}
              min={1}
              onChange={(e) => handleRetriesChange(parseInt(e.target.value))}
              type="range"
              value={config.max_captcha_retries}
            />
            <p className="field-hint">
              验证码识别失败时的最大重试次数
            </p>
          </label>
        </div>
      </div>

      <div className="panel panel-muted">
        <div className="panel-header">
          <h3>参数说明</h3>
        </div>
        <div className="info-content">
          <p>
            <strong>人机验证等待时间：</strong>
            在注册流程中，某些操作后需要等待一段时间以模拟真实用户行为，避免被反机器人系统检测。
            建议值：10-15秒
          </p>
          <p>
            <strong>验证码重试次数：</strong>
            当验证码识别失败时，会自动重试。设置过大的值可能会增加注册时间，设置过小可能会导致注册失败率升高。
            建议值：2-3次
          </p>
          <p className="field-hint">
            注意：修改高级设置可能会影响注册成功率和速度，请根据实际情况调整。
          </p>
        </div>
      </div>
    </div>
  );
}
