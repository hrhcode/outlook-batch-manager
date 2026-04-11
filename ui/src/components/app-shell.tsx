import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { ThemeToggle } from "./theme-toggle";

const PAGE_META: Record<string, { title: string; description: string }> = {
  "/register": {
    title: "批量注册",
    description: "",
  },
  "/accounts": {
    title: "账号池",
    description: "",
  },
  "/mail": {
    title: "邮件中心",
    description: "",
  },
};

const SIDEBAR_STORAGE_KEY = "core-gateway-sidebar-collapsed";

export function AppShell() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true",
  );

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const pageMeta = location.pathname.startsWith("/accounts/")
    ? {
        title: "账号详情",
        description: "",
      }
    : (PAGE_META[location.pathname] ?? PAGE_META["/accounts"]);

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-header-row">
            <div className="sidebar-copy">
              <h1>控制中心</h1>
            </div>
            <button
              aria-label={sidebarCollapsed ? "展开侧栏" : "折叠侧栏"}
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed((current) => !current)}
              title={sidebarCollapsed ? "展开侧栏" : "折叠侧栏"}
              type="button"
            >
              {sidebarCollapsed ? "展开" : "收起"}
            </button>
          </div>
        </div>

        <nav className="nav">
          <NavLink className="nav-link" to="/register">
            <span className="nav-label">批量注册</span>
          </NavLink>
          <NavLink className="nav-link" to="/accounts">
            <span className="nav-label">账号池</span>
          </NavLink>
          <NavLink className="nav-link" to="/mail">
            <span className="nav-label">邮件中心</span>
          </NavLink>
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <div className="topbar-title">
            <h2>{pageMeta.title}</h2>
            {pageMeta.description ? (
              <p className="page-description">{pageMeta.description}</p>
            ) : null}
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </header>
        <div className="content-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
