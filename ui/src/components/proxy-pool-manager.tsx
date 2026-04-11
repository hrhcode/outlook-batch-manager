import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { addProxy, deleteProxy, listProxies, updateProxy } from "../api/client";
import type { ProxyItem } from "../types/api";

export function ProxyPoolManager() {
  const queryClient = useQueryClient();
  const [newProxyUrl, setNewProxyUrl] = useState("");

  const proxiesQuery = useQuery({
    queryKey: ["proxies"],
    queryFn: listProxies,
  });

  const addMutation = useMutation({
    mutationFn: addProxy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proxies"] });
      setNewProxyUrl("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { is_enabled?: boolean };
    }) => updateProxy(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proxies"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProxy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proxies"] });
    },
  });

  const handleAdd = async () => {
    if (!newProxyUrl.trim()) {
      return;
    }
    await addMutation.mutateAsync(newProxyUrl.trim());
  };

  const handleToggle = async (proxy: ProxyItem) => {
    await updateMutation.mutateAsync({
      id: proxy.id,
      data: { is_enabled: !proxy.is_enabled },
    });
  };

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync(id);
  };

  const proxies = proxiesQuery.data ?? [];

  return (
    <div className="proxy-pool-manager">
      <div className="proxy-add-form">
        <input
          className="text-input"
          onChange={(e) => setNewProxyUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleAdd();
            }
          }}
          placeholder="输入代理地址，如 http://127.0.0.1:7897"
          value={newProxyUrl}
        />
        <button
          className="primary-button"
          disabled={addMutation.isPending || !newProxyUrl.trim()}
          onClick={handleAdd}
          type="button"
        >
          {addMutation.isPending ? "添加中..." : "添加代理"}
        </button>
      </div>

      {proxies.length === 0 ? (
        <div className="empty-state">
          <p className="muted-text">暂无代理，请添加代理以启用批量注册功能</p>
        </div>
      ) : (
        <div className="table-shell">
          <table className="data-table proxy-table">
            <thead>
              <tr>
                <th scope="col">代理地址</th>
                <th scope="col">状态</th>
                <th scope="col">成功/失败</th>
                <th scope="col">最后使用</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {proxies.map((proxy) => (
                <tr key={proxy.id}>
                  <td>
                    <code className="proxy-url">{proxy.proxy_url}</code>
                  </td>
                  <td>
                    <span
                      className={`status-pill ${proxy.is_enabled ? "status-connected" : "status-disconnected"}`}
                    >
                      {proxy.is_enabled ? "已启用" : "已禁用"}
                    </span>
                  </td>
                  <td>
                    <span className="success-count">{proxy.success_count}</span>
                    {" / "}
                    <span className="fail-count">{proxy.fail_count}</span>
                  </td>
                  <td>
                    <span className="table-time-value">
                      {proxy.last_used_at
                        ? new Date(proxy.last_used_at).toLocaleString()
                        : "-"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="ghost-button"
                        onClick={() => handleToggle(proxy)}
                        type="button"
                      >
                        {proxy.is_enabled ? "禁用" : "启用"}
                      </button>
                      <button
                        className="ghost-button danger"
                        onClick={() => handleDelete(proxy.id)}
                        type="button"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
