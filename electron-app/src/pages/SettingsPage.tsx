import { FormEvent } from "react";
import { PageTitle } from "../components/PageTitle";
import type { AppSettings } from "../types";

export function SettingsPage(props: {
  settings: AppSettings;
  busy: boolean;
  onChange: (next: AppSettings) => void;
  onSave: (event: FormEvent) => void;
}) {
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="Settings"
        title="系统设置"
        description="这里所有配置都直接保存到 Python 后端的设置文件，保存后即刻生效于下一次任务。"
      />

      <article className="panel">
        <form className="settings-form" onSubmit={props.onSave}>
          <section className="settings-section">
            <div>
              <p className="eyebrow">Browser</p>
              <h3>浏览器与执行参数</h3>
            </div>
            <div className="form-grid">
              <FieldText
                label="浏览器路径"
                value={props.settings.browser_executable_path}
                onChange={(value) => props.onChange({ ...props.settings, browser_executable_path: value })}
              />
              <FieldText
                label="User-Agent"
                value={props.settings.user_agent}
                onChange={(value) => props.onChange({ ...props.settings, user_agent: value })}
              />
              <FieldNumber
                label="页面超时(ms)"
                value={props.settings.timeout_ms}
                onChange={(value) => props.onChange({ ...props.settings, timeout_ms: value })}
              />
              <FieldNumber
                label="验证码等待(ms)"
                value={props.settings.captcha_wait_ms}
                onChange={(value) => props.onChange({ ...props.settings, captcha_wait_ms: value })}
              />
            </div>
            <div className="switch-row">
              <Toggle
                label="模拟驱动"
                checked={props.settings.use_mock_driver}
                onChange={(checked) => props.onChange({ ...props.settings, use_mock_driver: checked })}
              />
              <Toggle
                label="无头模式"
                checked={props.settings.headless}
                onChange={(checked) => props.onChange({ ...props.settings, headless: checked })}
              />
            </div>
          </section>

          <section className="settings-section">
            <div>
              <p className="eyebrow">OAuth</p>
              <h3>OAuth 参数</h3>
            </div>
            <div className="form-grid">
              <FieldText
                label="Client ID"
                value={props.settings.client_id}
                onChange={(value) => props.onChange({ ...props.settings, client_id: value })}
              />
              <FieldText
                label="Redirect URL"
                value={props.settings.redirect_url}
                onChange={(value) => props.onChange({ ...props.settings, redirect_url: value })}
              />
            </div>
            <label>
              <span>Scopes</span>
              <textarea
                rows={5}
                value={props.settings.scopes.join("\n")}
                onChange={(event) =>
                  props.onChange({
                    ...props.settings,
                    scopes: event.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
          </section>

          <div className="settings-footer">
            <button className="solid-button" type="submit" disabled={props.busy}>
              保存设置
            </button>
          </div>
        </form>
      </article>
    </div>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={props.checked} onChange={(event) => props.onChange(event.target.checked)} />
      <span>{props.label}</span>
    </label>
  );
}

function FieldNumber(props: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      <span>{props.label}</span>
      <input type="number" value={props.value} onChange={(event) => props.onChange(Number(event.target.value))} />
    </label>
  );
}

function FieldText(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{props.label}</span>
      <input value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}
