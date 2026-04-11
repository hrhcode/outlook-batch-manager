import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { cancelRegisterTask, getRegisterStatus } from "../api/client";
import type { RegisterProgress, RegisterTaskStatus } from "../types/api";

type RegisterProgressPanelProps = {
  taskId: number;
  onComplete: () => void;
};

export function RegisterProgressPanel({
  taskId,
  onComplete,
}: RegisterProgressPanelProps) {
  const [progress, setProgress] = useState<RegisterProgress | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["register-status", taskId],
    queryFn: () => getRegisterStatus(taskId),
    refetchInterval: (data) => {
      if (data?.status === "completed" || data?.status === "cancelled") {
        return false;
      }
      return 1000;
    },
  });

  useEffect(() => {
    const eventSource = new EventSource(`/api/register/progress/${taskId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RegisterProgress;
        setProgress(data);
      } catch {
        // Ignore parse errors
      }
    };

    return () => {
      eventSource.close();
    };
  }, [taskId]);

  useEffect(() => {
    if (
      statusQuery.data?.status === "completed" ||
      statusQuery.data?.status === "cancelled"
    ) {
      onComplete();
    }
  }, [statusQuery.data?.status, onComplete]);

  const handleCancel = async () => {
    await cancelRegisterTask(taskId);
    setCancelled(true);
  };

  const status = statusQuery.data;
  const isRunning =
    status?.status === "running" || status?.status === "pending";
  const progressPercent = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="panel register-progress-panel">
      <div className="panel-header">
        <h3>批量注册进度</h3>
        <p className="field-hint">
          任务 #{taskId} -{" "}
          {status?.status === "completed"
            ? "已完成"
            : status?.status === "cancelled"
              ? "已取消"
              : "进行中"}
        </p>
      </div>

      <div className="progress-stats">
        <div className="stat-item">
          <span className="stat-label">总数</span>
          <span className="stat-value">{status?.total_count ?? 0}</span>
        </div>
        <div className="stat-item success">
          <span className="stat-label">成功</span>
          <span className="stat-value">{status?.succeeded_count ?? 0}</span>
        </div>
        <div className="stat-item failed">
          <span className="stat-label">失败</span>
          <span className="stat-value">{status?.failed_count ?? 0}</span>
        </div>
      </div>

      <div className="progress-bar-container">
        <div
          className="progress-bar"
          style={{ width: `${progressPercent}%` }}
        />
        <span className="progress-text">{progressPercent}%</span>
      </div>

      {progress ? (
        <div className="progress-latest">
          <p>
            <strong>最新状态：</strong>
            <span
              className={
                progress.latest_status === "success"
                  ? "text-success"
                  : "text-error"
              }
            >
              {progress.latest_status === "success" ? "成功" : "失败"}
            </span>
          </p>
          {progress.latest_email ? (
            <p>
              <strong>邮箱：</strong>
              {progress.latest_email}
            </p>
          ) : null}
          <p>
            <strong>消息：</strong>
            {progress.message}
          </p>
        </div>
      ) : null}

      {isRunning && !cancelled ? (
        <div className="panel-actions">
          <button
            className="secondary-button danger"
            onClick={handleCancel}
            type="button"
          >
            取消任务
          </button>
        </div>
      ) : null}
    </div>
  );
}
