import type { FormEvent } from "react";
import { PageTitle } from "../components/PageTitle";
import type { AppSettings, ProxyItem } from "../types";

type SettingsPageProps = {
  settings: AppSettings;
  proxies: ProxyItem[];
  busy: boolean;
  onChange: (next: AppSettings) => void;
  onSave: (event: FormEvent) => void;
  onImportProxies: () => void;
};

export function SettingsPage(props: SettingsPageProps) {
  const { settings } = props;

  return (
    <section className="page-stack">
      <PageTitle
        eyebrow="Settings"
        title="设置"
        description="统一管理浏览器、OAuth、代理池和邮件同步策略，避免分散配置造成混乱。"
        actions={
          <button className="primary-button" type="submit" form="settings-form" disabled={props.busy}>
            保存设置
          </button>
        }
      />

      <form id="settings-form" className="page-stack" onSubmit={props.onSave}>
        <section className="two-column">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Browser</p>
                <h3>浏览器与自动化</h3>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>浏览器通道</span>
                <input
                  value={settings.browser_channel}
                  onChange={(event) => props.onChange({ ...settings, browser_channel: event.target.value })}
                />
              </label>
              <label className="field">
                <span>可执行文件路径</span>
                <input
                  value={settings.browser_executable_path}
                  onChange={(event) => props.onChange({ ...settings, browser_executable_path: event.target.value })}
                />
              </label>
              <label className="field">
                <span>超时 (ms)</span>
                <input
                  type="number"
                  value={settings.timeout_ms}
                  onChange={(event) => props.onChange({ ...settings, timeout_ms: Number(event.target.value) })}
                />
              </label>
              <label className="field">
                <span>验证码等待 (ms)</span>
                <input
                  type="number"
                  value={settings.captcha_wait_ms}
                  onChange={(event) => props.onChange({ ...settings, captcha_wait_ms: Number(event.target.value) })}
                />
              </label>
              <label className="field field-span-2">
                <span>User-Agent</span>
                <input
                  value={settings.user_agent}
                  onChange={(event) => props.onChange({ ...settings, user_agent: event.target.value })}
                />
              </label>
              <label className="field toggle-field">
                <span>启用模拟驱动</span>
                <input
                  type="checkbox"
                  checked={settings.use_mock_driver}
                  onChange={(event) => props.onChange({ ...settings, use_mock_driver: event.target.checked })}
                />
              </label>
              <label className="field toggle-field">
                <span>默认无头模式</span>
                <input
                  type="checkbox"
                  checked={settings.headless}
                  onChange={(event) => props.onChange({ ...settings, headless: event.target.checked })}
                />
              </label>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">OAuth</p>
                <h3>默认 OAuth 参数</h3>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Client ID</span>
                <input
                  value={settings.client_id}
                  onChange={(event) => props.onChange({ ...settings, client_id: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Redirect URL</span>
                <input
                  value={settings.redirect_url}
                  onChange={(event) => props.onChange({ ...settings, redirect_url: event.target.value })}
                />
              </label>
              <label className="field field-span-2">
                <span>Scopes</span>
                <textarea
                  rows={4}
                  value={settings.scopes.join("\n")}
                  onChange={(event) =>
                    props.onChange({
                      ...settings,
                      scopes: event.target.value
                        .split(/\r?\n/)
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
            </div>
          </article>
        </section>

        <section className="two-column">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Mail</p>
                <h3>邮件同步策略</h3>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>默认来源</span>
                <select
                  value={settings.mail_sync.default_source}
                  onChange={(event) =>
                    props.onChange({
                      ...settings,
                      mail_sync: { ...settings.mail_sync, default_source: event.target.value as AppSettings["mail_sync"]["default_source"] },
                    })
                  }
                >
                  <option value="auto">auto</option>
                  <option value="graph">graph</option>
                  <option value="imap">imap</option>
                  <option value="pop">pop</option>
                </select>
              </label>
              <label className="field">
                <span>默认同步条数</span>
                <input
                  type="number"
                  value={settings.mail_sync.batch_limit}
                  onChange={(event) =>
                    props.onChange({
                      ...settings,
                      mail_sync: { ...settings.mail_sync, batch_limit: Number(event.target.value) },
                    })
                  }
                />
              </label>
              <label className="field toggle-field">
                <span>默认仅同步未读</span>
                <input
                  type="checkbox"
                  checked={settings.mail_sync.unread_only}
                  onChange={(event) =>
                    props.onChange({
                      ...settings,
                      mail_sync: { ...settings.mail_sync, unread_only: event.target.checked },
                    })
                  }
                />
              </label>
              <label className="field toggle-field">
                <span>Graph 失败回退协议</span>
                <input
                  type="checkbox"
                  checked={settings.mail_sync.graph_fallback_to_imap}
                  onChange={(event) =>
                    props.onChange({
                      ...settings,
                      mail_sync: { ...settings.mail_sync, graph_fallback_to_imap: event.target.checked },
                    })
                  }
                />
              </label>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">IMAP / POP</p>
                <h3>协议参数</h3>
              </div>
            </div>
            <div className="form-grid">
              <label className="field toggle-field">
                <span>启用 IMAP</span>
                <input
                  type="checkbox"
                  checked={settings.mail_protocols.imap.enabled}
                  onChange={(event) =>
                    props.onChange({
                      ...settings,
                      mail_protocols: {
                        ...settings.mail_protocols,
                        imap: { ...settings.mail_protocols.imap, enabled: event.target.checked },
                      },
                    })
                  }
                />
              </label>
              <label className="field toggle-field">
                <span>启用 POP</span>
                <input
                  type="checkbox"
                  checked={settings.mail_protocols.pop.enabled}
                  onChange={(event) =>
                    props.onChange({
                      ...settings,
                      mail_protocols: {
                        ...settings.mail_protocols,
                        pop: { ...settings.mail_protocols.pop, enabled: event.target.checked },
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>IMAP Host</span>
                <input
                  value={settings.mail_protocols.imap.host}
                  onChange={(event) =>
                    props.onChange({
                      ...settings,
                      mail_protocols: {
                        ...settings.mail_protocols,
                        imap: { ...settings.mail_protocols.imap, host: event.target.value },
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>IMAP Port</span>
                <input
                  type="number"
                  value={settings.mail_protocols.imap.port}
                  onChange={(event) =>
                    props.onChange({
                      ...settings,
                      mail_protocols: {
                        ...settings.mail_protocols,
                        imap: { ...settings.mail_protocols.imap, port: Number(event.target.value) },
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>POP Host</span>
                <input
                  value={settings.mail_protocols.pop.host}
                  onChange={(event) =>
                    props.onChange({
                      ...settings,
                      mail_protocols: {
                        ...settings.mail_protocols,
                        pop: { ...settings.mail_protocols.pop, host: event.target.value },
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>POP Port</span>
                <input
                  type="number"
                  value={settings.mail_protocols.pop.port}
                  onChange={(event) =>
                    props.onChange({
                      ...settings,
                      mail_protocols: {
                        ...settings.mail_protocols,
                        pop: { ...settings.mail_protocols.pop, port: Number(event.target.value) },
                      },
                    })
                  }
                />
              </label>
            </div>
          </article>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Proxy Pool</p>
              <h3>代理池</h3>
            </div>
            <button className="ghost-button" type="button" onClick={props.onImportProxies} disabled={props.busy}>
              导入代理
            </button>
          </div>
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>代理地址</th>
                  <th>启用</th>
                  <th>健康状态</th>
                  <th>最近使用</th>
                </tr>
              </thead>
              <tbody>
                {props.proxies.map((proxy) => (
                  <tr key={proxy.id ?? proxy.server}>
                    <td>{proxy.server}</td>
                    <td>{proxy.enabled ? "是" : "否"}</td>
                    <td>
                      <span className={`status-badge status-${proxy.status}`}>{proxy.status}</span>
                    </td>
                    <td>{proxy.last_used_at ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {props.proxies.length === 0 ? <div className="empty-state">还没有导入代理，当前任务会按无代理模式运行。</div> : null}
          </div>
        </section>
      </form>
    </section>
  );
}
