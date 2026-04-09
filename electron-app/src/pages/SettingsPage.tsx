import type { FormEvent } from "react";
import type { AppSettings, ProxyItem } from "../types";
import { PageTitle } from "../components/PageTitle";

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
                <p className="eyebrow">Mode</p>
                <h3>运行模式</h3>
              </div>
            </div>
            <div className="form-grid">
              <label className="field toggle-field">
                <span>Mock 测试模式</span>
                <input
                  type="checkbox"
                  checked={settings.mock_mode}
                  onChange={(event) => props.onChange({ ...settings, mock_mode: event.target.checked })}
                />
              </label>
              <label className="field toggle-field">
                <span>浏览器无头模式</span>
                <input
                  type="checkbox"
                  checked={settings.headless}
                  onChange={(event) => props.onChange({ ...settings, headless: event.target.checked })}
                />
              </label>
              <div className="helper-block field-span-2">
                <p>
                  当前模式：<strong>{settings.mock_mode ? "测试 / 演示" : "生产"}</strong>
                </p>
                <p>{settings.mock_mode ? "允许使用模拟账号检测和模拟收件。" : "账号检测和收件同步都会走真实 IMAP OAuth 链路。"}</p>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">OAuth</p>
                <h3>IMAP OAuth</h3>
              </div>
            </div>
            <div className="form-grid">
              <label className="field field-span-2">
                <span>默认 Client ID</span>
                <input value={settings.oauth.client_id} onChange={(event) => props.onChange({ ...settings, oauth: { ...settings.oauth, client_id: event.target.value } })} />
              </label>
              <label className="field field-span-2">
                <span>Redirect URI</span>
                <input
                  value={settings.oauth.redirect_uri}
                  onChange={(event) => props.onChange({ ...settings, oauth: { ...settings.oauth, redirect_uri: event.target.value } })}
                />
              </label>
              <label className="field field-span-2">
                <span>Scopes</span>
                <textarea
                  rows={4}
                  value={settings.oauth.scopes.join("\n")}
                  onChange={(event) =>
                    props.onChange({
                      ...settings,
                      oauth: {
                        ...settings.oauth,
                        scopes: event.target.value
                          .split(/\r?\n/)
                          .map((item) => item.trim())
                          .filter(Boolean),
                      },
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
                <p className="eyebrow">IMAP</p>
                <h3>IMAP 收件配置</h3>
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
                      mail_protocols: { imap: { ...settings.mail_protocols.imap, enabled: event.target.checked } },
                    })
                  }
                />
              </label>
              <label className="field toggle-field">
                <span>使用 SSL</span>
                <input
                  type="checkbox"
                  checked={settings.mail_protocols.imap.use_ssl}
                  onChange={(event) =>
                    props.onChange({
                      ...settings,
                      mail_protocols: { imap: { ...settings.mail_protocols.imap, use_ssl: event.target.checked } },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>主机</span>
                <input
                  value={settings.mail_protocols.imap.host}
                  onChange={(event) =>
                    props.onChange({
                      ...settings,
                      mail_protocols: { imap: { ...settings.mail_protocols.imap, host: event.target.value } },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>端口</span>
                <input
                  type="number"
                  value={settings.mail_protocols.imap.port}
                  onChange={(event) =>
                    props.onChange({
                      ...settings,
                      mail_protocols: { imap: { ...settings.mail_protocols.imap, port: Number(event.target.value) } },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>单次同步条数</span>
                <input
                  type="number"
                  min={1}
                  value={settings.mail.sync_batch_size}
                  onChange={(event) => props.onChange({ ...settings, mail: { ...settings.mail, sync_batch_size: Number(event.target.value) } })}
                />
              </label>
              <label className="field">
                <span>轮询间隔（分钟）</span>
                <input
                  type="number"
                  min={1}
                  value={settings.mail.poll_interval_minutes}
                  onChange={(event) => props.onChange({ ...settings, mail: { ...settings.mail, poll_interval_minutes: Number(event.target.value) } })}
                />
              </label>
              <div className="helper-block field-span-2">
                <p>已联通账号会按这里的轮询间隔在后台自动同步 Inbox。</p>
                <p>想更接近实时收件，可以把间隔调成 1 分钟。</p>
              </div>
            </div>
          </article>

          <article className="panel">
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
              {props.proxies.length === 0 ? <div className="empty-state">当前没有代理，默认按直连方式运行。</div> : null}
            </div>
          </article>
        </section>
      </form>
    </section>
  );
}
