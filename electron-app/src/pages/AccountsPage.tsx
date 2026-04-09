import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "../components/PageTitle";
import type { AccountItem } from "../types";

type AccountFilter = "all" | "connectable" | "connected" | "failed" | "missing_auth";

type AccountsPageProps = {
  accounts: AccountItem[];
  busy: boolean;
  onRefresh: () => void;
  onImportAccounts: () => void;
  onAuthorizeAccount: (accountId: number) => void;
  onDeleteAccounts: (accountIds: number[]) => void;
  onTestAccount: (accountId: number) => void;
  onSyncAccounts: (accountIds: number[]) => void;
};

export function AccountsPage(props: AccountsPageProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(props.accounts[0]?.id ?? null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [filter, setFilter] = useState<AccountFilter>("all");

  useEffect(() => {
    if (!props.accounts.some((item) => item.id === selectedAccountId)) {
      setSelectedAccountId(props.accounts[0]?.id ?? null);
    }
  }, [props.accounts, selectedAccountId]);

  const filteredAccounts = useMemo(() => {
    return props.accounts.filter((account) => {
      if (filter === "connectable") return account.connectivity_status === "connectable";
      if (filter === "connected") return account.connectivity_status === "connected";
      if (filter === "failed") return account.connectivity_status === "failed";
      if (filter === "missing_auth") return !account.has_client_id || !account.has_refresh_token;
      return true;
    });
  }, [filter, props.accounts]);

  const selectedAccount = useMemo(
    () => filteredAccounts.find((item) => item.id === selectedAccountId) ?? filteredAccounts[0] ?? null,
    [filteredAccounts, selectedAccountId],
  );

  const syncableAccountIds = filteredAccounts
    .filter((item) => item.id && item.connectivity_status === "connected")
    .map((item) => item.id as number);

  const selectedForDelete = selectedAccountIds.filter((id) => filteredAccounts.some((item) => item.id === id));

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedAccountIds(filteredAccounts.map((item) => item.id).filter((value): value is number => value !== null));
      return;
    }
    setSelectedAccountIds([]);
  }

  function toggleSelectOne(accountId: number, checked: boolean) {
    setSelectedAccountIds((current) => (checked ? Array.from(new Set([...current, accountId])) : current.filter((item) => item !== accountId)));
  }

  return (
    <section className="page-stack">
      <PageTitle
        actions={
          <div className="inline-actions">
            <button className="ghost-button" type="button" onClick={props.onRefresh} disabled={props.busy}>
              刷新
            </button>
            <button className="ghost-button" type="button" onClick={props.onImportAccounts} disabled={props.busy}>
              批量导入账号
            </button>
            <button className="ghost-button" type="button" onClick={() => props.onSyncAccounts(syncableAccountIds)} disabled={props.busy || syncableAccountIds.length === 0}>
              批量同步收件
            </button>
            <button className="ghost-button" type="button" onClick={() => props.onDeleteAccounts(selectedForDelete)} disabled={props.busy || selectedForDelete.length === 0}>
              批量删除
            </button>
          </div>
        }
      />

      <section className="panel panel-compact">
        <div className="toolbar">
          <label className="field">
            <span>账号筛选</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value as AccountFilter)}>
              <option value="all">全部账号</option>
              <option value="connectable">可联通账号</option>
              <option value="connected">已联通账号</option>
              <option value="failed">联通失败账号</option>
              <option value="missing_auth">缺少凭证账号</option>
            </select>
          </label>
          <div className="helper-block field-grow">
            <p>账号中心是系统唯一账号池。邮件中心只会使用这里已联通成功的账号进行 IMAP 收件同步。</p>
          </div>
        </div>
      </section>

      <section className="two-column accounts-layout">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Accounts</p>
              <h3>账号列表</h3>
            </div>
            <span className="subtle-text">{filteredAccounts.length} 个账号</span>
          </div>
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={filteredAccounts.length > 0 && selectedForDelete.length === filteredAccounts.length}
                      onChange={(event) => toggleSelectAll(event.target.checked)}
                    />
                  </th>
                  <th>邮箱</th>
                  <th>分组</th>
                  <th>导入格式</th>
                  <th>client_id</th>
                  <th>refresh_token</th>
                  <th>联通状态</th>
                  <th>邮件能力</th>
                  <th>最近同步</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account) => (
                  <tr
                    key={account.id ?? account.email}
                    className={selectedAccount?.id === account.id ? "selected" : ""}
                    onClick={() => setSelectedAccountId(account.id)}
                  >
                    <td onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!account.id && selectedAccountIds.includes(account.id)}
                        onChange={(event) => account.id && toggleSelectOne(account.id, event.target.checked)}
                      />
                    </td>
                    <td>
                      <div className="table-primary">
                        <strong>{account.email}</strong>
                        <span>{account.mail_provider}</span>
                      </div>
                    </td>
                    <td>{account.group_name}</td>
                    <td>{account.import_format}</td>
                    <td>{account.has_client_id ? "已配置" : "缺失"}</td>
                    <td>{account.has_refresh_token ? "已配置" : "缺失"}</td>
                    <td>
                      <span className={`status-badge status-${account.connectivity_status}`}>{renderConnectivity(account.connectivity_status)}</span>
                    </td>
                    <td>{renderCapability(account.mail_capability_status)}</td>
                    <td>{account.last_mail_sync_at ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredAccounts.length === 0 ? <div className="empty-state">当前筛选条件下没有账号。</div> : null}
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
                <span>分组</span>
                <strong>{selectedAccount.group_name || "-"}</strong>
                <span>导入格式</span>
                <strong>{selectedAccount.import_format}</strong>
                <span>账号状态</span>
                <strong>{selectedAccount.status}</strong>
                <span>联通状态</span>
                <strong>{renderConnectivity(selectedAccount.connectivity_status)}</strong>
                <span>邮件能力</span>
                <strong>{renderCapability(selectedAccount.mail_capability_status)}</strong>
                <span>Token 状态</span>
                <strong>{selectedAccount.token_status || "-"}</strong>
                <span>最近检测</span>
                <strong>{selectedAccount.last_connectivity_check_at ?? "-"}</strong>
                <span>最近同步</span>
                <strong>{selectedAccount.last_mail_sync_at ?? "-"}</strong>
              </div>

              <div className="inline-actions">
                <button className="ghost-button" type="button" onClick={() => selectedAccount.id && props.onTestAccount(selectedAccount.id)} disabled={props.busy || !selectedAccount.id}>
                  检测当前账号
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => selectedAccount.id && props.onAuthorizeAccount(selectedAccount.id)}
                  disabled={props.busy || !selectedAccount.id}
                >
                  补充 IMAP OAuth 授权
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => selectedAccount.id && props.onSyncAccounts([selectedAccount.id])}
                  disabled={props.busy || !selectedAccount.id || selectedAccount.connectivity_status !== "connected"}
                >
                  同步当前账号邮件
                </button>
                <button className="ghost-button" type="button" onClick={() => selectedAccount.id && props.onDeleteAccounts([selectedAccount.id])} disabled={props.busy || !selectedAccount.id}>
                  删除当前账号
                </button>
              </div>

              <div className="detail-block">
                <span className="detail-label">凭证情况</span>
                <p>client_id：{selectedAccount.has_client_id ? "已配置" : "未配置"}；refresh_token：{selectedAccount.has_refresh_token ? "已配置" : "未配置"}</p>
              </div>

              <div className="detail-block">
                <span className="detail-label">最近错误</span>
                <p>{selectedAccount.last_error || "当前没有错误。"}</p>
              </div>
            </div>
          ) : (
            <div className="empty-state">选择一个账号后，这里会显示它的联通能力和最近错误。</div>
          )}
        </article>
      </section>
    </section>
  );
}

function renderConnectivity(value: string) {
  if (value === "connectable") return "可联通";
  if (value === "connected") return "已联通";
  if (value === "failed") return "联通失败";
  if (value === "action_required") return "未具备联通条件";
  return "未知";
}

function renderCapability(value: string) {
  if (value === "receive_only") return "仅收件";
  return "未就绪";
}
