import DOMPurify from "dompurify";

import { formatPreciseDateTime } from "../lib/account-formatters";
import type { MailMessageDetail } from "../types/api";

type MailPreviewProps = {
  message: MailMessageDetail | null | undefined;
};

export function MailPreview({ message }: MailPreviewProps) {
  if (!message) {
    return (
      <section className="panel message-preview mail-split-panel empty-state">
        <div className="list-stack">
          <h3>请选择一封邮件</h3>
          <p className="muted-text">左侧选中邮件后，这里会显示发件信息和正文内容。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel message-preview mail-split-panel">
      <header className="mail-preview-header">
        <div className="mail-preview-heading">
          <div className="mail-preview-title">
            <h3>{message.subject || "（无主题）"}</h3>
          </div>
        </div>
        <div className="mail-preview-meta">
          <div>
            <p className="eyebrow">发件人</p>
            <p>{message.sender}</p>
          </div>
          <div>
            <p className="eyebrow">收件人</p>
            <p>{message.recipients || "未记录收件人"}</p>
          </div>
          <div>
            <p className="eyebrow">接收时间</p>
            <p>{formatPreciseDateTime(message.received_at)}</p>
          </div>
        </div>
      </header>
      <div className="message-body">
        {message.body_html ? (
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.body_html) }} />
        ) : (
          <pre>{message.body_text || "暂无可展示的正文内容。"}</pre>
        )}
      </div>
    </section>
  );
}
