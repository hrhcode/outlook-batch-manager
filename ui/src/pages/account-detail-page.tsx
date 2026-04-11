import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { getAccount, testAccount } from "../api/client";
import { CopyableSecret } from "../components/copyable-secret";
import { StatusPill } from "../components/status-pill";
import { formatDateTime, formatPreciseDateTime, formatSyncMode } from "../lib/account-formatters";

type Notice = {
  tone: "success" | "error";
  text: string;
};

function InfoMetric({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string | number;
  tone?: "default" | "danger";
}) {
  return (
    <div className={`detail-metric ${tone === "danger" ? "detail-metric-danger" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CredentialBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="credential-block">
      <dt>{label}</dt>
      <dd>
        <CopyableSecret ariaLabel={`复制${label}`} value={value} />
      </dd>
    </div>
  );
}

export function AccountDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const accountId = Number(id);
  const [notice, setNotice] = useState<Notice | null>(null);

  const accountQuery = useQuery({
    queryKey: ["account", accountId],
    queryFn: () => getAccount(accountId),
    enabled: Number.isFinite(accountId)
  });

  const testMutation = useMutation({
    mutationFn: () => testAccount(accountId),
    onSuccess: (result) => {
      setNotice({ tone: "success", text: result.message || "当前账号联通测试成功。" });
      void queryClient.invalidateQueries({ queryKey: ["account", accountId] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        text: `测试失败：${error instanceof Error ? error.message : "未知错误"}`
      });
    }
  });

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 3200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  if (accountQuery.isLoading) {
    return <section className="page">账号详情加载中...</section>;
  }

  if (!accountQuery.data) {
    return <section className="page">未找到该账号。</section>;
  }

  const account = accountQuery.data;

  return (
    <section className="page">
      <div className="page-header">
        <div className="page-header-copy">
          <h3>{account.email}</h3>
        </div>
        <div className="button-row">
          <Link className="ghost-button link-button" to="/accounts">
            返回账号池
          </Link>
          <button className="primary-button" disabled={testMutation.isPending} onClick={() => testMutation.mutate()} type="button">
            {testMutation.isPending ? "测试中..." : "测试连通性"}
          </button>
        </div>
      </div>

      {notice ? (
        <div
          aria-live="polite"
          className={`notice notice-${notice.tone} floating-toast`}
          data-prefix={notice.tone === "error" ? "!" : "i"}
        >
          <p>{notice.text}</p>
        </div>
      ) : null}

      <div className="detail-grid">
        <section className="panel detail-panel">
          <div className="detail-panel-header">
            <div className="detail-panel-title">
              <h4>联通与同步信息</h4>
            </div>
            <div className="detail-status-row">
              <StatusPill value={account.account_status} />
              <StatusPill value={account.last_test_status} />
            </div>
          </div>
          <dl className="detail-metrics-grid">
            <InfoMetric label="同步模式" value={formatSyncMode(account.sync_mode)} />
            <InfoMetric label="最近同步时间" value={formatDateTime(account.last_synced_at)} />
            <InfoMetric label="access_token 过期时间" value={formatDateTime(account.access_token_expires_at)} />
            <InfoMetric label="已同步邮件数" value={account.message_count} />
            <InfoMetric label="最近错误" tone={account.last_error ? "danger" : "default"} value={account.last_error || "无"} />
          </dl>
        </section>

        <section className="panel detail-panel">
          <div className="detail-panel-header">
            <div className="detail-panel-title">
              <h4>账号令牌与密钥</h4>
            </div>
          </div>
          <dl className="credential-grid">
            <CredentialBlock label="密码" value={account.password} />
            <CredentialBlock label="client_id" value={account.client_id} />
            <CredentialBlock label="refresh_token" value={account.refresh_token} />
            <CredentialBlock label="access_token" value={account.access_token} />
          </dl>
        </section>
      </div>

      <section className="panel recent-messages-panel">
        <div className="panel-header">
          <div className="label-stack">
            <h4>最近消息</h4>
          </div>
        </div>
        <div className="message-list compact-list">
          {account.recent_messages.map((message) => (
            <article key={message.id} className="recent-message-row">
              <div className="recent-message-line">
                <h5 className="recent-message-subject">{message.subject || "（无主题）"}</h5>
                <p className="recent-message-sender">{message.sender || "未知发件人"}</p>
                <p className="recent-message-snippet">{message.snippet || "暂无摘要内容。"}</p>
              </div>
              <span className="recent-message-meta">
                {formatPreciseDateTime(message.received_at)}
              </span>
            </article>
          ))}
          {account.recent_messages.length === 0 ? <p className="muted-text">暂未同步到邮件。</p> : null}
        </div>
      </section>
    </section>
  );
}
