import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { PageTitle } from "../components/PageTitle";
import type { AccountItem, CreateAccountPayload } from "../types";

type AccountsPageProps = {
  accounts: AccountItem[];
  keyword: string;
  status: string;
  busy: boolean;
  onKeywordChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onRefresh: () => void;
  onImport: () => void;
  onExport: () => void;
  onCreateAccount: (payload: CreateAccountPayload) => void;
  onTestAccount: (accountId: number) => void;
  onBulkTest: () => void;
};

const emptyForm: CreateAccountPayload = {
  email: "",
  password: "",
  provider: "outlook",
  groupName: "default",
  notes: "",
  recoveryEmail: "",
  clientIdOverride: "",
  refreshToken: "",
};

export function AccountsPage(props: AccountsPageProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(props.accounts[0]?.id ?? null);
  const [form, setForm] = useState<CreateAccountPayload>(emptyForm);

  const selectedAccount = useMemo(
    () => props.accounts.find((item) => item.id === selectedAccountId) ?? props.accounts[0] ?? null,
    [props.accounts, selectedAccountId],
  );

  function submitCreate(event: FormEvent) {
    event.preventDefault();
    props.onCreateAccount(form);
    setForm(emptyForm);
    setShowCreateForm(false);
  }

  return (
    <section className="page-stack">
      <PageTitle
        eyebrow="Accounts"
        title="账号库"
        description="集中管理已有账号，支持手动添加、Excel 导入、单个测试和整库批量联通测试。"
        actions={
          <div className="inline-actions">
            <button className="ghost-button" type="button" onClick={props.onRefresh} disabled={props.busy}>
              刷新
            </button>
            <button className="ghost-button" type="button" onClick={props.onBulkTest} disabled={props.busy}>
              批量联通测试
            </button>
            <button className="primary-button" type="button" onClick={() => setShowCreateForm((value) => !value)}>
              {showCreateForm ? "收起表单" : "手动添加账号"}
            </button>
          </div>
        }
      />

      <section className="panel">
        <div className="toolbar">
          <label className="field">
            <span>关键词</span>
            <input
              value={props.keyword}
              onChange={(event) => props.onKeywordChange(event.target.value)}
              placeholder="邮箱 / 分组 / 备注"
            />
          </label>
          <label className="field">
            <span>状态</span>
            <select value={props.status} onChange={(event) => props.onStatusChange(event.target.value)}>
              <option value="">全部状态</option>
              <option value="active">active</option>
              <option value="pending">pending</option>
              <option value="login_failed">login_failed</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          <div className="toolbar-actions">
            <button className="ghost-button" type="button" onClick={props.onImport} disabled={props.busy}>
              导入账号
            </button>
            <button className="ghost-button" type="button" onClick={props.onExport} disabled={props.busy}>
              导出筛选结果
            </button>
          </div>
        </div>

        {showCreateForm ? (
          <form className="form-grid" onSubmit={submitCreate}>
            <label className="field">
              <span>邮箱</span>
              <input
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>密码</span>
              <input
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>邮箱类型</span>
              <select
                value={form.provider}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    provider: event.target.value as "outlook" | "hotmail",
                  }))
                }
              >
                <option value="outlook">outlook</option>
                <option value="hotmail">hotmail</option>
              </select>
            </label>
            <label className="field">
              <span>分组</span>
              <input
                value={form.groupName}
                onChange={(event) => setForm((current) => ({ ...current, groupName: event.target.value }))}
              />
            </label>
            <label className="field field-span-2">
              <span>恢复邮箱</span>
              <input
                value={form.recoveryEmail}
                onChange={(event) => setForm((current) => ({ ...current, recoveryEmail: event.target.value }))}
              />
            </label>
            <label className="field field-span-2">
              <span>专属 Client ID</span>
              <input
                value={form.clientIdOverride}
                onChange={(event) => setForm((current) => ({ ...current, clientIdOverride: event.target.value }))}
                placeholder="可选，用于导入带令牌账号"
              />
            </label>
            <label className="field field-span-2">
              <span>Refresh Token</span>
              <input
                value={form.refreshToken}
                onChange={(event) => setForm((current) => ({ ...current, refreshToken: event.target.value }))}
                placeholder="可选，直接保存到账户令牌表"
              />
            </label>
            <label className="field field-span-2">
              <span>备注</span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                rows={3}
              />
            </label>
            <div className="form-actions field-span-2">
              <button className="primary-button" type="submit" disabled={props.busy}>
                保存账号
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="two-column accounts-layout">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Library</p>
              <h3>账号列表</h3>
            </div>
            <span className="subtle-text">{props.accounts.length} 条结果</span>
          </div>
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>邮箱</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>联通</th>
                  <th>Token</th>
                  <th>分组</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {props.accounts.map((account) => (
                  <tr
                    key={account.id ?? account.email}
                    className={selectedAccount?.id === account.id ? "selected" : ""}
                    onClick={() => setSelectedAccountId(account.id)}
                  >
                    <td>
                      <div className="table-primary">
                        <strong>{account.email}</strong>
                        <span>{account.source}</span>
                      </div>
                    </td>
                    <td>{account.mail_provider}</td>
                    <td>
                      <span className={`status-badge status-${account.status}`}>{account.status}</span>
                    </td>
                    <td>
                      <span className={`status-badge status-${account.connectivity_status}`}>{account.connectivity_status}</span>
                    </td>
                    <td>{account.token_status || "none"}</td>
                    <td>{account.group_name}</td>
                    <td className="table-actions-cell">
                      <button
                        className="inline-link"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (account.id) props.onTestAccount(account.id);
                        }}
                        disabled={props.busy || !account.id}
                      >
                        测试
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {props.accounts.length === 0 ? <div className="empty-state">当前筛选下没有账号。</div> : null}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Detail</p>
              <h3>账号详情</h3>
            </div>
          </div>
          {selectedAccount ? (
            <div className="detail-stack">
              <div className="key-value-grid">
                <span>邮箱</span>
                <strong>{selectedAccount.email}</strong>
                <span>类型</span>
                <strong>{selectedAccount.mail_provider}</strong>
                <span>当前状态</span>
                <strong>{selectedAccount.status}</strong>
                <span>联通状态</span>
                <strong>{selectedAccount.connectivity_status}</strong>
                <span>Token 状态</span>
                <strong>{selectedAccount.token_status || "none"}</strong>
                <span>最近校验</span>
                <strong>{selectedAccount.last_connectivity_check_at ?? "尚未测试"}</strong>
                <span>分组</span>
                <strong>{selectedAccount.group_name}</strong>
                <span>导入格式</span>
                <strong>{selectedAccount.import_format}</strong>
              </div>
              <div className="detail-block">
                <span className="detail-label">恢复邮箱</span>
                <p>{selectedAccount.recovery_email || "未填写"}</p>
              </div>
              <div className="detail-block">
                <span className="detail-label">备注</span>
                <p>{selectedAccount.notes || "暂无备注"}</p>
              </div>
              <div className="detail-block">
                <span className="detail-label">专属 Client ID</span>
                <p>{selectedAccount.client_id_override || "未设置"}</p>
              </div>
            </div>
          ) : (
            <div className="empty-state">选择左侧账号后，这里会显示更完整的状态与备注。</div>
          )}
        </article>
      </section>
    </section>
  );
}
