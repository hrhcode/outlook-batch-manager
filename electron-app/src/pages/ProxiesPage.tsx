import { MetricCard } from "../components/MetricCard";
import { PageTitle } from "../components/PageTitle";
import { formatDateTime, formatStatus } from "../lib/format";
import type { ProxyItem } from "../types";

export function ProxiesPage(props: {
  proxies: ProxyItem[];
  busy: boolean;
  onImport: () => void;
  onRefresh: () => void;
}) {
  const healthyCount = props.proxies.filter((proxy) => proxy.status === "healthy").length;
  const unhealthyCount = props.proxies.filter((proxy) => proxy.status === "unhealthy").length;

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="Proxies"
        title="代理池"
        description="从后端读取真实代理列表和状态，管理导入并观察最近使用情况。"
        actions={
          <div className="toolbar-actions">
            <button className="ghost-button" onClick={props.onImport} disabled={props.busy}>
              导入代理
            </button>
            <button className="ghost-button" onClick={props.onRefresh} disabled={props.busy}>
              刷新
            </button>
          </div>
        }
      />

      <section className="summary-grid">
        <MetricCard label="代理总数" value={props.proxies.length} />
        <MetricCard label="健康代理" value={healthyCount} />
        <MetricCard label="异常代理" value={unhealthyCount} />
      </section>

      <article className="panel">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>代理地址</th>
                <th>启用状态</th>
                <th>健康状态</th>
                <th>最近使用</th>
              </tr>
            </thead>
            <tbody>
              {props.proxies.length ? (
                props.proxies.map((proxy) => (
                  <tr key={proxy.id ?? proxy.server}>
                    <td>{proxy.server}</td>
                    <td>{proxy.enabled ? "启用" : "停用"}</td>
                    <td>{formatStatus(proxy.status)}</td>
                    <td>{formatDateTime(proxy.last_used_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state">当前还没有代理数据。</div>
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

