import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import {
  createAccount,
  exportAccounts,
  importAccountsFile,
  listAccounts,
  saveExportFile,
} from "../api/client";
import { AccountFormModal } from "../components/account-form-modal";
import { CopyableSecret } from "../components/copyable-secret";
import { StatusPill } from "../components/status-pill";
import { formatDateTime, formatSyncMode } from "../lib/account-formatters";
import type { AccountSummary, ImportFailure } from "../types/api";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

type EmailCellProps = {
  account: AccountSummary;
  checked: boolean;
  onToggle: () => void;
};

function EmailCell({ account, checked, onToggle }: EmailCellProps) {
  return (
    <div className="email-cell">
      <input
        aria-label={`选择账号 ${account.email}`}
        checked={checked}
        className="checkbox-input email-row-checkbox"
        onChange={onToggle}
        type="checkbox"
      />
      <div className="email-primary">
        <div className="email-main">
          <Link
            className="email-link"
            title={account.email}
            to={`/accounts/${account.id}`}
          >
            {account.email}
          </Link>
          <button
            aria-label={`复制 ${account.email} 的邮箱`}
            className="copy-button email-copy-button"
            onClick={async () => {
              await navigator.clipboard.writeText(account.email);
            }}
            type="button"
          >
            复制
          </button>
        </div>
        {account.last_error ? (
          <p className="table-error">{account.last_error}</p>
        ) : null}
      </div>
    </div>
  );
}

function SyncModeBadge({ value }: { value: AccountSummary["sync_mode"] }) {
  if (!value) {
    return <span className="sync-mode-empty">--</span>;
  }

  const statusClass = value === "idle" ? "status-idle" : "status-polling";

  return (
    <span className={`status-pill sync-mode-pill ${statusClass}`}>
      {formatSyncMode(value)}
    </span>
  );
}

export function AccountsPage() {
  const queryClient = useQueryClient();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [importFailures, setImportFailures] = useState<ImportFailure[]>([]);
  const [selectedImportFileName, setSelectedImportFileName] = useState<
    string | null
  >(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const accountsQuery = useQuery({
    queryKey: ["accounts", search, accountStatus],
    queryFn: () => listAccounts({ query: search, accountStatus }),
  });

  const accounts = accountsQuery.data ?? [];

  const addMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      setNotice({
        tone: "success",
        text: "账号已保存，现在可以发起连通性测试。",
      });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        text: `保存失败：${error instanceof Error ? error.message : "未知错误"}`,
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: importAccountsFile,
    onMutate: () => {
      setNotice({ tone: "info", text: "正在导入文件，请稍候..." });
    },
    onSuccess: (result) => {
      setImportFailures(result.failures);
      setNotice({
        tone: "success",
        text: `已导入 ${result.imported} 条，更新 ${result.updated} 条。`,
      });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        text: `导入失败：${error instanceof Error ? error.message : "未知错误"}`,
      });
    },
  });

  return (
    <section className="page accounts-page">
      <input
        ref={importInputRef}
        accept=".txt,.csv,text/plain"
        className="hidden-file-input"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }

          setImportFailures([]);
          setSelectedImportFileName(file.name);
          setNotice({
            tone: "info",
            text: `已选择文件：${file.name}，开始导入。`,
          });

          try {
            await importMutation.mutateAsync(file);
          } finally {
            event.target.value = "";
          }
        }}
        type="file"
      />

      <div className="page-actions">
        <button
          className="secondary-button"
          disabled={importMutation.isPending}
          onClick={() => {
            setImportFailures([]);
            setSelectedImportFileName(null);
            importInputRef.current?.click();
          }}
          type="button"
        >
          {importMutation.isPending ? "导入中..." : "批量导入"}
        </button>
        <button
          className="primary-button"
          onClick={() => setFormOpen(true)}
          type="button"
        >
          手动新增
        </button>
      </div>

      <div className="panel sticky-toolbar">
        <div className="toolbar-stack">
          <div className="toolbar-grid">
            <label className="filter-field">
              <span className="field-label">搜索账号</span>
              <input
                className="text-input"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="按邮箱或 client_id 搜索"
                value={search}
              />
            </label>
            <label className="filter-field">
              <span className="field-label">账号状态</span>
              <select
                className="select-input"
                value={accountStatus}
                onChange={(event) => setAccountStatus(event.target.value)}
              >
                <option value="">全部状态</option>
                <option value="disconnected">未连接</option>
                <option value="connecting">连接中</option>
                <option value="connected">已连接</option>
              </select>
            </label>
            <div className="toolbar-actions">
              <button
                className="secondary-button"
                onClick={async () => {
                  const result = await exportAccounts({
                    ids: selectedIds.length > 0 ? selectedIds : undefined,
                    query: selectedIds.length === 0 ? search : undefined,
                    accountStatus:
                      selectedIds.length === 0 ? accountStatus : undefined,
                  });
                  await saveExportFile({
                    defaultName: "outlook-accounts.txt",
                    content: result,
                  });
                  setNotice({
                    tone: "success",
                    text: "导出内容已准备好，可以保存到本地文件。",
                  });
                }}
                type="button"
              >
                导出账号
              </button>
            </div>
          </div>
          {selectedImportFileName ? (
            <p className="muted-text">{`最近导入文件：${selectedImportFileName}`}</p>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div
          aria-live="polite"
          className={`notice notice-${notice.tone}`}
          data-prefix={notice.tone === "error" ? "!" : "i"}
        >
          <p>{notice.text}</p>
        </div>
      ) : null}

      {importFailures.length > 0 ? (
        <div className="notice notice-error" data-prefix="!">
          <div className="notice-stack">
            <h4>以下记录导入失败</h4>
            <p>
              请按行号检查源文件格式，确保每行都是“邮箱----密码----client_id----refresh_token”。
            </p>
            <div className="list-stack">
              {importFailures.map((failure) => (
                <p key={`${failure.line_number}-${failure.reason}`}>
                  {`第 ${failure.line_number} 行：${failure.reason}`}
                </p>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div className="table-shell">
          <table className="data-table accounts-table">
            <thead>
              <tr>
                <th scope="col">邮箱</th>
                <th scope="col">密码</th>
                <th scope="col">client_id</th>
                <th scope="col">refresh_token</th>
                <th scope="col">access_token</th>
                <th scope="col">过期时间</th>
                <th scope="col">同步模式</th>
                <th scope="col">状态</th>
                <th scope="col">更新时间</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const checked = selectedIds.includes(account.id);
                return (
                  <tr key={account.id}>
                    <td>
                      <EmailCell
                        account={account}
                        checked={checked}
                        onToggle={() => {
                          setSelectedIds((current) =>
                            checked
                              ? current.filter((id) => id !== account.id)
                              : [...current, account.id],
                          );
                        }}
                      />
                    </td>
                    <td>
                      <CopyableSecret
                        ariaLabel={`复制 ${account.email} 的密码`}
                        value={account.password}
                      />
                    </td>
                    <td>
                      <CopyableSecret
                        ariaLabel={`复制 ${account.email} 的 client_id`}
                        value={account.client_id}
                      />
                    </td>
                    <td>
                      <CopyableSecret
                        ariaLabel={`复制 ${account.email} 的 refresh_token`}
                        value={account.refresh_token}
                      />
                    </td>
                    <td>
                      <CopyableSecret
                        ariaLabel={`复制 ${account.email} 的 access_token`}
                        value={account.access_token}
                      />
                    </td>
                    <td>
                      <span className="table-time-value">
                        {formatDateTime(account.access_token_expires_at)}
                      </span>
                    </td>
                    <td>
                      <div className="status-cell">
                        <SyncModeBadge value={account.sync_mode} />
                      </div>
                    </td>
                    <td>
                      <div className="status-cell">
                        <StatusPill value={account.account_status} />
                      </div>
                    </td>
                    <td>
                      <span className="table-time-value">
                        {formatDateTime(account.updated_at)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {accountsQuery.isLoading ? (
          <p className="muted-text">账号加载中...</p>
        ) : null}
        {!accountsQuery.isLoading && accounts.length === 0 ? (
          <div className="empty-state list-stack">
            <h4>当前没有可显示的账号</h4>
            <p className="muted-text">
              你可以先手动新增账号，或者通过文件批量导入。
            </p>
          </div>
        ) : null}
      </div>

      <AccountFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={async (payload) => {
          await addMutation.mutateAsync(payload);
        }}
      />
    </section>
  );
}
