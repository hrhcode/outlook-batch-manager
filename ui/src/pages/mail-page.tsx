import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getMessage, listAccounts, listMessages } from "../api/client";
import { formatMailRecipients, formatPreciseDateTime } from "../lib/account-formatters";
import { MailPreview } from "../components/mail-preview";

export function MailPage() {
  const [search, setSearch] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>();
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);

  const accountsQuery = useQuery({
    queryKey: ["accounts", "mail-filter"],
    queryFn: () => listAccounts({})
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", selectedAccountId, search],
    queryFn: () => listMessages({ accountId: selectedAccountId, query: search })
  });

  const detailQuery = useQuery({
    queryKey: ["message", selectedMessageId],
    queryFn: () => getMessage(selectedMessageId as number),
    enabled: selectedMessageId !== null
  });

  const messages = messagesQuery.data ?? [];
  const selectedMessage = detailQuery.data;
  useEffect(() => {
    if (messages.length === 0) {
      if (selectedMessageId !== null) {
        setSelectedMessageId(null);
      }
      return;
    }

    if (!messages.some((message) => message.id === selectedMessageId)) {
      setSelectedMessageId(messages[0].id);
    }
  }, [messages, selectedMessageId]);

  return (
    <section className="page mail-center-page">
      <div className="page-header">
        <div />
      </div>

      <div className="panel">
        <div className="toolbar-grid mail-toolbar-grid">
          <label className="filter-field">
            <span className="field-label">关键词搜索</span>
            <input
              className="text-input"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索主题、发件人、收件人或摘要"
              value={search}
            />
          </label>
          <label className="filter-field">
            <span className="field-label">账号过滤</span>
            <select
              className="select-input"
              value={selectedAccountId ?? ""}
              onChange={(event) => setSelectedAccountId(event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">全部账号</option>
              {(accountsQuery.data ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.email}
                </option>
              ))}
            </select>
          </label>
          <div className="mail-toolbar-spacer" aria-hidden="true" />
        </div>
      </div>

      <div className="mail-layout">
        <section className="panel message-list mail-split-panel">
          <div className="mail-list-header mail-list-grid" aria-hidden="true">
            <span>主题</span>
            <span>发件人</span>
            <span>收件人</span>
            <span>时间</span>
          </div>
          {messages.map((message) => (
            <button
              className={`message-item ${message.id === selectedMessageId ? "selected" : ""}`}
              key={message.id}
              onClick={() => setSelectedMessageId(message.id)}
              type="button"
            >
              <span className="message-cell message-subject">{message.subject || "（无主题）"}</span>
              <span className="message-cell message-sender">{message.sender || "未知发件人"}</span>
              <span className="message-cell message-recipients">{formatMailRecipients(message.recipients)}</span>
              <span className="message-cell message-meta">{formatPreciseDateTime(message.received_at)}</span>
            </button>
          ))}
          {messages.length === 0 ? <p className="muted-text">当前筛选条件下没有邮件。</p> : null}
        </section>
        <MailPreview message={selectedMessage} />
      </div>
    </section>
  );
}
