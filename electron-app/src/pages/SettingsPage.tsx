import type { FormEvent } from "react";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { VIEW_META } from "../lib/content";
import { compactPath, formatBooleanText, formatDateTime, formatStatus, getStatusTone } from "../lib/format";
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
  const meta = VIEW_META.settings;
  const { settings } = props;

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
        actions={
          <button className="primary-button" type="submit" form="settings-form" disabled={props.busy}>
            保存设置
          </button>
        }
      />

      <section className="stat-grid stat-grid-three">
        <StatCard label="运行模式" value={settings.mock_mode ? "测试 / 演示" : "生产"} hint="决定是否走真实链路" tone={settings.mock_mode ? "warning" : "success"} />
        <StatCard label="单次同步上限" value={settings.mail.sync_batch_size} hint="批量同步时每次拉取的邮件数量" />
        <StatCard label="轮询间隔" value={`${settings.mail.poll_interval_minutes} 分钟`} hint="后台自动同步 Inbox 的默认节奏" />
      </section>

      <form id="settings-form" className="page-stack" onSubmit={props.onSave}>
        <section className="panel-grid panel-grid-two">
          <article className="panel">
            <div className="panel-header">
              <div className="panel-head-copy">
                <p className="eyebrow">Mode</p>
                <h3>运行模式</h3>
              </div>
            </div>
            <div className="form-grid">
              <label className="switch-field">
                <div>
                  <strong>Mock 测试模式</strong>
                  <p>启用后可以用模拟账号和模拟邮件验证前后端流程。</p>
                </div>
                <input type="checkbox" checked={settings.mock_mode} onChange={(event) => props.onChange({ ...settings, mock_mode: event.target.checked })} />
              </label>
              <label className="switch-field">
                <div>
                  <strong>浏览器无头模式</strong>
                  <p>适合后台运行；遇到复杂问题时可关闭方便人工观察。</p>
                </div>
                <input type="checkbox" checked={settings.headless} onChange={(event) => props.onChange({ ...settings, headless: event.target.checked })} />
              </label>
              <label className="field">
                <span>浏览器通道</span>
                <input value={settings.browser_channel} onChange={(event) => props.onChange({ ...settings, browser_channel: event.target.value })} />
              </label>
              <label className="field">
                <span>浏览器可执行文件</span>
                <input value={settings.browser_executable_path} onChange={(event) => props.onChange({ ...settings, browser_executable_path: event.target.value })} />
              </label>
              <label className="field">
                <span>超时时间（毫秒）</span>
                <input type="number" min={1000} value={settings.timeout_ms} onChange={(event) => props.onChange({ ...settings, timeout_ms: Number(event.target.value) })} />
              </label>
              <label className="field">
                <span>验证码等待（毫秒）</span>
                <input
                  type="number"
                  min={1000}
                  value={settings.captcha_wait_ms}
                  onChange={(event) => props.onChange({ ...settings, captcha_wait_ms: Number(event.target.value) })}
                />
              </label>
              <label className="field field-span-2">
                <span>User Agent</span>
                <input value={settings.user_agent} onChange={(event) => props.onChange({ ...settings, user_agent: event.target.value })} placeholder="为空时使用默认值" />
              </label>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div className="panel-head-copy">
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
                  rows={5}
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

        <section className="panel-grid panel-grid-two">
          <article className="panel">
            <div className="panel-header">
              <div className="panel-head-copy">
                <p className="eyebrow">IMAP</p>
                <h3>同步策略</h3>
              </div>
            </div>
            <div className="form-grid">
              <label className="switch-field">
                <div>
                  <strong>启用 IMAP</strong>
                  <p>关闭后邮件同步相关流程将不再执行。</p>
                </div>
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
              <label className="switch-field">
                <div>
                  <strong>使用 SSL</strong>
                  <p>建议保持开启，以符合 Outlook IMAP 默认安全连接策略。</p>
                </div>
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
                <span>单次同步数量</span>
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
            </div>
            <div className="callout">
              <strong>同步说明</strong>
              <p>已联通账号会按这里的轮询间隔在后台自动同步 Inbox。想更接近实时收件，可以把间隔控制在 1 分钟。</p>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div className="panel-head-copy">
                <p className="eyebrow">Proxy Pool</p>
                <h3>代理池</h3>
              </div>
              <button className="secondary-button" type="button" onClick={props.onImportProxies} disabled={props.busy}>
                导入代理
              </button>
            </div>
            {props.proxies.length > 0 ? (
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
                        <td>{compactPath(proxy.server, 46)}</td>
                        <td>{formatBooleanText(proxy.enabled)}</td>
                        <td>
                          <span className={`badge tone-${getStatusTone(proxy.status)}`}>{formatStatus(proxy.status)}</span>
                        </td>
                        <td>{formatDateTime(proxy.last_used_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="还没有代理配置" description="当前默认走直连模式；如果你需要更稳定的批量运行环境，可以从这里导入代理池。" />
            )}
          </article>
        </section>
      </form>
    </section>
  );
}
