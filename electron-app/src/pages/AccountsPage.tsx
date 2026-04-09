import { useEffect, useMemo, useState } from "react";
import { DetailDrawer } from "../components/DetailDrawer";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { SelectionBar } from "../components/SelectionBar";
import { StatCard } from "../components/StatCard";
import { VIEW_META } from "../lib/content";
import {
  formatBooleanText,
  formatConnectivityStatus,
  formatDateTime,
  formatMailCapability,
  formatStatus,
  getConnectivityTone,
  getStatusTone,
} from "../lib/format";
import type { AccountItem } from "../types";

type AccountFilter = "all" | "missing_auth" | "action_required" | "connectable" | "connected" | "failed";

type AccountsPageProps = {
  accounts: AccountItem[];
  busy: boolean;
  onRefresh: () => void;
  onImportAccounts: () => void;
  onAuthorizeAccount: (accountId: number) => void;
  onDeleteAccounts: (accountIds: number[]) => void;
  onTestAccount: (accountId: number) => void;
  onTestAccounts: (accountIds: number[]) => void;
  onSyncAccounts: (accountIds: number[]) => void;
  onUpdateAccountAuth: (accountId: number, payload: { clientId?: string; refreshToken?: string }) => void;
};

export function AccountsPage(props: AccountsPageProps) {
  const meta = VIEW_META.accounts;
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(props.accounts[0]?.id ?? null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [search, setSearch] = useState("");
  const [authDraft, setAuthDraft] = useState({ clientId: "", refreshToken: "" });

  const counts = useMemo(
    () => ({
      all: props.accounts.length,
      missing_auth: props.accounts.filter((item) => !item.has_client_id || !item.has_refresh_token).length,
      action_required: props.accounts.filter((item) => item.connectivity_status === "action_required").length,
      connectable: props.accounts.filter((item) => item.connectivity_status === "connectable").length,
      connected: props.accounts.filter((item) => item.connectivity_status === "connected").length,
      failed: props.accounts.filter((item) => item.connectivity_status === "failed").length,
    }),
    [props.accounts],
  );

  const filteredAccounts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return props.accounts.filter((account) => {
      const filterMatched =
        filter === "all"
          ? true
          : filter === "missing_auth"
            ? !account.has_client_id || !account.has_refresh_token
            : account.connectivity_status === filter;

      if (!filterMatched) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const haystack = [account.email, account.group_name, account.notes, account.mail_provider, account.import_format].join(" ").toLowerCase();
      return haystack.includes(keyword);
    });
  }, [filter, props.accounts, search]);

  useEffect(() => {
    if (!filteredAccounts.some((item) => item.id === selectedAccountId)) {
      setSelectedAccountId(filteredAccounts[0]?.id ?? null);
    }
  }, [filteredAccounts, selectedAccountId]);

  useEffect(() => {
    const visibleIds = new Set(filteredAccounts.map((item) => item.id).filter((item): item is number => item !== null));
    setSelectedAccountIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [filteredAccounts]);

  const selectedAccount = useMemo(
    () => filteredAccounts.find((item) => item.id === selectedAccountId) ?? filteredAccounts[0] ?? null,
    [filteredAccounts, selectedAccountId],
  );

  useEffect(() => {
    setAuthDraft({ clientId: "", refreshToken: "" });
  }, [selectedAccount?.id]);

  const selectedVisibleIds = selectedAccountIds.filter((id) => filteredAccounts.some((item) => item.id === id));
  const selectedConnectedIds = selectedVisibleIds.filter((id) => filteredAccounts.some((item) => item.id === id && item.connectivity_status === "connected"));

  const quickFilters: Array<{ key: AccountFilter; label: string; hint: string; tone?: "default" | "warning" | "danger" | "success" }> = [
    { key: "all", label: "全部账号", hint: "统一账号池", tone: "default" },
    { key: "missing_auth", label: "待补凭证", hint: "缺少 client_id 或 refresh_token", tone: "warning" },
    { key: "connectable", label: "待检测", hint: "凭证已补齐，等待联通校验", tone: "warning" },
    { key: "connected", label: "可同步", hint: "已联通，可直接同步邮件", tone: "success" },
    { key: "failed", label: "检测失败", hint: "需要继续排障或补配置", tone: "danger" },
  ];

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

  function submitAuthUpdate() {
    if (!selectedAccount?.id) {
      return;
    }

    const clientId = authDraft.clientId.trim();
    const refreshToken = authDraft.refreshToken.trim();
    if (!clientId && !refreshToken) {
      return;
    }

    props.onUpdateAccountAuth(selectedAccount.id, {
      clientId: clientId || undefined,
      refreshToken: refreshToken || undefined,
    });
    setAuthDraft({ clientId: "", refreshToken: "" });
  }

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
        actions={
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={props.onRefresh} disabled={props.busy}>
              刷新列表
            </button>
            <button className="secondary-button" type="button" onClick={props.onImportAccounts} disabled={props.busy}>
              批量导入账号
            </button>
            <button className="primary-button" type="button" onClick={() => props.onSyncAccounts(filteredAccounts.filter((item) => item.connectivity_status === "connected").map((item) => item.id as number))} disabled={props.busy || counts.connected === 0}>
              同步当前筛选
            </button>
          </div>
        }
        aside={<span className="subtle-chip">批量运营优先</span>}
      />

      <section className="stat-grid stat-grid-five">
        {quickFilters.map((item) => (
          <button key={item.key} type="button" className={filter === item.key ? "filter-card active" : "filter-card"} onClick={() => setFilter(item.key)}>
            <StatCard label={item.label} value={counts[item.key]} hint={item.hint} tone={item.tone ?? "default"} />
          </button>
        ))}
      </section>

      <section className="toolbar-card">
        <div className="toolbar-row">
          <label className="field field-grow">
            <span>搜索账号</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="邮箱、分组、备注、来源格式" />
          </label>
          <label className="field">
            <span>当前筛选</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value as AccountFilter)}>
              <option value="all">全部账号</option>
              <option value="missing_auth">待补凭证</option>
              <option value="action_required">待处理</option>
              <option value="connectable">待检测</option>
              <option value="connected">可同步</option>
              <option value="failed">检测失败</option>
            </select>
          </label>
        </div>
        <p className="toolbar-hint">账号中心是唯一账号池。邮件中心只消费这里已经联通成功的账号，所以补凭证、做检测和同步都建议从这里发起。</p>
      </section>

      <SelectionBar
        count={selectedVisibleIds.length}
        label="支持批量检测、批量同步和批量删除。"
        actions={
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={() => props.onTestAccounts(selectedVisibleIds)} disabled={props.busy || selectedVisibleIds.length === 0}>
              批量检测
            </button>
            <button className="secondary-button" type="button" onClick={() => props.onSyncAccounts(selectedConnectedIds)} disabled={props.busy || selectedConnectedIds.length === 0}>
              批量同步
            </button>
            <button className="danger-button" type="button" onClick={() => props.onDeleteAccounts(selectedVisibleIds)} disabled={props.busy || selectedVisibleIds.length === 0}>
              批量删除
            </button>
          </div>
        }
      />

      <section className="workspace-layout">
        <article className="panel">
          <div className="panel-header">
            <div className="panel-head-copy">
              <p className="eyebrow">Accounts</p>
              <h3>账号清单</h3>
            </div>
            <span className="subtle-chip">共 {filteredAccounts.length} 个结果</span>
          </div>
          {filteredAccounts.length > 0 ? (
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={filteredAccounts.length > 0 && selectedVisibleIds.length === filteredAccounts.length}
                        onChange={(event) => toggleSelectAll(event.target.checked)}
                      />
                    </th>
                    <th>账号</th>
                    <th>分组</th>
                    <th>凭证完整度</th>
                    <th>联通状态</th>
                    <th>邮件能力</th>
                    <th>最近同步</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account) => {
                    const authState = account.has_client_id && account.has_refresh_token ? "完整" : account.has_client_id || account.has_refresh_token ? "待补齐" : "缺失";
                    const tone =
                      authState === "完整" ? "success" : authState === "待补齐" ? "warning" : "danger";

                    return (
                      <tr key={account.id ?? account.email} className={selectedAccount?.id === account.id ? "selected" : ""} onClick={() => setSelectedAccountId(account.id)}>
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
                            <span>
                              {account.mail_provider} · {account.import_format}
                            </span>
                          </div>
                        </td>
                        <td>{account.group_name || "未分组"}</td>
                        <td>
                          <span className={`badge tone-${tone}`}>{authState}</span>
                        </td>
                        <td>
                          <span className={`badge tone-${getConnectivityTone(account.connectivity_status)}`}>{formatConnectivityStatus(account.connectivity_status)}</span>
                        </td>
                        <td>{formatMailCapability(account.mail_capability_status)}</td>
                        <td>{formatDateTime(account.last_mail_sync_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="当前筛选下没有账号" description="可以尝试放宽筛选条件、清空关键词，或者先导入一批账号进入统一账号池。" />
          )}
        </article>

        <DetailDrawer
          eyebrow="Detail"
          title={selectedAccount ? selectedAccount.email : "账号详情"}
          description={selectedAccount ? "把高频运营信息和低频高级操作拆开，主流程更清楚。" : "选择左侧账号后，这里会展示详情与操作。"}
        >
          {selectedAccount ? (
            <div className="drawer-stack">
              <div className="detail-list">
                <div className="detail-row">
                  <span>账号状态</span>
                  <strong>{formatStatus(selectedAccount.status)}</strong>
                </div>
                <div className="detail-row">
                  <span>联通状态</span>
                  <span className={`badge tone-${getConnectivityTone(selectedAccount.connectivity_status)}`}>
                    {formatConnectivityStatus(selectedAccount.connectivity_status)}
                  </span>
                </div>
                <div className="detail-row">
                  <span>邮件能力</span>
                  <strong>{formatMailCapability(selectedAccount.mail_capability_status)}</strong>
                </div>
                <div className="detail-row">
                  <span>分组</span>
                  <strong>{selectedAccount.group_name || "未分组"}</strong>
                </div>
                <div className="detail-row">
                  <span>Token 状态</span>
                  <span className={`badge tone-${getStatusTone(selectedAccount.token_status || "unknown")}`}>{formatStatus(selectedAccount.token_status || "unknown")}</span>
                </div>
                <div className="detail-row">
                  <span>Token 过期</span>
                  <strong>{formatDateTime(selectedAccount.token_expires_at)}</strong>
                </div>
                <div className="detail-row">
                  <span>最近检测</span>
                  <strong>{formatDateTime(selectedAccount.last_connectivity_check_at)}</strong>
                </div>
                <div className="detail-row">
                  <span>最近同步</span>
                  <strong>{formatDateTime(selectedAccount.last_mail_sync_at)}</strong>
                </div>
              </div>

              <div className="button-row">
                <button className="secondary-button" type="button" onClick={() => selectedAccount.id && props.onTestAccount(selectedAccount.id)} disabled={props.busy || !selectedAccount.id}>
                  检测当前账号
                </button>
                <button className="secondary-button" type="button" onClick={() => selectedAccount.id && props.onAuthorizeAccount(selectedAccount.id)} disabled={props.busy || !selectedAccount.id}>
                  补授权
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => selectedAccount.id && props.onSyncAccounts([selectedAccount.id])}
                  disabled={props.busy || !selectedAccount.id || selectedAccount.connectivity_status !== "connected"}
                >
                  同步邮件
                </button>
                <button className="danger-button" type="button" onClick={() => selectedAccount.id && props.onDeleteAccounts([selectedAccount.id])} disabled={props.busy || !selectedAccount.id}>
                  删除账号
                </button>
              </div>

              <div className="callout">
                <strong>凭证完整度</strong>
                <p>
                  Client ID：{formatBooleanText(selectedAccount.has_client_id)}，Refresh Token：{formatBooleanText(selectedAccount.has_refresh_token)}。
                </p>
              </div>

              {selectedAccount.last_error ? (
                <div className="callout callout-danger">
                  <strong>最近错误</strong>
                  <p>{selectedAccount.last_error}</p>
                </div>
              ) : (
                <div className="callout callout-success">
                  <strong>当前没有错误</strong>
                  <p>这个账号最近没有留下错误信息，可以继续做批量检测或邮件同步。</p>
                </div>
              )}

              <details className="details-block">
                <summary>高级凭证编辑</summary>
                <div className="details-content">
                  <p className="subtle-text">为了避免误覆盖，只有填写的字段才会提交更新；留空不会覆盖当前已有配置。</p>
                  <label className="field">
                    <span>Client ID</span>
                    <input value={authDraft.clientId} onChange={(event) => setAuthDraft((current) => ({ ...current, clientId: event.target.value }))} placeholder="粘贴新的 client_id" />
                  </label>
                  <label className="field">
                    <span>Refresh Token</span>
                    <textarea
                      rows={4}
                      value={authDraft.refreshToken}
                      onChange={(event) => setAuthDraft((current) => ({ ...current, refreshToken: event.target.value }))}
                      placeholder="粘贴新的 refresh_token"
                    />
                  </label>
                  <button className="primary-button" type="button" onClick={submitAuthUpdate} disabled={props.busy || (!authDraft.clientId.trim() && !authDraft.refreshToken.trim())}>
                    保存凭证
                  </button>
                </div>
              </details>
            </div>
          ) : (
            <EmptyState title="先选择一个账号" description="左侧选中账号后，这里会展示当前生命周期状态、最近错误和高级凭证编辑入口。" />
          )}
        </DetailDrawer>
      </section>
    </section>
  );
}
