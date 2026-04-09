import { PageTitle } from "../components/PageTitle";
import { formatDateTime, formatStatus } from "../lib/format";
import type { AccountItem } from "../types";

export function AccountsPage(props: {
  accounts: AccountItem[];
  keyword: string;
  status: string;
  busy: boolean;
  onKeywordChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onRefresh: () => void;
  onImport: () => void;
  onExport: () => void;
}) {
  const statusOptions = Array.from(new Set(props.accounts.map((account) => account.status)));

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="Accounts"
        title="账号库"
        description="筛选和查看账号资产，并完成导入导出，保持账号库与后端数据完全一致。"
        actions={
          <div className="toolbar-actions">
            <button className="ghost-button" onClick={props.onImport} disabled={props.busy}>
              导入账号
            </button>
            <button className="ghost-button" onClick={props.onExport} disabled={props.busy}>
              导出当前筛选
            </button>
            <button className="ghost-button" onClick={props.onRefresh} disabled={props.busy}>
              刷新
            </button>
          </div>
        }
      />

      <article className="panel">
        <div className="toolbar">
          <input
            className="search-input"
            placeholder="搜索邮箱、分组、备注、状态"
            value={props.keyword}
            onChange={(event) => props.onKeywordChange(event.target.value)}
          />
          <select value={props.status} onChange={(event) => props.onStatusChange(event.target.value)}>
            <option value="">全部状态</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </div>

        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>邮箱</th>
                <th>状态</th>
                <th>Token 状态</th>
                <th>分组</th>
                <th>来源</th>
                <th>恢复邮箱</th>
                <th>最近校验</th>
              </tr>
            </thead>
            <tbody>
              {props.accounts.length ? (
                props.accounts.map((account) => (
                  <tr key={account.id ?? account.email}>
                    <td>
                      <div className="primary-cell">
                        <strong>{account.email}</strong>
                        <span>{account.password}</span>
                      </div>
                    </td>
                    <td>{formatStatus(account.status)}</td>
                    <td>{account.token_status ? formatStatus(account.token_status) : "未获取"}</td>
                    <td>{account.group_name || "-"}</td>
                    <td>{account.source || "-"}</td>
                    <td>{account.recovery_email || "-"}</td>
                    <td>{formatDateTime(account.last_login_check_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">当前筛选下没有账号记录。</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

