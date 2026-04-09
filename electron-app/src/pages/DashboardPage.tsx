import { MetricCard } from "../components/MetricCard";
import { PageTitle } from "../components/PageTitle";
import type { AppSnapshot, AppView } from "../types";

type DashboardPageProps = {
  snapshot: AppSnapshot;
  meta: { projectRoot: string; pythonExecutable: string } | null;
  onNavigate: (view: AppView) => void;
};

export function DashboardPage(props: DashboardPageProps) {
  const latestRegisterTask = props.snapshot.tasks.find((task) => task.task_type === "register") ?? null;
  const latestMailRun = props.snapshot.recent_mail_sync[0] ?? null;

  return (
    <section className="page-stack">
      <PageTitle
        eyebrow="Dashboard"
        title="系统概览"
        description="把账号、注册和收件的关键状态压缩在一个更轻盈的总览页里。"
        actions={
          <button className="primary-button" type="button" onClick={() => props.onNavigate("register")}>
            前往批量注册
          </button>
        }
      />

      <section className="metric-grid metric-grid-compact">
        <MetricCard label="账号总数" value={props.snapshot.summary.account_count} hint="当前账号库规模" />
        <MetricCard label="可用账号" value={props.snapshot.summary.active_account_count} hint="状态为 active" />
        <MetricCard label="已连通账号" value={props.snapshot.summary.connected_account_count} hint="最近联通测试通过" />
        <MetricCard label="未读邮件" value={props.snapshot.mail_summary.unread_messages} hint="已同步邮件中的未读数" />
      </section>

      <section className="three-column">
        <article className="panel panel-compact">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Workspace</p>
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

        <article className="panel panel-compact">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Registration</p>
              <h3>最近注册批次</h3>
            </div>
          </div>
          {latestRegisterTask ? (
            <div className="compact-detail">
              <div className="key-value-grid">
                <span>状态</span>
                <strong>{latestRegisterTask.status}</strong>
                <span>成功 / 失败</span>
                <strong>
                  {latestRegisterTask.success_count} / {latestRegisterTask.failure_count}
                </strong>
                <span>结束时间</span>
                <strong>{latestRegisterTask.finished_at ?? "进行中"}</strong>
              </div>
              {latestRegisterTask.latest_error ? <p className="inline-error">{latestRegisterTask.latest_error}</p> : null}
            </div>
          ) : (
            <div className="empty-state">还没有注册批次。</div>
          )}
        </article>

        <article className="panel panel-compact">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Mailbox</p>
              <h3>最近邮件同步</h3>
            </div>
          </div>
          {latestMailRun ? (
            <div className="compact-detail">
              <div className="key-value-grid">
                <span>来源</span>
                <strong>{latestMailRun.source}</strong>
                <span>结果</span>
                <strong>{latestMailRun.status}</strong>
                <span>邮件数</span>
                <strong>{latestMailRun.message_count}</strong>
                <span>完成时间</span>
                <strong>{latestMailRun.finished_at ?? latestMailRun.started_at ?? "-"}</strong>
              </div>
              {latestMailRun.latest_error ? <p className="inline-error">{latestMailRun.latest_error}</p> : null}
            </div>
          ) : (
            <div className="empty-state">还没有邮件同步记录。</div>
          )}
        </article>
      </section>

      <section className="two-column">
        <article className="panel panel-compact">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Health</p>
              <h3>账号健康</h3>
            </div>
          </div>
          <div className="simple-list">
            <div className="simple-list-item">
              <span>待校验账号</span>
              <strong>{props.snapshot.summary.pending_account_count}</strong>
            </div>
            <div className="simple-list-item">
              <span>代理数量</span>
              <strong>{props.snapshot.summary.proxy_count}</strong>
            </div>
            <div className="simple-list-item">
              <span>任务总数</span>
              <strong>{props.snapshot.summary.task_count}</strong>
            </div>
            <div className="simple-list-item">
              <span>邮件总数</span>
              <strong>{props.snapshot.mail_summary.total_messages}</strong>
            </div>
          </div>
        </article>

        <article className="panel panel-compact">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Alerts</p>
              <h3>关键异常</h3>
            </div>
          </div>
          {props.snapshot.alerts.length > 0 ? (
            <div className="simple-list">
              {props.snapshot.alerts.map((alert) => (
                <div className="alert-card" key={`${alert.title}-${alert.task_id ?? "na"}`}>
                  <strong>{alert.title}</strong>
                  <p>{alert.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">目前没有新的异常，系统状态稳定。</div>
          )}
        </article>
      </section>
    </section>
  );
}
