import { MetricCard } from "../components/MetricCard";
import type { AppSnapshot, AppView } from "../types";

type DashboardPageProps = {
  snapshot: AppSnapshot;
  meta: { projectRoot: string; pythonExecutable: string } | null;
  onNavigate: (view: AppView) => void;
};

export function DashboardPage(props: DashboardPageProps) {
  const latestMailRun = props.snapshot.recent_mail_sync[0] ?? null;

  return (
    <section className="page-stack">
      <section className="metric-grid metric-grid-compact">
        <MetricCard label="账号总数" value={props.snapshot.summary.account_count} hint="账号中心统一账号池" />
        <MetricCard label="已联通账号" value={props.snapshot.summary.connected_account_count} hint="可进入邮件中心同步收件" />
        <MetricCard label="可联通账号" value={props.snapshot.summary.connectable_count} hint="已具备 OAuth 凭证，等待检测" />
        <MetricCard label="待处理账号" value={props.snapshot.summary.action_required_count} hint="缺少凭证或需要补充授权" />
      </section>

      <section className="three-column">
        <article className="panel panel-compact">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Accounts</p>
              <h3>账号状态</h3>
            </div>
            <button className="ghost-button" type="button" onClick={() => props.onNavigate("accounts")}>
              打开账号中心
            </button>
          </div>
          <div className="simple-list">
            <div className="simple-list-item">
              <span>联通失败账号</span>
              <strong>{props.snapshot.accounts.filter((item) => item.connectivity_status === "failed").length}</strong>
            </div>
            <div className="simple-list-item">
              <span>缺少凭证账号</span>
              <strong>{props.snapshot.accounts.filter((item) => !item.has_client_id || !item.has_refresh_token).length}</strong>
            </div>
            <div className="simple-list-item">
              <span>仅收件账号</span>
              <strong>{props.snapshot.accounts.filter((item) => item.mail_capability_status === "receive_only").length}</strong>
            </div>
          </div>
        </article>

        <article className="panel panel-compact">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Mailbox</p>
              <h3>邮件状态</h3>
            </div>
            <button className="ghost-button" type="button" onClick={() => props.onNavigate("mail")}>
              打开邮件中心
            </button>
          </div>
          <div className="simple-list">
            <div className="simple-list-item">
              <span>邮件总数</span>
              <strong>{props.snapshot.mail_summary.total_messages}</strong>
            </div>
            <div className="simple-list-item">
              <span>未读邮件</span>
              <strong>{props.snapshot.mail_summary.unread_messages}</strong>
            </div>
            <div className="simple-list-item">
              <span>最近同步状态</span>
              <strong>{props.snapshot.mail_summary.latest_run?.status ?? "-"}</strong>
            </div>
          </div>
        </article>

        <article className="panel panel-compact">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Runtime</p>
              <h3>运行环境</h3>
            </div>
          </div>
          <div className="simple-list">
            <div className="simple-list-item align-start">
              <div>
                <strong>项目目录</strong>
                <p>{props.meta?.projectRoot ?? "-"}</p>
              </div>
            </div>
            <div className="simple-list-item align-start">
              <div>
                <strong>Python 环境</strong>
                <p>{props.meta?.pythonExecutable ?? "-"}</p>
              </div>
            </div>
            <div className="simple-list-item">
              <span>最近刷新</span>
              <strong>{props.snapshot.generated_at}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="two-column">
        <article className="panel panel-compact">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Latest Sync</p>
              <h3>最近同步结果</h3>
            </div>
          </div>
          {latestMailRun ? (
            <div className="compact-detail">
              <div className="key-value-grid">
                <span>来源</span>
                <strong>{latestMailRun.source}</strong>
                <span>状态</span>
                <strong>{latestMailRun.status}</strong>
                <span>邮件数量</span>
                <strong>{latestMailRun.message_count}</strong>
                <span>完成时间</span>
                <strong>{latestMailRun.finished_at ?? latestMailRun.started_at ?? "-"}</strong>
              </div>
              {latestMailRun.latest_error ? <p className="inline-error">{latestMailRun.latest_error}</p> : null}
            </div>
          ) : (
            <div className="empty-state">还没有同步记录。</div>
          )}
        </article>

        <article className="panel panel-compact">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Alerts</p>
              <h3>关键提醒</h3>
            </div>
          </div>
          {props.snapshot.alerts.length > 0 ? (
            <div className="simple-list">
              {props.snapshot.alerts.map((alert) => (
                <div className="alert-card" key={`${alert.title}-${alert.detail}`}>
                  <strong>{alert.title}</strong>
                  <p>{alert.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">当前没有新的系统提醒。</div>
          )}
        </article>
      </section>
    </section>
  );
}
