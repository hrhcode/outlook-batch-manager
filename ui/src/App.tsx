import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { healthCheck } from "./api/client";
import { AppShell } from "./components/app-shell";
import { useDesktopEvents } from "./hooks/use-events";
import { AccountDetailPage } from "./pages/account-detail-page";
import { AccountsPage } from "./pages/accounts-page";
import { MailPage } from "./pages/mail-page";
import { RegisterPage } from "./pages/register-page";

export default function App() {
  useDesktopEvents();
  const [backendCrashMessage, setBackendCrashMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    return window.desktop?.onBackendCrash?.((payload) => {
      setBackendCrashMessage(payload.message);
    });
  }, []);

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: healthCheck,
    retry: 5,
    retryDelay: 1000,
  });

  if (healthQuery.isLoading) {
    return (
      <div className="startup-screen">
        {"\u672c\u5730\u670d\u52a1\u542f\u52a8\u4e2d..."}
      </div>
    );
  }

  if (healthQuery.isError) {
    return (
      <div className="startup-screen">
        {backendCrashMessage ??
          "\u672c\u5730\u670d\u52a1\u4e0d\u53ef\u7528\uff0c\u8bf7\u91cd\u542f\u684c\u9762\u5e94\u7528\u540e\u91cd\u8bd5\u3002"}
      </div>
    );
  }

  return (
    <>
      {backendCrashMessage ? (
        <div
          aria-live="assertive"
          className="notice notice-error floating-toast"
          data-prefix="!"
        >
          <p>{backendCrashMessage}</p>
        </div>
      ) : null}
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/register" replace />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
          <Route path="/mail" element={<MailPage />} />
        </Route>
      </Routes>
    </>
  );
}
