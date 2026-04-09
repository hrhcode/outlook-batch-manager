import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { VIEW_META } from "../lib/content";
import { formatDateTime, formatSource, formatStatus, getStatusTone } from "../lib/format";
import type { AccountItem, MailMessageItem, MailSyncRun } from "../types";

type MailFilters = {
  accountId: number | null;
  keyword: string;
  unreadOnly: boolean;
  source: string;
};

type MailPageProps = {
  accounts: AccountItem[];
  messages: MailMessageItem[];
  recentRuns: MailSyncRun[];
  filters: MailFilters;
  busy: boolean;
  loading: boolean;
  onFiltersChange: (patch: Partial<MailFilters>) => void;
  onSyncAccounts: (accountIds: number[]) => void;
  onRefresh: () => void;
};

export function MailPage(props: MailPageProps) {
  const meta = VIEW_META.mail;
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(props.messages[0]?.id ?? null);

  useEffect(() => {
    if (!props.messages.some((item) => item.id === selectedMessageId)) {
      setSelectedMessageId(props.messages[0]?.id ?? null);
    }
  }, [props.messages, selectedMessageId]);

  const selectedMessage = useMemo(
    () => props.messages.find((item) => item.id === selectedMessageId) ?? props.messages[0] ?? null,
    [props.messages, selectedMessageId],
  );

  const connectedAccounts = props.accounts.filter((account) => account.connectivity_status === "connected");
  const syncTargetIds = props.filters.accountId
    ? [props.filters.accountId]
    : connectedAccounts.map((account) => account.id).filter((value): value is number => value !== null);
  const unreadCount = props.messages.filter((item) => !item.is_read).length;
  const latestRun = props.recentRuns[0] ?? null;

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
        actions={
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={props.onRefresh} disabled={props.busy || props.loading}>
              刷新邮件
            </button>
            <button className="primary-button" type="button" onClick={() => props.onSyncAccounts(syncTargetIds)} disabled={props.busy || syncTargetIds.length === 0}>
              同步当前范围
            </button>
          </div>
        }
        aside={<span className="subtle-chip">列表 + 详情 + 同步态势</span>}
      />

      <section className="stat-grid stat-grid-four">
        <StatCard label="可同步账号" value={connectedAccounts.length} hint="已联通，可用于邮件同步的账号数" tone="success" />
        <StatCard label="当前邮件数" value={props.messages.length} hint="当前筛选条件下的邮件结果数量" />
        <StatCard label="当前未读" value={unreadCount} hint="帮助快速找到还没处理的邮件" tone={unreadCount > 0 ? "warning" : "default"} />
        <StatCard
          label="最近同步"
          value={formatStatus(latestRun?.status ?? "unknown")}
          hint={latestRun ? formatDateTime(latestRun.finished_at ?? latestRun.started_at) : "还没有同步记录"}
          tone={latestRun ? (getStatusTone(latestRun.status) === "danger" ? "danger" : getStatusTone(latestRun.status) === "warning" ? "warning" : "default") : "default"}
        />
      </section>

      <section className="toolbar-card">
        <div className="toolbar-row">
          <label className="field">
            <span>账号</span>
            <select
              value={props.filters.accountId ?? ""}
              onChange={(event) => props.onFiltersChange({ accountId: event.target.value ? Number(event.target.value) : null })}
            >
              <option value="">全部可同步账号</option>
              {connectedAccounts.map((account) => (
                <option key={account.id} value={account.id ?? ""}>
                  {account.email}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>来源</span>
            <select value={props.filters.source} onChange={(event) => props.onFiltersChange({ source: event.target.value })}>
              <option value="">全部来源</option>
              <option value="imap">IMAP</option>
              <option value="mock">模拟</option>
            </select>
          </label>
          <label className="field field-grow">
            <span>关键词</span>
            <input value={props.filters.keyword} onChange={(event) => props.onFiltersChange({ keyword: event.target.value })} placeholder="主题、发件人、摘要" />
          </label>
          <label className="switch-field compact">
            <div>
              <strong>仅看未读</strong>
            </div>
            <input type="checkbox" checked={props.filters.unreadOnly} onChange={(event) => props.onFiltersChange({ unreadOnly: event.target.checked })} />
          </label>
        </div>
        <p className="toolbar-hint">先用账号和来源缩小范围，再用关键词快速定位邮件。同步操作默认作用于当前筛选范围内的账号。</p>
      </section>

      <section className="mail-center-layout">
        <article className="panel">
          <div className="panel-header">
            <div className="panel-head-copy">
              <p className="eyebrow">Messages</p>
              <h3>邮件列表</h3>
            </div>
            <span className="subtle-chip">{props.loading ? "正在读取..." : `${props.messages.length} 封邮件`}</span>
          </div>
          <div className="mail-list">
            {props.loading ? <EmptyState title="正在读取邮件" description="正在根据当前筛选条件刷新邮件列表，请稍候。" /> : null}
            {!props.loading && props.messages.length === 0 ? (
              <EmptyState title="当前没有邮件" description="可以放宽筛选条件，或者先对已联通账号执行一次邮件同步。" />
            ) : null}
            {!props.loading
              ? props.messages.map((message) => (
                  <button
                    key={message.id ?? message.message_id}
                    type="button"
                    className={selectedMessage?.id === message.id ? "mail-item active" : "mail-item"}
                    onClick={() => setSelectedMessageId(message.id)}
                  >
                    <div className="mail-item-top">
                      <strong>{message.subject || "（无主题）"}</strong>
                      <span>{formatDateTime(message.received_at)}</span>
                    </div>
                    <div className="mail-item-meta">
                      <span>{message.account_email}</span>
                      <div className="pill-row">
                        {!message.is_read ? <span className="badge tone-warning">未读</span> : null}
                        {message.has_attachments ? <span className="badge">附件</span> : null}
                        <span className="badge">{formatSource(message.source)}</span>
                      </div>
                    </div>
                    <p>{message.snippet || "暂无摘要"}</p>
                  </button>
                ))
              : null}
          </div>
        </article>

        <div className="stack-panel">
          <article className="panel">
            <div className="panel-header">
              <div className="panel-head-copy">
                <p className="eyebrow">Preview</p>
                <h3>邮件详情</h3>
              </div>
            </div>
            {selectedMessage ? (
              <div className="drawer-stack">
                <div className="callout">
                  <strong>{selectedMessage.subject || "（无主题）"}</strong>
                  <p>{selectedMessage.snippet || "暂无摘要"}</p>
                </div>
                <div className="detail-list">
                  <div className="detail-row">
                    <span>账号</span>
                    <strong>{selectedMessage.account_email}</strong>
                  </div>
                  <div className="detail-row">
                    <span>发件人</span>
                    <strong>{selectedMessage.from_address || "—"}</strong>
                  </div>
                  <div className="detail-row">
                    <span>收件人</span>
                    <strong>{selectedMessage.to_address || "—"}</strong>
                  </div>
                  <div className="detail-row">
                    <span>接收时间</span>
                    <strong>{formatDateTime(selectedMessage.received_at)}</strong>
                  </div>
                  <div className="detail-row">
                    <span>来源</span>
                    <strong>{formatSource(selectedMessage.source)}</strong>
                  </div>
                  <div className="detail-row">
                    <span>文件夹</span>
                    <strong>{selectedMessage.folder_name || "Inbox"}</strong>
                  </div>
                  <div className="detail-row">
                    <span>附件</span>
                    <strong>{selectedMessage.has_attachments ? "有附件" : "无附件"}</strong>
                  </div>
                  <div className="detail-row">
                    <span>同步时间</span>
                    <strong>{formatDateTime(selectedMessage.synced_at)}</strong>
                  </div>
                </div>

                <details className="details-block">
                  <summary>查看原始同步信息</summary>
                  <div className="details-content">
                    <div className="detail-list">
                      <div className="detail-row">
                        <span>消息 ID</span>
                        <strong>{selectedMessage.message_id || "—"}</strong>
                      </div>
                      <div className="detail-row">
                        <span>Internet Message ID</span>
                        <strong>{selectedMessage.internet_message_id || "—"}</strong>
                      </div>
                    </div>
                    <pre className="code-block">{selectedMessage.raw_payload || "暂无原始内容"}</pre>
                  </div>
                </details>
              </div>
            ) : (
              <EmptyState title="先选择一封邮件" description="从左侧列表选择邮件后，这里会展示阅读级信息和高级同步明细。" />
            )}
          </article>

          <article className="panel">
            <div className="panel-header">
              <div className="panel-head-copy">
                <p className="eyebrow">Sync</p>
                <h3>最近同步</h3>
              </div>
            </div>
            {props.recentRuns.length > 0 ? (
              <div className="sync-list">
                {props.recentRuns.map((run) => (
                  <div className="sync-item" key={run.id ?? `${run.account_id}-${run.started_at}`}>
                    <div className="sync-item-top">
                      <strong>账号 #{run.account_id ?? "-"}</strong>
                      <span className={`badge tone-${getStatusTone(run.status)}`}>{formatStatus(run.status)}</span>
                    </div>
                    <div className="sync-item-meta">
                      <span>{formatSource(run.source)}</span>
                      <span>{run.message_count} 封</span>
                      <span>{formatDateTime(run.finished_at ?? run.started_at)}</span>
                    </div>
                    {run.latest_error ? <p className="inline-error">{run.latest_error}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="还没有同步记录" description="先对一个或多个已联通账号执行同步，这里会持续展示最近的执行状态与异常。" />
            )}
          </article>
        </div>
      </section>
    </section>
  );
}
