import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { VIEW_META } from "../lib/content";
import {
  compactPath,
  formatDateTime,
  formatMailCapability,
  formatStatus,
  formatTaskType,
  getAlertTone,
  getConnectivityTone,
  getStatusTone,
} from "../lib/format";
import type { AppSnapshot, AppView } from "../types";

type DashboardPageProps = {
  snapshot: AppSnapshot;
  meta: { projectRoot: string; pythonExecutable: string } | null;
  onNavigate: (view: AppView) => void;
};

export function DashboardPage(props: DashboardPageProps) {
  const meta = VIEW_META.dashboard;
  const latestMailRun = props.snapshot.recent_mail_sync[0] ?? null;
  const latestTask = props.snapshot.latest_task_summary;
  const missingCredentialCount = props.snapshot.accounts.filter((item) => !item.has_client_id || !item.has_refresh_token).length;
  const failedConnectivityCount = props.snapshot.accounts.filter((item) => item.connectivity_status === "failed").length;
  const readyForCheckCount = props.snapshot.accounts.filter((item) => item.connectivity_status === "connectable").length;
  const receiveOnlyCount = props.snapshot.accounts.filter((item) => item.mail_capability_status === "receive_only").length;

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
        actions={
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => props.onNavigate("accounts")}>
              打开账号中心
            </button>
            <button type="button" className="secondary-button" onClick={() => props.onNavigate("mail")}>
              打开邮件中心
            </button>
            <button type="button" className="primary-button" onClick={() => props.onNavigate("register")}>
              启动批量注册
            </button>
          </div>
        }
        aside={<span className="subtle-chip">最近刷新 {formatDateTime(props.snapshot.generated_at)}</span>}
      />

      <section className="stat-grid stat-grid-four">
        <StatCard label="账号总数" value={props.snapshot.summary.account_count} hint="统一账号池中的全部账号" />
        <StatCard
          label="可同步账号"
          value={props.snapshot.summary.connected_account_count}
          hint="已经通过联通检测，可直接进入邮件同步"
          tone="success"
        />
        <StatCard label="待检测账号" value={props.snapshot.summary.connectable_count} hint="凭证已补齐，等待联通验证" tone="warning" />
        <StatCard label="待处理账号" value={props.snapshot.summary.action_required_count} hint="仍需补凭证或继续排障" tone="danger" />
      </section>

      <section className="panel-grid panel-grid-three">
        <article className="panel">
          <div className="panel-header">
            <div className="panel-head-copy">
              <p className="eyebrow">Accounts</p>
              <h3>账号运营提醒</h3>
            </div>
          </div>
          <div className="list-block">
            <div className="list-row">
              <div>
                <strong>待补凭证</strong>
                <p>缺少 client_id 或 refresh_token，无法进入联通检测。</p>
              </div>
              <span className="badge tone-warning">{missingCredentialCount}</span>
            </div>
            <div className="list-row">
              <div>
                <strong>检测失败</strong>
                <p>近期联通失败的账号，需要复查网络、凭证或状态。</p>
              </div>
              <span className="badge tone-danger">{failedConnectivityCount}</span>
            </div>
            <div className="list-row">
              <div>
                <strong>待联通验证</strong>
                <p>这些账号已具备基础凭证，可以继续做检测。</p>
              </div>
              <span className="badge tone-warning">{readyForCheckCount}</span>
            </div>
            <div className="list-row">
              <div>
                <strong>邮件能力就绪</strong>
                <p>已经具备收件能力的账号，可用于后续同步。</p>
              </div>
              <span className="badge tone-success">{receiveOnlyCount}</span>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div className="panel-head-copy">
              <p className="eyebrow">Mailbox</p>
              <h3>邮件态势</h3>
            </div>
          </div>
          <div className="list-block">
            <div className="list-row">
              <div>
                <strong>邮件总量</strong>
                <p>当前本地邮件库中已同步的全部邮件。</p>
              </div>
              <span className="badge">{props.snapshot.mail_summary.total_messages}</span>
            </div>
            <div className="list-row">
              <div>
                <strong>未读邮件</strong>
                <p>还未阅读的邮件数量，方便快速聚焦。</p>
              </div>
              <span className="badge tone-warning">{props.snapshot.mail_summary.unread_messages}</span>
            </div>
            <div className="list-row">
              <div>
                <strong>最近同步状态</strong>
                <p>最近一次同步任务的执行结果与状态。</p>
              </div>
              <span className={`badge tone-${getStatusTone(props.snapshot.mail_summary.latest_run?.status ?? "unknown")}`}>
                {formatStatus(props.snapshot.mail_summary.latest_run?.status ?? "unknown")}
              </span>
            </div>
            <div className="list-row">
              <div>
                <strong>最近同步时间</strong>
                <p>帮助判断当前数据是否还新鲜。</p>
              </div>
              <span className="badge">{formatDateTime(props.snapshot.mail_summary.latest_run?.finished_at ?? props.snapshot.mail_summary.latest_run?.started_at)}</span>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div className="panel-head-copy">
              <p className="eyebrow">Runtime</p>
              <h3>运行环境</h3>
            </div>
          </div>
          <div className="list-block">
            <div className="list-row align-start">
              <div>
                <strong>项目目录</strong>
                <p>{compactPath(props.meta?.projectRoot ?? "—", 54)}</p>
              </div>
            </div>
            <div className="list-row align-start">
              <div>
                <strong>Python 环境</strong>
                <p>{compactPath(props.meta?.pythonExecutable ?? "—", 54)}</p>
              </div>
            </div>
            <div className="list-row">
              <div>
                <strong>代理池</strong>
                <p>当前已导入的代理数量。</p>
              </div>
              <span className="badge">{props.snapshot.summary.proxy_count}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="panel-grid panel-grid-two">
        <article className="panel">
          <div className="panel-header">
            <div className="panel-head-copy">
              <p className="eyebrow">Latest Task</p>
              <h3>最近任务</h3>
            </div>
          </div>
          {latestTask ? (
            <div className="detail-list">
              <div className="detail-row">
                <span>任务类型</span>
                <strong>{formatTaskType(latestTask.task_type)}</strong>
              </div>
              <div className="detail-row">
                <span>执行状态</span>
                <span className={`badge tone-${getStatusTone(latestTask.status)}`}>{formatStatus(latestTask.status)}</span>
              </div>
              <div className="detail-row">
                <span>成功 / 失败</span>
                <strong>
                  {latestTask.success_count} / {latestTask.failure_count}
                </strong>
              </div>
              <div className="detail-row">
                <span>完成时间</span>
                <strong>{formatDateTime(latestTask.finished_at)}</strong>
              </div>
              {latestTask.latest_error ? (
                <div className="callout callout-danger">
                  <strong>最近错误</strong>
                  <p>{latestTask.latest_error}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState title="还没有运行记录" description="先启动一次批量注册、联通检测或邮件同步，仪表盘会在这里展示最近结果。" />
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <div className="panel-head-copy">
              <p className="eyebrow">Alerts</p>
              <h3>系统提醒</h3>
            </div>
          </div>
          {props.snapshot.alerts.length > 0 ? (
            <div className="list-block">
              {props.snapshot.alerts.map((alert) => (
                <div className={`callout callout-${getAlertTone(alert.kind)}`} key={`${alert.title}-${alert.detail}`}>
                  <div className="callout-head">
                    <strong>{alert.title}</strong>
                    <span className={`badge tone-${getAlertTone(alert.kind)}`}>{alert.kind === "info" ? "信息" : alert.kind === "warning" ? "提醒" : "错误"}</span>
                  </div>
                  <p>{alert.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="当前状态稳定" description="暂无新的系统提醒，账号池与邮件同步可以按当前节奏继续运行。" />
          )}
        </article>
      </section>

      {latestMailRun ? (
        <section className="panel">
          <div className="panel-header">
            <div className="panel-head-copy">
              <p className="eyebrow">Mail Sync</p>
              <h3>最近一次邮件同步</h3>
            </div>
          </div>
          <div className="detail-list detail-list-inline">
            <div className="detail-row">
              <span>来源</span>
              <strong>{latestMailRun.source.toUpperCase()}</strong>
            </div>
            <div className="detail-row">
              <span>状态</span>
              <span className={`badge tone-${getStatusTone(latestMailRun.status)}`}>{formatStatus(latestMailRun.status)}</span>
            </div>
            <div className="detail-row">
              <span>新增邮件</span>
              <strong>{latestMailRun.message_count}</strong>
            </div>
            <div className="detail-row">
              <span>执行窗口</span>
              <strong>{formatDateTime(latestMailRun.finished_at ?? latestMailRun.started_at)}</strong>
            </div>
            <div className="detail-row">
              <span>结果提示</span>
              <strong className={`text-tone-${latestMailRun.latest_error ? "danger" : getConnectivityTone("connected")}`}>
                {latestMailRun.latest_error || formatMailCapability("receive_only")}
              </strong>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}
