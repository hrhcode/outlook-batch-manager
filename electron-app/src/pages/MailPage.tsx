import { useMemo, useState } from "react";
import { PageTitle } from "../components/PageTitle";
import type { AccountItem, MailMessageItem, MailSource, MailSyncRun } from "../types";

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
  onSync: () => void;
  onRefresh: () => void;
};

export function MailPage(props: MailPageProps) {
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(props.messages[0]?.id ?? null);
  const selectedMessage = useMemo(
    () => props.messages.find((item) => item.id === selectedMessageId) ?? props.messages[0] ?? null,
    [props.messages, selectedMessageId],
  );

  return (
    <section className="page-stack">
      <PageTitle
        eyebrow="Mail"
        title="邮件"
        description="汇总所有账号已经同步到本地的邮件，支持按账号、来源、关键字和未读状态筛选。"
        actions={
          <div className="inline-actions">
            <button className="ghost-button" type="button" onClick={props.onRefresh} disabled={props.busy || props.loading}>
              刷新列表
            </button>
            <button className="primary-button" type="button" onClick={props.onSync} disabled={props.busy}>
              立即同步
            </button>
          </div>
        }
      />

      <section className="panel">
        <div className="toolbar">
          <label className="field">
            <span>账号</span>
            <select
              value={props.filters.accountId ?? ""}
              onChange={(event) =>
                props.onFiltersChange({
                  accountId: event.target.value ? Number(event.target.value) : null,
                })
              }
            >
              <option value="">全部账号</option>
              {props.accounts.map((account) => (
                <option key={account.id ?? account.email} value={account.id ?? ""}>
                  {account.email}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>来源</span>
            <select value={props.filters.source} onChange={(event) => props.onFiltersChange({ source: event.target.value })}>
              <option value="">全部来源</option>
              <option value={"graph" satisfies MailSource}>graph</option>
              <option value={"imap" satisfies MailSource}>imap</option>
              <option value={"pop" satisfies MailSource}>pop</option>
              <option value={"mock" satisfies MailSource}>mock</option>
            </select>
          </label>
          <label className="field field-grow">
            <span>关键词</span>
            <input
              value={props.filters.keyword}
              onChange={(event) => props.onFiltersChange({ keyword: event.target.value })}
              placeholder="主题 / 发件人 / 摘要"
            />
          </label>
          <label className="field toggle-field">
            <span>仅未读</span>
            <input
              type="checkbox"
              checked={props.filters.unreadOnly}
              onChange={(event) => props.onFiltersChange({ unreadOnly: event.target.checked })}
            />
          </label>
        </div>
      </section>

      <section className="mail-layout">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Messages</p>
              <h3>邮件列表</h3>
            </div>
            <span className="subtle-text">{props.messages.length} 封邮件</span>
          </div>
          <div className="mail-list">
            {props.messages.map((message) => (
              <button
                key={message.id ?? message.message_id}
                type="button"
                className={selectedMessage?.id === message.id ? "mail-item active" : "mail-item"}
                onClick={() => setSelectedMessageId(message.id)}
              >
                <div className="mail-item-top">
                  <strong>{message.subject}</strong>
                  <span>{message.received_at ?? "-"}</span>
                </div>
                <div className="mail-item-meta">
                  <span>{message.account_email}</span>
                  <span>{message.source}</span>
                </div>
                <p>{message.snippet || "无摘要"}</p>
              </button>
            ))}
            {!props.loading && props.messages.length === 0 ? <div className="empty-state">当前筛选下没有邮件。</div> : null}
            {props.loading ? <div className="empty-state">正在读取邮件数据...</div> : null}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Preview</p>
              <h3>邮件预览</h3>
            </div>
          </div>
          {selectedMessage ? (
            <div className="detail-stack">
              <div className="key-value-grid">
                <span>账号</span>
                <strong>{selectedMessage.account_email}</strong>
                <span>来源</span>
                <strong>{selectedMessage.source}</strong>
                <span>发件人</span>
                <strong>{selectedMessage.from_address || "-"}</strong>
                <span>收件人</span>
                <strong>{selectedMessage.to_address || "-"}</strong>
                <span>收件时间</span>
                <strong>{selectedMessage.received_at ?? "-"}</strong>
              </div>
              <div className="detail-block">
                <span className="detail-label">主题</span>
                <p>{selectedMessage.subject}</p>
              </div>
              <div className="detail-block">
                <span className="detail-label">摘要</span>
                <p>{selectedMessage.snippet || "无摘要"}</p>
              </div>
            </div>
          ) : (
            <div className="empty-state">选择左侧邮件后，这里会显示摘要和发件信息。</div>
          )}

          <div className="panel-separator" />

          <div className="panel-header">
            <div>
              <p className="eyebrow">Sync</p>
              <h3>最近同步</h3>
            </div>
          </div>
          <div className="simple-list">
            {props.recentRuns.map((run) => (
              <div className="simple-list-item" key={run.id ?? `${run.source}-${run.started_at}`}>
                <div>
                  <strong>{run.source}</strong>
                  <p>{run.finished_at ?? run.started_at ?? "-"}</p>
                </div>
                <div className="right-metrics">
                  <span>{run.message_count} 封</span>
                  <span className={`status-badge status-${run.status}`}>{run.status}</span>
                </div>
              </div>
            ))}
            {props.recentRuns.length === 0 ? <div className="empty-state">还没有邮件同步记录。</div> : null}
          </div>
        </article>
      </section>
    </section>
  );
}
